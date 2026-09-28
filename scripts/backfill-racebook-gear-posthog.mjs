import fs from 'node:fs';
import readline from 'node:readline';

const BACKFILL_ID = 'racebook_gear_checks_2026_09_28';
const EVENT_NAME = 'racebook gear item toggled';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readEnvFile(path) {
  const values = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)\s*$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function raceTimingWindow(raceDate, checkedAt) {
  if (!raceDate) return { daysBeforeRace: null, timingWindow: 'unknown' };
  const raceDay = new Date(`${raceDate.slice(0, 10)}T00:00:00.000Z`);
  const checkDay = new Date(checkedAt);
  checkDay.setUTCHours(0, 0, 0, 0);
  const daysBeforeRace = Math.round((raceDay.getTime() - checkDay.getTime()) / 86_400_000);
  if (!Number.isFinite(daysBeforeRace)) return { daysBeforeRace: null, timingWindow: 'unknown' };
  if (daysBeforeRace < 0) return { daysBeforeRace, timingWindow: 'after_race' };
  if (daysBeforeRace === 0) return { daysBeforeRace, timingWindow: 'race_day' };
  if (daysBeforeRace <= 2) return { daysBeforeRace, timingWindow: 'd1_d2' };
  if (daysBeforeRace <= 7) return { daysBeforeRace, timingWindow: 'd3_d7' };
  if (daysBeforeRace <= 14) return { daysBeforeRace, timingWindow: 'd8_d14' };
  if (daysBeforeRace <= 30) return { daysBeforeRace, timingWindow: 'd15_d30' };
  return { daysBeforeRace, timingWindow: 'd31_plus' };
}

function buildEvent(row) {
  const requiredStrings = [
    row.user_id,
    row.race_id,
    row.item_key,
    row.checked_at,
    row.item_label,
    row.race_name,
    row.event_name,
  ];
  if (!requiredStrings.every(isNonEmptyString)) {
    throw new Error('Backfill row is missing a required string field.');
  }
  if (!['required', 'recommended', 'weather'].includes(row.gear_group)) {
    throw new Error(`Unexpected gear group for ${row.item_key}.`);
  }

  const { daysBeforeRace, timingWindow } = raceTimingWindow(row.race_date, row.checked_at);
  return {
    event: EVENT_NAME,
    distinct_id: row.user_id,
    timestamp: new Date(row.checked_at).toISOString(),
    properties: {
      action: 'checked',
      backfill_id: BACKFILL_ID,
      backfill_source: 'supabase_racebook_gear_checks',
      checked: true,
      days_before_race: daysBeforeRace,
      entry_point: 'historical_backfill',
      event_id: row.event_id,
      event_name: row.event_name,
      gear_group: row.gear_group,
      item_id: row.item_id,
      item_label: row.item_label.trim().slice(0, 160),
      item_required: row.item_required,
      race_date: row.race_date,
      race_id: row.race_id,
      race_name: row.race_name,
      race_timing_window: timingWindow,
      surface: 'app',
      weather_context: row.weather_context,
    },
  };
}

async function readRows() {
  const rawMode = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';
  if (rawMode) process.stdin.setRawMode(true);
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    for await (const line of input) {
      if (line.trim()) return JSON.parse(line.replace(/^\uFEFF/, ''));
    }
  } finally {
    if (rawMode) process.stdin.setRawMode(false);
  }
  throw new Error('Expected one JSON array on stdin.');
}

const envFile = readArgument('--env-file');
if (!envFile) throw new Error('--env-file is required.');

const rows = await readRows();
if (!Array.isArray(rows) || rows.length === 0) throw new Error('No rows supplied for backfill.');

const uniqueKeys = new Set(rows.map((row) => `${row.user_id}:${row.race_id}:${row.item_key}`));
if (uniqueKeys.size !== rows.length) throw new Error('Duplicate checklist rows detected in input.');

const batch = rows.map(buildEvent);
const uniqueUsers = new Set(rows.map((row) => row.user_id)).size;
if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ mode: 'dry-run', backfillId: BACKFILL_ID, events: batch.length, users: uniqueUsers }));
  process.exit(0);
}

const env = readEnvFile(envFile);
const apiKey = env.EXPO_PUBLIC_POSTHOG_KEY || env.EXPO_PUBLIC_POSTHOG_TOKEN;
const host = (env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
if (!apiKey) throw new Error('PostHog project token is missing from the environment file.');
if (host !== 'https://eu.i.posthog.com') throw new Error(`Refusing unexpected PostHog host: ${host}`);

const response = await fetch(`${host}/batch/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_key: apiKey, historical_migration: true, batch }),
});
const responseText = await response.text();
if (!response.ok) throw new Error(`PostHog batch failed (${response.status}): ${responseText.slice(0, 500)}`);

console.log(JSON.stringify({ mode: 'executed', backfillId: BACKFILL_ID, events: batch.length, users: uniqueUsers, status: response.status }));
