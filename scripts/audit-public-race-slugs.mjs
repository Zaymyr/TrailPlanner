#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TECHNICAL_PREFIX = /^(?:organizer-import|race)-/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_IN_SLUG = /(?:^|-)[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:-|$)/i;
const GENERATED_HEX_SUFFIX = /-[0-9a-f]{8}$/i;
const SHORT_GENERATED_SUFFIX = /-([a-z0-9]{4})$/i;
const GENERIC_FORMAT = /^(?:w?\d+(?:[.,]\d+)?(?:-?k|-?km)?|course|format|race|trail|ultra)$/i;

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/œ/gi, (match) => (match === "Œ" ? "OE" : "oe"))
    .replace(/æ/gi, (match) => (match === "Æ" ? "AE" : "ae"))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const slugify = (value) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const containsWords = (whole, part) => {
  const wholeSlug = slugify(whole);
  const partSlug = slugify(part);
  return Boolean(partSlug && (`-${wholeSlug}-`).includes(`-${partSlug}-`));
};

const formatName = (race) => {
  const name = String(race.name ?? "").trim();
  if (name && !GENERIC_FORMAT.test(name.replace(/\s+/g, ""))) return name;
  if (Number.isFinite(race.distance_km)) return `trail ${Number(race.distance_km).toLocaleString("en-US")} km`;
  return name || "course trail";
};

export const buildDescriptiveSlug = (race) => {
  const eventName = String(race.event_name ?? "").trim();
  const raceName = formatName(race);
  let label = eventName && !containsWords(raceName, eventName) ? `${eventName} ${raceName}` : raceName || eventName;

  const location = String(race.location ?? "").trim();
  if (!eventName && location && !containsWords(label, location)) label = `${label} ${location}`;
  return slugify(label) || `course-${stableIdPart(race.id)}`;
};

export const detectTechnicalSlug = (slug, raceName = "") => {
  const value = String(slug ?? "").trim().toLowerCase();
  const reasons = [];
  if (!value) return ["missing_slug"];
  if (TECHNICAL_PREFIX.test(value)) reasons.push("technical_prefix");
  if (UUID.test(value) || UUID_IN_SLUG.test(value)) reasons.push("uuid_identifier");
  if (GENERATED_HEX_SUFFIX.test(value)) reasons.push("generated_hex_suffix");

  const shortMatch = value.match(SHORT_GENERATED_SUFFIX);
  const withoutShortSuffix = shortMatch ? value.slice(0, -shortMatch[0].length) : value;
  if (GENERIC_FORMAT.test(value) || GENERIC_FORMAT.test(withoutShortSuffix)) reasons.push("generic_format_slug");
  if (shortMatch && GENERIC_FORMAT.test(withoutShortSuffix) && slugify(raceName) !== value) {
    reasons.push("short_generated_suffix");
  }
  return [...new Set(reasons)];
};

const stableIdPart = (id) => slugify(id).replace(/-/g, "").slice(0, 8) || "inconnu";

const normalizeRace = (race, eventsById) => {
  const event = race.event_id ? eventsById.get(race.event_id) : undefined;
  return {
    id: String(race.id ?? ""),
    event_id: race.event_id ? String(race.event_id) : null,
    name: String(race.name ?? "").trim(),
    event_name: String(race.event_name ?? event?.name ?? "").trim() || null,
    slug: String(race.slug ?? "").trim(),
    location: String(race.location_text ?? race.location ?? event?.location ?? "").trim() || null,
    distance_km: Number.isFinite(Number(race.distance_km)) ? Number(race.distance_km) : null,
  };
};

