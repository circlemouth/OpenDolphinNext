import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPatientMasterSearch } from '../patientSearchApi';

const httpFetch = vi.hoisted(() => vi.fn());

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch,
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: () => 'RUN-PATIENT-SEARCH',
  getObservabilityMeta: () => ({}),
  updateObservabilityMeta: vi.fn(),
}));

describe('fetchPatientMasterSearch', () => {
  beforeEach(() => {
    httpFetch.mockReset();
  });

  it('requires WholeName before calling the official endpoint', async () => {
    await expect(fetchPatientMasterSearch({ kana: 'ヤマダ タロウ' })).rejects.toThrow('氏名（WholeName）は必須です。');
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('posts only official fields and omits inOut when unselected', async () => {
    httpFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        patientlst3res: {
          apiResult: '00',
          apiResultMessage: '処理終了',
          patients: [{ patientId: '000001', wholeName: '山田太郎', wholeNameKana: 'ヤマダタロウ' }],
          targetPatientCount: 1,
        },
        runId: 'RUN-PATIENT-SEARCH',
      }),
    });

    const response = await fetchPatientMasterSearch({
      name: '山田 太郎',
      kana: 'ヤマダ タロウ',
      sex: '1',
    });

    expect(response.patients[0]).toMatchObject({
      patientId: '000001',
      name: '山田太郎',
      kana: 'ヤマダタロウ',
    });
    expect(httpFetch).toHaveBeenCalledWith(
      '/api/orca/official/patients/name-search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: '山田 太郎',
          sex: '1',
        }),
      }),
    );
  });

  it('posts birth range, official sex code, and inOut when selected', async () => {
    httpFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        patientlst3res: {
          apiResult: '00',
          apiResultMessage: '処理終了',
          patients: [{ patientId: '000002', wholeName: '佐藤花子', wholeNameKana: 'サトウハナコ' }],
          targetPatientCount: 1,
        },
        runId: 'RUN-PATIENT-SEARCH',
      }),
    });

    await fetchPatientMasterSearch({
      name: '佐藤 花子',
      birthStartDate: '1985-01-01',
      birthEndDate: '1985-12-31',
      sex: '2',
      inOut: '2',
    });

    expect(httpFetch).toHaveBeenCalledWith(
      '/api/orca/official/patients/name-search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: '佐藤 花子',
          birthStartDate: '1985-01-01',
          birthEndDate: '1985-12-31',
          sex: '2',
          inOut: '2',
        }),
      }),
    );
  });
});
