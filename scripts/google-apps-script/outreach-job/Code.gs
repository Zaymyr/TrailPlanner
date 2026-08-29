const OUTREACH_JOB = Object.freeze({
  spreadsheetId: '1fMluPd-tnRqwe6b152YjfFx3L8ugPH8F7qiApOeMPMY',
  prospectsSheet: 'Prospects',
  settingsSheet: 'Paramètres envoi',
  templateSheet: 'Template email',
  historySheet: 'Historique envois',
  triggerFunction: 'runOutreachJob',
  historyHeaders: [
    'created_at',
    'run_date',
    'uuid',
    'email',
    'organization_name',
    'event_date',
    'status',
    'gmail_draft_id',
    'details',
  ],
});

const SCRAPER_WEBHOOK = Object.freeze({
  tokenProperty: 'BETRAIL_SCRAPER_WEBHOOK_TOKEN',
  maxRecordsPerRequest: 100,
  schemaVersion: 2,
});

const GMAIL_RECONCILIATION = Object.freeze({
  cursorProperty: 'OUTREACH_RECONCILIATION_CURSOR',
  lastRunProperty: 'OUTREACH_RECONCILIATION_LAST_RUN',
  defaultBatchSize: 20,
  defaultIntervalMinutes: 5,
  maxBatchSize: 100,
});

/**
 * Generates the secret expected by the BeTrail scraper webhook.
 * Run manually, then copy the returned value into the local environment variable
 * BETRAIL_SHEET_WEBHOOK_TOKEN. Running it again revokes the previous token.
 */
function createScraperWebhookToken() {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(SCRAPER_WEBHOOK.tokenProperty, token);
  console.log('BETRAIL_SHEET_WEBHOOK_TOKEN=' + token);
  return token;
}

