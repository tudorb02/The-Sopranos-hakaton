#!/usr/bin/env node
// Gives the demo farms (data/demo/farms/*.json) real field outlines: for every parcel it picks an OpenStreetMap
// landuse polygon near the farm whose geodesic area is within ±20% of the parcel's areaHa, the picked fields not
// overlapping and close together. Only `geometry` changes; areaHa and every other property stay, so the engine,
// the scenarios and the tests are unaffected. Where no field fits, the nearest outline is scaled to areaHa and the
// parcel is flagged in sources.json. Run once, with internet (Overpass API); the app never calls it.
// Usage: node scripts/demo-parcels/fetch-osm-parcels.mjs [--check]
// Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const farmsDir = join(root, 'data/demo/farms');
const sourcesFile = join(here, 'sources.json');

const RADIUS_M = 15000;
const AREA_TOLERANCE = 0.2;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const LANDUSES = ['farmland', 'orchard', 'farmyard', 'meadow', 'vineyard', 'greenhouse_horticulture'];
const EARTH_RADIUS_M = 6378137;

// Which OSM landuse fits a parcel, from its crop (the APIA crop name of the demo data).
function landuseFor(crop = '') {
  const c = crop.toLowerCase();
  if (c.includes('apple') || c.includes('orchard')) return ['orchard'];
  if (c.includes('grassland') || c.includes('fodder')) return ['meadow', 'farmland'];
  if (c.includes('farmyard') || c.includes('storage')) return ['farmyard'];
  return ['farmland'];
}

// Geodesic area of a lon/lat ring on the WGS84 sphere, in m² (same method as Turf's area).
function ringArea(ring) {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}
const toRad = (deg) => (deg * Math.PI) / 180;
const areaHa = (ring) => ringArea(ring) / 10000;

function centroid(ring) {
  const pts = ring.slice(0, -1);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

function distanceM([lon1, lat1], [lon2, lat2]) {
  const x = toRad(lon2 - lon1) * Math.cos(toRad((lat1 + lat2) / 2));
  const y = toRad(lat2 - lat1);
  return Math.hypot(x, y) * EARTH_RADIUS_M;
}

function segmentsCross([a, b], [c, d]) {
  const orient = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bbox(ring) {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

// Two outer rings overlap if their edges cross or one holds a vertex of the other. Shared borders do not count.
function overlaps(r1, r2) {
  const [a0, a1, a2, a3] = bbox(r1);
  const [b0, b1, b2, b3] = bbox(r2);
  if (a2 < b0 || b2 < a0 || a3 < b1 || b3 < a1) return false;
  for (let i = 0; i < r1.length - 1; i++) {
    for (let j = 0; j < r2.length - 1; j++) {
      if (segmentsCross([r1[i], r1[i + 1]], [r2[j], r2[j + 1]])) return true;
    }
  }
  return pointInRing(centroid(r1), r2) || pointInRing(centroid(r2), r1);
}

// The parcel at exactly areaHa: the outline scaled around its centroid.
function scaleTo(ring, targetHa) {
  const k = Math.sqrt(targetHa / areaHa(ring));
  const [cx, cy] = centroid(ring);
  return ring.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

const round = (ring) => ring.map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]);

async function overpass([lon, lat]) {
  const filters = LANDUSES.map((l) => `way["landuse"="${l}"](around:${RADIUS_M},${lat},${lon});`).join('');
  const query = `[out:json][timeout:90];(${filters});out geom;`;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'greenstruct-agro-demo/1.0 (hackathon prototype)' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) return (await res.json()).elements;
      console.warn(`  ${url}: HTTP ${res.status}`);
    } catch (error) {
      console.warn(`  ${url}: ${error.message}`);
    }
  }
  throw new Error('Overpass unreachable');
}

function candidatesOf(elements) {
  return elements
    .filter((e) => e.type === 'way' && e.geometry?.length >= 4)
    .map((e) => {
      const ring = e.geometry.map((g) => [g.lon, g.lat]);
      const [first, last] = [ring[0], ring[ring.length - 1]];
      if (first[0] !== last[0] || first[1] !== last[1]) return null;
      return { osmType: 'way', osmId: e.id, landuse: e.tags.landuse, ring, ha: areaHa(ring), center: centroid(ring) };
    })
    .filter(Boolean);
}

