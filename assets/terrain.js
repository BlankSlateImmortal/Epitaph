/* Epitaph — interactive topography.
 * A drifting, living land mass drawn as contour lines on a canvas.
 *  - slowly morphs over time
 *  - rises under the pointer (a "lens" that lifts the ground)
 *  - drag to pan the land (with inertia)
 *  - seed(key) gives every place its own coastline
 *
 *   const t = new EpitaphTerrain(canvas, { host: element, color: '#ffb238', onReadout: fn })
 *   t.seed('ERA_1:northam'); t.setActive(true/false); t.destroy();
 */
(function (global) {
  'use strict';

  // ---- 2D simplex noise (public-domain algorithm, compact form) ----
  function makeNoise(seed) {
    const p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    let s = seed >>> 0 || 1;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      const sk = (xin + yin) * F2;
      const i = Math.floor(xin + sk), j = Math.floor(yin + sk);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const g = G[p[ii + p[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = G[p[ii + i1 + p[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = G[p[ii + 1 + p[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
      return 70 * n;
    };
  }
  function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  function EpitaphTerrain(canvas, opts) {
    opts = opts || {};
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.host = opts.host || canvas;
    this.color = opts.color || '#ffb238';
    this.dim = opts.dim || '#8a5a14';
    this.cell = opts.cell || 6;
    this.levels = opts.levels || 14;
    this.lift = opts.lift != null ? opts.lift : 1.6;   // stacked "isometric" offset per level (px)
    this.island = opts.island != null ? opts.island : 1; // 1 = land mass in the middle, 0 = endless terrain
    this.onReadout = opts.onReadout || null;
    this.reduce = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    this.ox = 0; this.oy = 0; this.vx = 0; this.vy = 0;
    this.t = 0;
    this.pointer = { x: -1e4, y: -1e4, inside: false };
    this.bump = 0;
    this.active = true;
    this.seed(opts.seed || 'epitaph');
    this._bind();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  EpitaphTerrain.prototype.seed = function (key) {
    const h = hash(String(key));
    this.noise = makeNoise(h);
    this.noise2 = makeNoise(h ^ 0x9e3779b9);
    this.scale = 0.0030 + (h % 1000) / 1000 * 0.0018;
    this.ox = 0; this.oy = 0; this.vx = 0; this.vy = 0;
    this._dirty = true;
  };
  EpitaphTerrain.prototype.setActive = function (on) { this.active = !!on; this.cv.style.opacity = on ? '' : '0'; };

  EpitaphTerrain.prototype._bind = function () {
    const host = this.host, self = this;
    let drag = null;
    this._onMove = function (e) {
      const r = self.cv.getBoundingClientRect();
      self.pointer.x = e.clientX - r.left; self.pointer.y = e.clientY - r.top;
      self.pointer.inside = self.pointer.x >= 0 && self.pointer.y >= 0 && self.pointer.x <= r.width && self.pointer.y <= r.height;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        self.ox -= dx; self.oy -= dy; self.vx = -dx; self.vy = -dy;
        drag.x = e.clientX; drag.y = e.clientY;
      }
    };
    this._onLeave = function () { self.pointer.inside = false; };
    this._onDown = function (e) {
      // only start a drag on empty ground, never on map pins / shapes / buttons
      const tgt = e.target;
      if (tgt.closest && tgt.closest('.continent-shape, .city-mark, .geo-city, .geo-site, .geo-country, .char-marker, .marker, button, a, [data-no-pan]')) return;
      drag = { x: e.clientX, y: e.clientY, moved: false };
      host.classList.add('terrain-dragging');
    };
    this._onUp = function () { drag = null; host.classList.remove('terrain-dragging'); };
    host.addEventListener('pointermove', this._onMove);
    host.addEventListener('pointerleave', this._onLeave);
    host.addEventListener('pointerdown', this._onDown);
    global.addEventListener('pointerup', this._onUp);
  };

  EpitaphTerrain.prototype.destroy = function () {
    cancelAnimationFrame(this._raf);
    this.host.removeEventListener('pointermove', this._onMove);
    this.host.removeEventListener('pointerleave', this._onLeave);
    this.host.removeEventListener('pointerdown', this._onDown);
    global.removeEventListener('pointerup', this._onUp);
  };

  EpitaphTerrain.prototype.height = function (x, y, w, h) {
    const s = this.scale, X = (x + this.ox) * s, Y = (y + this.oy) * s, tt = this.t;
    let v = this.noise(X + tt * 0.6, Y) * 0.62 + this.noise(X * 2.1, Y * 2.1 - tt) * 0.26 + this.noise2(X * 4.3 + tt, Y * 4.3) * 0.12;
    if (this.island) {
      const nx = (x / w - 0.5) * 2, ny = (y / h - 0.5) * 2;
      v += 0.55 - (nx * nx + ny * ny) * 0.9 * this.island;
    }
    if (this.bump > 0.01) {
      const dx = x - this.pointer.x, dy = y - this.pointer.y;
      v += this.bump * 0.9 * Math.exp(-(dx * dx + dy * dy) / (2 * 46 * 46));
    }
    return v;
  };

  EpitaphTerrain.prototype._loop = function () {
    this._raf = requestAnimationFrame(this._loop);
    if (!this.active || document.hidden) return;
    const cv = this.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }

    // motion
    if (!this.reduce) this.t += 0.0016;
    this.ox += this.vx; this.oy += this.vy; this.vx *= 0.92; this.vy *= 0.92;
    const target = this.pointer.inside ? 1 : 0;
    this.bump += (target - this.bump) * 0.08;
    if (this.reduce && !this._dirty && Math.abs(this.vx) + Math.abs(this.vy) < 0.05 && Math.abs(target - this.bump) < 0.01) return;
    this._dirty = false;

    const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const c = this.cell, cols = Math.ceil(w / c) + 1, rows = Math.ceil(h / c) + 1;
    const H = new Float32Array(cols * rows);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = this.height(i * c, j * c, w, h); H[j * cols + i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    const sea = 0.12;

    // ocean: sparse dot grid below sea level (from the Atlas reference)
    ctx.fillStyle = rgba(this.dim, 0.55);
    for (let j = 0; j < rows; j += 3) for (let i = 0; i < cols; i += 3) {
      if (H[j * cols + i] < sea) ctx.fillRect(i * c, j * c, 1, 1);
    }

    // contours with marching squares, each level stacked upward a little
    const L = this.levels, step = (Math.max(hi, sea + 0.4) - sea) / L;
    for (let k = 0; k <= L; k++) {
      const lv = sea + k * step, lift = -k * this.lift;
      const isCoast = k === 0, isPeak = k >= L - 2;
      ctx.beginPath();
      ctx.strokeStyle = isCoast ? rgba(this.color, 0.95) : rgba(this.color, 0.16 + (k / L) * 0.55);
      ctx.lineWidth = isCoast ? 1.4 : isPeak ? 1.1 : 0.8;
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = H[j * cols + i], b = H[j * cols + i + 1], d = H[(j + 1) * cols + i], e = H[(j + 1) * cols + i + 1];
          const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (e > lv ? 2 : 0) | (d > lv ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const x = i * c, y = j * c + lift;
          const top = [x + c * (lv - a) / (b - a), y], right = [x + c, y + c * (lv - b) / (e - b)];
          const bottom = [x + c * (lv - d) / (e - d), y + c], left = [x, y + c * (lv - a) / (d - a)];
          const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
          switch (idx) {
            case 1: case 14: seg(left, bottom); break;
            case 2: case 13: seg(bottom, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(top, right); break;
            case 5: seg(left, top); seg(bottom, right); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, top); break;
            case 10: seg(left, bottom); seg(top, right); break;
          }
        }
      }
      ctx.stroke();
    }

    // pointer lens + readout
    if (this.bump > 0.05 && this.pointer.inside) {
      const px = this.pointer.x, py = this.pointer.y;
      ctx.strokeStyle = rgba(this.color, 0.6 * this.bump); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 56, py); ctx.lineTo(px - 50, py); ctx.moveTo(px + 50, py); ctx.lineTo(px + 56, py);
      ctx.moveTo(px, py - 56); ctx.lineTo(px, py - 50); ctx.moveTo(px, py + 50); ctx.lineTo(px, py + 56); ctx.stroke();
      if (this.onReadout) {
        const v = this.height(px, py, w, h);
        this.onReadout({ elevation: Math.round((v - sea) * 4200), x: px, y: py, land: v >= sea });
      }
    } else if (this.onReadout && this._lastInside) {
      this.onReadout(null);
    }
    this._lastInside = this.pointer.inside;
  };

  global.EpitaphTerrain = EpitaphTerrain;
})(typeof window !== 'undefined' ? window : globalThis);
