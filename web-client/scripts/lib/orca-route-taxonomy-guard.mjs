import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const helperPath = fileURLToPath(import.meta.url);
const helperDir = path.dirname(helperPath);
const webClientRootDir = path.resolve(helperDir, '..', '..');
const repoRootDir = path.resolve(webClientRootDir, '..');

export const ROUTE_GUARD_CATEGORIES = {
  PRODUCTION_FAIL_CLOSE_SENTINEL: 'production fail-close sentinel',
  MSW_MOCK_TEST_ONLY_LEGACY_ROUTE_SURFACE: 'MSW mock/test-only legacy route surface',
  E2E_QA_FIXTURE_SURFACE: 'e2e/QA fixture surface',
  BLOCKED_ROUTE_DETECTOR: 'blocked-route detector',
  DOCS_REFERENCE: 'docs',
  SERVER_ROUTE_INVENTORY_NEGATIVE_ASSERTION: 'server route inventory negative assertion',
  WEB_XML_EXPOSURE_NEGATIVE_ASSERTION: 'web.xml exposure negative assertion',
};

const LEGACY_ORCA_ROUTES = new Set(['/api/orca/queue', '/api/orca/pusheventgetv2']);

export const SCAN_ROOTS = [
  'server-modernized/src/test',
  'web-client/src',
  'web-client/scripts',
  'web-client/plugins',
  'tests',
  'docs',
];

const TEXT_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.csv',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const SKIPPED_DIRECTORY_NAMES = new Set(['.git', 'coverage', 'dist', 'node_modules', 'target']);

