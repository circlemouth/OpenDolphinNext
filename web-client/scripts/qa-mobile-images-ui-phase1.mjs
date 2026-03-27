import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toRunId = () => {
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  return `${iso}-cmd_20260207_11_sub_1-mobile-images-ui-phase1`;
};

const runId = process.env.RUN_ID ?? toRunId();
const repoRoot = path.resolve(process.cwd(), '..'); // web-client -> repo root

const artifactRoot = path.resolve(
  process.env.QA_ARTIFACT_DIR ?? path.join(repoRoot, 'artifacts', 'verification', runId, 'mobile-images-ui-phase1'),
);
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(repoRoot, 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

// NOTE: dev-only creds commonly used in this repo's QA scripts.
const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

const patientId = process.env.QA_PATIENT_ID ?? '01415';

const writePng = (outPath) => {
  // 1x1 PNG (opaque gray). No PHI.
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axlN9cAAAAASUVORK5CYII=';
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
};

const applyMaskStyle = async (page) => {
  await page.addStyleTag({
    content: `
      [data-test-id="mobile-patient-id-input"],
      [data-test-id="mobile-images-status"] {
        filter: blur(8px) !important;
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
        VITE_DISABLE_MSW: '0',
        VITE_PATIENT_IMAGES_MOBILE_UI: '1',
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

const buildContext = async ({ baseURL, harPath, routeMode }) => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders:
      routeMode === '404'
        ? { 'x-force-images-status': '404' }
        : routeMode === '413'
          ? { 'x-force-images-status': '413' }
          : routeMode === '415'
            ? { 'x-force-images-status': '415' }
            : routeMode === 'network'
              ? { 'x-force-images-network-error': '1' }
              : undefined,
    recordHar: { path: harPath, content: 'embed', mode: 'minimal' },
  });

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
    ([authKey, authValue, auth]) => {
      window.sessionStorage.setItem(authKey, authValue);

      window.sessionStorage.setItem('devFacilityId', auth.facilityId);
      window.sessionStorage.setItem('devUserId', auth.userId);
      window.sessionStorage.setItem('devClientUuid', auth.clientUuid);

      window.localStorage.setItem('devFacilityId', auth.facilityId);
      window.localStorage.setItem('devUserId', auth.userId);
      window.localStorage.setItem('devClientUuid', auth.clientUuid);
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
    ],
  );

  return { browser, ctx };
};

const driveUploadOnce = async ({ ctx, label, shotPrefix, uploadPath, memo }) => {
  const page = await ctx.newPage();

  const networkMemo = [];
  const consoleMemo = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMemo.push({ type, text: msg.text(), location: msg.location(), ts: new Date().toISOString() });
    }
  });

  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes('/patients/') || !url.includes('/images')) return;
    const headers = req.headers();
    networkMemo.push({
      kind: 'request',
      method: req.method(),
      url,
      hasFeatureHeader: headers['x-feature-images'] ?? headers['X-Feature-Images'] ?? null,
      ts: new Date().toISOString(),
    });
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/patients/') || !url.includes('/images')) return;
    try {
      networkMemo.push({
        kind: 'response',
        method: res.request().method(),
        url,
        status: res.status(),
        contentType: res.headers()['content-type'] ?? null,
        ts: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  });

  const url = `/f/${encodeURIComponent(facilityId)}/m/images?runId=${encodeURIComponent(runId)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('[data-test-id="mobile-images-page"]').waitFor({ timeout: 30_000 });

  // 1) patient select
  await page.locator('[data-test-id="mobile-patient-id-input"]').fill(patientId);
  await page.locator('[data-test-id="mobile-patient-commit"]').click();
  await page.locator('[data-test-id="mobile-image-file-input"]').waitFor({ timeout: 10_000 });
  await page.locator('[data-test-id="mobile-image-file-input"]').setInputFiles(uploadPath);

  // 2) send
  await page.locator('[data-test-id="mobile-image-send"]').click();

  if (label === 'success') {
    await page.locator('[data-test-id="mobile-images-status"]').getByText('送信しました。').waitFor({ timeout: 30_000 });
    await page.locator('[data-test-id="mobile-images-list"]').first().waitFor({ timeout: 15_000 });
  } else {
    await page.locator('[data-test-id="mobile-image-retry"]').waitFor({ timeout: 30_000 });
  }

  await sleep(500);
  await applyMaskStyle(page);

  await page.screenshot({ path: path.join(artifactRoot, `${shotPrefix}.png`), fullPage: true });

  memo.networkMemo.push({ label, entries: networkMemo });
  memo.consoleMemo.push({ label, entries: consoleMemo });

  await page.close();
};

const writeNotes = (notesPath, payload) => {
  const lines = [];
  lines.push('# Mobile Images UI Phase1');
  lines.push('');
  lines.push(`- RUN_ID: ${runId}`);
  lines.push(`- CreatedAt: ${new Date().toISOString()}`);
  lines.push(`- facilityId: ${facilityId}`);
  lines.push(`- patientId (masked in screenshots): ${patientId}`);
  lines.push(`- route: /f/:facilityId/m/images`);
  lines.push(`- feature flag: VITE_PATIENT_IMAGES_MOBILE_UI=1`);
  lines.push(`- server gate header: X-Feature-Images: 1`);
  lines.push(`- API (web-client path): /patients/{patientId}/images  (dev proxy => /openDolphin/resources/patients/{patientId}/images)`);
  lines.push('');
  lines.push('## Scenarios');
  lines.push('');
  lines.push('- success: upload -> 完了 -> 一覧反映');
  lines.push('- error: 404(feature gate) / 413 / 415 / network_error をシミュレートし、文言+Retry を確認');
  lines.push('');
  lines.push('## Files');
  lines.push('');
  lines.push('- screenshots: `00-success.png`, `10-error-404.png`, `11-error-413.png`, `12-error-415.png`, `13-error-network.png`');
  lines.push('- HAR: `success.har`, `error-404.har`, `error-413.har`, `error-415.har`, `error-network.har`');
  lines.push('- network memo: `network.json`');
  lines.push('');
  if (payload.networkMemo?.length) {
    lines.push('## Network Memo');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(payload.networkMemo, null, 2));
    lines.push('```');
    lines.push('');
  }
  if (payload.consoleMemo?.length) {
    lines.push('## Console Memo (warnings/errors)');
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
  const networkJsonPath = path.join(artifactRoot, 'network.json');
  const uploadPath = path.join(artifactRoot, 'upload.png');
  writePng(uploadPath);

  const port = Number(process.env.QA_PORT ?? 4191);
  const memo = { networkMemo: [], consoleMemo: [] };

  let server = null;
  try {
    server = await startDevServer({ port });
    const baseURL = `http://localhost:${port}`;

    // success
    {
      const { browser, ctx } = await buildContext({ baseURL, harPath: path.join(artifactRoot, 'success.har'), routeMode: 'none' });
      await driveUploadOnce({ ctx, label: 'success', shotPrefix: '00-success', uploadPath, memo });
      await ctx.close();
      await browser.close();
    }

    // 404 gate
    {
      const { browser, ctx } = await buildContext({ baseURL, harPath: path.join(artifactRoot, 'error-404.har'), routeMode: '404' });
      await driveUploadOnce({ ctx, label: '404', shotPrefix: '10-error-404', uploadPath, memo });
      await ctx.close();
      await browser.close();
    }

    // 413
    {
      const { browser, ctx } = await buildContext({ baseURL, harPath: path.join(artifactRoot, 'error-413.har'), routeMode: '413' });
      await driveUploadOnce({ ctx, label: '413', shotPrefix: '11-error-413', uploadPath, memo });
      await ctx.close();
      await browser.close();
    }

    // 415
    {
      const { browser, ctx } = await buildContext({ baseURL, harPath: path.join(artifactRoot, 'error-415.har'), routeMode: '415' });
      await driveUploadOnce({ ctx, label: '415', shotPrefix: '12-error-415', uploadPath, memo });
      await ctx.close();
      await browser.close();
    }

    // network error
    {
      const { browser, ctx } = await buildContext({ baseURL, harPath: path.join(artifactRoot, 'error-network.har'), routeMode: 'network' });
      await driveUploadOnce({ ctx, label: 'network', shotPrefix: '13-error-network', uploadPath, memo });
      await ctx.close();
      await browser.close();
    }
  } finally {
    fs.writeFileSync(networkJsonPath, JSON.stringify(memo.networkMemo, null, 2));
    writeNotes(notesPath, memo);
    await stopDevServer(server);
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
