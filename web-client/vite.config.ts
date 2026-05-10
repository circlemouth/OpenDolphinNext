import fs from 'node:fs';
import path from 'node:path';
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
  const enablePreviewPerfLogSink = isTruthy(getEnv('VITE_ENABLE_PREVIEW_PERF_LOG_SINK'));
  const httpsOption = useHttps ? {} : false;
  const runId = getEnv('VITE_RUM_RUN_ID') ?? getEnv('RUN_ID') ?? '20251124T200000Z';
  const rumOutputDir = path.resolve(__dirname, `../artifacts/perf/orca-master/${runId}/rum`);

  const resourcePathPrefix = normalizePathPrefix(getEnv('VITE_DEV_PROXY_RESOURCE_PREFIX') ?? '/openDolphin/resources');
  const targetPath = resolveTargetPath(apiProxyTarget);
  const targetOrigin = (() => {
    try {
      return new URL(apiProxyTarget).origin;
    } catch {
      return '';
    }
  })();
  const targetHasResourcePrefix =
    Boolean(resourcePathPrefix) && (targetPath === resourcePathPrefix || targetPath.startsWith(`${resourcePathPrefix}/`));
  const shouldAddResourcePrefix = Boolean(resourcePathPrefix) && (!targetPath || targetPath === '/');
  const shouldAddLegacyResourcePrefix = Boolean(resourcePathPrefix) && !targetHasResourcePrefix;
  const backendBootstrapPath =
    targetPath && targetPath !== '/'
      ? stripResourceSuffix(targetPath)
      : resourcePathPrefix
        ? stripResourceSuffix(resourcePathPrefix)
        : '/';
  const backendBootstrapUrl = targetOrigin ? new URL(backendBootstrapPath || '/', targetOrigin).toString() : '';

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
  const stripApiPrefix = (rawPath: string) => rawPath.replace(/^\/api(?=\/|$)/, '');
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
    return addResourcePrefix(shouldPreserveApiPrefix ? rawPath : stripApiPrefix(rawPath));
  };

  const createProxyConfig = (rewrite?: (p: string) => string) => ({
    target: apiProxyTarget,
    changeOrigin: true,
    secure: true,
    cookiePathRewrite: backendBootstrapPath ? { [backendBootstrapPath]: '/' } : undefined,
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
    },
  });

  const apiProxy = {
    '/api': createProxyConfig(rewriteApiPath),
    '/user': createProxyConfig(addLegacyResourcePrefix),
    '/karte': createProxyConfig(addLegacyResourcePrefix),
    '/odletter': createProxyConfig(addLegacyResourcePrefix),
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
