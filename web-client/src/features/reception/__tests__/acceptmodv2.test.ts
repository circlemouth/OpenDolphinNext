import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mutateVisit, buildVisitEntryFromMutation, classifyAcceptmodv2ReadOnlyDiagnostic } from '../api';
import { fetchWithResolver } from '../../outpatient/fetchWithResolver';

const recordOutpatientFunnel = vi.hoisted(() => vi.fn());
const logAuditEvent = vi.hoisted(() => vi.fn());
const logUiState = vi.hoisted(() => vi.fn());

vi.mock('../../outpatient/fetchWithResolver', () => ({
  fetchWithResolver: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel,
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent,
  logUiState,
}));

vi.mock('../../../libs/observability/observability', () => ({
  updateObservabilityMeta: vi.fn(),
  getObservabilityMeta: () => ({}),
  ensureObservabilityMeta: () => ({}),
  resolveRunId: (value?: string) => value,
}));

const mockFetch = vi.mocked(fetchWithResolver);

describe('acceptmodv2 mutateVisit', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('Api_Result=00 で acceptanceId と patient を返す', async () => {
    mockFetch.mockResolvedValue({
      raw: {
        acceptanceId: 'A123',
        acceptanceDate: '2026-01-20',
        acceptanceTime: '09:00:00',
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        apiResult: '00',
        apiResultMessage: 'OK',
        patient: { patientId: '000001', wholeName: '山田' },
      },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000001',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(result.acceptanceId).toBe('A123');
    expect(result.scheduleKey).toBe('F001:S100');
    expect(result.encounterKey).toBe('F001:E100');
    expect(result.patient?.patientId).toBe('000001');
    expect(result.businessStatus).toBe('businessAccepted');
    expect(result.businessReason).toBe('accepted_with_registration_evidence');
    expect(result.hasRegistrationEvidence).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ requestNumber: '01', patientId: '000001' }),
      }),
    );
  });

  it('保険モードでは insurances を送らず、Acceptance_Push と physicianCode をそのまま送る', async () => {
    mockFetch.mockResolvedValue({
      raw: { apiResult: '00', apiResultMessage: 'OK', patient: { patientId: '000001' } },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    await mutateVisit({
      patientId: '000001',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'insurance',
      physicianCode: '0001',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          acceptancePush: '1',
          physicianCode: '0001',
          insurances: undefined,
        }),
      }),
    );
  });

  it('自費モードでは InsuranceProvider_Class=9 を送る', async () => {
    mockFetch.mockResolvedValue({
      raw: { apiResult: '00', apiResultMessage: 'OK', patient: { patientId: '000001' } },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    await mutateVisit({
      patientId: '000001',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'self',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          insurances: [{ insuranceProviderClass: '9' }],
        }),
      }),
    );
  });

  it('Api_Result=21 は保険不一致として扱い、Api_Result_Message を優先する', async () => {
    mockFetch.mockResolvedValue({
      raw: { apiResult: '21', apiResultMessage: '保険の組み合わせが一致しません' },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000021',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'self',
    });

    expect(result.acceptanceId).toBeUndefined();
    expect(result.apiResult).toBe('21');
    expect(result.apiResultMessage).toBe('保険の組み合わせが一致しません');
    expect(result.businessStatus).toBe('businessRejected');
    expect(result.businessReason).toBe('insurance_mismatch');
  });

  it('Api_Result=10 は patient_not_found の businessRejected として扱う', async () => {
    mockFetch.mockResolvedValue({
      raw: { apiResult: '10', apiResultMessage: '該当患者なし' },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000010',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(result.acceptanceId).toBeUndefined();
    expect(result.businessStatus).toBe('businessRejected');
    expect(result.businessReason).toBe('patient_not_found');
  });

  it('Api_Result=21 で Api_Result_Message が空なら保険不一致 fallback を使い、受付コンテキストを捏造しない', async () => {
    mockFetch.mockResolvedValue({
      raw: { apiResult: '21', apiResultMessage: '' },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000021',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptanceTime: '09:00:00',
      departmentCode: '01',
      physicianCode: '1001',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(result.apiResultMessage).toBe('保険不一致');
    expect(result.acceptanceId).toBeUndefined();
    expect(result.acceptanceDate).toBeUndefined();
    expect(result.departmentCode).toBeUndefined();
    expect(result.physicianCode).toBeUndefined();
  });

  it('Api_Result=60 は受付なしとして扱い、acceptanceId を持たない', async () => {
    mockFetch.mockResolvedValue({
      raw: { apiResult: '60', apiResultMessage: '受付は存在しません' },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000060',
      requestNumber: '02',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      acceptanceId: 'A-060',
      paymentMode: 'insurance',
    });

    expect(result.acceptanceId).toBeUndefined();
    expect(result.apiResult).toBe('60');
    expect(result.apiResultMessage).toBe('受付は存在しません');
    expect(result.businessStatus).toBe('diagnosticNoExistingAcceptance');
    expect(result.businessReason).toBe('no_existing_acceptance');
  });

  it('read-only diagnostic Api_Result=60 は Phase 3 候補として accepted だが mutation success ではない', () => {
    const result = classifyAcceptmodv2ReadOnlyDiagnostic({
      ok: true,
      apiResult: '60',
      raw: { apiResult: '60', apiResultMessage: '受付は存在しません' },
    });

    expect(result).toMatchObject({
      verdict: 'accepted',
      businessStatus: 'diagnosticNoExistingAcceptance',
      businessReason: 'no_existing_acceptance',
      mutationSuccess: false,
      acceptedForPhase3Attempt: true,
    });
  });

  it('read-only diagnostic Api_Result=10 は rejected にする', () => {
    const result = classifyAcceptmodv2ReadOnlyDiagnostic({
      ok: true,
      apiResult: '10',
      raw: { apiResult: '10', apiResultMessage: '患者番号が存在しません' },
    });

    expect(result).toMatchObject({
      verdict: 'rejected',
      businessStatus: 'businessRejected',
      businessReason: 'patient_not_found',
      mutationSuccess: false,
      acceptedForPhase3Attempt: false,
    });
  });

  it('Api_Result=60 で Api_Result_Message が空なら受付なし fallback を使い、受付コンテキストを捏造しない', async () => {
    mockFetch.mockResolvedValue({
      raw: { apiResult: '60', apiResultMessage: '' },
      meta: { httpStatus: 200, dataSourceTransition: 'mock' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000060',
      requestNumber: '02',
      acceptanceDate: '2026-01-20',
      acceptanceTime: '09:00:00',
      departmentCode: '01',
      physicianCode: '1001',
      acceptancePush: '1',
      acceptanceId: 'A-060',
      paymentMode: 'insurance',
    });

    expect(result.apiResultMessage).toBe('受付なし');
    expect(result.acceptanceId).toBeUndefined();
    expect(result.acceptanceDate).toBeUndefined();
    expect(result.departmentCode).toBeUndefined();
    expect(result.physicianCode).toBeUndefined();
  });

  it('K1 は Acceptance_Id がある場合だけ acceptedWithWarnings にする', async () => {
    mockFetch.mockResolvedValue({
      raw: {
        Api_Result: 'K1',
        Api_Result_Message: '警告付き受付登録終了',
        Acceptance_Id: 'A-K1',
        Patient_Information: { Patient_ID: '0000K1' },
      },
      meta: { httpStatus: 200, dataSourceTransition: 'server' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '0000K1',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(result.acceptanceId).toBe('A-K1');
    expect(result.businessStatus).toBe('businessAcceptedWithWarnings');
    expect(result.businessReason).toBe('official_warning_with_registration_evidence');
  });

  it('K1 が message だけなら成功扱いせず notVerified にする', async () => {
    mockFetch.mockResolvedValue({
      raw: {
        apiResult: 'K1',
        apiResultMessage: '警告付き受付登録終了',
      },
      meta: { httpStatus: 200, dataSourceTransition: 'server' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '0000K1',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptanceTime: '09:00:00',
      departmentCode: '01',
      physicianCode: '1001',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(result.acceptanceId).toBeUndefined();
    expect(result.acceptanceDate).toBeUndefined();
    expect(result.departmentCode).toBeUndefined();
    expect(result.businessStatus).toBe('notVerified');
    expect(result.businessReason).toBe('warning_without_registration_evidence');
  });

  it('Api_Result=00 は Acceptance_Info evidence がある場合だけ accepted にする', async () => {
    mockFetch.mockResolvedValue({
      raw: {
        apiResult: '00',
        apiResultMessage: '受付登録終了',
        Acceptance_Info: {
          Acceptance_Id: 'A-INFO',
          Acceptance_Date: '2026-01-20',
        },
        patient: { patientId: '000001' },
      },
      meta: { httpStatus: 200, dataSourceTransition: 'server' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000001',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(result.businessStatus).toBe('businessAccepted');
    expect(result.businessReason).toBe('accepted_with_registration_evidence');
    expect(result.hasRegistrationEvidence).toBe(true);
  });

  it('実環境相当の空文字応答でも patientId を維持するが成功扱いしない', async () => {
    mockFetch.mockResolvedValue({
      raw: {
        apiResult: '00',
        apiResultMessage: '受付登録終了',
        acceptanceId: '',
        acceptanceDate: '',
        acceptanceTime: '',
        patient: { patientId: '' },
      },
      meta: { httpStatus: 200, dataSourceTransition: 'server' },
      ok: true,
    });

    const result = await mutateVisit({
      patientId: '000099',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(result.acceptanceId).toBeUndefined();
    expect(result.patient?.patientId).toBe('000099');
    expect(result.businessStatus).toBe('notVerified');
    expect(result.businessReason).toBe('success_code_without_registration_evidence');

    const entry = buildVisitEntryFromMutation(result, { paymentMode: 'insurance' });
    expect(entry).toBeNull();
  });

  it('監査ログに action=reception_accept と runId/traceId が入る', async () => {
    mockFetch.mockResolvedValue({
      raw: {
        apiResult: '00',
        apiResultMessage: 'OK',
        acceptanceId: 'A999',
        runId: 'RUN-TEST',
        traceId: 'TRACE-TEST',
        patient: { patientId: '000001' },
      },
      meta: { httpStatus: 200, dataSourceTransition: 'mock', runId: 'RUN-TEST', traceId: 'TRACE-TEST' },
      ok: true,
    });

    logAuditEvent.mockClear();
    logUiState.mockClear();

    await mutateVisit({
      patientId: '000001',
      requestNumber: '01',
      acceptanceDate: '2026-01-20',
      acceptancePush: '1',
      paymentMode: 'insurance',
    });

    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'RUN-TEST',
        traceId: 'TRACE-TEST',
        payload: expect.objectContaining({
          action: 'reception_accept',
          traceId: 'TRACE-TEST',
        }),
      }),
    );
    expect(logUiState).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'send',
        runId: 'RUN-TEST',
        traceId: 'TRACE-TEST',
        details: expect.objectContaining({ traceId: 'TRACE-TEST' }),
      }),
    );
  });
});

describe('buildVisitEntryFromMutation', () => {
  it('取消リクエストでは null を返す', () => {
    const entry = buildVisitEntryFromMutation(
      { requestNumber: '02', patient: { patientId: '000001' } },
      { paymentMode: 'insurance' },
    );
    expect(entry).toBeNull();
  });

  it('登録レスポンスを ReceptionEntry に整形する', () => {
    const entry = buildVisitEntryFromMutation(
      {
        requestNumber: '01',
        businessStatus: 'businessAccepted',
        acceptanceId: 'A1',
        acceptanceDate: '2026-01-20',
        acceptanceTime: '09:00:00',
        departmentName: '内科',
        physicianName: '医師',
        patient: { patientId: '000001', name: '山田' },
      },
      { paymentMode: 'self' },
    );
    expect(entry).not.toBeNull();
    expect(entry?.receptionId).toBe('A1');
    expect(entry?.scheduleKey).toBeUndefined();
    expect(entry?.encounterKey).toBeUndefined();
    expect(entry?.insurance).toBe('自費');
    expect(entry?.status).toBe('受付中');
  });

  it('canonical key が返ってきた場合は ReceptionEntry にそのまま載せる', () => {
    const entry = buildVisitEntryFromMutation(
      {
        requestNumber: '01',
        businessStatus: 'businessAccepted',
        acceptanceId: 'A2',
        acceptanceDate: '2026-01-21',
        acceptanceTime: '10:00:00',
        scheduleKey: 'F001:S200',
        encounterKey: 'F001:E200',
        patient: { patientId: '000002', name: '佐藤' },
      },
      { paymentMode: 'insurance' },
    );
    expect(entry?.scheduleKey).toBe('F001:S200');
    expect(entry?.encounterKey).toBe('F001:E200');
  });
});