export const buildSlugAudit = ({ races, events = [] }) => {
  if (!Array.isArray(races)) throw new Error("Le jeu de donnees doit contenir un tableau races.");
  const eventsById = new Map(events.map((event) => [String(event.id), event]));
  const normalized = races
    .map((race) => normalizeRace(race, eventsById))
    .sort((left, right) => left.id.localeCompare(right.id));
  const currentSlugOwners = new Map();
  for (const race of normalized) {
    if (!currentSlugOwners.has(race.slug)) currentSlugOwners.set(race.slug, []);
    currentSlugOwners.get(race.slug).push(race.id);
  }

  const bases = normalized.map((race) => ({ race, base: buildDescriptiveSlug(race) }));
  const baseOwners = new Map();
  for (const item of bases) {
    if (!baseOwners.has(item.base)) baseOwners.set(item.base, []);
    baseOwners.get(item.base).push(item.race.id);
  }

  const reserved = new Map([...currentSlugOwners].map(([slug, ids]) => [slug, new Set(ids)]));
  const allocatedProposals = new Set();
  const proposals = bases.map(({ race, base }) => {
    const technicalReasons = detectTechnicalSlug(race.slug, race.name);
    const baseCollisionIds = (baseOwners.get(base) ?? []).filter((id) => id !== race.id);
    let proposedSlug = base;
    const proposalReasons = [];

    const conflictingCurrentIds = [...(reserved.get(proposedSlug) ?? [])].filter((id) => id !== race.id);
    if (baseCollisionIds.length > 0 || conflictingCurrentIds.length > 0) {
      const locationSlug = slugify(race.location);
      if (locationSlug && !containsWords(proposedSlug, locationSlug)) proposedSlug = `${proposedSlug}-${locationSlug}`;
    }

    const stillConflicts =
      (baseCollisionIds.length > 0 && bases.some((item) => item.race.id !== race.id && item.base === proposedSlug)) ||
      [...(reserved.get(proposedSlug) ?? [])].some((id) => id !== race.id) ||
      allocatedProposals.has(proposedSlug);
    if (stillConflicts || proposedSlug === "") {
      proposedSlug = `${proposedSlug || "course"}-${stableIdPart(race.id)}`;
      proposalReasons.push("stable_id_disambiguation");
    } else if (proposedSlug !== base) {
      proposalReasons.push("location_disambiguation");
    }

    allocatedProposals.add(proposedSlug);

    return {
      race_id: race.id,
      event_id: race.event_id,
      name: race.name,
      event_name: race.event_name,
      location: race.location,
      distance_km: race.distance_km,
      current_slug: race.slug,
      technical_reasons: technicalReasons,
      base_slug: base,
      base_collision_ids: baseCollisionIds,
      proposed_slug: proposedSlug,
      proposal_reasons: proposalReasons,
      action: technicalReasons.length > 0 && proposedSlug !== race.slug ? "review_rename" : "keep",
    };
  });

  const proposedOwners = new Map();
  for (const proposal of proposals) {
    if (!proposedOwners.has(proposal.proposed_slug)) proposedOwners.set(proposal.proposed_slug, []);
    proposedOwners.get(proposal.proposed_slug).push(proposal.race_id);
  }
  const unresolvedCollisions = [...proposedOwners]
    .filter(([, ids]) => ids.length > 1)
    .map(([slug, raceIds]) => ({ slug, race_ids: raceIds }));

  const duplicateCurrentSlugs = [...currentSlugOwners]
    .filter(([, ids]) => ids.length > 1)
    .map(([slug, raceIds]) => ({ slug, race_ids: raceIds }));

  return {
    dry_run: true,
    write_operations: 0,
    application_note: "Rapport de revue uniquement : aucun slug et aucune ligne Supabase ne sont modifies.",
    summary: {
      public_races: proposals.length,
      technical_slugs: proposals.filter((item) => item.technical_reasons.length > 0).length,
      rename_reviews: proposals.filter((item) => item.action === "review_rename").length,
      base_collisions: proposals.filter((item) => item.base_collision_ids.length > 0).length,
      unresolved_proposal_collisions: unresolvedCollisions.length,
    },
    duplicate_current_slugs: duplicateCurrentSlugs,
    unresolved_proposal_collisions: unresolvedCollisions,
    proposals,
  };
};

