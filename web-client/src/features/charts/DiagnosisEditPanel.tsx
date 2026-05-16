import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CriticalOperationConfirmDialog } from '../../components/modals/CriticalOperationConfirmDialog';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { resolveAriaLive } from '../../libs/observability/observability';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { ClinicalIcon, type ClinicalIconKey } from '../shared/ClinicalIcon';
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
  toOrcaOutcome,
  type DiseaseComponent,
  type DiseaseEntry,
  type DiseaseLayer,
  type DiseaseMasterCandidate,
  type DiseaseUnmatchInformation,
  type DiseaseWarning,
  type OrcaDiseaseMutationOperation,
  type OrcaDiseaseMutationRequest,
  type OrcaDiseaseMutationResult,
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

export type ChartTextDiseaseMention = {
  sectionLabel: string;
  text: string;
  source: 'draft' | 'saved';
};

export type DiagnosisEditPanelProps = {
  patientId?: string;
  meta: DiagnosisEditPanelMeta;
  chartTextDiseaseMentions?: ChartTextDiseaseMention[];
};

type DiagnosisFormState = {
  diagnosisId?: number;
  prefix: string;
  name: string;
  suffix: string;
  code: string;
  components: DiseaseComponent[];
  uncodedAccepted: boolean;
  startDate: string;
  endDate: string;
  outcome: string;
  isMain: boolean;
  isSuspected: boolean;
  receiptPrint: boolean;
  insuranceDisease: boolean;
  diseaseInsuranceClass: '' | '1' | '0' | 'None';
  diseaseCategory: '' | 'PD' | 'None';
  diseaseClass: '' | '03' | '04' | '05' | '07' | '08' | '09' | 'Auto' | 'None';
  receiptPrintPeriod: string;
  dischargeCertificate: '' | '0' | '1' | 'None';
  subDiseaseClass: '' | '01' | '02' | '03' | '04' | '05';
};

type QuickCandidateOption = {
  key: string;
  label: string;
  candidate: DiseaseMasterCandidate;
};

type DiseaseCandidateTarget =
  | 'quick-prefix'
  | 'quick-name'
  | 'quick-suffix'
  | 'form-prefix'
  | 'form-name'
  | 'form-suffix';

type QuickCreateMode = 'main' | 'sub' | 'suspected';

type FormMutationInput = {
  operation: Extract<OrcaDiseaseMutationOperation, 'create' | 'update'>;
  form: DiagnosisFormState;
  sourceEntry?: DiseaseEntry;
};

type OrcaDiseaseInformation = NonNullable<OrcaDiseaseMutationRequest['diseaseInformation']>[number];
type NoticeTone = 'info' | 'success' | 'warning' | 'error';
type MutationReviewSummary = {
  operationStatus?: string;
  apiResult?: string;
  responseClassification?: string;
  warnings: DiseaseWarning[];
  unmatchInformation: DiseaseUnmatchInformation[];
  unmatchInformationOverflow?: string;
};

type PendingAction =
  | { operation: 'create'; title: string; confirmLabel: string; form: DiagnosisFormState; sourceEntry?: DiseaseEntry }
  | { operation: 'update'; title: string; confirmLabel: string; form: DiagnosisFormState; sourceEntry?: DiseaseEntry }
  | { operation: 'delete'; title: string; confirmLabel: string; entry: DiseaseEntry }
  | { operation: 'organizeDeletedDiseases'; title: string; confirmLabel: string };

const QUICK_CANDIDATE_MIN_KEYWORD = 2;
const QUICK_CANDIDATE_MAX_ITEMS = 20;
const ORCA_DISEASE_MIRROR_REFETCH_INTERVAL_MS = 90_000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POST_MUTATION_MIRROR_UNAVAILABLE_MESSAGE =
  'ORCA病名の送信は受け付けられましたが、ORCA病名の再取得が完了していません。ORCA正本を再取得して確認してください。';
const CHART_TEXT_DISEASE_BOUNDARY_NOTE =
  '診療録本文中の病名記載はカルテ本文の正本です。ORCA登録病名へは明示確認後に登録してください。';
const DISEASE_REVIEW_ACTION_NOTE =
  'ORCA再取得結果と未照合病名を確認し、必要なら病名を修正して再送してください。';

const buildEmptyForm = (today: string): DiagnosisFormState => ({
  prefix: '',
  name: '',
  suffix: '',
  code: '',
  components: [],
  uncodedAccepted: false,
  startDate: today,
  endDate: '',
  outcome: '',
  isMain: false,
  isSuspected: false,
  receiptPrint: true,
  insuranceDisease: false,
  diseaseInsuranceClass: '',
  diseaseCategory: '',
  diseaseClass: '',
  receiptPrintPeriod: '',
  dischargeCertificate: '',
  subDiseaseClass: '',
});

const formatOutcomeForForm = (outcome?: string) => {
  switch (outcome) {
    case 'ACTIVE':
    case '継続':
      return '継続中';
    case 'CURED':
    case 'F':
      return '治癒';
    case 'DEATH':
    case 'D':
      return '死亡';
    case 'DISCONTINUED':
    case 'P':
    case 'C':
      return '中止';
    case 'TRANSFERRED':
    case 'S':
      return '移行(ORCA送信保留)';
    default:
      return outcome ?? '';
  }
};

const toFormState = (entry: DiseaseEntry, today: string): DiagnosisFormState => ({
  diagnosisId: entry.diagnosisId,
  prefix: '',
  name: entry.diagnosisName ?? '',
  suffix: '',
  code: entry.diagnosisCode ?? '',
  components: entry.components ?? [],
  uncodedAccepted: false,
  startDate: entry.startDate ?? today,
  endDate: entry.endDate ?? '',
  outcome: formatOutcomeForForm(entry.outcome),
  isMain: entry.category?.includes('主') ?? false,
  isSuspected: entry.suspectedFlag?.includes('疑い') ?? entry.category?.includes('疑い') ?? false,
  receiptPrint: true,
  insuranceDisease: false,
  diseaseInsuranceClass: '',
  diseaseCategory: '',
  diseaseClass: '',
  receiptPrintPeriod: '',
  dischargeCertificate: '',
  subDiseaseClass: '',
});

const resolveDiseaseLayer = (entry: DiseaseEntry): DiseaseLayer => entry.layer ?? 'candidate';
const isLocalCandidateDisease = (entry: DiseaseEntry) => resolveDiseaseLayer(entry) === 'candidate';
const isMainDisease = (entry: DiseaseEntry) => entry.category?.includes('主') ?? false;
const isSuspectedDisease = (entry: DiseaseEntry) => entry.suspectedFlag?.includes('疑い') ?? entry.category?.includes('疑い') ?? false;
const formatEntryName = (entry?: DiseaseEntry | null) => entry?.diagnosisName?.trim() || '名称未設定';
const buildEntryKey = (entry: DiseaseEntry) =>
  `${resolveDiseaseLayer(entry)}:${entry.diagnosisId ?? `${entry.diagnosisName ?? 'unknown'}-${entry.startDate ?? 'na'}`}`;

