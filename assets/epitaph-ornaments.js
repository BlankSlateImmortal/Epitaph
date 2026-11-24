/* Epitaph — the ornament kit (docs/plans/book-redesign.md, Phase 0): the details the user liked in the mark deck and the grimoire, in one
 * place so every view of the book matches. Pure helpers returning HTML/SVG strings; the look lives in epitaph-book.css (.orn-*).
 *
 *   EpitaphOrn.roman(n)            1 -> 'I', 14 -> 'XIV' (0 -> '0')
 *   EpitaphOrn.corners()           four card corners (place inside a position:relative box)
 *   EpitaphOrn.ring()              the sigil ring: rune ring + dashed inner ring (currentColor), as an SVG that fills its box
 *   EpitaphOrn.pips(n, of)         n of `of` level diamonds (default 7)
 *   EpitaphOrn.seals(n, max)       n small glowing dots (counts: holders, copies…), at most `max` (default 6)
 */
(function (global) {
  'use strict';
  const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  function roman(n) { let r = '', x = Math.max(0, Math.floor(+n || 0)); ROMAN.forEach(([v, s]) => { while (x >= v) { r += s; x -= v; } }); return r || '0'; }
  const cornerSvg = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 12 V1 H12 M4 8 V4 H8" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
  const corners = () => `<span class="orn-c tl" aria-hidden="true">${cornerSvg}</span><span class="orn-c tr" aria-hidden="true">${cornerSvg}</span><span class="orn-c bl" aria-hidden="true">${cornerSvg}</span><span class="orn-c br" aria-hidden="true">${cornerSvg}</span>`;
  const ring = () => `<svg class="orn-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="1"/>
    <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="2 4"/>
    <g fill="currentColor" fill-opacity=".6" font-size="7" text-anchor="middle"><text x="50" y="7">ᚠ</text><text x="96" y="52">ᚱ</text><text x="50" y="99">ᛟ</text><text x="4" y="52">ᛉ</text></g></svg>`;
  const pips = (n, of) => { const k = of || 7; return `<span class="orn-pips" aria-hidden="true">${Array.from({ length: k }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`; };
  const seals = (n, max) => `<span class="orn-seals" aria-hidden="true">${Array.from({ length: Math.min(Math.max(0, n | 0), max || 6) }, () => '<i></i>').join('')}</span>`;
  global.EpitaphOrn = { roman, corners, ring, pips, seals };
})(typeof window !== 'undefined' ? window : globalThis);
