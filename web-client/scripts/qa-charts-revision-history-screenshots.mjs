import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toRunId = () => {
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  return `${iso}-cmd_20260206_23_sub_7-charts-revision-history-screenshots`;
};

const runId = process.env.RUN_ID ?? toRunId();
const repoRoot = path.resolve(process.cwd(), '..'); // web-client -> repo root

const artifactRoot = path.resolve(
  process.env.QA_ARTIFACT_DIR ?? path.join(repoRoot, 'artifacts', 'verification', runId, 'charts-revision-history-screenshots'),
);
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(repoRoot, 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

// NOTE: dev-only creds commonly used in this repo's QA scripts.
const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

const patientId = process.env.QA_PATIENT_ID ?? '01415';
const soapEncounterKey = `${patientId}::none::none::none`;
const soapHistoryStorageKey = `opendolphin:web-client:soap-history:v2:${facilityId}:${authUserId}`;
const encounterContextKey = `opendolphin:web-client:charts:encounter-context:v2:${facilityId}:${authUserId}`;

const buildSeedSoapHistory = () => {
  const t1 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const t2 = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const mk = (section, authoredAt, body, action) => ({
    id: `${section}-${authoredAt}`,
    section,
    body,
    authoredAt,
    authorRole: 'admin',
    authorName: 'QA admin',
    action,
    patientId,
  });
  const entries = [
    mk('free', t1, 'rev1 free: alpha', 'save'),
    mk('subjective', t1, 'rev1 subjective: cough', 'save'),
    mk('plan', t1, 'rev1 plan: rest', 'save'),
    mk('free', t2, 'rev2 free: alpha + beta', 'update'),
    mk('objective', t2, 'rev2 objective: temp 37.2', 'update'),
    mk('plan', t2, 'rev2 plan: rest + fluids', 'update'),
  ];
  return {
    version: 1,
    updatedAt: t2,
    encounters: {
      [soapEncounterKey]: {
        updatedAt: t2,
        entries,
      },
    },
  };
};

const applyMaskStyle = async (page) => {
  await page.addStyleTag({
    content: `
      #charts-patient-summary,
      .charts-workbench__column--left,
      #charts-patient-memo {
        filter: blur(10px) !important;
      }
    `,
  });
};

const startDevServer = async ({ port, flagValue }) => {
  const child = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', '-s', 'dev', '--', '--port', String(port), '--strictPort'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_CHARTS_REVISION_HISTORY: String(flagValue),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let buf = '';
  const readyNeedle = `http://localhost:${port}`;
  const timeoutAt = Date.now() + 60_000;

  const onData = (chunk) => {
    buf += chunk.toString('utf-8');
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  while (Date.now() < timeoutAt) {
    if (buf.includes(readyNeedle)) return child;
    if (child.exitCode != null) break;
    await sleep(150);
  }

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
  throw new Error(`dev server did not become ready on ${readyNeedle}. lastOutput=${buf.slice(-800)}`);
};

const stopDevServer = async (child) => {
  if (!child) return;
  if (child.exitCode != null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
  const timeoutAt = Date.now() + 10_000;
  while (Date.now() < timeoutAt) {
    if (child.exitCode != null) return;
    await sleep(100);
  }
  try {
    child.kill('SIGKILL');
  } catch {
    // ignore
  }
};

const runScenario = async ({ baseURL, expectRevisionButton, openDrawer, forceServerUnavailable }) => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, baseURL });

  const session = {
    facilityId,
    userId: authUserId,
    displayName: 'QA admin',
    clientUuid: `qa-${runId}`,
    runId,
    role: 'admin',
    roles: ['admin'],
  };

  const seededSoapHistory = buildSeedSoapHistory();

  await ctx.addInitScript(
    ([authKey, authValue, auth, soapKey, soapValue, encKey, encValue]) => {
      window.sessionStorage.setItem(authKey, authValue);

      window.sessionStorage.setItem('devFacilityId', auth.facilityId);
      window.sessionStorage.setItem('devUserId', auth.userId);
      window.sessionStorage.setItem('devClientUuid', auth.clientUuid);

      window.localStorage.setItem('devFacilityId', auth.facilityId);
      window.localStorage.setItem('devUserId', auth.userId);
      window.localStorage.setItem('devClientUuid', auth.clientUuid);

      // encounter context (to avoid "patient not selected" blocking too much UI)
      window.sessionStorage.setItem(encKey, encValue);

      // seed SOAP history so "差分" is visible without manual typing
      window.sessionStorage.setItem(soapKey, soapValue);
    },
    [
      'opendolphin:web-client:auth',
      JSON.stringify(session),
      {
        facilityId,
        userId: authUserId,
        passwordPlain: authPasswordPlain,
        clientUuid: session.clientUuid,
      },
      soapHistoryStorageKey,
      JSON.stringify(seededSoapHistory),
      encounterContextKey,
      JSON.stringify({ patientId }),
    ],
  );

  if (forceServerUnavailable) {
    // Force a non-JSON response to prove "server unavailable" UI does not crash.
    await ctx.route('**/api/charts/revisions**', async (route) => {
      await route.fulfill({
        status: 503,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<!doctype html><html><body>service unavailable</body></html>',
      });
    });
  }

  const page = await ctx.newPage();
  const consoleMemo = [];
  const networkMemo = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMemo.push({ type, text: msg.text(), location: msg.location(), ts: new Date().toISOString() });
    }
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!url.includes('/api/charts/revisions')) return;
    networkMemo.push({ kind: 'requestfailed', url, failure: req.failure(), ts: new Date().toISOString() });
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/api/charts/revisions')) return;
    try {
      networkMemo.push({
        kind: 'response',
        url,
        status: res.status(),
        contentType: res.headers()['content-type'] ?? null,
        ts: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  });

  const chartUrl = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}&runId=${encodeURIComponent(runId)}`;
  await page.goto(chartUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.charts-page').waitFor({ timeout: 30_000 });

  await page.waitForTimeout(800);
  await applyMaskStyle(page);

  const soapCard = page.locator('#charts-soap-note');
  await soapCard.waitFor({ timeout: 30_000 });
  await soapCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const revButton = soapCard.getByRole('button', { name: '版履歴' });
  const buttonCount = await revButton.count();
  if (expectRevisionButton && buttonCount === 0) {
    throw new Error('expected revision button, but not found');
  }
  if (!expectRevisionButton && buttonCount !== 0) {
    throw new Error('expected NO revision button, but it exists');
  }

  if (openDrawer) {
    await revButton.first().click({ timeout: 10_000 });
    await page.locator('.revision-drawer[data-open="true"]').waitFor({ timeout: 15_000 });
    // Wait until diff markers appear (best-effort) and server unavailable hint is rendered.
    await page.locator('.revision-drawer__item-changes').first().waitFor({ timeout: 15_000 });
    await page.locator('.revision-drawer__item-delta').first().waitFor({ timeout: 15_000 });
  }

  return {
    browser,
    ctx,
    page,
    soapCard,
    consoleMemo,
    networkMemo,
  };
};

const writeNotes = (notesPath, payload) => {
  const lines = [];
  lines.push(`# Charts Revision Drawer screenshots`);
  lines.push('');
  lines.push(`- RUN_ID: ${runId}`);
  lines.push(`- CreatedAt: ${new Date().toISOString()}`);
  lines.push(`- facilityId: ${facilityId}`);
  lines.push(`- patientId (URL param only): ${patientId}`);
  lines.push(`- seeded encounterKey: ${soapEncounterKey}`);
  lines.push(`- seeded soap history key: ${soapHistoryStorageKey}`);
  lines.push(`- seeded encounter context key: ${encounterContextKey}`);
  lines.push('');
  lines.push(`## Memo`);
  lines.push('');
  lines.push(payload.memo ?? '(none)');
  lines.push('');
  if (payload.networkMemo?.length) {
    lines.push(`## Network memo (filtered to /api/charts/revisions)`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(payload.networkMemo, null, 2));
    lines.push('```');
    lines.push('');
  }
  if (payload.consoleMemo?.length) {
    lines.push(`## Console memo (warnings/errors)`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(payload.consoleMemo, null, 2));
    lines.push('```');
    lines.push('');
  }
  fs.writeFileSync(notesPath, lines.join('\n'));
};