/** Receives idempotent BeTrail prospect batches from the local Node scraper. */
function doPost(event) {
  try {
    const payload = JSON.parse(event && event.postData ? event.postData.contents : '{}');
    const expectedToken = PropertiesService.getScriptProperties().getProperty(SCRAPER_WEBHOOK.tokenProperty);
    if (!expectedToken || !constantTimeEquals_(String(payload.token || ''), expectedToken)) {
      return jsonResponse_({ ok: false, error: 'unauthorized' });
    }
    if (Number(payload.schemaVersion) !== SCRAPER_WEBHOOK.schemaVersion) {
      return jsonResponse_({ ok: false, error: 'unsupported_schema', schemaVersion: SCRAPER_WEBHOOK.schemaVersion });
    }
    if (!Array.isArray(payload.records) || payload.records.length === 0) {
      return jsonResponse_({ ok: false, error: 'records_required' });
    }
    if (payload.records.length > SCRAPER_WEBHOOK.maxRecordsPerRequest) {
      return jsonResponse_({ ok: false, error: 'too_many_records' });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return jsonResponse_({ ok: false, error: 'locked' });
    try {
      const result = upsertScrapedProspects_(payload.records);
      return jsonResponse_({
        ok: true,
        schemaVersion: SCRAPER_WEBHOOK.schemaVersion,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Installs a one-minute Apps Script trigger. The job only creates Gmail drafts.
 * Run this function manually once from the Apps Script editor to grant access.
 */
function installOutreachJob() {
  removeOutreachTriggers_();
  ensureHistorySheet_();
  ScriptApp.newTrigger(OUTREACH_JOB.triggerFunction)
    .timeBased()
    .everyMinutes(1)
    .create();
  updateTemplateStatus_('Installé — brouillons uniquement');
  return 'Job installé : vérification toutes les minutes, brouillons uniquement.';
}

/** Removes only the triggers owned by this outreach job. */
function uninstallOutreachJob() {
  removeOutreachTriggers_();
  updateTemplateStatus_('Non installé');
  return 'Job désinstallé.';
}

/**
 * Trigger entry point. It creates at most one draft per invocation and never
 * calls Gmail send methods.
 */
function runOutreachJob() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { status: 'SKIPPED_LOCKED' };

  try {
    const spreadsheet = SpreadsheetApp.openById(OUTREACH_JOB.spreadsheetId);
    const settings = readKeyValueSheet_(spreadsheet, OUTREACH_JOB.settingsSheet);
    const template = readKeyValueSheet_(spreadsheet, OUTREACH_JOB.templateSheet);
    const timezone = String(settings.fuseau_horaire || 'Europe/Paris');
    const now = new Date();
    const historySheet = ensureHistorySheet_(spreadsheet);
    const reconciliation = reconcileGmailActivity_(spreadsheet, historySheet, settings, now, timezone);

    if (!asBoolean_(settings.activation_envoi)) {
      return { status: 'SKIPPED_DISABLED', reconciliation: reconciliation };
    }
    if (normalize_(template.mode_envoi) !== 'brouillons') {
      throw new Error('Mode refusé : ce job accepte uniquement « Brouillons ».');
    }
    if (!isAllowedDay_(settings, now, timezone)) {
      return { status: 'SKIPPED_DAY' };
    }

    const currentMinute = Number(Utilities.formatDate(now, timezone, 'H')) * 60
      + Number(Utilities.formatDate(now, timezone, 'm'));
    const startMinute = timeToMinutes_(settings.heure_debut_envoi);
    if (currentMinute < startMinute) {
      return { status: 'SKIPPED_BEFORE_START' };
    }

    const history = readHistory_(historySheet);
    const dateKey = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
    const dailyLimit = positiveInteger_(settings.limite_quotidienne, 150);
    const createdToday = history.rows.filter(function (row) {
      return row.runDate === dateKey && ['BROUILLON_CREE', 'RELANCE_BROUILLON_CREE'].indexOf(row.status) !== -1;
    }).length;

    if (createdToday >= dailyLimit) {
      return { status: 'SKIPPED_DAILY_LIMIT', createdToday: createdToday };
    }

    const delayMinutes = positiveInteger_(settings.delai_entre_envois_minutes, 1);
    const lastDraftAt = history.rows.reduce(function (latest, row) {
      if (['BROUILLON_CREE', 'RELANCE_BROUILLON_CREE'].indexOf(row.status) === -1 || !(row.createdAt instanceof Date)) return latest;
      return !latest || row.createdAt > latest ? row.createdAt : latest;
    }, null);
    if (lastDraftAt && now.getTime() - lastDraftAt.getTime() < delayMinutes * 60000) {
      return { status: 'SKIPPED_DELAY' };
    }

    const followupProspect = asBoolean_(settings.activation_relance)
      ? findNextFollowupProspect_(spreadsheet, history.followupUuids, now, positiveInteger_(settings.delai_relance_jours, 10))
      : null;
    if (followupProspect) {
      const followupActivity = inspectGmailActivity_(followupProspect.email);
      syncProspectActivity_(requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet), followupProspect, followupActivity);
      if (followupActivity.repliedAt && followupActivity.repliedAt > followupProspect.lastSentAt) {
        appendHistory_(historySheet, now, dateKey, followupProspect, 'REPONSE_RECUE', '', 'Réponse détectée avant relance');
        return { status: 'REPONSE_RECUE', email: followupProspect.email, reconciliation: reconciliation };
      }
      if (!followupActivity.sentMessage) {
        return { status: 'RELANCE_IGNORE_SANS_FIL', email: followupProspect.email, reconciliation: reconciliation };
      }

      const followupBody = replaceOrganizationName_(String(template.corps_relance || ''), followupProspect.organizationName || '');
      if (!followupBody.trim()) throw new Error('Template email : corps_relance est obligatoire quand les relances sont activées.');
      const sender = String(template.expediteur || Session.getEffectiveUser().getEmail()).trim();
      const signatureHtml = getGmailSignature_(sender);
      const htmlBody = markdownBodyToHtml_(followupBody) + signatureHtml;
      const plainBody = stripMarkdown_(followupBody) + stripHtml_(signatureHtml);
      const draft = createThreadedFollowupDraft_(followupActivity.sentMessage, followupProspect.email, sender, plainBody, htmlBody);
      appendHistory_(historySheet, now, dateKey, followupProspect, 'RELANCE_BROUILLON_CREE', draft.id, 'Brouillon de relance créé dans le fil Gmail');
      return {
        status: 'RELANCE_BROUILLON_CREE',
        email: followupProspect.email,
        draftId: draft.id,
        createdToday: createdToday + 1,
        reconciliation: reconciliation,
      };
    }

    const prospect = findNextProspect_(spreadsheet, history.terminalUuids);
    if (!prospect) return { status: 'SKIPPED_EMPTY_QUEUE' };

    const gmailActivity = inspectGmailActivity_(prospect.email);
    const gmailState = gmailActivity.sentAt ? 'IGNORE_DEJA_CONTACTE' : gmailActivity.repliedAt ? 'IGNORE_REPONSE_RECUE' : 'CLEAR';
    if (gmailState !== 'CLEAR') {
      syncProspectActivity_(requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet), prospect, gmailActivity);
      appendHistory_(historySheet, now, dateKey, prospect, gmailState, '', 'Contrôle Gmail avant brouillon');
      return { status: gmailState, email: prospect.email, reconciliation: reconciliation };
    }

    const organizationName = prospect.organizationName || '';
    const subject = replaceOrganizationName_(String(template.objet || ''), organizationName);
    const templatedBody = replaceOrganizationName_(String(template.corps_email || ''), organizationName);
    const sender = String(template.expediteur || Session.getEffectiveUser().getEmail()).trim();
    const signatureHtml = getGmailSignature_(sender);
    const htmlBody = markdownBodyToHtml_(templatedBody) + signatureHtml;
    const plainBody = stripMarkdown_(templatedBody) + stripHtml_(signatureHtml);
    const options = { htmlBody: htmlBody };

    if (GmailApp.getAliases().indexOf(sender) !== -1) options.from = sender;
    const draft = GmailApp.createDraft(prospect.email, subject, plainBody, options);
    appendHistory_(historySheet, now, dateKey, prospect, 'BROUILLON_CREE', draft.getId(), 'Brouillon Gmail créé');

    return {
      status: 'BROUILLON_CREE',
      email: prospect.email,
      draftId: draft.getId(),
      createdToday: createdToday + 1,
      reconciliation: reconciliation,
    };
  } catch (error) {
    recordJobError_(error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function findNextProspect_(spreadsheet, terminalUuids) {
  const sheet = requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = headerIndex_(values[0]);
  [
    'uuid', 'email', 'Organization name', 'outreach_event_date',
    'outreach_selected_today', 'outreach_queue_rank', 'last_sent_email_at',
    'replied_at', 'hard_bounced_at', 'excluded', 'opted-out',
  ].forEach(function (header) {
    if (headers[header] === undefined) throw new Error('Colonne Prospects manquante : ' + header);
  });

  return values.slice(1).map(function (row, offset) {
    return {
      rowNumber: offset + 2,
      uuid: String(row[headers.uuid] || '').trim(),
      email: String(row[headers.email] || '').trim(),
      organizationName: String(row[headers['Organization name']] || '').trim(),
      eventDate: row[headers.outreach_event_date] || '',
      selected: asBoolean_(row[headers.outreach_selected_today]),
      rank: Number(row[headers.outreach_queue_rank] || Number.MAX_SAFE_INTEGER),
      lastSentAt: row[headers.last_sent_email_at],
      repliedAt: row[headers.replied_at],
      hardBouncedAt: row[headers.hard_bounced_at],
      excluded: asBoolean_(row[headers.excluded]),
      optedOut: asBoolean_(row[headers['opted-out']]),
    };
  }).filter(function (prospect) {
    return prospect.selected
      && prospect.uuid
      && prospect.email
      && !terminalUuids[prospect.uuid]
      && !prospect.lastSentAt
      && !prospect.repliedAt
      && !prospect.hardBouncedAt
      && !prospect.excluded
      && !prospect.optedOut;
  }).sort(function (a, b) {
    return a.rank - b.rank || a.rowNumber - b.rowNumber;
  })[0] || null;
}

function inspectGmailActivity_(email) {
  const safeEmail = String(email).replace(/[^A-Za-z0-9@._+\-]/g, '');
  if (!safeEmail) return { sentAt: null, repliedAt: null, sentMessage: null };
  const sentMessage = findLatestGmailMessage_('in:sent to:(' + safeEmail + ')', function (message) {
    return headerIncludesEmail_(message.getTo(), safeEmail)
      || headerIncludesEmail_(message.getCc(), safeEmail)
      || headerIncludesEmail_(message.getBcc(), safeEmail);
  });
  const replyMessage = findLatestGmailMessage_('from:(' + safeEmail + ') -in:sent', function (message) {
    return headerIncludesEmail_(message.getFrom(), safeEmail);
  });
  return {
    sentAt: sentMessage ? sentMessage.getDate() : null,
    repliedAt: replyMessage ? replyMessage.getDate() : null,
    sentMessage: sentMessage,
  };
}

function findLatestGmailMessage_(query, predicate) {
  return GmailApp.search(query, 0, 10).reduce(function (latest, thread) {
    return thread.getMessages().reduce(function (current, message) {
      if (message.isDraft() || (predicate && !predicate(message))) return current;
      return !current || message.getDate() > current.getDate() ? message : current;
    }, latest);
  }, null);
}

function headerIncludesEmail_(value, email) {
  const expected = normalize_(email);
  return (String(value || '').match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi) || []).some(function (candidate) {
    return normalize_(candidate) === expected;
  });
}

function createThreadedFollowupDraft_(sentMessage, recipient, sender, plainBody, htmlBody) {
  const message = Gmail.Users.Messages.get('me', sentMessage.getId(), {
    format: 'metadata',
    metadataHeaders: ['Message-ID', 'References', 'Subject'],
  });
  const headers = message && message.payload && message.payload.headers ? message.payload.headers : [];
  const messageId = gmailHeaderValue_(headers, 'Message-ID');
  const subject = gmailHeaderValue_(headers, 'Subject') || sentMessage.getSubject();
  if (!messageId) throw new Error('Impossible de créer la relance : en-tête Message-ID Gmail manquant.');
  const references = [gmailHeaderValue_(headers, 'References'), messageId].filter(Boolean).join(' ');
  const raw = buildThreadedDraftRaw_({
    recipient: recipient,
    sender: sender,
    subject: subject,
    messageId: messageId,
    references: references,
    plainBody: plainBody,
    htmlBody: htmlBody,
  });
  return Gmail.Users.Drafts.create({
    message: {
      threadId: message.threadId || sentMessage.getThread().getId(),
      raw: Utilities.base64EncodeWebSafe(raw, Utilities.Charset.UTF_8).replace(/=+$/, ''),
    },
  }, 'me');
}

function gmailHeaderValue_(headers, name) {
  const expected = normalize_(name);
  const header = (headers || []).find(function (candidate) {
    return normalize_(candidate && candidate.name) === expected;
  });
  return header ? String(header.value || '').replace(/[\r\n]+/g, ' ').trim() : '';
}

function buildThreadedDraftRaw_(input) {
  const boundary = 'pace_yourself_' + Utilities.getUuid().replace(/-/g, '');
  return [
    'To: ' + String(input.recipient || '').replace(/[\r\n]+/g, ''),
    'From: ' + String(input.sender || '').replace(/[\r\n]+/g, ''),
    'Subject: ' + encodeMimeHeader_(String(input.subject || '').replace(/[\r\n]+/g, ' ')),
    'In-Reply-To: ' + String(input.messageId || '').replace(/[\r\n]+/g, ' '),
    'References: ' + String(input.references || '').replace(/[\r\n]+/g, ' '),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(input.plainBody || ''),
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(input.htmlBody || ''),
    '',
    '--' + boundary + '--',
  ].join('\r\n');
}

function encodeMimeHeader_(value) {
  const text = String(value || '');
  return /[^\x20-\x7E]/.test(text)
    ? '=?UTF-8?B?' + Utilities.base64Encode(text, Utilities.Charset.UTF_8) + '?='
    : text;
}

function reconcileGmailActivity_(spreadsheet, historySheet, settings, now, timezone) {
  const properties = PropertiesService.getScriptProperties();
  const intervalMinutes = positiveInteger_(settings.intervalle_reconciliation_minutes, GMAIL_RECONCILIATION.defaultIntervalMinutes);
  const lastRunAt = asDate_(properties.getProperty(GMAIL_RECONCILIATION.lastRunProperty));
  if (lastRunAt && now.getTime() - lastRunAt.getTime() < intervalMinutes * 60000) {
    return { checked: 0, sentUpdated: 0, repliesUpdated: 0, skipped: 'interval' };
  }

  const history = readHistory_(historySheet);
  const prospectsSheet = requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet);
  const values = prospectsSheet.getDataRange().getValues();
  if (values.length < 2) return { checked: 0, sentUpdated: 0, repliesUpdated: 0 };

  const headers = headerIndex_(values[0]);
  ['uuid', 'email', 'Organization name', 'outreach_event_date', 'last_sent_email_at', 'replied_at'].forEach(function (header) {
    if (headers[header] === undefined) throw new Error('Colonne Prospects manquante : ' + header);
  });

  const candidates = values.slice(1).map(function (row, offset) {
    return {
      rowNumber: offset + 2,
      uuid: String(row[headers.uuid] || '').trim(),
      email: String(row[headers.email] || '').trim(),
      organizationName: String(row[headers['Organization name']] || '').trim(),
      eventDate: row[headers.outreach_event_date] || '',
      lastSentAt: asDate_(row[headers.last_sent_email_at]),
      repliedAt: asDate_(row[headers.replied_at]),
    };
  }).filter(function (prospect) {
    return prospect.uuid && prospect.email && (history.draftUuids[prospect.uuid] || prospect.lastSentAt);
  });

  if (candidates.length === 0) return { checked: 0, sentUpdated: 0, repliesUpdated: 0 };
  const start = Math.max(0, Number(properties.getProperty(GMAIL_RECONCILIATION.cursorProperty)) || 0) % candidates.length;
  const requestedBatchSize = positiveInteger_(settings.limite_reconciliation_par_execution, GMAIL_RECONCILIATION.defaultBatchSize);
  const batchSize = Math.min(requestedBatchSize, GMAIL_RECONCILIATION.maxBatchSize, candidates.length);
  const result = { checked: 0, sentUpdated: 0, repliesUpdated: 0 };
  const dateKey = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');

  for (let offset = 0; offset < batchSize; offset += 1) {
    const prospect = candidates[(start + offset) % candidates.length];
    const activity = inspectGmailActivity_(prospect.email);
    const changes = syncProspectActivity_(prospectsSheet, prospect, activity);
    result.checked += 1;
    if (changes.sentUpdated) {
      result.sentUpdated += 1;
      const latestDraft = history.latestDraftByUuid[prospect.uuid];
      const status = latestDraft && latestDraft.status === 'RELANCE_BROUILLON_CREE'
        && activity.sentAt >= latestDraft.createdAt ? 'RELANCE_ENVOYEE' : 'ENVOI_CONFIRME';
      appendHistory_(historySheet, now, dateKey, prospect, status, '', 'Activité Gmail synchronisée vers Prospects');
    }
    if (changes.replyUpdated) {
      result.repliesUpdated += 1;
      appendHistory_(historySheet, now, dateKey, prospect, 'REPONSE_RECUE', '', 'Réponse Gmail synchronisée vers Prospects');
    }
  }

  properties.setProperty(GMAIL_RECONCILIATION.cursorProperty, String((start + batchSize) % candidates.length));
  properties.setProperty(GMAIL_RECONCILIATION.lastRunProperty, now.toISOString());
  SpreadsheetApp.flush();
  return result;
}

function syncProspectActivity_(sheet, prospect, activity) {
  const headers = headerIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const sentAt = asDate_(activity.sentAt);
  const repliedAt = asDate_(activity.repliedAt);
  const currentSentAt = asDate_(prospect.lastSentAt);
  const currentRepliedAt = asDate_(prospect.repliedAt);
  const sentUpdated = Boolean(sentAt && (!currentSentAt || sentAt > currentSentAt));
  const replyUpdated = Boolean(repliedAt && (!currentRepliedAt || repliedAt > currentRepliedAt)
    && (!sentAt || repliedAt > (currentSentAt || sentAt)));

  if (sentUpdated) {
    sheet.getRange(prospect.rowNumber, headers.last_sent_email_at + 1).setValue(sentAt).setNumberFormat('yyyy-mm-dd hh:mm');
    prospect.lastSentAt = sentAt;
  }
  if (replyUpdated) {
    sheet.getRange(prospect.rowNumber, headers.replied_at + 1).setValue(repliedAt).setNumberFormat('yyyy-mm-dd hh:mm');
    prospect.repliedAt = repliedAt;
  }
  return { sentUpdated: sentUpdated, replyUpdated: replyUpdated };
}

function findNextFollowupProspect_(spreadsheet, followupUuids, now, delayBusinessDays) {
  const sheet = requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = headerIndex_(values[0]);
  [
    'uuid', 'email', 'Organization name', 'outreach_event_date', 'last_sent_email_at',
    'replied_at', 'hard_bounced_at', 'excluded', 'opted-out',
  ].forEach(function (header) {
    if (headers[header] === undefined) throw new Error('Colonne Prospects manquante : ' + header);
  });

  return values.slice(1).map(function (row, offset) {
    return {
      rowNumber: offset + 2,
      uuid: String(row[headers.uuid] || '').trim(),
      email: String(row[headers.email] || '').trim(),
      organizationName: String(row[headers['Organization name']] || '').trim(),
      eventDate: row[headers.outreach_event_date] || '',
      lastSentAt: asDate_(row[headers.last_sent_email_at]),
      repliedAt: asDate_(row[headers.replied_at]),
      hardBouncedAt: asDate_(row[headers.hard_bounced_at]),
      excluded: asBoolean_(row[headers.excluded]),
      optedOut: asBoolean_(row[headers['opted-out']]),
    };
  }).filter(function (prospect) {
    return isFollowupEligible_(prospect, followupUuids, now, delayBusinessDays);
  }).sort(function (a, b) {
    return a.lastSentAt - b.lastSentAt || a.rowNumber - b.rowNumber;
  })[0] || null;
}

function addBusinessDays_(value, businessDays) {
  const date = new Date(value.getTime());
  let remaining = positiveInteger_(businessDays, 10);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

function isFollowupEligible_(prospect, followupUuids, now, delayBusinessDays) {
  return Boolean(prospect.uuid
    && prospect.email
    && prospect.organizationName
    && prospect.lastSentAt
    && now.getTime() >= addBusinessDays_(prospect.lastSentAt, delayBusinessDays).getTime()
    && !prospect.repliedAt
    && !prospect.hardBouncedAt
    && !prospect.excluded
    && !prospect.optedOut
    && !followupUuids[prospect.uuid]);
}

function asDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ensureHistorySheet_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.openById(OUTREACH_JOB.spreadsheetId);
  let sheet = ss.getSheetByName(OUTREACH_JOB.historySheet);
  if (!sheet) sheet = ss.insertSheet(OUTREACH_JOB.historySheet);

  const headerRange = sheet.getRange(1, 1, 1, OUTREACH_JOB.historyHeaders.length);
  const currentHeaders = headerRange.getValues()[0];
  if (currentHeaders.join('|') !== OUTREACH_JOB.historyHeaders.join('|')) {
    if (sheet.getLastRow() > 1) throw new Error('En-têtes Historique envois incompatibles.');
    headerRange.setValues([OUTREACH_JOB.historyHeaders]);
    headerRange.setFontWeight('bold').setBackground('#e5e5e5').setWrap(true);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readHistory_(sheet) {
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).map(function (row) {
    return {
      createdAt: row[0],
      runDate: String(row[1] || ''),
      uuid: String(row[2] || ''),
      email: String(row[3] || ''),
      status: String(row[6] || ''),
    };
  });
  const terminalUuids = {};
  const draftUuids = {};
  const followupUuids = {};
  const latestDraftByUuid = {};
  rows.forEach(function (row) {
    if (row.uuid && ['BROUILLON_CREE', 'IGNORE_DEJA_CONTACTE', 'IGNORE_REPONSE_RECUE'].indexOf(row.status) !== -1) {
      terminalUuids[row.uuid] = true;
    }
    if (row.uuid && ['BROUILLON_CREE', 'RELANCE_BROUILLON_CREE'].indexOf(row.status) !== -1) {
      draftUuids[row.uuid] = true;
      if (!latestDraftByUuid[row.uuid] || row.createdAt > latestDraftByUuid[row.uuid].createdAt) latestDraftByUuid[row.uuid] = row;
    }
    if (row.uuid && ['RELANCE_BROUILLON_CREE', 'RELANCE_ENVOYEE'].indexOf(row.status) !== -1) followupUuids[row.uuid] = true;
  });
  return {
    rows: rows,
    terminalUuids: terminalUuids,
    draftUuids: draftUuids,
    followupUuids: followupUuids,
    latestDraftByUuid: latestDraftByUuid,
  };
}

function appendHistory_(sheet, now, dateKey, prospect, status, draftId, details) {
  sheet.appendRow([
    now,
    dateKey,
    prospect.uuid,
    prospect.email,
    prospect.organizationName,
    prospect.eventDate,
    status,
    draftId,
    details,
  ]);
}

function readKeyValueSheet_(spreadsheet, sheetName) {
  const values = requiredSheet_(spreadsheet, sheetName).getDataRange().getValues();
  return values.reduce(function (result, row) {
    const key = String(row[0] || '').trim();
    if (key) result[key] = row[1];
    return result;
  }, {});
}

function isAllowedDay_(settings, now, timezone) {
  const day = Number(Utilities.formatDate(now, timezone, 'u'));
  const keys = [null, 'envoi_lundi', 'envoi_mardi', 'envoi_mercredi', 'envoi_jeudi', 'envoi_vendredi', 'envoi_samedi', 'envoi_dimanche'];
  return asBoolean_(settings[keys[day]]);
}

function timeToMinutes_(value) {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
  const match = String(value || '09:00').match(/^(\d{1,2}):(\d{2})/);
  if (!match) throw new Error('heure_debut_envoi doit être une heure valide.');
  return Number(match[1]) * 60 + Number(match[2]);
}

function getGmailSignature_(sender) {
  try {
    const sendAs = Gmail.Users.Settings.SendAs.get('me', sender);
    return sendAs && sendAs.signature ? '<br><br>' + sanitizeSignatureHtml_(sendAs.signature) : '';
  } catch (error) {
    console.warn('Signature Gmail non récupérée : ' + error.message);
    return '';
  }
}

function sanitizeSignatureHtml_(value) {
  return String(value || '')
    .replace(/\uFFFD+(?:\s|&nbsp;)*(?=<a[^>]+href=["']tel:)/gi, '&#128197;&nbsp;')
    .replace(/\uFFFD+(?:\s|&nbsp;)*(?=<a[^>]+href=["']https?:\/\/(?:www\.)?pace-yourself\.com)/gi, '&#127760;&nbsp;')
    .replace(/\uFFFD+(?:\s|&nbsp;)*(?=<a[^>]+href=["']https?:\/\/(?:www\.)?linkedin\.com)/gi, '&#128188;&nbsp;')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function (pair) {
      const high = pair.charCodeAt(0);
      const low = pair.charCodeAt(1);
      return '&#' + ((high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000) + ';';
    });
}

function replaceOrganizationName_(value, organizationName) {
  return String(value).replace(/\{\{\s*organization_name(?:\s*\|\s*default:\s*''\s*)?\s*\}\}/g, organizationName || '');
}

function markdownBodyToHtml_(value) {
  const escaped = escapeHtml_(String(value));
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function stripMarkdown_(value) {
  return String(value).replace(/\*\*(.+?)\*\*/g, '$1');
}

function stripHtml_(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function headerIndex_(headers) {
  return headers.reduce(function (result, header, index) {
    result[String(header)] = index;
    return result;
  }, {});
}

function requiredSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('Onglet manquant : ' + name);
  return sheet;
}

function positiveInteger_(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function asBoolean_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'vrai';
}

function normalize_(value) {
  return String(value || '').trim().toLowerCase();
}

function upsertScrapedProspects_(records) {
  const spreadsheet = SpreadsheetApp.openById(OUTREACH_JOB.spreadsheetId);
  const sheet = requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Prospects doit contenir une ligne modèle.');

  const headers = headerIndex_(values[0]);
  [
    'uuid', 'email', 'Organization name', 'Organization website', 'outreach_event_date',
    'event_week', 'outreach_planning_date', 'event_date_basis',
    'outreach_days_to_event', 'outreach_eligible', 'outreach_selected_today',
    'outreach_queue_rank', 'outreach_block_reason', 'last_sent_email_at', 'replied_at',
    'hard_bounced_at', 'excluded', 'opted-out',
  ].forEach(function (header) {
    if (headers[header] === undefined) throw new Error('Colonne Prospects manquante : ' + header);
  });

  normalizeQueueRankFormulas_(sheet);
  const emailRows = {};
  values.slice(1).forEach(function (row, offset) {
    const email = normalize_(row[headers.email]);
    if (email && emailRows[email] === undefined) emailRows[email] = offset + 2;
  });

  const result = { inserted: 0, updated: 0, skipped: 0 };
  records.forEach(function (record) {
    const emails = Array.isArray(record.emails) ? record.emails : [record.email];
    emails.map(normalize_).filter(Boolean).forEach(function (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        result.skipped += 1;
        return;
      }

      const organizationName = String(record.raceName || record.organizer || '').trim();
      const website = canonicalBetrailUrl_(record.raceUrl);
      const eventDate = parseIsoDate_(record.date);
      const eventWeek = parseEventWeek_(record.eventWeek);
      const eventDateBasis = String(record.eventDateBasis || '').trim().slice(0, 80);
      const existingRow = emailRows[email];
      if (existingRow) {
        let changed = false;
        const currentOrganization = sheet.getRange(existingRow, headers['Organization name'] + 1);
        const currentWebsite = sheet.getRange(existingRow, headers['Organization website'] + 1);
        const currentDate = sheet.getRange(existingRow, headers.outreach_event_date + 1);
        const currentWeek = sheet.getRange(existingRow, headers.event_week + 1);
        const currentBasis = sheet.getRange(existingRow, headers.event_date_basis + 1);
        if (!currentOrganization.getValue() && organizationName) {
          currentOrganization.setValue(organizationName);
          changed = true;
        }
        if (!currentWebsite.getValue() && website) {
          currentWebsite.setValue(website);
          changed = true;
        }
        if (!currentDate.getValue() && eventDate) {
          currentDate.setValue(eventDate).setNumberFormat('yyyy-mm-dd');
          changed = true;
        }
        if (!currentDate.getValue() && !currentWeek.getValue() && eventWeek) {
          currentWeek.setValue(eventWeek);
          if (eventDateBasis) currentBasis.setValue(eventDateBasis);
          changed = true;
        }
        if (changed) result.updated += 1;
        else result.skipped += 1;
        return;
      }

      const rowNumber = sheet.getLastRow() + 1;
      if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      const sourceRange = sheet.getRange(2, 1, 1, sheet.getLastColumn());
      const targetRange = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn());
      sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);

      const row = new Array(sheet.getLastColumn()).fill('');
      row[headers.uuid] = Utilities.getUuid();
      row[headers.email] = email;
      row[headers['Organization name']] = organizationName;
      row[headers['Organization website']] = website;
      row[headers.outreach_event_date] = eventDate || '';
      row[headers.excluded] = false;
      row[headers['opted-out']] = false;
      targetRange.setValues([row]);
      if (eventDate) sheet.getRange(rowNumber, headers.outreach_event_date + 1).setNumberFormat('yyyy-mm-dd');
      setOutreachFormulas_(sheet, rowNumber, headers);
      if (!eventDate && eventWeek) {
        sheet.getRange(rowNumber, headers.event_week + 1).setValue(eventWeek);
        if (eventDateBasis) sheet.getRange(rowNumber, headers.event_date_basis + 1).setValue(eventDateBasis);
      }

      emailRows[email] = rowNumber;
      result.inserted += 1;
    });
  });
  SpreadsheetApp.flush();
  return result;
}

function setOutreachFormulas_(sheet, rowNumber, headers) {
  const startColumn = headers.outreach_days_to_event + 1;
  const columnCount = headers.outreach_block_reason - headers.outreach_days_to_event + 1;
  sheet.getRange(2, startColumn, 1, columnCount).copyTo(
    sheet.getRange(rowNumber, startColumn, 1, columnCount),
    SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
    false,
  );

  const planningStartColumn = headers.event_week + 1;
  const planningColumnCount = headers.event_date_basis - headers.event_week + 1;
  sheet.getRange(2, planningStartColumn, 1, planningColumnCount).copyTo(
    sheet.getRange(rowNumber, planningStartColumn, 1, planningColumnCount),
    SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
    false,
  );
}

function normalizeQueueRankFormulas_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 13, lastRow - 1, 1);
  const formulas = range.getFormulas();
  let changed = false;
  formulas.forEach(function (formulaRow) {
    const normalized = String(formulaRow[0] || '')
      .replace(/\$K\$2:\$K\$\d+/g, '$K$2:$K')
      .replace(/\$U\$2:\$U\$\d+/g, '$U$2:$U');
    if (normalized !== formulaRow[0]) {
      formulaRow[0] = normalized;
      changed = true;
    }
  });
  if (changed) range.setFormulas(formulas);
}

function parseIsoDate_(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function parseEventWeek_(value) {
  const week = Number(value);
  return Number.isInteger(week) && week >= 1 && week <= 53 ? week : null;
}

function canonicalBetrailUrl_(value) {
  const url = String(value || '').trim();
  return /^https:\/\/(?:[^/]+\.)?betrail\.run\/race\//i.test(url) ? url.replace(/[?#].*$/, '').replace(/\/+$/, '') : '';
}

function constantTimeEquals_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function removeOutreachTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === OUTREACH_JOB.triggerFunction) ScriptApp.deleteTrigger(trigger);
  });
}

function updateTemplateStatus_(status) {
  const spreadsheet = SpreadsheetApp.openById(OUTREACH_JOB.spreadsheetId);
  const sheet = requiredSheet_(spreadsheet, OUTREACH_JOB.templateSheet);
  const values = sheet.getDataRange().getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === 'statut_job') {
      sheet.getRange(index + 1, 2).setValue(status);
      return;
    }
  }
}

function recordJobError_(error) {
  try {
    const sheet = ensureHistorySheet_();
    sheet.appendRow([new Date(), '', '', '', '', '', 'ERREUR_JOB', '', error && error.stack ? error.stack : String(error)]);
  } catch (historyError) {
    console.error(historyError);
  }
}