const formatQuickCandidateLabel = (candidate: DiseaseMasterCandidate) => {
  return candidate.name;
};

const ORCA_DISEASE_BODY_CODE_PATTERN = /^\d{7}$/;

const buildBodyComponent = (code: string, name: string): DiseaseComponent | null => {
  const normalizedCode = code.trim();
  const normalizedName = name.trim();
  if (!ORCA_DISEASE_BODY_CODE_PATTERN.test(normalizedCode) || !normalizedName) {
    return null;
  }
  return {
    seq: 1,
    componentType: 'BODY',
    code: normalizedCode,
    name: normalizedName,
    sourceMaster: 'ORCA disease master',
  };
};

const normalizeFormComponents = (state: DiagnosisFormState): DiseaseComponent[] => {
  if (state.components.length > 0) {
    return state.components.map((component, index) => ({ ...component, seq: index + 1 })).slice(0, 21);
  }
  const component = buildBodyComponent(state.code, state.name);
  return component ? [component] : [];
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

const isValidDiseaseReceiptPrintPeriod = (value: string) => value === 'None' || /^\d{2}$/.test(value);

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
  if (state.outcome.trim() === '移行(ORCA送信保留)') {
    return '移行はORCA送信仕様の確認が完了するまで、この画面からは送信できません。';
  }
  if (state.receiptPrintPeriod.trim() && !isValidDiseaseReceiptPrintPeriod(state.receiptPrintPeriod.trim())) {
    return 'レセプト表示期間は 00-99 または None の ORCA 仕様コードで入力してください。';
  }
  return null;
};

const buildDiseaseInput = (input: FormMutationInput) => {
  const combinedName = `${input.form.prefix ?? ''}${input.form.name ?? ''}${input.form.suffix ?? ''}`.trim();
  return {
    diagnosisId: input.sourceEntry?.diagnosisId ?? input.form.diagnosisId,
    diagnosisName: combinedName,
    diagnosisCode: input.form.code.trim() || undefined,
    components: normalizeFormComponents(input.form),
    departmentCode: input.sourceEntry?.departmentCode,
    insuranceCombinationNumber: input.sourceEntry?.insuranceCombinationNumber,
    startDate: input.form.startDate || undefined,
    endDate: input.form.endDate || undefined,
    outcome: input.form.outcome || undefined,
    category: input.form.isMain ? '主病名' : '副病名',
    suspectedFlag: input.form.isSuspected ? '疑い' : undefined,
  };
};

const resolveMainDiseaseClassCode = (state?: Pick<DiagnosisFormState, 'isMain'> | null) => (state?.isMain ? '01' : undefined);
const resolveSuspectedFlagCode = (state?: Pick<DiagnosisFormState, 'isSuspected'> | null) => (state?.isSuspected ? 'S' : undefined);
const resolveDiseaseReceiptPrintCode = (state?: Pick<DiagnosisFormState, 'receiptPrint'> | null) => (state?.receiptPrint ? '1' : 'None');
const resolveInsuranceDiseaseCode = (state?: Pick<DiagnosisFormState, 'insuranceDisease'> | null) => (state?.insuranceDisease ? '1' : undefined);
const resolveDiseaseInsuranceClassCode = (state?: Pick<DiagnosisFormState, 'diseaseInsuranceClass'> | null) => state?.diseaseInsuranceClass || undefined;
const resolveDiseaseCategoryCode = (state?: Pick<DiagnosisFormState, 'diseaseCategory'> | null) => state?.diseaseCategory || undefined;
const resolveDiseaseClassCode = (state?: Pick<DiagnosisFormState, 'diseaseClass'> | null) => state?.diseaseClass || undefined;
const resolveDiseaseReceiptPrintPeriodCode = (state?: Pick<DiagnosisFormState, 'receiptPrintPeriod'> | null) => state?.receiptPrintPeriod.trim() || undefined;
const resolveDischargeCertificateCode = (state?: Pick<DiagnosisFormState, 'dischargeCertificate'> | null) => state?.dischargeCertificate || undefined;
const resolveSubDiseaseClassCode = (state?: Pick<DiagnosisFormState, 'subDiseaseClass'> | null) => state?.subDiseaseClass || undefined;
const formatInsuranceCombination = (value?: string | null) => value?.trim() || 'server-side確認';
const formatDiseaseAttributeLabel = (state?: Pick<DiagnosisFormState, 'isMain' | 'isSuspected'> | null) => {
  if (!state) return '-';
  const labels = [state.isMain ? '主病名' : '副病名', state.isSuspected ? '疑い' : null].filter(Boolean);
  return labels.join(' / ');
};
const formatDiseaseInsuranceClassLabel = (value?: DiagnosisFormState['diseaseInsuranceClass'] | null) => {
  switch (value) {
    case '1':
      return '保険適用';
    case '0':
      return '保険適用外';
    case 'None':
      return '指定なしコード';
    default:
      return '指定なし';
  }
};
const formatDiseaseCategoryLabel = (value?: DiagnosisFormState['diseaseCategory'] | null) => {
  switch (value) {
    case 'PD':
      return '難病等';
    case 'None':
      return '指定なしコード';
    default:
      return '指定なし';
  }
};
const formatSubDiseaseClassLabel = (value?: DiagnosisFormState['subDiseaseClass'] | null) => {
  switch (value) {
    case '01':
      return '原疾患';
    case '02':
      return '合併症';
    case '03':
      return '続発症';
    case '04':
      return '関連病名';
    case '05':
      return 'その他';
    default:
      return '指定なし';
  }
};

const isReviewOperationStatus = (status?: string | null) => status === 'ORCA_WARNING' || status === 'ORCA_UNMATCHED' || status === 'NEEDS_REVIEW';

const buildMutationReviewSummary = (result: OrcaDiseaseMutationResult): MutationReviewSummary | null => {
  const warnings = result.warnings ?? [];
  const unmatchInformation = result.unmatchInformation ?? [];
  if (!result.needsUserReview && !isReviewOperationStatus(result.operationStatus) && warnings.length === 0 && unmatchInformation.length === 0) {
    return null;
  }
  return {
    operationStatus: result.operationStatus,
    apiResult: result.apiResult,
    responseClassification: result.responseClassification,
    warnings,
    unmatchInformation,
    unmatchInformationOverflow: result.unmatchInformationOverflow,
  };
};

