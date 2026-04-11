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
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await importPatientsFromOrca({ patientIds: ['000001'], runId: 'RUN-CALL' });

    expect(result.ok).toBe(true);
    expect(mockRefetchOfficialCanonicalPatients).toHaveBeenCalledWith({
      patientIds: ['000001'],
      runId: 'RUN-OK',
    });
    expect(result.canonicalPatients).toEqual([{ patientId: '000001', name: '山田 太郎' }]);
  });
});
