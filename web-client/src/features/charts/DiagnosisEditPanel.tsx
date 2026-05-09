import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { resolveAriaLive } from '../../libs/observability/observability';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import type { DataSourceTransition } from './authService';
import {
  DISEASE_CANDIDATE_CONFIRM_NOTE,
  DISEASE_CONFLICT_NOTE,
  DISEASE_MANUAL_RESOLUTION_NOTE,
  DISEASE_MIRROR_EMPTY_NOTE,
  DISEASE_MIRROR_UNAVAILABLE_NOTE,
  DISEASE_OUTCOME_PRESETS,
  DISEASE_SYNC_CANDIDATES_NOTE,
  fetchDiseases,
  mutateOrcaDisease,
  resolveDiseaseCodeFromOrcaMaster,
  searchDiseaseMasterCandidates,
  type DiseaseEntry,
  type DiseaseLayer,
  type DiseaseMasterCandidate,
  type OrcaDiseaseMutationOperation,
  type OrcaDiseaseMutationRequest,
} from './diseaseApi';

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
  departmentCode?: string;
  insuranceCombinationNumber?: string;
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

type FormMutationInput = {
  operation: Extract<OrcaDiseaseMutationOperation, 'create' | 'update'>;
  form: DiagnosisFormState;
  sourceEntry?: DiseaseEntry;
};

type OrcaDiseaseInformation = NonNullable<OrcaDiseaseMutationRequest['diseaseInformation']>[number];

type PendingAction =
  | { operation: 'create'; title: string; confirmLabel: string; form: DiagnosisFormState; sourceEntry?: DiseaseEntry }
  | { operation: 'update'; title: string; confirmLabel: string; form: DiagnosisFormState; sourceEntry?: DiseaseEntry }
  | { operation: 'delete'; title: string; confirmLabel: string; entry: DiseaseEntry }
  | { operation: 'organizeDeletedDiseases'; title: string; confirmLabel: string };

const QUICK_CANDIDATE_MIN_KEYWORD = 2;
const QUICK_CANDIDATE_MAX_ITEMS = 20;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

const resolveDiseaseLayer = (entry: DiseaseEntry): DiseaseLayer => entry.layer ?? 'insurance-local';
const isMainDisease = (entry: DiseaseEntry) => entry.category?.includes('主') ?? false;
const isSuspectedDisease = (entry: DiseaseEntry) => entry.suspectedFlag?.includes('疑い') ?? entry.category?.includes('疑い') ?? false;
const formatEntryName = (entry?: DiseaseEntry | null) => entry?.diagnosisName?.trim() || '名称未設定';
const buildEntryKey = (entry: DiseaseEntry) =>
  `${resolveDiseaseLayer(entry)}:${entry.diagnosisId ?? `${entry.diagnosisName ?? 'unknown'}-${entry.startDate ?? 'na'}`}`;

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

const isValidDateOnly = (value: string) => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const validateDiagnosisForm = (state: DiagnosisFormState): string | null => {
  if (!state.name.trim()) {
    return '病名を入力してください。';
  }
  if (!state.startDate.trim() || !isValidDateOnly(state.startDate.trim())) {
    return '開始日は西暦yyyy-MM-dd形式の実在する日付で入力してください。';
  }
  if (state.endDate.trim() && !isValidDateOnly(state.endDate.trim())) {
    return '転帰日は西暦yyyy-MM-dd形式の実在する日付で入力してください。';
  }
  if (state.endDate.trim() && state.endDate.trim() < state.startDate.trim()) {
    return '転帰日は開始日以降の日付を入力してください。';
  }
  if (state.outcome.trim() && !(DISEASE_OUTCOME_PRESETS as readonly string[]).includes(state.outcome.trim())) {
    return `転帰は ${DISEASE_OUTCOME_PRESETS.join('、')} のいずれかを入力してください。`;
  }
  return null;
};

const buildDiseaseInput = (input: FormMutationInput) => {
  const combinedName = `${input.form.prefix ?? ''}${input.form.name ?? ''}${input.form.suffix ?? ''}`.trim();
  return {
    diagnosisId: input.sourceEntry?.diagnosisId ?? input.form.diagnosisId,
    diagnosisName: combinedName,
    diagnosisCode: input.form.code.trim() || undefined,
    departmentCode: input.sourceEntry?.departmentCode,
    insuranceCombinationNumber: input.sourceEntry?.insuranceCombinationNumber,
    startDate: input.form.startDate || undefined,
    endDate: input.form.endDate || undefined,
    outcome: input.form.outcome || undefined,
    category: input.form.isMain ? '主病名' : '副病名',
    suspectedFlag: input.form.isSuspected ? '疑い' : undefined,
  };
};

