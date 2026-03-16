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
    expect(result.message).toContain('経路不一致');
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
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain('/api/orca/disease/name/');
  });

  it('resolves ICD-10 when exact-name ORCA codes are ambiguous but ICD-10 is unique', async () => {
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

    expect(code).toBe('I10');
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

  it('resolves exact composite code when ORCA master directly returns combined disease code', async () => {
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

    expect(code).toBe('2056.8832114');
    expect(httpFetch).toHaveBeenCalledTimes(1);
  });

  it('resolves composite code from prefix + disease split when exact name is absent', async () => {
    vi.mocked(httpFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const decoded = decodeURIComponent(typeof input === 'string' ? input : input.toString());
      if (decoded.includes('/api/orca/disease/name/顔皮膚腫瘍,')) {
        return new Response(JSON.stringify({ list: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (decoded.includes('/api/orca/disease/name/顔,')) {
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
      if (decoded.includes('/api/orca/disease/name/皮膚腫瘍,')) {
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

    expect(code).toBe('2056.8832114');
  });

  it('returns undefined when multiple composite candidates exist', async () => {
    vi.mocked(httpFetch).mockImplementation(async (input: RequestInfo | URL) => {
      const decoded = decodeURIComponent(typeof input === 'string' ? input : input.toString());
      if (decoded.includes('/api/orca/disease/name/顔皮膚腫瘍,')) {
        return new Response(JSON.stringify({ list: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (decoded.includes('/api/orca/disease/name/顔,')) {
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
      if (decoded.includes('/api/orca/disease/name/皮膚腫瘍,')) {
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
});
