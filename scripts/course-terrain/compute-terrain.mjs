#!/usr/bin/env node
/**
 * Course terrain prototype (lot 2 preparation, NOT wired to production).
 * Derives the terrain type along a GPX from OpenStreetMap (Overpass API).
 *
 * Usage: node scripts/course-terrain/compute-terrain.mjs <file.gpx> [--out result.json]
 *        [--from-cache overpass.json] [--save-cache overpass.json]
 *
 * Data: (c) OpenStreetMap contributors, ODbL. Attribution is mandatory wherever results are shown.
 * Doc: docs/03-business-rules/course-terrain.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const USER_AGENT = 'PaceYourself-terrain-prototype/0.1 (+https://pace-yourself.com)';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const SAMPLE_STEP_M = 25;
const MATCH_MAX_M = 30; // beyond this a sample is "unknown"
const CONTINUITY_BONUS_M = 12; // previous way wins if within (best + bonus)
const MIN_SEGMENT_M = 200;
const SIMPLIFY_TOL_M = 8;

/*
 * CLASSIFICATION TABLE (first matching rule wins). Tags: highway, surface, tracktype, sac_scale,
 * smoothness, trail_visibility.
 *  1 technical : (surface not paved) AND (sac_scale in demanding_mountain_hiking/alpine_hiking/
 *                demanding_alpine_hiking/difficult_alpine_hiking, OR surface in rock/scree/stone/shingle/boulders,
 *                OR trail_visibility in bad/horrible/no, OR smoothness in very_bad/horrible/very_horrible/impassable)
 *  2 road      : surface paved (asphalt, concrete, paving_stones, sett, cobblestone, ...)
 *                OR (no surface AND highway in motorway..residential, service, living_street, unclassified, pedestrian)
 *  3 track     : highway=track with tracktype grade1-3 or none; any other road-type highway with an unpaved surface
 *  4 trail     : highway path/footway/bridleway/steps/cycleway, track grade4-5, sac_scale none/T1/T2
 *  Fallback    : trail
 */
const PAVED = new Set(['asphalt', 'concrete', 'concrete:plates', 'concrete:lanes', 'paved', 'paving_stones', 'sett', 'cobblestone', 'metal', 'wood', 'bricks', 'chipseal']);
const ROCKY = new Set(['rock', 'scree', 'stone', 'shingle', 'boulders', 'rocks']);
const ROAD_HW = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'road']);
const TECH_SAC = new Set(['demanding_mountain_hiking', 'alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking']);

export function classify(tags = {}) {
  const { highway, surface, tracktype, sac_scale: sac, smoothness, trail_visibility: vis } = tags;
  const paved = surface && PAVED.has(surface);
  if (!paved && (TECH_SAC.has(sac) || ROCKY.has(surface) || ['bad', 'horrible', 'no'].includes(vis) ||
      ['very_bad', 'horrible', 'very_horrible', 'impassable'].includes(smoothness))) return 'technical';
  if (paved) return 'road';
  if (!surface && ROAD_HW.has(highway)) return 'road';
  if (highway === 'track') return ['grade4', 'grade5'].includes(tracktype) ? 'trail' : 'track';
  if (ROAD_HW.has(highway)) return 'track'; // road-type highway with an explicit unpaved surface
  return 'trail';
}

// ---------- geometry ----------
const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function project(p, o) { // local equirectangular metres around origin o
  return { x: rad(p.lon - o.lon) * R * Math.cos(rad(o.lat)), y: rad(p.lat - o.lat) * R };
}
function distPointSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function parseGpx(xml) {
  const pts = [];
  const re = /<trkpt\b([^>]*)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const lat = /lat="([^"]+)"/.exec(m[1]), lon = /lon="([^"]+)"/.exec(m[1]);
    if (lat && lon) pts.push({ lat: +lat[1], lon: +lon[1] });
  }
  if (pts.length < 2) throw new Error('GPX has fewer than 2 trackpoints');
  let d = 0;
  pts[0].dist = 0;
  for (let i = 1; i < pts.length; i++) { d += haversine(pts[i - 1], pts[i]); pts[i].dist = d; }
  return pts;
}