// Greedy: the biggest parcel first, each next one the closest fitting field to the fields already picked.
function pick(parcels, candidates, farmCenter) {
  const chosen = [];
  const order = [...parcels].sort((a, b) => b.properties.areaHa - a.properties.areaHa);
  for (const parcel of order) {
    const target = parcel.properties.areaHa;
    const uses = landuseFor(parcel.properties.crop);
    const anchor = chosen.length ? centroid(chosen.flatMap((c) => c.ring).concat([chosen[0].ring[0]])) : farmCenter;
    const free = candidates.filter((c) => uses.includes(c.landuse) && !chosen.some((p) => p.osmId === c.osmId || overlaps(p.ring, c.ring)));
    const fitting = free.filter((c) => Math.abs(c.ha - target) <= target * AREA_TOLERANCE);
    const byDistance = (a, b) => distanceM(a.center, anchor) - distanceM(b.center, anchor);
    let hit = fitting.sort(byDistance)[0];
    let fallback = false;
    if (!hit) {
      // nearest outline of a sensible size (a third to three times the parcel), scaled to areaHa
      hit = free.filter((c) => c.ha >= target / 3 && c.ha <= target * 3).sort(byDistance)[0] ?? free.sort(byDistance)[0];
      fallback = true;
    }
    if (!hit) throw new Error(`no OSM ${uses.join('/')} outline near ${parcel.id}`);
    const ring = fallback ? scaleTo(hit.ring, target) : hit.ring;
    chosen.push({ parcelId: parcel.id, ...hit, ring: round(ring), fallback });
  }
  return chosen;
}

function check() {
  let ok = true;
  for (const file of readdirSync(farmsDir).filter((f) => f.endsWith('.json'))) {
    const farm = JSON.parse(readFileSync(join(farmsDir, file), 'utf8'));
    const rings = farm.parcels.features.map((f) => ({ id: f.id, ring: f.geometry.coordinates[0], target: f.properties.areaHa }));
    for (const r of rings) {
      const ha = areaHa(r.ring);
      const off = Math.abs(ha - r.target) / r.target;
      const flag = off <= AREA_TOLERANCE ? 'ok' : 'AREA';
      if (flag !== 'ok') ok = false;
      console.log(`${file} ${r.id}: ${ha.toFixed(2)} ha vs ${r.target} ha (${(off * 100).toFixed(1)}%) ${flag}`);
    }
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        if (overlaps(rings[i].ring, rings[j].ring)) {
          ok = false;
          console.log(`${file}: ${rings[i].id} overlaps ${rings[j].id}`);
        }
      }
    }
  }
  console.log(ok ? 'all parcels within ±20% and not overlapping' : 'CHECK FAILED');
  process.exitCode = ok ? 0 : 1;
}

async function main() {
  const sources = { license: 'Parcel outlines © OpenStreetMap contributors, ODbL 1.0', generatedAt: new Date().toISOString().slice(0, 10), farms: {} };
  for (const file of readdirSync(farmsDir).filter((f) => f.endsWith('.json')).sort()) {
    const path = join(farmsDir, file);
    const farm = JSON.parse(readFileSync(path, 'utf8'));
    const features = farm.parcels.features;
    const farmCenter = centroid(features.flatMap((f) => f.geometry.coordinates[0]).concat([features[0].geometry.coordinates[0][0]]));
    console.log(`${file} (${farm.company.name}): ${features.length} parcels around ${farmCenter.map((v) => v.toFixed(3)).join(', ')}`);
    const candidates = candidatesOf(await overpass(farmCenter));
    console.log(`  ${candidates.length} OSM outlines`);
    const chosen = pick(features, candidates, farmCenter);
    for (const c of chosen) {
      const feature = features.find((f) => f.id === c.parcelId);
      feature.geometry = { type: 'Polygon', coordinates: [c.ring] };
      console.log(`  ${c.parcelId}: ${c.landuse} way ${c.osmId}, ${c.ha.toFixed(1)} ha for ${feature.properties.areaHa} ha${c.fallback ? ' (scaled)' : ''}`);
    }
    sources.farms[farm.cui] = chosen.map((c) => ({
      parcelId: c.parcelId,
      osm: `https://www.openstreetmap.org/${c.osmType}/${c.osmId}`,
      landuse: c.landuse,
      osmAreaHa: Number(c.ha.toFixed(2)),
      scaledToAreaHa: c.fallback,
    }));
    writeFileSync(path, `${JSON.stringify(farm, null, 2)}\n`);
    // be gentle with the public Overpass instance
    await new Promise((r) => setTimeout(r, 2000));
  }
  writeFileSync(sourcesFile, `${JSON.stringify(sources, null, 2)}\n`);
  check();
}

if (process.argv.includes('--check')) check();
else await main();
