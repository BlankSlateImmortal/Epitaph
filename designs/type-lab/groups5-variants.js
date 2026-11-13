
  // ======================= round 5 · ANTHOLONIOUS · the book, staged =======================
  const bookCaps = (d, left) => cap(14, 22, left, 'start', AMB) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900);
  const bookHalo = (id, d, x, y, rad) => ({ defs: `<radialGradient id="${id}"><stop offset="0" stop-color="${d.acc}" stop-opacity=".28"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></radialGradient><radialGradient id="${id}s"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`, body: `<circle cx="${x}" cy="${y}" r="${rad}" fill="url(#${id})"/>` });

  // B2 · lying flat: the book on its back, seen from above and in front, with its titles laid out like a desk
  function bookB(d){
    const { defs, book } = bookCore(d, { ry: 20, rx: 68 }), h = bookHalo('b2h', d, 300, 200, 220);
    let b = h.body + `<ellipse cx="300" cy="262" rx="230" ry="46" fill="url(#b2hs)"/>` + placeBook(book, 300, 214, 1.15);
    const t = d.titles.join('  ·  ').toUpperCase();
    b += cap(300, 372, t, 'middle', DUST, 8, 3) + bookCaps(d, 'THE SCRIBE’S BOOK · AT REST');
    return svg(`<defs>${defs}${h.defs}</defs>${b}${grain(0.12)}`, d.word);
  }
  // B3 · spine first: turned to show the spine, like a book pulled halfway off a shelf
  function bookC(d){
    const { defs, book } = bookCore(d, { ry: 64, rx: -10 }), h = bookHalo('b3h', d, 300, 196, 200);
    let shelf = '';
    [[-180, 0.55, 26], [-128, 0.7, 30], [150, 0.7, 28], [196, 0.55, 22]].forEach(([dx, op, w], i) => { const x = 300 + dx; shelf += `<rect x="${x - w / 2}" y="${84 + i * 4}" width="${w}" height="${236 - i * 8}" fill="${i % 2 ? '#2b1a0e' : '#1f130a'}" stroke="${DIM}" stroke-width=".6" opacity="${op}"/><rect x="${x - w / 2}" y="${120 + i * 4}" width="${w}" height="4" fill="${d.acc}" opacity="${op * 0.6}"/>`; });
    let b = h.body + shelf + `<line x1="60" y1="326" x2="540" y2="326" stroke="${DUST}" stroke-width="2"/><rect x="60" y="326" width="480" height="10" fill="#1a0f07"/>` + placeBook(book, 300, 206, 0.92);
    b += bookCaps(d, 'THE SCRIBE’S BOOK · SPINE OUT') + cap(300, 360, 'ONE VOLUME LEANS OUT OF THE ROW', 'middle', DIM, 8, 3);
    return svg(`<defs>${defs}${h.defs}</defs>${b}${grain(0.12)}`, d.word);
  }
  // B4 · banded: a strip of his titles circles the book, passing behind it and in front
  function bookD(d){
    const { defs, book } = bookCore(d), h = bookHalo('b4h', d, 300, 196, 210);
    const txt = (d.titles.join('  ✦  ') + '  ✦  ' + d.concept.toUpperCase() + '  ✦  ').toUpperCase();
    const ring = (part, op) => orbitText({ id: 'b4' + part, cx: 300, cy: 214, rx: 210, ry: 50, rot: -10, text: txt, font: 'Bodoni Moda', weight: 600, size: 15, ls: 3, col: d.acc, dur: 40, part, fade: 0.2, op });
    const back = ring('back', 0.5), front = ring('front', 1);
    const band = (part) => `<g transform="rotate(-10 300 214)"><clipPath id="b4c${part}"><rect x="0" y="${part === 'front' ? 214 : 0}" width="${W}" height="${part === 'front' ? 200 : 214}"/></clipPath><ellipse cx="300" cy="214" rx="210" ry="50" fill="none" stroke="${d.acc}" stroke-width="22" opacity="${part === 'front' ? 0.16 : 0.08}" clip-path="url(#b4c${part})"/></g>`;
    let b = h.body + `<ellipse cx="310" cy="340" rx="140" ry="14" fill="url(#b4hs)"/>` + band('back') + back.body + bob(placeBook(book, 300, 196, 0.86)) + band('front') + front.body;
    b += bookCaps(d, 'THE SCRIBE’S BOOK · BOUND IN HIS TITLES');
    return svg(`<defs>${defs}${h.defs}${back.defs}${front.defs}</defs>${b}${grain(0.12)}`, d.word);
  }
  // B5 · pedestal: the book on a stone plinth under one cone of light, dust hanging in the beam
  function bookE(d){
    const r = rng('b5' + d.word), { defs, book } = bookCore(d, { ry: 26, rx: -12 });
    const px = 300, top = 268;
    const pd = `<linearGradient id="b5s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a140d"/><stop offset=".4" stop-color="#5a4a36"/><stop offset=".6" stop-color="#3e3226"/><stop offset="1" stop-color="#120e09"/></linearGradient>
      <linearGradient id="b5l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.acc}" stop-opacity=".32"/><stop offset="1" stop-color="${d.acc}" stop-opacity="0"/></linearGradient>`;
    let b = `<polygon points="${px - 30},0 ${px + 30},0 ${px + 150},${top + 10} ${px - 150},${top + 10}" fill="url(#b5l)"/>`;
    for (let i = 0; i < 40; i++) { const y = r() * top, w = 30 + (y / top) * 120, x = px + (r() * 2 - 1) * w * 0.8; b += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(0.5 + r())}" fill="${BONE}" opacity="${(0.15 + r() * 0.4).toFixed(2)}">${anim(`<animate attributeName="cy" values="${f1(y)};${f1(y + 14)};${f1(y)}" dur="${(6 + r() * 6).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`; }
    // capital, shaft with flutes, base
    b += `<rect x="${px - 110}" y="${top}" width="220" height="14" fill="url(#b5s)"/><rect x="${px - 118}" y="${top - 6}" width="236" height="8" fill="#6a5840"/>`;
    b += `<rect x="${px - 84}" y="${top + 14}" width="168" height="${H - top - 40}" fill="url(#b5s)"/>`;
    for (let i = 1; i < 8; i++) b += `<line x1="${px - 84 + i * 21}" y1="${top + 18}" x2="${px - 84 + i * 21}" y2="${H - 30}" stroke="#000" stroke-width="1.5" opacity=".35"/>`;
    b += `<rect x="${px - 60}" y="${top + 34}" width="120" height="30" fill="#1a1209" stroke="${d.acc}" stroke-width=".8"/>` + cap(px, top + 54, d.concept.toUpperCase() + ' · ' + d.no, 'middle', d.acc, 10, 4, 'Bodoni Moda, serif', 600);
    b += placeBook(book, px, top - 72, 0.5);
    b += bookCaps(d, 'THE SCRIBE’S BOOK · ON DISPLAY');
    return svg(`<defs>${defs}${pd}</defs>${b}${grain(0.14)}`, d.word);
  }
  // B6 · relic vault: the Library's glass case from the open-book view, with the book floating inside
  function bookF(d){
    const { defs, book } = bookCore(d, { ry: 24, rx: -12 });
    const gx = 190, gy = 30, gw = 220, gh = 250, ph = 70, lt = '255,225,150';
    const vd = `<radialGradient id="b6l" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="rgb(${lt})" stop-opacity=".35"/><stop offset=".65" stop-color="rgb(${lt})" stop-opacity="0"/></radialGradient>
      <linearGradient id="b6g" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".38" stop-color="#fff" stop-opacity=".08"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset=".66" stop-color="#fff" stop-opacity=".05"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="b6p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d0c"/><stop offset="1" stop-color="#110b05"/></linearGradient>
      <radialGradient id="b6s"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <clipPath id="b6c"><rect x="${gx}" y="${gy}" width="${gw}" height="${gh}"/></clipPath>`;
    let b = `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="#fff" opacity=".03"/><g clip-path="url(#b6c)"><rect x="${gx - 20}" y="${gy}" width="${gw + 40}" height="${gh}" fill="url(#b6l)"/>`;
    b += `<ellipse cx="300" cy="${gy + gh - 18}" rx="58" ry="8" fill="url(#b6s)">${anim(`<animate attributeName="rx" values="46;58;46" dur="4.2s" repeatCount="indefinite"/>`)}</ellipse>`;
    b += `<g>${anim(`<animateTransform attributeName="transform" type="translate" values="0 -4;0 6;0 -4" dur="4.2s" repeatCount="indefinite"/>`)}${placeBook(book, 300, gy + gh / 2 - 6, 0.62)}</g>`;
    b += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="url(#b6g)"/></g>`;
    b += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="none" stroke="${BONE}" stroke-opacity=".25"/>`;
    b += `<circle cx="${gx + gw - 14}" cy="${gy + 14}" r="6" fill="${d.acc}"/><circle cx="${gx + gw - 14}" cy="${gy + 14}" r="10" fill="${d.acc}" opacity=".25"/>`;
    // plinth
    b += `<rect x="${gx}" y="${gy + gh}" width="${gw}" height="${ph}" fill="url(#b6p)"/><rect x="${gx}" y="${gy + gh}" width="${gw}" height="2" fill="${AMB}"/>`;
    b += `<rect x="${gx + 10}" y="${gy + gh - 8}" width="22" height="13" fill="${DUST}"/>` + cap(gx + 21, gy + gh + 2, d.no.slice(-2), 'middle', PANEL, 9, 1);
    b += `<text x="300" y="${gy + gh + 34}" text-anchor="middle" font-family="VT323, monospace" font-size="24" letter-spacing="2" fill="${AMB}">${esc(d.concept.toUpperCase())}</text>` + cap(300, gy + gh + 54, 'BINDING · ' + d.name.toUpperCase(), 'middle', DUST, 8, 2);
    b += cap(14, 22, 'RELIC VAULT', 'start', AMB) + cap(W - 14, 22, d.glyph, 'end', BONE, 16, 0, 'Noto Serif JP', 900);
    return svg(`<defs>${defs}${vd}</defs><rect width="${W}" height="${H}" fill="#070503"/>${b}`, d.word);
  }
