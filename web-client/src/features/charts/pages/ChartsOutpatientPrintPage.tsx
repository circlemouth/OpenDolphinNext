import { Global } from '@emotion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { FocusTrapDialog } from '../../../components/modals/FocusTrapDialog';
import { hasStoredAuth } from '../../../libs/http/httpClient';
import { getObservabilityMeta } from '../../../libs/observability/observability';
import type { ReceptionEntry } from '../../reception/api';
import { receptionStyles } from '../../reception/styles';
import { ToneBanner } from '../../reception/components/ToneBanner';
import { ReturnToBar } from '../../shared/ReturnToBar';
import { recordChartsAuditEvent } from '../audit';
import { chartsPrintStyles } from '../print/printStyles';
import { OutpatientClinicalDocument, type ChartsPrintMeta } from '../print/outpatientClinicalDocument';
import {
  clearOutpatientOutputResult,
  clearOutpatientPrintPreview,
  loadOutpatientPrintPreview,
  saveOutpatientOutputResult,
} from '../print/printPreviewStorage';
import { useOptionalSession } from '../../../AppRouter';
import { buildFacilityPath } from '../../../routes/facilityRoutes';
import { isSafeReturnTo } from '../../../routes/appNavigation';
import { useAppNavigation } from '../../../routes/useAppNavigation';
import { MISSING_MASTER_RECOVERY_NEXT_STEPS } from '../../shared/missingMasterRecovery';
import { readStoredSession } from '../../../libs/session/storedSession';
import type { StorageScope } from '../../../libs/session/storageScope';

type PrintLocationState = {
  entry: ReceptionEntry;
  meta: ChartsPrintMeta;
  actor: string;
  facilityId: string;
};

type OutputMode = 'print' | 'pdf';
type OutputStatus = 'idle' | 'printing' | 'completed' | 'failed';
const OUTPUT_ENDPOINT = 'window.print';
const PRINT_HELP_URL = 'https://support.google.com/chrome/answer/1069693?hl=ja';

const getState = (value: unknown): PrintLocationState | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (!obj.entry || !obj.meta) return null;
  return obj as PrintLocationState;
};

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

const isStateScopeMatched = (value: PrintLocationState, scope?: StorageScope): boolean => {
  const facilityId = normalizeScopeValue(scope?.facilityId);
  const userId = normalizeScopeValue(scope?.userId);
  if (!facilityId || !userId) return false;
  if (normalizeScopeValue(value.facilityId) !== facilityId) return false;
  const actorScope = resolveActorScope(value.actor);
  if (!actorScope) return false;
  return actorScope.facilityId === facilityId && actorScope.userId === userId;
};

export function ChartsOutpatientPrintPage() {
  return (
    <>
      <Global styles={[receptionStyles, chartsPrintStyles]} />
      <ChartsOutpatientPrintContent />
    </>
  );
}