export const ROUTE_CLASSIFICATION_ALLOWLIST = [
  {
    path: 'web-client/src/features/outpatient/orcaQueueApi.ts',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.PRODUCTION_FAIL_CLOSE_SENTINEL,
    reason: 'historical route string retained only to return the explicit fail-close unavailable response',
  },
  {
    path: 'web-client/src/features/outpatient/orcaQueueApi.ts',
    route: '/api/orca/pusheventgetv2',
    category: ROUTE_GUARD_CATEGORIES.PRODUCTION_FAIL_CLOSE_SENTINEL,
    reason: 'historical route string retained only to return the explicit fail-close unavailable response',
  },
  {
    path: 'web-client/src/mocks/handlers/orcaQueue.ts',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.MSW_MOCK_TEST_ONLY_LEGACY_ROUTE_SURFACE,
    reason: 'MSW-only handler for isolated legacy queue tests, not a public taxonomy route',
  },
  {
    path: 'web-client/src/mocks/handlers/orcaQueue.ts',
    route: '/api/orca/pusheventgetv2',
    category: ROUTE_GUARD_CATEGORIES.MSW_MOCK_TEST_ONLY_LEGACY_ROUTE_SURFACE,
    reason: 'MSW-only handler for isolated legacy push-event tests, not a public taxonomy route',
  },
  {
    path: 'web-client/plugins/flagged-mock-plugin.ts',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
    reason: 'Vite dev/preview fixture gated by explicit mock headers or env flags',
  },
  {
    path: 'web-client/plugins/flagged-mock-plugin.ts',
    route: '/api/orca/official/*/mock',
    category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
    reason: 'Vite dev/preview fixture endpoint gated by explicit mock headers or env flags',
  },
  {
    path: 'web-client/scripts/qa-*.mjs',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
    reason: 'QA script network capture target for legacy-route regression evidence',
  },
  {
    path: 'web-client/scripts/runtime-ready-smoke.mjs',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.BLOCKED_ROUTE_DETECTOR,
    reason: 'runtime smoke must count any browser request to the blocked legacy queue route as failure',
  },
  {
    path: 'web-client/scripts/runtime-ready-smoke.mjs',
    route: '/api/orca/pusheventgetv2',
    category: ROUTE_GUARD_CATEGORIES.BLOCKED_ROUTE_DETECTOR,
    reason: 'runtime smoke must count any browser request to the blocked legacy push-event route as failure',
  },
  {
    path: 'web-client/scripts/verify-no-blocked-orca-route-strings.mjs',
    route: '/api/orca/**',
    category: ROUTE_GUARD_CATEGORIES.BLOCKED_ROUTE_DETECTOR,
    reason: 'guard CLI entrypoint may reference monitored route taxonomy strings',
  },
  {
    path: 'web-client/scripts/lib/orca-route-taxonomy-guard.mjs',
    route: '/api/orca/**',
    category: ROUTE_GUARD_CATEGORIES.BLOCKED_ROUTE_DETECTOR,
    reason: 'guard helper owns the route taxonomy classifier and allowlist',
  },
  {
    path: 'web-client/scripts/__tests__/orcaRouteTaxonomyGuard.test.ts',
    route: '/api/orca/**',
    category: ROUTE_GUARD_CATEGORIES.BLOCKED_ROUTE_DETECTOR,
    reason: 'classifier fixture test covers allowed and rejected route surfaces',
  },
  {
    path: 'tests/**',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
    reason: 'Playwright fixtures may stub or assert blocked legacy queue behavior outside production source',
  },
  {
    path: 'tests/**',
    route: '/api/orca/pusheventgetv2',
    category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
    reason: 'Playwright fixtures may stub or assert blocked legacy push-event behavior outside production source',
  },
  {
    path: 'tests/**',
    route: '/api/orca/official/*/mock',
    category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
    reason: 'Playwright fixtures may use explicit mock-only official paths outside production source',
  },
  {
    path: 'server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.SERVER_ROUTE_INVENTORY_NEGATIVE_ASSERTION,
    reason: 'server route inventory test asserts the blocked legacy queue route is absent',
  },
  {
    path: 'server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java',
    route: '/api/orca/pusheventgetv2',
    category: ROUTE_GUARD_CATEGORIES.SERVER_ROUTE_INVENTORY_NEGATIVE_ASSERTION,
    reason: 'server route inventory test asserts the blocked legacy push-event route is absent',
  },
  {
    path: 'server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.WEB_XML_EXPOSURE_NEGATIVE_ASSERTION,
    reason: 'web.xml exposure test asserts the blocked legacy queue route is not exposed',
  },
  {
    path: 'server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java',
    route: '/api/orca/pusheventgetv2',
    category: ROUTE_GUARD_CATEGORIES.WEB_XML_EXPOSURE_NEGATIVE_ASSERTION,
    reason: 'web.xml exposure test asserts the blocked legacy push-event route is not exposed',
  },
  {
    path: 'docs/**',
    route: '/api/orca/queue',
    category: ROUTE_GUARD_CATEGORIES.DOCS_REFERENCE,
    reason: 'documentation may describe the blocked legacy route as a non-public fail-close exception',
  },
  {
    path: 'docs/**',
    route: '/api/orca/pusheventgetv2',
    category: ROUTE_GUARD_CATEGORIES.DOCS_REFERENCE,
    reason: 'documentation may describe the blocked legacy route as a non-public fail-close exception',
  },
];

const normalizeRelativePath = (filePath, rootDir = repoRootDir) => path.relative(rootDir, filePath).split(path.sep).join('/');

const globToRegExp = (glob) => {
  const escaped = glob
    .split('')
    .map((char) => {
      if (char === '*') return '*';
      return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
    })
    .join('');
  return new RegExp(
    `^${escaped
      .replace(/\*\*/g, '\0')
      .replace(/\*/g, '[^/]*')
      .replace(/\0/g, '.*')}$`,
  );
};

const matchesGlob = (value, glob) => globToRegExp(glob).test(value);

const matchesAllowlistEntry = ({ relativePath, route }, entry) =>
  matchesGlob(relativePath, entry.path) && matchesGlob(route, entry.route);

const findAllowlistEntry = (relativePath, route) =>
  ROUTE_CLASSIFICATION_ALLOWLIST.find((entry) => matchesAllowlistEntry({ relativePath, route }, entry));

const isDocsPath = (relativePath) =>
  relativePath.startsWith('docs/');

