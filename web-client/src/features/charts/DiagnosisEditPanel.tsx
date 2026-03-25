import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { resolveAriaLive } from '../../libs/observability/observability';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import {
  fetchDiseases,
  mutateDiseases,
  resolveDiseaseCodeFromOrcaMaster,
  searchDiseaseMasterCandidates,
  type DiseaseEntry,
  type DiseaseMasterCandidate,
} from './diseaseApi';
import type { DataSourceTransition } from './authService';

export type DiagnosisEditPanelMeta = {
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  visitDate?: string;
  actorRole?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
};

export type DiagnosisEditPanelProps = {
  patientId?: string;
  meta: DiagnosisEditPanelMeta;
};

type DiagnosisFormState = {
  diagnosisId?: number;
  prefix: string;
  name: string;
  suffix: string;
  code: string;
  startDate: string;
  endDate: string;
  outcome: string;
  isMain: boolean;
  isSuspected: boolean;
};

type QuickCandidateOption = {
  key: string;
  label: string;
  candidate: DiseaseMasterCandidate;
};

const OUTCOME_PRESETS = ['継続', '治癒', '中止', '再発', '死亡', '転院', '不明'];
const QUICK_CANDIDATE_MIN_KEYWORD = 2;
const QUICK_CANDIDATE_MAX_ITEMS = 20;

const formatQuickCandidateLabel = (candidate: DiseaseMasterCandidate) => {
  const codeParts: string[] = [];
  if (candidate.icdTen?.trim()) {
    codeParts.push(`ICD:${candidate.icdTen.trim()}`);
  }
  if (candidate.code?.trim()) {
    codeParts.push(`病名:${candidate.code.trim()}`);
  }
  return codeParts.length > 0 ? `${candidate.name}（${codeParts.join(' / ')}）` : candidate.name;
};

const buildEmptyForm = (today: string): DiagnosisFormState => ({
  prefix: '',
  name: '',
  suffix: '',
  code: '',
  startDate: today,
  endDate: '',
  outcome: '',
  isMain: false,
  isSuspected: false,
});

const toFormState = (entry: DiseaseEntry, today: string): DiagnosisFormState => ({
  diagnosisId: entry.diagnosisId,
  prefix: '',
  name: entry.diagnosisName ?? '',
  suffix: '',
  code: entry.diagnosisCode ?? '',
  startDate: entry.startDate ?? today,
  endDate: entry.endDate ?? '',
  outcome: entry.outcome ?? '',
  isMain: entry.category?.includes('主') ?? false,
  isSuspected: entry.suspectedFlag?.includes('疑い') ?? entry.category?.includes('疑い') ?? false,
});

