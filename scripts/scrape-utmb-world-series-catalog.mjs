#!/usr/bin/env node

// Extracts the official upcoming UTMB World Series catalog from the public
// calendar payload and API. Output is reviewable JSON; --sql-output also emits
// an idempotent data migration and never connects to Supabase itself.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { validateResearchHttpUrl } from "./catalog-research-http.mjs";

export const UTMB_CALENDAR_URL = "https://utmb.world/fr/utmb-world-series-events";
export const UTMB_API_URL = "https://api.utmb.world/search/races";
const PAGE_SIZE = 100;
const MONTHS = new Map([
  ["janvier", 1], ["fevrier", 2], ["mars", 3], ["avril", 4], ["mai", 5], ["juin", 6],
  ["juillet", 7], ["aout", 8], ["septembre", 9], ["octobre", 10], ["novembre", 11], ["decembre", 12],
]);

const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalized = (value) => compact(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlDate = (value) => `date ${sqlText(value)}`;

export const parseFrenchDate = (value) => {
  const match = normalized(value).match(/^(\d{1,2})\s+([a-z]+)\s+(20\d{2})$/);
  if (!match) throw new Error(`Date UTMB invalide : ${value}`);
  const month = MONTHS.get(match[2]);
  if (!month) throw new Error(`Mois UTMB inconnu : ${value}`);
  const date = `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  if (Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) throw new Error(`Date UTMB invalide : ${value}`);
  return date;
};

const tenantFromUrl = (value) => {
  const url = new URL(value);
  return url.hostname.toLowerCase().split(".")[0];
};

const officialRaceUrl = (value, eventUrl) => {
  const url = new URL(value);
  if (url.pathname.toLowerCase().includes("undefined") || url.pathname === "/" || url.pathname === "") {
    return new URL("/races", eventUrl).toString();
  }
  return url.toString();
};

const eventLocation = (event) => {
  const place = compact(event.placeName);
  const country = compact(event.country);
  if (!place) return country;
  return country && !normalized(place).includes(normalized(country)) ? `${place}, ${country}` : place;
};

const slugify = (value) => normalized(value)
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 90)
  .replace(/-$/g, "");

const statValue = (race, name) => {
  const value = race.details?.statsUp?.find((stat) => stat?.name === name)?.value;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const extractNextData = (html) => {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("Charge __NEXT_DATA__ UTMB introuvable.");
  return JSON.parse(match[1]);
};

export const normalizeUtmbCatalog = ({ events, races, dateFrom, dateTo }) => {
  const eventByTenant = new Map();
  for (const event of events) {
    const keys = [compact(event.tenant)];
    try { keys.push(tenantFromUrl(event.url)); } catch { /* invalid events are rejected when used */ }
    for (const key of keys.filter(Boolean)) eventByTenant.set(key.toLowerCase(), event);
  }

  const candidates = races.map((race) => {
    const date = parseFrenchDate(race.startDate);
    if (date < dateFrom || date > dateTo) return null;
    const tenant = tenantFromUrl(race.slug);
    const event = eventByTenant.get(tenant);
    if (!event) throw new Error(`Événement UTMB introuvable pour ${tenant} (${race.name}).`);
    const distanceKm = statValue(race, "distance");
    const elevationGainM = statValue(race, "elevationGain");
    if (!distanceKm || distanceKm <= 0) throw new Error(`Distance UTMB absente pour ${race.name}.`);
    if (elevationGainM === null || elevationGainM < 0) throw new Error(`D+ UTMB absent pour ${race.name}.`);
    const fallbackLocation = eventLocation(event);
    const location = compact(race.startLocation) && normalized(race.startLocation) !== "undefined"
      ? compact(race.startLocation)
      : fallbackLocation;
    if (!location) throw new Error(`Lieu UTMB absent pour ${race.name}.`);
    const name = compact(race.name);
    const sourceUrl = officialRaceUrl(race.slug, event.url);
    const year = date.slice(0, 4);
    return {
      utmbRaceId: Number(race.id),
      eventTenant: tenant,
      slug: `${slugify(name)}-${year}-utmb-${race.id}`,
      name,
      date,
      location,
      distanceKm,
      elevationGainM,
      sourceUrl,
      participationMode: /\b(relay|relais)\b/i.test(name) ? "relay" : "solo",
      dedupeKey: [tenant, normalized(name), date, normalized(location), sourceUrl.toLowerCase()].join("|"),
    };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date) || b.utmbRaceId - a.utmbRaceId);

  const uniqueRaces = [];
  const seen = new Set();
  for (const race of candidates) {
    if (seen.has(race.dedupeKey)) continue;
    seen.add(race.dedupeKey);
    const { dedupeKey, ...cleanRace } = race;
    uniqueRaces.push(cleanRace);
  }

  const racesByTenant = Map.groupBy
    ? Map.groupBy(uniqueRaces, (race) => race.eventTenant)
    : uniqueRaces.reduce((map, race) => map.set(race.eventTenant, [...(map.get(race.eventTenant) ?? []), race]), new Map());
  const normalizedEvents = [...racesByTenant.entries()].map(([tenant, tenantRaces]) => {
    const event = eventByTenant.get(tenant);
    const dates = tenantRaces.map((race) => race.date).sort();
    return {
      tenant,
      name: compact(event.title),
      location: eventLocation(event),
      websiteUrl: new URL(event.url).toString().replace(/\/$/, ""),
      startDate: dates[0],
      endDate: dates.at(-1),
      formatCount: tenantRaces.length,
    };
  }).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));

  return { events: normalizedEvents, races: uniqueRaces };
};

const values = (rows, columns) => rows.map((row) =>
  `  (${columns.map((column) => column.type === "number" ? String(row[column.key]) : column.type === "date" ? sqlDate(row[column.key]) : sqlText(row[column.key])).join(", ")})`,
).join(",\n");

export const buildUtmbMigrationSql = (catalog, verifiedAt) => `begin;

-- Official UTMB World Series public calendar snapshot generated by
-- scripts/scrape-utmb-world-series-catalog.mjs. GPX remains optional.
create temporary table _utmb_events (
  tenant text primary key, name text not null, location text not null,
  website_url text not null, start_date date not null, end_date date not null
) on commit drop;

insert into _utmb_events values
${values(catalog.events, [
  {key:"tenant"}, {key:"name"}, {key:"location"}, {key:"websiteUrl"}, {key:"startDate",type:"date"}, {key:"endDate",type:"date"},
])};

do $$
declare source record; target_id uuid; candidate_ids uuid[];
begin
  for source in select * from _utmb_events order by tenant loop
    select array_agg(distinct event.id) into candidate_ids
    from public.race_events event
    where event.organizer_details #>> '{catalogSource,utmbTenant}' = source.tenant
       or lower(coalesce(event.website_url, '')) like '%//' || source.tenant || '.utmb.world%'
       or lower(event.name) = lower(source.name)
       or exists (
         select 1 from public.races race
         where race.event_id = event.id
           and (lower(coalesce(race.source_url, '')) like '%//' || source.tenant || '.utmb.world%'
             or lower(coalesce(race.external_site_url, '')) like '%//' || source.tenant || '.utmb.world%')
       );
    if coalesce(array_length(candidate_ids, 1), 0) > 1 then
      raise exception 'Ambiguous UTMB event binding for tenant %: %', source.tenant, candidate_ids;
    end if;
    target_id := candidate_ids[1];
    if target_id is null then
      insert into public.race_events (name, location, website_url, race_date, is_live, organizer_details)
      values (source.name, source.location, source.website_url, source.start_date, true,
        jsonb_build_object('officialWebsiteUrl', source.website_url,
          'dateRange', jsonb_build_object('endDate', source.end_date::text),
          'catalogSource', jsonb_build_object('kind', 'official', 'provider', 'utmb', 'utmbTenant', source.tenant, 'verifiedAt', ${sqlText(verifiedAt)})))
      returning id into target_id;
    else
      update public.race_events
      set name = source.name, location = source.location, website_url = source.website_url,
          race_date = source.start_date, is_live = true,
          organizer_details = coalesce(organizer_details, '{}'::jsonb) || jsonb_build_object(
            'officialWebsiteUrl', source.website_url,
            'dateRange', jsonb_build_object('endDate', source.end_date::text),
            'catalogSource', jsonb_build_object('kind', 'official', 'provider', 'utmb', 'utmbTenant', source.tenant, 'verifiedAt', ${sqlText(verifiedAt)})),
          updated_at = now()
      where id = target_id;
    end if;
  end loop;
end $$;

-- The partial unique index permits only one current edition per event. Clear the
-- previous marker first so an existing 2026 event can safely move to its 2027
-- official edition in the same transaction.
update public.race_event_editions edition
set is_current = false
where edition.event_id in (
  select event.id
  from _utmb_events source
  join public.race_events event
    on event.organizer_details #>> '{catalogSource,utmbTenant}' = source.tenant
)
  and edition.is_current;

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, extract(year from source.start_date)::smallint, source.start_date, source.end_date, true, true
from _utmb_events source
join public.race_events event on event.organizer_details #>> '{catalogSource,utmbTenant}' = source.tenant
on conflict (event_id, edition_year) do update
set start_date = least(
      excluded.start_date,
      coalesce((select min(race.race_date) from public.races race where race.edition_id = race_event_editions.id), excluded.start_date)
    ),
    end_date = greatest(
      excluded.end_date,
      coalesce((select max(race.race_date) from public.races race where race.edition_id = race_event_editions.id), excluded.end_date)
    ),
    is_current = true,
    is_visible = true;

create temporary table _utmb_races (
  event_tenant text not null, utmb_race_id bigint primary key, slug text not null,
  name text not null, race_date date not null, location text not null,
  distance_km numeric not null, elevation_gain_m numeric not null,
  source_url text not null, participation_mode text not null
) on commit drop;

insert into _utmb_races values
${values(catalog.races, [
  {key:"eventTenant"}, {key:"utmbRaceId",type:"number"}, {key:"slug"}, {key:"name"}, {key:"date",type:"date"},
  {key:"location"}, {key:"distanceKm",type:"number"}, {key:"elevationGainM",type:"number"}, {key:"sourceUrl"}, {key:"participationMode"},
])};

do $$
declare source record; event_row public.race_events%rowtype; edition_id_value uuid; target_id uuid;
begin
  for source in select * from _utmb_races order by race_date, utmb_race_id loop
    select * into strict event_row from public.race_events
    where organizer_details #>> '{catalogSource,utmbTenant}' = source.event_tenant;
    select id into strict edition_id_value from public.race_event_editions
    where event_id = event_row.id and edition_year = extract(year from source.race_date)::smallint;

    select race.id into target_id
    from public.races race
    where race.event_id = event_row.id
      and extract(year from coalesce(race.race_date, source.race_date)) = extract(year from source.race_date)
      and (
        race.organizer_details #>> '{catalogSource,utmbRaceId}' = source.utmb_race_id::text
        or (
          race.organizer_details #>> '{catalogSource,utmbRaceId}' is null
          and (
            (
              lower(coalesce(race.source_url, '')) = lower(source.source_url)
              and 1 = (select count(*) from _utmb_races source_sibling
                where source_sibling.event_tenant = source.event_tenant
                  and lower(source_sibling.source_url) = lower(source.source_url))
            )
            or (
              abs(coalesce(race.distance_km, -100000) - source.distance_km) <= greatest(0.5, source.distance_km * 0.02)
              and 1 = (select count(*) from _utmb_races source_sibling
                where source_sibling.event_tenant = source.event_tenant
                  and abs(source_sibling.distance_km - source.distance_km) <= greatest(0.5, source.distance_km * 0.02))
              and 1 = (select count(*) from public.races sibling
                where sibling.event_id = event_row.id
                  and extract(year from coalesce(sibling.race_date, source.race_date)) = extract(year from source.race_date)
                  and sibling.organizer_details #>> '{catalogSource,utmbRaceId}' is null
                  and abs(coalesce(sibling.distance_km, -100000) - source.distance_km) <= greatest(0.5, source.distance_km * 0.02))
            )
          )
        )
      )
    order by case
      when race.organizer_details #>> '{catalogSource,utmbRaceId}' = source.utmb_race_id::text then 0
      when lower(coalesce(race.source_url, '')) = lower(source.source_url) then 1
      else 2 end
    limit 1;

    if target_id is null then
      insert into public.races (
        slug, name, location, location_text, distance_km, elevation_gain_m,
        source_url, external_site_url, is_published, is_live, race_date,
        is_public, has_aid_stations, event_id, edition_group_id, series_name,
        edition_id, racebook_is_live, data_status, missing_required_fields,
        participation_mode, organizer_details
      ) values (
        source.slug, source.name, source.location, source.location, source.distance_km, source.elevation_gain_m,
        source.source_url, source.source_url, true, true, source.race_date,
        true, false, event_row.id, gen_random_uuid(), source.name,
        edition_id_value, false, 'complete', array[]::text[], source.participation_mode,
        jsonb_build_object('catalogSource', jsonb_build_object('kind', 'official', 'provider', 'utmb',
          'utmbRaceId', source.utmb_race_id::text, 'verifiedAt', ${sqlText(verifiedAt)}))
      );
    else
      update public.races
      set race_date = source.race_date, location = source.location, location_text = source.location,
          source_url = source.source_url, external_site_url = source.source_url,
          edition_id = edition_id_value, is_published = true, is_live = true, is_public = true,
          data_status = 'complete', missing_required_fields = array[]::text[],
          participation_mode = source.participation_mode,
          organizer_details = coalesce(organizer_details, '{}'::jsonb) || jsonb_build_object(
            'catalogSource', jsonb_build_object('kind', 'official', 'provider', 'utmb',
              'utmbRaceId', source.utmb_race_id::text, 'verifiedAt', ${sqlText(verifiedAt)})),
          updated_at = now()
      where id = target_id;
    end if;
  end loop;
end $$;

-- Tighten the temporary compatibility envelope after format dates have been
-- refreshed, while retaining any pre-existing unmatched format in the edition.
update public.race_event_editions edition
set start_date = least(
      source.start_date,
      coalesce((select min(race.race_date) from public.races race where race.edition_id = edition.id), source.start_date)
    ),
    end_date = greatest(
      source.end_date,
      coalesce((select max(race.race_date) from public.races race where race.edition_id = edition.id), source.end_date)
    )
from _utmb_events source
join public.race_events event
  on event.organizer_details #>> '{catalogSource,utmbTenant}' = source.tenant
where edition.event_id = event.id
  and edition.edition_year = extract(year from source.start_date)::smallint;

do $$
declare imported_count integer;
begin
  select count(*) into imported_count
  from public.races
  where organizer_details #>> '{catalogSource,provider}' = 'utmb'
    and organizer_details #>> '{catalogSource,utmbRaceId}' in (select utmb_race_id::text from _utmb_races)
    and is_live and is_public and data_status = 'complete';
  if imported_count <> (select count(*) from _utmb_races) then
    raise exception 'Expected % verified UTMB formats, found %', (select count(*) from _utmb_races), imported_count;
  end if;
end $$;

commit;
`;

const parseArgs = (argv) => {
  const today = new Date().toISOString().slice(0, 10);
  const args = { dateFrom: today, dateTo: `${Number(today.slice(0, 4)) + 1}-12-31`, output: "tmp/utmb-world-series-catalog.json", sqlOutput: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]; const next = argv[index + 1];
    if (arg === "--date-from") { args.dateFrom = next; index += 1; continue; }
    if (arg === "--date-to") { args.dateTo = next; index += 1; continue; }
    if (arg === "--output") { args.output = next; index += 1; continue; }
    if (arg === "--sql-output") { args.sqlOutput = next; index += 1; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(args.dateFrom) || !/^20\d{2}-\d{2}-\d{2}$/.test(args.dateTo) || args.dateFrom > args.dateTo) {
    throw new Error("Fenêtre de dates invalide.");
  }
  return args;
};

const fetchText = async (url, fetchImpl) => {
  await validateResearchHttpUrl(url);
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "PaceYourself-CatalogResearch/2.0" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
};

const fetchRacePage = async (offset, args, fetchImpl) => {
  const url = new URL(UTMB_API_URL);
  for (const [key, value] of Object.entries({ lang: "fr", dateMin: args.dateFrom, dateMax: args.dateTo, offset, limit: PAGE_SIZE })) {
    url.searchParams.set(key, String(value));
  }
  await validateResearchHttpUrl(url.toString());
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/json", "user-agent": "PaceYourself-CatalogResearch/2.0", "x-tenant-id": "worldseries" },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
};

export const run = async (argv = process.argv.slice(2), fetchImpl = fetch) => {
  const args = parseArgs(argv);
  const nextData = extractNextData(await fetchText(UTMB_CALENDAR_URL, fetchImpl));
  const eventSlice = nextData.props?.pageProps?.slices?.find((slice) => slice?.type === "eventsWorldMap");
  const events = eventSlice?.data?.events;
  if (!Array.isArray(events) || !events.length) throw new Error("Événements UTMB absents du calendrier officiel.");

  const first = await fetchRacePage(0, args, fetchImpl);
  const allRaces = [...(first.races ?? [])];
  for (let offset = PAGE_SIZE; offset < Number(first.nbHits ?? 0); offset += PAGE_SIZE) {
    const page = await fetchRacePage(offset, args, fetchImpl);
    allRaces.push(...(page.races ?? []));
  }
  const catalog = normalizeUtmbCatalog({ events, races: allRaces, dateFrom: args.dateFrom, dateTo: args.dateTo });
  const payload = {
    schemaVersion: 1,
    source: { calendarUrl: UTMB_CALENDAR_URL, apiUrl: UTMB_API_URL, fetchedAt: new Date().toISOString() },
    window: { dateFrom: args.dateFrom, dateTo: args.dateTo },
    counts: { rawRaces: allRaces.length, uniqueRaces: catalog.races.length, events: catalog.events.length },
    ...catalog,
  };
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  if (args.sqlOutput) {
    await mkdir(dirname(args.sqlOutput), { recursive: true });
    await writeFile(args.sqlOutput, buildUtmbMigrationSql(catalog, args.dateFrom), "utf8");
  }
  console.error(`UTMB : ${allRaces.length} lignes officielles, ${catalog.races.length} formats uniques, ${catalog.events.length} événements.`);
  return payload;
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