const isTestPath = (relativePath) =>
  relativePath.startsWith('tests/') ||
  relativePath.includes('/__tests__/') ||
  /\.test\.[cm]?[jt]sx?$/.test(relativePath) ||
  /\.spec\.[cm]?[jt]sx?$/.test(relativePath);

const isMswMockPath = (relativePath) => relativePath.startsWith('web-client/src/mocks/');

const isProductionSourcePath = (relativePath) =>
  relativePath.startsWith('web-client/src/') && !isMswMockPath(relativePath) && !isTestPath(relativePath);

const isOfficialOrMasterRoute = (route) => route.startsWith('/api/orca/official/') || route.startsWith('/api/orca/master/');

const isMockRouteSurface = (route) => /^\/api\/orca\/official\/.+\/mock(?:\/|$)/.test(route);

const buildFailure = (reason, category) => ({ allowed: false, category, reason });

export const classifyOrcaRouteReference = ({ relativePath, route }) => {
  const allowlistEntry = findAllowlistEntry(relativePath, route);
  if (allowlistEntry) {
    return {
      allowed: true,
      category: allowlistEntry.category,
      reason: allowlistEntry.reason,
      allowlistPath: allowlistEntry.path,
      allowlistRoute: allowlistEntry.route,
    };
  }

  if (LEGACY_ORCA_ROUTES.has(route)) {
    return buildFailure(
      'blocked legacy ORCA route is not allowlisted for this path',
      ROUTE_GUARD_CATEGORIES.PRODUCTION_FAIL_CLOSE_SENTINEL,
    );
  }

  if (isMockRouteSurface(route)) {
    if (isProductionSourcePath(relativePath)) {
      return buildFailure(
        'mock/test-only ORCA route surface is present in production source',
        ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
      );
    }
    if (isMswMockPath(relativePath)) {
      return {
        allowed: true,
        category: ROUTE_GUARD_CATEGORIES.MSW_MOCK_TEST_ONLY_LEGACY_ROUTE_SURFACE,
        reason: 'MSW mock surface is isolated under web-client/src/mocks',
      };
    }
    if (isTestPath(relativePath) || relativePath.startsWith('web-client/scripts/') || relativePath.startsWith('web-client/plugins/')) {
      return {
        allowed: true,
        category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
        reason: 'mock surface is isolated to test, QA, or dev fixture code',
      };
    }
    if (isDocsPath(relativePath)) {
      return {
        allowed: true,
        category: ROUTE_GUARD_CATEGORIES.DOCS_REFERENCE,
        reason: 'documentation-only mock route reference',
      };
    }
    return buildFailure('mock/test-only ORCA route surface is not allowlisted for this path', ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE);
  }

  if (!isOfficialOrMasterRoute(route)) {
    return buildFailure(
      'public /api/orca route must be under /api/orca/official/* or /api/orca/master/*',
      'public route taxonomy violation',
    );
  }

  if (isDocsPath(relativePath)) {
    return {
      allowed: true,
      category: ROUTE_GUARD_CATEGORIES.DOCS_REFERENCE,
      reason: 'documentation reference to the official/master taxonomy; not a public-route declaration',
    };
  }

  if (isTestPath(relativePath) || relativePath.startsWith('web-client/scripts/') || relativePath.startsWith('web-client/plugins/')) {
    return {
      allowed: true,
      category: ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE,
      reason: 'test, QA, or dev fixture reference to the official/master taxonomy; not a public-route declaration',
    };
  }

  return {
    allowed: true,
    reason: 'current public ORCA route uses the official/master taxonomy',
  };
};

export const extractOrcaRouteReferences = (line) => {
  const references = [];
  const routePattern = /\/api\/orca\/[A-Za-z0-9._~!$&+,;=:@%/-]+/g;
  for (const match of line.matchAll(routePattern)) {
    const route = match[0].replace(/[),.;:]+$/g, '');
    if (route === '/api/orca/') continue;
    references.push({ route, column: match.index + 1 });
  }
  return references;
};

