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
  return value.length > 1500 ? `${value.slice(0, 1500)}...` : value;
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
  requestLog.push({ method, url, body: summarizeBody(postData) });
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
  responseLog.push({ status: response.status(), url, body: summarizeBody(body) });
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
    if (requestedPatientId) {
      throw new Error(`runtime-ready entry not present for queryDate=${queryDate} and QA_PATIENT_ID=${requestedPatientId}`);
    }
    throw new Error(`runtime-ready entry not present for queryDate=${queryDate}`);
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

  const smokeRowLocator = page.locator('.reception-table__row').filter({
    hasText: appointmentEvidence.smokeEntry.receptionId ?? appointmentEvidence.smokeEntry.encounterKey,
  });
  await smokeRowLocator.first().waitFor({ timeout: 20_000 });
  await smokeRowLocator.locator('button[aria-label="カルテを開く"]').first().click();
  await page.locator('.charts-page').waitFor({ timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const start = document.getElementById('charts-action-start');
      return Boolean(start) && !start.hasAttribute('disabled') && !document.body.innerText.includes('指定された scheduleKey / encounterKey が見つかりません');
    },
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1000);

  const uiBeforeReload = await page.evaluate(() => {
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
      patientLabel: document.querySelector('.charts-patient-summary')?.textContent ?? null,
    };
  });
  if (uiBeforeReload.hasPlaceholderName || !uiBeforeReload.patientLabel?.includes(smokePatientDisplayName)) {
    throw new Error('smoke patient display name is not rendered in Charts UI');
  }

  await page.screenshot({ path: path.join(artifactRoot, 'charts-selected-entry-before-reload.png'), fullPage: true });

  await waitFor(
    () => responseLog.filter((entry) => entry.url.includes('/api/local/encounters/')).length >= 1,
    30_000,
  );
  await page.waitForTimeout(1000);

  const uiAfterReload = await page.evaluate(() => {
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
      patientLabel: document.querySelector('.charts-patient-summary')?.textContent ?? null,
    };
  });
  if (uiAfterReload.hasPlaceholderName || !uiAfterReload.patientLabel?.includes(smokePatientDisplayName)) {
    throw new Error('smoke patient display name regressed after summary refresh');
  }

  await page.screenshot({ path: path.join(artifactRoot, 'charts-selected-entry-after-refresh.png'), fullPage: true });

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
  await page.evaluate(() => {
    const start = document.getElementById('charts-action-start');
    const group = start?.parentElement;
    if (group && window.getComputedStyle(group).display === 'none') {
      group.style.display = 'grid';
    }
  });
  const startSelector = await clickFirstVisible(page, [
    '.charts-patient-summary__primary-action--start',
    '#charts-action-start',
    'button:has-text("診察開始")',
  ]);
  await waitFor(
    () =>
      responseLog.filter((entry) => entry.url.includes('/api/encounters/') && entry.url.includes('/transitions')).length >=
      transitionResponseCountBeforeStart + 1,
    30_000,
  );
  await page.waitForTimeout(1500);
  await waitFor(
    () => responseLog.filter((entry) => entry.url.includes('/api/local/encounters/')).length >= summaryResponseCountBeforeStart + 1,
    30_000,
  );
  await page.waitForTimeout(1000);

  const uiAfterStart = await page.evaluate(() => ({
    bodyText: document.body.innerText,
    hasPlaceholderName: document.body.innerText.includes('患者番号がありません'),
    successVisible:
      document.body.innerText.includes('診察開始を完了') || document.body.innerText.includes('checked_in -> chart_opened'),
    patientLabel: document.querySelector('.charts-patient-summary')?.textContent ?? null,
  }));
  if (uiAfterStart.hasPlaceholderName || !uiAfterStart.patientLabel?.includes(smokePatientDisplayName)) {
    throw new Error('smoke patient display name regressed after start transition');
  }

  await page.screenshot({ path: path.join(artifactRoot, 'charts-after-start.png'), fullPage: true });

  const result = {
    runId,
    baseURL,
    facilityId,
    smokeEncounterKey,
    smokeScheduleKey,
    login: {
      sessionMeStatus: sessionMe.status,
      sessionMeBody: sessionMe.body,
    },
    authoritativeReadEvidence: appointmentEvidence,
    chartsNav: {
      via: 'reception-card-open-charts',
      url: page.url(),
    },
    selectedEntryEvidence: {
      uiBeforeReload,
      uiAfterReload,
      printState,
    },
    startEvidence: {
      uiAfterStart,
      startSelector,
    },
    traces: {
      summaryRequests: requestLog.filter((entry) => entry.url.includes('/api/local/encounters/')),
      summaryResponses: responseLog.filter((entry) => entry.url.includes('/api/local/encounters/')),
      transitionRequests: requestLog.filter((entry) => entry.url.includes('/api/encounters/') && entry.url.includes('/transitions')),
      transitionResponses: responseLog.filter((entry) => entry.url.includes('/api/encounters/') && entry.url.includes('/transitions')),
      appointmentsRequests: requestLog.filter((entry) => entry.url.includes('/api/orca/official/appointments/list')),
      appointmentsResponses: responseLog.filter((entry) => entry.url.includes('/api/orca/official/appointments/list')),
      visitsRequests: requestLog.filter((entry) => entry.url.includes('/api/orca/official/visits/list')),
      visitsResponses: responseLog.filter((entry) => entry.url.includes('/api/orca/official/visits/list')),
    },
    counters: {
      pauseFinishRequests,
      billOperationBodies,
      blockedRouteHits,
    },
  };

  fs.writeFileSync(path.join(artifactRoot, 'runtime-ready-result.json'), JSON.stringify(result, null, 2));
  const blockedRouteSummary = Object.entries(blockedRouteHits).filter(([, count]) => count > 0);
  if (blockedRouteSummary.length > 0) {
    throw new Error(
      `runtime-ready smoke detected blocked route hits: ${blockedRouteSummary
        .map(([label, count]) => `${label}=${count}`)
        .join(', ')}`,
    );
  }
  console.log(JSON.stringify({ artifactRoot, result }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