export function resample(pts, step = SAMPLE_STEP_M) {
  const total = pts[pts.length - 1].dist, out = [];
  let j = 0;
  for (let s = 0; s <= total; s += step) {
    while (j < pts.length - 2 && pts[j + 1].dist < s) j++;
    const a = pts[j], b = pts[j + 1], seg = b.dist - a.dist, t = seg ? (s - a.dist) / seg : 0;
    out.push({ dist: s, lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
  }
  return out;
}

function simplify(samples, tol) { // Douglas-Peucker on local metres
  const o = samples[0];
  const P = samples.map((s) => ({ ...project(s, o), s }));
  const keep = new Uint8Array(P.length);
  keep[0] = keep[P.length - 1] = 1;
  const stack = [[0, P.length - 1]];
  while (stack.length) {
    const [i, k] = stack.pop();
    let max = 0, idx = -1;
    for (let n = i + 1; n < k; n++) { const d = distPointSeg(P[n], P[i], P[k]); if (d > max) { max = d; idx = n; } }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([i, idx], [idx, k]); }
  }
  return P.filter((_, n) => keep[n]).map((p) => p.s);
}

// ---------- Overpass ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function overpass(query) {
  let lastErr;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(75_000),
        });
        if (res.ok) {
          const json = await res.json();
          // Overpass answers HTTP 200 with an empty list + remark on runtime errors / timeouts: treat as failure.
          if (json.remark && /error|timed out|out of memory/i.test(json.remark)) { lastErr = new Error(endpoint + ' remark: ' + json.remark); await sleep(8_000 * 2 ** attempt); continue; }
          return json;
        }
        lastErr = new Error(`${endpoint} -> HTTP ${res.status}`);
        if (res.status === 429 || res.status === 504 || res.status === 502) { await sleep(8_000 * 2 ** attempt); continue; }
        break; // other errors: try next endpoint
      } catch (e) { lastErr = e; await sleep(4_000 * 2 ** attempt); }
    }
  }
  throw lastErr;
}

/**
 * Fetch strategy: the simplified polyline is cut into sequential chunks whose bbox stays small
 * (<= MAX_SPAN deg), one bbox request per chunk (way[highway](s,w,n,e); out geom tags), then ways
 * are de-duplicated and matched locally. NOTE: the polyline form of (around:R,lat,lon,lat,lon,...) was
 * tried first but returned empty results on the public instance during the prototype runs, hence bbox.
 */
const MAX_SPAN_LAT = 0.08; // ~9 km
const MAX_SPAN_LON = 0.12; // ~9 km at 45N
const BBOX_PAD = 0.0006; // ~65 m
async function fetchWays(samples) {
  const poly = simplify(samples, SIMPLIFY_TOL_M);
  const chunks = [];
  let cur = null;
  for (const p of poly) {
    if (cur) {
      const lat0 = Math.min(cur.s, p.lat), lat1 = Math.max(cur.n, p.lat), lon0 = Math.min(cur.w, p.lon), lon1 = Math.max(cur.e, p.lon);
      if (lat1 - lat0 <= MAX_SPAN_LAT && lon1 - lon0 <= MAX_SPAN_LON) { Object.assign(cur, { s: lat0, n: lat1, w: lon0, e: lon1 }); continue; }
      chunks.push(cur);
    }
    cur = { s: p.lat, n: p.lat, w: p.lon, e: p.lon };
  }
  if (cur) chunks.push(cur);
  const ways = new Map();
  let requests = 0;
  for (const c of chunks) { // sequential, politely spaced
    const bbox = [c.s - BBOX_PAD, c.w - BBOX_PAD, c.n + BBOX_PAD, c.e + BBOX_PAD].map((v) => v.toFixed(5)).join(',');
    const q = `[out:json][timeout:90];way["highway"](${bbox});out geom tags;`;
    if (requests++) await sleep(5_000);
    const json = await overpass(q);
    for (const el of json.elements ?? []) if (el.type === 'way' && el.geometry) ways.set(el.id, el);
  }
  return { ways: [...ways.values()], requests, simplifiedPoints: poly.length };
}

// ---------- map matching ----------
export function matchSamples(samples, ways) {
  const o = samples[0];
  const segs = [];
  for (const w of ways) {
    const g = w.geometry.map((n) => project(n, o));
    for (let i = 0; i < g.length - 1; i++) {
      segs.push({ way: w, a: g[i], b: g[i + 1], minX: Math.min(g[i].x, g[i + 1].x), maxX: Math.max(g[i].x, g[i + 1].x), minY: Math.min(g[i].y, g[i + 1].y), maxY: Math.max(g[i].y, g[i + 1].y) });
    }
  }
  const cell = 200, grid = new Map(); // spatial hash
  segs.forEach((s, idx) => {
    for (let cx = Math.floor((s.minX - MATCH_MAX_M) / cell); cx <= Math.floor((s.maxX + MATCH_MAX_M) / cell); cx++)
      for (let cy = Math.floor((s.minY - MATCH_MAX_M) / cell); cy <= Math.floor((s.maxY + MATCH_MAX_M) / cell); cy++) {
        const k = cx + ',' + cy;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(idx);
      }
  });
  let prevWay = null;
  return samples.map((s) => {
    const p = project(s, o);
    const cand = grid.get(Math.floor(p.x / cell) + ',' + Math.floor(p.y / cell)) ?? [];
    const bestByWay = new Map();
    for (const idx of cand) {
      const sg = segs[idx], d = distPointSeg(p, sg.a, sg.b);
      const cur = bestByWay.get(sg.way.id);
      if (d <= MATCH_MAX_M && (!cur || d < cur.d)) bestByWay.set(sg.way.id, { way: sg.way, d });
    }
    let best = null;
    for (const c of bestByWay.values()) if (!best || c.d < best.d) best = c;
    if (best && prevWay != null && bestByWay.has(prevWay) && bestByWay.get(prevWay).d <= best.d + CONTINUITY_BONUS_M) best = bestByWay.get(prevWay);
    prevWay = best ? best.way.id : prevWay;
    return best ? { way: best.way, d: best.d } : null;
  });
}