const parseArgs = (argv) => {
  const args = { input: "", output: "", supabaseUrl: "", anonKey: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (!["--input", "--output", "--supabase-url", "--anon-key"].includes(arg)) {
      throw new Error(`Option inconnue : ${arg}`);
    }
    if (!next) throw new Error(`${arg} requiert une valeur.`);
    if (arg === "--input") args.input = next;
    if (arg === "--output") args.output = next;
    if (arg === "--supabase-url") args.supabaseUrl = next;
    if (arg === "--anon-key") args.anonKey = next;
    index += 1;
  }
  return args;
};

const loadLocalPublicEnv = async () => {
  const candidates = ["apps/web/.env.local", "apps/web/.env", "apps/mobile/.env.local", "apps/mobile/.env", ".env.local", ".env"];
  const values = {};
  for (const candidate of candidates) {
    try {
      const contents = await readFile(path.resolve(process.cwd(), candidate), "utf8");
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match && !(match[1] in values)) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return values;
};

const fetchAll = async (baseUrl, resource, headers) => {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const separator = resource.includes("?") ? "&" : "?";
    const response = await fetch(`${baseUrl}/rest/v1/${resource}${separator}limit=${pageSize}&offset=${offset}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) throw new Error(`Lecture Supabase impossible (${response.status}) : ${await response.text()}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Reponse Supabase inattendue.");
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
};

export const fetchPublicRaceData = async ({ supabaseUrl, anonKey }) => {
  if (!/^https:\/\//.test(supabaseUrl)) throw new Error("URL Supabase HTTPS requise.");
  if (!anonKey) throw new Error("Cle anon/publishable Supabase requise.");
  if (anonKey.startsWith("sb_secret_")) throw new Error("Une cle Supabase secrete/service_role est refusee par ce dry-run.");
  const jwtPayload = anonKey.split(".")[1];
  if (jwtPayload) {
    try {
      const payload = JSON.parse(Buffer.from(jwtPayload, "base64url").toString("utf8"));
      if (payload.role === "service_role") {
        throw new Error("Une cle Supabase secrete/service_role est refusee par ce dry-run.");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("service_role")) throw error;
    }
  }
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
  const [races, events] = await Promise.all([
    fetchAll(
      supabaseUrl.replace(/\/$/, ""),
      "races?select=id,event_id,slug,name,location_text,location,distance_km&is_live=eq.true&is_public=eq.true&order=id.asc",
      headers,
    ),
    fetchAll(
      supabaseUrl.replace(/\/$/, ""),
      "race_events?select=id,name,location&is_live=eq.true&order=id.asc",
      headers,
    ),
  ]);
  const liveEventIds = new Set(events.map((event) => String(event.id)));
  return {
    // An attached race is public only while its parent event is live. Standalone
    // public races remain eligible because they have no parent visibility flag.
    races: races.filter((race) => !race.event_id || liveEventIds.has(String(race.event_id))),
    events,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  let data;
  if (args.input) {
    data = JSON.parse(await readFile(path.resolve(process.cwd(), args.input), "utf8"));
    if (Array.isArray(data)) data = { races: data, events: [] };
  } else {
    const localEnv = await loadLocalPublicEnv();
    data = await fetchPublicRaceData({
      supabaseUrl:
        args.supabaseUrl ||
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        localEnv.SUPABASE_URL ||
        localEnv.NEXT_PUBLIC_SUPABASE_URL ||
        localEnv.EXPO_PUBLIC_SUPABASE_URL,
      anonKey:
        args.anonKey ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        localEnv.SUPABASE_ANON_KEY ||
        localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        localEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
  }

  const json = `${JSON.stringify(buildSlugAudit(data), null, 2)}\n`;
  if (args.output) await writeFile(path.resolve(process.cwd(), args.output), json, "utf8");
  else process.stdout.write(json);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