const formatDiseaseWarning = (warning: DiseaseWarning, index: number) => {
  const parts = [
    warning.code ? `code=${warning.code}` : null,
    warning.messageCategory ? `分類=${warning.messageCategory}` : null,
    typeof warning.position === 'number' ? `位置=${warning.position}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : `警告 ${index + 1}`;
};

const formatDiseaseUnmatch = (unmatch: DiseaseUnmatchInformation, index: number) => {
  const parts = [
    unmatch.code ? `code=${unmatch.code}` : null,
    unmatch.name ? `病名=${unmatch.name}` : null,
    unmatch.supplementName ? `補足=${unmatch.supplementName}` : null,
    unmatch.inOut ? `入外=${unmatch.inOut}` : null,
    unmatch.category ? `区分=${unmatch.category}` : null,
    unmatch.suspectedFlag ? `疑い=${unmatch.suspectedFlag}` : null,
    unmatch.startDate ? `開始=${unmatch.startDate}` : null,
    unmatch.endDate ? `転帰日=${unmatch.endDate}` : null,
    unmatch.outcome ? `転帰=${unmatch.outcome}` : null,
    unmatch.messageCategory ? `分類=${unmatch.messageCategory}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : `未照合病名 ${index + 1}`;
};

const toOrcaDiseaseInformation = (entry: DiseaseEntry): OrcaDiseaseInformation => {
  const outcome = toOrcaOutcome(entry.outcome);
  return {
    diseaseCode: entry.diagnosisCode,
    diseaseName: entry.diagnosisName,
    displayName: entry.displayName ?? entry.diagnosisName,
    karteName: entry.karteName,
    diseaseStartDate: entry.startDate,
    diseaseEndDate: entry.endDate,
    diseaseInOut: 'O',
    diseaseSuspectedFlag: isSuspectedDisease(entry) ? 'S' : undefined,
    diseaseOutCome: outcome.sendCode,
    outcome: outcome.outcome,
    orcaOutcomeSendCode: outcome.sendCode,
    mainDiseaseClass: isMainDisease(entry) ? '01' : undefined,
    diseaseReceiptPrint: '1',
    components: entry.components,
    supplements: entry.supplements,
    insuranceCombinationNumber: entry.insuranceCombinationNumber,
  };
};

function DiseaseRow({
  entry,
  actions,
}: {
  entry: DiseaseEntry;
  actions?: ReactNode;
}) {
  const isMain = isMainDisease(entry);
  const isSuspected = isSuspectedDisease(entry);
  const hasDiagnosisCode = Boolean(entry.diagnosisCode?.trim());
  const hasOutcome = Boolean(entry.outcome?.trim());
  const hasEnded = Boolean(entry.endDate?.trim());
  const isCandidate = isLocalCandidateDisease(entry);
  const hasAttributes = isMain || isSuspected || !hasDiagnosisCode || isCandidate;

  return (
    <tr className="charts-diagnosis__row">
      <th scope="row" className="charts-diagnosis__cell charts-diagnosis__cell--name">
        <span className="charts-diagnosis__name">{formatEntryName(entry)}</span>
        {isCandidate ? <span className="charts-diagnosis__subvalue">ORCA未登録の送信候補</span> : null}
      </th>
      <td className="charts-diagnosis__cell charts-diagnosis__cell--attrs">
        {hasAttributes ? (
          <span className="charts-diagnosis__badges" role="list" aria-label="病名属性">
            {isMain ? (
              <span className="charts-diagnosis__badge charts-diagnosis__badge--main" role="listitem">
                主
              </span>
            ) : null}
            {isSuspected ? (
              <span className="charts-diagnosis__badge charts-diagnosis__badge--suspected" role="listitem">
                疑い
              </span>
            ) : null}
            {!hasDiagnosisCode ? (
              <span className="charts-diagnosis__code-state charts-diagnosis__code-state--warn" role="listitem">
                コード未設定
              </span>
            ) : null}
            {isCandidate ? (
              <span className="charts-diagnosis__badge" role="listitem">
                候補
              </span>
            ) : null}
          </span>
        ) : null}
      </td>
      <td className="charts-diagnosis__cell charts-diagnosis__cell--date">{entry.startDate ? entry.startDate : '-'}</td>
      <td className="charts-diagnosis__cell charts-diagnosis__cell--outcome">
        {hasOutcome ? <span>{formatOutcomeForForm(entry.outcome)}</span> : null}
        {hasEnded ? <span className="charts-diagnosis__subvalue">終了 {entry.endDate}</span> : null}
      </td>
      <td className="charts-diagnosis__cell charts-diagnosis__cell--actions">
        {actions ? (
          <div className="charts-side-panel__item-actions charts-diagnosis__item-actions" role="group" aria-label={`${formatEntryName(entry)}の病名操作`}>
            {actions}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function DiseaseTable({
  entries,
  ariaLabel,
  actions,
}: {
  entries: DiseaseEntry[];
  ariaLabel: string;
  actions?: (entry: DiseaseEntry) => ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="charts-diagnosis__table-wrap">
      <table className="charts-diagnosis__table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th scope="col">病名</th>
            <th scope="col">属性</th>
            <th scope="col">開始</th>
            <th scope="col">転帰</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <DiseaseRow key={buildEntryKey(entry)} entry={entry} actions={actions?.(entry)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiagnosisIconActionButton({
  label,
  icon,
  tone = 'default',
  onClick,
  isDisabled,
}: {
  label: string;
  icon: ClinicalIconKey;
  tone?: 'default' | 'danger' | 'send';
  onClick: () => void;
  isDisabled?: boolean;
}) {
  const toneClass = tone === 'default' ? '' : ` charts-diagnosis__action-button--${tone}`;
  return (
    <button
      type="button"
      className={`charts-diagnosis__action-button${toneClass}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={isDisabled}
    >
      <ClinicalIcon icon={icon} className="charts-diagnosis__action-icon" />
    </button>
  );
}

export function DiagnosisEditPanel({ patientId, meta, chartTextDiseaseMentions = [] }: DiagnosisEditPanelProps) {
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState<DiagnosisFormState>(() => buildEmptyForm(today));
  const [editingEntry, setEditingEntry] = useState<DiseaseEntry | undefined>();
  const [quickAdd, setQuickAdd] = useState({
    prefix: '',
    name: '',
    suffix: '',
    code: '',
    startDate: today,
  });
  const [candidateSelection, setCandidateSelection] = useState('');
  const [candidateKeyword, setCandidateKeyword] = useState('');
  const [activeCandidateTarget, setActiveCandidateTarget] = useState<DiseaseCandidateTarget | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [mutationReview, setMutationReview] = useState<MutationReviewSummary | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

  const diagnosisBaseMonth = meta.visitDate?.slice(0, 7).replace('-', '');
  const queryKey = ['charts-diagnosis', patientId, diagnosisBaseMonth, meta.visitDate];
  const diagnosisQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!patientId) throw new Error('patientId is required');
      return fetchDiseases({ patientId, to: meta.visitDate, baseMonth: diagnosisBaseMonth });
    },
    enabled: !!patientId,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: isEditorOpen || pendingAction ? false : ORCA_DISEASE_MIRROR_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const list = useMemo(() => diagnosisQuery.data?.diseases ?? [], [diagnosisQuery.data?.diseases]);
  const chartTextMentions = useMemo(
    () =>
      chartTextDiseaseMentions
        .map((mention) => ({
          ...mention,
          sectionLabel: mention.sectionLabel.trim(),
          text: mention.text.trim(),
        }))
        .filter((mention) => mention.sectionLabel && mention.text)
        .slice(0, 5),
    [chartTextDiseaseMentions],
  );
  const mirrorList = useMemo(() => list.filter((entry) => resolveDiseaseLayer(entry) === 'orca-mirror'), [list]);
  const pendingLocalList = useMemo(() => {
    const pendingLocalDiseases = diagnosisQuery.data?.pendingLocalDiseases;
    if (Array.isArray(pendingLocalDiseases) && pendingLocalDiseases.length > 0) {
      return pendingLocalDiseases.filter((entry) => isLocalCandidateDisease(entry));
    }
    return list.filter((entry) => isLocalCandidateDisease(entry));
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
  const mutationBlockReasonText = mutationBlockReasons.join(' / ');
  const showMutationBlockedNotice = () => {
    if (mutationBlockReasons.length === 0) return false;
    setNotice({
      tone: 'warning',
      message: `ORCA病名操作を停止: ${mutationBlockReasonText}`,
    });
    return true;
  };

  const resolveCandidateTargetValue = (target: DiseaseCandidateTarget | null) => {
    switch (target) {
      case 'quick-prefix':
        return quickAdd.prefix;
      case 'quick-name':
        return quickAdd.name;
      case 'quick-suffix':
        return quickAdd.suffix;
      case 'form-prefix':
        return form.prefix;
      case 'form-name':
        return form.name;
      case 'form-suffix':
        return form.suffix;
      default:
        return '';
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setCandidateKeyword(resolveCandidateTargetValue(activeCandidateTarget).trim());
    }, 220);
    return () => window.clearTimeout(handle);
  }, [activeCandidateTarget, form.name, form.prefix, form.suffix, quickAdd.name, quickAdd.prefix, quickAdd.suffix]);

  const quickCandidateQuery = useQuery({
    queryKey: ['charts-diagnosis-master-candidates', candidateKeyword, quickAdd.startDate, form.startDate],
    queryFn: () =>
      searchDiseaseMasterCandidates({
        keyword: candidateKeyword,
        referenceDate: activeCandidateTarget?.startsWith('form') ? form.startDate || today : quickAdd.startDate || today,
        limit: QUICK_CANDIDATE_MAX_ITEMS,
      }),
    enabled: !isOrcaMutationBlocked && Boolean(activeCandidateTarget) && candidateKeyword.length >= QUICK_CANDIDATE_MIN_KEYWORD,
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
    if (candidateSelection && !quickCandidateMap.has(candidateSelection)) {
      setCandidateSelection('');
    }
  }, [candidateSelection, quickCandidateMap]);

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
    const input = document.getElementById('diagnosis-name');
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }, [isEditorOpen, form.diagnosisId]);

  const applyPostMutationMirror = (result: OrcaDiseaseMutationResult) => {
    if (result.postMutationMirrorStatus === 'connected' && result.postMutationMirror) {
      queryClient.setQueryData(queryKey, result.postMutationMirror);
      return true;
    }
    if (result.ok && result.postMutationMirrorStatus !== 'unavailable') {
      queryClient.invalidateQueries({ queryKey });
    }
    return false;
  };

  const resolveMutationNotice = (result: OrcaDiseaseMutationResult, successMessage: string, fallbackFailureMessage: string) => {
    if (result.postMutationMirrorStatus === 'unavailable') {
      return {
        tone: 'warning' as const,
        message: result.message ?? POST_MUTATION_MIRROR_UNAVAILABLE_MESSAGE,
      };
    }
    if (result.ok) {
      return {
        tone: 'success' as const,
        message: successMessage,
      };
    }
    if (result.businessAccepted && (result.needsUserReview || result.operationStatus === 'NEEDS_REVIEW')) {
      return {
        tone: 'warning' as const,
        message: result.message ?? 'ORCA病名の処理結果に確認が必要です。警告または不一致を確認してください。',
      };
    }
    return {
      tone: 'error' as const,
      message: result.message ?? fallbackFailureMessage,
    };
  };

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
      const resolvedComponents = normalizeFormComponents({
        ...input.form,
        code: resolvedCode ?? input.form.code,
      });
      if (resolvedComponents.length === 0 && !input.form.uncodedAccepted) {
        throw new Error('ORCA病名登録には病名マスター候補から選択した構成コードが必要です。');
      }
      if (!meta.visitDate) {
        throw new Error('ORCA病名登録には診療日が必要です。');
      }
      if (!meta.departmentCode) {
        throw new Error('ORCA病名登録には診療科コードが必要です。');
      }
      const disease = buildDiseaseInput(input);
      const outcome = toOrcaOutcome(disease.outcome);
      return mutateOrcaDisease({
        patientId,
        operation: input.operation,
        performDate: meta.visitDate,
        departmentCode: meta.departmentCode,
        diseaseInformation: [
          {
            diseaseCode: resolvedCode,
            diseaseName: disease.diagnosisName,
            displayName: disease.diagnosisName,
            diseaseStartDate: disease.startDate,
            diseaseEndDate: disease.endDate,
            diseaseInOut: 'O',
            diseaseSuspectedFlag: resolveSuspectedFlagCode(input.form),
            diseaseOutCome: outcome.sendCode,
            outcome: outcome.outcome,
            orcaOutcomeSendCode: outcome.sendCode,
            diseaseInsuranceClass: resolveDiseaseInsuranceClassCode(input.form),
            diseaseCategory: resolveDiseaseCategoryCode(input.form),
            diseaseClass: resolveDiseaseClassCode(input.form),
            mainDiseaseClass: resolveMainDiseaseClassCode(input.form),
            diseaseReceiptPrint: resolveDiseaseReceiptPrintCode(input.form),
            diseaseReceiptPrintPeriod: resolveDiseaseReceiptPrintPeriodCode(input.form),
            insuranceDisease: resolveInsuranceDiseaseCode(input.form),
            dischargeCertificate: resolveDischargeCertificateCode(input.form),
            subDiseaseClass: resolveSubDiseaseClassCode(input.form),
            components: resolvedComponents,
            supplements: [],
            uncodedAccepted: input.form.uncodedAccepted,
            insuranceCombinationNumber: meta.insuranceCombinationNumber ?? disease.insuranceCombinationNumber,
          },
        ],
        targetDisease: input.operation === 'update' && input.sourceEntry ? toOrcaDiseaseInformation(input.sourceEntry) : undefined,
      });
    },
    onSuccess: (result, input) => {
      const failureMessage = result.message ?? 'ORCA病名の処理に失敗しました。';
      const didApplyMirror = applyPostMutationMirror(result);
      const notice = resolveMutationNotice(
        result,
        didApplyMirror ? 'ORCA病名を処理しました。ORCA再取得結果で同期確認しました。' : 'ORCA病名を処理しました。ORCA再取得結果を確認中です。',
        failureMessage,
      );
      setNotice(notice);
      setMutationReview(buildMutationReviewSummary(result));
      setPendingAction(null);
      setIsEditorOpen(false);
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
        setForm(buildEmptyForm(today));
        setEditingEntry(undefined);
        setQuickAdd({ prefix: '', name: '', suffix: '', code: '', startDate: today });
        setCandidateSelection('');
        setActiveCandidateTarget(null);
      }
    },
    onError: (error: unknown, input) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `ORCA病名の処理に失敗しました: ${message}` });
      setMutationReview(null);
      setPendingAction(null);
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
      const didApplyMirror = applyPostMutationMirror(result);
      setNotice(
        resolveMutationNotice(
          result,
          didApplyMirror ? 'ORCA病名を削除しました。ORCA再取得結果で同期確認しました。' : 'ORCA病名を削除しました。ORCA再取得結果を確認中です。',
          failureMessage,
        ),
      );
      setMutationReview(buildMutationReviewSummary(result));
      setPendingAction(null);
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
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `ORCA病名の削除に失敗しました: ${message}` });
      setMutationReview(null);
      setPendingAction(null);
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
      const didApplyMirror = applyPostMutationMirror(result);
      setNotice(
        resolveMutationNotice(
          result,
          didApplyMirror ? '削除病名を整理しました。ORCA再取得結果で同期確認しました。' : '削除病名を整理しました。ORCA再取得結果を確認中です。',
          failureMessage,
        ),
      );
      setMutationReview(buildMutationReviewSummary(result));
      setPendingAction(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `削除病名の整理に失敗しました: ${message}` });
      setMutationReview(null);
      setPendingAction(null);
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
      addNote('ORCA未登録の送信候補があります。ORCAへ登録するまで主一覧には表示しません。');
    }
    if (list.some((entry) => entry.syncState === 'manual-resolution')) {
      addNote(DISEASE_MANUAL_RESOLUTION_NOTE);
    }
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

  const openEdit = (entry: DiseaseEntry) => {
    setEditingEntry(entry);
    setForm(toFormState(entry, today));
    setNotice(null);
    setMutationReview(null);
    setIsEditorOpen(true);
  };

  const requestFormMutation = (operation: Extract<OrcaDiseaseMutationOperation, 'create' | 'update'>, nextForm: DiagnosisFormState, sourceEntry?: DiseaseEntry) => {
    if (showMutationBlockedNotice()) return;
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

  const applyCandidate = (target: DiseaseCandidateTarget, optionKey: string) => {
    setCandidateSelection(optionKey);
    if (!optionKey) return;
    const option = quickCandidateMap.get(optionKey);
    if (!option) return;
    const selectedCode = option.candidate.code?.trim() || '';
    const component = buildBodyComponent(selectedCode, option.candidate.name);
    if (target === 'quick-prefix') {
      setQuickAdd((prev) => ({ ...prev, prefix: option.candidate.name }));
    } else if (target === 'quick-name') {
      setQuickAdd((prev) => ({ ...prev, name: option.candidate.name, code: selectedCode || prev.code }));
    } else if (target === 'quick-suffix') {
      setQuickAdd((prev) => ({ ...prev, suffix: option.candidate.name }));
    } else if (target === 'form-prefix') {
      setForm((prev) => ({ ...prev, prefix: option.candidate.name }));
    } else if (target === 'form-name') {
      setForm((prev) => ({
        ...prev,
        name: option.candidate.name,
        code: selectedCode || prev.code,
        components: component ? [component] : prev.components,
        uncodedAccepted: false,
      }));
    } else if (target === 'form-suffix') {
      setForm((prev) => ({ ...prev, suffix: option.candidate.name }));
    }
    setActiveCandidateTarget(null);
    setNotice({ tone: 'info', message: `候補「${option.candidate.name}」を反映しました。コードに紐づく病名です。` });
  };

  const requestQuickCreate = (mode: QuickCreateMode) => {
    if (showMutationBlockedNotice()) return;
    const title =
      mode === 'main'
        ? '主病名として登録'
        : mode === 'suspected'
          ? '疑い病名として登録'
          : '副病名として登録';
    const nextForm: DiagnosisFormState = {
      ...buildEmptyForm(today),
      prefix: quickAdd.prefix.trim(),
      name: quickAdd.name.trim(),
      suffix: quickAdd.suffix.trim(),
      code: quickAdd.code.trim(),
      components: (() => {
        const component = buildBodyComponent(quickAdd.code.trim(), quickAdd.name.trim());
        return component ? [component] : [];
      })(),
      startDate: quickAdd.startDate || today,
      isMain: mode === 'main',
      isSuspected: mode === 'suspected',
    };
    const validationMessage = validateDiagnosisForm(nextForm);
    if (validationMessage) {
      setNotice({ tone: 'error', message: validationMessage });
      return;
    }
    setPendingAction({
      operation: 'create',
      title,
      confirmLabel: title,
      form: nextForm,
    });
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (showMutationBlockedNotice()) return;
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

  const renderDiseaseCandidateField = ({
    id,
    label,
    value,
    target,
    onValueChange,
    required = false,
    disabled = false,
  }: {
    id: string;
    label: string;
    value: string;
    target: DiseaseCandidateTarget;
    onValueChange: (value: string) => void;
    required?: boolean;
    disabled?: boolean;
  }) => {
    const isActive = activeCandidateTarget === target;
    const hasMenu = isActive && quickCandidateOptions.length > 0;
    const isSearching = isActive && quickCandidateQuery.isFetching;
    const showNoMatch = isActive && !isSearching && value.trim().length >= QUICK_CANDIDATE_MIN_KEYWORD && quickCandidateOptions.length === 0;
    const listId = `${id}-candidate-list`;
    return (
      <div className="charts-side-panel__field">
        <label htmlFor={id}>{label}</label>
        <div className="charts-diagnosis__quick-namebox">
          <input
            id={id}
            value={value}
            onChange={(event) => {
              setCandidateSelection('');
              setActiveCandidateTarget(target);
              onValueChange(event.target.value);
            }}
            onFocus={() => setActiveCandidateTarget(target)}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={hasMenu}
            aria-controls={listId}
            required={required}
            disabled={disabled}
          />
          {hasMenu ? (
            <div id={listId} className="charts-diagnosis__quick-candidate-menu" role="listbox" aria-label={`${label}候補`}>
              {quickCandidateOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="option"
                  aria-selected={candidateSelection === option.key}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyCandidate(target, option.key)}
                  disabled={disabled}
                >
                  <span>{option.label}</span>
                  <span className="charts-diagnosis__quick-candidate-state">候補</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {isSearching ? <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help">候補を検索中...</p> : null}
        {showNoMatch ? <p className="charts-side-panel__help charts-diagnosis__quick-candidate-help">一致する候補はありません。</p> : null}
      </div>
    );
  };

  const pendingForm = pendingAction && 'form' in pendingAction ? pendingAction.form : null;
  const pendingEntry = pendingAction && 'entry' in pendingAction ? pendingAction.entry : pendingAction && 'sourceEntry' in pendingAction ? pendingAction.sourceEntry : null;
  const organizeNativeDisabled = isDiseaseMirrorPending || isAnyMutationPending;
  const mirrorStatusLabel = diagnosisQuery.isFetching ? '取得中' : isMirrorConnected ? `${mirrorList.length}件` : '未確認';

  return (
    <section className="charts-side-panel__section charts-diagnosis-panel" data-testid="diagnosis-edit-panel" data-test-id="diagnosis-edit-panel">
      <header className="charts-side-panel__section-header">
        <div className="charts-diagnosis__title-block">
          <div className="charts-diagnosis__title-row">
            <strong>ORCA登録病名</strong>
            <span className="charts-diagnosis__count-badge">{mirrorStatusLabel}</span>
          </div>
        </div>
        <div className="charts-diagnosis__header-actions" role="group" aria-label="病名操作">
          <button
            type="button"
            className="charts-side-panel__ghost charts-diagnosis__organize-button"
            onClick={() => {
              if (showMutationBlockedNotice()) return;
              setPendingAction({
                operation: 'organizeDeletedDiseases',
                title: '削除病名を整理',
                confirmLabel: '削除病名を整理',
              });
            }}
            disabled={organizeNativeDisabled}
            aria-disabled={isOrcaMutationBlocked}
            aria-describedby={mutationBlockReasons.length > 0 ? 'diagnosis-mutation-block-reason' : undefined}
            data-disabled-reason={mutationBlockReasons.length > 0 ? 'orca_disease_mutation_blocked' : undefined}
            title={mutationBlockReasons.length > 0 ? mutationBlockReasonText : undefined}
          >
            削除病名を整理
          </button>
        </div>
      </header>

      {isDiseaseMirrorPending ? (
        <div id="diagnosis-mutation-block-reason" className="charts-side-panel__notice charts-side-panel__notice--info">
          ORCA登録病名を確認中です。確認完了まで病名操作は待機します。
        </div>
      ) : mutationBlockReasons.length > 0 ? (
        <div id="diagnosis-mutation-block-reason" className="charts-side-panel__notice charts-side-panel__notice--info">
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
      {mutationReview ? (
        <section className="charts-side-panel__notice charts-side-panel__notice--warning" aria-label="ORCA病名送信の要確認">
          <div>
            <strong>ORCA病名送信の要確認</strong>
          </div>
          <p>
            ORCAから警告または不一致が返りました。{DISEASE_REVIEW_ACTION_NOTE}
          </p>
          <dl className="charts-diagnosis__confirm">
            <div>
              <dt>連携状態</dt>
              <dd>{mutationReview.operationStatus ?? 'NEEDS_REVIEW'}</dd>
            </div>
            <div>
              <dt>ORCA結果</dt>
              <dd>{mutationReview.apiResult ?? '未通知'}</dd>
            </div>
            {mutationReview.responseClassification ? (
              <div>
                <dt>分類</dt>
                <dd>{mutationReview.responseClassification}</dd>
              </div>
            ) : null}
            {mutationReview.unmatchInformationOverflow ? (
              <div>
                <dt>不一致情報の超過</dt>
                <dd>{mutationReview.unmatchInformationOverflow}</dd>
              </div>
            ) : null}
          </dl>
          {mutationReview.warnings.length > 0 ? (
            <div>
              <strong>ORCA警告</strong>
              <ul className="charts-diagnosis__unblock">
                {mutationReview.warnings.map((warning, index) => (
                  <li key={`warning-${warning.code ?? index}`}>{formatDiseaseWarning(warning, index)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {mutationReview.unmatchInformation.length > 0 ? (
            <div>
              <strong>ORCA側のみ存在する未照合病名</strong>
              <ul className="charts-diagnosis__unblock">
                {mutationReview.unmatchInformation.map((unmatch, index) => (
                  <li key={`unmatch-${unmatch.code ?? index}`}>{formatDiseaseUnmatch(unmatch, index)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {chartTextMentions.length > 0 ? (
        <section className="charts-diagnosis__quick-add" aria-label="診療録本文中の病名記載">
          <div className="charts-side-panel__subheader">
            <strong>診療録本文中の病名記載</strong>
            <span className="charts-side-panel__help">{chartTextMentions.length}件 / ORCA登録病名ではありません</span>
          </div>
          <div className="charts-side-panel__notice charts-side-panel__notice--info">{CHART_TEXT_DISEASE_BOUNDARY_NOTE}</div>
          <ul className="charts-diagnosis__unblock">
            {chartTextMentions.map((mention, index) => (
              <li key={`${mention.sectionLabel}-${mention.source}-${index}`}>
                <strong>{mention.sectionLabel}</strong>
                <span className="charts-side-panel__help"> {mention.source === 'draft' ? '編集中' : '保存済み'}</span>
                <div>{mention.text}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="charts-diagnosis__quick-add charts-diagnosis__quick-add--authoring" aria-label="ORCAへ病名登録">
        <summary className="charts-diagnosis__quick-summary">
          <span>ORCAへ病名登録</span>
          <span className="charts-side-panel__help">{DISEASE_CANDIDATE_CONFIRM_NOTE}</span>
        </summary>
        <div className="charts-diagnosis__quick-body">
          <div className="charts-diagnosis__name-row">
            {renderDiseaseCandidateField({
              id: 'diagnosis-quick-prefix',
              label: '接頭',
              value: quickAdd.prefix,
              target: 'quick-prefix',
              onValueChange: (value) => setQuickAdd((prev) => ({ ...prev, prefix: value })),
              disabled: isOrcaMutationBlocked || isAnyMutationPending,
            })}
            {renderDiseaseCandidateField({
              id: 'diagnosis-quick-name',
              label: '病名 *',
              value: quickAdd.name,
              target: 'quick-name',
              onValueChange: (value) => setQuickAdd((prev) => ({ ...prev, name: value, code: '' })),
              required: true,
              disabled: isOrcaMutationBlocked || isAnyMutationPending,
            })}
            {renderDiseaseCandidateField({
              id: 'diagnosis-quick-suffix',
              label: '接尾',
              value: quickAdd.suffix,
              target: 'quick-suffix',
              onValueChange: (value) => setQuickAdd((prev) => ({ ...prev, suffix: value })),
              disabled: isOrcaMutationBlocked || isAnyMutationPending,
            })}
          </div>
          <div className="charts-diagnosis__quick-grid charts-diagnosis__quick-grid--single">
            <div className="charts-side-panel__field">
              <label htmlFor="diagnosis-quick-start">開始日 ※必須</label>
              <input
                id="diagnosis-quick-start"
                type="date"
                value={quickAdd.startDate}
                onChange={(event) => {
                  setCandidateSelection('');
                  setQuickAdd((prev) => ({ ...prev, startDate: event.target.value }));
                }}
                disabled={isOrcaMutationBlocked || isAnyMutationPending}
              />
            </div>
          </div>
          <div className="charts-diagnosis__quick-actions" aria-label="病名登録種別">
            <button
              type="button"
              disabled={isDiseaseMirrorPending || isAnyMutationPending}
              aria-disabled={isOrcaMutationBlocked}
              aria-describedby={mutationBlockReasons.length > 0 ? 'diagnosis-mutation-block-reason' : undefined}
              data-disabled-reason={mutationBlockReasons.length > 0 ? 'orca_disease_mutation_blocked' : undefined}
              onClick={() => requestQuickCreate('main')}
            >
              主病名として登録
            </button>
            <button
              type="button"
              disabled={isDiseaseMirrorPending || isAnyMutationPending}
              aria-disabled={isOrcaMutationBlocked}
              aria-describedby={mutationBlockReasons.length > 0 ? 'diagnosis-mutation-block-reason' : undefined}
              data-disabled-reason={mutationBlockReasons.length > 0 ? 'orca_disease_mutation_blocked' : undefined}
              onClick={() => requestQuickCreate('sub')}
            >
              副病名として登録
            </button>
            <button
              type="button"
              disabled={isDiseaseMirrorPending || isAnyMutationPending}
              aria-disabled={isOrcaMutationBlocked}
              aria-describedby={mutationBlockReasons.length > 0 ? 'diagnosis-mutation-block-reason' : undefined}
              data-disabled-reason={mutationBlockReasons.length > 0 ? 'orca_disease_mutation_blocked' : undefined}
              onClick={() => requestQuickCreate('suspected')}
            >
              疑い病名として登録
            </button>
          </div>
        </div>
      </details>

      <section className="charts-diagnosis__quick-add" aria-label="ORCA登録病名">
        <div className="charts-side-panel__subheader">
          <strong>活動中の病名</strong>
          <span className="charts-side-panel__help">{mirrorStatusLabel}</span>
        </div>
        {diagnosisQuery.isError ? <p className="charts-side-panel__empty">病名の取得に失敗しました。</p> : null}
        {mirrorList.length === 0 && !diagnosisQuery.isFetching && !diagnosisQuery.isError && diagnosisQuery.data ? (
          <p className="charts-side-panel__empty">{isMirrorConnected ? DISEASE_MIRROR_EMPTY_NOTE : DISEASE_MIRROR_UNAVAILABLE_NOTE}</p>
        ) : null}
        {mirrorList.length > 0 ? (
          <>
            <DiseaseTable
              entries={activeMirrorList}
              ariaLabel="ORCA登録病名（活動中）"
              actions={(entry) => (
                <>
                  <DiagnosisIconActionButton
                    label="編集"
                    icon="draft-clinical"
                    onClick={() => openEdit(entry)}
                    isDisabled={isOrcaMutationBlocked || isAnyMutationPending}
                  />
                  <DiagnosisIconActionButton
                    label="削除"
                    icon="accept-cancel"
                    tone="danger"
                    onClick={() =>
                      setPendingAction({
                        operation: 'delete',
                        title: 'ORCA病名を削除',
                        confirmLabel: 'ORCA病名を削除',
                        entry,
                      })
                    }
                    isDisabled={isOrcaMutationBlocked || isAnyMutationPending}
                  />
                </>
              )}
            />
            {endedMirrorList.length > 0 ? (
              <details className="charts-diagnosis__ended">
                <summary className="charts-diagnosis__ended-summary">転帰あり（{endedMirrorList.length}件）</summary>
                <DiseaseTable
                  entries={endedMirrorList}
                  ariaLabel="ORCA登録病名（転帰あり）"
                  actions={(entry) => (
                    <>
                      <DiagnosisIconActionButton
                        label="編集"
                        icon="draft-clinical"
                        onClick={() => openEdit(entry)}
                        isDisabled={isOrcaMutationBlocked || isAnyMutationPending}
                      />
                      <DiagnosisIconActionButton
                        label="削除"
                        icon="accept-cancel"
                        tone="danger"
                        onClick={() =>
                          setPendingAction({
                            operation: 'delete',
                            title: 'ORCA病名を削除',
                            confirmLabel: 'ORCA病名を削除',
                            entry,
                          })
                        }
                        isDisabled={isOrcaMutationBlocked || isAnyMutationPending}
                      />
                    </>
                  )}
                />
              </details>
            ) : null}
          </>
        ) : null}
      </section>

      {pendingLocalList.length > 0 ? (
        <section className="charts-diagnosis__quick-add" aria-label="ORCA未登録の送信候補">
          <div className="charts-side-panel__subheader">
            <strong>送信候補</strong>
            <span className="charts-side-panel__help">{pendingLocalList.length}件 / ORCA登録済みではありません</span>
          </div>
          <div className="charts-side-panel__notice charts-side-panel__notice--info">
            local候補はORCA未登録です。明示確認後に diseasev3 へ送信し、再取得できるまでORCA登録病名には表示しません。
          </div>
          <DiseaseTable
            entries={pendingLocalList}
            ariaLabel="ORCA未登録の送信候補"
            actions={(entry) => (
              <DiagnosisIconActionButton
                label="ORCAへ登録"
                icon="orca-send"
                tone="send"
                onClick={() => requestFormMutation('create', toFormState(entry, today), entry)}
                isDisabled={isOrcaMutationBlocked || isAnyMutationPending}
              />
            )}
          />
        </section>
      ) : null}

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
            {renderDiseaseCandidateField({
              id: 'diagnosis-prefix',
              label: '接頭',
              value: form.prefix,
              target: 'form-prefix',
              onValueChange: (value) => setForm((prev) => ({ ...prev, prefix: value })),
              disabled: isOrcaMutationBlocked,
            })}
            {renderDiseaseCandidateField({
              id: 'diagnosis-name',
              label: '病名 *',
              value: form.name,
              target: 'form-name',
              onValueChange: (nextName) =>
                setForm((prev) => {
                  const component = buildBodyComponent(prev.code, nextName);
                  return { ...prev, name: nextName, components: component ? [component] : [] };
                }),
              required: true,
              disabled: isOrcaMutationBlocked,
            })}
            {renderDiseaseCandidateField({
              id: 'diagnosis-suffix',
              label: '接尾',
              value: form.suffix,
              target: 'form-suffix',
              onValueChange: (value) => setForm((prev) => ({ ...prev, suffix: value })),
              disabled: isOrcaMutationBlocked,
            })}
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
          <div className="charts-side-panel__field-row">
            <label className="charts-side-panel__toggle">
              <input type="checkbox" checked={form.receiptPrint} onChange={(event) => setForm((prev) => ({ ...prev, receiptPrint: event.target.checked }))} disabled={isOrcaMutationBlocked} />
              レセプト表示
            </label>
            <label className="charts-side-panel__toggle">
              <input type="checkbox" checked={form.insuranceDisease} onChange={(event) => setForm((prev) => ({ ...prev, insuranceDisease: event.target.checked }))} disabled={isOrcaMutationBlocked} />
              保険病名
            </label>
          </div>
          <details className="charts-diagnosis__advanced">
            <summary className="charts-diagnosis__advanced-summary">詳細（開始/転帰/保険病名）</summary>
            <div className="charts-side-panel__field">
              <label htmlFor="diagnosis-sub-disease-class">副病名区分 ※任意</label>
              <select
                id="diagnosis-sub-disease-class"
                value={form.subDiseaseClass}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    subDiseaseClass: event.target.value as DiagnosisFormState['subDiseaseClass'],
                  }))
                }
                disabled={isOrcaMutationBlocked}
              >
                <option value="">指定しない</option>
                <option value="01">原疾患</option>
                <option value="02">合併症</option>
                <option value="03">続発症</option>
                <option value="04">関連病名</option>
                <option value="05">その他</option>
              </select>
              <p className="charts-side-panel__help">
                確認画面では表示名と ORCA 仕様コードを分けて表示します。
              </p>
            </div>
            <div className="charts-side-panel__field-row">
              <div className="charts-side-panel__field">
                <label htmlFor="diagnosis-disease-insurance-class">病名保険区分 ※任意</label>
                <select
                  id="diagnosis-disease-insurance-class"
                  value={form.diseaseInsuranceClass}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      diseaseInsuranceClass: event.target.value as DiagnosisFormState['diseaseInsuranceClass'],
                    }))
                  }
                  disabled={isOrcaMutationBlocked}
                >
                  <option value="">指定しない</option>
                  <option value="1">保険適用</option>
                  <option value="0">保険適用外</option>
                  <option value="None">指定なしコード</option>
                </select>
                <p className="charts-side-panel__help">Disease_Insurance_Class は 1、0、None だけを送信します。</p>
              </div>
              <div className="charts-side-panel__field">
                <label htmlFor="diagnosis-disease-category">病名カテゴリ ※任意</label>
                <select
                  id="diagnosis-disease-category"
                  value={form.diseaseCategory}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      diseaseCategory: event.target.value as DiagnosisFormState['diseaseCategory'],
                    }))
                  }
                  disabled={isOrcaMutationBlocked}
                >
                  <option value="">指定しない</option>
                  <option value="PD">難病等</option>
                  <option value="None">指定なしコード</option>
                </select>
                <p className="charts-side-panel__help">Disease_Category は PD または None だけを送信します。</p>
              </div>
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
              <select id="diagnosis-outcome" value={form.outcome} onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))} disabled={isOrcaMutationBlocked}>
                <option value="">継続中</option>
                {DISEASE_OUTCOME_PRESETS.filter((option) => option !== '継続中').map((option) => (
                  <option key={option} value={option} />
                ))}
              </select>
            </div>
            <label className="charts-side-panel__toggle">
              <input
                type="checkbox"
                checked={form.uncodedAccepted}
                onChange={(event) => setForm((prev) => ({ ...prev, uncodedAccepted: event.target.checked, components: event.target.checked ? [] : prev.components }))}
                disabled={isOrcaMutationBlocked || normalizeFormComponents(form).length > 0}
              />
              未コード化病名として警告を確認した
            </label>
          </details>
          <div className="charts-diagnosis__editor-actions" role="group" aria-label="病名保存">
            <button type="submit" disabled={isAnyMutationPending || isOrcaMutationBlocked}>
              送信内容を確認
            </button>
            <button type="button" className="charts-side-panel__ghost" onClick={() => setIsEditorOpen(false)}>
              閉じる
            </button>
          </div>
        </form>
      </FocusTrapDialog>

      <CriticalOperationConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction ? `${pendingAction.title}の確認` : '病名ORCA送信の確認'}
        description="この操作は ORCA へ送信し、成功後に再取得した結果だけを ORCA登録病名として表示します。"
        operationLabel="病名ORCA送信"
        patientName={patientId}
        patientFields={[
          { label: '患者番号', value: patientId ?? '—' },
          { label: '氏名', value: '—' },
          { label: '生年月日', value: '—' },
          { label: '性別', value: '—' },
          { label: '年齢', value: '—' },
          { label: '受付日', value: meta.visitDate ?? '—' },
          { label: '診療科', value: meta.departmentCode ?? '—' },
          { label: '担当医', value: '—' },
          { label: '保険組合せ', value: formatInsuranceCombination(meta.insuranceCombinationNumber ?? pendingEntry?.insuranceCombinationNumber) },
          { label: 'ORCA受付ID', value: meta.receptionId ?? '—' },
        ]}
        summaryTitle="病名ORCA送信対象"
        summaryFields={[
          { label: '操作', value: pendingAction?.title ?? '-' },
          { label: '病名', value: pendingForm ? `${pendingForm.prefix}${pendingForm.name}${pendingForm.suffix}`.trim() || '-' : formatEntryName(pendingEntry) },
          { label: '病名属性', value: pendingForm ? formatDiseaseAttributeLabel(pendingForm) : pendingEntry ? (isMainDisease(pendingEntry) ? '主病名' : '副病名') : '-' },
          { label: 'レセプト表示', value: pendingForm ? (pendingForm.receiptPrint ? '表示する' : '表示しない') : '表示する' },
          { label: '保険病名', value: pendingForm ? (pendingForm.insuranceDisease ? '指定する' : '指定しない') : '指定しない' },
          { label: '副病名区分', value: pendingForm ? formatSubDiseaseClassLabel(pendingForm.subDiseaseClass) : '指定なし' },
          { label: '病名保険区分', value: pendingForm ? formatDiseaseInsuranceClassLabel(pendingForm.diseaseInsuranceClass) : '指定なし' },
          { label: '病名カテゴリ', value: pendingForm ? formatDiseaseCategoryLabel(pendingForm.diseaseCategory) : '指定なし' },
          { label: '開始日', value: pendingForm?.startDate || pendingEntry?.startDate || '-' },
          { label: '転帰', value: pendingForm?.outcome || pendingEntry?.outcome || '-' },
        ]}
        confirmLabel={pendingAction?.confirmLabel ?? '実行'}
        cancelDisabled={isAnyMutationPending}
        confirmDisabled={isAnyMutationPending || isOrcaMutationBlocked}
        tone={pendingAction?.operation === 'delete' || pendingAction?.operation === 'organizeDeletedDiseases' ? 'danger' : 'warning'}
        onCancel={() => {
          if (isAnyMutationPending) return;
          setPendingAction(null);
        }}
        onConfirm={confirmPendingAction}
        testId="charts-diagnosis-confirm-dialog"
      />
    </section>
  );
}
