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
import { createOfficialPatient, searchLocalPatients, updateOfficialPatient } from '../api';

const buildCanonicalBatchResponse = (patientId: string, name: string) =>
  new Response(
    JSON.stringify({
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
    expect(result.canonicalRefetch).toMatchObject({
      source: 'patientlst2v2',
      ok: true,
      status: 200,
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
    expect(result.canonicalRefetch?.ok).toBe(true);
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
