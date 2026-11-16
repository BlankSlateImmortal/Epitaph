/* Epitaph — archetype list. Data only: rename, add or remove entries here and
 * nothing else needs to change. Archetypes belong ONLY to Storyborn (the script
 * The Binding cut each bound god down to). People have a true name instead, and
 * Primordials and Unbound gods are swayed only by their concept (decided 2026-11-16).
 * The old 70 mortal archetypes were removed; saved values stay on the snapshot as
 * legacyArchetype. */
(function (global) {
  'use strict';
  const MORTAL = [];
  const DIVINE = [
    { group: 'Storyborn archetypes', items: ['The Keeper of Endings', 'The Silence Beneath Everything', 'The Dreamer Beneath the World', 'The Voice of Unmaking', 'The Breath Before Beginning', 'The Mirror of What Is', 'The Ledger of Debts', 'The Unblinking Eye', 'The Gardener of Time', 'The Hunger That Waits', 'The Flame That Remembers', 'The Sleeper at the Root', 'The Author of the First Page', 'The Shepherd of Souls', 'The Law That Binds', 'The Mercy That Breaks Chains', 'The Wound in the World', 'The Whisper of Desire', 'The Fear That Wears a Face', 'The Oath That Cannot Break', 'The Last Light', 'The First Dark', 'The Scale That Never Tips', 'The Name Before Names', 'The Blade That Divides', 'The Door Between Worlds', 'The Echo That Answers', 'The Tide of Change', 'The Silence After the Last Word', 'The Crown of the Empty Throne'] }
  ];
  const flat = (groups) => groups.reduce((a, g) => a.concat(g.items), []);
  // Case-insensitive exact match against both lists; returns the canonical name or ''.
  function match(text) {
    const k = String(text || '').trim().toLowerCase();
    if (!k) return '';
    return flat(MORTAL).concat(flat(DIVINE)).find(n => n.toLowerCase() === k) || '';
  }
  const STORYBORN = DIVINE;
  global.EpitaphArchetypes = { MORTAL, DIVINE, STORYBORN, all: () => flat(STORYBORN), mortal: () => [], divine: () => flat(DIVINE), storyborn: () => flat(STORYBORN), match };
})(typeof window !== 'undefined' ? window : globalThis);
