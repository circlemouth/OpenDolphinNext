import { Global } from '@emotion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { FocusTrapDialog } from '../../../components/modals/FocusTrapDialog';
import { hasStoredAuth } from '../../../libs/http/httpClient';
import { ToneBanner } from '../../reception/components/ToneBanner';
import { receptionStyles } from '../../reception/styles';
import { ReturnToBar } from '../../shared/ReturnToBar';
import { recordChartsAuditEvent } from '../audit';
import { chartsPrintStyles } from '../print/printStyles';
import { DocumentClinicalDocument } from '../print/documentClinicalDocument';
import {
  saveDocumentOutputResult,
  type DocumentOutputMode,
  type DocumentPrintPreviewState,
} from '../print/documentPrintPreviewStorage';
import { type ReportPrintPreviewState } from '../print/printPreviewStorage';
import { DOCUMENT_TYPE_LABELS } from '../documentTemplates';
import { useOptionalSession } from '../../../AppRouter';
import { buildFacilityPath } from '../../../routes/facilityRoutes';
import { isSafeReturnTo } from '../../../routes/appNavigation';
import { useAppNavigation } from '../../../routes/useAppNavigation';
import { getObservabilityMeta } from '../../../libs/observability/observability';
import { fetchOrcaReportPdf } from '../orcaReportApi';
import { MISSING_MASTER_RECOVERY_NEXT_STEPS } from '../../shared/missingMasterRecovery';
import { readStoredSession } from '../../../libs/session/storedSession';
import type { StorageScope } from '../../../libs/session/storageScope';
import { resolveUserSafeFetchFailure } from '../userSafeErrorCopy';

type OutputMode = DocumentOutputMode;
type OutputStatus = 'idle' | 'printing' | 'completed' | 'failed';
type PrintPageState = DocumentPrintPreviewState | ReportPrintPreviewState;
type ReportStatus = 'idle' | 'loading' | 'ready' | 'failed';
const OUTPUT_ENDPOINT = 'window.print';
const PRINT_HELP_URL = 'https://support.google.com/chrome/answer/1069693?hl=ja';

const getDocumentState = (value: unknown): DocumentPrintPreviewState | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (!obj.document || !obj.meta) return null;
  return obj as DocumentPrintPreviewState;
};

const getReportState = (value: unknown): ReportPrintPreviewState | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (!obj.reportType || !obj.dataId || !obj.meta) return null;
  return obj as ReportPrintPreviewState;
};

const isReportState = (value: PrintPageState | null): value is ReportPrintPreviewState =>
  Boolean(value && typeof (value as ReportPrintPreviewState).dataId === 'string');

const normalizeScopeValue = (value?: string) => value?.trim() ?? '';

const resolveActorScope = (actor?: string): { facilityId: string; userId: string } | null => {
  if (!actor) return null;
  const trimmed = actor.trim();
  const separator = trimmed.indexOf(':');
  if (separator <= 0 || separator >= trimmed.length - 1) return null;
  const facilityId = trimmed.slice(0, separator).trim();
  const userId = trimmed.slice(separator + 1).trim();
  if (!facilityId || !userId) return null;
  return { facilityId, userId };
};

const isStateScopeMatched = (value: PrintPageState, scope?: StorageScope): boolean => {
  const facilityId = normalizeScopeValue(scope?.facilityId);
  const userId = normalizeScopeValue(scope?.userId);
  if (!facilityId || !userId) return false;
  if (normalizeScopeValue(value.facilityId) !== facilityId) return false;
  const actorScope = resolveActorScope(value.actor);
  if (!actorScope) return false;
  return actorScope.facilityId === facilityId && actorScope.userId === userId;
};

export function ChartsDocumentPrintPage() {
  return (
    <>
      <Global styles={[receptionStyles, chartsPrintStyles]} />
      <ChartsDocumentPrintContent />
    </>
  );
}

