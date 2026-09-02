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

const UNSUBSCRIBE = Object.freeze({
  secretProperty: 'OUTREACH_UNSUBSCRIBE_SECRET',
  defaultLabel: 'Je ne souhaite plus recevoir ces emails',
});

const FOLLOWUP_SEQUENCE = Object.freeze({
  defaultMaxAttempts: 3,
  absoluteMaxAttempts: 3,
  noResponseStatus: 'PROSPECT_SANS_REPONSE',
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
    if (event && event.parameter && event.parameter.action === 'unsubscribe') {
      return confirmUnsubscribe_(event.parameter);
    }
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

/** Displays a confirmation page before changing a prospect's opt-out state. */
function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  if (parameters.action !== 'unsubscribe') {
    return HtmlService.createHtmlOutput('Page introuvable.').setTitle('Pace Yourself');
  }

  const prospect = findProspectForUnsubscribe_(parameters.uuid, parameters.token);
  if (!prospect) {
    return HtmlService.createHtmlOutput('Ce lien de désinscription est invalide ou a expiré.').setTitle('Pace Yourself');
  }
  if (prospect.optedOut) {
    return HtmlService.createHtmlOutput('Cette adresse est déjà désinscrite.').setTitle('Pace Yourself');
  }

  const actionUrl = ScriptApp.getService().getUrl();
  const html = [
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Désinscription — Pace Yourself</title></head><body style="font-family:Arial,sans-serif;max-width:560px;margin:48px auto;padding:0 20px;color:#202124">',
    '<h1 style="font-size:24px">Confirmer la désinscription</h1>',
    '<p>Vous ne recevrez plus d’email de prospection Pace Yourself à cette adresse.</p>',
    '<form method="post" action="' + escapeHtml_(actionUrl) + '">',
    '<input type="hidden" name="action" value="unsubscribe">',
    '<input type="hidden" name="uuid" value="' + escapeHtml_(prospect.uuid) + '">',
    '<input type="hidden" name="token" value="' + escapeHtml_(parameters.token) + '">',
    '<button type="submit" style="background:#111827;color:white;border:0;border-radius:6px;padding:12px 18px;font-weight:600;cursor:pointer">Me désinscrire</button>',
    '</form></body></html>',
  ].join('');
  return HtmlService.createHtmlOutput(html).setTitle('Désinscription — Pace Yourself');
}

/**
 * Installs a one-minute Apps Script trigger. The template mode decides whether
 * the job keeps drafts for review or sends its tracked drafts automatically.
 * Run this function manually once from the Apps Script editor to grant access.
 */
function installOutreachJob() {
  removeOutreachTriggers_();
  ensureUnsubscribeSecret_();
  ensureHistorySheet_();
  ScriptApp.newTrigger(OUTREACH_JOB.triggerFunction)
    .timeBased()
    .everyMinutes(1)
    .create();
  updateTemplateStatus_('Installé — vérification toutes les minutes');
  return 'Job installé : vérification toutes les minutes.';
}

/** Removes only the triggers owned by this outreach job. */
function uninstallOutreachJob() {
  removeOutreachTriggers_();
  updateTemplateStatus_('Non installé');
  return 'Job désinstallé.';
}

/**
 * Trigger entry point. It processes at most one outreach message per invocation.
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
    const mode = outreachMode_(template.mode_envoi);
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
    const processedToday = history.rows.filter(function (row) {
      return row.runDate === dateKey && (mode === 'automatic' ? isAnySentStatus_(row.status) : isAnyDraftStatus_(row.status));
    }).length;

    if (processedToday >= dailyLimit) {
      return { status: 'SKIPPED_DAILY_LIMIT', processedToday: processedToday };
    }

    const delayMinutes = positiveInteger_(settings.delai_entre_envois_minutes, 1);
    const lastProcessedAt = history.rows.reduce(function (latest, row) {
      const relevant = mode === 'automatic' ? isAnySentStatus_(row.status) : isAnyDraftStatus_(row.status);
      if (!relevant || !(row.createdAt instanceof Date)) return latest;
      return !latest || row.createdAt > latest ? row.createdAt : latest;
    }, null);
    if (lastProcessedAt && now.getTime() - lastProcessedAt.getTime() < delayMinutes * 60000) {
      return { status: 'SKIPPED_DELAY' };
    }

    if (mode === 'automatic' && history.pendingDrafts.length > 0) {
      return processPendingDraft_(
        spreadsheet,
        historySheet,
        history.pendingDrafts[0],
        now,
        dateKey,
        reconciliation,
      );
    }

    const maxFollowupAttempts = Math.min(
      positiveInteger_(settings.nombre_max_relances, FOLLOWUP_SEQUENCE.defaultMaxAttempts),
      FOLLOWUP_SEQUENCE.absoluteMaxAttempts,
    );
    const followupAction = asBoolean_(settings.activation_relance)
      ? findNextFollowupAction_(
        spreadsheet,
        history.followupStatesByUuid,
        now,
        positiveInteger_(settings.delai_relance_jours, 10),
        maxFollowupAttempts,
      )
      : null;

    if (followupAction && followupAction.type === 'mark_no_response') {
      appendHistory_(
        historySheet,
        now,
        dateKey,
        followupAction.prospect,
        FOLLOWUP_SEQUENCE.noResponseStatus,
        '',
        'Aucune rÃ©ponse aprÃ¨s ' + maxFollowupAttempts + ' relances et le dÃ©lai final',
      );
      return {
        status: FOLLOWUP_SEQUENCE.noResponseStatus,
        email: followupAction.prospect.email,
        reconciliation: reconciliation,
      };
    }

    const followupProspect = followupAction && followupAction.type === 'draft'
      ? followupAction.prospect
      : null;
    if (followupProspect) {
      const followupActivity = inspectGmailActivity_(followupProspect.email);
      syncProspectActivity_(requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet), followupProspect, followupActivity);
      if (followupActivity.repliedAt && followupActivity.repliedAt > followupProspect.lastSentAt) {
        appendHistory_(historySheet, now, dateKey, followupProspect, 'REPONSE_RECUE', '', 'Réponse détectée avant relance');
        return { status: 'REPONSE_RECUE', email: followupProspect.email, reconciliation: reconciliation };
      }
      const followupAttempt = followupAction.attempt;
      const followupTemplateKey = followupTemplateKeyForAttempt_(followupAttempt, followupActivity.sentMessage);
      const followupBody = replaceOrganizationName_(String(template[followupTemplateKey] || ''), followupProspect.organizationName || '');
      if (!followupBody.trim()) {
        throw new Error('Template email : ' + followupTemplateKey + ' est obligatoire quand les relances sont activées.');
      }
      const sender = String(template.expediteur || Session.getEffectiveUser().getEmail()).trim();
      const signatureHtml = getGmailSignature_(sender);
      const followupContent = appendUnsubscribeFooter_(
        stripMarkdown_(followupBody) + stripHtml_(signatureHtml),
        markdownBodyToHtml_(followupBody) + signatureHtml,
        buildUnsubscribeUrl_(followupProspect),
        String(template.texte_desinscription || UNSUBSCRIBE.defaultLabel),
      );
      let draft;
      let details;
      if (followupActivity.sentMessage
        && subjectIncludesOrganization_(followupActivity.sentMessage.getSubject(), followupProspect.organizationName)) {
        draft = createThreadedFollowupDraft_(
          followupActivity.sentMessage,
          followupProspect.email,
          sender,
          followupContent.plainBody,
          followupContent.htmlBody,
        );
        details = 'Brouillon de relance créé dans le fil Gmail';
      } else {
        draft = createStandaloneFollowupDraft_(
          followupProspect.email,
          sender,
          followupSubject_(template, followupProspect.organizationName),
          followupContent.plainBody,
          followupContent.htmlBody,
        );
        details = followupActivity.sentMessage
          ? 'Brouillon de relance créé hors fil (objet Gmail initial non personnalisé)'
          : 'Brouillon de relance créé hors fil (envoi initial absent de Gmail)';
      }
      const followupDraftStatus = followupDraftStatus_(followupAttempt);
      appendHistory_(
        historySheet,
        now,
        dateKey,
        followupProspect,
        followupDraftStatus,
        draft.id,
        details + ' (relance ' + followupAttempt + '/' + maxFollowupAttempts + ')',
      );
      if (mode === 'automatic') {
        return sendTrackedDraft_(
          spreadsheet,
          historySheet,
          followupProspect,
          { draftId: draft.id, status: followupDraftStatus, followupAttempt: followupAttempt },
          now,
          dateKey,
          reconciliation,
        );
      }
      return {
        status: followupDraftStatus,
        email: followupProspect.email,
        draftId: draft.id,
        createdToday: processedToday + 1,
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
    const initialContent = appendUnsubscribeFooter_(
      stripMarkdown_(templatedBody) + stripHtml_(signatureHtml),
      markdownBodyToHtml_(templatedBody) + signatureHtml,
      buildUnsubscribeUrl_(prospect),
      String(template.texte_desinscription || UNSUBSCRIBE.defaultLabel),
    );
    const options = { htmlBody: initialContent.htmlBody };

    if (GmailApp.getAliases().indexOf(sender) !== -1) options.from = sender;
    const draft = GmailApp.createDraft(prospect.email, subject, initialContent.plainBody, options);
    appendHistory_(historySheet, now, dateKey, prospect, 'BROUILLON_CREE', draft.getId(), 'Brouillon Gmail créé');

    if (mode === 'automatic') {
      return sendTrackedDraft_(
        spreadsheet,
        historySheet,
        prospect,
        { draftId: draft.getId(), status: 'BROUILLON_CREE', followupAttempt: null },
        now,
        dateKey,
        reconciliation,
      );
    }

    return {
      status: 'BROUILLON_CREE',
      email: prospect.email,
      draftId: draft.getId(),
      createdToday: processedToday + 1,
      reconciliation: reconciliation,
    };
  } catch (error) {
    recordJobError_(error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function outreachMode_(value) {
  const mode = normalize_(value);
  if (mode === 'brouillons') return 'drafts';
  if (['envoi automatique', 'automatique', 'envoi'].indexOf(mode) !== -1) return 'automatic';
  throw new Error('Mode refusé : utilisez « Brouillons » ou « Envoi automatique ».');
}

function processPendingDraft_(spreadsheet, historySheet, pendingDraft, now, dateKey, reconciliation) {
  const prospect = findProspectByUuid_(spreadsheet, pendingDraft.uuid);
  if (!prospect || normalize_(prospect.email) !== normalize_(pendingDraft.email)) {
    appendHistory_(
      historySheet,
      now,
      dateKey,
      pendingDraft,
      'ENVOI_ANNULE',
      pendingDraft.draftId,
      'Brouillon non envoyé : prospect absent ou adresse modifiée',
    );
    return { status: 'ENVOI_ANNULE', email: pendingDraft.email, reconciliation: reconciliation };
  }

  const activity = inspectGmailActivity_(prospect.email);
  syncProspectActivity_(requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet), prospect, activity);
  if (activity.sentAt && activity.sentAt >= pendingDraft.createdAt) {
    return confirmTrackedDraftSent_(historySheet, prospect, pendingDraft, now, dateKey, reconciliation, 'Envoi Gmail déjà confirmé');
  }

  const replyAfterDraft = activity.repliedAt && activity.repliedAt >= pendingDraft.createdAt;
  if (prospect.hardBouncedAt || prospect.excluded || prospect.optedOut || replyAfterDraft) {
    appendHistory_(
      historySheet,
      now,
      dateKey,
      prospect,
      'ENVOI_ANNULE',
      pendingDraft.draftId,
      'Brouillon non envoyé : exclusion, désinscription, rebond ou réponse détectée',
    );
    return { status: 'ENVOI_ANNULE', email: prospect.email, reconciliation: reconciliation };
  }

  return sendTrackedDraft_(spreadsheet, historySheet, prospect, pendingDraft, now, dateKey, reconciliation);
}

function sendTrackedDraft_(spreadsheet, historySheet, prospect, pendingDraft, now, dateKey, reconciliation) {
  Gmail.Users.Drafts.send({ id: pendingDraft.draftId }, 'me');
  syncProspectActivity_(requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet), prospect, { sentAt: now, repliedAt: null });
  return confirmTrackedDraftSent_(historySheet, prospect, pendingDraft, now, dateKey, reconciliation, 'Brouillon envoyé automatiquement');
}

function confirmTrackedDraftSent_(historySheet, prospect, pendingDraft, now, dateKey, reconciliation, details) {
  const status = isFollowupDraftStatus_(pendingDraft.status)
    ? followupSentStatus_(pendingDraft.followupAttempt)
    : 'ENVOI_CONFIRME';
  appendHistory_(historySheet, now, dateKey, prospect, status, '', details);
  return {
    status: status,
    email: prospect.email,
    sentDraftId: pendingDraft.draftId,
    reconciliation: reconciliation,
  };
}

function findProspectByUuid_(spreadsheet, uuid) {
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
  const rowIndex = values.slice(1).findIndex(function (row) {
    return String(row[headers.uuid] || '').trim() === String(uuid || '').trim();
  });
  if (rowIndex === -1) return null;
  const row = values[rowIndex + 1];
  return {
    rowNumber: rowIndex + 2,
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

function followupTemplateKeyForMessage_(sentMessage) {
  const originalContent = [
    sentMessage && typeof sentMessage.getSubject === 'function' ? sentMessage.getSubject() : '',
    sentMessage && typeof sentMessage.getPlainBody === 'function' ? sentMessage.getPlainBody() : '',
  ].join('\n');
  return originalMessageIncludesCourseTest_(originalContent)
    ? 'corps_relance'
    : 'corps_relance_premier_contact';
}

function followupTemplateKeyForAttempt_(attempt, sentMessage) {
  const number = positiveInteger_(attempt, 1);
  return number === 1 ? followupTemplateKeyForMessage_(sentMessage) : 'corps_relance_' + number;
}

function followupAttemptFromStatus_(status) {
  const value = String(status || '');
  if (value === 'RELANCE_BROUILLON_CREE' || value === 'RELANCE_ENVOYEE') return 1;
  const match = /^RELANCE_([1-3])_(BROUILLON_CREE|ENVOYEE)$/.exec(value);
  return match ? Number(match[1]) : null;
}

function followupDraftStatus_(attempt) {
  return 'RELANCE_' + positiveInteger_(attempt, 1) + '_BROUILLON_CREE';
}

function followupSentStatus_(attempt) {
  return 'RELANCE_' + positiveInteger_(attempt, 1) + '_ENVOYEE';
}

function isFollowupDraftStatus_(status) {
  const value = String(status || '');
  return value === 'RELANCE_BROUILLON_CREE' || /^RELANCE_[1-3]_BROUILLON_CREE$/.test(value);
}

function isFollowupSentStatus_(status) {
  const value = String(status || '');
  return value === 'RELANCE_ENVOYEE' || /^RELANCE_[1-3]_ENVOYEE$/.test(value);
}

function isAnyDraftStatus_(status) {
  return String(status || '') === 'BROUILLON_CREE' || isFollowupDraftStatus_(status);
}

function isAnySentStatus_(status) {
  return String(status || '') === 'ENVOI_CONFIRME' || isFollowupSentStatus_(status);
}

function closesPendingDraft_(status) {
  return isAnySentStatus_(status)
    || ['ENVOI_ANNULE', 'REPONSE_RECUE', 'PROSPECT_SANS_REPONSE'].indexOf(String(status || '')) !== -1;
}

function originalMessageIncludesCourseTest_(content) {
  const normalized = normalize_(content)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\btst\b/.test(normalized)
    || /course\s+(?:de\s+)?test/.test(normalized)
    || /recherch(?:ez|er)\s+(?:la\s+)?course/.test(normalized)
    || /ouvr(?:ez|ir)\s+(?:la\s+)?course/.test(normalized);
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

function createStandaloneFollowupDraft_(recipient, sender, subject, plainBody, htmlBody) {
  const options = { htmlBody: htmlBody };
  if (GmailApp.getAliases().indexOf(sender) !== -1) options.from = sender;
  const draft = GmailApp.createDraft(recipient, subject, plainBody, options);
  return { id: draft.getId() };
}

function followupSubject_(template, organizationName) {
  const configured = String(template.objet_relance || '').trim();
  if (configured) return replaceOrganizationName_(configured, organizationName || '');
  return 'Re: Un Race Book mobile pour ' + String(organizationName || 'Pace Yourself').trim();
}

function subjectIncludesOrganization_(subject, organizationName) {
  const normalizedSubject = normalizeSearchText_(subject);
  const normalizedOrganization = normalizeSearchText_(organizationName);
  return normalizedOrganization.length >= 3 && normalizedSubject.indexOf(normalizedOrganization) !== -1;
}

function normalizeSearchText_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Repairs the subject of existing follow-up drafts without sending them.
 * Run manually once after deploying the matching Code.gs version.
 */
function repairFollowupDraftSubjects() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { status: 'SKIPPED_LOCKED' };

  try {
    const spreadsheet = SpreadsheetApp.openById(OUTREACH_JOB.spreadsheetId);
    const template = readKeyValueSheet_(spreadsheet, OUTREACH_JOB.templateSheet);
    const settings = readKeyValueSheet_(spreadsheet, OUTREACH_JOB.settingsSheet);
    const timezone = String(settings.fuseau_horaire || 'Europe/Paris');
    const sender = String(template.expediteur || Session.getEffectiveUser().getEmail()).trim();
    const aliases = GmailApp.getAliases();
    const historySheet = ensureHistorySheet_(spreadsheet);
    const values = historySheet.getDataRange().getValues();
    const latestByDraftId = {};

    values.slice(1).forEach(function (row) {
      const draftId = String(row[7] || '').trim();
      if (String(row[6] || '') !== 'RELANCE_BROUILLON_CREE' || !draftId) return;
      latestByDraftId[draftId] = {
        uuid: String(row[2] || '').trim(),
        email: String(row[3] || '').trim(),
        organizationName: String(row[4] || '').trim(),
        eventDate: row[5] || '',
        draftId: draftId,
      };
    });

    const result = { checked: 0, updated: 0, alreadyCorrect: 0, missing: 0, errors: 0 };
    Object.keys(latestByDraftId).forEach(function (draftId) {
      const prospect = latestByDraftId[draftId];
      const desiredSubject = followupSubject_(template, prospect.organizationName);
      result.checked += 1;
      try {
        const draft = GmailApp.getDraft(draftId);
        if (!draft) {
          result.missing += 1;
          return;
        }
        const message = draft.getMessage();
        if (message.getSubject() === desiredSubject) {
          result.alreadyCorrect += 1;
          return;
        }

        const options = { htmlBody: message.getBody() };
        const cc = String(message.getCc() || '').trim();
        const bcc = String(message.getBcc() || '').trim();
        if (cc) options.cc = cc;
        if (bcc) options.bcc = bcc;
        if (aliases.indexOf(sender) !== -1) options.from = sender;
        draft.update(message.getTo() || prospect.email, desiredSubject, message.getPlainBody(), options);
        result.updated += 1;

        const now = new Date();
        appendHistory_(
          historySheet,
          now,
          Utilities.formatDate(now, timezone, 'yyyy-MM-dd'),
          prospect,
          'RELANCE_OBJET_REPARE',
          draftId,
          'Objet du brouillon remplacé par : ' + desiredSubject,
        );
      } catch (error) {
        result.errors += 1;
        console.warn('Impossible de réparer le brouillon ' + draftId + ' : ' + error.message);
      }
    });
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
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
      const status = latestDraft && isFollowupDraftStatus_(latestDraft.status)
        && activity.sentAt >= latestDraft.createdAt
        ? followupSentStatus_(latestDraft.followupAttempt)
        : 'ENVOI_CONFIRME';
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

function findNextFollowupAction_(spreadsheet, followupStatesByUuid, now, delayBusinessDays, maxAttempts) {
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

  const candidates = values.slice(1).map(function (row, offset) {
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
    return isFollowupEligible_(prospect, followupStatesByUuid[prospect.uuid], now, delayBusinessDays, maxAttempts);
  }).sort(function (a, b) {
    return a.lastSentAt - b.lastSentAt || a.rowNumber - b.rowNumber;
  });

  const noResponseProspect = candidates.filter(function (prospect) {
    const state = followupStatesByUuid[prospect.uuid] || emptyFollowupState_();
    return state.highestSentAttempt >= maxAttempts && !state.noResponse;
  })[0];
  if (noResponseProspect) return { type: 'mark_no_response', prospect: noResponseProspect };

  const prospect = candidates.filter(function (candidate) {
    const state = followupStatesByUuid[candidate.uuid] || emptyFollowupState_();
    return state.highestSentAttempt < maxAttempts && !state.pendingDraft;
  })[0];
  if (!prospect) return null;
  const state = followupStatesByUuid[prospect.uuid] || emptyFollowupState_();
  return { type: 'draft', prospect: prospect, attempt: state.highestSentAttempt + 1 };
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

function isFollowupEligible_(prospect, followupState, now, delayBusinessDays, maxAttempts) {
  const state = followupState || emptyFollowupState_();
  return Boolean(prospect.uuid
    && prospect.email
    && prospect.organizationName
    && prospect.lastSentAt
    && now.getTime() >= addBusinessDays_(prospect.lastSentAt, delayBusinessDays).getTime()
    && !prospect.repliedAt
    && !prospect.hardBouncedAt
    && !prospect.excluded
    && !prospect.optedOut
    && !state.noResponse
    && state.highestSentAttempt <= maxAttempts);
}

function emptyFollowupState_() {
  return { highestSentAttempt: 0, pendingDraft: null, noResponse: false };
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
      organizationName: String(row[4] || ''),
      eventDate: row[5] || '',
      status: String(row[6] || ''),
      draftId: String(row[7] || ''),
      followupAttempt: followupAttemptFromStatus_(row[6]),
    };
  });
  const terminalUuids = {};
  const draftUuids = {};
  const followupStatesByUuid = {};
  const latestDraftByUuid = {};
  const pendingDraftByUuid = {};
  rows.forEach(function (row) {
    if (row.uuid && ['BROUILLON_CREE', 'IGNORE_DEJA_CONTACTE', 'IGNORE_REPONSE_RECUE'].indexOf(row.status) !== -1) {
      terminalUuids[row.uuid] = true;
    }
    if (row.uuid && isAnyDraftStatus_(row.status)) {
      draftUuids[row.uuid] = true;
      pendingDraftByUuid[row.uuid] = row;
      if (!latestDraftByUuid[row.uuid] || row.createdAt > latestDraftByUuid[row.uuid].createdAt) latestDraftByUuid[row.uuid] = row;
    }
    if (row.uuid && closesPendingDraft_(row.status)) delete pendingDraftByUuid[row.uuid];
    if (!row.uuid) return;
    const state = followupStatesByUuid[row.uuid] || emptyFollowupState_();
    if (isFollowupDraftStatus_(row.status)) {
      state.pendingDraft = row;
    } else if (isFollowupSentStatus_(row.status)) {
      state.highestSentAttempt = Math.max(state.highestSentAttempt, row.followupAttempt || 1);
      if (state.pendingDraft && state.pendingDraft.followupAttempt === row.followupAttempt) state.pendingDraft = null;
    } else if (row.status === 'ENVOI_ANNULE') {
      state.pendingDraft = null;
    } else if (row.status === FOLLOWUP_SEQUENCE.noResponseStatus) {
      state.noResponse = true;
    }
    followupStatesByUuid[row.uuid] = state;
  });
  return {
    rows: rows,
    terminalUuids: terminalUuids,
    draftUuids: draftUuids,
    followupStatesByUuid: followupStatesByUuid,
    latestDraftByUuid: latestDraftByUuid,
    pendingDrafts: Object.keys(pendingDraftByUuid).map(function (uuid) {
      return pendingDraftByUuid[uuid];
    }).filter(function (row) {
      return row.draftId;
    }).sort(function (a, b) {
      return a.createdAt - b.createdAt;
    }),
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

function ensureUnsubscribeSecret_() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty(UNSUBSCRIBE.secretProperty);
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    properties.setProperty(UNSUBSCRIBE.secretProperty, secret);
  }
  return secret;
}

