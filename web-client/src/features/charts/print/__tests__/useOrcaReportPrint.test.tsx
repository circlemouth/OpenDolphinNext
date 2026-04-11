import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { useOrcaReportPrint } from '../useOrcaReportPrint';
import { postOrcaReport } from '../../orcaReportApi';
import { recordChartsAuditEvent } from '../../audit';

vi.mock('../../orcaReportApi', async () => {
  const actual = await vi.importActual<typeof import('../../orcaReportApi')>('../../orcaReportApi');
  return {
    ...actual,
    postOrcaReport: vi.fn(),
    buildOrcaReportRequest: vi.fn().mockReturnValue({ patientId: 'P-1' }),
    resolveOrcaReportEndpoint: vi.fn().mockReturnValue('/api/orca/official/reports/prescription'),
  };
});

vi.mock('../../orcaIncomeInfoApi', () => ({
  buildIncomeInfoRequest: vi.fn().mockReturnValue({ patientId: 'P-1', baseDate: '2026-01-22' }),
  fetchOrcaIncomeInfo: vi.fn().mockResolvedValue({ ok: true, status: 200, entries: [] }),
}));

vi.mock('../../audit', () => ({
  recordChartsAuditEvent: vi.fn(),
}));

vi.mock('../../../../libs/auth/storedAuth', () => ({
  resolveAuditActor: () => ({ actor: 'tester', facilityId: 'F-1' }),
}));

vi.mock('../../../../libs/audit/auditLogger', () => ({
  logUiState: vi.fn(),
}));

describe('useOrcaReportPrint', () => {
  it('ORCA送信結果の Invoice_Number を帳票フォームに反映する', async () => {
    const { result } = renderHook(() =>
      useOrcaReportPrint({
        dialogOpen: true,
        appointmentId: 'A-1',
        orcaEncounterContext: {
          patientId: 'P-1',
          visitDate: '2026-01-22',
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
        },
        runId: 'RUN-PRINT',
        cacheHit: false,
        missingMaster: false,
        fallbackUsed: false,
        dataSourceTransition: 'server',
        orcaSendEntry: {
          patientId: 'P-1',
          appointmentId: 'A-1',
          invoiceNumber: 'INV-001',
          dataId: 'DATA-001',
          runId: 'RUN-SEND',
          traceId: 'TRACE-SEND',
          apiResult: '00',
          sendStatus: 'success',
          savedAt: '2026-01-22T09:00:00Z',
        },
      }),
    );

    await waitFor(() => expect(result.current.reportForm.invoiceNumber).toBe('INV-001'));
  });

  it('prescriptionv2 の Data_Id 未取得時に明示エラーと監査ログを残す', async () => {
    vi.mocked(postOrcaReport).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '0000',
      apiResultMessage: 'OK',
      dataId: undefined,
      runId: 'RUN-REPORT',
      traceId: 'TRACE-REPORT',
    });

    const { result } = renderHook(() =>
      useOrcaReportPrint({
        dialogOpen: true,
        appointmentId: 'A-1',
        orcaEncounterContext: {
          patientId: 'P-1',
          visitDate: '2026-01-22',
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
        },
        runId: 'RUN-PRINT',
        cacheHit: false,
        missingMaster: false,
        fallbackUsed: false,
        dataSourceTransition: 'server',
        orcaSendEntry: {
          patientId: 'P-1',
          appointmentId: 'A-1',
          invoiceNumber: 'INV-001',
          dataId: 'DATA-001',
          runId: 'RUN-SEND',
          traceId: 'TRACE-SEND',
          apiResult: '00',
          sendStatus: 'success',
          savedAt: '2026-01-22T09:00:00Z',
        },
      }),
    );

    await waitFor(() => expect(result.current.reportForm.invoiceNumber).toBe('INV-001'));

    let response: any = null;
    await act(async () => {
      response = await (result.current.requestReportPreview as any)();
    });
    expect(response?.ok).toBe(false);
    if (response && !response.ok) {
      expect(response.error).toContain('prescriptionv2 の Data_Id');
    }

    expect(recordChartsAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'prescription_print',
        outcome: 'error',
        details: expect.objectContaining({
          apiResult: '0000',
          invoiceNumber: 'INV-001',
        }),
      }),
    );
  });

  it('visitDate 未確定時は report preview を fail-close する', async () => {
    const { result } = renderHook(() =>
      useOrcaReportPrint({
        dialogOpen: true,
        appointmentId: 'A-1',
        orcaEncounterContext: {
          patientId: 'P-1',
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
        },
        runId: 'RUN-PRINT',
        cacheHit: false,
        missingMaster: false,
        fallbackUsed: false,
        dataSourceTransition: 'server',
      }),
    );

    act(() => {
      result.current.setPrintDestination('karteno1');
    });

    let response: any = null;
    await act(async () => {
      response = await (result.current.requestReportPreview as any)();
    });

    expect(response?.ok).toBe(false);
    if (response && !response.ok) {
      expect(response.error).toContain('Perform_Date');
    }
  });
});