const main = async () => {
  const notesPath = path.join(artifactRoot, 'notes.md');
  const ports = {
    off: Number(process.env.QA_PORT_OFF ?? 4175),
    on: Number(process.env.QA_PORT_ON ?? 4176),
  };

  let server = null;
  const memo = { consoleMemo: [], networkMemo: [], memo: '' };

  try {
    // Scenario 1: flag OFF
    server = await startDevServer({ port: ports.off, flagValue: 0 });
    {
      const baseURL = `http://localhost:${ports.off}`;
      const s = await runScenario({ baseURL, expectRevisionButton: false, openDrawer: false, forceServerUnavailable: false });
      const shotPath = path.join(artifactRoot, '00-flag-off.png');
      await s.soapCard.screenshot({ path: shotPath });
      await s.ctx.close();
      await s.browser.close();
    }
    await stopDevServer(server);
    server = null;

    // Scenario 2: flag ON (drawer open + diff + server unavailable)
    server = await startDevServer({ port: ports.on, flagValue: 1 });
    {
      const baseURL = `http://localhost:${ports.on}`;
      const s1 = await runScenario({ baseURL, expectRevisionButton: true, openDrawer: false, forceServerUnavailable: false });
      await s1.soapCard.screenshot({ path: path.join(artifactRoot, '01-flag-on.png') });
      memo.consoleMemo.push(...s1.consoleMemo);
      memo.networkMemo.push(...s1.networkMemo);
      await s1.ctx.close();
      await s1.browser.close();

      const s2 = await runScenario({ baseURL, expectRevisionButton: true, openDrawer: true, forceServerUnavailable: true });
      await s2.soapCard.screenshot({ path: path.join(artifactRoot, '02-drawer-open-diff.png') });

      // Ensure "server unavailable" is shown (API absent/fails -> safe UI).
      await s2.page
        .locator('.revision-drawer__meta')
        .filter({ hasText: 'server unavailable:' })
        .waitFor({ timeout: 15_000 });
      await s2.soapCard.screenshot({ path: path.join(artifactRoot, '03-server-unavailable.png') });

      memo.consoleMemo.push(...s2.consoleMemo);
      memo.networkMemo.push(...s2.networkMemo);

      await s2.ctx.close();
      await s2.browser.close();
    }
  } finally {
    await stopDevServer(server);
  }

  memo.memo = [
    `- 00-flag-off.png: VITE_CHARTS_REVISION_HISTORY=0 -> 「版履歴」入口が出ない`,
    `- 01-flag-on.png:  VITE_CHARTS_REVISION_HISTORY=1 -> 「版履歴」入口が出る`,
    `- 02-drawer-open-diff.png: Drawer open + changed/delta 表示`,
    `- 03-server-unavailable.png: server API 未提供/失敗時でも落ちず "server unavailable" 表示`,
  ].join('\n');

  writeNotes(notesPath, memo);
  console.log(JSON.stringify({ runId, artifactRoot }, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
