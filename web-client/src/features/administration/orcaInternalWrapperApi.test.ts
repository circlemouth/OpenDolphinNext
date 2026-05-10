import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  postMedicalRecords,
  postMedicalSets,
  postBirthDelivery,
  postSubjectiveEntry,
} from './orcaInternalWrapperApi';
import { httpFetch } from '../../libs/http/httpClient';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockHttpFetch.mockReset();
});

describe('orcaInternalWrapperApi', () => {
  it('stub 応答(Api_Result=79)を検知して stub=true を返す', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          apiResult: '79',
          apiResultMessage: 'Spec-based implementation / Trial未検証',
          runId: 'RUN-SET-1',
          messageDetail: 'stub response',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': 'TRACE-SET-1',
            'x-missing-master': 'true',
            'x-fallback-used': 'false',
          },
        },
      ),
    );

    const result = await postMedicalSets({ requestNumber: '01' });

    expect(result.ok).toBe(true);
    expect(result.apiResult).toBe('79');
    expect(result.stub).toBe(true);
    expect(result.runId).toBe('RUN-SET-1');
    expect(result.traceId).toBe('TRACE-SET-1');
    expect(result.missingMaster).toBe(true);
    expect(result.fallbackUsed).toBe(false);
  });

  it('Api_Result が数値型でも stub 判定できる', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          Api_Result: 79,
          Api_Result_Message: 'Trial未検証',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await postMedicalSets({ requestNumber: '01' });

    expect(result.apiResult).toBe('79');
    expect(result.stub).toBe(true);
  });

  it('x-missing-master/x-fallback-used の 1/0 を正規化する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ apiResult: '00', apiResultMessage: 'OK' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'x-missing-master': '1',
          'x-fallback-used': '0',
        },
      }),
    );

    const result = await postMedicalSets({ requestNumber: '01' });

    expect(result.missingMaster).toBe(true);
    expect(result.fallbackUsed).toBe(false);
  });

  it('response.ok=false の場合は error に HTTP <status> を設定する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad request' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const result = await postMedicalSets({ requestNumber: '01' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('HTTP 400');
  });

  it('medical/records のレスポンスを正規化する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          apiResult: '00',
          apiResultMessage: '処理終了',
          runId: 'RUN-MED-1',
          generatedAt: '2026-01-14T00:00:00Z',
          patient: {
            patientId: '00002',
            wholeName: 'テスト 太郎',
          },
          records: [
            {
              performDate: '2026-01-10',
              departmentCode: '01',
              documentId: 'DOC-1',
              documentStatus: 'FINAL',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const result = await postMedicalRecords({ patientId: '00002' });

    expect(result.ok).toBe(true);
    expect(result.apiResult).toBe('00');
    expect(result.records.length).toBe(1);
    expect(result.patient?.patientId).toBe('00002');
  });

  it('postSubjectiveEntry / postBirthDelivery の正規化が崩れない', async () => {
    const responses = [
      new Response(JSON.stringify({ apiResult: '00', apiResultMessage: 'OK', runId: 'RUN-SUBJ' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(JSON.stringify({ apiResult: '79', apiResultMessage: 'stub', runId: 'RUN-BIRTH' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ];
    let callIndex = 0;
    mockHttpFetch.mockImplementation(async () => responses[callIndex++]);

    const subjectives = await postSubjectiveEntry({ patientId: '00002', body: 'test' });
    const birth = await postBirthDelivery({ patientId: '00002' });

    expect(subjectives.ok).toBe(true);
    expect(subjectives.apiResult).toBe('00');
    expect(subjectives.runId).toBe('RUN-SUBJ');
    expect(birth.stub).toBe(true);
    expect(birth.runId).toBe('RUN-BIRTH');
  });
});
