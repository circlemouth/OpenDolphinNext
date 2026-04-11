import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, request as playwrightRequest } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const toRunId = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const nowIso = () => new Date().toISOString();

const sanitize = (value) =>
  String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const firstEnv = (keys) => {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  return '';
};

const requireEnv = (label, keys) => {
  const value = firstEnv(keys);
  if (!value) {
    throw new Error(`${label} is required. Set one of: ${keys.join(', ')}`);
  }
  return value;
};

const parseBooleanEnv = (key, defaultValue) => {
  const raw = process.env[key];
  if (raw == null) return defaultValue;
  const value = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return defaultValue;
};

const parseIntegerEnv = (key, defaultValue) => {
  const raw = process.env[key];
  if (raw == null || raw.trim() === '') return defaultValue;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return defaultValue;
  return value;
};

const truncateText = (value, max = 2000) => {
  if (value == null) return null;
  const asString = typeof value === 'string' ? value : String(value);
  if (asString.length <= max) return asString;
  return `${asString.slice(0, max)}...`;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RUN_ID = firstEnv(['RUN_ID']) || toRunId();
const BASE_URL = requireEnv('BASE_URL', ['BASE_URL', 'QA_BASE_URL', 'PLAYWRIGHT_BASE_URL']);
const FACILITY_ID = requireEnv('FACILITY_ID', ['FACILITY_ID', 'QA_FACILITY_ID', 'QA_LOGIN_FACILITY_ID']);
const LOGIN_USER_ID = requireEnv('LOGIN_USER_ID', ['LOGIN_USER_ID', 'USER_ID', 'QA_USER_ID', 'QA_LOGIN_USER_ID']);
const LOGIN_PASSWORD = requireEnv('LOGIN_PASSWORD', [
  'LOGIN_PASSWORD',
  'PASSWORD',
  'QA_PASSWORD',
  'QA_PASSWORD_PLAIN',
  'QA_LOGIN_PASSWORD',
]);
const LOGIN_FACTOR2_CODE = firstEnv(['LOGIN_FACTOR2_CODE', 'QA_LOGIN_FACTOR2_CODE']);

const HEADLESS = parseBooleanEnv('HEADLESS', true);
const NAV_TIMEOUT_MS = parseIntegerEnv('QA_NAV_TIMEOUT_MS', 30000);
const STEP_WAIT_MS = parseIntegerEnv('QA_STEP_WAIT_MS', 1200);
const DEV_PROXY_TARGET = firstEnv(['VITE_DEV_PROXY_TARGET', 'DEV_PROXY_TARGET']) || 'http://localhost:9080/openDolphin/resources';
const BACKEND_ORIGIN = (() => {
  const explicit = firstEnv(['BACKEND_ORIGIN']);
  if (explicit) return explicit;
  try {
    return new URL(DEV_PROXY_TARGET).origin;
  } catch {
    return 'http://localhost:9080';
  }
})();
const BACKEND_BOOTSTRAP_PATH = firstEnv(['BACKEND_BOOTSTRAP_PATH']) || '/openDolphin/';
const BACKEND_BOOTSTRAP_URL = new URL(
  BACKEND_BOOTSTRAP_PATH,
  `${BACKEND_ORIGIN.replace(/\/$/, '')}/`,
).toString();

const OUTPUT_ROOT = path.resolve(
  process.env.OUTPUT_DIR
    ?? path.join(REPO_ROOT, 'artifacts', 'webclient', 'unused-api-audit', RUN_ID),
);

const TARGETS = [
  {
    id: 'orca-master-generic-price',
    endpoint: '/api/orca/master/generic-price',
    match: /\/(?:api\/)?orca\/master\/generic-price(?:[/?#]|$)/,
  },
  {
    id: 'orca-master-hokenja',
    endpoint: '/api/orca/master/hokenja',
    match: /\/(?:api\/)?orca\/master\/hokenja(?:[/?#]|$)/,
  },
  {
    id: 'orca-master-address',
    endpoint: '/api/orca/master/address',
    match: /\/(?:api\/)?orca\/master\/address(?:[/?#]|$)/,
  },
  {
    id: 'orca-tensu-ten',
    endpoint: '/orca/tensu/ten/*',
    match: /\/(?:api\/)?orca\/tensu\/ten\//,
  },
  {
    id: 'orca-interaction',
    endpoint: '/orca/interaction',
    match: /\/(?:api\/)?orca\/interaction(?:[/?#]|$)/,
  },
  {
    id: 'orca-inputset',
    endpoint: '/orca/inputset',
    match: /\/(?:api\/)?orca\/inputset(?:[/?#]|$)/,
  },
  {
    id: 'touch-all',
    endpoint: '/touch/*',
    match: /\/(?:api\/)?touch\//,
  },
  {
    id: 'jtouch-all',
    endpoint: '/jtouch/*',
    match: /\/(?:api\/)?(?:10\/adm\/)?jtouch\//,
  },
  {
    id: 'adm-phr',
    endpoint: '/20/adm/phr/*',
    match: /\/(?:api\/)?20\/adm\/phr(?:[/?#]|$)/,
  },
  {
    id: 'adm-all',
    endpoint: '/20/adm/*',
    match: /\/(?:api\/)?20\/adm\/(?!phr(?:[/?#]|$))/,
  },
  {
    id: 'orca-tensu-sync',
    endpoint: '/orca/tensu/sync',
    match: /\/(?:api\/)?orca\/tensu\/sync(?:[/?#]|$)/,
  },
];

const TRACKED_PATH_PATTERN = /\/(?:api\/)?(?:orca|touch|jtouch|20\/adm|session|admin)(?:[/?#]|$)/;

const parseUrlPath = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const isTrackedUrl = (url) => TRACKED_PATH_PATTERN.test(parseUrlPath(url));

const detectMatchedTargets = (url) => TARGETS.filter((target) => target.match.test(url));

const createTargetSummary = () =>
  Object.fromEntries(
    TARGETS.map((target) => [
      target.endpoint,
      {
        endpoint: target.endpoint,
        requestCount: 0,
        responseCount: 0,
        requestFailureCount: 0,
        blockedCount: 0,
        statuses: {},
        sampleUrls: [],
      },
    ]),
  );

const addSampleUrl = (summary, url) => {
  if (!summary) return;
  if (summary.sampleUrls.length >= 6) return;
  if (summary.sampleUrls.includes(url)) return;
  summary.sampleUrls.push(url);
};

const bumpSummary = (scenario, matchedTargets, kind, payload = {}) => {
  for (const target of matchedTargets) {
    const summary = scenario.targetSummary[target.endpoint];
    if (!summary) continue;
    if (kind === 'request') summary.requestCount += 1;
    if (kind === 'response') {
      summary.responseCount += 1;
      const statusKey = String(payload.status ?? 'unknown');
      summary.statuses[statusKey] = (summary.statuses[statusKey] ?? 0) + 1;
    }
    if (kind === 'requestFailure') summary.requestFailureCount += 1;
    if (kind === 'blocked') summary.blockedCount += 1;
    if (payload.url) addSampleUrl(summary, payload.url);
  }
};

const buildScenarioName = (blockTarget) =>
  blockTarget ? `block-${sanitize(blockTarget.endpoint)}` : 'baseline';

const buildScenarioReportPath = (scenarioDir) => path.join(scenarioDir, 'scenario-report.json');

const readServiceWorkerInfo = async (page) =>
  page.evaluate(async () => {
    if (!(typeof navigator !== 'undefined' && 'serviceWorker' in navigator)) {
      return { supported: false, controlled: false, registrations: [] };
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    return {
      supported: true,
      controlled: Boolean(navigator.serviceWorker.controller),
      registrations: registrations.map((registration) => ({
        scope: registration.scope,
        scriptURL:
          registration.active?.scriptURL
          || registration.installing?.scriptURL
          || registration.waiting?.scriptURL
          || null,
      })),
    };
  });

const extractCsrfTokenFromHtml = (html) => {
  if (!html) return null;
  const match = html.match(/meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  return match?.[1]?.trim() || null;
};

const extractSessionIdFromHeaders = (headersArray = []) => {
  const setCookie = headersArray.find(
    (header) => String(header.name).toLowerCase() === 'set-cookie' && /JSESSIONID=/i.test(String(header.value)),
  );
  if (!setCookie) return null;
  const match = String(setCookie.value).match(/JSESSIONID=([^;]+)/i);
  return match?.[1] ?? null;
};

const extractSessionIdFromSetCookieHeader = (headerValue) => {
  if (!headerValue) return null;
  const match = String(headerValue).match(/JSESSIONID=([^;]+)/i);
  return match?.[1] ?? null;
};

const createSessionCookiePayload = (sessionId, cookiePath = '/') => {
  if (!sessionId) return null;
  let hostName = 'localhost';
  let secure = false;
  try {
    const base = new URL(BASE_URL);
    hostName = base.hostname;
    secure = base.protocol === 'https:';
  } catch {
    // fall back to localhost/http
  }
  return {
    name: 'JSESSIONID',
    value: sessionId,
    domain: hostName,
    path: cookiePath,
    httpOnly: true,
    secure,
    sameSite: 'Lax',
  };
};

const applyCsrfTokenToPage = async (page, token) => {
  if (!token) return false;
  await page.evaluate((csrfToken) => {
    const apply = () => {
      let meta = document.querySelector("meta[name='csrf-token']");
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', csrfToken);
    };
    apply();
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }, token);
  return true;
};

const bootstrapCsrfState = async (sessionId) => {
  const apiContext = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: sessionId ? { Cookie: `JSESSIONID=${sessionId}` } : undefined,
  });

  try {
    const response = await apiContext.get(BACKEND_BOOTSTRAP_URL, { failOnStatusCode: false });
    const body = await response.text();
    const csrfToken = extractCsrfTokenFromHtml(body);
    const responseSessionId = extractSessionIdFromHeaders(response.headersArray());
    return {
      status: response.status(),
      csrfToken,
      sessionId: responseSessionId ?? sessionId ?? null,
    };
  } finally {
    await apiContext.dispose();
  }
};

const resolveContextSessionSnapshot = async (context) => {
  const cookies = await context.cookies();
  const sessionCookies = cookies.filter((cookie) => cookie.name === 'JSESSIONID');
  const sorted = [...sessionCookies].sort((a, b) => {
    const score = (cookie) => {
      if (cookie.path?.startsWith('/openDolphin')) return 400;
      if (cookie.path?.startsWith('/api/api')) return 300;
      if (cookie.path?.startsWith('/api')) return 200;
      if (cookie.path === '/') return 100;
      return 0;
    };
    return score(b) - score(a);
  });
  return {
    all: sessionCookies,
    preferred: sorted[0] ?? null,
  };
};

const buildScenarioSeed = (blockTarget) => {
  const scenarioName = buildScenarioName(blockTarget);
  const scenarioDir = path.join(OUTPUT_ROOT, scenarioName);
  const screenshotDir = path.join(scenarioDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  return {
    scenario: scenarioName,
    startedAt: nowIso(),
    finishedAt: null,
    blockTarget: blockTarget
      ? {
          id: blockTarget.id,
          endpoint: blockTarget.endpoint,
          routePattern: String(blockTarget.match),
          routeAbortApplied: true,
          routeAbortTriggered: false,
          routeNotTriggered: false,
          blockedHits: [],
        }
      : {
          id: null,
          endpoint: null,
          routePattern: null,
          routeAbortApplied: false,
          routeAbortTriggered: false,
          routeNotTriggered: false,
          blockedHits: [],
        },
    serviceWorker: {
      login: null,
      operational: null,
    },
    login: {
      facilityId: FACILITY_ID,
      userId: LOGIN_USER_ID,
      factor2CodeProvided: Boolean(LOGIN_FACTOR2_CODE),
    },
    steps: [],
    requests: [],
    responses: [],
    requestFailures: [],
    consoleMessages: [],
    pageErrors: [],
    targetSummary: createTargetSummary(),
    untriggeredEndpoints: [],
    artifacts: {
      scenarioDir,
      screenshotDir,
      screenshots: [],
      reportPath: buildScenarioReportPath(scenarioDir),
    },
    fatalError: null,
  };
};

const captureStepScreenshot = async (page, scenario, stepName) => {
  const shotName = `${String(scenario.steps.length + 1).padStart(2, '0')}-${sanitize(stepName)}.png`;
  const absolutePath = path.join(scenario.artifacts.screenshotDir, shotName);
  await page.screenshot({ path: absolutePath, fullPage: true });
  const relativePath = path.relative(scenario.artifacts.scenarioDir, absolutePath);
  scenario.artifacts.screenshots.push(relativePath);
  return relativePath;
};

const attachCollectors = (page, scenario, runtimeState) => {
  page.on('request', (request) => {
    const url = request.url();
    if (!isTrackedUrl(url)) return;

    const matchedTargets = detectMatchedTargets(url);
    scenario.requests.push({
      time: nowIso(),
      step: runtimeState.currentStep,
      url,
      path: parseUrlPath(url),
      method: request.method(),
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      frameUrl: request.frame()?.url() ?? null,
      matchedTargets: matchedTargets.map((target) => target.endpoint),
    });

    bumpSummary(scenario, matchedTargets, 'request', { url });
  });

  page.on('response', async (response) => {
    const url = response.url();
    const setCookieHeader = response.headers()['set-cookie'] ?? null;
    const responseSessionId = extractSessionIdFromSetCookieHeader(setCookieHeader);
    if (responseSessionId) {
      runtimeState.activeSessionId = responseSessionId;
    }
    if (!isTrackedUrl(url)) return;

    const request = response.request();
    const matchedTargets = detectMatchedTargets(url);
    scenario.responses.push({
      time: nowIso(),
      step: runtimeState.currentStep,
      url,
      path: parseUrlPath(url),
      method: request.method(),
      status: response.status(),
      statusText: response.statusText(),
      fromServiceWorker: response.fromServiceWorker(),
      contentType: response.headers()['content-type'] ?? null,
      frameUrl: request.frame()?.url() ?? null,
      matchedTargets: matchedTargets.map((target) => target.endpoint),
    });

    bumpSummary(scenario, matchedTargets, 'response', { url, status: response.status() });
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!isTrackedUrl(url)) return;

    const matchedTargets = detectMatchedTargets(url);
    scenario.requestFailures.push({
      time: nowIso(),
      step: runtimeState.currentStep,
      url,
      path: parseUrlPath(url),
      method: request.method(),
      failureText: request.failure()?.errorText ?? 'unknown',
      frameUrl: request.frame()?.url() ?? null,
      matchedTargets: matchedTargets.map((target) => target.endpoint),
    });

    bumpSummary(scenario, matchedTargets, 'requestFailure', { url });
  });

  page.on('console', (message) => {
    scenario.consoleMessages.push({
      time: nowIso(),
      step: runtimeState.currentStep,
      type: message.type(),
      text: truncateText(message.text(), 4000),
      location: message.location(),
    });
  });

  page.on('pageerror', (error) => {
    scenario.pageErrors.push({
      time: nowIso(),
      step: runtimeState.currentStep,
      message: truncateText(error?.message ?? 'unknown'),
      stack: truncateText(error?.stack ?? ''),
    });
  });
};

const withStep = async (page, scenario, runtimeState, stepName, action, options = {}) => {
  const step = {
    name: stepName,
    startedAt: nowIso(),
    endedAt: null,
    ok: false,
    error: null,
    details: null,
    screenshot: null,
    url: null,
  };

  runtimeState.currentStep = stepName;

  try {
    const details = await action();
    step.ok = true;
    step.details = details ?? null;
  } catch (error) {
    step.ok = false;
    step.error = error instanceof Error ? error.message : String(error);
  }

  if (options.screenshot !== false) {
    try {
      step.screenshot = await captureStepScreenshot(page, scenario, stepName);
    } catch (error) {
      step.screenshot = null;
      const message = error instanceof Error ? error.message : String(error);
      step.details = {
        ...(step.details ?? {}),
        screenshotError: message,
      };
    }
  }

  step.url = page.url();
  step.endedAt = nowIso();
  scenario.steps.push(step);
  runtimeState.currentStep = 'idle';
  return step;
};

const openFacilitySelectionAndLoginForm = async (page) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await sleep(STEP_WAIT_MS);

  let selectionMethod = 'unknown';

  const facilityInput = page.locator('#facility-login-id');
  if (await facilityInput.isVisible().catch(() => false)) {
    await facilityInput.fill(FACILITY_ID);
    const proceedButton = page.getByRole('button', { name: 'ログインへ進む' });
    if (await proceedButton.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL('**/f/*/login**', { timeout: NAV_TIMEOUT_MS }).catch(() => undefined),
        proceedButton.click(),
      ]);
      await sleep(STEP_WAIT_MS);
      selectionMethod = 'facility-manual-input';
    } else {
      await facilityInput.press('Enter');
      await sleep(STEP_WAIT_MS);
      selectionMethod = 'facility-enter';
    }
  } else {
    const recentButton = page.getByRole('button', { name: FACILITY_ID });
    if (await recentButton.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL('**/f/*/login**', { timeout: NAV_TIMEOUT_MS }).catch(() => undefined),
        recentButton.click(),
      ]);
      await sleep(STEP_WAIT_MS);
      selectionMethod = 'facility-recent-button';
    } else if (await page.locator('#login-user-id').isVisible().catch(() => false)) {
      selectionMethod = 'already-login-form';
    } else {
      await page.goto(`/f/${encodeURIComponent(FACILITY_ID)}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT_MS,
      });
      await sleep(STEP_WAIT_MS);
      selectionMethod = 'direct-facility-login-url';
    }
  }

  await page.locator('#login-user-id').waitFor({ timeout: NAV_TIMEOUT_MS });
  return {
    selectionMethod,
    url: page.url(),
  };
};

const submitLoginForm = async (page) => {
  const facilityField = page.locator('#login-facility-id');
  if (await facilityField.isVisible().catch(() => false)) {
    await facilityField.fill(FACILITY_ID);
  }

  await page.fill('#login-user-id', LOGIN_USER_ID);
  await page.fill('#login-password', LOGIN_PASSWORD);

  await page.getByRole('button', { name: /ログイン/ }).click();
  await sleep(STEP_WAIT_MS + 600);

  let factor2Used = false;
  if (await page.locator('#login-factor2-code').isVisible().catch(() => false)) {
    if (!LOGIN_FACTOR2_CODE) {
      return {
        outcome: 'factor2-required',
        factor2Used: false,
        factor2Error: 'LOGIN_FACTOR2_CODE is not set',
        url: page.url(),
        statusMessages: await page.locator('.status-message').allTextContents().catch(() => []),
      };
    }
    await page.fill('#login-factor2-code', LOGIN_FACTOR2_CODE);
    await page.getByRole('button', { name: '認証コードを確認' }).click();
    await sleep(STEP_WAIT_MS + 600);
    factor2Used = true;
  }

  let outcome = 'unknown';
  if (/\/f\/[^/]+\/reception/.test(page.url())) {
    outcome = 'reception';
  } else if (await page.locator('.status-message.is-error').first().isVisible().catch(() => false)) {
    outcome = 'status-error';
  } else if (await page.locator('.status-message').first().isVisible().catch(() => false)) {
    outcome = 'status';
  }

  const statusMessages = await page
    .locator('.status-message')
    .allTextContents()
    .then((items) => items.map((text) => truncateText(text, 1000)))
    .catch(() => []);

  return {
    outcome,
    factor2Used,
    url: page.url(),
    statusMessages,
  };
};

const gotoFacilityPage = async (page, suffix, requiredSelector, waitMs = STEP_WAIT_MS) => {
  const fullPath = `/f/${encodeURIComponent(FACILITY_ID)}${suffix}`;
  await page.goto(fullPath, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  if (requiredSelector) {
    await page.locator(requiredSelector).first().waitFor({ timeout: NAV_TIMEOUT_MS });
  }
  await sleep(waitMs);
  return {
    path: fullPath,
    url: page.url(),
    title: await page.title().catch(() => null),
  };
};

const runOrderMasterSearch = async (page) => {
  const result = {
    searchInputVisible: false,
    quickAddClicked: false,
    searched: false,
  };

  let searchInput = page.locator('#order-dock-search-input');
  result.searchInputVisible = await searchInput.isVisible().catch(() => false);

  if (!result.searchInputVisible) {
    const quickAddButton = page.locator('[data-test-id^="order-dock-quick-add-"]').first();
    if (await quickAddButton.isVisible().catch(() => false)) {
      await quickAddButton.click();
      await sleep(900);
      result.quickAddClicked = true;
      searchInput = page.locator('#order-dock-search-input');
      result.searchInputVisible = await searchInput.isVisible().catch(() => false);
    }
  }

  if (result.searchInputVisible) {
    await searchInput.fill('テスト');
    await searchInput.press('Enter').catch(() => undefined);
    await sleep(1600);
    result.searched = true;
  }

  return result;
};

const openDeliverySection = async (page, label) => {
  const strictPrefix = page.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) }).first();
  const looseMatch = page.getByRole('button', { name: new RegExp(escapeRegExp(label)) }).first();
  const button = (await strictPrefix.isVisible().catch(() => false)) ? strictPrefix : looseMatch;

  if (!(await button.isVisible().catch(() => false))) {
    return { clicked: false, reason: 'section-button-not-visible' };
  }

  await button.click();
  await sleep(STEP_WAIT_MS);
  return { clicked: true, reason: null };
};

const ensureAdministrationSection = async (page, section) => {
  const currentUrl = page.url();
  const sectionTag = `section=${section}`;
  const targetPath = `/f/${encodeURIComponent(FACILITY_ID)}/administration?section=${encodeURIComponent(section)}`;
  await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await sleep(STEP_WAIT_MS);

  const nextUrl = page.url();
  return {
    navigated: currentUrl !== nextUrl,
    url: nextUrl,
    sectionMatched: nextUrl.includes(sectionTag),
  };
};

const runAdministrationConnectionCheck = async (page) => {
  const sectionResult = await openDeliverySection(page, '接続');
  const sectionState = await ensureAdministrationSection(page, 'connection');
  if (!sectionState.sectionMatched) {
    return {
      sectionOpened: sectionResult.clicked,
      performed: false,
      reason: 'connection-section-not-opened',
    };
  }

  await page.getByRole('heading', { name: /WebORCA接続設定/ }).first().waitFor({
    timeout: NAV_TIMEOUT_MS,
  }).catch(() => undefined);
  await page.getByRole('button', { name: /接続テスト/ }).first().waitFor({
    timeout: NAV_TIMEOUT_MS,
  }).catch(() => undefined);

  const testButton = page.getByRole('button', { name: /接続テスト/ }).first();
  if (!(await testButton.isVisible().catch(() => false))) {
    return {
      sectionOpened: true,
      performed: false,
      reason: 'connection-test-button-not-visible',
    };
  }

  if (await testButton.isDisabled().catch(() => false)) {
    return {
      sectionOpened: true,
      performed: false,
      reason: 'connection-test-button-disabled',
    };
  }

  await testButton.click();
  await sleep(2600);

  const summaryRows = await page
    .locator('.admin-result > div')
    .allTextContents()
    .then((rows) => rows.map((row) => truncateText(row, 800)))
    .catch(() => []);

  return {
    sectionOpened: true,
    performed: true,
    reason: null,
    sectionUrl: sectionState.url,
    summaryRows,
  };
};

const runAdministrationInternalWrapperTensuSync = async (page) => {
  const sectionResult = await openDeliverySection(page, '診断/デバッグ');
  const sectionState = await ensureAdministrationSection(page, 'debug');
  if (!sectionState.sectionMatched) {
    return {
      debugOpened: sectionResult.clicked,
      performed: false,
      reason: 'debug-section-not-opened',
    };
  }

  const endpointSelect = page.locator('#orca-internal-endpoint').first();
  await endpointSelect.waitFor({ timeout: NAV_TIMEOUT_MS }).catch(() => undefined);
  if (!(await endpointSelect.isVisible().catch(() => false))) {
    return {
      debugOpened: true,
      performed: false,
      reason: 'internal-wrapper-endpoint-select-not-visible',
    };
  }

  await endpointSelect.selectOption('tensu-sync').catch(() => undefined);
  await sleep(300);
  const sendButtons = page.getByRole('button', { name: /^送信$/ });
  const sendButtonCount = await sendButtons.count();
  if (sendButtonCount === 0) {
    return {
      debugOpened: true,
      performed: false,
      reason: 'internal-wrapper-send-button-not-visible',
    };
  }
  const sendButton = sendButtonCount > 1 ? sendButtons.nth(1) : sendButtons.first();
  if (!(await sendButton.isVisible().catch(() => false))) {
    return {
      debugOpened: true,
      performed: false,
      reason: 'internal-wrapper-send-button-not-visible',
    };
  }

  if (await sendButton.isDisabled().catch(() => false)) {
    return {
      debugOpened: true,
      performed: false,
      reason: 'internal-wrapper-send-button-disabled',
    };
  }

  await sendButton.click();
  await sleep(2600);

  const resultRows = await page
    .locator('.admin-result > div')
    .allTextContents()
    .then((rows) => rows.map((row) => truncateText(row, 800)))
    .catch(() => []);

  return {
    debugOpened: true,
    performed: true,
    reason: null,
    sectionUrl: sectionState.url,
    resultRows,
  };
};

const finalizeScenario = (scenario) => {
  scenario.finishedAt = nowIso();
  scenario.blockTarget.routeAbortTriggered = scenario.blockTarget.blockedHits.length > 0;
  scenario.blockTarget.routeNotTriggered = scenario.blockTarget.routeAbortApplied && !scenario.blockTarget.routeAbortTriggered;

  scenario.untriggeredEndpoints = TARGETS.map((target) => {
    const summary = scenario.targetSummary[target.endpoint];
    const totalHits =
      summary.requestCount
      + summary.responseCount
      + summary.requestFailureCount
      + summary.blockedCount;
    return {
      endpoint: target.endpoint,
      untriggered: totalHits === 0,
      totalHits,
    };
  });

  scenario.statistics = {
    stepCount: scenario.steps.length,
    failedStepCount: scenario.steps.filter((step) => !step.ok).length,
    requestCount: scenario.requests.length,
    responseCount: scenario.responses.length,
    requestFailureCount: scenario.requestFailures.length,
    consoleCount: scenario.consoleMessages.length,
    pageErrorCount: scenario.pageErrors.length,
    blockedCount: scenario.blockTarget.blockedHits.length,
  };
};

const runSingleScenario = async (browser, blockTarget) => {
  const scenario = buildScenarioSeed(blockTarget);
  const runtimeState = {
    currentStep: 'idle',
    activeSessionId: scenario.csrf?.initial?.sessionId ?? null,
  };
  scenario.csrf = {
    backendOrigin: BACKEND_ORIGIN,
    bootstrapUrl: BACKEND_BOOTSTRAP_URL,
    initial: null,
    refreshed: null,
  };

  try {
    scenario.csrf.initial = await bootstrapCsrfState(null);
  } catch (error) {
    scenario.csrf.initial = {
      status: null,
      sessionId: null,
      csrfToken: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const context = await browser.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  });

  const initialSessionId = scenario.csrf.initial?.sessionId ?? null;
  runtimeState.activeSessionId = initialSessionId;
  if (initialSessionId) {
    const initialCookies = [
      createSessionCookiePayload(initialSessionId, '/'),
      createSessionCookiePayload(initialSessionId, '/api'),
      createSessionCookiePayload(initialSessionId, '/api/api'),
    ].filter(Boolean);
    await context.addCookies(initialCookies);
  }
  if (scenario.csrf.initial?.csrfToken) {
    await context.addInitScript((token) => {
      const apply = () => {
        let meta = document.querySelector("meta[name='csrf-token']");
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'csrf-token');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', token);
      };
      apply();
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    }, scenario.csrf.initial.csrfToken);
  }

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const requestPath = parseUrlPath(url);
    const matchedTargets = detectMatchedTargets(url);

    if (blockTarget && matchedTargets.some((target) => target.endpoint === blockTarget.endpoint)) {
      const request = route.request();
      const url = request.url();
      const matchedTargets = detectMatchedTargets(url);

      const hit = {
        time: nowIso(),
        step: runtimeState.currentStep,
        url,
        path: parseUrlPath(url),
        method: request.method(),
        matchedTargets: matchedTargets.map((target) => target.endpoint),
      };

      scenario.blockTarget.blockedHits.push(hit);
      bumpSummary(scenario, matchedTargets, 'blocked', { url });

      await route.abort('failed');
      return;
    }

    const method = request.method().toUpperCase();
    const headers = {
      ...request.headers(),
    };
    if (runtimeState.activeSessionId && requestPath.startsWith('/api/')) {
      headers.cookie = `JSESSIONID=${runtimeState.activeSessionId}`;
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && isTrackedUrl(url)) {
      const proxiedHeaders = {
        ...headers,
        origin: BACKEND_ORIGIN,
        referer: BACKEND_BOOTSTRAP_URL,
      };
      await route.continue({ headers: proxiedHeaders });
      return;
    }

    if (runtimeState.activeSessionId && requestPath.startsWith('/api/')) {
      await route.continue({ headers });
      return;
    }

    await route.continue();
  });

  const page = await context.newPage();
  attachCollectors(page, scenario, runtimeState);

  try {
    await withStep(page, scenario, runtimeState, 'login-open', async () => {
      const details = await openFacilitySelectionAndLoginForm(page);
      if (scenario.csrf.initial?.csrfToken) {
        await applyCsrfTokenToPage(page, scenario.csrf.initial.csrfToken);
      }
      scenario.serviceWorker.login = await readServiceWorkerInfo(page).catch(() => null);
      return details;
    });

    await withStep(page, scenario, runtimeState, 'login-submit', async () => submitLoginForm(page));

    await withStep(page, scenario, runtimeState, 'csrf-refresh-after-login', async () => {
      const sessionSnapshot = await resolveContextSessionSnapshot(context);
      const currentSessionId = sessionSnapshot.preferred?.value ?? null;
      if (currentSessionId) {
        runtimeState.activeSessionId = currentSessionId;
        const mirroredCookies = [
          createSessionCookiePayload(currentSessionId, '/'),
          createSessionCookiePayload(currentSessionId, '/api'),
          createSessionCookiePayload(currentSessionId, '/api/api'),
        ].filter(Boolean);
        await context.addCookies(mirroredCookies);
      }

      const refreshed = await bootstrapCsrfState(currentSessionId);
      scenario.csrf.refreshed = refreshed;

      if (refreshed.csrfToken) {
        await applyCsrfTokenToPage(page, refreshed.csrfToken);
      }

      return {
        currentSessionIdPresent: Boolean(currentSessionId),
        currentSessionCookieCount: sessionSnapshot.all.length,
        currentSessionCookiePaths: sessionSnapshot.all.map((cookie) => cookie.path),
        refreshedStatus: refreshed.status,
        refreshedSessionIdPresent: Boolean(refreshed.sessionId),
        refreshedSessionIdChanged:
          Boolean(currentSessionId)
          && Boolean(refreshed.sessionId)
          && refreshed.sessionId !== currentSessionId,
        refreshedTokenPresent: Boolean(refreshed.csrfToken),
      };
    });

    await withStep(page, scenario, runtimeState, 'session-me-probe', async () => {
      const probe = await page.request.get('/api/api/session/me', { failOnStatusCode: false });
      const bodyText = await probe.text().catch(() => null);
      return {
        status: probe.status(),
        ok: probe.ok(),
        bodySample: truncateText(bodyText, 1000),
      };
    });

    await withStep(page, scenario, runtimeState, 'reception-open', async () =>
      gotoFacilityPage(page, '/reception', '.reception-page'));

    await withStep(page, scenario, runtimeState, 'charts-open', async () =>
      gotoFacilityPage(page, '/charts', '.charts-page'));

    await withStep(page, scenario, runtimeState, 'charts-order-master-search', async () =>
      runOrderMasterSearch(page));

    await withStep(page, scenario, runtimeState, 'patients-open', async () =>
      gotoFacilityPage(page, '/patients', '.patients-page'));

    await withStep(page, scenario, runtimeState, 'administration-display-only', async () => {
      const details = await gotoFacilityPage(
        page,
        '/administration',
        '[data-test-id="administration-page"]',
      );
      scenario.serviceWorker.operational = await readServiceWorkerInfo(page).catch(() => null);
      return {
        ...details,
        note: '管理画面を開いて表示のみ確認',
      };
    });

    await withStep(page, scenario, runtimeState, 'administration-connection-check', async () =>
      runAdministrationConnectionCheck(page));

    await withStep(page, scenario, runtimeState, 'administration-debug-open-and-send', async () =>
      runAdministrationInternalWrapperTensuSync(page));
  } catch (error) {
    scenario.fatalError = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? truncateText(error.stack ?? '', 8000) : null,
    };
  } finally {
    await context.close();
  }

  finalizeScenario(scenario);
  fs.writeFileSync(scenario.artifacts.reportPath, JSON.stringify(scenario, null, 2));
  return scenario;
};

const diffStatusMap = (baselineStatuses = {}, candidateStatuses = {}) => {
  const keys = new Set([...Object.keys(baselineStatuses), ...Object.keys(candidateStatuses)]);
  const delta = {};
  for (const key of keys) {
    const changed = (candidateStatuses[key] ?? 0) - (baselineStatuses[key] ?? 0);
    if (changed !== 0) {
      delta[key] = changed;
    }
  }
  return delta;
};

const buildScenarioDiff = (baseline, candidate) => {
  const baselineStepMap = Object.fromEntries(baseline.steps.map((step) => [step.name, step.ok]));
  const addedFailures = candidate.steps
    .filter((step) => !step.ok && baselineStepMap[step.name] !== false)
    .map((step) => ({ name: step.name, error: step.error }));

  const endpointDeltas = TARGETS.map((target) => {
    const base = baseline.targetSummary[target.endpoint];
    const next = candidate.targetSummary[target.endpoint];
    const totalNext =
      next.requestCount
      + next.responseCount
      + next.requestFailureCount
      + next.blockedCount;

    return {
      endpoint: target.endpoint,
      requestDelta: next.requestCount - base.requestCount,
      responseDelta: next.responseCount - base.responseCount,
      requestFailureDelta: next.requestFailureCount - base.requestFailureCount,
      blockedDelta: next.blockedCount - base.blockedCount,
      statusDelta: diffStatusMap(base.statuses, next.statuses),
      routeNotTriggeredInCandidate: totalNext === 0,
    };
  });

  const primary = candidate.blockTarget.endpoint
    ? endpointDeltas.find((entry) => entry.endpoint === candidate.blockTarget.endpoint) ?? null
    : null;

  return {
    scenario: candidate.scenario,
    blockedEndpoint: candidate.blockTarget.endpoint,
    routeAbortApplied: candidate.blockTarget.routeAbortApplied,
    routeAbortTriggered: candidate.blockTarget.routeAbortTriggered,
    routeNotTriggered: candidate.blockTarget.routeNotTriggered,
    blockedHitCount: candidate.blockTarget.blockedHits.length,
    consoleDelta: candidate.consoleMessages.length - baseline.consoleMessages.length,
    pageErrorDelta: candidate.pageErrors.length - baseline.pageErrors.length,
    failedStepDelta: candidate.statistics.failedStepCount - baseline.statistics.failedStepCount,
    addedFailures,
    primaryEndpointDelta: primary,
    endpointDeltas,
  };
};

const main = async () => {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  const scenarios = [];

  try {
    const baselineScenario = await runSingleScenario(browser, null);
    scenarios.push(baselineScenario);

    for (const target of TARGETS) {
      const blockScenario = await runSingleScenario(browser, target);
      scenarios.push(blockScenario);
    }
  } finally {
    await browser.close();
  }

  const baseline = scenarios.find((scenario) => scenario.scenario === 'baseline');
  if (!baseline) {
    throw new Error('Baseline scenario report was not generated.');
  }

  const blockScenarios = scenarios.filter((scenario) => scenario.scenario !== 'baseline');
  const diffs = blockScenarios.map((scenario) => buildScenarioDiff(baseline, scenario));

  const aggregate = {
    runId: RUN_ID,
    generatedAt: nowIso(),
    baseUrl: BASE_URL,
    facilityId: FACILITY_ID,
    loginUserId: LOGIN_USER_ID,
    mswAssumption: 'disabled',
    environment: {
      headless: HEADLESS,
      navTimeoutMs: NAV_TIMEOUT_MS,
      stepWaitMs: STEP_WAIT_MS,
    },
    targetEndpoints: TARGETS.map((target) => ({
      id: target.id,
      endpoint: target.endpoint,
      routePattern: String(target.match),
    })),
    scenarioReports: scenarios.map((scenario) => ({
      scenario: scenario.scenario,
      reportPath: path.relative(OUTPUT_ROOT, scenario.artifacts.reportPath),
      statistics: scenario.statistics,
      routeNotTriggered: scenario.blockTarget.routeNotTriggered,
      fatalError: scenario.fatalError,
    })),
    diffSummaryPath: 'baseline-vs-block-diff.json',
  };

  const aggregatePath = path.join(OUTPUT_ROOT, 'audit-summary.json');
  const diffPath = path.join(OUTPUT_ROOT, 'baseline-vs-block-diff.json');
  fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2));
  fs.writeFileSync(diffPath, JSON.stringify({ runId: RUN_ID, baseline: 'baseline', diffs }, null, 2));

  const fatalCount = scenarios.filter((scenario) => scenario.fatalError).length;

  console.log(`qa-unused-api-audit runId: ${RUN_ID}`);
  console.log(`qa-unused-api-audit output: ${OUTPUT_ROOT}`);
  console.log(`qa-unused-api-audit aggregate: ${aggregatePath}`);
  console.log(`qa-unused-api-audit diff: ${diffPath}`);
  console.log(`qa-unused-api-audit scenarios: ${scenarios.length} (fatal=${fatalCount})`);

  if (fatalCount > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const fatalPath = path.join(OUTPUT_ROOT, 'fatal-error.json');
  const payload = {
    runId: RUN_ID,
    generatedAt: nowIso(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? truncateText(error.stack ?? '', 10000) : null,
  };
  fs.writeFileSync(fatalPath, JSON.stringify(payload, null, 2));
  console.error(`qa-unused-api-audit fatal: ${fatalPath}`);
  console.error(payload.message);
  process.exit(1);
});
