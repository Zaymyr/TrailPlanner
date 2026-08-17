#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_CALENDAR_URL = "https://www.betrail.run/calendar/france";
const DEFAULT_OUTPUT = "tmp/betrail-organizer-emails.csv";
const DEFAULT_STATE = "tmp/betrail-organizer-emails-state.json";
const DEFAULT_LIMIT = 50;
const DEFAULT_DELAY_MS = 1_500;
const DEFAULT_MANUAL_TIMEOUT_MS = 5 * 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const extractEmailAddresses = (value) => {
  const matches = String(value ?? "")
    .replace(/\s*\[at\]\s*/gi, "@")
    .replace(/\s*\[dot\]\s*/gi, ".")
    .match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi);

  return [...new Set((matches ?? []).map((email) => email.toLowerCase().replace(/[),.;:]+$/, "")))];
};

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const recordsToCsv = (records) => {
  const header = ["race_name", "date", "organizer", "emails", "race_url", "status"];
  const rows = records.map((record) =>
    [record.raceName, record.date, record.organizer, record.emails.join(";"), record.raceUrl, record.status]
      .map(csvCell)
      .join(","),
  );

  return `${[header.map(csvCell).join(","), ...rows].join("\n")}\n`;
};

export const csvToRecords = (csv) => {
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

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [header = [], ...data] = rows;
  const columns = new Map(header.map((name, index) => [name.replace(/^\uFEFF/, ""), index]));
  const value = (values, name) => values[columns.get(name)] ?? "";

  return data
    .map((values) => ({
      raceName: value(values, "race_name"),
      date: value(values, "date"),
      organizer: value(values, "organizer"),
      emails: extractEmailAddresses(value(values, "emails")),
      raceUrl: canonicalizeRaceUrl(value(values, "race_url")),
      status: value(values, "status"),
    }))
    .filter((record) => record.raceUrl);
};

export const canonicalizeRaceUrl = (value) => {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return "";
  }
};

const isCompletedRecord = (record) => Boolean(record.status) && !record.status.startsWith("error:");

const upsertRecord = (records, nextRecord) => {
  const canonicalUrl = canonicalizeRaceUrl(nextRecord.raceUrl);
  const normalized = { ...nextRecord, raceUrl: canonicalUrl };
  const index = records.findIndex((record) => canonicalizeRaceUrl(record.raceUrl) === canonicalUrl);
  if (index === -1) records.push(normalized);
  else records[index] = normalized;
};

const parsePositiveInteger = (value, flag) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} doit etre un entier positif.`);
  return parsed;
};

const parseArgs = (argv) => {
  const args = {
    calendarUrl: DEFAULT_CALENDAR_URL,
    output: DEFAULT_OUTPUT,
    state: DEFAULT_STATE,
    limit: DEFAULT_LIMIT,
    delayMs: DEFAULT_DELAY_MS,
    manualTimeoutMs: DEFAULT_MANUAL_TIMEOUT_MS,
    chromePath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (["--calendar-url", "--output", "--state", "--limit", "--delay-ms", "--manual-timeout-ms", "--chrome-path"].includes(arg)) {
      if (!next) throw new Error(`${arg} requiert une valeur.`);

      if (arg === "--calendar-url") args.calendarUrl = next;
      if (arg === "--output") args.output = next;
      if (arg === "--state") args.state = next;
      if (arg === "--limit") args.limit = parsePositiveInteger(next, arg);
      if (arg === "--delay-ms") args.delayMs = parsePositiveInteger(next, arg);
      if (arg === "--manual-timeout-ms") args.manualTimeoutMs = parsePositiveInteger(next, arg);
      if (arg === "--chrome-path") args.chromePath = next;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Option inconnue : ${arg}`);
  }

  const url = new URL(args.calendarUrl);
  if (url.protocol !== "https:" || !/(^|\.)betrail\.run$/i.test(url.hostname)) {
    throw new Error("--calendar-url doit etre une URL HTTPS du domaine betrail.run.");
  }

  return args;
};

