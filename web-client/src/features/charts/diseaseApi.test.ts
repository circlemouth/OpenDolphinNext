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
import {
  fetchDiseases,
  fetchDiseasesWithPatientImportRecovery,
  mutateOrcaDisease,
  resolveDiseaseCodeFromOrcaMaster,
  searchDiseaseMasterCandidates,
} from './diseaseApi';

describe('diseaseApi', () => {
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

    const result = await fetchDiseases({ patientId: '000001' });

    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe('route_not_found');
    expect(result.routeMismatch).toBe(true);
  });

  it('sends server-validated baseMonth derived from visit date for ORCA disease mirror', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-DISEASE',
          patientId: '000001',
          orcaMirrorStatus: 'connected',
          diseases: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await fetchDiseases({ patientId: '000001', to: '2026-05-08' });

    expect(httpFetch).toHaveBeenCalledWith('/api/local/diagnoses/000001?to=2026-05-08&baseMonth=202605');
  });

  it('uses explicit sanitized baseMonth and ignores malformed client baseMonth', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-DISEASE', diseases: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-DISEASE', diseases: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await fetchDiseases({ patientId: '000001', to: '2026-05-08', baseMonth: '202604' });
    await fetchDiseases({ patientId: '000001', to: '2026-05-08', baseMonth: '2026-04' });

    expect(httpFetch).toHaveBeenNthCalledWith(1, '/api/local/diagnoses/000001?to=2026-05-08&baseMonth=202604');
    expect(httpFetch).toHaveBeenNthCalledWith(2, '/api/local/diagnoses/000001?to=2026-05-08&baseMonth=202605');
  });

  it('normalizes disease layer metadata from API response', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-DISEASE',
          patientId: '000001',
          diseases: [
            {
              diagnosisName: '高血圧症',
              diagnosisCode: 'I10',
              layer: 'orca-mirror',
              syncState: 'manual-resolution',
              readOnly: true,
            },
            {
              diagnosisName: '脂質異常症',
              diagnosisCode: 'E78.5',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchDiseases({ patientId: '000001' });

    expect(result.diseases).toEqual([
      expect.objectContaining({
        diagnosisName: '高血圧症',
        layer: 'orca-mirror',
        syncState: 'manual-resolution',
        readOnly: true,
        candidateOnly: false,
      }),
      expect.objectContaining({
        diagnosisName: '脂質異常症',
        layer: 'candidate',
        syncState: 'none',
        readOnly: true,
        candidateOnly: true,
        candidateKind: 'draftCandidate',
        sourceOfTruth: 'local-candidate',
      }),
    ]);
  });

  it('retries once after patient import on recoverable 404', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'karte_not_found',
            message: 'karte missing',
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
            diseases: [{ diagnosisName: '感冒', diagnosisCode: 'A123' }],
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

    const result = await fetchDiseasesWithPatientImportRecovery({ patientId: '000001', from: '2026-02-22', to: '2026-02-22' });

    expect(httpFetch).toHaveBeenCalledTimes(2);
    expect(importPatientsFromOrca).toHaveBeenCalledWith({
      patientIds: ['000001'],
      runId: 'RUN-404',
    });
    expect(result.ok).toBe(true);
    expect(result.patientImportAttempted).toBe(true);
    expect((result.diseases ?? []).length).toBe(1);
  });

  it('returns explicit route mismatch message when patient import route is broken', async () => {
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
      status: 404,
      errorKind: 'route_not_found',
      routeMismatch: true,
      error: 'not found',
    });

    const result = await fetchDiseasesWithPatientImportRecovery({ patientId: '000001', from: '2026-02-22', to: '2026-02-22' });

    expect(httpFetch).toHaveBeenCalledTimes(1);
    expect(importPatientsFromOrca).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe('route_not_found');
    expect(result.routeMismatch).toBe(true);
    expect(result.patientImportAttempted).toBe(true);
    expect(result.message).toContain('利用可能な画面からやり直してください');
    expect(result.message).not.toContain('経路不一致');
  });

  it('resolves diagnosis code by exact ORCA disease name match', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          list: [{ code: '8832114', name: '皮膚腫瘍' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const code = await resolveDiseaseCodeFromOrcaMaster({
      diagnosisName: '皮膚腫瘍',
      referenceDate: '2026-02-23',
    });

    expect(code).toBe('8832114');
    expect(httpFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain('/api/orca/official/disease-master/name/');
  });

  it('does not fall back to ICD-10 when ORCA disease codes are ambiguous', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          list: [
            { code: '8839001', name: '高血圧症', icdTen: 'I10' },
            { code: '8839002', name: '高血圧症', icdTen: 'I10' },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const code = await resolveDiseaseCodeFromOrcaMaster({
      diagnosisName: '高血圧症',
      referenceDate: '2026-02-23',
    });

    expect(code).toBeUndefined();
    expect(httpFetch).toHaveBeenCalledTimes(1);
  });

  it('returns sorted and de-duplicated candidates for quick add lookup', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          list: [
            { code: '8839001', name: '高血圧症', icdTen: 'I10' },
            { code: '8839001', name: '高血圧症', icdTen: 'I10' },
            { code: '8839222', name: '高血圧性心疾患', icdTen: 'I11' },
            { code: '8839301', name: '本態性高血圧', icdTen: 'I10' },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const candidates = await searchDiseaseMasterCandidates({
      keyword: '高血圧',
      referenceDate: '2026-02-23',
      limit: 3,
    });

    expect(candidates).toHaveLength(3);
    expect(candidates[0]?.name.startsWith('高血圧')).toBe(true);
    expect(candidates[1]?.name.startsWith('高血圧')).toBe(true);
    expect(candidates).toEqual(
      expect.arrayContaining([
        { name: '高血圧症', code: '8839001', icdTen: 'I10', disUseDate: undefined },
        { name: '高血圧性心疾患', code: '8839222', icdTen: 'I11', disUseDate: undefined },
        { name: '本態性高血圧', code: '8839301', icdTen: 'I10', disUseDate: undefined },
      ]),
    );
    expect(httpFetch).toHaveBeenCalledTimes(1);
  });

  it('does not accept dotted composite codes as a single ORCA disease code', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          list: [{ code: '2056.8832114', name: '顔皮膚腫瘍' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const code = await resolveDiseaseCodeFromOrcaMaster({
      diagnosisName: '顔皮膚腫瘍',
      referenceDate: '2026-02-23',
    });

    expect(code).toBeUndefined();
    expect(httpFetch).toHaveBeenCalledTimes(1);
  });

  it('resolves composite code from prefix + disease split when exact name is absent', async () => {
    vi.mocked(httpFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const decoded = decodeURIComponent(typeof input === 'string' ? input : input.toString());
      if (decoded.includes('/api/orca/official/disease-master/name/顔皮膚腫瘍,')) {
        return new Response(JSON.stringify({ list: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (decoded.includes('/api/orca/official/disease-master/name/顔,')) {
        return new Response(
          JSON.stringify({
            list: [{ code: '2056', name: '顔' }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (decoded.includes('/api/orca/official/disease-master/name/皮膚腫瘍,')) {
        return new Response(
          JSON.stringify({
            list: [{ code: '8832114', name: '皮膚腫瘍' }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify({ list: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const code = await resolveDiseaseCodeFromOrcaMaster({
      diagnosisName: '顔皮膚腫瘍',
      referenceDate: '2026-02-23',
    });

    expect(code).toBeUndefined();
  });

  it('returns undefined when multiple composite candidates exist', async () => {
    vi.mocked(httpFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const decoded = decodeURIComponent(typeof input === 'string' ? input : input.toString());
      if (decoded.includes('/api/orca/official/disease-master/name/顔皮膚腫瘍,')) {
        return new Response(JSON.stringify({ list: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (decoded.includes('/api/orca/official/disease-master/name/顔,')) {
        return new Response(
          JSON.stringify({
            list: [
              { code: '2056', name: '顔' },
              { code: '2057', name: '顔' },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (decoded.includes('/api/orca/official/disease-master/name/皮膚腫瘍,')) {
        return new Response(
          JSON.stringify({
            list: [{ code: '8832114', name: '皮膚腫瘍' }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify({ list: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const code = await resolveDiseaseCodeFromOrcaMaster({
      diagnosisName: '顔皮膚腫瘍',
      referenceDate: '2026-02-23',
    });

    expect(code).toBeUndefined();
  });

  it('sends official ORCA disease mutation without Request_Number, raw XML, or arbitrary URL fields', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ runId: 'RUN-OFFICIAL-DISEASE', businessAccepted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await mutateOrcaDisease({
      patientId: '000001',
      operation: 'create',
      performDate: '2026-05-08',
      departmentCode: '01',
      diseaseInformation: [
        {
          diseaseName: '高血圧症',
          diseaseCode: 'I10',
          diseaseStartDate: '2026-05-08',
          diseaseOutCome: '継続',
          insuranceCombinationNumber: '0001',
        },
      ],
    });

    expect(httpFetch).toHaveBeenCalledWith(
      '/api/orca/official/chart-support/disease-mod-v3',
      expect.objectContaining({ method: 'POST' }),
    );
    const requestInit = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      patientId: '000001',
      operation: 'create',
      performDate: '2026-05-08',
      departmentCode: '01',
      diseaseInformation: [
        {
          diseaseName: '高血圧症',
          diseaseCode: 'I10',
          diseaseStartDate: '2026-05-08',
          diseaseOutCome: '継続',
          insuranceCombinationNumber: '0001',
        },
      ],
    });
    expect(body).not.toHaveProperty('disease');
    expect(body).not.toHaveProperty('requestNumber');
    expect(body).not.toHaveProperty('Request_Number');
    expect(body).not.toHaveProperty('rawXml');
    expect(body).not.toHaveProperty('url');
  });

  it('preserves ORCA spec code fields in official disease mutation payloads', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ runId: 'RUN-OFFICIAL-DISEASE', businessAccepted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await mutateOrcaDisease({
      patientId: '000001',
      operation: 'create',
      baseMonth: '202605',
      performDate: '2026-05-08',
      departmentCode: '01',
      physicianCode: '10001',
      insuranceCombinationNumber: '0001',
      diseaseInformation: [
        {
          diseaseName: '高血圧症',
          diseaseStartDate: '2026-05-08',
          components: [{ seq: 1, componentType: 'BODY', code: '8833421', name: '高血圧症' }],
          diseaseInsuranceClass: '1',
          diseaseCategory: 'PD',
          diseaseClass: '03',
          diseaseReceiptPrint: '1',
          diseaseReceiptPrintPeriod: '12',
          insuranceDisease: '1',
          dischargeCertificate: '0',
          mainDiseaseClass: '01',
          subDiseaseClass: '05',
        },
      ],
    });

    const requestInit = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body)) as {
      diseaseInformation?: Array<Record<string, unknown>>;
    };
    expect(body.diseaseInformation?.[0]).toMatchObject({
      diseaseInsuranceClass: '1',
      diseaseCategory: 'PD',
      diseaseClass: '03',
      diseaseReceiptPrint: '1',
      diseaseReceiptPrintPeriod: '12',
      insuranceDisease: '1',
      dischargeCertificate: '0',
      mainDiseaseClass: '01',
      subDiseaseClass: '05',
    });
  });

  it('rejects UI labels before sending official disease mutation attribute fields', async () => {
    await expect(
      mutateOrcaDisease({
        patientId: '000001',
        operation: 'create',
        performDate: '2026-05-08',
        departmentCode: '01',
        diseaseInformation: [
          {
            diseaseName: '高血圧症',
            diseaseStartDate: '2026-05-08',
            components: [{ seq: 1, componentType: 'BODY', code: '8833421', name: '高血圧症' }],
            diseaseReceiptPrint: 'レセプト表示',
            mainDiseaseClass: '主病名',
          },
        ],
      }),
    ).rejects.toThrow('diseaseInformation[0].diseaseReceiptPrint');

    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('rejects invalid disease receipt print periods before official transport', async () => {
    await expect(
      mutateOrcaDisease({
        patientId: '000001',
        operation: 'create',
        performDate: '2026-05-08',
        departmentCode: '01',
        diseaseInformation: [
          {
            diseaseName: '高血圧症',
            diseaseStartDate: '2026-05-08',
            components: [{ seq: 1, componentType: 'BODY', code: '8833421', name: '高血圧症' }],
            diseaseReceiptPrintPeriod: '100',
          },
        ],
      }),
    ).rejects.toThrow('diseaseInformation[0].diseaseReceiptPrintPeriod');

    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('surfaces ORCA disease mutation review status instead of treating warnings as plain success', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-OFFICIAL-DISEASE',
          businessAccepted: true,
          needsUserReview: true,
          operationStatus: 'ORCA_UNMATCHED',
          warnings: [{ code: 'W001', messageCategory: 'warning_like' }],
          unmatchInformation: [{ code: 'U001', name: '要確認病名', messageCategory: 'unmatched_like' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await mutateOrcaDisease({
      patientId: '000001',
      operation: 'create',
      performDate: '2026-05-08',
      departmentCode: '01',
      diseaseInformation: [
        {
          diseaseName: '高血圧症',
          diseaseCode: 'I10',
          diseaseStartDate: '2026-05-08',
          components: [{ seq: 1, componentType: 'BODY', code: '8833421', name: '高血圧症' }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.businessAccepted).toBe(true);
    expect(result.needsUserReview).toBe(true);
    expect(result.operationStatus).toBe('ORCA_UNMATCHED');
    expect(result.warnings).toEqual([{ code: 'W001', messageCategory: 'warning_like', position: undefined }]);
    expect(result.unmatchInformation).toEqual([
      expect.objectContaining({ code: 'U001', name: '要確認病名', messageCategory: 'unmatched_like' }),
    ]);
    expect(result.message).toBe('ORCA病名の処理結果に確認が必要です。警告または不一致を確認してください。');
  });

  it('normalizes post-mutation mirror readback from disease-mod-v3 responses', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-OFFICIAL-DISEASE-MIRROR',
          businessAccepted: true,
          needsUserReview: false,
          operationStatus: 'ORCA_ACCEPTED',
          postMutationMirrorStatus: 'connected',
          postMutationMirror: {
            ok: true,
            patientId: '000001',
            orcaMirrorStatus: 'connected',
            diseases: [
              {
                diagnosisName: 'ORCA再取得病名',
                diagnosisCode: '8839001',
                displayName: 'ORCA再取得病名',
                layer: 'orca-mirror',
              },
            ],
            pendingLocalDiseases: [
              {
                diagnosisName: '送信候補病名',
                diagnosisCode: '8839002',
                layer: 'candidate',
                candidateKind: 'draftCandidate',
                sourceOfTruth: 'local-candidate',
                candidateOnly: true,
                readOnly: true,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await mutateOrcaDisease({
      patientId: '000001',
      operation: 'create',
      performDate: '2026-05-08',
      departmentCode: '01',
      diseaseInformation: [
        {
          diseaseName: '入力病名',
          diseaseCode: '8839001',
          diseaseStartDate: '2026-05-08',
          components: [{ seq: 1, componentType: 'BODY', code: '8839001', name: '入力病名' }],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.postMutationMirrorStatus).toBe('connected');
    expect(result.postMutationMirror?.orcaMirrorStatus).toBe('connected');
    expect(result.postMutationMirror?.diseases).toEqual([
      expect.objectContaining({
        diagnosisName: 'ORCA再取得病名',
        layer: 'orca-mirror',
        readOnly: true,
      }),
    ]);
    expect(result.postMutationMirror?.pendingLocalDiseases).toEqual([
      expect.objectContaining({
        diagnosisName: '送信候補病名',
        layer: 'candidate',
        candidateKind: 'draftCandidate',
        sourceOfTruth: 'local-candidate',
        readOnly: true,
        candidateOnly: true,
      }),
    ]);
  });
});
