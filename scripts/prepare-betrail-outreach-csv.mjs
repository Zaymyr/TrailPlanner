#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SHIFTED_DATE_COLUMNS = [
  "event_date_verified",
  "event_end_date_verified",
  "event_date_source_url",
  "event_date_confidence",
  "event_date_precision",
  "event_date_estimated_analysis",
  "event_date_analysis_basis",
  "event_status_best",
  "days_to_event_at_last_email",
  "proximity_bucket",
  "next_event_date",
  "next_event_date_text",
  "next_event_date_precision",
  "next_event_date_source_url",
  "next_event_date_confidence",
  "overloop_event_date_safe",
  "overloop_event_date_basis",
];

const OUTREACH_COLUMNS = [
  "outreach_event_date",
  "outreach_days_to_event",
  "outreach_eligible",
  "outreach_selected_today",
  "outreach_queue_rank",
  "outreach_block_reason",
];

const parseCsvRows = (csv) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (quoted && character === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV invalide : guillemet non ferme.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
};

export const parseCsvTable = (csv) => {
  const [rawHeaders = [], ...rawRows] = parseCsvRows(csv);
  const headers = rawHeaders.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header));
  if (headers.length === 0) throw new Error("CSV invalide : en-tete manquant.");

  return {
    headers,
    rows: rawRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))),
  };
};

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const serializeCsvTable = (headers, rows) => {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(","));
  return `${lines.join("\n")}\n`;
};

export const repairShiftedDateEnrichment = (rows) =>
  rows.map((row, index) => {
    const repaired = { ...row };
    const source = rows[index + 1];
    for (const column of SHIFTED_DATE_COLUMNS) repaired[column] = source?.[column] ?? "";
    return repaired;
  });

const parseIsoDate = (value, label) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} invalide : ${value}`);
  }
  return date;
};

const booleanValue = (value) => ["1", "true", "yes", "oui"].includes(String(value ?? "").trim().toLowerCase());
const hasValue = (value) => String(value ?? "").trim().length > 0;
const daysBetween = (from, to) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

export const prepareOutreachRows = (
  rows,
  { asOf, minDaysBefore = 0, maxDaysBefore = 365, dailyLimit = 150 } = {},
) => {
  const asOfDate = parseIsoDate(asOf, "--as-of");
  if (!asOfDate) throw new Error("--as-of doit respecter le format YYYY-MM-DD.");
  if (!Number.isInteger(minDaysBefore) || minDaysBefore < 0) throw new Error("--min-days-before doit etre positif ou nul.");
  if (!Number.isInteger(maxDaysBefore) || maxDaysBefore < minDaysBefore) {
    throw new Error("--max-days-before doit etre superieur ou egal a --min-days-before.");
  }
  if (!Number.isInteger(dailyLimit) || dailyLimit <= 0) throw new Error("--daily-limit doit etre un entier positif.");

  const prepared = rows.map((row, index) => {
    const eventDateValue = String(row.overloop_event_date_safe ?? "").trim();
    const eventDate = parseIsoDate(eventDateValue, "overloop_event_date_safe");
    const daysToEvent = eventDate ? daysBetween(asOfDate, eventDate) : null;
    const reasons = [];

    if (!hasValue(row.email)) reasons.push("missing_email");
    if (booleanValue(row.archived)) reasons.push("archived");
    if (booleanValue(row.excluded)) reasons.push("excluded");
    if (booleanValue(row["opted-out"])) reasons.push("opted_out");
    if (hasValue(row.hard_bounced_at)) reasons.push("hard_bounced");
    if (hasValue(row.replied_at) || Number(row.reply_count || 0) > 0) reasons.push("replied");
    if (hasValue(row.last_sent_email_at)) reasons.push("already_contacted");
    if (!eventDate) reasons.push("missing_safe_event_date");
    if (daysToEvent !== null && daysToEvent < minDaysBefore) reasons.push("event_too_soon");
    if (daysToEvent !== null && daysToEvent > maxDaysBefore) reasons.push("event_too_far");

    return {
      ...row,
      outreach_event_date: eventDateValue,
      outreach_days_to_event: daysToEvent === null ? "" : String(daysToEvent),
      outreach_eligible: reasons.length === 0 ? "true" : "false",
      outreach_selected_today: "false",
      outreach_queue_rank: "",
      outreach_block_reason: reasons.join(";"),
      __sourceIndex: index,
      __daysToEvent: daysToEvent,
    };
  });

  const eligible = prepared
    .filter((row) => row.outreach_eligible === "true")
    .sort((left, right) => left.__daysToEvent - right.__daysToEvent || left.__sourceIndex - right.__sourceIndex);

  eligible.forEach((row, index) => {
    row.outreach_queue_rank = String(index + 1);
    row.outreach_selected_today = index < dailyLimit ? "true" : "false";
  });

  return prepared.map(({ __sourceIndex, __daysToEvent, ...row }) => row);
};

const parseInteger = (value, flag, { allowZero = false } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(`${flag} doit etre ${allowZero ? "positif ou nul" : "un entier positif"}.`);
  }
  return parsed;
};

const parseArgs = (argv) => {
  const today = new Date().toISOString().slice(0, 10);
  const args = {
    input: "",
    output: "",
    asOf: today,
    minDaysBefore: 0,
    maxDaysBefore: 365,
    dailyLimit: 150,
    repairShiftedEnrichment: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repair-shifted-enrichment") {
      args.repairShiftedEnrichment = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next) throw new Error(`${arg} requiert une valeur.`);
    if (arg === "--input") args.input = next;
    else if (arg === "--output") args.output = next;
    else if (arg === "--as-of") args.asOf = next;
    else if (arg === "--min-days-before") args.minDaysBefore = parseInteger(next, arg, { allowZero: true });
    else if (arg === "--max-days-before") args.maxDaysBefore = parseInteger(next, arg, { allowZero: true });
    else if (arg === "--daily-limit") args.dailyLimit = parseInteger(next, arg);
    else throw new Error(`Option inconnue : ${arg}`);
    index += 1;
  }

  if (!args.input) throw new Error("--input est requis.");
  if (!args.output) args.output = args.input.replace(/\.csv$/i, "") + "-outreach.csv";
  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input);
  const outputPath = path.resolve(process.cwd(), args.output);
  if (inputPath === outputPath) throw new Error("Le fichier de sortie doit etre different du fichier source.");

  const table = parseCsvTable(await readFile(inputPath, "utf8"));
  const requiredColumns = ["email", "overloop_event_date_safe"];
  const missingColumns = requiredColumns.filter((column) => !table.headers.includes(column));
  if (missingColumns.length > 0) throw new Error(`Colonnes requises absentes : ${missingColumns.join(", ")}`);

  const repairedRows = args.repairShiftedEnrichment ? repairShiftedDateEnrichment(table.rows) : table.rows;
  const preparedRows = prepareOutreachRows(repairedRows, args);
  const headers = [...table.headers, ...OUTREACH_COLUMNS.filter((column) => !table.headers.includes(column))];
  await writeFile(outputPath, serializeCsvTable(headers, preparedRows), "utf8");

  const eligible = preparedRows.filter((row) => row.outreach_eligible === "true").length;
  const selected = preparedRows.filter((row) => row.outreach_selected_today === "true").length;
  console.error(
    JSON.stringify(
      {
        inputRows: table.rows.length,
        repairedShift: args.repairShiftedEnrichment,
        eligible,
        selected,
        output: outputPath,
      },
      null,
      2,
    ),
  );
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
