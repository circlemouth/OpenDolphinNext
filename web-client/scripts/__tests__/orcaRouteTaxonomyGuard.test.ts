import { describe, expect, it } from 'vitest';
import path from 'node:path';

import {
  ROUTE_GUARD_CATEGORIES,
  classifyOrcaRouteReference,
  extractOrcaRouteReferences,
  scanOrcaRouteTaxonomy,
} from '../lib/orca-route-taxonomy-guard.mjs';

describe('orca route taxonomy guard classifier', () => {
  it('allows current official/master routes without classifying them as retained strings', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/src/features/reception/api.ts',
      route: '/api/orca/official/appointments/list',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBeUndefined();
  });

  it('classifies docs references to official routes as docs/reference, not public route declarations', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'docs/contracts/orca-route-taxonomy.md',
      route: '/api/orca/official/appointments/list',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.DOCS_REFERENCE);
    expect(result.reason).toContain('not a public-route declaration');
  });

  it('allows the production fail-close legacy route sentinel only in the pinned client file', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/src/features/outpatient/orcaQueueApi.ts',
      route: '/api/orca/queue',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.PRODUCTION_FAIL_CLOSE_SENTINEL);
  });

  it('classifies runtime-ready-smoke legacy route strings as blocked-route detectors, not success routes', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'web-client/scripts/runtime-ready-smoke.mjs',
      route: '/api/orca/queue',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.BLOCKED_ROUTE_DETECTOR);
    expect(result.reason).toContain('count any browser request');
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
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.E2E_QA_FIXTURE_SURFACE);
  });

  it('classifies server route inventory negative assertions separately from public routes', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java',
      route: '/api/orca/queue',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.SERVER_ROUTE_INVENTORY_NEGATIVE_ASSERTION);
  });

  it('classifies web.xml exposure negative assertions separately from public routes', () => {
    const result = classifyOrcaRouteReference({
      relativePath: 'server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java',
      route: '/api/orca/pusheventgetv2',
    });

    expect(result.allowed).toBe(true);
    expect(result.category).toBe(ROUTE_GUARD_CATEGORIES.WEB_XML_EXPOSURE_NEGATIVE_ASSERTION);
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
