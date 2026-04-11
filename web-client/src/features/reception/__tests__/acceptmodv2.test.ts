import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mutateVisit, buildVisitEntryFromMutation } from '../api';
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
  });

  it('実環境相当の空文字応答でも patientId を維持する', async () => {
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

    const entry = buildVisitEntryFromMutation(result, { paymentMode: 'insurance' });
    expect(entry?.patientId).toBe('000099');
    expect(entry?.id).toBe('000099');
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