const printHelp = () => {
  console.log(`Usage:
  node scripts/scrape-betrail-organizer-emails.mjs [options]

Options:
      --calendar-url <url>       Calendrier BeTrail. Par defaut : ${DEFAULT_CALENDAR_URL}
      --limit <nombre>           Nombre maximal de courses. Par defaut : ${DEFAULT_LIMIT}
      --delay-ms <ms>            Pause entre deux fiches. Par defaut : ${DEFAULT_DELAY_MS}
      --manual-timeout-ms <ms>   Temps pour valider Cloudflare. Par defaut : ${DEFAULT_MANUAL_TIMEOUT_MS}
      --chrome-path <chemin>     Executable Chrome/Chromium a utiliser.
      --output <chemin>          Fichier CSV. Par defaut : ${DEFAULT_OUTPUT}
      --state <chemin>           Historique anti-doublon. Par defaut : ${DEFAULT_STATE}
  -h, --help                     Afficher cette aide.

Le script reprend automatiquement apres les courses deja presentes dans son historique.
Il ouvre une fenetre Chrome. Si BeTrail affiche un controle Cloudflare, validez-le
manuellement une seule fois. Le parcours reprend ensuite automatiquement.
`);
};

const readOptionalFile = async (filePath) => {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};

const loadPreviousRecords = async (statePath, outputPath) => {
  const rawState = await readOptionalFile(statePath);
  if (rawState) {
    const state = JSON.parse(rawState);
    if (!Array.isArray(state.records)) throw new Error(`Historique invalide : ${statePath}`);
    return state.records.filter((record) => canonicalizeRaceUrl(record.raceUrl));
  }

  const existingCsv = await readOptionalFile(outputPath);
  if (!existingCsv) return [];

  const records = csvToRecords(existingCsv);
  console.error(`${records.length} course(s) importee(s) depuis le CSV existant pour initialiser l'historique.`);
  return records;
};