function unsubscribeToken_(uuid) {
  const signature = Utilities.computeHmacSha256Signature(String(uuid || ''), ensureUnsubscribeSecret_());
  return Utilities.base64EncodeWebSafe(signature).replace(/=+$/, '');
}

function buildUnsubscribeUrl_(prospect) {
  const serviceUrl = ScriptApp.getService().getUrl();
  if (!serviceUrl) throw new Error('Lien de désinscription indisponible : déployez le script comme application Web.');
  const uuid = String(prospect && prospect.uuid || '').trim();
  if (!uuid) throw new Error('Lien de désinscription indisponible : UUID prospect manquant.');
  return serviceUrl + '?action=unsubscribe&uuid=' + encodeURIComponent(uuid) + '&token=' + encodeURIComponent(unsubscribeToken_(uuid));
}

function appendUnsubscribeFooter_(plainBody, htmlBody, unsubscribeUrl, label) {
  const safeLabel = String(label || UNSUBSCRIBE.defaultLabel).trim() || UNSUBSCRIBE.defaultLabel;
  return {
    plainBody: String(plainBody || '') + '\n\n' + safeLabel + ' : ' + unsubscribeUrl,
    htmlBody: String(htmlBody || '') + '<br><br><span style="font-size:12px;color:#6b7280"><a href="'
      + escapeHtml_(unsubscribeUrl) + '" style="color:#6b7280">' + escapeHtml_(safeLabel) + '</a></span>',
  };
}