// ---------- segmentation ----------
export function buildSegments(samples, matches) {
  const rows = samples.map((s, i) => {
    const t = matches[i]?.way.tags;
    return { dist: s.dist, cls: t ? classify(t) : 'unknown', tags: t ?? null };
  });
  const step = SAMPLE_STEP_M;
  let runs = [];
  const pushRun = (list, r) => {
    const last = list[list.length - 1];
    if (last && last.cls === r.cls) { last.rows.push(...r.rows); last.n += r.n; } else list.push(r);
  };
  for (const r of rows) pushRun(runs, { cls: r.cls, n: 1, rows: [r] });
  // absorb short runs into the longer neighbour, repeat until stable
  const minN = Math.ceil(MIN_SEGMENT_M / step);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < runs.length; i++) {
      if (runs[i].n >= minN || runs.length === 1) continue;
      const L = runs[i - 1], Rr = runs[i + 1];
      const tgt = !L ? Rr : !Rr ? L : (L.n >= Rr.n ? L : Rr);
      tgt.rows.push(...runs[i].rows);
      tgt.rows.sort((a, b) => a.dist - b.dist);
      tgt.n += runs[i].n;
      runs.splice(i, 1);
      const merged = [];
      for (const r of runs) pushRun(merged, r);
      runs = merged;
      changed = true;
      break;
    }
  }
  const mode = (arr) => {
    const c = {};
    arr.filter(Boolean).forEach((v) => { c[v] = (c[v] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  return runs.map((r) => ({
    fromKm: +(r.rows[0].dist / 1000).toFixed(3),
    toKm: +((r.rows[r.rows.length - 1].dist + step) / 1000).toFixed(3),
    class: r.cls,
    surface: mode(r.rows.map((x) => x.tags?.surface)),
    sacScale: mode(r.rows.map((x) => x.tags?.sac_scale)),
    highway: mode(r.rows.map((x) => x.tags?.highway)),
  }));
}

export function summarize(samples, matches, segments, totalM) {
  const classes = { road: 0, track: 0, trail: 0, technical: 0, unknown: 0 };
  for (const sg of segments) classes[sg.class] += (Math.min(sg.toKm, totalM / 1000) - sg.fromKm) * 1000;
  const n = samples.length, pct = (c) => +((100 * c) / n).toFixed(1);
  const matched = matches.filter(Boolean);
  const withSurface = matched.filter((m) => m.way.tags.surface).length;
  const withSac = matched.filter((m) => m.way.tags.sac_scale).length;
  const sum = Object.values(classes).reduce((a, b) => a + b, 0) || 1;
  return {
    distanceKm: +(totalM / 1000).toFixed(2),
    classes: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, { km: +(v / 1000).toFixed(2), pct: +((100 * v) / sum).toFixed(1) }])),
    coverage: { matchedPct: pct(matched.length), surfaceTagPct: pct(withSurface), sacScaleTagPct: pct(withSac), surfaceTagPctOfMatched: matched.length ? +((100 * withSurface) / matched.length).toFixed(1) : 0 },
  };
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const file = args.find((a, i) => !a.startsWith('--') && !['--out', '--from-cache', '--save-cache'].includes(args[i - 1]));
  if (!file) { console.error('Usage: compute-terrain.mjs <file.gpx> [--out result.json] [--from-cache f] [--save-cache f]'); process.exit(1); }
  const pts = parseGpx(readFileSync(file, 'utf8'));
  const samples = resample(pts);
  let fetched;
  const cachePath = opt('--from-cache');
  if (cachePath && existsSync(cachePath)) fetched = JSON.parse(readFileSync(cachePath, 'utf8'));
  else {
    fetched = await fetchWays(samples);
    if (opt('--save-cache')) writeFileSync(opt('--save-cache'), JSON.stringify(fetched));
  }
  const matches = matchSamples(samples, fetched.ways);
  const segments = buildSegments(samples, matches);
  const summary = summarize(samples, matches, segments, pts[pts.length - 1].dist);
  const result = { source: file, attribution: '(c) OpenStreetMap contributors (ODbL)', overpass: { requests: fetched.requests, ways: fetched.ways.length }, summary, segments };
  console.log(`\n${file}\n  ${summary.distanceKm} km, ${samples.length} samples, ${fetched.ways.length} OSM ways (${fetched.requests} Overpass request(s))`);
  for (const [k, v] of Object.entries(summary.classes)) console.log(`  ${k.padEnd(10)} ${String(v.km).padStart(7)} km  ${String(v.pct).padStart(5)} %`);
  const c = summary.coverage;
  console.log(`  coverage: matched ${c.matchedPct}% | surface tag ${c.surfaceTagPct}% | sac_scale tag ${c.sacScaleTagPct}%  (${segments.length} segments)`);
  console.log('  data: (c) OpenStreetMap contributors');
  const out = opt('--out');
  if (out) writeFileSync(out, JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith('compute-terrain.mjs')) {
  main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}
