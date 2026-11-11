/* Epitaph — built-in world geography, shared by the Atlas and the Dossier.
 * Loaded as a plain script by both pages, so the Dossier never depends on
 * the Atlas having been opened first.
 *
 * Eras are merged into one map (the era buttons are hidden): cities exist
 * in both eras and appear once; the Era 1 special sites are folded into
 * ordinary places with a `kind`. Every place keeps its `eras` so era views
 * can return later.
 *
 * Places: { id, name, countryId, continentId, kind, lat, lng, eras, cityId?,
 *           group?, status?, fictional?, builtIn: true }
 * Location references from either shape resolve:
 *   new { countryId, placeId }   old { eraId, continentId, countryId, cityId, specialSiteId }
 * User-added countries and places (the Library) are merged in through
 * EpitaphWorld.setExtras(fn), which returns { countries, places }.
 */
(function (global) {
  'use strict';

const SPECIAL_SITE_TYPES = [
  { id: 'VOIDED', label: 'Voided' },
  { id: 'STORYBORN', label: 'Storyborn' },
  { id: 'ANGEL', label: 'Angel' },
  { id: 'DEMON', label: 'Demon' },
  { id: 'ANTHOLONIUS', label: 'Antholonius' },
  { id: 'OTHER', label: 'Other' }
];

const WORLD_DB_ERAS = [
  { id: 'ERA_0', name: 'Era 0', description: 'Earth at the height of advanced human civilization.' },
  { id: 'ERA_1', name: 'Era 1', description: 'Earth after the divine destruction and transformation into Epitaph.' }
];

const ERA_0_CONTINENTS = [
  { id: 'north-america', name: 'North America' },
  { id: 'south-america', name: 'South America' },
  { id: 'europe', name: 'Europe' },
  { id: 'africa', name: 'Africa' },
  { id: 'asia', name: 'Asia' },
  { id: 'oceania', name: 'Australia / Oceania' },
  { id: 'antarctica', name: 'Antarctica' }
];

const ERA_0_COUNTRIES = [
  { id: 'united-states', name: 'United States', continentId: 'north-america' },
  { id: 'canada', name: 'Canada', continentId: 'north-america' },
  { id: 'mexico', name: 'Mexico', continentId: 'north-america' },

  { id: 'brazil', name: 'Brazil', continentId: 'south-america' },
  { id: 'argentina', name: 'Argentina', continentId: 'south-america' },
  { id: 'peru', name: 'Peru', continentId: 'south-america' },

  { id: 'united-kingdom', name: 'United Kingdom', continentId: 'europe' },
  { id: 'france', name: 'France', continentId: 'europe' },
  { id: 'germany', name: 'Germany', continentId: 'europe' },

  { id: 'egypt', name: 'Egypt', continentId: 'africa' },
  { id: 'nigeria', name: 'Nigeria', continentId: 'africa' },
  { id: 'south-africa', name: 'South Africa', continentId: 'africa' },
  { id: 'kenya', name: 'Kenya', continentId: 'africa' },

  { id: 'japan', name: 'Japan', continentId: 'asia' },
  { id: 'china', name: 'China', continentId: 'asia' },
  { id: 'india', name: 'India', continentId: 'asia' },
  { id: 'south-korea', name: 'South Korea', continentId: 'asia' },

  { id: 'australia', name: 'Australia', continentId: 'oceania' },
  { id: 'new-zealand', name: 'New Zealand', continentId: 'oceania' },

  // Antarctica has no real countries — represented as a single nominal
  // territory so the dependent dropdowns don't dead-end on this continent.
  { id: 'antarctic-territories', name: 'Antarctic Research Territories', continentId: 'antarctica' }
];

const ERA_0_CITIES = [
  { id: 'new-york', name: 'New York', countryId: 'united-states', lat: 40.71, lng: -74.01 },
  { id: 'washington', name: 'Washington', countryId: 'united-states', lat: 38.90, lng: -77.04 },
  { id: 'los-angeles', name: 'Los Angeles', countryId: 'united-states', lat: 34.05, lng: -118.24 },
  { id: 'chicago', name: 'Chicago', countryId: 'united-states', lat: 41.88, lng: -87.63 },
  { id: 'miami', name: 'Miami', countryId: 'united-states', lat: 25.76, lng: -80.19 },
  { id: 'san-francisco', name: 'San Francisco', countryId: 'united-states', lat: 37.77, lng: -122.42 },
  { id: 'aurelia', name: 'Aurelia', countryId: 'united-states', lat: 39.5, lng: -98.0, fictional: true },
  { id: 'vanth', name: 'Vanth', countryId: 'united-states', lat: 36.0, lng: -95.0, fictional: true },
  { id: 'helios-7', name: 'Helios-7', countryId: 'united-states', lat: 34.0, lng: -117.0, fictional: true },

  { id: 'toronto', name: 'Toronto', countryId: 'canada', lat: 43.65, lng: -79.38 },
  { id: 'vancouver', name: 'Vancouver', countryId: 'canada', lat: 49.28, lng: -123.12 },
  { id: 'montreal', name: 'Montreal', countryId: 'canada', lat: 45.50, lng: -73.57 },

  { id: 'mexico-city', name: 'Mexico City', countryId: 'mexico', lat: 19.43, lng: -99.13 },
  { id: 'guadalajara', name: 'Guadalajara', countryId: 'mexico', lat: 20.67, lng: -103.35 },

  { id: 'sao-paulo', name: 'São Paulo', countryId: 'brazil', lat: -23.55, lng: -46.63 },
  { id: 'rio-de-janeiro', name: 'Rio de Janeiro', countryId: 'brazil', lat: -22.91, lng: -43.17 },
  { id: 'solstice', name: 'Solstice', countryId: 'brazil', lat: -15.0, lng: -47.0, fictional: true },
  { id: 'verdant-reach', name: 'Verdant Reach', countryId: 'brazil', lat: -10.0, lng: -55.0, fictional: true },

  { id: 'buenos-aires', name: 'Buenos Aires', countryId: 'argentina', lat: -34.60, lng: -58.38 },
  { id: 'lima', name: 'Lima', countryId: 'peru', lat: -12.05, lng: -77.04 },

  { id: 'london', name: 'London', countryId: 'united-kingdom', lat: 51.51, lng: -0.13 },
  { id: 'manchester', name: 'Manchester', countryId: 'united-kingdom', lat: 53.48, lng: -2.24 },
  { id: 'lumendock', name: 'Lumendock', countryId: 'united-kingdom', lat: 55.0, lng: -3.0, fictional: true },

  { id: 'paris', name: 'Paris', countryId: 'france', lat: 48.86, lng: 2.35 },
  { id: 'lyon', name: 'Lyon', countryId: 'france', lat: 45.76, lng: 4.84 },

  { id: 'berlin', name: 'Berlin', countryId: 'germany', lat: 52.52, lng: 13.40 },
  { id: 'munich', name: 'Munich', countryId: 'germany', lat: 48.14, lng: 11.58 },
  { id: 'nexus', name: 'Nexus', countryId: 'germany', lat: 50.0, lng: 10.0, fictional: true },
  { id: 'ferrum', name: 'Ferrum', countryId: 'germany', lat: 51.0, lng: 9.0, fictional: true },

  { id: 'cairo', name: 'Cairo', countryId: 'egypt', lat: 30.04, lng: 31.24 },
  { id: 'lagos', name: 'Lagos', countryId: 'nigeria', lat: 6.52, lng: 3.38 },

  { id: 'johannesburg', name: 'Johannesburg', countryId: 'south-africa', lat: -26.20, lng: 28.05 },
  { id: 'cape-town', name: 'Cape Town', countryId: 'south-africa', lat: -33.92, lng: 18.42 },
  { id: 'meridian-hold', name: 'Meridian Hold', countryId: 'south-africa', lat: -29.0, lng: 25.0, fictional: true },
  { id: 'sunspire', name: 'Sunspire', countryId: 'south-africa', lat: -24.0, lng: 22.0, fictional: true },

  { id: 'nairobi', name: 'Nairobi', countryId: 'kenya', lat: -1.29, lng: 36.82 },

  { id: 'tokyo', name: 'Tokyo', countryId: 'japan', lat: 35.68, lng: 139.65 },
  { id: 'osaka', name: 'Osaka', countryId: 'japan', lat: 34.69, lng: 135.50 },
  { id: 'helix-prime', name: 'Helix Prime', countryId: 'japan', lat: 36.0, lng: 138.0, fictional: true },
  { id: 'orbital-down', name: 'Orbital Down', countryId: 'japan', lat: 35.0, lng: 136.0, fictional: true },

  { id: 'beijing', name: 'Beijing', countryId: 'china', lat: 39.90, lng: 116.41 },
  { id: 'shanghai', name: 'Shanghai', countryId: 'china', lat: 31.23, lng: 121.47 },
  { id: 'tideworks', name: 'Tideworks', countryId: 'china', lat: 30.0, lng: 123.0, fictional: true },

  { id: 'mumbai', name: 'Mumbai', countryId: 'india', lat: 19.08, lng: 72.88 },
  { id: 'new-delhi', name: 'New Delhi', countryId: 'india', lat: 28.61, lng: 77.21 },

  { id: 'seoul', name: 'Seoul', countryId: 'south-korea', lat: 37.57, lng: 126.98 },
  { id: 'redline', name: 'Redline', countryId: 'south-korea', lat: 36.5, lng: 127.5, fictional: true },

  { id: 'sydney', name: 'Sydney', countryId: 'australia', lat: -33.87, lng: 151.21 },
  { id: 'melbourne', name: 'Melbourne', countryId: 'australia', lat: -37.81, lng: 144.96 },
  { id: 'farsight', name: 'Farsight', countryId: 'australia', lat: -25.0, lng: 133.0, fictional: true },

  { id: 'auckland', name: 'Auckland', countryId: 'new-zealand', lat: -36.85, lng: 174.76 },

  { id: 'mcmurdo-station', name: 'McMurdo Station', countryId: 'antarctic-territories', lat: -77.85, lng: 166.67 }
];

const ERA_1_SPECIAL_SITES = [
  { id: 'temple-voided-001', type: 'VOIDED', name: 'Temple of the Voided',
    continentId: 'north-america', countryId: 'united-states', cityId: 'aurelia', lat: 39.5, lng: -98.0, status: 'UNKNOWN' },
  { id: 'voided-settlement-001', type: 'VOIDED', name: 'Voided Settlement — The Hollow Reach',
    continentId: 'europe', countryId: 'germany', cityId: null, lat: 51.5, lng: 9.5, status: 'UNKNOWN' },
  { id: 'storyborn-church-001', type: 'STORYBORN', name: 'Church of the Storyborn',
    continentId: 'asia', countryId: 'japan', cityId: 'tokyo', lat: 35.68, lng: 139.65, status: 'UNKNOWN' },
  { id: 'storyborn-settlement-001', type: 'STORYBORN', name: 'Storyborn Settlement — Verdant Reach',
    continentId: 'south-america', countryId: 'brazil', cityId: 'verdant-reach', lat: -10.0, lng: -55.0, status: 'UNKNOWN' },
  { id: 'angel-settlement-001', type: 'ANGEL', name: 'Angel Settlement — Lumendock',
    continentId: 'europe', countryId: 'united-kingdom', cityId: 'lumendock', lat: 55.0, lng: -3.0, status: 'UNKNOWN' },
  { id: 'demon-settlement-001', type: 'DEMON', name: 'Demon Settlement — Sunspire',
    continentId: 'africa', countryId: 'south-africa', cityId: 'sunspire', lat: -24.0, lng: 22.0, status: 'UNKNOWN' },
  { id: 'antholonius-temple-001', type: 'ANTHOLONIUS', name: 'Temple of Antholonius — Fragment I',
    continentId: 'north-america', countryId: 'united-states', cityId: 'aurelia', lat: 39.5, lng: -98.0, status: 'UNKNOWN' },
  { id: 'antholonius-temple-002', type: 'ANTHOLONIUS', name: 'Temple of Antholonius — Fragment II',
    continentId: 'europe', countryId: 'germany', cityId: null, lat: 49.0, lng: 11.0, status: 'UNKNOWN' },
  { id: 'antholonius-temple-003', type: 'ANTHOLONIUS', name: 'Temple of Antholonius — Fragment III',
    continentId: 'asia', countryId: 'china', cityId: null, lat: 34.0, lng: 108.0, status: 'UNKNOWN' }
];

  const KINDS = ['city', 'ruin', 'temple', 'settlement', 'other'];
  const KIND_LABEL = { city: 'City', ruin: 'Ruin', temple: 'Temple', settlement: 'Settlement', other: 'Other' };
  const siteKind = s => /temple|church/i.test(s.name) ? 'temple' : /settlement/i.test(s.name) ? 'settlement' : /ruin/i.test(s.name) ? 'ruin' : 'other';

  const BUILTIN_CONTINENTS = ERA_0_CONTINENTS.map(c => ({ ...c }));
  const continentOf = countryId => (ERA_0_COUNTRIES.find(c => c.id === countryId) || {}).continentId || null;
  const BUILTIN_COUNTRIES = ERA_0_COUNTRIES.map(c => ({ ...c, builtIn: true }));
  const BUILTIN_PLACES = ERA_0_CITIES.map(c => ({
    ...c, continentId: continentOf(c.countryId), kind: 'city', eras: ['ERA_0', 'ERA_1'], builtIn: true
  })).concat(ERA_1_SPECIAL_SITES.map(s => ({
    id: s.id, name: s.name, countryId: s.countryId, continentId: s.continentId || continentOf(s.countryId),
    kind: siteKind(s), lat: s.lat, lng: s.lng, eras: ['ERA_1'], cityId: s.cityId || null,
    group: s.type, status: s.status, builtIn: true
  })));

  let extrasFn = () => ({ countries: [], places: [] });
  const num = v => typeof v === 'number' && isFinite(v);
  function extras() {
    let x;
    try { x = extrasFn() || {}; } catch (e) { x = {}; }
    return {
      countries: (x.countries || []).map(c => ({ ...c, continentId: c.continentId || null, lng: num(c.lng) ? c.lng : c.lon, builtIn: false })),
      places: (x.places || []).map(p => ({ ...p, lng: num(p.lng) ? p.lng : p.lon, continentId: p.continentId || continentOf(p.countryId), builtIn: false }))
    };
  }
  const continents = () => BUILTIN_CONTINENTS;
  const countries = () => BUILTIN_COUNTRIES.concat(extras().countries);
  const places = () => BUILTIN_PLACES.concat(extras().places);
  const continent = id => BUILTIN_CONTINENTS.find(c => c.id === id) || null;
  const country = id => (id && countries().find(c => c.id === id)) || null;
  const place = id => (id && places().find(p => p.id === id)) || null;
  const placesIn = countryId => places().filter(p => p.countryId === countryId);
  const childPlaces = placeId => places().filter(p => p.cityId === placeId);
  // Centre of a country: its own point (user-added), else the mean of its places.
  function countryCentroid(id) {
    const c = country(id);
    if (c && num(c.lat) && num(c.lng)) return { lat: c.lat, lng: c.lng };
    const pts = placesIn(id).filter(p => num(p.lat) && num(p.lng));
    if (!pts.length) return null;
    return { lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length };
  }
  // Any location reference (old or new shape) → a resolved place, or null.
  function resolve(ref) {
    if (!ref || typeof ref !== 'object') return null;
    const p = place(ref.placeId || ref.specialSiteId || ref.cityId);
    const co = country(ref.countryId || (p && p.countryId));
    if (!p && !co) return null;
    const parent = p && p.cityId ? place(p.cityId) : null;
    const cont = continent((p && p.continentId) || (co && co.continentId) || ref.continentId);
    const pt = p && num(p.lat) && num(p.lng) ? { lat: p.lat, lng: p.lng } : (co ? countryCentroid(co.id) : null);
    const chain = [p, parent, co, cont].filter(Boolean);
    return {
      place: p, parent, country: co, continent: cont,
      kind: p ? 'place' : 'country',
      key: p ? 'place:' + p.id : 'country:' + co.id,
      lat: pt ? pt.lat : null, lng: pt ? pt.lng : null,
      name: (p || co).name,
      label: chain.map(x => x.name).join(', '),
      path: chain.slice().reverse().map(x => x.name).join(' / ')
    };
  }
  const sameRef = (a, b) => { const x = resolve(a), y = resolve(b); return !!x && !!y && x.key === y.key; };
  // The stored shape for a picked place (or a whole country when placeId is empty).
  function makeRef(countryId, placeId) {
    if (!countryId && !placeId) return null;
    const p = place(placeId);
    return { countryId: countryId || (p && p.countryId) || null, placeId: p ? p.id : null };
  }

  global.EpitaphWorld = {
    ERAS: WORLD_DB_ERAS, KINDS, KIND_LABEL, SITE_GROUPS: SPECIAL_SITE_TYPES,
    continents, countries, places, continent, country, place, placesIn, childPlaces,
    countryCentroid, resolve, sameRef, makeRef,
    setExtras(fn) { extrasFn = typeof fn === 'function' ? fn : extrasFn; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