export function DiagnosisEditPanel({ patientId, meta }: DiagnosisEditPanelProps) {
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState<DiagnosisFormState>(() => buildEmptyForm(today));
  const [quickAdd, setQuickAdd] = useState<{
    name: string;
    code: string;
    startDate: string;
    isMain: boolean;
    isSuspected: boolean;
  }>({
    name: '',
    code: '',
    startDate: today,
    isMain: false,
    isSuspected: false,
  });
  const [quickCandidateSelection, setQuickCandidateSelection] = useState('');
  const [quickCandidateKeyword, setQuickCandidateKeyword] = useState('');
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const blockReasons = useMemo(() => {
    const reasons: string[] = [];
    if (meta.readOnly) {
      reasons.push(meta.readOnlyReason ?? '閲覧専用のため編集できません。');
    }
    if (meta.missingMaster) {
      reasons.push('マスター未同期のため編集できません。');
    }
    if (meta.fallbackUsed) {
      reasons.push('フォールバックデータのため編集できません。');
    }
    return reasons;
  }, [meta.fallbackUsed, meta.missingMaster, meta.readOnly, meta.readOnlyReason]);
  const isBlocked = blockReasons.length > 0;
  const unblockHints = useMemo(() => {
    const hints: string[] = [];
    if (meta.readOnly) {
      hints.push('閲覧専用を解除するには、タブロック解除または権限設定を確認してください。');
    }
    if (meta.missingMaster || meta.fallbackUsed) {
      hints.push('マスター同期または再取得を実行して、編集可能状態へ戻してください。');
    }
    return hints;
  }, [meta.fallbackUsed, meta.missingMaster, meta.readOnly]);
  const auditMetaDetails = useMemo(
    () => ({
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      receptionId: meta.receptionId,
      visitDate: meta.visitDate,
      actorRole: meta.actorRole,
    }),
    [meta],
  );

  const queryKey = ['charts-diagnosis', patientId];
  const diagnosisQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!patientId) throw new Error('patientId is required');
      return fetchDiseases({ patientId });
    },
    enabled: !!patientId,
  });
  const karteId = diagnosisQuery.data?.karteId;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuickCandidateKeyword(quickAdd.name.trim());
    }, 220);
    return () => window.clearTimeout(handle);
  }, [quickAdd.name]);

  const quickCandidateQuery = useQuery({
    queryKey: ['charts-diagnosis-master-candidates', quickCandidateKeyword, quickAdd.startDate],
    queryFn: () =>
      searchDiseaseMasterCandidates({
        keyword: quickCandidateKeyword,
        referenceDate: quickAdd.startDate || today,
        limit: QUICK_CANDIDATE_MAX_ITEMS,
      }),
    enabled: !isBlocked && quickCandidateKeyword.length >= QUICK_CANDIDATE_MIN_KEYWORD,
    staleTime: 30_000,
  });

  const quickCandidateOptions = useMemo<QuickCandidateOption[]>(
    () =>
      (quickCandidateQuery.data ?? []).map((candidate, index) => ({
        key: `${candidate.name}\u0000${candidate.code ?? ''}\u0000${candidate.icdTen ?? ''}\u0000${index}`,
        label: formatQuickCandidateLabel(candidate),
        candidate,
      })),
    [quickCandidateQuery.data],
  );

  const quickCandidateMap = useMemo(() => {
    const map = new Map<string, QuickCandidateOption>();
    for (const option of quickCandidateOptions) {
      map.set(option.key, option);
    }
    return map;
  }, [quickCandidateOptions]);

  useEffect(() => {
    if (!quickCandidateSelection) {
      return;
    }
    if (!quickCandidateMap.has(quickCandidateSelection)) {
      setQuickCandidateSelection('');
    }
  }, [quickCandidateMap, quickCandidateSelection]);

  useEffect(() => {
    logUiState({
      action: 'navigate',
      screen: 'charts/diagnosis-edit',
      runId: meta.runId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      details: {
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
      },
    });
  }, [meta]);

  useEffect(() => {
    if (!isEditorOpen) return;
    requestAnimationFrame(() => {
      const el = nameInputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.select();
      } catch {
        // ignore select errors (e.g. input type/date)
      }
    });
  }, [isEditorOpen, form.diagnosisId]);

  const mutation = useMutation({
    mutationFn: async (payload: DiagnosisFormState) => {
      if (!patientId) throw new Error('patientId is required');
      const operation = payload.diagnosisId ? 'update' : 'create';
      const category = payload.isMain ? '主病名' : '副病名';
      const suspectedFlag = payload.isSuspected ? '疑い' : undefined;
      const combinedName = `${payload.prefix ?? ''}${payload.name ?? ''}${payload.suffix ?? ''}`.trim();
      const explicitCode = payload.code?.trim();
      const resolvedCode =
        explicitCode ||
        (await resolveDiseaseCodeFromOrcaMaster({
          diagnosisName: combinedName,
          prefix: payload.prefix,
          mainName: payload.name,
          suffix: payload.suffix,
          referenceDate: payload.startDate,
        }));
      if (!karteId) throw new Error('karteId is required');
      return mutateDiseases({
        patientId,
        karteId,
        operations: [
          {
            operation,
            diagnosisId: payload.diagnosisId,
            diagnosisName: combinedName,
            diagnosisCode: resolvedCode || undefined,
            startDate: payload.startDate || undefined,
            endDate: payload.endDate || undefined,
            outcome: payload.outcome || undefined,
            category,
            suspectedFlag,
          },
        ],
      });
    },
    onSuccess: (result, payload) => {
      const failureMessage = result.message ?? '病名の保存に失敗しました。';
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.ok ? '病名を保存しました。' : failureMessage });
      recordOutpatientFunnel('charts_action', {
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit ?? false,
        missingMaster: meta.missingMaster ?? false,
        dataSourceTransition: meta.dataSourceTransition ?? 'server',
        fallbackUsed: meta.fallbackUsed ?? false,
        action: payload.diagnosisId ? 'update' : 'create',
        outcome: result.ok ? 'success' : 'error',
        note: payload.name,
      });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_DISEASE_MUTATION',
          outcome: result.ok ? 'success' : 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: result.runId ?? meta.runId,
            operation: payload.diagnosisId ? 'update' : 'create',
            patientId,
            diagnosisId: payload.diagnosisId,
            diagnosisName: payload.name,
            diagnosisCode: payload.code,
            startDate: payload.startDate,
            endDate: payload.endDate,
            outcome: payload.outcome,
            isMain: payload.isMain,
            isSuspected: payload.isSuspected,
            category: payload.isMain ? '主病名' : '副病名',
            suspectedFlag: payload.isSuspected ? '疑い' : undefined,
            ...(result.ok ? {} : { error: failureMessage }),
          },
        },
      });
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey });
        setForm(buildEmptyForm(today));
        if (!payload.diagnosisId) {
          setQuickAdd({
            name: '',
            code: '',
            startDate: today,
            isMain: false,
            isSuspected: false,
          });
          setQuickCandidateSelection('');
        }
        if (payload.diagnosisId) {
          setIsEditorOpen(false);
        } else {
          requestAnimationFrame(() => nameInputRef.current?.focus());
        }
      }
    },
    onError: (error: unknown, payload) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `病名の保存に失敗しました: ${message}` });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_DISEASE_MUTATION',
          outcome: 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: meta.runId,
            operation: payload.diagnosisId ? 'update' : 'create',
            patientId,
            diagnosisId: payload.diagnosisId,
            diagnosisName: payload.name,
            diagnosisCode: payload.code,
            startDate: payload.startDate,
            endDate: payload.endDate,
            outcome: payload.outcome,
            isMain: payload.isMain,
            isSuspected: payload.isSuspected,
            error: message,
          },
        },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entry: DiseaseEntry) => {
      if (!patientId) throw new Error('patientId is required');
      if (!karteId) throw new Error('karteId is required');
      return mutateDiseases({
        patientId,
        karteId,
        operations: [
          {
            operation: 'delete',
            diagnosisId: entry.diagnosisId,
            diagnosisName: entry.diagnosisName,
          },
        ],
      });
    },
    onSuccess: (result, entry) => {
      const failureMessage = result.message ?? '病名の削除に失敗しました。';
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.ok ? '病名を削除しました。' : failureMessage });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_DISEASE_MUTATION',
          outcome: result.ok ? 'success' : 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: result.runId ?? meta.runId,
            operation: 'delete',
            patientId,
            diagnosisId: entry.diagnosisId,
            diagnosisName: entry.diagnosisName,
            diagnosisCode: entry.diagnosisCode,
            startDate: entry.startDate,
            endDate: entry.endDate,
            outcome: entry.outcome,
            category: entry.category,
            suspectedFlag: entry.suspectedFlag,
            ...(result.ok ? {} : { error: failureMessage }),
          },
        },
      });
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error: unknown, entry) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `病名の削除に失敗しました: ${message}` });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_DISEASE_MUTATION',
          outcome: 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: meta.runId,
            operation: 'delete',
            patientId,
            diagnosisId: entry.diagnosisId,
            diagnosisName: entry.diagnosisName,
            diagnosisCode: entry.diagnosisCode,
            startDate: entry.startDate,
            endDate: entry.endDate,
            outcome: entry.outcome,
            category: entry.category,
            suspectedFlag: entry.suspectedFlag,
            error: message,
          },
        },
      });
    },
  });

  const list = useMemo(() => diagnosisQuery.data?.diseases ?? [], [diagnosisQuery.data?.diseases]);
  const activeList = useMemo(() => list.filter((entry) => !entry.endDate), [list]);
  const endedList = useMemo(() => list.filter((entry) => Boolean(entry.endDate)), [list]);

  if (!patientId) {
    return <p className="charts-side-panel__empty">患者IDが未選択のため病名編集を開始できません。</p>;
  }

  const openCreate = () => {
    setForm(buildEmptyForm(today));
    setNotice(null);
    setIsEditorOpen(true);
  };

  const openEdit = (entry: DiseaseEntry) => {
    setForm(toFormState(entry, today));
    setNotice(null);
    setIsEditorOpen(true);
  };

  const applyQuickCandidate = (optionKey: string) => {
    setQuickCandidateSelection(optionKey);
    if (!optionKey) {
      return;
    }
    const option = quickCandidateMap.get(optionKey);
    if (!option) {
      return;
    }
    const selectedCode = option.candidate.icdTen?.trim() || option.candidate.code?.trim() || '';
    setQuickAdd((prev) => ({
      ...prev,
      name: option.candidate.name,
      code: selectedCode || prev.code,
    }));
    setNotice({
      tone: 'info',
      message: `候補「${option.candidate.name}」を反映しました。`,
    });
  };

  return (
    <section className="charts-side-panel__section" data-test-id="diagnosis-edit-panel">
      <header className="charts-side-panel__section-header">
        <div>
          <strong>保険病名</strong>
          <p className="charts-diagnosis__lead">上段で病名一覧を確認し、下段のクイック追加から最小入力で登録します。</p>
        </div>
        <div className="charts-diagnosis__header-actions" role="group" aria-label="病名操作">
          <button type="button" className="charts-side-panel__ghost" onClick={openCreate} disabled={isBlocked}>
            詳細入力
          </button>
        </div>
      </header>

      {isBlocked && (
        <div className="charts-side-panel__notice charts-side-panel__notice--info">
          <div>編集はブロックされています: {blockReasons.join(' / ')}</div>
          {unblockHints.length > 0 ? (
            <ul className="charts-diagnosis__unblock">
              {unblockHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {notice && <div className={`charts-side-panel__notice charts-side-panel__notice--${notice.tone}`}>{notice.message}</div>}

      <div className="charts-side-panel__list charts-diagnosis__list-scroll" aria-live={resolveAriaLive('info')}>
        <div className="charts-side-panel__list-header">
          <span>登録済み病名</span>
          <span>{diagnosisQuery.isFetching ? '更新中' : `${list.length}件`}</span>
        </div>
        {diagnosisQuery.isError && (
          <p className="charts-side-panel__empty">病名の取得に失敗しました。</p>
        )}
        {list.length === 0 && !diagnosisQuery.isFetching && (
          <p className="charts-side-panel__empty">病名が未登録です。</p>
        )}
        {list.length > 0 && (
          <>
            <ul className="charts-side-panel__items charts-diagnosis__items" aria-label="登録済み病名（活動中）">
              {activeList.map((entry) => (
                <li key={entry.diagnosisId ?? `${entry.diagnosisName}-${entry.startDate}`} className="charts-diagnosis__item">
                  <div className="charts-diagnosis__item-main">
                    <div className="charts-diagnosis__title">
                      <strong className="charts-diagnosis__name">{entry.diagnosisName ?? '名称未設定'}</strong>
                      {entry.diagnosisCode ? <span className="charts-diagnosis__code">({entry.diagnosisCode})</span> : null}
                    </div>
                    <div className="charts-diagnosis__meta">
                      <span className="charts-diagnosis__badges" role="list" aria-label="病名属性">
                        {(entry.category?.includes('主') ?? false) ? (
                          <span className="charts-diagnosis__badge charts-diagnosis__badge--main" role="listitem">
                            主
                          </span>
                        ) : (
                          <span className="charts-diagnosis__badge charts-diagnosis__badge--sub" role="listitem">
                            副
                          </span>
                        )}
                        {(entry.suspectedFlag?.includes('疑い') ?? entry.category?.includes('疑い') ?? false) ? (
                          <span className="charts-diagnosis__badge charts-diagnosis__badge--suspected" role="listitem">
                            疑い
                          </span>
                        ) : null}
                      </span>
                          <span className="charts-diagnosis__dates">
                            <span>開始:{entry.startDate ? entry.startDate : '—'}</span>
                            <span>転帰:{entry.outcome ? entry.outcome : '—'}</span>
                            <span>終了:{entry.endDate ? entry.endDate : '—'}</span>
                            <span
                              className={`charts-diagnosis__code-state${
                                entry.diagnosisCode ? ' charts-diagnosis__code-state--ok' : ' charts-diagnosis__code-state--warn'
                              }`}
                            >
                              {entry.diagnosisCode ? 'コードあり' : '⚠ コード未設定'}
                            </span>
                          </span>
                        </div>
                      </div>
                  <div className="charts-side-panel__item-actions charts-diagnosis__item-actions" role="group" aria-label="病名操作">
                    <button type="button" onClick={() => openEdit(entry)} disabled={isBlocked}>
                      編集
                    </button>
                    <button type="button" onClick={() => deleteMutation.mutate(entry)} disabled={deleteMutation.isPending || isBlocked}>
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {endedList.length > 0 ? (
              <details className="charts-diagnosis__ended">
                <summary className="charts-diagnosis__ended-summary">転帰あり（{endedList.length}件）</summary>
                <ul className="charts-side-panel__items charts-diagnosis__items" aria-label="登録済み病名（転帰あり）">
                  {endedList.map((entry) => (
                    <li key={entry.diagnosisId ?? `${entry.diagnosisName}-${entry.startDate}`} className="charts-diagnosis__item">
                      <div className="charts-diagnosis__item-main">
                        <div className="charts-diagnosis__title">
                          <strong className="charts-diagnosis__name">{entry.diagnosisName ?? '名称未設定'}</strong>
                          {entry.diagnosisCode ? <span className="charts-diagnosis__code">({entry.diagnosisCode})</span> : null}
                        </div>
                        <div className="charts-diagnosis__meta">
                          <span className="charts-diagnosis__badges" role="list" aria-label="病名属性">
                            {(entry.category?.includes('主') ?? false) ? (
                              <span className="charts-diagnosis__badge charts-diagnosis__badge--main" role="listitem">
                                主
                              </span>
                            ) : (
                              <span className="charts-diagnosis__badge charts-diagnosis__badge--sub" role="listitem">
                                副
                              </span>
                            )}
                            {(entry.suspectedFlag?.includes('疑い') ?? entry.category?.includes('疑い') ?? false) ? (
                              <span className="charts-diagnosis__badge charts-diagnosis__badge--suspected" role="listitem">
                                疑い
                              </span>
                            ) : null}
                          </span>
                          <span className="charts-diagnosis__dates">
                            <span>開始:{entry.startDate ? entry.startDate : '—'}</span>
                            <span>転帰:{entry.outcome ? entry.outcome : '—'}</span>
                            <span>終了:{entry.endDate ? entry.endDate : '—'}</span>
                            <span
                              className={`charts-diagnosis__code-state${
                                entry.diagnosisCode ? ' charts-diagnosis__code-state--ok' : ' charts-diagnosis__code-state--warn'
                              }`}
                            >
                              {entry.diagnosisCode ? 'コードあり' : '⚠ コード未設定'}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="charts-side-panel__item-actions charts-diagnosis__item-actions" role="group" aria-label="病名操作">
                        <button type="button" onClick={() => openEdit(entry)} disabled={isBlocked}>
                          編集
                        </button>
                        <button type="button" onClick={() => deleteMutation.mutate(entry)} disabled={deleteMutation.isPending || isBlocked}>
                          削除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>

      <section className="charts-diagnosis__quick-add" aria-label="病名クイック追加">
        <div className="charts-side-panel__subheader">
          <strong>クイック追加</strong>
          <span className="charts-side-panel__help">最小入力で病名を追加できます。</span>
        </div>
        <div className="charts-diagnosis__quick-grid">
          <div className="charts-side-panel__field">
            <label htmlFor="diagnosis-quick-name">病名 *</label>
            <input
              id="diagnosis-quick-name"
              value={quickAdd.name}
              onChange={(event) => {
                setQuickCandidateSelection('');
                setQuickAdd((prev) => ({ ...prev, name: event.target.value }));
              }}
              placeholder="例: 高血圧症"
              disabled={isBlocked || mutation.isPending}
            />
          </div>
          <div className="charts-side-panel__field charts-diagnosis__quick-candidates">
            <label htmlFor="diagnosis-quick-candidate">病名候補</label>
            <select
              id="diagnosis-quick-candidate"
              value={quickCandidateSelection}
              onChange={(event) => applyQuickCandidate(event.target.value)}
              disabled={isBlocked || mutation.isPending || quickCandidateOptions.length === 0}
            >
              <option value="">{quickCandidateOptions.length > 0 ? '候補を選択して反映' : '候補なし'}</option>
              {quickCandidateOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {quickCandidateQuery.isFetching ? (
              <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help">候補を検索中...</p>
            ) : null}
            {!quickCandidateQuery.isFetching && quickCandidateQuery.isError ? (
              <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help charts-diagnosis__quick-candidate-help--warn">
                候補の取得に失敗しました。
              </p>
            ) : null}
            {!quickCandidateQuery.isFetching &&
            !quickCandidateQuery.isError &&
            quickAdd.name.trim().length >= QUICK_CANDIDATE_MIN_KEYWORD &&
            quickCandidateOptions.length === 0 ? (
              <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help">一致する候補はありません。</p>
            ) : null}
            {quickAdd.name.trim().length > 0 && quickAdd.name.trim().length < QUICK_CANDIDATE_MIN_KEYWORD ? (
              <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help">
                {QUICK_CANDIDATE_MIN_KEYWORD}文字以上で候補を表示します。
              </p>
            ) : null}
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor="diagnosis-quick-code">コード</label>
            <input
              id="diagnosis-quick-code"
              value={quickAdd.code}
              onChange={(event) => setQuickAdd((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="例: I10"
              disabled={isBlocked || mutation.isPending}
            />
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor="diagnosis-quick-start">開始日</label>
            <input
              id="diagnosis-quick-start"
              type="date"
              value={quickAdd.startDate}
              onChange={(event) => {
                setQuickCandidateSelection('');
                setQuickAdd((prev) => ({ ...prev, startDate: event.target.value }));
              }}
              disabled={isBlocked || mutation.isPending}
            />
          </div>
          <label className="charts-side-panel__toggle">
            <input
              type="checkbox"
              checked={quickAdd.isMain}
              onChange={(event) => setQuickAdd((prev) => ({ ...prev, isMain: event.target.checked }))}
              disabled={isBlocked || mutation.isPending}
            />
            主病名
          </label>
          <label className="charts-side-panel__toggle">
            <input
              type="checkbox"
              checked={quickAdd.isSuspected}
              onChange={(event) => setQuickAdd((prev) => ({ ...prev, isSuspected: event.target.checked }))}
              disabled={isBlocked || mutation.isPending}
            />
            疑い
          </label>
        </div>
        <div className="charts-diagnosis__quick-actions">
          <button
            type="button"
            disabled={isBlocked || mutation.isPending}
            onClick={() => {
              if (!quickAdd.name.trim()) {
                setNotice({ tone: 'error', message: '病名を入力してください。' });
                return;
              }
              mutation.mutate({
                ...buildEmptyForm(today),
                name: quickAdd.name.trim(),
                code: quickAdd.code.trim(),
                startDate: quickAdd.startDate || today,
                isMain: quickAdd.isMain,
                isSuspected: quickAdd.isSuspected,
              });
            }}
          >
            クイック追加
          </button>
        </div>
      </section>

      <FocusTrapDialog
        open={isEditorOpen}
        title={form.diagnosisId ? '病名の編集' : '病名の追加'}
        description="接頭語/接尾語、疑い病名に対応。Enter で保存、Esc で閉じます。"
        onClose={() => setIsEditorOpen(false)}
        initialFocus="none"
        testId="charts-diagnosis-editor-dialog"
      >
        <form
          className="charts-side-panel__form charts-diagnosis__editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (isBlocked) {
              return;
            }
            if (!form.name.trim()) {
              setNotice({ tone: 'error', message: '病名を入力してください。' });
              return;
            }
            mutation.mutate(form);
          }}
        >
          {notice ? <div className={`charts-side-panel__notice charts-side-panel__notice--${notice.tone}`}>{notice.message}</div> : null}
          <div className="charts-diagnosis__name-row" role="group" aria-label="病名（接頭/病名/接尾）">
            <div className="charts-side-panel__field charts-diagnosis__name-part">
              <label htmlFor="diagnosis-prefix">接頭</label>
              <input
                id="diagnosis-prefix"
                value={form.prefix}
                onChange={(event) => setForm((prev) => ({ ...prev, prefix: event.target.value }))}
                placeholder="例: 術後"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field charts-diagnosis__name-main">
              <label htmlFor="diagnosis-name">病名 *</label>
              <input
                id="diagnosis-name"
                ref={nameInputRef}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例: 高血圧症"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field charts-diagnosis__name-part">
              <label htmlFor="diagnosis-suffix">接尾</label>
              <input
                id="diagnosis-suffix"
                value={form.suffix}
                onChange={(event) => setForm((prev) => ({ ...prev, suffix: event.target.value }))}
                placeholder="例: による"
                disabled={isBlocked}
              />
            </div>
          </div>
          <div className="charts-side-panel__field-row">
            <label className="charts-side-panel__toggle">
              <input
                id="diagnosis-main"
                name="diagnosisMain"
                type="checkbox"
                checked={form.isMain}
                onChange={(event) => setForm((prev) => ({ ...prev, isMain: event.target.checked }))}
                disabled={isBlocked}
              />
              主病名
            </label>
            <label className="charts-side-panel__toggle">
              <input
                id="diagnosis-suspected"
                name="diagnosisSuspected"
                type="checkbox"
                checked={form.isSuspected}
                onChange={(event) => setForm((prev) => ({ ...prev, isSuspected: event.target.checked }))}
                disabled={isBlocked}
              />
              疑い
            </label>
          </div>
          <details className="charts-diagnosis__advanced">
            <summary className="charts-diagnosis__advanced-summary">詳細（コード/開始/転帰）</summary>
            <div className="charts-side-panel__field">
              <label htmlFor="diagnosis-code">病名コード</label>
              <input
                id="diagnosis-code"
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="例: I10"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field-row">
              <div className="charts-side-panel__field">
                <label htmlFor="diagnosis-start">開始日</label>
                <input
                  id="diagnosis-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  disabled={isBlocked}
                />
              </div>
              <div className="charts-side-panel__field">
                <label htmlFor="diagnosis-end">転帰日</label>
                <input
                  id="diagnosis-end"
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  disabled={isBlocked}
                />
              </div>
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="diagnosis-outcome">転帰</label>
              <input
                id="diagnosis-outcome"
                list="diagnosis-outcome-options"
                value={form.outcome}
                onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))}
                placeholder="例: 継続"
                disabled={isBlocked}
              />
              <datalist id="diagnosis-outcome-options">
                {OUTCOME_PRESETS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </details>
          <div className="charts-diagnosis__editor-actions" role="group" aria-label="病名保存">
            <button type="submit" disabled={mutation.isPending || isBlocked}>
              {form.diagnosisId ? '更新' : '追加'}
            </button>
            <button
              type="button"
              className="charts-side-panel__ghost"
              onClick={() => {
                setIsEditorOpen(false);
              }}
            >
              閉じる
            </button>
          </div>
          <small className="charts-diagnosis__hint">追加後もダイアログは開いたままです（連続入力向け）。編集は保存後に自動で閉じます。</small>
        </form>
      </FocusTrapDialog>
    </section>
  );
}
