import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  buildQaSession,
  createAuthenticatedContext,
  resolveQaArtifactRoot,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';
import {
  buildRowFailureClassification,
  cssString,
  summarizeSmokeEntry,
} from './qa-lib/runtime-ready-row-locator.mjs';

const formatLocalDateYmd = (date) =>
  `${date.getFullYear().toString().padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const runId = process.env.RUN_ID ?? new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  resolveQaArtifactRoot('webclient', 'runtime-gate-ready', runId);

const facilityId = resolveQaFacilityId();
const authUserId = resolveQaUserId();
const authPasswordPlain = resolveQaPasswordPlain();
const preferredSmokeEncounterKey = '1.3.6.1.4.1.9414.72.103:SMOKE-20251129-0001';
const preferredSmokeScheduleKey = 'SMOKE-SCHEDULE-20251129-0001';
const requestedPatientId = process.env.QA_PATIENT_ID?.trim() ?? '';
const requestedSmokePatientDisplayName = process.env.QA_SMOKE_PATIENT_NAME?.trim() ?? '';
const blockedRouteDetectors = [
  {
    label: 'blocked-legacy-orca-queue-hit',
    matches: (url) => url.includes('/api/orca/queue'),
  },
  {
    label: 'blocked-legacy-orca-push-event-hit',
    matches: (url) => url.includes('/api/orca/pusheventgetv2'),
  },
  {
    label: 'invalid-orca-taxonomy',
    matches: (url) => /\/api\/orca\/(?!official\/|master\/|queue(?:\/|$)|pusheventgetv2(?:\/|$))/.test(url),
  },
  {
    label: 'legacy-operations-readiness',
    matches: (url) => url.includes('/api/operations/readiness'),
  },
];

const session = buildQaSession({
  facilityId,
  userId: authUserId,
  runId,
  scenarioLabel: 'runtime-ready',
  sessionRole: 'admin',
  sessionRoles: ['admin', 'doctor', 'user'],
});

fs.mkdirSync(artifactRoot, { recursive: true });

const summarizeBody = (value) => {
  if (!value) return '';
  const redacted = value.replace(/(Authorization|Cookie|JSESSIONID|password|passwd|token)=([^&\s]+)/gi, '$1=<<redacted>>');
  return redacted.length > 1500 ? `${redacted.slice(0, 1500)}...` : redacted;
};

const redactUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.username) url.username = 'redacted';
    if (url.password) url.password = 'redacted';
    for (const key of [...url.searchParams.keys()]) {
      if (/auth|token|password|passwd|cookie|session|jsessionid/i.test(key)) {
        url.searchParams.set(key, '<<redacted>>');
      }
    }
    return url.toString();
  } catch {
    return String(value).replace(/(Authorization|Cookie|JSESSIONID|password|passwd|token)=([^&\s]+)/gi, '$1=<<redacted>>');
  }
};

const safeUrlPath = (value) => {
  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return redactUrl(value);
  }
};

const evidenceSensitiveKeys = new Set([
  'appointmentId',
  'encounterKey',
  'name',
  'patientId',
  'receptionId',
  'scheduleKey',
  'smokeEncounterKey',
  'smokePatientDisplayName',
  'smokePatientId',
  'smokeScheduleKey',
  'text',
]);

const collectSensitiveEvidenceTokens = (evidence) => {
  const entry = evidence?.smokeEntry ?? evidence ?? {};
  return [
    entry.encounterKey,
    entry.scheduleKey,
    entry.receptionId,
    entry.appointmentId,
    entry.patientId,
    entry.name,
    requestedPatientId,
    requestedSmokePatientDisplayName,
  ]
    .filter((value) => typeof value === 'string' && value.trim().length >= 2)
    .map((value) => value.trim());
};

const sanitizeForEvidence = (value, sensitiveTokens = []) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForEvidence(item, sensitiveTokens));
  }
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string') return value;
    return sensitiveTokens.reduce(
      (current, token) => current.split(token).join('<<redacted-patient-context>>'),
      value,
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (evidenceSensitiveKeys.has(key)) {
        if (key === 'text') {
          return [key, entryValue ? '<<redacted-row-text>>' : entryValue];
        }
        return [key, entryValue ? `<<redacted-${key}>>` : entryValue];
      }
      return [key, sanitizeForEvidence(entryValue, sensitiveTokens)];
    }),
  );
};

const writeSanitizedJson = (filePath, evidence, sensitiveSource = null) => {
  const tokens = collectSensitiveEvidenceTokens(sensitiveSource ?? evidence?.appointmentEvidence ?? evidence);
  fs.writeFileSync(filePath, JSON.stringify(sanitizeForEvidence(evidence, tokens), null, 2), 'utf8');
};

const summarizeJsonBody = (body) => {
  if (!body) return { bodyChars: 0 };
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object') return { bodyChars: body.length };
    return {
      bodyChars: body.length,
      keys: Object.keys(parsed).slice(0, 20),
      apiResult: parsed.apiResult,
      apiResultMessage: parsed.apiResultMessage,
      recordsReturned: parsed.recordsReturned,
      slotsCount: Array.isArray(parsed.slots) ? parsed.slots.length : undefined,
      reservationsCount: Array.isArray(parsed.reservations) ? parsed.reservations.length : undefined,
      visitsCount: Array.isArray(parsed.visits) ? parsed.visits.length : undefined,
      entriesCount: Array.isArray(parsed.entries) ? parsed.entries.length : undefined,
    };
  } catch {
    return { bodyChars: body.length, parseableJson: false, rawSensitiveFieldsExcluded: true };
  }
};

const summarizeAppointmentEvidence = (evidence) => ({
  queryDate: evidence.queryDate,
  meta: evidence.meta,
  selectionReason: evidence.selectionReason,
  patientMatchedEntryCount: evidence.patientMatchedEntryCount,
  chartReadyEntryCount: evidence.chartReadyEntryCount,
  entryCount: evidence.entryCount,
  smokeEntry: evidence.smokeEntry ? summarizeSmokeEntry(evidence.smokeEntry) : null,
  rawSmoke: {
    slotsCount: evidence.rawSmoke?.slots?.length ?? 0,
    reservationsCount: evidence.rawSmoke?.reservations?.length ?? 0,
    visitsCount: evidence.rawSmoke?.visits?.length ?? 0,
  },
});

const writeRuntimeReadyBlocker = async ({ page, code, detail, appointmentEvidence, extra = {} }) => {
  const receptionEvidence = page ? await collectReceptionRowEvidence(page).catch(() => ({})) : {};
  const evidence = {
    runId,
    verdict: 'blocked',
    blockerClassification: 'runtime_ready_not_ready',
    blockerReason: code,
    detail,
    baseURL: redactUrl(baseURL),
    facilityId,
    appointmentEvidence: appointmentEvidence ? summarizeAppointmentEvidence(appointmentEvidence) : null,
    ...receptionEvidence,
    requestResponseSummary: {
      requests: summarizeRequestLog(requestLog),
      responses: summarizeResponseLog(responseLog),
    },
    counters: {
      pauseFinishRequests,
      billOperationBodies,
      blockedRouteHits,
    },
    rawSensitiveFieldsExcluded: true,
    liveMutationExecuted: false,
    ...extra,
  };
  writeSanitizedJson(path.join(artifactRoot, 'runtime-ready-before-row-wait.json'), evidence, appointmentEvidence);
  writeSanitizedJson(path.join(artifactRoot, 'runtime-ready-result.json'), evidence, appointmentEvidence);
};

const summarizeRequestLog = (records) =>
  records.map((entry) => ({
    method: entry.method,
    url: safeUrlPath(entry.url),
    body: summarizeJsonBody(entry.body),
  }));

const summarizeResponseLog = (records) =>
  records.map((entry) => ({
    status: entry.status,
    url: safeUrlPath(entry.url),
    body: summarizeJsonBody(entry.body),
  }));

const collectReceptionRowEvidence = async (page) =>
  await page.evaluate(() => {
    const normalize = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const selectedDateInput =
      document.querySelector('input[aria-label="日付"]') ??
      document.querySelector('.reception-toolbar input[type="date"]') ??
      document.querySelector('input[type="date"]');
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const activeTabLabel = activeTab?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const activeTabId = activeTab?.id ?? '';
    const visibleTabPanel = Array.from(document.querySelectorAll('[role="tabpanel"]')).find((panel) => isVisible(panel));
    const rows = Array.from(document.querySelectorAll('.reception-table__row, [data-test-id="reception-entry-card"]')).filter(isVisible);
    const rowStatuses = [...new Set(rows.map((row) => row.getAttribute('data-reception-status') ?? '').filter(Boolean))];
    const activeStatusTab =
      (visibleTabPanel?.id || activeTab?.getAttribute('aria-controls') || activeTabId)
        .replace(/^reception-status-tabpanel-/, '')
        .replace(/^reception-status-tab-/, '') || (rowStatuses.length === 1 ? rowStatuses[0] : '');
    return {
      selectedDate: selectedDateInput?.value ?? '',
      activeStatusTab,
      activeStatusLabel: activeTabLabel,
      visibleRowsSummary: rows.map((row, index) => {
        const chartButton = Array.from(row.querySelectorAll('button')).find((button) =>
          (button.getAttribute('aria-label') ?? '').startsWith('カルテを開く'),
        );
        return {
          index,
          kind: row.classList.contains('reception-table__row') ? 'table-row' : 'card',
          patientId: row.getAttribute('data-patient-id') ?? '',
          receptionStatus: row.getAttribute('data-reception-status') ?? '',
          encounterKey: row.getAttribute('data-encounter-key') ?? '',
          scheduleKey: row.getAttribute('data-schedule-key') ?? '',
          receptionId: row.getAttribute('data-reception-id') ?? '',
          appointmentId: row.getAttribute('data-appointment-id') ?? '',
          canOpenCharts: chartButton ? !chartButton.hasAttribute('disabled') : null,
          chartButtonTitle: chartButton?.getAttribute('title') ?? '',
          text: normalize(row.textContent).slice(0, 300),
        };
      }),
    };
  });

const buildRowLocatorCandidates = (page, entry, smokePatientDisplayName) => {
  const rootSelectors = ['.reception-table__row', '[data-test-id="reception-entry-card"]'];
  const candidates = [
    ['encounterKey', entry.encounterKey],
    ['scheduleKey', entry.scheduleKey],
    ['receptionId', entry.receptionId],
    ['appointmentId', entry.appointmentId],
  ]
    .map(([strategy, value]) => {
      const normalized = typeof value === 'string' ? value.trim() : '';
      return normalized
        ? {
            strategy,
            value: normalized,
            locator: page.locator(
              rootSelectors
                .map((root) => `${root}[data-${strategy.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}=${cssString(normalized)}]`)
                .join(', '),
            ),
          }
        : null;
    })
    .filter(Boolean);

  const patientId = typeof entry.patientId === 'string' ? entry.patientId.trim() : '';
  if (patientId && smokePatientDisplayName) {
    candidates.push({
      strategy: 'patientIdentity',
      value: `${patientId} + ${smokePatientDisplayName}`,
      locator: page
        .locator(rootSelectors.map((root) => `${root}[data-patient-id=${cssString(patientId)}]`).join(', '))
        .filter({ hasText: smokePatientDisplayName }),
    });
  }

  for (const value of [entry.encounterKey, entry.scheduleKey, entry.receptionId, entry.appointmentId, patientId]) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (normalized) {
      candidates.push({
        strategy: 'visibleText',
        value: normalized,
        locator: page.locator(rootSelectors.join(', ')).filter({ hasText: normalized }),
      });
    }
  }
  return candidates;
};

const waitForSmokeRow = async (page, entry, smokePatientDisplayName) => {
  const candidates = buildRowLocatorCandidates(page, entry, smokePatientDisplayName);
  const attempts = [];
  for (const candidate of candidates) {
    try {
      const row = candidate.locator.first();
      await row.waitFor({ state: 'visible', timeout: candidate.strategy === 'visibleText' ? 4_000 : 3_000 });
      return { row, strategy: candidate.strategy, value: candidate.value, attempts };
    } catch (error) {
      attempts.push({
        strategy: candidate.strategy,
        value: candidate.value,
        error: error?.name ?? 'locator-timeout',
      });
    }
  }
  const error = new Error(
    `runtime-ready smoke row not visible after locator attempts: ${attempts.map((attempt) => `${attempt.strategy}=${attempt.value}`).join(', ')}`,
  );
  error.locatorAttempts = attempts;
  throw error;
};

const waitFor = async (predicate, timeoutMs, intervalMs = 200) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`timeout after ${timeoutMs}ms`);
};

const clickFirstVisible = async (page, selectors) => {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        await locator.waitFor({ state: 'visible', timeout: 5_000 });
        await locator.scrollIntoViewIfNeeded().catch(() => {});
        await locator.click();
        return selector;
      } catch {
        try {
          await locator.click({ force: true });
          return selector;
        } catch {
          // try next selector
        }
      }
    }
  }
  throw new Error(`no clickable selector found: ${selectors.join(', ')}`);
};

const browser = await chromium.launch({ headless: true });
const { context, page, sessionMe } = await createAuthenticatedContext(browser, {
  baseURL,
  facilityId,
  userId: authUserId,
  password: authPasswordPlain,
  session,
});

const requestLog = [];
const responseLog = [];
const blockedRouteHits = Object.fromEntries(blockedRouteDetectors.map((detector) => [detector.label, 0]));
let pauseFinishRequests = 0;
let billOperationBodies = 0;

context.on('request', (request) => {
  const url = request.url();
  const method = request.method();
  const postData = request.postData() ?? '';
  const isTracked =
    url.includes('/api/orca/official/appointments/list') ||
    url.includes('/api/orca/official/visits/list') ||
    url.includes('/api/local/encounters/') ||
    url.includes('/api/encounters/') ||
    blockedRouteDetectors.some((detector) => detector.matches(url));
  if (!isTracked) return;
  requestLog.push({ method, url: redactUrl(url), body: postData });
  if (url.includes('/api/encounters/') && url.includes('/transitions')) {
    if (/"operation"\s*:\s*"(?:pause|finish)"/i.test(postData)) pauseFinishRequests += 1;
    if (/"operation"\s*:\s*"bill"/i.test(postData)) billOperationBodies += 1;
  }
  for (const detector of blockedRouteDetectors) {
    if (detector.matches(url)) blockedRouteHits[detector.label] += 1;
  }
});

context.on('response', async (response) => {
  const url = response.url();
  const isTracked =
    url.includes('/api/orca/official/appointments/list') ||
    url.includes('/api/orca/official/visits/list') ||
    url.includes('/api/local/encounters/') ||
    url.includes('/api/encounters/') ||
    blockedRouteDetectors.some((detector) => detector.matches(url));
  if (!isTracked) return;
  let body = '';
  try {
    body = await response.text();
  } catch {
    body = '';
  }
  responseLog.push({ status: response.status(), url: redactUrl(url), body });
});

try {
  await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
  await page.locator('.reception-page').waitFor({ timeout: 20_000 });

  const queryDate = formatLocalDateYmd(new Date());
  const appointmentEvidence = await page.evaluate(async ({
    queryDate,
    preferredSmokeEncounterKey,
    preferredSmokeScheduleKey,
    requestedPatientId,
  }) => {
    const { fetchAppointmentOutpatients } = await import('/src/features/reception/api.ts');
    const payload = await fetchAppointmentOutpatients({ date: queryDate });
    const raw = payload.raw && typeof payload.raw === 'object' ? payload.raw : {};
    const pick = (items) =>
      Array.isArray(items)
        ? items.filter((item) => {
            if (!item || typeof item !== 'object') return false;
            return [
              item.encounterKey,
              item.linkedEncounterKey,
              item.scheduleKey,
              item.appointmentId,
              item.sequentialNumber,
              item.voucherNumber,
            ].some((value) => value === preferredSmokeEncounterKey || value === preferredSmokeScheduleKey);
          })
        : [];
    const keyedEntry = payload.entries.find(
      (entry) => entry.encounterKey === preferredSmokeEncounterKey || entry.scheduleKey === preferredSmokeScheduleKey,
    );
    const patientMatchedEntries = requestedPatientId
      ? payload.entries.filter((entry) => entry.patientId === requestedPatientId)
      : [];
    const chartReadyEntries = payload.entries.filter(
      (entry) => Boolean((entry.receptionId ?? entry.encounterKey)?.trim()) && Boolean(entry.scheduleKey?.trim()),
    );
    const fallbackEntry = chartReadyEntries[0] ?? null;
    const smokeEntry = keyedEntry ?? patientMatchedEntries[0] ?? fallbackEntry;
    return {
      queryDate,
      meta: {
        recordsReturned: payload.recordsReturned,
        fallbackUsed: payload.fallbackUsed,
        sourcePath: payload.sourcePath,
        outcome: payload.outcome,
      },
      rawSmoke: {
        slots: pick(raw.slots),
        reservations: pick(raw.reservations),
        visits: pick(raw.visits),
      },
      selectionReason: keyedEntry
        ? 'preferred_keys'
        : requestedPatientId && patientMatchedEntries.length > 0
          ? 'qa_patient_id'
          : fallbackEntry
            ? 'first_chart_ready_entry'
            : 'none',
      patientMatchedEntryCount: patientMatchedEntries.length,
      chartReadyEntryCount: chartReadyEntries.length,
      smokeEntry,
      entryCount: payload.entries.length,
    };
  }, { queryDate, preferredSmokeEncounterKey, preferredSmokeScheduleKey, requestedPatientId });

  if (!appointmentEvidence.smokeEntry) {
    const code = requestedPatientId ? 'missing_today_entry_precondition_for_patient' : 'missing_today_entry_precondition';
    const detail = requestedPatientId
      ? `runtime-ready smoke cannot continue because no chart-ready entry is present for queryDate=${queryDate} and QA_PATIENT_ID=${requestedPatientId}`
      : `runtime-ready smoke cannot continue because no chart-ready entry is present for queryDate=${queryDate}`;
    await writeRuntimeReadyBlocker({
      page,
      code,
      detail,
      appointmentEvidence,
      extra: {
        requestedPatientId: requestedPatientId || undefined,
        requiredNextStep:
          'register or select a Trial patient for the current date, then rerun; this is a data precondition blocker, not an ORCA connectivity verdict',
      },
    });
    if (requestedPatientId) {
      throw new Error(`missing_today_entry_precondition_for_patient: queryDate=${queryDate} QA_PATIENT_ID=${requestedPatientId}`);
    }
    throw new Error(`missing_today_entry_precondition: queryDate=${queryDate}`);
  }
  const smokeEncounterKey = appointmentEvidence.smokeEntry.encounterKey?.trim() ?? '';
  const smokeScheduleKey = appointmentEvidence.smokeEntry.scheduleKey?.trim() ?? '';
  const smokePatientDisplayName = requestedSmokePatientDisplayName || appointmentEvidence.smokeEntry.name?.trim();
  if (!smokeEncounterKey) {
    throw new Error('runtime-ready smoke entry is missing encounterKey');
  }
  if (!smokeScheduleKey) {
    throw new Error('runtime-ready smoke entry is missing scheduleKey');
  }
  if (!smokePatientDisplayName) {
    throw new Error('runtime-ready smoke entry does not expose a patient display name');
  }
  if (
    appointmentEvidence.smokeEntry.name?.includes('患者番号がありません') ||
    appointmentEvidence.rawSmoke.slots.some((slot) => slot?.patient?.wholeName?.includes('患者番号がありません')) ||
    appointmentEvidence.rawSmoke.visits.some((visit) => visit?.patient?.wholeName?.includes('患者番号がありません'))
  ) {
    throw new Error('smoke patient display name is still unresolved in current read model');
  }

  await page.evaluate(async ({ facilityId, userId }) => {
    const { clearChartsPatientTabsStorage } = await import('/src/features/charts/patientTabsStorage.ts');
    clearChartsPatientTabsStorage({ facilityId, userId });
  }, { facilityId, userId: authUserId });

  const selectedSmokeEntry = summarizeSmokeEntry(appointmentEvidence.smokeEntry);
  const beforeRowWaitEvidence = {
    runId,
    baseURL: redactUrl(baseURL),
    facilityId,
    appointmentEvidence: summarizeAppointmentEvidence(appointmentEvidence),
    selectedSmokeEntry,
    ...(await collectReceptionRowEvidence(page)),
    requestResponseSummary: {
      requests: summarizeRequestLog(requestLog),
      responses: summarizeResponseLog(responseLog),
    },
  };
  writeSanitizedJson(
    path.join(artifactRoot, 'runtime-ready-before-row-wait.json'),
    beforeRowWaitEvidence,
    appointmentEvidence,
  );

  let rowResolution;
  let smokeRowLocator;
  try {
    rowResolution = await waitForSmokeRow(page, appointmentEvidence.smokeEntry, smokePatientDisplayName);
    smokeRowLocator = rowResolution.row;
  } catch (error) {
    const afterTimeoutEvidence = {
      ...beforeRowWaitEvidence,
      ...(await collectReceptionRowEvidence(page)),
    };
    const failureClassification = buildRowFailureClassification({
      appointmentEvidence,
      selectedSmokeEntry: appointmentEvidence.smokeEntry,
      visibleRowsSummary: afterTimeoutEvidence.visibleRowsSummary,
      activeStatusTab: afterTimeoutEvidence.activeStatusTab,
      selectedDate: afterTimeoutEvidence.selectedDate,
    });
    writeSanitizedJson(
      path.join(artifactRoot, 'runtime-ready-row-wait-failure.json'),
      {
        runId,
        failureClassification,
        locatorAttempts: error.locatorAttempts ?? [],
        evidence: afterTimeoutEvidence,
      },
      appointmentEvidence,
    );
    throw new Error(`runtime-ready row wait failed: ${failureClassification.code}; ${failureClassification.detail}`);
  }
  await smokeRowLocator.locator('button[aria-label^="カルテを開く"]').first().click();
  await page.locator('.charts-page').waitFor({ timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const start = document.getElementById('charts-action-start');
      const finish = document.getElementById('charts-action-finish');
      const action = start ?? finish;
      return Boolean(action) && !action.hasAttribute('disabled') && !document.body.innerText.includes('指定された scheduleKey / encounterKey が見つかりません');
    },
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1000);

  const uiBeforeReload = await page.evaluate(({ smokePatientDisplayName }) => {
    const start = document.getElementById('charts-action-start');
    const print = document.getElementById('charts-action-print');
    const bodyText = document.body.innerText;
    return {
      url: `${location.pathname}${location.search}`,
      hasMissingKeyWarning: bodyText.includes('指定された scheduleKey / encounterKey が見つかりません'),
      hasStartPatientGuard: (start?.getAttribute('title') ?? '').includes('患者未選択'),
      hasPrintPatientGuard: (print?.getAttribute('title') ?? '').includes('患者未選択'),
      hasPlaceholderName: bodyText.includes('患者番号がありません'),
      startDisabled: start?.hasAttribute('disabled') ?? null,
      printDisabled: print?.hasAttribute('disabled') ?? null,
      patientLabelContainsSmokeName: (document.querySelector('.charts-patient-summary')?.textContent ?? '').includes(smokePatientDisplayName),
    };
  }, { smokePatientDisplayName });
  if (uiBeforeReload.hasPlaceholderName || !uiBeforeReload.patientLabelContainsSmokeName) {
    throw new Error('smoke patient display name is not rendered in Charts UI');
  }

  await waitFor(
    () => responseLog.filter((entry) => entry.url.includes('/api/local/encounters/')).length >= 1,
    30_000,
  );
  await page.waitForTimeout(1000);

  const uiAfterReload = await page.evaluate(({ smokePatientDisplayName }) => {
    const start = document.getElementById('charts-action-start');
    const print = document.getElementById('charts-action-print');
    const bodyText = document.body.innerText;
    return {
      url: `${location.pathname}${location.search}`,
      hasMissingKeyWarning: bodyText.includes('指定された scheduleKey / encounterKey が見つかりません'),
      hasPatientUnselectedBanner:
        bodyText.includes('患者未選択のため開始できません。') ||
        bodyText.includes('患者未選択のため印刷/エクスポートを停止しました'),
      hasPlaceholderName: bodyText.includes('患者番号がありません'),
      startDisabled: start?.hasAttribute('disabled') ?? null,
      startTitle: start?.getAttribute('title') ?? null,
      printDisabled: print?.hasAttribute('disabled') ?? null,
      printTitle: print?.getAttribute('title') ?? null,
      printGuardText: document.getElementById('charts-actions-print-guard')?.textContent ?? null,
      patientLabelContainsSmokeName: (document.querySelector('.charts-patient-summary')?.textContent ?? '').includes(smokePatientDisplayName),
    };
  }, { smokePatientDisplayName });
  if (uiAfterReload.hasPlaceholderName || !uiAfterReload.patientLabelContainsSmokeName) {
    throw new Error('smoke patient display name regressed after summary refresh');
  }

  const printState = await page.evaluate(() => {
    const print = document.getElementById('charts-action-print');
    return {
      disabled: print?.hasAttribute('disabled') ?? null,
      title: print?.getAttribute('title') ?? null,
      guard: document.getElementById('charts-actions-print-guard')?.textContent ?? null,
    };
  });

  const transitionResponseCountBeforeStart = responseLog.filter(
    (entry) => entry.url.includes('/api/encounters/') && entry.url.includes('/transitions'),
  ).length;
  const summaryResponseCountBeforeStart = responseLog.filter((entry) => entry.url.includes('/api/local/encounters/')).length;
  const startActionVisible = await page.evaluate(() => {
    const start = document.getElementById('charts-action-start');
    const visible = Boolean(start) && window.getComputedStyle(start).display !== 'none' && window.getComputedStyle(start).visibility !== 'hidden';
    const group = start?.parentElement;
    if (group && window.getComputedStyle(group).display === 'none') {
      group.style.display = 'grid';
    }
    return visible || (Boolean(start) && !start.hasAttribute('disabled'));
  });
  let startSelector = 'skipped_start_action_not_visible';
  let startSkippedReason = 'encounter_not_in_reception_start_state';
  let summaryRefetchObservedAfterStart = false;
  if (startActionVisible) {
    startSelector = await clickFirstVisible(page, [
      '.charts-patient-summary__primary-action--start',
      '#charts-action-start',
      'button:has-text("診察開始")',
    ]);
    startSkippedReason = null;
    await waitFor(
      () =>
        responseLog.filter((entry) => entry.url.includes('/api/encounters/') && entry.url.includes('/transitions')).length >=
        transitionResponseCountBeforeStart + 1,
      30_000,
    );
    await page.waitForTimeout(1500);
    summaryRefetchObservedAfterStart = await waitFor(
      () => responseLog.filter((entry) => entry.url.includes('/api/local/encounters/')).length >= summaryResponseCountBeforeStart + 1,
      30_000,
    ).then(
      () => true,
      () => false,
    );
    await page.waitForTimeout(1000);
  }

  const uiAfterStart = await page.evaluate(({ smokePatientDisplayName, smokePatientId }) => {
    const summaryText = document.querySelector('.charts-patient-summary')?.textContent ?? '';
    return {
      hasPlaceholderName: document.body.innerText.includes('患者番号がありません'),
      successVisible:
        document.body.innerText.includes('診察開始を完了') || document.body.innerText.includes('checked_in -> chart_opened'),
      patientLabelContainsSmokeName: summaryText.includes(smokePatientDisplayName),
      patientLabelContainsSmokePatientId: summaryText.includes(smokePatientId),
    };
  }, { smokePatientDisplayName, smokePatientId: appointmentEvidence.smokeEntry.patientId });
  if (
    uiAfterStart.hasPlaceholderName ||
    (!uiAfterStart.patientLabelContainsSmokeName && !uiAfterStart.patientLabelContainsSmokePatientId)
  ) {
    throw new Error('smoke patient display name regressed after start transition');
  }

  const result = {
    runId,
    baseURL: redactUrl(baseURL),
    facilityId,
    smokeEncounterKey,
    smokeScheduleKey,
    login: {
      sessionMeStatus: sessionMe.status,
    },
    authoritativeReadEvidence: summarizeAppointmentEvidence(appointmentEvidence),
    chartsNav: {
      via: 'reception-card-open-charts',
      url: page.url(),
    },
    selectedEntryEvidence: {
      rowResolution: {
        strategy: rowResolution.strategy,
        value: rowResolution.value,
      },
      beforeRowWait: {
        path: 'runtime-ready-before-row-wait.json',
        visibleRowCount: beforeRowWaitEvidence.visibleRowsSummary.length,
        activeStatusTab: beforeRowWaitEvidence.activeStatusTab,
        selectedDate: beforeRowWaitEvidence.selectedDate,
      },
      uiBeforeReload,
      uiAfterReload,
      printState,
    },
    startEvidence: {
      uiAfterStart,
      startSelector,
      startSkippedReason,
      summaryRefetchObservedAfterStart,
    },
    traces: {
      summaryRequests: summarizeRequestLog(requestLog.filter((entry) => entry.url.includes('/api/local/encounters/'))),
      summaryResponses: summarizeResponseLog(responseLog.filter((entry) => entry.url.includes('/api/local/encounters/'))),
      transitionRequests: summarizeRequestLog(requestLog.filter((entry) => entry.url.includes('/api/encounters/') && entry.url.includes('/transitions'))),
      transitionResponses: summarizeResponseLog(responseLog.filter((entry) => entry.url.includes('/api/encounters/') && entry.url.includes('/transitions'))),
      appointmentsRequests: summarizeRequestLog(requestLog.filter((entry) => entry.url.includes('/api/orca/official/appointments/list'))),
      appointmentsResponses: summarizeResponseLog(responseLog.filter((entry) => entry.url.includes('/api/orca/official/appointments/list'))),
      visitsRequests: summarizeRequestLog(requestLog.filter((entry) => entry.url.includes('/api/orca/official/visits/list'))),
      visitsResponses: summarizeResponseLog(responseLog.filter((entry) => entry.url.includes('/api/orca/official/visits/list'))),
    },
    counters: {
      pauseFinishRequests,
      billOperationBodies,
      blockedRouteHits,
    },
  };

  writeSanitizedJson(path.join(artifactRoot, 'runtime-ready-result.json'), result, appointmentEvidence);
  const blockedRouteSummary = Object.entries(blockedRouteHits).filter(([, count]) => count > 0);
  if (blockedRouteSummary.length > 0) {
    throw new Error(
      `runtime-ready smoke detected blocked route hits: ${blockedRouteSummary
        .map(([label, count]) => `${label}=${count}`)
        .join(', ')}`,
    );
  }
  console.log(JSON.stringify(sanitizeForEvidence({ artifactRoot, result }, collectSensitiveEvidenceTokens(appointmentEvidence)), null, 2));
} finally {
  await context.close();
  await browser.close();
}
