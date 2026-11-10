/* Epitaph — Muses: reference characters that guide character creation.
 * Stored in localStorage under 'epitaph-muses' (same origin as the Dossier,
 * so a Dossier character can link several muses by id: char.museIds).
 * The defaults below are short original summaries written for Epitaph.
 * Quotes you add yourself stay in your browser only.
 */
(function (global) {
  'use strict';
  const KEY = 'epitaph-muses';

  const FIELDS = [
    { key: 'role', label: 'Archetype' },
    { key: 'drive', label: 'What drives them' },
    { key: 'method', label: 'How they get it' },
    { key: 'flaw', label: 'The crack' },
    { key: 'voice', label: 'Voice' },
    { key: 'motifs', label: 'Visual motifs' },
    { key: 'borrow', label: 'Take for Epitaph' }
  ];

  const DEFAULTS = [
    {
      id: 'muse_johan', name: 'Johan', source: 'Monster',
      role: 'The gentle monster',
      drive: 'To erase everything that could prove he existed, including his own name.',
      method: 'Charm and patience. He never needs to raise his voice; other people do the killing for him.',
      flaw: 'He needs one witness who truly sees him.',
      voice: 'Soft, polite, curious. Asks questions instead of giving orders.',
      motifs: 'Calm smile, rain, unmarked graves, a face people forget they saw.',
      borrow: 'A villain whose power is persuasion. Pairs with the Nothing / Erasure concept (Sils).',
      epitaph: 'Here lies a name he gave away, so nothing could ever be traced back to him.',
      figure: 'capsule', style: 'halftone', accent: '#d4452b', quotes: []
    },
    {
      id: 'muse_fangyuan', name: 'Fang Yuan', source: 'Reverend Insanity',
      role: 'The unrepentant schemer',
      drive: 'Eternal life, whatever it costs.',
      method: 'Plans that span lifetimes. Treats morals, allies and enemies alike as tools.',
      flaw: 'Utterly alone, and he chose it.',
      voice: 'Cold and dry. Finds the righteous funny.',
      motifs: 'Rebirth, a second chance used without mercy, a dark robe, an unreadable face.',
      borrow: 'Someone who refuses the fate written for them. A natural foil to Antholonious (Fate).',
      epitaph: 'He came back once. He does not plan to stay dead the next time either.',
      figure: 'hood', style: 'ink', accent: '#6fb3a3', quotes: []
    },
    {
      id: 'muse_sunny', name: 'Sunny', source: 'Shadow Slave',
      role: 'The cursed survivor',
      drive: 'Stay alive. Stay free.',
      method: 'Shadows, paranoia, sarcasm and reading people faster than they read him.',
      flaw: 'His curse: he cannot tell a lie.',
      voice: 'Dry, self-mocking inner monologue. Says less than he thinks.',
      motifs: 'Shadows that move on their own, slum-born, a quiet figure at the edge of the frame.',
      borrow: 'A curse that is also an identity. Model for Cursed mythos that shapes a whole personality.',
      epitaph: "He couldn't tell a single lie, so he learned to survive on the truth.",
      figure: 'hood', style: 'pixel', accent: '#ffb238', quotes: []
    },
    {
      id: 'muse_mordret', name: 'Mordret', source: 'Shadow Slave',
      role: 'The courteous predator',
      drive: 'Freedom, and revenge on the family that broke him.',
      method: 'Reflections. Every mirror is a door, and every vessel can be worn.',
      flaw: 'Hollowness. There is little left of him except the hunger.',
      voice: 'Polite, cheerful and unsettling.',
      motifs: 'Mirrors, broken glass, a smile that never reaches the eyes.',
      borrow: 'A domain built on one image (mirrors). Fits the Voided and the Nothing concept.',
      epitaph: 'Polite to the last. He lived in every mirror and owned none of them.',
      figure: 'wisp', style: 'neon', accent: '#9b7bff', quotes: []
    },
    {
      id: 'muse_madprince', name: 'The Mad Prince', source: 'Shadow Slave',
      role: '', drive: '', method: '', flaw: '', voice: '',
      motifs: 'Crowned, laughing through ruin.',
      borrow: '',
      epitaph: '',
      figure: 'spike', style: 'dither', accent: '#d4452b', quotes: []
    }
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list.map(normalise);
      }
    } catch (e) {}
    return DEFAULTS.map(m => normalise(JSON.parse(JSON.stringify(m))));
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function normalise(m) {
    const out = Object.assign({ id: 'muse_' + Math.random().toString(36).slice(2, 9), name: '', source: '', epitaph: '', figure: '', style: '', accent: '', quotes: [] }, m || {});
    FIELDS.forEach(f => { if (typeof out[f.key] !== 'string') out[f.key] = ''; });
    if (!Array.isArray(out.quotes)) out.quotes = [];
    return out;
  }
  function byId(list, id) { return list.find(m => m.id === id) || null; }
  function portraitOpts(m, extra) {
    return Object.assign({ name: 'muse:' + m.name, archetype: m.figure || undefined, style: m.style || undefined, accent: m.accent || undefined }, extra || {});
  }

  global.EpitaphMuses = { KEY, FIELDS, DEFAULTS, load, save, normalise, byId, portraitOpts };
})(typeof window !== 'undefined' ? window : globalThis);