const toOrcaDiseaseInformation = (entry: DiseaseEntry): OrcaDiseaseInformation => ({
  diseaseCode: entry.diagnosisCode,
  diseaseName: entry.diagnosisName,
  diseaseStartDate: entry.startDate,
  diseaseEndDate: entry.endDate,
  diseaseInOut: 'O',
  diseaseSuspectedFlag: isSuspectedDisease(entry) ? 'S' : undefined,
  diseaseOutCome: entry.outcome,
  insuranceCombinationNumber: entry.insuranceCombinationNumber,
});

function DiseaseRow({
  entry,
  actions,
}: {
  entry: DiseaseEntry;
  actions?: ReactNode;
}) {
  return (
    <li className="charts-diagnosis__item">
      <div className="charts-diagnosis__item-main">
        <div className="charts-diagnosis__title">
          <strong className="charts-diagnosis__name">{formatEntryName(entry)}</strong>
          {entry.diagnosisCode ? <span className="charts-diagnosis__code">({entry.diagnosisCode})</span> : null}
        </div>
        <div className="charts-diagnosis__meta">
          <span className="charts-diagnosis__badges" role="list" aria-label="病名属性">
            {isMainDisease(entry) ? (
              <span className="charts-diagnosis__badge charts-diagnosis__badge--main" role="listitem">
                主
              </span>
            ) : (
              <span className="charts-diagnosis__badge charts-diagnosis__badge--sub" role="listitem">
                副
              </span>
            )}
            {isSuspectedDisease(entry) ? (
              <span className="charts-diagnosis__badge charts-diagnosis__badge--suspected" role="listitem">
                疑い
              </span>
            ) : null}
          </span>
          <span className="charts-diagnosis__dates">
            <span>開始:{entry.startDate ? entry.startDate : '-'}</span>
            <span>転帰:{entry.outcome ? entry.outcome : '-'}</span>
            <span>終了:{entry.endDate ? entry.endDate : '-'}</span>
            <span className={`charts-diagnosis__code-state${entry.diagnosisCode ? ' charts-diagnosis__code-state--ok' : ' charts-diagnosis__code-state--warn'}`}>
              {entry.diagnosisCode ? 'コードあり' : 'コード未設定'}
            </span>
          </span>
        </div>
      </div>
      {actions ? (
        <div className="charts-side-panel__item-actions charts-diagnosis__item-actions" role="group" aria-label="病名操作">
          {actions}
        </div>
      ) : null}
    </li>
  );
}

