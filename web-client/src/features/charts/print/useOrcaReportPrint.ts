import { useEffect, useMemo, useRef, useState } from 'react';

import { logUiState } from '../../../libs/audit/auditLogger';
import { resolveAuditActor } from '../../../libs/auth/storedAuth';
import { isOrcaSuccessResult } from '../../../libs/orca/orcaApiResultPolicy';
import type { DataSourceTransition } from '../authService';
import type { OrcaClaimSendCacheEntry } from '../orcaClaimSendCache';
import { recordChartsAuditEvent } from '../audit';
import { buildIncomeInfoRequest, fetchOrcaIncomeInfo, type IncomeInfoEntry } from '../orcaIncomeInfoApi';
import {
  buildOrcaReportRequest,
  ORCA_REPORT_LABELS,
  postOrcaReport,
  resolveOrcaReportEndpoint,
  type OrcaReportType,
} from '../orcaReportApi';
import type { OrcaEncounterContext } from '../orcaEncounterContext';
import type { ReportPrintPreviewState } from './printPreviewStorage';

export type PrintDestination = 'outpatient' | OrcaReportType;

export type ReportFormState = {
  type: OrcaReportType;
  invoiceNumber: string;
  outsideClass: 'True' | 'False';
  departmentCode: string;
  insuranceCombinationNumber: string;
  performMonth: string;
};

type ReportTouchedState = {
  invoiceNumber: boolean;
  departmentCode: boolean;
  insuranceCombinationNumber: boolean;
  performMonth: boolean;
};

type ReportPrintParams = {
  dialogOpen: boolean;
  appointmentId?: string;
  orcaEncounterContext?: Partial<OrcaEncounterContext>;
  orcaSendEntry?: OrcaClaimSendCacheEntry | null;
  runId: string;
  cacheHit: boolean;
  missingMaster: boolean;
  fallbackUsed: boolean;
  dataSourceTransition: DataSourceTransition;
  traceId?: string;
};

type ReportPreviewResult =
  | {
      ok: true;
      previewState: ReportPrintPreviewState;
      responseMeta: {
        runId?: string;
        traceId?: string;
        dataId: string;
        endpoint: string;
        apiResult?: string;
        apiResultMessage?: string;
        status: number;
      };
    }
  | { ok: false; error: string };

