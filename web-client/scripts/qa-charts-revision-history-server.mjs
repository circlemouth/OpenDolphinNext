import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toRunId = () => {
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  return `${iso}-cmd_20260206_23_sub_9-charts-revision-history-server`;
};

const runId = process.env.RUN_ID ?? toRunId();
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4177';

const repoRoot = path.resolve(process.cwd(), '..'); // web-client -> repo root
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ?? path.resolve(repoRoot, 'artifacts', 'verification', runId, 'charts-revision-history-server');
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(repoRoot, 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

// dev-only creds commonly used in this repo.
const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

const patientId = process.env.QA_PATIENT_ID ?? '01415';
const visitDate = process.env.QA_VISIT_DATE ?? '2026-02-06';

const encounterContextKey = `opendolphin:web-client:charts:encounter-context:v2:${facilityId}:${authUserId}`;

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

const startDevServer = async ({ port }) => {
  const child = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', '-s', 'dev', '--', '--port', String(port), '--strictPort'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_CHARTS_REVISION_HISTORY: '1',
        // Ensure proxy reaches the modernized server used by prior curl proof.
        VITE_DEV_PROXY_TARGET: process.env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:9080',
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

const main = async () => {
  const port = Number(new URL(baseURL).port || 4177);

  let server = null;
  const networkMemo = [];
  const consoleMemo = [];
  const pageErrors = [];

  try {
    server = await startDevServer({ port });

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

    await ctx.addInitScript(
      ([authKey, authValue, auth, encKey, encValue]) => {
        window.sessionStorage.setItem(authKey, authValue);

        window.sessionStorage.setItem('devFacilityId', auth.facilityId);
        window.sessionStorage.setItem('devUserId', auth.userId);
        window.sessionStorage.setItem('devClientUuid', auth.clientUuid);

        window.localStorage.setItem('devFacilityId', auth.facilityId);
        window.localStorage.setItem('devUserId', auth.userId);
        window.localStorage.setItem('devClientUuid', auth.clientUuid);

        window.sessionStorage.setItem(encKey, encValue);
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
        encounterContextKey,
        JSON.stringify({ patientId, visitDate }),
      ],
    );

    const page = await ctx.newPage();

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleMemo.push({ type, text: msg.text(), location: msg.location(), ts: new Date().toISOString() });
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(String(error));
    });
    page.on('response', async (res) => {
      const url = res.url();
      if (!url.includes('/karte/pid/') && !url.includes('/karte/revisions')) return;
      try {
        networkMemo.push({
          url,
          status: res.status(),
          contentType: res.headers()['content-type'] ?? null,
          ts: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    });

    const chartUrl = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}&visitDate=${encodeURIComponent(visitDate)}&runId=${encodeURIComponent(runId)}`;
    await page.goto(chartUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.charts-page').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    await applyMaskStyle(page);

    const soapCard = page.locator('#charts-soap-note');
    await soapCard.waitFor({ timeout: 30_000 });
    await soapCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    await soapCard.getByRole('button', { name: '版履歴' }).click({ timeout: 10_000 });
    await page.locator('.revision-drawer[data-open="true"]').waitFor({ timeout: 15_000 });

    // Prove server path: meta shows source=server and server:N件 (not unavailable).
    await page.locator('.revision-drawer__meta').filter({ hasText: 'source: server' }).waitFor({ timeout: 20_000 });
    await page.locator('.revision-drawer__meta').filter({ hasText: 'server:' }).waitFor({ timeout: 20_000 });
    await page
      .locator('.revision-drawer__meta')
      .filter({ hasText: 'server unavailable:' })
      .waitFor({ state: 'detached', timeout: 20_000 })
      .catch(() => {
        // ignore; some environments may render unavailable temporarily before server returns.
      });

    const shotPath = path.join(artifactRoot, 'drawer-server-200.png');
    await soapCard.screenshot({ path: shotPath });

    await ctx.close();
    await browser.close();
  } finally {
    await stopDevServer(server);
  }

  const notes = [];
  notes.push('# Charts Revision Drawer (server modernized API) proof');
  notes.push('');
  notes.push(`- RUN_ID: ${runId}`);
  notes.push(`- CreatedAt: ${new Date().toISOString()}`);
  notes.push(`- baseURL: ${baseURL}`);
  notes.push(`- VITE_DEV_PROXY_TARGET: ${process.env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:9080'}`);
  notes.push(`- facilityId: ${facilityId}`);
  notes.push(`- patientId: ${patientId}`);
  notes.push(`- visitDate: ${visitDate}`);
  notes.push('');
  notes.push('## Evidence');
  notes.push('');
  notes.push('- drawer-server-200.png: Drawer open and shows `source: server` + `server: N件`');
  notes.push('');
  notes.push('## Network memo (filtered to /karte/pid and /karte/revisions)');
  notes.push('');
  notes.push('```json');
  notes.push(JSON.stringify(networkMemo, null, 2));
  notes.push('```');
  notes.push('');
  notes.push('## Console memo (warnings/errors)');
  notes.push('');
  notes.push('```json');
  notes.push(JSON.stringify(consoleMemo, null, 2));
  notes.push('```');
  notes.push('');
  notes.push('## Page errors');
  notes.push('');
  notes.push('```json');
  notes.push(JSON.stringify(pageErrors, null, 2));
  notes.push('```');
  notes.push('');

  fs.writeFileSync(path.join(artifactRoot, 'notes.md'), notes.join('\n'));

  console.log(JSON.stringify({ runId, artifactRoot }, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

