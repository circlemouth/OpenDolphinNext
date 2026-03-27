import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toRunId = () => {
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  return `${iso}-cmd_20260207_10_sub_3-images-phaseA-web`;
};

const runId = process.env.RUN_ID ?? toRunId();
const repoRoot = path.resolve(process.cwd(), '..'); // web-client -> repo root

const artifactRoot = path.resolve(
  process.env.QA_ARTIFACT_DIR ?? path.join(repoRoot, 'artifacts', 'verification', runId, 'images-phaseA-web'),
);
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(repoRoot, 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

// NOTE: dev-only creds commonly used in this repo's QA scripts.
const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

const patientId = process.env.QA_PATIENT_ID ?? '01415';
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

const writePng = (outPath) => {
  // 1x1 PNG (opaque gray). No PHI.
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axlN9cAAAAASUVORK5CYII=';
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
};

const startDevServer = async ({ port, imagesFlagValue }) => {
  const child = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', '-s', 'dev', '--', '--port', String(port), '--strictPort'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Ensure MSW is enabled so PhaseA proof is not blocked by pending server API.
        VITE_DISABLE_MSW: '0',
        VITE_PATIENT_IMAGES_MVP: String(imagesFlagValue),
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

const runScenario = async ({ baseURL, expectImagesEntry, uploadAndInsertSoap }) => {
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
      JSON.stringify({ patientId }),
    ],
  );

  const page = await ctx.newPage();

  const consoleMemo = [];
  const networkMemo = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMemo.push({ type, text: msg.text(), location: msg.location(), ts: new Date().toISOString() });
    }
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/karte/') && !url.includes('/mock/thumbnail/')) return;
    try {
      networkMemo.push({
        url,
        method: res.request().method(),
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

  // Open the utility drawer (it may be collapsed by default).
  await page.keyboard.press('Control+Shift+U');
  const dockedTabs = page.locator('.charts-docked-panel__tabs');
  await dockedTabs.waitFor({ timeout: 30_000 });

  const imagesTab = dockedTabs.getByRole('tab', { name: /画像/ });
  const imagesTabCount = await imagesTab.count();
  if (expectImagesEntry && imagesTabCount === 0) throw new Error('expected images utility entry, but not found');
  if (!expectImagesEntry && imagesTabCount !== 0) throw new Error('expected NO images utility entry, but it exists');

  if (uploadAndInsertSoap) {
    const uploadPath = path.join(artifactRoot, 'upload.png');
    writePng(uploadPath);

    await imagesTab.first().click({ timeout: 10_000 });
    const imagePanel = page.locator('[data-test-id="charts-image-panel"]');
    await imagePanel.waitFor({ timeout: 20_000 });

    const fileInput = imagePanel.locator('[data-test-id="image-file-input"]');
    await fileInput.setInputFiles(uploadPath);

    // Wait until upload is reported as success.
    await page.locator('[data-test-id="image-upload-status"]').getByText('アップロードしました。').waitFor({ timeout: 30_000 });

    // Wait until the uploaded item shows in the thumbnail list (MSW in-memory store).
    const thumbList = imagePanel.locator('[data-test-id="image-thumbnail-list"]');
    await thumbList.getByText('upload.png').waitFor({ timeout: 30_000 });

    // Insert SOAP link from the uploaded card.
    const targetCard = thumbList.locator('.charts-image-panel__card', { hasText: 'upload.png' }).first();
    await targetCard.getByRole('button', { name: 'SOAPへ貼付' }).click({ timeout: 10_000 });

    const freeNote = page.locator('#soap-note-free');
    await freeNote.waitFor({ timeout: 20_000 });
    const timeoutAt = Date.now() + 15_000;
    let inserted = false;
    while (Date.now() < timeoutAt) {
      const v = await freeNote.inputValue();
      if (v.includes('attachment:')) {
        inserted = true;
        break;
      }
      await page.waitForTimeout(200);
    }
    if (!inserted) throw new Error('expected SOAP free note to include attachment placeholder, but it did not');

    return { browser, ctx, page, dockedTabs, imagePanel, consoleMemo, networkMemo };
  }

  return { browser, ctx, page, dockedTabs, consoleMemo, networkMemo };
};

const writeNotes = (notesPath, payload) => {
  const lines = [];
  lines.push('# Images PhaseA (web-client)');
  lines.push('');
  lines.push(`- RUN_ID: ${runId}`);
  lines.push(`- CreatedAt: ${new Date().toISOString()}`);
  lines.push(`- facilityId: ${facilityId}`);
  lines.push(`- patientId (URL param only): ${patientId}`);
  lines.push(`- feature flag: VITE_PATIENT_IMAGES_MVP`);
  lines.push(`- MSW: enabled (VITE_DISABLE_MSW=0)`);
  lines.push('');
  lines.push('## Memo');
  lines.push('');
  lines.push(payload.memo ?? '(none)');
  lines.push('');
  if (payload.networkMemo?.length) {
    lines.push('## Network memo (filtered to /karte/*, /mock/thumbnail/*)');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(payload.networkMemo, null, 2));
    lines.push('```');
    lines.push('');
  }
  if (payload.consoleMemo?.length) {
    lines.push('## Console memo (warnings/errors)');
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
    off: Number(process.env.QA_PORT_OFF ?? 4183),
    on: Number(process.env.QA_PORT_ON ?? 4184),
  };

  let server = null;
  const memo = { consoleMemo: [], networkMemo: [], memo: '' };

  try {
    // Scenario 1: flag OFF (entry hidden)
    server = await startDevServer({ port: ports.off, imagesFlagValue: 0 });
    {
      const baseURL = `http://localhost:${ports.off}`;
      const s = await runScenario({ baseURL, expectImagesEntry: false, uploadAndInsertSoap: false });
      await s.dockedTabs.screenshot({ path: path.join(artifactRoot, '00-flag-off.png') });
      memo.consoleMemo.push(...s.consoleMemo);
      memo.networkMemo.push(...s.networkMemo);
      await s.ctx.close();
      await s.browser.close();
    }
    await stopDevServer(server);
    server = null;

    // Scenario 2: flag ON (upload -> list -> SOAP link)
    server = await startDevServer({ port: ports.on, imagesFlagValue: 1 });
    {
      const baseURL = `http://localhost:${ports.on}`;
      const s = await runScenario({ baseURL, expectImagesEntry: true, uploadAndInsertSoap: true });
      await s.imagePanel.screenshot({ path: path.join(artifactRoot, '01-images-panel-after-upload.png') });
      await s.page.locator('#charts-soap-note').screenshot({ path: path.join(artifactRoot, '02-soap-note-with-image-link.png') });
      await s.dockedTabs.screenshot({ path: path.join(artifactRoot, '03-flag-on-entry.png') });
      memo.consoleMemo.push(...s.consoleMemo);
      memo.networkMemo.push(...s.networkMemo);
      await s.ctx.close();
      await s.browser.close();
    }

    memo.memo = [
      'Proof:',
      '- flag OFF: "画像" utility entry is hidden.',
      '- flag ON: upload a png -> saved (MSW) -> appears in list -> "SOAPへ貼付" inserts `[画像:...](attachment:...)` into SOAP Free.',
      '',
      'Note: MSW handlers persist images in-memory to support PhaseA proof while server API is pending.',
    ].join('\n');
  } catch (err) {
    memo.memo = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    throw err;
  } finally {
    writeNotes(notesPath, memo);
    await stopDevServer(server);
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