const walkTextFiles = (currentPath, files, scanErrors) => {
  let stats;
  try {
    stats = statSync(currentPath);
  } catch (error) {
    scanErrors.push({ path: currentPath, error });
    return;
  }

  if (stats.isDirectory()) {
    let entries;
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      scanErrors.push({ path: currentPath, error });
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..' || SKIPPED_DIRECTORY_NAMES.has(entry.name)) continue;
      walkTextFiles(path.join(currentPath, entry.name), files, scanErrors);
    }
    return;
  }

  if (!stats.isFile() || !TEXT_FILE_EXTENSIONS.has(path.extname(currentPath))) return;
  files.push(currentPath);
};

export const scanOrcaRouteTaxonomy = ({ repoRoot = repoRootDir, scanRoots = SCAN_ROOTS } = {}) => {
  const findings = [];
  const references = [];
  const skippedRoots = [];
  const scanErrors = [];
  const scannedRoots = [];
  let scannedFileCount = 0;

  for (const scanRoot of scanRoots) {
    const absoluteRoot = path.resolve(repoRoot, scanRoot);
    if (!existsSync(absoluteRoot)) {
      skippedRoots.push(scanRoot);
      continue;
    }

    const files = [];
    walkTextFiles(absoluteRoot, files, scanErrors);
    scannedRoots.push(scanRoot);
    scannedFileCount += files.length;

    for (const filePath of files) {
      let content;
      try {
        content = readFileSync(filePath, 'utf8');
      } catch (error) {
        scanErrors.push({ path: filePath, error });
        continue;
      }

      const relativePath = normalizeRelativePath(filePath, repoRoot);
      const lines = content.split(/\r?\n/);
      lines.forEach((line, lineIndex) => {
        for (const reference of extractOrcaRouteReferences(line)) {
          const classification = classifyOrcaRouteReference({ relativePath, route: reference.route });
          const record = {
            relativePath,
            line: lineIndex + 1,
            column: reference.column,
            route: reference.route,
            category: classification.category,
            reason: classification.reason,
          };
          references.push(record);
          if (!classification.allowed) {
            findings.push(record);
          }
        }
      });
    }
  }

  const categoryCounts = Object.fromEntries(Object.values(ROUTE_GUARD_CATEGORIES).map((category) => [category, 0]));
  for (const reference of references) {
    if (!reference.category) continue;
    categoryCounts[reference.category] = (categoryCounts[reference.category] ?? 0) + 1;
  }

  return {
    ok: findings.length === 0 && scanErrors.length === 0,
    findings,
    references,
    categoryCounts,
    scannedFileCount,
    scannedRoots,
    skippedRoots,
    scanErrors,
  };
};

const formatCategoryCounts = (categoryCounts) =>
  Object.entries(categoryCounts)
    .map(([category, count]) => `${category}=${count}`)
    .join(', ');

export const formatGuardSuccessMessage = (result) => {
  const skipped = result.skippedRoots.length ? ` skipped roots: ${result.skippedRoots.join(', ')}` : ' skipped roots: none';
  return (
    `[verify:no-blocked-orca-route-strings] ORCA route taxonomy guard passed. ` +
    `scanned roots=${result.scannedRoots.length}, files=${result.scannedFileCount}. ` +
    `category counts: ${formatCategoryCounts(result.categoryCounts)}.${skipped}`
  );
};

export const runOrcaRouteTaxonomyGuardCli = () => {
  const result = scanOrcaRouteTaxonomy();

  if (result.scanErrors.length > 0) {
    console.error('[verify:no-blocked-orca-route-strings] ORCA route taxonomy scan failed.');
    result.scanErrors.forEach((scanError) => {
      console.error(` - ${normalizeRelativePath(scanError.path)}: ${scanError.error?.message ?? String(scanError.error)}`);
    });
  }

  if (result.findings.length > 0) {
    console.error('[verify:no-blocked-orca-route-strings] blocked ORCA route string / taxonomy drift を検出しました。');
    result.findings.forEach((finding) => {
      console.error(
        ` - ${finding.relativePath}:${finding.line}:${finding.column} [${finding.category}] ${finding.route} (${finding.reason})`,
      );
    });
  }

  if (!result.ok) {
    process.exit(2);
  }

  console.log(formatGuardSuccessMessage(result));
};