const normalizeVisitDate = (value?: string) => {
  if (!value) return undefined;
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const pickLatestIncomeEntry = (entries: IncomeInfoEntry[]) => {
  if (entries.length === 0) return undefined;
  const toTimestamp = (value?: string) => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return entries.reduce((latest, entry) => {
    if (!latest) return entry;
    return toTimestamp(entry.performDate) >= toTimestamp(latest.performDate) ? entry : latest;
  }, entries[0]);
};

export function useOrcaReportPrint({
  dialogOpen,
  appointmentId,
  orcaEncounterContext,
  orcaSendEntry,
  runId,
  cacheHit,
  missingMaster,
  fallbackUsed,
  dataSourceTransition,
  traceId,
}: ReportPrintParams) {
  const [printDestination, setPrintDestinationState] = useState<PrintDestination>('outpatient');
  const [reportForm, setReportForm] = useState<ReportFormState>({
    type: 'prescription',
    invoiceNumber: '',
    outsideClass: 'False',
    departmentCode: '',
    insuranceCombinationNumber: '',
    performMonth: '',
  });
  const reportTouchedRef = useRef<ReportTouchedState>({
    invoiceNumber: false,
    departmentCode: false,
    insuranceCombinationNumber: false,
    performMonth: false,
  });
  const [reportIncomeEntries, setReportIncomeEntries] = useState<IncomeInfoEntry[]>([]);
  const [reportIncomeStatus, setReportIncomeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reportIncomeError, setReportIncomeError] = useState<string | null>(null);

  const resolvedPatientId = orcaEncounterContext?.patientId?.trim() || undefined;
  const resolvedVisitDate = useMemo(
    () => normalizeVisitDate(orcaEncounterContext?.visitDate),
    [orcaEncounterContext?.visitDate],
  );
  const resolvedDepartmentCode = orcaEncounterContext?.departmentCode?.trim() || undefined;
  const resolvedInsuranceCombinationNumber = orcaEncounterContext?.insuranceCombinationNumber?.trim() || undefined;
  const defaultPerformMonth = useMemo(() => {
    return resolvedVisitDate ? resolvedVisitDate.slice(0, 7) : '';
  }, [resolvedVisitDate]);

  const resolvedReportType = printDestination === 'outpatient' ? reportForm.type : printDestination;

  const reportNeedsInvoice =
    resolvedReportType === 'prescription' ||
    resolvedReportType === 'medicinenotebook' ||
    resolvedReportType === 'invoicereceipt' ||
    resolvedReportType === 'statement';
  const reportNeedsOutsideClass = resolvedReportType === 'prescription' || resolvedReportType === 'medicinenotebook';
  const reportNeedsDepartment = resolvedReportType === 'karteno1' || resolvedReportType === 'karteno3';
  const reportNeedsInsurance = resolvedReportType === 'karteno1' || resolvedReportType === 'karteno3';
  const reportNeedsPerformMonth = resolvedReportType === 'karteno3';

  const reportFieldErrors = useMemo(() => {
    if (printDestination === 'outpatient') return [] as string[];
    const errors: string[] = [];
    if (!resolvedPatientId) errors.push('患者IDが未確定です。');
    if (!resolvedVisitDate) errors.push('来院日（Perform_Date）が未確定です。');
    if (reportNeedsInvoice && !reportForm.invoiceNumber.trim()) {
      errors.push('伝票番号（Invoice_Number）が必要です。');
    }
    if (resolvedReportType === 'karteno1') {
      if (!reportForm.departmentCode.trim()) errors.push('診療科コード（Department_Code）が必要です。');
      if (!reportForm.insuranceCombinationNumber.trim()) errors.push('保険組合せ番号が必要です。');
    }
    if (reportNeedsPerformMonth && !reportForm.performMonth.trim()) {
      errors.push('対象月（Perform_Month）が必要です。');
    }
    return errors;
  }, [printDestination, reportForm, reportNeedsInvoice, reportNeedsPerformMonth, resolvedPatientId, resolvedReportType, resolvedVisitDate]);

  const reportReady = reportFieldErrors.length === 0;

  const lastSendInvoiceNumber = orcaSendEntry?.invoiceNumber;
  const lastSendDataId = orcaSendEntry?.dataId;
  const lastSendApiResult = orcaSendEntry?.apiResult;

  const reportInvoiceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [lastSendInvoiceNumber, ...reportIncomeEntries.map((entry) => entry.invoiceNumber)].filter(Boolean),
        ),
      ) as string[],
    [lastSendInvoiceNumber, reportIncomeEntries],
  );
  const reportInsuranceOptions = useMemo(
    () =>
      Array.from(new Set(reportIncomeEntries.map((entry) => entry.insuranceCombinationNumber).filter(Boolean))) as string[],
    [reportIncomeEntries],
  );
  const reportIncomeLatest = useMemo(() => pickLatestIncomeEntry(reportIncomeEntries), [reportIncomeEntries]);

  useEffect(() => {
    reportTouchedRef.current = {
      invoiceNumber: false,
      departmentCode: false,
      insuranceCombinationNumber: false,
      performMonth: false,
    };
    setReportForm((prev) => ({
      ...prev,
      invoiceNumber: '',
      departmentCode: '',
      insuranceCombinationNumber: '',
      performMonth: '',
    }));
  }, [resolvedPatientId]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (!resolvedPatientId || !resolvedVisitDate) {
      setReportIncomeEntries([]);
      setReportIncomeStatus('idle');
      setReportIncomeError(null);
      return;
    }
    let cancelled = false;
    setReportIncomeStatus('loading');
    setReportIncomeError(null);
    const request = buildIncomeInfoRequest({ patientId: resolvedPatientId, baseDate: resolvedVisitDate });
    fetchOrcaIncomeInfo(request)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setReportIncomeEntries(result.entries);
          setReportIncomeStatus('success');
        } else {
          setReportIncomeEntries([]);
          setReportIncomeStatus('error');
          setReportIncomeError(result.apiResultMessage ?? `HTTP ${result.status}`);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setReportIncomeEntries([]);
        setReportIncomeStatus('error');
        setReportIncomeError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, resolvedPatientId, resolvedVisitDate]);

  useEffect(() => {
    setReportForm((prev) => {
      const next = { ...prev };
      if (!reportTouchedRef.current.invoiceNumber) {
        next.invoiceNumber = lastSendInvoiceNumber ?? '';
      }
      if (!reportTouchedRef.current.insuranceCombinationNumber) {
        const insuranceCombinationNumber =
          resolvedInsuranceCombinationNumber ?? pickLatestIncomeEntry(reportIncomeEntries)?.insuranceCombinationNumber;
        if (insuranceCombinationNumber) {
          next.insuranceCombinationNumber = insuranceCombinationNumber;
        }
      }
      if (!reportTouchedRef.current.departmentCode && resolvedDepartmentCode) {
        next.departmentCode = resolvedDepartmentCode;
      }
      if (!reportTouchedRef.current.performMonth && !prev.performMonth && defaultPerformMonth) {
        next.performMonth = defaultPerformMonth;
      }
      return next;
    });
  }, [
    defaultPerformMonth,
    lastSendInvoiceNumber,
    reportIncomeEntries,
    resolvedDepartmentCode,
    resolvedInsuranceCombinationNumber,
  ]);

  const setPrintDestination = (value: PrintDestination) => {
    setPrintDestinationState(value);
    if (value !== 'outpatient') {
      setReportForm((prev) => ({ ...prev, type: value }));
    }
  };

  const updateReportField = <T extends keyof ReportFormState>(key: T, value: ReportFormState[T]) => {
    if (key === 'invoiceNumber') reportTouchedRef.current.invoiceNumber = true;
    if (key === 'departmentCode') reportTouchedRef.current.departmentCode = true;
    if (key === 'insuranceCombinationNumber') reportTouchedRef.current.insuranceCombinationNumber = true;
    if (key === 'performMonth') reportTouchedRef.current.performMonth = true;
    setReportForm((prev) => ({ ...prev, [key]: value }));
  };

  const requestReportPreview = async (): Promise<ReportPreviewResult> => {
    if (!resolvedPatientId) {
      return { ok: false, error: '患者IDが未確定のため帳票出力を開始できません。' };
    }
    if (!reportReady) {
      return { ok: false, error: reportFieldErrors.join(' / ') || '帳票出力条件が不足しています。' };
    }

    const { actor, facilityId } = resolveAuditActor();
    const requestPayload = buildOrcaReportRequest(resolvedReportType, {
      patientId: resolvedPatientId,
      invoiceNumber: reportForm.invoiceNumber || undefined,
      outsideClass: reportForm.outsideClass,
      departmentCode: reportForm.departmentCode || undefined,
      insuranceCombinationNumber: reportForm.insuranceCombinationNumber || undefined,
      performMonth: reportForm.performMonth || undefined,
    });
    const endpoint = resolveOrcaReportEndpoint(resolvedReportType);

    recordChartsAuditEvent({
      action: 'ORCA_REPORT_PRINT',
      outcome: 'started',
      subject: 'orca-report-request',
      note: `report=${resolvedReportType}`,
      actor,
      patientId: resolvedPatientId,
      appointmentId,
      runId,
      cacheHit,
      missingMaster,
      fallbackUsed,
      dataSourceTransition,
      details: {
        operationPhase: 'do',
        reportType: resolvedReportType,
        reportLabel: ORCA_REPORT_LABELS[resolvedReportType],
        invoiceNumber: reportForm.invoiceNumber || undefined,
        departmentCode: reportForm.departmentCode || undefined,
        insuranceCombinationNumber: reportForm.insuranceCombinationNumber || undefined,
        performMonth: reportForm.performMonth || undefined,
        endpoint,
      },
    });

    logUiState({
      action: 'print',
      screen: 'charts/action-bar',
      controlId: 'action-print-report',
      runId,
      cacheHit,
      missingMaster,
      dataSourceTransition,
      fallbackUsed,
      details: {
        operationPhase: 'do',
        reportType: resolvedReportType,
        endpoint,
        patientId: resolvedPatientId,
        appointmentId,
        traceId,
      },
    });

    let lastResponse: Awaited<ReturnType<typeof postOrcaReport>> | null = null;
    try {
      const result = await postOrcaReport(resolvedReportType, requestPayload);
      lastResponse = result;
      const apiResultOk = isOrcaSuccessResult(result.apiResult);
      const responseRunId = result.runId ?? runId;
      const responseTraceId = result.traceId ?? traceId;
      if (!result.ok || !apiResultOk || !result.dataId) {
        const invoiceNumber = reportForm.invoiceNumber || undefined;
        const missingDataIdMessage =
          resolvedReportType === 'prescription'
            ? `prescriptionv2 の Data_Id が取得できませんでした（Invoice_Number=${
                invoiceNumber ?? lastSendInvoiceNumber ?? '未設定'
              }）。`
            : 'Data_Id missing';
        const detail = [
          `HTTP ${result.status}`,
          result.apiResult ? `apiResult=${result.apiResult}` : undefined,
          result.apiResultMessage ? `message=${result.apiResultMessage}` : undefined,
          !result.dataId ? missingDataIdMessage : undefined,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' / ');
        throw new Error(detail || '帳票出力に失敗しました。');
      }

      const previewState: ReportPrintPreviewState = {
        reportType: resolvedReportType,
        reportLabel: ORCA_REPORT_LABELS[resolvedReportType],
        dataId: result.dataId,
        patientId: resolvedPatientId,
        appointmentId,
        invoiceNumber: reportForm.invoiceNumber || undefined,
        departmentCode: reportForm.departmentCode || undefined,
        insuranceCombinationNumber: reportForm.insuranceCombinationNumber || undefined,
        performMonth: reportForm.performMonth || undefined,
        requestedAt: new Date().toISOString(),
        meta: {
          runId: responseRunId ?? runId,
          cacheHit,
          missingMaster,
          fallbackUsed,
          dataSourceTransition,
        },
        actor,
        facilityId,
      };

      recordChartsAuditEvent({
        action: 'ORCA_REPORT_PRINT',
        outcome: 'success',
        subject: 'orca-report-preview',
        note: `Data_Id=${result.dataId}`,
        actor,
        patientId: resolvedPatientId,
        appointmentId,
        runId: responseRunId,
        cacheHit,
        missingMaster,
        fallbackUsed,
        dataSourceTransition,
        details: {
          operationPhase: 'do',
          reportType: resolvedReportType,
          reportLabel: ORCA_REPORT_LABELS[resolvedReportType],
          dataId: result.dataId,
          endpoint,
          httpStatus: result.status,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
          invoiceNumber: reportForm.invoiceNumber || undefined,
        },
      });
      if (resolvedReportType === 'prescription') {
        recordChartsAuditEvent({
          action: 'prescription_print',
          outcome: 'success',
          subject: 'orca-report-preview',
          note: `Data_Id=${result.dataId}`,
          actor,
          patientId: resolvedPatientId,
          appointmentId,
          runId: responseRunId,
          cacheHit,
          missingMaster,
          fallbackUsed,
          dataSourceTransition,
          details: {
            operationPhase: 'do',
            reportType: resolvedReportType,
            reportLabel: ORCA_REPORT_LABELS[resolvedReportType],
            dataId: result.dataId,
            endpoint,
            httpStatus: result.status,
            apiResult: result.apiResult,
            apiResultMessage: result.apiResultMessage,
            invoiceNumber: reportForm.invoiceNumber || undefined,
          },
        });
      }

      return {
        ok: true,
        previewState,
        responseMeta: {
          runId: responseRunId,
          traceId: responseTraceId,
          dataId: result.dataId,
          endpoint,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
          status: result.status,
        },
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const invoiceNumber = reportForm.invoiceNumber || undefined;
      const apiResult = lastResponse?.apiResult ?? lastSendApiResult;
      const apiResultMessage = lastResponse?.apiResultMessage;
      recordChartsAuditEvent({
        action: 'ORCA_REPORT_PRINT',
        outcome: 'error',
        subject: 'orca-report-preview',
        note: detail,
        error: detail,
        patientId: resolvedPatientId,
        appointmentId,
        runId,
        cacheHit,
        missingMaster,
        fallbackUsed,
        dataSourceTransition,
        details: {
          operationPhase: 'do',
          reportType: resolvedReportType,
          reportLabel: ORCA_REPORT_LABELS[resolvedReportType],
          endpoint,
          error: detail,
          apiResult,
          apiResultMessage,
          invoiceNumber,
          dataId: lastResponse?.dataId ?? lastSendDataId,
        },
      });
      if (resolvedReportType === 'prescription') {
        recordChartsAuditEvent({
          action: 'prescription_print',
          outcome: 'error',
          subject: 'orca-report-preview',
          note: detail,
          error: detail,
          actor,
          patientId: resolvedPatientId,
          appointmentId,
          runId,
          cacheHit,
          missingMaster,
          fallbackUsed,
          dataSourceTransition,
          details: {
            operationPhase: 'do',
            reportType: resolvedReportType,
            reportLabel: ORCA_REPORT_LABELS[resolvedReportType],
            endpoint,
            error: detail,
            apiResult,
            apiResultMessage,
            invoiceNumber,
            dataId: lastResponse?.dataId ?? lastSendDataId,
          },
        });
      }
      return { ok: false, error: detail };
    }
  };

  return {
    printDestination,
    setPrintDestination,
    reportForm,
    updateReportField,
    reportFieldErrors,
    reportReady,
    reportIncomeStatus,
    reportIncomeError,
    reportIncomeLatest,
    reportInvoiceOptions,
    reportInsuranceOptions,
    reportNeedsInvoice,
    reportNeedsOutsideClass,
    reportNeedsDepartment,
    reportNeedsInsurance,
    reportNeedsPerformMonth,
    resolvedReportType,
    requestReportPreview,
  };
}
