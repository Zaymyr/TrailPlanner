#!/usr/bin/env node
/**
 * Test-fixture helper (prototype): builds a pseudo-recorded GPX from an OpenStreetMap route relation
 * so the terrain pipeline can be exercised on a REAL route geometry when no real race GPX is available.
 * The geometry comes from OSM ways, so path matching is optimistic (circular); the tag coverage and class
 * split it reveals are still representative of what OSM knows about the route. GPS noise is added
 * (gaussian, ~4 m) to avoid perfect overlap.
 *
 * Usage: node scripts/course-terrain/osm-route-to-gpx.mjs <relationId> <out.gpx> [--max-km 80] [--skip-km 0]
 * Data: (c) OpenStreetMap contributors, ODbL.
 */
import { writeFileSync } from 'node:fs';

const USER_AGENT = 'PaceYourself-terrain-prototype/0.1 (+https://pace-yourself.com)';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rad = (d) => (d * Math.PI) / 180;
const hav = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
};

async function overpass(q) {
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const ep of ENDPOINTS) {
      try {
        const res = await fetch(ep, { method: 'POST', headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(120_000) });
        if (res.ok) return await res.json();
      } catch { /* try next */ }
    }
    await sleep(15_000 * 2 ** attempt);
  }
  throw new Error('Overpass unavailable');
}

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? +args[i + 1] : d; };
const [relId, out] = args;
if (!relId || !out) { console.error('Usage: osm-route-to-gpx.mjs <relationId> <out.gpx> [--max-km N] [--skip-km N]'); process.exit(1); }

const json = await overpass(`[out:json][timeout:90];rel(${relId});out geom;`);
const rel = json.elements[0];
const line = [];
for (const m of rel.members.filter((x) => x.type === 'way' && x.geometry && x.role !== 'guidepost')) {
  let g = m.geometry.map((n) => ({ lat: n.lat, lon: n.lon }));
  const end = line[line.length - 1];
  if (end && hav(end, g[0]) > hav(end, g[g.length - 1])) g = g.reverse();
  line.push(...g);
}
// densify to ~15 m, add noise, cut to [skip, skip+max] km
const skip = opt('--skip-km', 0) * 1000, max = opt('--max-km', 1e9) * 1000;
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
let acc = 0, pts = [];
for (let i = 1; i < line.length; i++) {
  const a = line[i - 1], b = line[i], d = hav(a, b), n = Math.max(1, Math.round(d / 15));
  for (let k = 0; k < n; k++) {
    if (acc >= skip && acc <= skip + max) {
      const lat = a.lat + ((b.lat - a.lat) * k) / n + (gauss() * 4) / 111320;
      const lon = a.lon + ((b.lon - a.lon) * k) / n + (gauss() * 4) / (111320 * Math.cos(rad(a.lat)));
      pts.push({ lat, lon });
    }
    acc += d / n;
  }
}
const name = rel.tags?.name ?? `relation ${relId}`;
const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="osm-route-to-gpx (prototype)" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${name.replace(/&/g, '&amp;')} (OSM geometry, noised; (c) OpenStreetMap contributors)</name></metadata>\n<trk><trkseg>\n${pts.map((p) => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"></trkpt>`).join('\n')}\n</trkseg></trk>\n</gpx>\n`;
writeFileSync(out, gpx);
console.log(`${name}: ${pts.length} points written to ${out} (${(Math.min(acc - skip, max) / 1000).toFixed(1)} km)`);