const persistRecords = async (records, statePath, outputPath) => {
  await Promise.all([mkdir(path.dirname(statePath), { recursive: true }), mkdir(path.dirname(outputPath), { recursive: true })]);
  await writeFile(
    statePath,
    `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), records }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(outputPath, recordsToCsv(records), "utf8");
};

const findChrome = (explicitPath) => {
  const candidates = [
    explicitPath,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error("Chrome ou Chromium est introuvable. Utilisez --chrome-path.");
  return match;
};

const reservePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });

const waitForTarget = async (port, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }

  throw new Error(`Chrome n'a pas demarre a temps${lastError ? ` : ${lastError.message}` : "."}`);
};

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
  }

  send(method, params = {}, timeoutMs = 30_000) {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Commande Chrome expiree : ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Erreur JavaScript dans Chrome.");
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

const pageSnapshotExpression = `(() => ({
  title: document.title,
  url: location.href,
  readyState: document.readyState,
  text: (document.body?.innerText || '').slice(0, 1000)
}))()`;

const isCloudflareChallenge = (snapshot) => {
  const text = `${snapshot.title} ${snapshot.text}`.toLowerCase();
  return /just a moment|un instant|verify you are human|verification|cloudflare/.test(text);
};

const waitForBetrailPage = async (client, timeoutMs, { allowCalendar = false } = {}) => {
  const deadline = Date.now() + timeoutMs;
  let announcedChallenge = false;

  while (Date.now() < deadline) {
    const snapshot = await client.evaluate(pageSnapshotExpression);
    const validHost = /(^|\.)betrail\.run$/i.test(new URL(snapshot.url).hostname);
    const expectedPage = allowCalendar || /\/race\//i.test(new URL(snapshot.url).pathname);

    if (isCloudflareChallenge(snapshot)) {
      if (!announcedChallenge) {
        console.error("Controle Cloudflare detecte : validez-le dans la fenetre Chrome ouverte.");
        announcedChallenge = true;
      }
    } else if (validHost && expectedPage && snapshot.readyState === "complete" && snapshot.text.length > 50) {
      return snapshot;
    }

    await sleep(500);
  }

  throw new Error("La page BeTrail n'est pas devenue accessible avant l'expiration du delai manuel.");
};

const collectRaceLinks = async (client, limit, completedUrls) => {
  const links = new Set();
  let stagnantRounds = 0;

  for (let round = 0; round < 300 && stagnantRounds < 12; round += 1) {
    const found = await client.evaluate(`(() => {
      const attributeLinks = [...document.querySelectorAll('a[href], [routerlink], [data-href], [data-url]')]
        .flatMap((element) => ['href', 'routerlink', 'data-href', 'data-url'].map((name) => element.getAttribute(name)))
        .filter(Boolean)
        .map((href) => { try { return new URL(href, location.href).href; } catch { return ''; } });
      const markupLinks = [...document.documentElement.outerHTML.matchAll(/["'](\\/race\\/[^"'?#<\\s]+)/gi)]
        .map((match) => new URL(match[1].replace(/&amp;/g, '&'), location.origin).href);
      const links = [...attributeLinks, ...markupLinks]
        .filter((href) => {
          try {
            const url = new URL(href);
            return /(^|\\.)betrail\\.run$/i.test(url.hostname) && /\\/race\\//i.test(url.pathname);
          } catch { return false; }
        });

      const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
      const more = [...document.querySelectorAll('button, a[role="button"]')].find((element) =>
        /voir plus|charger plus|plus de|load more|show more/.test(normalize(element.innerText))
      );
      if (more) more.click();
      for (const element of document.querySelectorAll('*')) {
        if (element.scrollHeight > element.clientHeight + 100) element.scrollTop = element.scrollHeight;
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      return links;
    })()`);

    const previousSize = links.size;
    for (const href of found) links.add(canonicalizeRaceUrl(href));
    links.delete("");
    stagnantRounds = links.size === previousSize ? stagnantRounds + 1 : 0;
    const newCount = [...links].filter((href) => !completedUrls.has(href)).length;
    console.error(`Nouvelles courses trouvees : ${Math.min(newCount, limit)}/${limit} (${links.size} examinees)`);
    if (newCount >= limit) break;
    await sleep(1_000);
  }

  return {
    allLinks: [...links],
    newLinks: [...links].filter((href) => !completedUrls.has(href)).slice(0, limit),
  };
};

const navigate = async (client, url) => {
  await client.send("Page.navigate", { url });
  await sleep(500);
};

const contactProbeExpression = `(() => {
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const emailPattern = /[a-z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;
  const emailsFrom = (value) => String(value || '').match(emailPattern) || [];
  const allActions = [...document.querySelectorAll('a, button, [role="button"]')];
  const contacts = allActions.filter((element) => {
    const text = normalize(element.innerText || element.getAttribute('aria-label') || element.title);
    return text.includes('contact') && (text.includes('organi') || text.includes('course'));
  });
  const contactEmails = contacts.flatMap((element) => [
    ...emailsFrom(element.getAttribute('href')),
    ...emailsFrom(element.innerText),
    ...emailsFrom(element.getAttribute('aria-label')),
  ]);
  const existingMailtos = [...document.querySelectorAll('a[href^="mailto:"]')].flatMap((element) =>
    emailsFrom(decodeURIComponent(element.getAttribute('href')))
  );
  const organizationHeading = [...document.querySelectorAll('h1, h2, h3, h4, dt, strong')].find((element) =>
    normalize(element.innerText).includes('organisation')
  );
  const organizationContainer = organizationHeading?.closest('section, article, li, div');
  const organization = organizationContainer?.innerText?.replace(/\\s+/g, ' ').trim().slice(0, 500) || '';

  for (const contact of contacts) {
    const href = contact.getAttribute('href') || '';
    if (!href.toLowerCase().startsWith('mailto:')) contact.click();
  }

  return {
    raceName: document.querySelector('h1')?.innerText?.trim() || document.title.split('|')[0].trim(),
    date: document.querySelector('time[datetime]')?.getAttribute('datetime') || document.querySelector('time')?.innerText?.trim() || '',
    organization,
    contactEmails,
    existingMailtos,
    contactCount: contacts.length,
  };
})()`;

const revealProbeExpression = `(() => {
  const emailPattern = /[a-z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;
  const emailsFrom = (value) => String(value || '').match(emailPattern) || [];
  const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, .modal, [class*="modal"], [class*="dialog"]')]
    .filter((element) => element.getClientRects().length > 0);
  return {
    mailtos: [...document.querySelectorAll('a[href^="mailto:"]')].flatMap((element) =>
      emailsFrom(decodeURIComponent(element.getAttribute('href')))
    ),
    dialogEmails: dialogs.flatMap((element) => emailsFrom(element.innerText)),
    bodyEmails: emailsFrom(document.body?.innerText),
  };
})()`;

const scrapeRace = async (client, raceUrl, manualTimeoutMs) => {
  await navigate(client, raceUrl);
  await waitForBetrailPage(client, manualTimeoutMs);
  const before = await client.evaluate(contactProbeExpression);
  await sleep(1_200);
  const after = await client.evaluate(revealProbeExpression);

  const preferred = [
    ...before.contactEmails,
    ...after.dialogEmails,
    ...after.mailtos.filter((email) => !before.existingMailtos.includes(email)),
  ];
  const fallback = before.contactCount > 0 ? after.mailtos : [];
  const emails = extractEmailAddresses([...preferred, ...fallback].join(" "));

  return {
    raceName: before.raceName,
    date: before.date,
    organizer: before.organization,
    emails,
    raceUrl,
    status: emails.length > 0 ? "email_found" : before.contactCount > 0 ? "contact_without_email" : "contact_not_found",
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const chromePath = findChrome(args.chromePath);
  const port = await reservePort();
  const profilePath = path.resolve(process.cwd(), "tmp", "betrail-chrome-profile");
  const outputPath = path.resolve(process.cwd(), args.output);
  const statePath = path.resolve(process.cwd(), args.state);
  const records = await loadPreviousRecords(statePath, outputPath);
  const completedUrls = new Set(
    records.filter(isCompletedRecord).map((record) => canonicalizeRaceUrl(record.raceUrl)).filter(Boolean),
  );
  await persistRecords(records, statePath, outputPath);
  console.error(`Historique charge : ${completedUrls.size} course(s) deja traitee(s).`);
  await mkdir(profilePath, { recursive: true });

  console.error("Ouverture de Chrome pour BeTrail...");
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profilePath}`,
      "--no-first-run",
      "--disable-default-apps",
      args.calendarUrl,
    ],
    { stdio: "ignore" },
  );

  let client;
  try {
    const target = await waitForTarget(port);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await waitForBetrailPage(client, args.manualTimeoutMs, { allowCalendar: true });
    const { allLinks, newLinks: raceLinks } = await collectRaceLinks(client, args.limit, completedUrls);
    if (allLinks.length === 0) {
      const diagnostic = await client.evaluate(`(() => ({
        title: document.title,
        textStart: (document.body?.innerText || '').replace(/\\s+/g, ' ').slice(0, 500),
        textEnd: (document.body?.innerText || '').replace(/\\s+/g, ' ').slice(-1000),
        linkCount: document.querySelectorAll('a[href]').length,
        links: [...document.querySelectorAll('a[href]')].slice(-30).map((anchor) => anchor.href),
        resources: performance.getEntriesByType('resource').map((entry) => entry.name)
          .filter((url) => /api|calendar|race|event/i.test(url)).slice(-30),
      }))()`);
      throw new Error(`Aucun lien de course n'a ete trouve. Diagnostic : ${JSON.stringify(diagnostic)}`);
    }

    if (raceLinks.length === 0) {
      console.error("Aucune nouvelle course : toutes les courses chargees figurent deja dans l'historique.");
      return;
    }

    let newEmailsFound = 0;
    for (const [index, raceUrl] of raceLinks.entries()) {
      console.error(`[${index + 1}/${raceLinks.length}] ${raceUrl}`);
      try {
        const record = await scrapeRace(client, raceUrl, args.manualTimeoutMs);
        upsertRecord(records, record);
        if (record.emails.length > 0) newEmailsFound += 1;
      } catch (error) {
        upsertRecord(records, {
          raceName: "",
          date: "",
          organizer: "",
          emails: [],
          raceUrl,
          status: `error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      await persistRecords(records, statePath, outputPath);
      if (index < raceLinks.length - 1) await sleep(args.delayMs);
    }

    const found = records.filter((record) => record.emails.length > 0).length;
    console.error(
      `Termine : ${raceLinks.length} nouvelle(s) course(s), ${newEmailsFound} avec e-mail. Total CSV : ${found}/${records.length}.`,
    );
    console.error(`CSV : ${outputPath}`);
    console.error(`Historique anti-doublon : ${statePath}`);
  } finally {
    client?.close();
    chrome.kill();
  }
};

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