function ChartsDocumentPrintContent() {
  const session = useOptionalSession();
  const storedSession = useMemo(() => readStoredSession(), [session?.facilityId, session?.userId]);
  const resolvedFacilityId = session?.facilityId ?? storedSession?.facilityId;
  const resolvedUserId = session?.userId ?? storedSession?.userId;
  const navigate = useNavigate();
  const location = useLocation();
  const appNav = useAppNavigation({ facilityId: resolvedFacilityId, userId: resolvedUserId });
  const queryParams = useMemo(
    () => new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search),
    [location.search],
  );
  const from = useMemo(() => {
    const state = location.state as Record<string, unknown> | null;
    const fromState = state && typeof state.from === 'string' ? state.from : undefined;
    return fromState ?? queryParams.get('from') ?? undefined;
  }, [location.state, queryParams]);
  const returnTo = useMemo(() => {
    const state = location.state as Record<string, unknown> | null;
    const returnToState = state && typeof state.returnTo === 'string' ? state.returnTo : undefined;
    return returnToState ?? queryParams.get('returnTo') ?? undefined;
  }, [location.state, queryParams]);
  const fallbackUrl = useMemo(() => buildFacilityPath(resolvedFacilityId, '/charts'), [resolvedFacilityId]);
  const safeReturnTo = useMemo(
    () => (isSafeReturnTo(returnTo, resolvedFacilityId) ? returnTo : undefined),
    [resolvedFacilityId, returnTo],
  );
  const storageScope = useMemo<StorageScope | undefined>(() => {
    if (!resolvedFacilityId || !resolvedUserId) return undefined;
    return { facilityId: resolvedFacilityId, userId: resolvedUserId };
  }, [resolvedFacilityId, resolvedUserId]);
  const scopeReady = Boolean(storageScope?.facilityId && storageScope?.userId);
  const returnToScope = useMemo(
    () => ({ facilityId: resolvedFacilityId, userId: resolvedUserId }),
    [resolvedFacilityId, resolvedUserId],
  );
  const stateFromLocationRaw = useMemo(
    () => getDocumentState(location.state) ?? getReportState(location.state),
    [location.state],
  );
  const stateFromLocation = useMemo(() => {
    if (!stateFromLocationRaw) return null;
    if (!scopeReady) return stateFromLocationRaw;
    return isStateScopeMatched(stateFromLocationRaw, storageScope) ? stateFromLocationRaw : null;
  }, [scopeReady, stateFromLocationRaw, storageScope]);
  const state = useMemo<PrintPageState | null>(() => {
    return stateFromLocation ?? null;
  }, [stateFromLocation]);
  const [printedAtIso] = useState(() => new Date().toISOString());
  const lastModeRef = useRef<OutputMode | null>(null);
  const [confirmMode, setConfirmMode] = useState<OutputMode | null>(null);
  const [outputStatus, setOutputStatus] = useState<OutputStatus>('idle');
  const [outputError, setOutputError] = useState<string | null>(null);
  const [lastOutputMode, setLastOutputMode] = useState<OutputMode | null>(null);
  const hasPermission = useMemo(() => hasStoredAuth(), []);
  const missingStateLoggedRef = useRef(false);
  const autoOutputRequestedRef = useRef(false);

  useEffect(() => {
    document.body.dataset.route = 'charts-print';
    return () => {
      if (document.body.dataset.route === 'charts-print') {
        delete document.body.dataset.route;
      }
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    if (isReportState(state)) {
      document.title = `ORCA帳票_${state.reportLabel ?? state.reportType}_${state.meta.runId}`;
      return;
    }
    const docType = DOCUMENT_TYPE_LABELS[state.document.type] ?? '文書';
    document.title = `${docType}_print_${state.meta.runId}`;
  }, [state]);

  useEffect(() => {
    if (!state || isReportState(state)) return;
    const onAfterPrint = () => {
      const mode = lastModeRef.current;
      if (!mode) return;
      const detail = `output=${mode} afterprint_dialog_closed (印刷成否は未判定)`;
      setOutputStatus('completed');
      setOutputError(null);
      recordChartsAuditEvent({
        action: 'PRINT_DOCUMENT',
        outcome: 'warning',
        subject: 'charts-document-output',
        note: detail,
        patientId: state.document.patientId,
        actor: state.actor,
        runId: state.meta.runId,
        cacheHit: state.meta.cacheHit,
        missingMaster: state.meta.missingMaster,
        fallbackUsed: state.meta.fallbackUsed,
        dataSourceTransition: state.meta.dataSourceTransition,
        details: {
          operationPhase: 'do',
          documentType: state.document.type,
          documentTitle: state.document.title,
          documentIssuedAt: state.document.issuedAt,
          templateId: state.document.templateId,
          documentId: state.document.id,
          endpoint: OUTPUT_ENDPOINT,
          outputMode: mode,
          outcome: 'completed',
        },
      });
      storeOutputResult('completed', mode, detail);
      lastModeRef.current = null;
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [state]);

  useEffect(() => {
    if (state || missingStateLoggedRef.current) return;
    missingStateLoggedRef.current = true;
    recordChartsAuditEvent({
      action: 'PRINT_DOCUMENT',
      outcome: 'blocked',
      subject: 'charts-document-output',
      note: 'missing_print_state',
      details: {
        operationPhase: 'lock',
        blockedReasons: ['missing_print_state'],
      },
    });
  }, [state]);

  const outputGuardReasons = useMemo(() => {
    if (!state || isReportState(state)) return [];
    const reasons: Array<{ key: string; summary: string; detail: string; next: string[] }> = [];
    if (!state.document.patientId) {
      reasons.push({
        key: 'patient_not_selected',
        summary: '患者未選択',
        detail: '患者IDが未確定のため出力できません。',
        next: ['Patients で患者を選択', 'Charts へ戻って文書を再作成'],
      });
    }
    if (!state.document.templateId) {
      reasons.push({
        key: 'template_missing',
        summary: 'テンプレ未選択',
        detail: 'テンプレートが未選択のため出力できません。',
        next: ['文書作成に戻りテンプレを選択', '保存後に再出力'],
      });
    }
    if (state.meta.missingMaster) {
      reasons.push({
        key: 'missing_master',
        summary: 'missingMaster=true',
        detail: 'マスタ欠損を検知したため出力を停止します。',
        next: [...MISSING_MASTER_RECOVERY_NEXT_STEPS],
      });
    }
    if (state.meta.fallbackUsed) {
      reasons.push({
        key: 'fallback_used',
        summary: 'fallbackUsed=true',
        detail: 'フォールバック経路のため出力を停止します。',
        next: [...MISSING_MASTER_RECOVERY_NEXT_STEPS],
      });
    }
    if (!hasPermission) {
      reasons.push({
        key: 'permission_denied',
        summary: '権限不足/認証不備',
        detail: '認証情報が揃っていないため出力できません。',
        next: ['再ログイン', '設定確認（facilityId/userId/password）'],
      });
    }
    return reasons;
  }, [hasPermission, state]);

  const outputDisabled = outputGuardReasons.length > 0;
  const outputGuardSummary = outputGuardReasons.map((reason) => reason.summary).join(' / ');
  const outputGuardDetail = outputGuardReasons.map((reason) => reason.detail).join(' / ');

  const storeOutputResult = (
    outcome: 'success' | 'failed' | 'blocked' | 'completed',
    mode: OutputMode | null,
    detail?: string,
    httpStatus?: number,
  ) => {
    if (!state || isReportState(state)) return;
    const traceId = getObservabilityMeta().traceId;
    saveDocumentOutputResult(
      {
        documentId: state.document.id,
        outcome,
        mode: mode ?? undefined,
        at: new Date().toISOString(),
        detail,
        runId: state.meta.runId,
        traceId,
        endpoint: OUTPUT_ENDPOINT,
        httpStatus,
      },
      storageScope,
    );
  };

  const recordOutputAudit = (
    outcome: 'started' | 'success' | 'blocked' | 'error' | 'warning',
    note: string,
    details?: Record<string, unknown>,
    error?: string,
  ) => {
    recordChartsAuditEvent({
      action: 'PRINT_DOCUMENT',
      outcome,
      subject: 'charts-document-output',
      note,
      error,
      actor: state && !isReportState(state) ? state.actor : undefined,
      patientId: state && !isReportState(state) ? state.document.patientId : undefined,
      runId: state?.meta.runId,
      cacheHit: state?.meta.cacheHit,
      missingMaster: state?.meta.missingMaster,
      fallbackUsed: state?.meta.fallbackUsed,
      dataSourceTransition: state?.meta.dataSourceTransition,
      details: {
        endpoint: OUTPUT_ENDPOINT,
        httpStatus:
          outcome === 'success'
            ? 200
            : outcome === 'error' || outcome === 'blocked'
              ? 0
              : undefined,
        ...(details ?? {}),
      },
    });
  };

  const handleOutput = (mode: OutputMode) => {
    if (!state || isReportState(state)) return;
    if (outputDisabled) {
      const blockedReasons = outputGuardReasons.map((reason) => reason.key);
      const head = outputGuardReasons[0];
      const detail = outputGuardDetail || head?.detail || '出力前チェックでブロックされました。';
      recordOutputAudit('blocked', head?.detail ?? 'output_blocked', {
        operationPhase: 'lock',
        blockedReasons,
        documentType: state.document.type,
        documentTitle: state.document.title,
        documentIssuedAt: state.document.issuedAt,
        templateId: state.document.templateId,
        documentId: state.document.id,
      });
      setOutputStatus('failed');
      setOutputError(detail);
      storeOutputResult('blocked', mode, detail, 0);
      return;
    }
    lastModeRef.current = mode;
    setLastOutputMode(mode);
    setOutputStatus('printing');
    setOutputError(null);
    recordOutputAudit('started', `output=${mode}`, {
      operationPhase: 'do',
      documentType: state.document.type,
      documentTitle: state.document.title,
      documentIssuedAt: state.document.issuedAt,
      templateId: state.document.templateId,
      documentId: state.document.id,
    });
    try {
      window.print();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '印刷ダイアログの起動に失敗しました。';
      lastModeRef.current = null;
      setOutputStatus('failed');
      setOutputError(detail);
      recordOutputAudit(
        'error',
        `output=${mode} failed`,
        {
          operationPhase: 'do',
          documentType: state.document.type,
          documentTitle: state.document.title,
          documentIssuedAt: state.document.issuedAt,
          templateId: state.document.templateId,
          documentId: state.document.id,
        },
        detail,
      );
      storeOutputResult('failed', mode, detail, 0);
    }
  };

  const handleRequestOutput = (mode: OutputMode) => {
    if (!state || isReportState(state)) return;
    if (outputDisabled) {
      const blockedReasons = outputGuardReasons.map((reason) => reason.key);
      const head = outputGuardReasons[0];
      const detail = outputGuardDetail || head?.detail || '出力前チェックでブロックされました。';
      recordOutputAudit('blocked', head?.detail ?? 'output_blocked', {
        operationPhase: 'lock',
        blockedReasons,
        documentType: state.document.type,
        documentTitle: state.document.title,
        documentIssuedAt: state.document.issuedAt,
        templateId: state.document.templateId,
        documentId: state.document.id,
      });
      setOutputStatus('failed');
      setOutputError(detail);
      storeOutputResult('blocked', mode, detail, 0);
      return;
    }
    setOutputStatus('idle');
    setOutputError(null);
    setConfirmMode(mode);
    recordOutputAudit('started', `output=${mode} approval_open`, {
      operationPhase: 'approval',
      approvalState: 'open',
      documentType: state.document.type,
      documentTitle: state.document.title,
      documentIssuedAt: state.document.issuedAt,
      templateId: state.document.templateId,
      documentId: state.document.id,
    });
  };

  useEffect(() => {
    if (!state || isReportState(state) || !state?.initialOutputMode || autoOutputRequestedRef.current) return;
    autoOutputRequestedRef.current = true;
    handleRequestOutput(state.initialOutputMode);
  }, [handleRequestOutput, state]);

  const handleClose = () => {
    navigate(safeReturnTo ?? fallbackUrl);
  };

  if (!state) {
    return (
      <main className="charts-print">
        <div className="charts-print__screen-only">
          <ReturnToBar
            scope={returnToScope}
            returnTo={returnTo}
            from={from}
            fallbackUrl={fallbackUrl}
          />
          <ToneBanner
            tone="error"
            message="文書プレビューの状態が見つかりません。"
            nextAction="この画面は一時プレビューのため、再開できません。Charts へ戻って開き直してください。"
          />
        </div>
        <div className="charts-print__toolbar">
          <div>
            <h1>文書印刷/エクスポート</h1>
            <p>状態が無いため出力できません。</p>
          </div>
          <div className="charts-print__controls">
            <button type="button" className="charts-print__button charts-print__button--primary" onClick={handleClose}>
              Chartsへ戻る
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (isReportState(state)) {
    return (
      <ChartsReportPrintContent
        state={state}
        onClose={handleClose}
        scope={returnToScope}
        returnTo={returnTo}
        from={from}
        fallbackUrl={fallbackUrl}
      />
    );
  }

  const exportDisabled = outputDisabled;
  const outputGuardHead = outputGuardReasons[0];
  const outputGuardNextAction = outputGuardHead ? outputGuardHead.next.join(' / ') : undefined;
  const outputGuardMessage = outputGuardSummary ? `出力ガード中: ${outputGuardSummary}` : '出力前チェックにより停止中です。';
  const docLabel = DOCUMENT_TYPE_LABELS[state.document.type] ?? '文書';

  return (
    <main className="charts-print">
      <div className="charts-print__screen-only">
        <ReturnToBar
          scope={returnToScope}
          returnTo={returnTo}
          from={from}
          fallbackUrl={fallbackUrl}
        />
        <ToneBanner
          tone="warning"
          message="個人情報を含む診療文書です。画面共有/第三者の閲覧に注意し、印刷物・PDFは必要最小限にしてください。"
          nextAction="不要になった印刷物は施錠保管・回収・裁断等、施設規定に従って処理してください。"
          runId={state.meta.runId}
        />
      </div>

      <div className="charts-print__toolbar">
        <div>
          <h1>{docLabel} 印刷/エクスポート</h1>
          <p>
            印刷ダイアログから「送信先: PDFに保存」を選ぶことで PDF 出力として利用できます（ブラウザ仕様に従います）。
          </p>
        </div>
        <div className="charts-print__controls" role="group" aria-label="出力操作">
          <button
            type="button"
            className="charts-print__button charts-print__button--primary"
            onClick={() => handleRequestOutput('print')}
            disabled={exportDisabled}
            aria-disabled={exportDisabled}
          >
            印刷
          </button>
          <button
            type="button"
            className="charts-print__button"
            onClick={() => handleRequestOutput('pdf')}
            disabled={exportDisabled}
            aria-disabled={exportDisabled}
          >
            PDF出力
          </button>
          <button type="button" className="charts-print__button charts-print__button--ghost" onClick={handleClose}>
            閉じる
          </button>
        </div>
      </div>

      {exportDisabled && (
        <div className="charts-print__screen-only">
          <ToneBanner
            tone="warning"
            message={outputGuardMessage}
            nextAction={outputGuardNextAction ?? '受付で master 解決/再取得を行い、最新データで再度出力してください。'}
            runId={state.meta.runId}
          />
          <div className="charts-print__recovery" role="group" aria-label="出力復旧導線">
            <button
              type="button"
              className="charts-print__button"
              onClick={() => appNav.openReception()}
            >
              受付へ戻る
            </button>
            <button type="button" className="charts-print__button charts-print__button--ghost" onClick={handleClose}>
              Chartsへ戻る
            </button>
            <a
              className="charts-print__button charts-print__button--ghost"
              href={PRINT_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              印刷ヘルプ
            </a>
          </div>
        </div>
      )}

      {outputStatus === 'failed' && (
        <div className="charts-print__screen-only">
          <ToneBanner
            tone="error"
            message={`出力に失敗しました: ${outputError ?? '原因不明'}`}
            nextAction="再試行するか、受付/Charts に戻って状態を確認してください。"
            runId={state.meta.runId}
          />
          <div className="charts-print__recovery" role="group" aria-label="出力の再試行">
            <button
              type="button"
              className="charts-print__button charts-print__button--primary"
              onClick={() => handleRequestOutput(lastOutputMode ?? 'print')}
              disabled={exportDisabled}
            >
              再試行
            </button>
            <button
              type="button"
              className="charts-print__button"
              onClick={() => appNav.openReception()}
            >
              受付へ戻る
            </button>
            <button type="button" className="charts-print__button charts-print__button--ghost" onClick={handleClose}>
              Chartsへ戻る
            </button>
            <a
              className="charts-print__button charts-print__button--ghost"
              href={PRINT_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              印刷ヘルプ
            </a>
          </div>
        </div>
      )}

      {outputStatus === 'completed' && (
        <div className="charts-print__screen-only">
          <ToneBanner
            tone="info"
            message="印刷ダイアログを閉じました。印刷/保存できなかった場合は再試行してください。"
            nextAction="再試行または戻るで運用を継続できます。"
            runId={state.meta.runId}
          />
          <div className="charts-print__recovery" role="group" aria-label="出力後の補助操作">
            <button
              type="button"
              className="charts-print__button"
              onClick={() => handleRequestOutput(lastOutputMode ?? 'print')}
              disabled={exportDisabled}
            >
              再試行
            </button>
            <button type="button" className="charts-print__button charts-print__button--ghost" onClick={handleClose}>
              閉じる
            </button>
          </div>
        </div>
      )}

      <FocusTrapDialog
        open={confirmMode !== null}
        role="dialog"
        title="出力の最終確認"
        description={`個人情報を含む診療文書を${confirmMode === 'pdf' ? 'PDF保存' : '印刷'}します。出力先/共有範囲を確認してください。（runId=${state.meta.runId}）`}
        onClose={() => {
          if (confirmMode) {
            recordOutputAudit('blocked', `output=${confirmMode} approval_cancelled`, {
              operationPhase: 'approval',
              approvalState: 'cancelled',
              blockedReasons: ['confirm_cancelled'],
              documentType: state.document.type,
              documentTitle: state.document.title,
              documentIssuedAt: state.document.issuedAt,
              templateId: state.document.templateId,
              documentId: state.document.id,
            });
          }
          setConfirmMode(null);
        }}
        testId="charts-document-print-dialog"
      >
        <div role="group" aria-label="出力の最終確認">
          <button
            type="button"
            onClick={() => {
              if (confirmMode) {
                recordOutputAudit('blocked', `output=${confirmMode} approval_cancelled`, {
                  operationPhase: 'approval',
                  approvalState: 'cancelled',
                  blockedReasons: ['confirm_cancelled'],
                  documentType: state.document.type,
                  documentTitle: state.document.title,
                  documentIssuedAt: state.document.issuedAt,
                  templateId: state.document.templateId,
                  documentId: state.document.id,
                });
              }
              setConfirmMode(null);
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => {
              const mode = confirmMode ?? 'print';
              recordOutputAudit('started', `output=${mode} approval_confirmed`, {
                operationPhase: 'approval',
                approvalState: 'confirmed',
                documentType: state.document.type,
                documentTitle: state.document.title,
                documentIssuedAt: state.document.issuedAt,
                templateId: state.document.templateId,
                documentId: state.document.id,
              });
              setConfirmMode(null);
              handleOutput(mode);
            }}
          >
            出力する
          </button>
        </div>
      </FocusTrapDialog>

      <DocumentClinicalDocument
        document={state.document}
        printedAtIso={printedAtIso}
        actor={state.actor}
        facilityId={state.facilityId}
        meta={state.meta}
      />
    </main>
  );
}

type ChartsReportPrintProps = {
  state: ReportPrintPreviewState;
  onClose: () => void;
  scope: { facilityId: string | undefined; userId?: string };
  returnTo?: string;
  from?: string;
  fallbackUrl: string;
};

function ChartsReportPrintContent({ state, onClose, scope, returnTo, from, fallbackUrl }: ChartsReportPrintProps) {
  const [pdfStatus, setPdfStatus] = useState<ReportStatus>('idle');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPdfStatus('loading');
    setPdfError(null);
    recordChartsAuditEvent({
      action: 'ORCA_REPORT_PRINT',
      outcome: 'started',
      subject: 'orca-report-blob',
      note: `Data_Id=${state.dataId}`,
      actor: state.actor,
      patientId: state.patientId,
      appointmentId: state.appointmentId,
      runId: state.meta.runId,
      cacheHit: state.meta.cacheHit,
      missingMaster: state.meta.missingMaster,
      fallbackUsed: state.meta.fallbackUsed,
      dataSourceTransition: state.meta.dataSourceTransition,
      details: {
        operationPhase: 'do',
        reportType: state.reportType,
        reportLabel: state.reportLabel,
        dataId: state.dataId,
        endpoint: `/blobapi/${state.dataId}`,
      },
    });

    fetchOrcaReportPdf(state.dataId)
      .then((result) => {
        if (!active) return;
        if (result.ok && result.pdfBlob) {
          const url = URL.createObjectURL(result.pdfBlob);
          setPdfUrl(url);
          setPdfStatus('ready');
          recordChartsAuditEvent({
            action: 'ORCA_REPORT_PRINT',
            outcome: 'success',
            subject: 'orca-report-blob',
            note: `Data_Id=${state.dataId}`,
            actor: state.actor,
            patientId: state.patientId,
            appointmentId: state.appointmentId,
            runId: result.runId ?? state.meta.runId,
            cacheHit: state.meta.cacheHit,
            missingMaster: state.meta.missingMaster,
            fallbackUsed: state.meta.fallbackUsed,
            dataSourceTransition: state.meta.dataSourceTransition,
            details: {
              operationPhase: 'do',
              reportType: state.reportType,
              reportLabel: state.reportLabel,
              dataId: state.dataId,
              endpoint: `/blobapi/${state.dataId}`,
              httpStatus: result.status,
            },
          });
        } else {
          const detail = result.error ?? 'PDF 取得に失敗しました。';
          setPdfStatus('failed');
          setPdfError(detail);
          recordChartsAuditEvent({
            action: 'ORCA_REPORT_PRINT',
            outcome: 'error',
            subject: 'orca-report-blob',
            note: detail,
            error: detail,
            actor: state.actor,
            patientId: state.patientId,
            appointmentId: state.appointmentId,
            runId: result.runId ?? state.meta.runId,
            cacheHit: state.meta.cacheHit,
            missingMaster: state.meta.missingMaster,
            fallbackUsed: state.meta.fallbackUsed,
            dataSourceTransition: state.meta.dataSourceTransition,
            details: {
              operationPhase: 'do',
              reportType: state.reportType,
              reportLabel: state.reportLabel,
              dataId: state.dataId,
              endpoint: `/blobapi/${state.dataId}`,
              httpStatus: result.status,
              error: detail,
            },
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        const detail = error instanceof Error ? error.message : String(error);
        setPdfStatus('failed');
        setPdfError(detail);
        recordChartsAuditEvent({
          action: 'ORCA_REPORT_PRINT',
          outcome: 'error',
          subject: 'orca-report-blob',
          note: detail,
          error: detail,
          actor: state.actor,
          patientId: state.patientId,
          appointmentId: state.appointmentId,
          runId: state.meta.runId,
          cacheHit: state.meta.cacheHit,
          missingMaster: state.meta.missingMaster,
          fallbackUsed: state.meta.fallbackUsed,
          dataSourceTransition: state.meta.dataSourceTransition,
          details: {
            operationPhase: 'do',
            reportType: state.reportType,
            reportLabel: state.reportLabel,
            dataId: state.dataId,
            endpoint: `/blobapi/${state.dataId}`,
            error: detail,
          },
        });
      });

    return () => {
      active = false;
    };
  }, [state]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <main className="charts-print">
      <div className="charts-print__screen-only">
        <ReturnToBar scope={scope} returnTo={returnTo} from={from} fallbackUrl={fallbackUrl} />
        <ToneBanner
          tone="warning"
          message="個人情報を含む帳票です。画面共有/第三者の閲覧に注意してください。"
          nextAction="不要になったPDFは施設規定に従って削除してください。"
          runId={state.meta.runId}
        />
      </div>

      <div className="charts-print__toolbar">
        <div>
          <h1>{state.reportLabel} PDFプレビュー</h1>
          <p>Data_Id={state.dataId} / 患者ID={state.patientId ?? '—'} / runId={state.meta.runId}</p>
        </div>
        <div className="charts-print__controls" role="group" aria-label="帳票操作">
          {pdfUrl && (
            <>
              <a className="charts-print__button charts-print__button--primary" href={pdfUrl} target="_blank" rel="noopener noreferrer">
                PDFを開く
              </a>
              <a className="charts-print__button" href={pdfUrl} download={`${state.reportType}-${state.dataId}.pdf`}>
                ダウンロード
              </a>
            </>
          )}
          <button type="button" className="charts-print__button charts-print__button--ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>

      {pdfStatus === 'loading' && (
        <div className="charts-print__screen-only">
          <ToneBanner tone="info" message="PDFを取得中です…" nextAction="しばらくお待ちください。" runId={state.meta.runId} />
        </div>
      )}
      {pdfStatus === 'failed' && (
        <div className="charts-print__screen-only">
          <ToneBanner
            tone="error"
            message={resolveUserSafeFetchFailure('PDF', pdfError)}
            nextAction="再試行するか、ORCAの帳票設定を確認してください。"
            runId={state.meta.runId}
          />
        </div>
      )}

      {pdfUrl && (
        <div className="charts-print__pdf-preview">
          <iframe title="ORCA帳票PDF" src={pdfUrl} />
        </div>
      )}
    </main>
  );
}
