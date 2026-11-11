/* Epitaph — archetype list. Data only: rename, add or remove entries here and
 * nothing else needs to change. Mortal groups are numbered 1–70 in order;
 * the divine list (71–100) is for gods and primordials, whose archetype is
 * locked across chapters. */
(function (global) {
  'use strict';
  const MORTAL = [
    { group: 'Light', items: ['The Hero', 'The Guardian', 'The Martyr', 'The Healer', 'The Protector', 'The Redeemer', 'The Innocent', 'The Mentor', 'The Last Hope', 'The Champion'] },
    { group: 'Tragic', items: ['The Tragic Hero', 'The Fallen Hero', 'The Broken Avenger', 'The Burdened One', 'The Doomed Prophet', 'The Unwilling Chosen', 'The Scapegoat', 'The Survivor', 'The Grieving', 'The Shattered Mind', 'The Hollow Man', 'The Cursed Heir'] },
    { group: 'Villain', items: ['The Crazed Villain', 'The Wicked Villain', 'The Conqueror', 'The Tyrant', 'The Usurper', 'The Crusader', 'The Butcher', 'The Corruptor', 'The Betrayer', 'The Warlord', 'The Executioner', 'The Mad Prophet', 'The Ruined King', 'The Dark Messiah'] },
    { group: 'Minds', items: ['The Manipulator', 'The Silver Tongue', 'The Puppeteer', 'The Schemer', 'The Cold Charmer', 'The Interrogator', 'The Spymaster', 'The Gentle Monster', 'The Trickster', 'The Strategist', 'The Collector', 'The Observer'] },
    { group: 'Rigid', items: ['The Inquisitor', 'The Warden', 'The Iron Shepherd', 'The Lawgiver', 'The Judge', 'The Zealot', 'The Purist', 'The Disciplinarian'] },
    { group: 'Warm', items: ['The Open Hand', 'The Hearth-Keeper', 'The Peacemaker', 'The Confidant', 'The Forgiver', 'The Sanctuary', 'The Caretaker', 'The Gentle Heart'] },
    { group: 'Drifters', items: ['The Wanderer', 'The Outcast', 'The Rebel', 'The Seeker', 'The Heretic', 'The Penitent'] }
  ];
  const DIVINE = [
    { group: 'Gods and primordials', items: ['The Keeper of Endings', 'The Silence Beneath Everything', 'The Dreamer Beneath the World', 'The Voice of Unmaking', 'The Breath Before Beginning', 'The Mirror of What Is', 'The Ledger of Debts', 'The Unblinking Eye', 'The Gardener of Time', 'The Hunger That Waits', 'The Flame That Remembers', 'The Sleeper at the Root', 'The Author of the First Page', 'The Shepherd of Souls', 'The Law That Binds', 'The Mercy That Breaks Chains', 'The Wound in the World', 'The Whisper of Desire', 'The Fear That Wears a Face', 'The Oath That Cannot Break', 'The Last Light', 'The First Dark', 'The Scale That Never Tips', 'The Name Before Names', 'The Blade That Divides', 'The Door Between Worlds', 'The Echo That Answers', 'The Tide of Change', 'The Silence After the Last Word', 'The Crown of the Empty Throne'] }
  ];
  const flat = (groups) => groups.reduce((a, g) => a.concat(g.items), []);
  // Case-insensitive exact match against both lists; returns the canonical name or ''.
  function match(text) {
    const k = String(text || '').trim().toLowerCase();
    if (!k) return '';
    return flat(MORTAL).concat(flat(DIVINE)).find(n => n.toLowerCase() === k) || '';
  }
  global.EpitaphArchetypes = { MORTAL, DIVINE, all: () => flat(MORTAL).concat(flat(DIVINE)), mortal: () => flat(MORTAL), divine: () => flat(DIVINE), match };
})(typeof window !== 'undefined' ? window : globalThis);
