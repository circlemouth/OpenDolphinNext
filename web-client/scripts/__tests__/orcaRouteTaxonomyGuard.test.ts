import { describe, expect, it } from 'vitest';
import path from 'node:path';

import {
  ROUTE_GUARD_CATEGORIES,
  classifyOrcaRouteReference,
  extractOrcaRouteReferences,
  scanOrcaRouteTaxonomy,
} from '../lib/orca-route-taxonomy-guard.mjs';

describe('orca route taxonomy guard classifier', () => {
  it('allows current official/master routes as server public route references', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/src/features/reception/api.ts',
      route: '/api/orca/official/appointments/list',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.SERVER_PUBLIC_ROUTE);
  });

  it('allows the production fail-close legacy route sentinel only in the pinned client file', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/src/features/outpatient/orcaQueueApi.ts',
      route: '/api/orca/queue',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.CLIENT_PRODUCTION_FAIL_CLOSE_SENTINEL);
  });

  it('rejects a legacy route when it appears in unrelated production source', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/src/features/charts/someProductionApi.ts',
      route: '/api/orca/queue',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not allowlisted');
  });

  it('rejects new /api/orca routes outside official/master taxonomy', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/src/features/charts/newApi.ts',
      route: '/api/orca/local-summary/charts',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('/api/orca/official');
  });

  it('rejects mock-only official routes in production source', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/src/features/charts/chartApi.ts',
      route: '/api/orca/official/appointments/list/mock',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('production source');
  });

  it('allows mock-only official routes in e2e fixture code', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'tests/charts/e2e-order-save-send-flow.spec.ts',
      route: '/api/orca/official/appointments/list/mock',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.E2E_FIXTURE_TEST_ONLY_SURFACE);
  });

  it('extracts route strings from Playwright glob patterns without trailing wildcards', () => {
    expect(extractOrcaRouteReferences("await page.route('**/api/orca/queue**', route => route.fulfill())")).toEqual([
      { route: '/api/orca/queue', column: 21 },
    ]);
  });
});

describe('orca route taxonomy guard scanner', () => {
  it('reports missing scan roots as explicit skips without failing existing roots', () => {
    const result = scanOrcaRouteTaxonomy({
      repoRoot: path.resolve(process.cwd(), '..'),
      scanRoots: ['web-client/scripts/__tests__', 'missing-route-taxonomy-root'],
    });

    expect(result.ok).toBe(true);
    expect(result.scannedRoots).toContain('web-client/scripts/__tests__');
    expect(result.skippedRoots).toContain('missing-route-taxonomy-root');
  });
});