function ChartsOutpatientPrintContent() {
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
  const locationState = useMemo(() => getState(location.state), [location.state]);
  const validatedLocationState = useMemo(() => {
    if (!locationState) return null;
    if (!scopeReady) return locationState;
    return isStateScopeMatched(locationState, storageScope) ? locationState : null;
  }, [locationState, scopeReady, storageScope]);
  const restored = useMemo(() => {
    if (!scopeReady) return null;
    const value = loadOutpatientPrintPreview(storageScope);
    if (!value) return null;
    return isStateScopeMatched(value.value, storageScope) ? value : null;
  }, [scopeReady, storageScope]);
  const state = useMemo(() => validatedLocationState ?? restored?.value ?? null, [restored?.value, validatedLocationState]);
  const restoredAt = restored?.storedAt;
  const [printedAtIso] = useState(() => new Date().toISOString());
  const lastModeRef = useRef<OutputMode | null>(null);
  const [confirmMode, setConfirmMode] = useState<OutputMode | null>(null);
  const [outputStatus, setOutputStatus] = useState<OutputStatus>('idle');
  const [outputError, setOutputError] = useState<string | null>(null);
  const [lastOutputMode, setLastOutputMode] = useState<OutputMode | null>(null);
  const hasPermission = useMemo(() => hasStoredAuth(), []);
  const missingStateLoggedRef = useRef(false);
  const outputRecordedRef = useRef(false);

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
    if (scopeReady) {
      clearOutpatientOutputResult(storageScope);
    }
    outputRecordedRef.current = false;
    const patientId = state.entry.patientId ?? state.entry.id;
    const titleId = patientId ? `_${patientId}` : '';
    document.title = `診療記録${titleId}_${state.meta.runId}`;
  }, [scopeReady, state, storageScope]);

  const storeOutputResult = (outcome: 'success' | 'failed' | 'blocked', detail?: string, mode?: OutputMode) => {
    if (!state) return;
    if (outputRecordedRef.current && outcome === 'success') return;
    const observability = getObservabilityMeta();
    saveOutpatientOutputResult(
      {
        patientId: state.entry.patientId ?? state.entry.id,
        appointmentId: state.entry.appointmentId,
        outcome,
        mode,
        at: new Date().toISOString(),
        detail,
        runId: state.meta.runId,
        traceId: observability.traceId,
        endpoint: OUTPUT_ENDPOINT,
        httpStatus: outcome === 'success' ? 200 : 0,
      },
      storageScope,
    );
    if (outcome === 'success') {
      outputRecordedRef.current = true;
    }
  };

  useEffect(() => {
    if (!state) return;
    const onAfterPrint = () => {
      const mode = lastModeRef.current;
      if (!mode) return;
      const detail = `output=${mode} afterprint_dialog_closed (印刷成否は未判定)`;
      setOutputStatus('completed');
      setOutputError(null);
      recordChartsAuditEvent({
        action: 'PRINT_OUTPATIENT',
        outcome: 'warning',
        subject: 'outpatient-document-output',
        note: detail,
        patientId: state.entry.patientId ?? state.entry.id,
        appointmentId: state.entry.appointmentId,
        actor: state.actor,
        runId: state.meta.runId,
        cacheHit: state.meta.cacheHit,
        missingMaster: state.meta.missingMaster,
        fallbackUsed: state.meta.fallbackUsed,
        dataSourceTransition: state.meta.dataSourceTransition,
        details: {
          operationPhase: 'do',
          endpoint: OUTPUT_ENDPOINT,
          outputMode: mode,
          outcome: 'completed',
        },
      });
      lastModeRef.current = null;
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [state]);

  useEffect(() => {
    if (state || missingStateLoggedRef.current) return;
    missingStateLoggedRef.current = true;
    recordChartsAuditEvent({
      action: 'PRINT_OUTPATIENT',
      outcome: 'blocked',
      subject: 'outpatient-document-output',
      note: 'missing_print_state',
      details: {
        operationPhase: 'lock',
        blockedReasons: ['missing_print_state'],
      },
    });
  }, [state]);

  const outputGuardReasons = useMemo(() => {
    if (!state) return [];
    const reasons: Array<{ key: string; summary: string; detail: string; next: string[] }> = [];
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

  const recordOutputAudit = (
    outcome: 'started' | 'success' | 'blocked' | 'error' | 'warning',
    note: string,
    details?: Record<string, unknown>,
    error?: string,
  ) => {
    recordChartsAuditEvent({
      action: 'PRINT_OUTPATIENT',
      outcome,
      subject: 'outpatient-document-output',
      note,
      error,
      actor: state?.actor,
      patientId: state?.entry.patientId ?? state?.entry.id,
      appointmentId: state?.entry.appointmentId,
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
    if (!state) return;
    if (outputDisabled) {
      const blockedReasons = outputGuardReasons.map((reason) => reason.key);
      const head = outputGuardReasons[0];
      const detail = outputGuardDetail || head?.detail || '出力前チェックでブロックされました。';
      recordOutputAudit('blocked', head?.detail ?? 'output_blocked', {
        operationPhase: 'lock',
        blockedReasons,
      });
      storeOutputResult('blocked', detail, mode);
      setOutputStatus('failed');
      setOutputError(detail);
      return;
    }
    lastModeRef.current = mode;
    setLastOutputMode(mode);
    setOutputStatus('printing');
    setOutputError(null);
    recordOutputAudit('started', `output=${mode}`, { operationPhase: 'do' });
    try {
      window.print();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '印刷ダイアログの起動に失敗しました。';
      lastModeRef.current = null;
      setOutputStatus('failed');
      setOutputError(detail);
      storeOutputResult('failed', detail, mode);
      recordOutputAudit('error', `output=${mode} failed`, { operationPhase: 'do' }, detail);
    }
  };

  const handleRequestOutput = (mode: OutputMode) => {
    if (!state) return;
    if (outputDisabled) {
      const blockedReasons = outputGuardReasons.map((reason) => reason.key);
      const head = outputGuardReasons[0];
      const detail = outputGuardDetail || head?.detail || '出力前チェックでブロックされました。';
      recordOutputAudit('blocked', head?.detail ?? 'output_blocked', {
        operationPhase: 'lock',
        blockedReasons,
      });
      storeOutputResult('blocked', detail, mode);
      setOutputStatus('failed');
      setOutputError(detail);
      return;
    }
    setOutputStatus('idle');
    setOutputError(null);
    setConfirmMode(mode);
    recordOutputAudit('started', `output=${mode} approval_open`, {
      operationPhase: 'approval',
      approvalState: 'open',
    });
  };

  const handleClose = () => {
    clearOutpatientPrintPreview(storageScope);
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
            message="印刷プレビューの状態が見つかりません（画面をリロードした可能性があります）"
            nextAction="Charts へ戻り、患者を選択してから再度「印刷/エクスポート」を開いてください。"
          />
        </div>
        <div className="charts-print__toolbar">
          <div>
            <h1>診療記録（外来サマリ） 印刷/エクスポート</h1>
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

  const exportDisabled = outputDisabled;
  const outputGuardHead = outputGuardReasons[0];
  const outputGuardNextAction = outputGuardHead ? outputGuardHead.next.join(' / ') : undefined;
  const outputGuardMessage = outputGuardSummary ? `出力ガード中: ${outputGuardSummary}` : '出力前チェックにより停止中です。';

  return (
    <main className="charts-print">
      <div className="charts-print__screen-only">
        <ReturnToBar
          scope={returnToScope}
          returnTo={returnTo}
          from={from}
          fallbackUrl={fallbackUrl}
        />
        {restoredAt && !validatedLocationState && (
          <ToneBanner
            tone="info"
            message="印刷プレビュー状態をセッションから復元しました（リロード対策）。"
            nextAction="出力後は「閉じる」でセッション保存データを破棄します。"
            runId={state.meta.runId}
          />
        )}
        <ToneBanner
          tone="warning"
          message="個人情報を含む診療文書です。画面共有/第三者の閲覧に注意し、印刷物・PDFは必要最小限にしてください。"
          nextAction="不要になった印刷物は施錠保管・回収・裁断等、施設規定に従って処理してください。"
          runId={state.meta.runId}
        />
      </div>

      <div className="charts-print__toolbar">
        <div>
          <h1>診療記録（外来サマリ） 印刷/エクスポート</h1>
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
            });
          }
          setConfirmMode(null);
        }}
        testId="charts-print-output-dialog"
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
              });
              setConfirmMode(null);
              handleOutput(mode);
            }}
          >
            出力する
          </button>
        </div>
      </FocusTrapDialog>

      <OutpatientClinicalDocument
        entry={state.entry}
        printedAtIso={printedAtIso}
        actor={state.actor}
        facilityId={state.facilityId}
        meta={state.meta}
      />
    </main>
  );
}
