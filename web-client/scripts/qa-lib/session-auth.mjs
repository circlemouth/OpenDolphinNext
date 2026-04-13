import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webClientDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(webClientDir, '..');

const DEFAULT_USER_ID = 'doctor1';
const DEFAULT_PASSWORD_PLAIN = 'doctor2025';
const DEFAULT_PROXY_TARGET = 'http://127.0.0.1:9080';

export const resolveQaArtifactRoot = (...parts) => path.resolve(repoRoot, 'artifacts', ...parts);

export const resolveQaFacilityId = () => {
  const explicit = process.env.QA_FACILITY_ID?.trim();
  if (explicit) return explicit;
  const facilityPath = path.join(repoRoot, 'facility.json');
  const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
  return String(facilityJson.facilityId ?? '0001');
};

export const resolveQaUserId = () => {
  const explicit = process.env.QA_USER_ID?.trim();
  return explicit || DEFAULT_USER_ID;
};

export const resolveQaPasswordPlain = () => {
  const explicit = process.env.QA_PASSWORD_PLAIN;
  return explicit && explicit.length > 0 ? explicit : DEFAULT_PASSWORD_PLAIN;
};

export const buildQaSession = ({ facilityId, userId, runId, scenarioLabel, sessionRole, sessionRoles }) => ({
  facilityId,
  userId,
  displayName: `QA ${scenarioLabel}`,
  clientUuid: `qa-${runId}`,
  runId,
  role: sessionRole,
  roles: sessionRoles,
});

const trimResponseText = (value) => {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 300 ? `${normalized.slice(0, 300)}...` : normalized;
};

const normalizePathPrefix = (rawValue, fallback) => {
  const value = rawValue?.trim();
  if (!value) return fallback;
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '') || fallback;
};

const resolveBackendTarget = () => {
  const rawTarget = process.env.VITE_DEV_PROXY_TARGET?.trim() || DEFAULT_PROXY_TARGET;
  const target = new URL(rawTarget);
  const resourcePrefix =
    target.pathname && target.pathname !== '/'
      ? normalizePathPrefix(target.pathname, '/openDolphin/resources')
      : '/openDolphin/resources';
  const appRootPath = `${resourcePrefix.replace(/\/resources\/?$/, '') || '/openDolphin'}/`;
  return {
    origin: target.origin,
    resourcePrefix,
    appRootUrl: new URL(appRootPath, target.origin).toString(),
    loginUrl: new URL('api/session/login', new URL(appRootPath, target.origin)).toString(),
  };
};

const parseSessionCookieValue = (setCookieHeader) => setCookieHeader?.match(/(?:^|,\s*)JSESSIONID=([^;]+)/)?.[1] ?? null;

const bootstrapBackendSession = async ({ facilityId, userId, password, clientUuid }) => {
  const target = resolveBackendTarget();
  const rootResponse = await fetch(target.appRootUrl, { method: 'GET' });
  const rootHtml = await rootResponse.text();
  const csrfToken = rootHtml.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1] ?? null;
  const initialSessionCookie = parseSessionCookieValue(rootResponse.headers.get('set-cookie'));
  if (!csrfToken || !initialSessionCookie) {
    throw new Error('failed to bootstrap backend csrf/session');
  }

  const loginResponse = await fetch(target.loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Origin: target.origin,
      Referer: target.appRootUrl,
      Cookie: `JSESSIONID=${initialSessionCookie}`,
    },
    body: JSON.stringify({ facilityId, userId, password, clientUuid }),
  });
  const loginBody = await loginResponse.text();
  const authenticatedSessionCookie = parseSessionCookieValue(loginResponse.headers.get('set-cookie'));
  if (loginResponse.status !== 200 || !authenticatedSessionCookie) {
    throw new Error(
      `backend session login failed: status=${loginResponse.status} body=${trimResponseText(loginBody) || '<empty>'}`,
    );
  }

  return {
    csrfToken,
    sessionCookie: authenticatedSessionCookie,
  };
};

export const fetchSessionMe = async (page) =>
  await page.evaluate(async () => {
    const response = await fetch('/api/session/me', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
    return {
      status: response.status,
      body: await response.text(),
    };
  });

export const ensureLoggedIn = async (page, { facilityId }) => {
  const initialPath = `/f/${encodeURIComponent(facilityId)}/reception`;
  await page.goto(initialPath, { waitUntil: 'domcontentloaded' });

  let me = await fetchSessionMe(page).catch(() => ({ status: 0, body: '' }));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (me.status === 200) break;
    await page.waitForTimeout(250);
    me = await fetchSessionMe(page).catch(() => ({ status: 0, body: '' }));
  }
  if (me.status !== 200) {
    throw new Error(`session bootstrap failed: /api/session/me status=${me.status} body=${trimResponseText(me.body)}`);
  }

  return me;
};

export const createAuthenticatedContext = async (
  browser,
  {
    baseURL,
    facilityId,
    userId,
    password,
    session,
    serviceWorkers = 'allow',
    recordHar,
  },
) => {
  const { csrfToken, sessionCookie } = await bootstrapBackendSession({
    facilityId,
    userId,
    password,
    clientUuid: session.clientUuid,
  });
  const previewUrl = new URL(baseURL);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    baseURL,
    serviceWorkers,
    ...(recordHar ? { recordHar } : {}),
  });
  await context.addInitScript(({ token, storedSession }) => {
    const ensureCsrfMeta = () => {
      let meta = document.querySelector("meta[name='csrf-token']");
      if (meta) return meta;
      const parent = document.head ?? document.documentElement;
      if (!parent) return null;
      meta = document.createElement('meta');
      meta.setAttribute('name', 'csrf-token');
      parent.appendChild(meta);
      return meta;
    };
    const apply = () => {
      const serialized = JSON.stringify(storedSession);
      const meta = ensureCsrfMeta();
      if (meta) {
        meta.setAttribute('content', token);
      }
      window.sessionStorage.setItem('opendolphin:web-client:auth', serialized);
      window.localStorage.setItem('opendolphin:web-client:auth', serialized);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
      return;
    }
    apply();
  }, { token: csrfToken, storedSession: session });
  await context.addCookies([
    {
      name: 'JSESSIONID',
      value: sessionCookie,
      domain: previewUrl.hostname,
      path: '/',
      httpOnly: true,
      secure: previewUrl.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  const sessionMe = await ensureLoggedIn(page, { facilityId });
  return { context, page, sessionMe };
};