export function DiagnosisEditPanel({ patientId, meta }: DiagnosisEditPanelProps) {
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState<DiagnosisFormState>(() => buildEmptyForm(today));
  const [editingEntry, setEditingEntry] = useState<DiseaseEntry | undefined>();
  const [quickAdd, setQuickAdd] = useState({
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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const blockReasons = useMemo(() => {
    const reasons: string[] = [];
    if (meta.readOnly) reasons.push(meta.readOnlyReason ?? '閲覧専用のため編集できません。');
    if (meta.missingMaster) reasons.push('マスター未同期のため編集できません。');
    if (meta.fallbackUsed) reasons.push('フォールバックデータのため編集できません。');
    return reasons;
  }, [meta.fallbackUsed, meta.missingMaster, meta.readOnly, meta.readOnlyReason]);
  const isBlocked = blockReasons.length > 0;
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

  const queryKey = ['charts-diagnosis', patientId, meta.visitDate];
  const diagnosisQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!patientId) throw new Error('patientId is required');
      return fetchDiseases({ patientId, to: meta.visitDate });
    },
    enabled: !!patientId,
  });

  const list = useMemo(() => diagnosisQuery.data?.diseases ?? [], [diagnosisQuery.data?.diseases]);
  const mirrorList = useMemo(() => list.filter((entry) => resolveDiseaseLayer(entry) === 'orca-mirror'), [list]);
  const pendingLocalList = useMemo(() => {
    const pendingLocalDiseases = diagnosisQuery.data?.pendingLocalDiseases;
    if (Array.isArray(pendingLocalDiseases) && pendingLocalDiseases.length > 0) {
      return pendingLocalDiseases.filter((entry) => resolveDiseaseLayer(entry) === 'insurance-local');
    }
    return list.filter((entry) => resolveDiseaseLayer(entry) === 'insurance-local');
  }, [diagnosisQuery.data?.pendingLocalDiseases, list]);
  const activeMirrorList = useMemo(() => mirrorList.filter((entry) => !entry.endDate), [mirrorList]);
  const endedMirrorList = useMemo(() => mirrorList.filter((entry) => Boolean(entry.endDate)), [mirrorList]);
  const isMirrorConnected = diagnosisQuery.data?.orcaMirrorStatus === 'connected';
  const isDiseaseMirrorPending = diagnosisQuery.isLoading || (diagnosisQuery.isFetching && !diagnosisQuery.data && !diagnosisQuery.isError);
  const isDiseaseMirrorUnavailable = Boolean(diagnosisQuery.data) && !isMirrorConnected;
  const isOrcaMutationBlocked = isBlocked || !isMirrorConnected || diagnosisQuery.isError || !meta.visitDate || !meta.departmentCode;
  const mutationBlockReasons = useMemo(() => {
    const reasons = [...blockReasons];
    if (isDiseaseMirrorUnavailable) reasons.push('ORCA病名を取得できません。');
    if (diagnosisQuery.isError) reasons.push('病名取得に失敗しました。');
    if (!meta.visitDate) reasons.push('診療日が未確定です。');
    if (!meta.departmentCode) reasons.push('診療科コードが未確定です。');
    return reasons;
  }, [blockReasons, diagnosisQuery.isError, isDiseaseMirrorUnavailable, meta.departmentCode, meta.visitDate]);
  const unblockHints = useMemo(() => {
    const hints: string[] = [];
    if (meta.readOnly) {
      hints.push('閲覧専用を解除するには、タブロック解除または権限設定を確認してください。');
    }
    if (meta.missingMaster || meta.fallbackUsed) {
      hints.push('マスター同期または再取得を実行して、編集可能状態へ戻してください。');
    }
    if (isDiseaseMirrorUnavailable || diagnosisQuery.isError || !meta.visitDate || !meta.departmentCode) {
      hints.push('ORCA病名を再取得し、正本確認ができる状態にしてください。');
    }
    return hints;
  }, [diagnosisQuery.isError, isDiseaseMirrorUnavailable, meta.departmentCode, meta.fallbackUsed, meta.missingMaster, meta.readOnly, meta.visitDate]);

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
    enabled: !isOrcaMutationBlocked && quickCandidateKeyword.length >= QUICK_CANDIDATE_MIN_KEYWORD,
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
    for (const option of quickCandidateOptions) map.set(option.key, option);
    return map;
  }, [quickCandidateOptions]);

  useEffect(() => {
    if (quickCandidateSelection && !quickCandidateMap.has(quickCandidateSelection)) {
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

  useLayoutEffect(() => {
    if (!isEditorOpen) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditorOpen, form.diagnosisId]);

  const formMutation = useMutation({
    mutationFn: async (input: FormMutationInput) => {
      if (!patientId) throw new Error('patientId is required');
      const combinedName = `${input.form.prefix ?? ''}${input.form.name ?? ''}${input.form.suffix ?? ''}`.trim();
      const explicitCode = input.form.code.trim();
      const resolvedCode =
        explicitCode ||
        (await resolveDiseaseCodeFromOrcaMaster({
          diagnosisName: combinedName,
          prefix: input.form.prefix,
          mainName: input.form.name,
          suffix: input.form.suffix,
          referenceDate: input.form.startDate,
        }));
      if (!resolvedCode) {
        throw new Error('ORCA病名登録には病名コードが必要です。病名マスター候補を選択するかコードを入力してください。');
      }
      if (!meta.visitDate) {
        throw new Error('ORCA病名登録には診療日が必要です。');
      }
      if (!meta.departmentCode) {
        throw new Error('ORCA病名登録には診療科コードが必要です。');
      }
      const disease = buildDiseaseInput(input);
      return mutateOrcaDisease({
        patientId,
        operation: input.operation,
        performDate: meta.visitDate,
        departmentCode: meta.departmentCode,
        diseaseInformation: [
          {
            diseaseCode: resolvedCode,
            diseaseName: disease.diagnosisName,
            diseaseStartDate: disease.startDate,
            diseaseEndDate: disease.endDate,
            diseaseInOut: 'O',
            diseaseSuspectedFlag: input.form.isSuspected ? 'S' : undefined,
            diseaseOutCome: disease.outcome,
            insuranceCombinationNumber: meta.insuranceCombinationNumber ?? disease.insuranceCombinationNumber,
          },
        ],
        targetDisease: input.operation === 'update' && input.sourceEntry ? toOrcaDiseaseInformation(input.sourceEntry) : undefined,
      });
    },
    onSuccess: (result, input) => {
      const failureMessage = result.message ?? 'ORCA病名の処理に失敗しました。';
      setNotice({
        tone: result.ok ? 'success' : 'error',
        message: result.ok ? 'ORCA病名を処理しました。再取得結果を反映します。' : failureMessage,
      });
      recordOutpatientFunnel('charts_action', {
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit ?? false,
        missingMaster: meta.missingMaster ?? false,
        dataSourceTransition: meta.dataSourceTransition ?? 'server',
        fallbackUsed: meta.fallbackUsed ?? false,
        action: input.operation,
        outcome: result.ok ? 'success' : 'error',
        note: input.form.name,
      });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORCA_DISEASE_MUTATION',
          outcome: result.ok ? 'success' : 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            operation: input.operation,
            patientId,
            diagnosisId: input.sourceEntry?.diagnosisId ?? input.form.diagnosisId,
            diagnosisName: input.form.name,
            startDate: input.form.startDate,
            ...(result.ok ? {} : { error: failureMessage }),
          },
        },
      });
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey });
        setPendingAction(null);
        setForm(buildEmptyForm(today));
        setEditingEntry(undefined);
        setIsEditorOpen(false);
        setQuickAdd({ name: '', code: '', startDate: today, isMain: false, isSuspected: false });
        setQuickCandidateSelection('');
      }
    },
    onError: (error: unknown, input) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `ORCA病名の処理に失敗しました: ${message}` });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORCA_DISEASE_MUTATION',
          outcome: 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            operation: input.operation,
            patientId,
            diagnosisName: input.form.name,
            error: message,
          },
        },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entry: DiseaseEntry) => {
      if (!patientId) throw new Error('patientId is required');
      if (!meta.visitDate) {
        throw new Error('ORCA病名削除には診療日が必要です。');
      }
      if (!meta.departmentCode) {
        throw new Error('ORCA病名削除には診療科コードが必要です。');
      }
      const targetDisease = toOrcaDiseaseInformation(entry);
      return mutateOrcaDisease({
        operation: 'delete',
        patientId,
        performDate: meta.visitDate,
        departmentCode: meta.departmentCode,
        diseaseInformation: [targetDisease],
        targetDisease,
      });
    },
    onSuccess: (result, entry) => {
      const failureMessage = result.message ?? 'ORCA病名の削除に失敗しました。';
      setNotice({
        tone: result.ok ? 'success' : 'error',
        message: result.ok ? 'ORCA病名を削除しました。再取得結果を反映します。' : failureMessage,
      });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORCA_DISEASE_MUTATION',
          outcome: result.ok ? 'success' : 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            operation: 'delete',
            patientId,
            diagnosisName: entry.diagnosisName,
            startDate: entry.startDate,
            ...(result.ok ? {} : { error: failureMessage }),
          },
        },
      });
      if (result.ok) {
        setPendingAction(null);
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `ORCA病名の削除に失敗しました: ${message}` });
    },
  });

  const organizeMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error('patientId is required');
      if (!meta.visitDate) {
        throw new Error('削除病名整理には診療日が必要です。');
      }
      if (!meta.departmentCode) {
        throw new Error('削除病名整理には診療科コードが必要です。');
      }
      return mutateOrcaDisease({
        operation: 'organizeDeletedDiseases',
        patientId,
        performDate: meta.visitDate,
        departmentCode: meta.departmentCode,
        organizeInformation: {
          departmentCode: meta.departmentCode,
          diseaseStartDate: meta.visitDate,
        },
      });
    },
    onSuccess: (result) => {
      const failureMessage = result.message ?? '削除病名の整理に失敗しました。';
      setNotice({
        tone: result.ok ? 'success' : 'error',
        message: result.ok ? '削除病名を整理しました。再取得結果を反映します。' : failureMessage,
      });
      if (result.ok) {
        setPendingAction(null);
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `削除病名の整理に失敗しました: ${message}` });
    },
  });

  const isAnyMutationPending = formMutation.isPending || deleteMutation.isPending || organizeMutation.isPending;
  const panelNotes = useMemo(() => {
    const notes = new Map<string, { tone: 'info' | 'error'; message: string }>();
    const addNote = (message: string, tone: 'info' | 'error' = 'info') => {
      if (!notes.has(message)) notes.set(message, { tone, message });
    };
    if (quickCandidateOptions.length > 0 || pendingLocalList.some((entry) => entry.syncState === 'candidate')) {
      addNote(DISEASE_SYNC_CANDIDATES_NOTE);
    }
    if (mirrorList.some((entry) => entry.syncState === 'conflict' || entry.syncState === 'stale')) {
      addNote(DISEASE_CONFLICT_NOTE, 'error');
    }
    if (pendingLocalList.length > 0) {
      addNote('院内未送信の病名があります。ORCAへ登録するまで主一覧には表示しません。');
    }
    addNote(DISEASE_MANUAL_RESOLUTION_NOTE);
    for (const entry of list) {
      if (entry.note?.trim()) {
        addNote(entry.note.trim(), entry.syncState === 'conflict' || entry.syncState === 'stale' ? 'error' : 'info');
      }
    }
    return [...notes.values()];
  }, [list, mirrorList, pendingLocalList, quickCandidateOptions.length]);

  if (!patientId) {
    return <p className="charts-side-panel__empty">患者IDが未選択のため病名編集を開始できません。</p>;
  }

  const openCreate = () => {
    setEditingEntry(undefined);
    setForm(buildEmptyForm(today));
    setNotice(null);
    setIsEditorOpen(true);
  };

  const openEdit = (entry: DiseaseEntry) => {
    setEditingEntry(entry);
    setForm(toFormState(entry, today));
    setNotice(null);
    setIsEditorOpen(true);
  };

  const requestFormMutation = (operation: Extract<OrcaDiseaseMutationOperation, 'create' | 'update'>, nextForm: DiagnosisFormState, sourceEntry?: DiseaseEntry) => {
    const validationMessage = validateDiagnosisForm(nextForm);
    if (validationMessage) {
      setNotice({ tone: 'error', message: validationMessage });
      return;
    }
    setPendingAction({
      operation,
      title: operation === 'create' ? 'ORCAへ病名登録' : 'ORCA病名を更新',
      confirmLabel: operation === 'create' ? 'ORCAへ病名登録' : 'ORCA病名を更新',
      form: nextForm,
      sourceEntry,
    });
  };

  const applyQuickCandidate = (optionKey: string) => {
    setQuickCandidateSelection(optionKey);
    if (!optionKey) return;
    const option = quickCandidateMap.get(optionKey);
    if (!option) return;
    const selectedCode = option.candidate.icdTen?.trim() || option.candidate.code?.trim() || '';
    setQuickAdd((prev) => ({
      ...prev,
      name: option.candidate.name,
      code: selectedCode || prev.code,
    }));
    setNotice({ tone: 'info', message: `候補「${option.candidate.name}」を反映しました。` });
  };

  const confirmPendingAction = () => {
    if (!pendingAction || isOrcaMutationBlocked) return;
    if (pendingAction.operation === 'delete') {
      deleteMutation.mutate(pendingAction.entry);
      return;
    }
    if (pendingAction.operation === 'organizeDeletedDiseases') {
      organizeMutation.mutate();
      return;
    }
    formMutation.mutate({
      operation: pendingAction.operation,
      form: pendingAction.form,
      sourceEntry: pendingAction.sourceEntry,
    });
  };

  const pendingForm = pendingAction && 'form' in pendingAction ? pendingAction.form : null;
  const pendingEntry = pendingAction && 'entry' in pendingAction ? pendingAction.entry : pendingAction && 'sourceEntry' in pendingAction ? pendingAction.sourceEntry : null;

  return (
    <section className="charts-side-panel__section" data-test-id="diagnosis-edit-panel">
      <header className="charts-side-panel__section-header">
        <div>
          <strong>ORCA登録病名</strong>
          <p className="charts-diagnosis__lead">カルテ画面の病名は ORCA 再取得結果を正本にします。院内未送信の病名は別枠で確認します。</p>
        </div>
        <div className="charts-diagnosis__header-actions" role="group" aria-label="病名操作">
          <button type="button" className="charts-side-panel__ghost" onClick={openCreate} disabled={isOrcaMutationBlocked || isAnyMutationPending}>
            ORCAへ病名登録
          </button>
          <button
            type="button"
            className="charts-side-panel__ghost"
            onClick={() =>
              setPendingAction({
                operation: 'organizeDeletedDiseases',
                title: '削除病名を整理',
                confirmLabel: '削除病名を整理',
              })
            }
            disabled={isOrcaMutationBlocked || isAnyMutationPending}
          >
            削除病名を整理
          </button>
        </div>
      </header>

      {isDiseaseMirrorPending ? (
        <div className="charts-side-panel__notice charts-side-panel__notice--info">
          ORCA登録病名を確認中です。確認完了まで病名操作は待機します。
        </div>
      ) : mutationBlockReasons.length > 0 ? (
        <div className="charts-side-panel__notice charts-side-panel__notice--info">
          <div>ORCA病名操作はブロックされています: {mutationBlockReasons.join(' / ')}</div>
          {unblockHints.length > 0 ? (
            <ul className="charts-diagnosis__unblock">
              {unblockHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {panelNotes.length > 0 ? (
        <div className="charts-diagnosis__notes" aria-live={resolveAriaLive('info')}>
          {panelNotes.map((note) => (
            <div key={note.message} className={`charts-side-panel__notice charts-side-panel__notice--${note.tone}`}>
              {note.message}
            </div>
          ))}
        </div>
      ) : null}
      {notice ? <div className={`charts-side-panel__notice charts-side-panel__notice--${notice.tone}`}>{notice.message}</div> : null}

      <section className="charts-diagnosis__quick-add charts-diagnosis__quick-add--authoring" aria-label="ORCAへ病名登録">
        <div className="charts-side-panel__subheader">
          <strong>ORCAへ病名登録</strong>
          <span className="charts-side-panel__help">{DISEASE_CANDIDATE_CONFIRM_NOTE}</span>
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
              disabled={isOrcaMutationBlocked || isAnyMutationPending}
            />
          </div>
          <div className="charts-side-panel__field charts-diagnosis__quick-candidates">
            <label htmlFor="diagnosis-quick-candidate">病名マスター候補</label>
            <select
              id="diagnosis-quick-candidate"
              value={quickCandidateSelection}
              onChange={(event) => applyQuickCandidate(event.target.value)}
              disabled={isOrcaMutationBlocked || isAnyMutationPending || quickCandidateOptions.length === 0}
            >
              <option value="">{quickCandidateOptions.length > 0 ? '候補を選択して入力へ反映' : '候補なし'}</option>
              {quickCandidateOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {quickCandidateQuery.isFetching ? <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help">候補を検索中...</p> : null}
            {!quickCandidateQuery.isFetching && quickAdd.name.trim().length >= QUICK_CANDIDATE_MIN_KEYWORD && quickCandidateOptions.length === 0 ? (
              <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help">一致する候補はありません。</p>
            ) : null}
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor="diagnosis-quick-code">コード ※任意</label>
            <input
              id="diagnosis-quick-code"
              value={quickAdd.code}
              onChange={(event) => setQuickAdd((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="例: I10"
              disabled={isOrcaMutationBlocked || isAnyMutationPending}
            />
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor="diagnosis-quick-start">開始日 ※必須</label>
            <input
              id="diagnosis-quick-start"
              type="date"
              value={quickAdd.startDate}
              onChange={(event) => {
                setQuickCandidateSelection('');
                setQuickAdd((prev) => ({ ...prev, startDate: event.target.value }));
              }}
              disabled={isOrcaMutationBlocked || isAnyMutationPending}
            />
          </div>
          <label className="charts-side-panel__toggle">
            <input
              type="checkbox"
              checked={quickAdd.isMain}
              onChange={(event) => setQuickAdd((prev) => ({ ...prev, isMain: event.target.checked }))}
              disabled={isOrcaMutationBlocked || isAnyMutationPending}
            />
            主病名
          </label>
          <label className="charts-side-panel__toggle">
            <input
              type="checkbox"
              checked={quickAdd.isSuspected}
              onChange={(event) => setQuickAdd((prev) => ({ ...prev, isSuspected: event.target.checked }))}
              disabled={isOrcaMutationBlocked || isAnyMutationPending}
            />
            疑い
          </label>
        </div>
        <div className="charts-diagnosis__quick-actions">
          <button
            type="button"
            disabled={isOrcaMutationBlocked || isAnyMutationPending}
            onClick={() => {
              requestFormMutation('create', {
                ...buildEmptyForm(today),
                name: quickAdd.name.trim(),
                code: quickAdd.code.trim(),
                startDate: quickAdd.startDate || today,
                isMain: quickAdd.isMain,
                isSuspected: quickAdd.isSuspected,
              });
            }}
          >
            ORCAへ病名登録
          </button>
        </div>
      </section>

      <section className="charts-diagnosis__quick-add" aria-label="ORCA登録病名">
        <div className="charts-side-panel__subheader">
          <strong>ORCA登録病名</strong>
          <span className="charts-side-panel__help">{diagnosisQuery.isFetching ? '取得中' : isMirrorConnected ? `${mirrorList.length}件` : '未確認'}</span>
        </div>
        {diagnosisQuery.isError ? <p className="charts-side-panel__empty">病名の取得に失敗しました。</p> : null}
        {mirrorList.length === 0 && !diagnosisQuery.isFetching && !diagnosisQuery.isError && diagnosisQuery.data ? (
          <p className="charts-side-panel__empty">{isMirrorConnected ? DISEASE_MIRROR_EMPTY_NOTE : DISEASE_MIRROR_UNAVAILABLE_NOTE}</p>
        ) : null}
        {mirrorList.length > 0 ? (
          <>
            <ul className="charts-side-panel__items charts-diagnosis__items" aria-label="ORCA登録病名（活動中）">
              {activeMirrorList.map((entry) => (
                <DiseaseRow
                  key={buildEntryKey(entry)}
                  entry={entry}
                  actions={
                    <>
                      <button type="button" onClick={() => openEdit(entry)} disabled={isOrcaMutationBlocked || isAnyMutationPending}>
                        ORCA病名を更新
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAction({
                            operation: 'delete',
                            title: 'ORCA病名を削除',
                            confirmLabel: 'ORCA病名を削除',
                            entry,
                          })
                        }
                        disabled={isOrcaMutationBlocked || isAnyMutationPending}
                      >
                        ORCA病名を削除
                      </button>
                    </>
                  }
                />
              ))}
            </ul>
            {endedMirrorList.length > 0 ? (
              <details className="charts-diagnosis__ended">
                <summary className="charts-diagnosis__ended-summary">転帰あり（{endedMirrorList.length}件）</summary>
                <ul className="charts-side-panel__items charts-diagnosis__items" aria-label="ORCA登録病名（転帰あり）">
                  {endedMirrorList.map((entry) => (
                    <DiseaseRow
                      key={buildEntryKey(entry)}
                      entry={entry}
                      actions={
                        <>
                          <button type="button" onClick={() => openEdit(entry)} disabled={isOrcaMutationBlocked || isAnyMutationPending}>
                            ORCA病名を更新
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                operation: 'delete',
                                title: 'ORCA病名を削除',
                                confirmLabel: 'ORCA病名を削除',
                                entry,
                              })
                            }
                            disabled={isOrcaMutationBlocked || isAnyMutationPending}
                          >
                            ORCA病名を削除
                          </button>
                        </>
                      }
                    />
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="charts-diagnosis__quick-add" aria-label="院内未送信病名">
        <div className="charts-side-panel__subheader">
          <strong>院内未送信</strong>
          <span className="charts-side-panel__help">{pendingLocalList.length}件 / ORCA正本には未反映</span>
        </div>
        {pendingLocalList.length === 0 ? <p className="charts-side-panel__empty">院内未送信の病名はありません。</p> : null}
        {pendingLocalList.length > 0 ? (
          <ul className="charts-side-panel__items charts-diagnosis__items" aria-label="院内未送信病名">
            {pendingLocalList.map((entry) => (
              <DiseaseRow
                key={buildEntryKey(entry)}
                entry={entry}
                actions={
                  <button
                    type="button"
                    onClick={() => requestFormMutation('create', toFormState(entry, today), entry)}
                    disabled={isOrcaMutationBlocked || isAnyMutationPending}
                  >
                    ORCAへ病名登録
                  </button>
                }
              />
            ))}
          </ul>
        ) : null}
      </section>

      <FocusTrapDialog
        open={isEditorOpen}
        title={editingEntry ? 'ORCA病名の更新' : 'ORCA病名の追加'}
        description="入力内容は確認ダイアログで確認してから ORCA へ送信します。"
        onClose={() => setIsEditorOpen(false)}
        initialFocus="none"
        testId="charts-diagnosis-editor-dialog"
      >
        <form
          className="charts-side-panel__form charts-diagnosis__editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (isOrcaMutationBlocked) return;
            requestFormMutation(editingEntry ? 'update' : 'create', form, editingEntry);
          }}
        >
          {notice ? <div className={`charts-side-panel__notice charts-side-panel__notice--${notice.tone}`}>{notice.message}</div> : null}
          <div className="charts-diagnosis__name-row" role="group" aria-label="病名（接頭/病名/接尾）">
            <div className="charts-side-panel__field charts-diagnosis__name-part">
              <label htmlFor="diagnosis-prefix">接頭</label>
              <input id="diagnosis-prefix" value={form.prefix} onChange={(event) => setForm((prev) => ({ ...prev, prefix: event.target.value }))} disabled={isOrcaMutationBlocked} />
            </div>
            <div className="charts-side-panel__field charts-diagnosis__name-main">
              <label htmlFor="diagnosis-name">病名 *</label>
              <input
                id="diagnosis-name"
                ref={nameInputRef}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例: 高血圧症"
                disabled={isOrcaMutationBlocked}
              />
            </div>
            <div className="charts-side-panel__field charts-diagnosis__name-part">
              <label htmlFor="diagnosis-suffix">接尾</label>
              <input id="diagnosis-suffix" value={form.suffix} onChange={(event) => setForm((prev) => ({ ...prev, suffix: event.target.value }))} disabled={isOrcaMutationBlocked} />
            </div>
          </div>
          <div className="charts-side-panel__field-row">
            <label className="charts-side-panel__toggle">
              <input type="checkbox" checked={form.isMain} onChange={(event) => setForm((prev) => ({ ...prev, isMain: event.target.checked }))} disabled={isOrcaMutationBlocked} />
              主病名
            </label>
            <label className="charts-side-panel__toggle">
              <input type="checkbox" checked={form.isSuspected} onChange={(event) => setForm((prev) => ({ ...prev, isSuspected: event.target.checked }))} disabled={isOrcaMutationBlocked} />
              疑い
            </label>
          </div>
          <details className="charts-diagnosis__advanced">
            <summary className="charts-diagnosis__advanced-summary">詳細（コード/開始/転帰）</summary>
            <div className="charts-side-panel__field">
              <label htmlFor="diagnosis-code">病名コード ※任意</label>
              <input id="diagnosis-code" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="例: I10" disabled={isOrcaMutationBlocked} />
            </div>
            <div className="charts-side-panel__field-row">
              <div className="charts-side-panel__field">
                <label htmlFor="diagnosis-start">開始日 ※必須</label>
                <input id="diagnosis-start" type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} disabled={isOrcaMutationBlocked} />
              </div>
              <div className="charts-side-panel__field">
                <label htmlFor="diagnosis-end">転帰日 ※任意</label>
                <input id="diagnosis-end" type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} disabled={isOrcaMutationBlocked} />
              </div>
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="diagnosis-outcome">転帰 ※任意</label>
              <input id="diagnosis-outcome" list="diagnosis-outcome-options" value={form.outcome} onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))} placeholder="例: 継続" disabled={isOrcaMutationBlocked} />
              <datalist id="diagnosis-outcome-options">
                {DISEASE_OUTCOME_PRESETS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </details>
          <div className="charts-diagnosis__editor-actions" role="group" aria-label="病名保存">
            <button type="submit" disabled={isAnyMutationPending || isOrcaMutationBlocked}>
              {editingEntry ? 'ORCA病名を更新' : 'ORCAへ病名登録'}
            </button>
            <button type="button" className="charts-side-panel__ghost" onClick={() => setIsEditorOpen(false)}>
              閉じる
            </button>
          </div>
        </form>
      </FocusTrapDialog>

      <FocusTrapDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title ?? 'ORCA病名操作'}
        description="この操作は ORCA へ送信し、成功後に再取得した結果だけを画面へ反映します。"
        onClose={() => setPendingAction(null)}
        initialFocus="none"
        testId="charts-diagnosis-confirm-dialog"
      >
        <div className="charts-side-panel__form charts-diagnosis__editor">
          <dl className="charts-diagnosis__confirm">
            <div>
              <dt>操作</dt>
              <dd>{pendingAction?.title ?? '-'}</dd>
            </div>
            <div>
              <dt>病名</dt>
              <dd>{pendingForm?.name || formatEntryName(pendingEntry)}</dd>
            </div>
            <div>
              <dt>開始日</dt>
              <dd>{pendingForm?.startDate || pendingEntry?.startDate || '-'}</dd>
            </div>
            <div>
              <dt>転帰</dt>
              <dd>{pendingForm?.outcome || pendingEntry?.outcome || '-'}</dd>
            </div>
          </dl>
          <div className="charts-side-panel__notice charts-side-panel__notice--info">ORCA再取得が完了するまで一覧は更新しません。</div>
          <div className="charts-diagnosis__editor-actions" role="group" aria-label="ORCA病名操作の確認">
            <button type="button" onClick={confirmPendingAction} disabled={isAnyMutationPending || isOrcaMutationBlocked}>
              {pendingAction?.confirmLabel ?? '実行'}
            </button>
            <button type="button" className="charts-side-panel__ghost" onClick={() => setPendingAction(null)} disabled={isAnyMutationPending}>
              キャンセル
            </button>
          </div>
        </div>
      </FocusTrapDialog>
    </section>
  );
}
