import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META', traceId: 'TRACE-META' })),
  updateObservabilityMeta: vi.fn(),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { createOfficialPatient, refetchOfficialCanonicalPatients, searchLocalPatients, updateOfficialPatient } from '../api';

const buildCanonicalBatchResponse = (
  patientId: string,
  name: string,
  options: { apiResult?: string; apiResultMessage?: string } = { apiResult: '00', apiResultMessage: 'OK' },
) =>
  new Response(
    JSON.stringify({
      ...(options.apiResult === undefined ? {} : { apiResult: options.apiResult }),
      ...(options.apiResultMessage === undefined ? {} : { apiResultMessage: options.apiResultMessage }),
      patients: [
        {
          summary: {
            patientId,
            wholeName: name,
            wholeNameKana: 'カンジャ',
            birthDate: '1980-01-01',
            sex: '1',
          },
          phoneNumber1: '0311112222',
          zipCode: '100-0001',
          address: '東京都千代田区',
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );

describe('patients api official mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create sends patientId=* and re-fetches canonical patient', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            apiResult: '00',
            apiResultMessage: 'ORCA登録完了',
            runId: 'RUN-CREATE',
            traceId: 'TRACE-CREATE',
            routeNamespace: 'official',
            patient: {
              patientId: '000099',
              name: '新規患者',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(buildCanonicalBatchResponse('000099', '新規患者'));

    const result = await createOfficialPatient({
      patient: {
        name: '新規患者',
        kana: 'シンキ カンジャ',
        birthDate: '1980-01-01',
        sex: 'M',
      },
    });

    expect(httpFetch).toHaveBeenNthCalledWith(
      1,
      '/api/orca/official/patientmodv2/outpatient/create',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const createInit = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit | undefined;
    const createBody = JSON.parse(String(createInit?.body));
    expect(createBody.patient.patientId).toBe('*');

    expect(httpFetch).toHaveBeenNthCalledWith(
      2,
      '/api/orca/official/patients/batch',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result.canonicalPatient).toMatchObject({
      patientId: '000099',
      name: '新規患者',
    });
    expect(result.writeAccepted).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.canonicalRefetch).toMatchObject({
      source: 'patientlst2v2',
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
    });
  });

  it('update keeps patientId and re-fetches canonical patient', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            apiResult: '00',
            apiResultMessage: 'ORCA更新完了',
            runId: 'RUN-UPDATE',
            traceId: 'TRACE-UPDATE',
            routeNamespace: 'official',
            patient: {
              patientId: '000001',
              name: '既存患者 改',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(buildCanonicalBatchResponse('000001', '既存患者 改'));

    const result = await updateOfficialPatient({
      patient: {
        patientId: '000001',
        name: '既存患者 改',
        kana: 'キソン カンジャ',
        birthDate: '1980-01-01',
        sex: 'F',
      },
    });

    expect(httpFetch).toHaveBeenNthCalledWith(
      1,
      '/api/orca/official/patientmodv2/outpatient/update',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const updateInit = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit | undefined;
    const updateBody = JSON.parse(String(updateInit?.body));
    expect(updateBody.patient.patientId).toBe('000001');
    expect(result.canonicalPatient).toMatchObject({
      patientId: '000001',
      name: '既存患者 改',
    });
    expect(result.writeAccepted).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.canonicalRefetch?.ok).toBe(true);
  });

  it('canonical batch HTTP 200 + Api_Result=10 + matching patient は ok=false', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      buildCanonicalBatchResponse('000001', '既存患者', {
        apiResult: '10',
        apiResultMessage: 'BUSINESS ERROR',
      }),
    );

    const result = await refetchOfficialCanonicalPatients({
      patientIds: ['000001'],
      runId: 'RUN-CANONICAL',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(200);
    expect(result.apiResult).toBe('10');
    expect(result.apiResultMessage).toBe('BUSINESS ERROR');
    expect(result.matchedPatientIds).toEqual(['000001']);
    expect(result.missingPatientIds).toEqual([]);
  });

  it('canonical batch HTTP 200 + Api_Result missing + matching patient は ok=false', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      buildCanonicalBatchResponse('000001', '既存患者', {
        apiResult: undefined,
        apiResultMessage: 'OK',
      }),
    );

    const result = await refetchOfficialCanonicalPatients({
      patientIds: ['000001'],
      runId: 'RUN-CANONICAL',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(200);
    expect(result.apiResult).toBeUndefined();
    expect(result.apiResultMessage).toBe('OK');
    expect(result.matchedPatientIds).toEqual(['000001']);
    expect(result.missingPatientIds).toEqual([]);
  });

  it('canonical batch HTTP 200 + Api_Result=00 + matching patient は ok=true', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      buildCanonicalBatchResponse('000001', '既存患者', {
        apiResult: '00',
        apiResultMessage: 'OK',
      }),
    );

    const result = await refetchOfficialCanonicalPatients({
      patientIds: ['000001'],
      runId: 'RUN-CANONICAL',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.apiResult).toBe('00');
    expect(result.apiResultMessage).toBe('OK');
    expect(result.matchedPatientIds).toEqual(['000001']);
    expect(result.missingPatientIds).toEqual([]);
  });

  it('write accepted でも canonical batch Api_Result=10 なら full success にしない', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            apiResult: '00',
            apiResultMessage: 'ORCA更新完了',
            runId: 'RUN-UPDATE',
            traceId: 'TRACE-UPDATE',
            routeNamespace: 'official',
            patient: {
              patientId: '000001',
              name: '既存患者 改',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        buildCanonicalBatchResponse('000001', '既存患者 改', {
          apiResult: '10',
          apiResultMessage: 'BUSINESS ERROR',
        }),
      );

    const result = await updateOfficialPatient({
      patient: {
        patientId: '000001',
        name: '既存患者 改',
      },
    });

    expect(result.writeAccepted).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.errorCategory).toBe('canonical_refetch_failed');
    expect(result.canonicalRefetch).toMatchObject({
      source: 'patientlst2v2',
      ok: false,
      status: 200,
      apiResult: '10',
      apiResultMessage: 'BUSINESS ERROR',
      expectedPatientIds: ['000001'],
      matchedPatientIds: ['000001'],
      missingPatientIds: [],
    });
  });

  it('write accepted でも canonical re-fetch が失敗したら full success にしない', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            apiResult: '00',
            apiResultMessage: 'ORCA更新完了',
            runId: 'RUN-UPDATE',
            traceId: 'TRACE-UPDATE',
            routeNamespace: 'official',
            patient: {
              patientId: '000001',
              name: '既存患者 改',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ apiResult: '00', apiResultMessage: 'OK', patients: [] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const result = await updateOfficialPatient({
      patient: {
        patientId: '000001',
        name: '既存患者 改',
      },
    });

    expect(result.writeAccepted).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.message).toBe('既存患者更新は受け付けられましたが、canonical 再取得に失敗したため完了扱いにできません。');
    expect(result.canonicalRefetch).toMatchObject({
      source: 'patientlst2v2',
      ok: false,
      expectedPatientIds: ['000001'],
      matchedPatientIds: [],
      missingPatientIds: ['000001'],
    });
  });

  it('create 200 でも canonical re-fetch が失敗したら full success にしない', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            apiResult: '00',
            apiResultMessage: 'ORCA登録完了',
            runId: 'RUN-CREATE',
            traceId: 'TRACE-CREATE',
            routeNamespace: 'official',
            patient: {
              patientId: '000099',
              name: '新規患者',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ apiResult: '00', apiResultMessage: 'OK', patients: [] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const result = await createOfficialPatient({
      patient: {
        name: '新規患者',
      },
    });

    expect(result.writeAccepted).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.errorCategory).toBe('canonical_refetch_failed');
    expect(result.message).toBe('新患登録は受け付けられましたが、canonical 再取得に失敗したため完了扱いにできません。');
    expect(result.canonicalRefetch).toMatchObject({
      source: 'patientlst2v2',
      ok: false,
      expectedPatientIds: ['000099'],
      matchedPatientIds: [],
      missingPatientIds: ['000099'],
    });
  });

  it('local search keeps /api/local boundary and infers searchType on the client', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-SEARCH',
          traceId: 'TRACE-SEARCH',
          routeNamespace: 'local',
          dataSourceTransition: 'local',
          apiResult: '00',
          apiResultMessage: 'OK',
          recordsReturned: 1,
          fetchedAt: '2026-04-13T05:15:00Z',
          patients: [
            {
              patientId: '000001',
              name: '山田 太郎',
              kana: 'ヤマダ タロウ',
            },
          ],
          auditEvent: {
            action: 'LOCAL_PATIENT_SEARCH',
            details: {
              sourcePath: '/api/local/patients/search',
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await searchLocalPatients({
      keyword: '031-1111-2222',
    });

    expect(httpFetch).toHaveBeenNthCalledWith(
      1,
      '/api/local/patients/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const searchInit = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit | undefined;
    const searchBody = JSON.parse(String(searchInit?.body));
    expect(searchBody).toMatchObject({
      keyword: '031-1111-2222',
      searchType: 'telephone',
      runId: 'RUN-META',
    });
    expect(result.routeNamespace).toBe('local');
    expect(result.sourcePath).toBe('/api/local/patients/search');
    expect(result.patients[0]).toMatchObject({
      patientId: '000001',
      name: '山田 太郎',
    });
  });
});