function findProspectForUnsubscribe_(uuid, token) {
  const normalizedUuid = String(uuid || '').trim();
  const normalizedToken = String(token || '').trim();
  if (!normalizedUuid || !normalizedToken || !constantTimeEquals_(normalizedToken, unsubscribeToken_(normalizedUuid))) return null;

  const spreadsheet = SpreadsheetApp.openById(OUTREACH_JOB.spreadsheetId);
  const sheet = requiredSheet_(spreadsheet, OUTREACH_JOB.prospectsSheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = headerIndex_(values[0]);
  ['uuid', 'email', 'Organization name', 'outreach_event_date', 'opted-out'].forEach(function (header) {
    if (headers[header] === undefined) throw new Error('Colonne Prospects manquante : ' + header);
  });

  for (let offset = 0; offset < values.length - 1; offset += 1) {
    const row = values[offset + 1];
    if (String(row[headers.uuid] || '').trim() !== normalizedUuid) continue;
    return {
      sheet: sheet,
      rowNumber: offset + 2,
      uuid: normalizedUuid,
      email: String(row[headers.email] || '').trim(),
      organizationName: String(row[headers['Organization name']] || '').trim(),
      eventDate: row[headers.outreach_event_date] || '',
      optedOut: asBoolean_(row[headers['opted-out']]),
      optedOutColumn: headers['opted-out'] + 1,
    };
  }
  return null;
}

function confirmUnsubscribe_(parameters) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return HtmlService.createHtmlOutput('La demande est momentanément indisponible. Merci de réessayer.').setTitle('Pace Yourself');
  }
  try {
    const prospect = findProspectForUnsubscribe_(parameters.uuid, parameters.token);
    if (!prospect) {
      return HtmlService.createHtmlOutput('Ce lien de désinscription est invalide ou a expiré.').setTitle('Pace Yourself');
    }
    if (!prospect.optedOut) {
      prospect.sheet.getRange(prospect.rowNumber, prospect.optedOutColumn).setValue(true);
      const spreadsheet = SpreadsheetApp.openById(OUTREACH_JOB.spreadsheetId);
      const timezone = String(readKeyValueSheet_(spreadsheet, OUTREACH_JOB.settingsSheet).fuseau_horaire || 'Europe/Paris');
      const now = new Date();
      appendHistory_(
        ensureHistorySheet_(spreadsheet),
        now,
        Utilities.formatDate(now, timezone, 'yyyy-MM-dd'),
        prospect,
        'DESINSCRIPTION_CONFIRMEE',
        '',
        'Désinscription confirmée depuis le lien email',
      );
      SpreadsheetApp.flush();
    }
    return HtmlService.createHtmlOutput('Votre adresse a bien été désinscrite.').setTitle('Désinscription — Pace Yourself');
  } finally {
    lock.releaseLock();
  }
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
