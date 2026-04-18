import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META' })),
  updateObservabilityMeta: vi.fn(),
}));

const mockRefetchOfficialCanonicalPatients = vi.fn();

vi.mock('../../patients/api', () => ({
  refetchOfficialCanonicalPatients: (...args: unknown[]) => mockRefetchOfficialCanonicalPatients(...args),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { importPatientsFromOrca } from '../orcaPatientImportApi';

describe('importPatientsFromOrca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetchOfficialCanonicalPatients.mockResolvedValue({
      ok: true,
      patients: [{ patientId: '000001', name: '山田 太郎' }],
      status: 200,
      matchedPatientIds: ['000001'],
      missingPatientIds: [],
    });
  });

  it('surfaces auth failure reason on 401 and suppresses session-expiry propagation', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reason: 'authentication_failed',
          message: 'Authentication required',
          runId: 'RUN-401',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe('auth');
    expect(result.errorCode).toBe('authentication_failed');
    expect(result.error).toContain('認証エラー');
    expect(httpFetch).toHaveBeenCalledWith(
      '/api/orca/official/patients/import',
      expect.objectContaining({
        notifySessionExpired: false,
      }),
    );
  });

  it('classifies html 404 as route mismatch', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response('<!doctype html><html><body>Not Found</body></html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe('route_not_found');
    expect(result.routeMismatch).toBe(true);
    expect(result.error).toContain('経路不一致');
  });

  it('returns http error when network request throws', async () => {
    vi.mocked(httpFetch).mockRejectedValueOnce(new Error('network down'));

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.errorKind).toBe('http');
    expect(result.error).toContain('network down');
  });

  it('re-fetches canonical patient after successful import', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          apiResult: '00',
          apiResultMessage: 'OK',
          runId: 'RUN-OK',
          requestedCount: 1,
          fetchedCount: 1,
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(true);
    expect(result.writeAccepted).toBe(true);
    expect(mockRefetchOfficialCanonicalPatients).toHaveBeenCalledWith({
      patientIds: ['000001'],
      runId: 'RUN-OK',
    });
    expect(result.canonicalPatients).toEqual([{ patientId: '000001', name: '山田 太郎' }]);
  });

  it('write accepted でも canonical re-fetch 失敗なら full success にしない', async () => {
    mockRefetchOfficialCanonicalPatients.mockResolvedValueOnce({
      ok: false,
      patients: [],
      status: 503,
      matchedPatientIds: [],
      missingPatientIds: ['000001'],
    });
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          apiResult: '00',
          apiResultMessage: 'OK',
          runId: 'RUN-OK',
          requestedCount: 1,
          fetchedCount: 1,
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.writeAccepted).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.errorCategory).toBe('canonical_refetch_failed');
    expect(result.error).toContain('canonical 再取得に失敗');
    expect(result.canonicalRefetch).toMatchObject({
      source: 'patientlst2v2',
      ok: false,
      expectedPatientIds: ['000001'],
      matchedPatientIds: [],
      missingPatientIds: ['000001'],
    });
  });

  it('HTTP 200 でも business partial は full success にしない', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          apiResult: '10',
          apiResultMessage: 'PARTIAL',
          runId: 'RUN-PARTIAL',
          requestedCount: 1,
          fetchedCount: 0,
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 1,
          errors: [{ patientId: '000001', message: 'Import failed' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.writeAccepted).toBe(true);
    expect(result.businessOk).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.errorCategory).toBe('business_partial');
    expect(result.error).toContain('Api_Result=10 / message=PARTIAL で business success ではない');
    expect(result.importSummary).toMatchObject({
      apiResult: '10',
      apiResultMessage: 'PARTIAL',
      requestedCount: 1,
      fetchedCount: 0,
      importedCount: 0,
      skippedCount: 1,
      errorsCount: 1,
    });
    expect(mockRefetchOfficialCanonicalPatients).not.toHaveBeenCalled();
  });

  it('HTTP 200 でも skippedCount>0 は full success にしない', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          apiResult: '00',
          apiResultMessage: 'OK',
          runId: 'RUN-SKIPPED',
          requestedCount: 1,
          fetchedCount: 1,
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 1,
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(false);
    expect(result.writeAccepted).toBe(true);
    expect(result.businessOk).toBe(false);
    expect(result.errorCategory).toBe('business_partial');
    expect(result.error).toContain('skippedCount=1 が返された');
    expect(mockRefetchOfficialCanonicalPatients).not.toHaveBeenCalled();
  });

  it('HTTP 200 でも requested/fetched/imported 不整合は full success にしない', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          apiResult: '00',
          apiResultMessage: 'OK',
          runId: 'RUN-COUNT-MISMATCH',
          requestedCount: 2,
          fetchedCount: 2,
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001', '000002'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(false);
    expect(result.writeAccepted).toBe(true);
    expect(result.businessOk).toBe(false);
    expect(result.errorCategory).toBe('business_partial');
    expect(result.error).toContain('requested/fetched/imported の件数整合が取れない');
    expect(mockRefetchOfficialCanonicalPatients).not.toHaveBeenCalled();
  });

  it('HTTP 200 でも count 項目が不足していれば fail closed で partial にする', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          apiResult: '00',
          apiResultMessage: 'OK',
          runId: 'RUN-AMBIGUOUS',
          requestedCount: 1,
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(false);
    expect(result.writeAccepted).toBe(true);
    expect(result.businessOk).toBe(false);
    expect(result.errorCategory).toBe('business_partial');
    expect(result.error).toContain('skippedCount を確認できず full success を判定できない');
    expect(mockRefetchOfficialCanonicalPatients).not.toHaveBeenCalled();
  });
});
