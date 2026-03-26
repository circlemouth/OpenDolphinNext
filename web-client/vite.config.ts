import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { randomUUID } from 'node:crypto';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { flaggedMockPlugin } from './plugins/flagged-mock-plugin';

const isTruthy = (value?: string) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};
const PERF_LOG_MAX_PAYLOAD_BYTES = 64 * 1024;
const LOOPBACK_REMOTE_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const normalizePathPrefix = (raw?: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
};
const parsePathPrefix = (raw?: string) => {
  if (!raw) return { prefix: '', auto: true };
  const trimmed = raw.trim();
  if (!trimmed) return { prefix: '', auto: true };
  const normalized = trimmed.toLowerCase();
  if (['off', 'false', 'none', 'disable', 'disabled'].includes(normalized)) {
    return { prefix: '', auto: false };
  }
  return { prefix: normalizePathPrefix(trimmed), auto: false };
};
const resolveTargetPath = (target: string) => {
  try {
    const url = new URL(target);
    return normalizePathPrefix(url.pathname);
  } catch {
    return '';
  }
};
const normalizeBasePath = (raw?: string): string => {
  if (!raw) return '/';
  const trimmed = raw.trim();
  if (!trimmed) return '/';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withLeadingSlash === '/') return '/';
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
};
const stripResourceSuffix = (rawPath: string): string => rawPath.replace(/\/resources\/?$/, '') || '/';
const isHtmlNavigationRequest = (url: string, acceptHeader?: string) => {
  const pathname = url.split('?')[0] ?? '/';
  if (pathname.startsWith('/api') || pathname.startsWith('/@') || pathname.startsWith('/src/') || pathname.startsWith('/node_modules/')) {
    return false;
  }
  if (/\.[a-z0-9]+$/i.test(pathname)) {
    return false;
  }
  return (acceptHeader ?? '').includes('text/html');
};
const rewriteCookiePath = (setCookie: string, fromPath: string, toPath: string) => {
  const normalizedFrom = fromPath === '/' ? '/' : fromPath.replace(/\/+$/, '');
  return setCookie.replace(new RegExp(`(;\\s*Path=)${normalizedFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=;|$)`, 'i'), `$1${toPath}`);
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite does not automatically populate `process.env` for `vite.config.ts` from `.env*`.
  // `loadEnv()` keeps dev/proxy settings consistent whether started via scripts or manually.
  const env = loadEnv(mode, process.cwd(), '');
  const getEnv = (key: string) => process.env[key] ?? env[key];
  const isVitestRun = mode === 'test';

  const apiProxyTarget = getEnv('VITE_DEV_PROXY_TARGET') ?? 'http://localhost:8080/openDolphin/resources';
  const disableProxy = getEnv('VITE_DISABLE_PROXY') === '1';
  const useHttps = isTruthy(getEnv('VITE_DEV_USE_HTTPS'));
  const insecureProxyTls = isTruthy(getEnv('VITE_DEV_PROXY_INSECURE_TLS'));
  const enablePreviewPerfLogSink = isTruthy(getEnv('VITE_ENABLE_PREVIEW_PERF_LOG_SINK'));
  const httpsOption = useHttps ? {} : false;
  const runId = getEnv('VITE_RUM_RUN_ID') ?? getEnv('RUN_ID') ?? '20251124T200000Z';
  const rumOutputDir = path.resolve(__dirname, `../artifacts/perf/orca-master/${runId}/rum`);

  const orcaCertPath = getEnv('ORCA_CERT_PATH') ?? getEnv('ORCA_PROD_CERT_PATH') ?? getEnv('ORCA_PROD_CERT');
  const orcaCertPass = getEnv('ORCA_CERT_PASS') ?? getEnv('ORCA_PROD_CERT_PASS');
  const orcaBasicUser = getEnv('ORCA_BASIC_USER') ?? getEnv('ORCA_PROD_BASIC_USER') ?? getEnv('ORCA_API_USER');
  const orcaBasicKey =
    getEnv('ORCA_BASIC_PASSWORD') ??
    getEnv('ORCA_BASIC_KEY') ??
    getEnv('ORCA_PROD_BASIC_KEY') ??
    getEnv('ORCA_API_PASSWORD');

  const hasOrcaCert = Boolean(orcaCertPath && orcaCertPass && fs.existsSync(orcaCertPath));
  const orcaClientAgent = hasOrcaCert
    ? new https.Agent({
        pfx: fs.readFileSync(orcaCertPath as string),
        passphrase: orcaCertPass,
        rejectUnauthorized: !insecureProxyTls,
      })
    : undefined;

  const orcaAuthHeader =
    orcaBasicUser && orcaBasicKey
      ? {
          Authorization: `Basic ${Buffer.from(`${orcaBasicUser}:${orcaBasicKey}`).toString('base64')}`,
        }
      : undefined;
  const shouldAttachOrcaAuth = Boolean(orcaAuthHeader?.Authorization);
  const shouldDropOrcaResultMessage = isTruthy(
    getEnv('VITE_DEV_PROXY_DROP_ORCA_RESULT_MESSAGE') ?? getEnv('VITE_PROXY_DROP_ORCA_RESULT_MESSAGE'),
  );
  const shouldDropOrcaHeaders = isTruthy(
    getEnv('VITE_DEV_PROXY_DROP_ORCA_HEADERS') ?? getEnv('VITE_PROXY_DROP_ORCA_HEADERS'),
  );
  const needsProxyConfigure = shouldAttachOrcaAuth || shouldDropOrcaResultMessage || shouldDropOrcaHeaders;

  const orcaModeRaw = getEnv('VITE_ORCA_MODE') ?? getEnv('ORCA_MODE') ?? '';
  const orcaMode = orcaModeRaw.trim().toLowerCase();
  const isWebOrca = orcaMode === 'weborca' || orcaMode === 'cloud' || isTruthy(getEnv('ORCA_API_WEBORCA'));
  const resourcePathPrefix = normalizePathPrefix(getEnv('VITE_DEV_PROXY_RESOURCE_PREFIX') ?? '/openDolphin/resources');
  const orcaPathPrefixSpec = parsePathPrefix(getEnv('VITE_ORCA_API_PATH_PREFIX') ?? getEnv('ORCA_API_PATH_PREFIX'));
  const resolvedOrcaPrefix = orcaPathPrefixSpec.auto ? (isWebOrca ? '/api' : '') : orcaPathPrefixSpec.prefix;
  const targetPath = resolveTargetPath(apiProxyTarget);
  const targetOrigin = (() => {
    try {
      return new URL(apiProxyTarget).origin;
    } catch {
      return '';
    }
  })();
  const targetHasOrcaPrefix =
    resolvedOrcaPrefix && (targetPath === resolvedOrcaPrefix || targetPath.startsWith(`${resolvedOrcaPrefix}/`));
  const targetHasResourcePrefix =
    Boolean(resourcePathPrefix) && (targetPath === resourcePathPrefix || targetPath.startsWith(`${resourcePathPrefix}/`));
  const shouldAddOrcaPrefix = Boolean(resolvedOrcaPrefix) && !targetHasOrcaPrefix;
  // When the proxy target is an origin (e.g. `http://localhost:9080`), we still need to reach the
  // JAX-RS resources mounted under `/openDolphin/resources` (server-modernized/legacy both).
  // Previously this was gated by `!isWebOrca`, which caused `/orca/*` (and other API paths) to 404
  // under WebORCA mode unless the env already included the resource path.
  const shouldAddResourcePrefix = Boolean(resourcePathPrefix) && (!targetPath || targetPath === '/');
  const shouldAddLegacyResourcePrefix = Boolean(resourcePathPrefix) && !targetHasResourcePrefix;
  const backendBootstrapPath =
    targetPath && targetPath !== '/'
      ? stripResourceSuffix(targetPath)
      : resourcePathPrefix
        ? stripResourceSuffix(resourcePathPrefix)
        : '/';
  const backendBootstrapUrl = targetOrigin ? new URL(backendBootstrapPath || '/', targetOrigin).toString() : '';

  const addOrcaPrefix = (rawPath: string) => {
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (!resolvedOrcaPrefix || !shouldAddOrcaPrefix) return normalizedPath;
    if (normalizedPath === resolvedOrcaPrefix || normalizedPath.startsWith(`${resolvedOrcaPrefix}/`)) return normalizedPath;
    return `${resolvedOrcaPrefix}${normalizedPath}`;
  };
  const addResourcePrefix = (rawPath: string) => {
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (!shouldAddResourcePrefix || !resourcePathPrefix) return normalizedPath;
    if (normalizedPath === resourcePathPrefix || normalizedPath.startsWith(`${resourcePathPrefix}/`)) return normalizedPath;
    return `${resourcePathPrefix}${normalizedPath}`;
  };
  const addLegacyResourcePrefix = (rawPath: string) => {
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (!shouldAddLegacyResourcePrefix || !resourcePathPrefix) return normalizedPath;
    if (normalizedPath === resourcePathPrefix || normalizedPath.startsWith(`${resourcePathPrefix}/`)) return normalizedPath;
    return `${resourcePathPrefix}${normalizedPath}`;
  };
  const rewriteOrcaPath = (rawPath: string) => addLegacyResourcePrefix(isWebOrca ? addOrcaPrefix(rawPath) : rawPath);
  const stripApiPrefix = (rawPath: string) => rawPath.replace(/^\/api(?=\/|$)/, '');

  const orcaPrefixedPaths = [
    '/api21',
    '/orca06',
    '/orca12',
    '/orca21',
    '/orca22',
    '/orca25',
    '/orca51',
    '/orca101',
    '/orca102',
    '/blobapi',
  ] as const;
  const isOrcaApiPath = (rawPath: string) => {
    const stripped = stripApiPrefix(rawPath);
    return orcaPrefixedPaths.some((prefix) => stripped === prefix || stripped.startsWith(`${prefix}/`));
  };
  const isAdminApiPath = (rawPath: string) => {
    const trimmed = rawPath.trim();
    return trimmed === '/api/admin' || trimmed.startsWith('/api/admin/');
  };
  const isSessionApiPath = (rawPath: string) => {
    const trimmed = rawPath.trim();
    return trimmed === '/api/session' || trimmed.startsWith('/api/session/');
  };
  const isApiOrcaQueuePath = (rawPath: string) => {
    const trimmed = rawPath.trim();
    return trimmed === '/api/orca' || trimmed.startsWith('/api/orca/');
  };
  const shouldPreserveApiPrefix =
    Boolean(targetPath) &&
    targetPath !== '/' &&
    targetPath !== resourcePathPrefix &&
    !targetPath.startsWith(`${resourcePathPrefix}/`);
  const rewriteApiPath = (rawPath: string) => {
    if (isAdminApiPath(rawPath) || isSessionApiPath(rawPath) || isApiOrcaQueuePath(rawPath)) return addResourcePrefix(rawPath);
    if (resolvedOrcaPrefix && isOrcaApiPath(rawPath)) return addOrcaPrefix(stripApiPrefix(rawPath));
    return addResourcePrefix(shouldPreserveApiPrefix ? rawPath : stripApiPrefix(rawPath));
  };

  const createProxyConfig = (rewrite?: (p: string) => string) => ({
    target: apiProxyTarget,
    changeOrigin: true,
    secure: !insecureProxyTls,
    agent: orcaClientAgent,
    cookiePathRewrite: backendBootstrapPath ? { [backendBootstrapPath]: '/' } : undefined,
    ...(needsProxyConfigure
      ? {
          configure: (proxy: any) => {
            if (shouldAttachOrcaAuth) {
              proxy.on('proxyReq', (proxyReq: any, req: any) => {
                const proxyAuth =
                  typeof proxyReq.getHeader === 'function' ? proxyReq.getHeader('authorization') : undefined;
                const existingAuth = proxyAuth ?? req.headers?.authorization;
                if (!existingAuth && orcaAuthHeader?.Authorization) {
                  proxyReq.setHeader('Authorization', orcaAuthHeader.Authorization);
                }
              });
            }
            if (shouldDropOrcaHeaders || shouldDropOrcaResultMessage) {
              proxy.on('proxyRes', (proxyRes: any) => {
                const headers = proxyRes.headers;
                if (!headers) return;
                Object.keys(headers).forEach((key) => {
                  const normalized = key.toLowerCase();
                  if (shouldDropOrcaHeaders && normalized.startsWith('x-orca-')) {
                    delete headers[key];
                    return;
                  }
                  if (shouldDropOrcaResultMessage && normalized === 'x-orca-api-result-message') {
                    delete headers[key];
                  }
                });
              });
            }
          },
        }
      : {}),
    ...(rewrite ? { rewrite } : {}),
    configure: (proxy: any) => {
      proxy.on('proxyReq', (proxyReq: any, req: any) => {
        if (targetOrigin && req.headers?.origin) {
          proxyReq.setHeader('Origin', targetOrigin);
        }
        if (backendBootstrapUrl && req.headers?.referer) {
          proxyReq.setHeader('Referer', backendBootstrapUrl);
        }
      });
      if (needsProxyConfigure) {
        if (shouldAttachOrcaAuth) {
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            const proxyAuth =
              typeof proxyReq.getHeader === 'function' ? proxyReq.getHeader('authorization') : undefined;
            const existingAuth = proxyAuth ?? req.headers?.authorization;
            if (!existingAuth && orcaAuthHeader?.Authorization) {
              proxyReq.setHeader('Authorization', orcaAuthHeader.Authorization);
            }
          });
        }
        if (shouldDropOrcaHeaders || shouldDropOrcaResultMessage) {
          proxy.on('proxyRes', (proxyRes: any) => {
            const headers = proxyRes.headers;
            if (!headers) return;
            Object.keys(headers).forEach((key) => {
              const normalized = key.toLowerCase();
              if (shouldDropOrcaHeaders && normalized.startsWith('x-orca-')) {
                delete headers[key];
                return;
              }
              if (shouldDropOrcaResultMessage && normalized === 'x-orca-api-result-message') {
                delete headers[key];
              }
            });
          });
        }
      }
    },
  });

  const apiProxy = {
    '/api': createProxyConfig(rewriteApiPath),
    '/user': createProxyConfig(addLegacyResourcePrefix),
    '/karte': createProxyConfig(addLegacyResourcePrefix),
    '/odletter': createProxyConfig(addLegacyResourcePrefix),
    // ORCA / 外来 API 群を開発プロキシ経由でモダナイズ版サーバーへ中継する。
    '/api21': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca06': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca12': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca21': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca22': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca25': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca51': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca101': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca102': createProxyConfig((p: string) => addLegacyResourcePrefix(addOrcaPrefix(p))),
    '/orca': createProxyConfig(rewriteOrcaPath),
  } as const;

  const basePath = normalizeBasePath(getEnv('VITE_BASE_PATH'));
  const viteBase = basePath === '/' ? '/' : `${basePath}/`;

  return {
    plugins: [
      react(),
      basicSsl(),
      // Fixture injection via middleware must be explicit (avoid accidental stage/prod mixing).
      ...(isTruthy(getEnv('VITE_ENABLE_FLAGGED_MOCKS')) ? [flaggedMockPlugin()] : []),
      {
        name: 'preview-perf-log-sink',
        configurePreviewServer(previewServer) {
          if (!enablePreviewPerfLogSink) return;

          previewServer.middlewares.use('/__perf-log', (req, res) => {
            if (!LOOPBACK_REMOTE_ADDRESSES.has(req.socket.remoteAddress ?? '')) {
              res.statusCode = 404;
              res.end('Not Found');
              return;
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }

            let body = '';
            let bodySize = 0;
            let payloadTooLarge = false;
            req.on('data', (chunk) => {
              if (payloadTooLarge) return;
              const chunkText = chunk.toString();
              bodySize += Buffer.byteLength(chunkText);
              if (bodySize > PERF_LOG_MAX_PAYLOAD_BYTES) {
                payloadTooLarge = true;
                res.statusCode = 413;
                res.end();
                req.destroy();
                return;
              }
              body += chunkText;
            });

            req.on('end', () => {
              if (payloadTooLarge) return;
              try {
                fs.mkdirSync(rumOutputDir, { recursive: true });
                const timestamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..+/, 'Z');
                const filename = path.join(rumOutputDir, `${timestamp}-${process.pid}-${randomUUID()}.json`);
                fs.writeFileSync(filename, body || '{}', 'utf8');
              } catch {
                // noop
              }

              res.statusCode = 204;
              res.end();
            });
          });
        },
      },
      {
        name: 'dev-backend-bootstrap-bridge',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!backendBootstrapUrl) return next();
            if ((req.method ?? 'GET').toUpperCase() !== 'GET') return next();
            if (!isHtmlNavigationRequest(req.url ?? '/', req.headers.accept)) return next();

            try {
              const response = await fetch(backendBootstrapUrl, {
                headers: {
                  accept: 'text/html',
                  cookie: req.headers.cookie ?? '',
                },
              });
              const backendHtml = await response.text();
              const csrfToken = backendHtml.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i)?.[1] ?? '__CSRF_TOKEN__';
              const htmlPath = path.resolve(__dirname, 'index.html');
              const sourceHtml = fs.readFileSync(htmlPath, 'utf8').replace('__CSRF_TOKEN__', csrfToken);
              const transformedHtml = await server.transformIndexHtml(req.url ?? '/', sourceHtml, req.originalUrl);
              const setCookies =
                typeof (response.headers as any).getSetCookie === 'function'
                  ? (response.headers as any).getSetCookie()
                  : response.headers.get('set-cookie')
                    ? [response.headers.get('set-cookie') as string]
                    : [];

              for (const cookie of setCookies) {
                res.appendHeader('Set-Cookie', rewriteCookiePath(cookie, backendBootstrapPath, '/'));
              }
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(transformedHtml);
            } catch {
              next();
            }
          });
        },
      },
    ],
    base: viteBase,
    server: {
      // 開発計測時に自己署名証明書で LHCI が落ちないよう HTTP に切替可能にする
      // CI/開発環境によっては localhost の名前解決に失敗するため、vitest 実行時のみ固定IPを使用。
      host: isVitestRun ? '127.0.0.1' : undefined,
      https: httpsOption,
      strictPort: true,
      proxy: disableProxy ? undefined : { ...apiProxy },
    },
    preview: {
      https: httpsOption,
      proxy: disableProxy ? undefined : { ...apiProxy },
    },
    build: {
      rollupOptions: {},
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setupTests.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
      },
    },
  };
});
