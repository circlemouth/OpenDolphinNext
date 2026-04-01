import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META' })),
  updateObservabilityMeta: vi.fn(),
}));

vi.mock('../outpatient/orcaPatientImportApi', () => ({
  importPatientsFromOrca: vi.fn(),
}));

import { httpFetch } from '../../libs/http/httpClient';
import { importPatientsFromOrca } from '../outpatient/orcaPatientImportApi';
import { fetchOrderBundles, fetchOrderBundlesWithPatientImportRecovery } from './orderBundleApi';

describe('orderBundleApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies html 404 as route mismatch', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response('<!doctype html><html><body>Not Found</body></html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );

    const result = await fetchOrderBundles({ patientId: '000001' });

    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe('route_not_found');
    expect(result.routeMismatch).toBe(true);
  });

  it('retries once after patient import on recoverable business 404', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'patient_not_found',
            message: 'missing',
            runId: 'RUN-404',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-200',
            patientId: '000001',
            bundles: [{ entity: 'medOrder', items: [{ name: '薬A' }] }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    vi.mocked(importPatientsFromOrca).mockResolvedValueOnce({
      ok: true,
      runId: 'RUN-IMPORT',
      status: 200,
      payload: {},
    });

    const result = await fetchOrderBundlesWithPatientImportRecovery({ patientId: '000001', from: '2026-02-22' });

    expect(httpFetch).toHaveBeenCalledTimes(2);
    expect(importPatientsFromOrca).toHaveBeenCalledWith({
      patientIds: ['000001'],
      runId: 'RUN-404',
    });
    expect(result.ok).toBe(true);
    expect(result.patientImportAttempted).toBe(true);
    expect((result.bundles ?? []).length).toBe(1);
  });

  it('returns explicit auth message when patient import fails with 401', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'patient_not_found',
          message: 'missing',
          runId: 'RUN-404',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.mocked(importPatientsFromOrca).mockResolvedValueOnce({
      ok: false,
      runId: 'RUN-IMPORT',
      status: 401,
      errorCode: 'authentication_failed',
      errorKind: 'auth',
      error: 'unauthorized',
    });

    const result = await fetchOrderBundlesWithPatientImportRecovery({ patientId: '000001', from: '2026-02-22' });

    expect(httpFetch).toHaveBeenCalledTimes(1);
    expect(importPatientsFromOrca).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe('auth');
    expect(result.patientImportAttempted).toBe(true);
    expect(result.message).toContain('認証状態を確認してからやり直してください');
    expect(result.message).not.toContain('authentication_failed');
  });
});
