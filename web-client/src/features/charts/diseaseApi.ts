import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { importPatientsFromOrca } from '../outpatient/orcaPatientImportApi';
import { buildPatientImportFailureMessage, isRecoverableOrcaNotFound } from '../shared/orcaPatientImportRecovery';
import type { OrcaResponseErrorKind } from '../shared/orcaApiResponse';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type DiseaseEntry = {
  diagnosisId?: number;
  diagnosisName?: string;
  diagnosisCode?: string;
  displayName?: string;
  karteName?: string;
  departmentCode?: string;
  insuranceCombinationNumber?: string;
  startDate?: string;
  endDate?: string;
  outcome?: string;
  orcaOutcomeSendCode?: string;
  orcaOutcomeReceivedCode?: string;
  category?: string;
  suspectedFlag?: string;
  layer?: DiseaseLayer;
  syncState?: DiseaseSyncState;
  syncStatus?: DiseaseSyncStatus;
  masterVersion?: string;
  orcaSnapshotHash?: string;
  components?: DiseaseComponent[];
  supplements?: DiseaseSupplement[];
  warnings?: DiseaseWarning[];
  unmatchInformation?: DiseaseUnmatchInformation[];
  readOnly?: boolean;
  candidateOnly?: boolean;
  candidateKind?: 'candidate' | 'draftCandidate';
  sourceOfTruth?: 'orca' | 'local-candidate' | 'chart-text';
  note?: string;
};

export type DiseaseComponentType = 'PREFIX' | 'SITE' | 'BODY' | 'SUFFIX' | 'UNKNOWN';

export type DiseaseComponent = {
  seq: number;
  componentType: DiseaseComponentType;
  code: string;
  name: string;
  sourceMaster?: string;
  validFrom?: string;
  validTo?: string;
  condition?: string;
};

export type DiseaseSupplement = {
  seq: number;
  supplementCode?: string;
  supplementName?: string;
};

export type DiseaseWarning = {
  code?: string;
  messageCategory?: string;
  position?: number;
};

export type DiseaseUnmatchInformation = {
  code?: string;
  name?: string;
  supplementName?: string;
  inOut?: string;
  category?: string;
  suspectedFlag?: string;
  startDate?: string;
  endDate?: string;
  outcome?: string;
  messageCategory?: string;
};

export type DiseaseLayer = 'orca-mirror' | 'candidate';
export type DiseaseSyncStatus = 'PENDING' | 'SYNCED' | 'WARNING' | 'ERROR';
export type DiseaseSyncState =
  | 'none'
  | 'candidate'
  | 'conflict'
  | 'manual-resolution'
  | 'stale'
  | 'mirror-unavailable'
  | 'clinical-unavailable';

export const DISEASE_SYNC_CANDIDATES_NOTE = '同期候補があります';
export const DISEASE_CONFLICT_NOTE = 'ORCA側と差分があります';
export const DISEASE_MANUAL_RESOLUTION_NOTE = '保険病名の確認が必要です';
export const DISEASE_MIRROR_UNAVAILABLE_NOTE =
  'ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。';
export const DISEASE_MIRROR_EMPTY_NOTE = 'ORCAに登録済みの病名はありません。';
export const DISEASE_CLINICAL_UNAVAILABLE_NOTE =
  '外部の臨床病名ソースは未接続です。ここでは院内の保険病名を登録・編集し、候補は確認後に反映します。';
export const DISEASE_CANDIDATE_CONFIRM_NOTE = '候補は自動反映されません。内容を確認してからORCAへ病名登録してください。';
export const ORDER_SET_CANDIDATE_NOTE = '候補です。オーダーセット適用時も保険病名へ自動登録しません。';
export const DISEASE_OUTCOME_PRESETS = ['継続中', '治癒', '中止', '死亡', '移行(ORCA送信保留)'] as const;

export type DiseaseImportResponse = {
  ok?: boolean;
  status?: number;
  message?: string;
  errorCode?: string;
  errorKind?: OrcaResponseErrorKind;
  routeMismatch?: boolean;
  patientId?: string;
  karteId?: number;
  baseDate?: string;
  apiResult?: string;
  apiResultMessage?: string;
  runId?: string;
  orcaMirrorStatus?: 'connected' | 'unavailable';
  diseases?: DiseaseEntry[];
  pendingLocalDiseases?: DiseaseEntry[];
  patientImportAttempted?: boolean;
  patientImportStatus?: number;
};

type FetchDiseasesParams = {
  patientId: string;
  from?: string;
  to?: string;
  baseMonth?: string;
  activeOnly?: boolean;
  includeEnded?: boolean;
};

export type OrcaDiseaseMutationOperation = 'create' | 'update' | 'delete' | 'organizeDeletedDiseases';

type OrcaDiseaseMutationEntry = {
  diseaseCode?: string;
  diseaseName?: string;
  displayName?: string;
  karteName?: string;
  diseaseStartDate?: string;
  diseaseEndDate?: string;
  diseaseInOut?: string;
  diseaseSuspectedFlag?: string;
  diseaseOutCome?: string;
  outcome?: string;
  orcaOutcomeSendCode?: string;
  components?: DiseaseComponent[];
  supplements?: DiseaseSupplement[];
  uncodedAccepted?: boolean;
  insuranceCombinationNumber?: string;
  diseaseInsuranceClass?: string;
  diseaseCategory?: string;
  diseaseClass?: string;
  diseaseReceiptPrint?: string;
  diseaseReceiptPrintPeriod?: string;
  insuranceDisease?: string;
  dischargeCertificate?: string;
  mainDiseaseClass?: string;
  subDiseaseClass?: string;
};

export type OrcaDiseaseMutationRequest = {
  operation: OrcaDiseaseMutationOperation;
  patientId: string;
  performDate: string;
  performTime?: string;
  baseMonth?: string;
  departmentCode: string;
  physicianCode?: string;
  insuranceCombinationNumber?: string;
  diseaseInformation?: OrcaDiseaseMutationEntry[];
  targetDisease?: OrcaDiseaseMutationEntry;
  organizeInformation?: {
    departmentCode?: string;
    diseaseStartDate: string;
  };
};

export type OrcaDiseaseMutationResult = {
  ok: boolean;
  businessAccepted?: boolean;
  status?: number;
  apiResult?: string;
  responseClassification?: string;
  operationStatus?: string;
  needsUserReview?: boolean;
  warnings?: DiseaseWarning[];
  unmatchInformation?: DiseaseUnmatchInformation[];
  unmatchInformationOverflow?: string;
  postMutationMirrorStatus?: 'connected' | 'unavailable';
  postMutationMirror?: DiseaseImportResponse;
  runId?: string;
  traceId?: string;
  message?: string;
  raw?: unknown;
};

type DiseaseAttributeRule = {
  field: OrcaDiseaseAttributeField;
  allowed: ReadonlySet<string>;
  message: string;
};

type OrcaDiseaseAttributeField =
  | 'diseaseInsuranceClass'
  | 'diseaseCategory'
  | 'diseaseClass'
  | 'diseaseReceiptPrint'
  | 'insuranceDisease'
  | 'dischargeCertificate'
  | 'mainDiseaseClass'
  | 'subDiseaseClass';

const ORCA_DISEASE_ATTRIBUTE_RULES: DiseaseAttributeRule[] = [
  {
    field: 'diseaseInsuranceClass',
    allowed: new Set(['1', '0', 'None']),
    message: 'diseaseInsuranceClass は ORCA 仕様コード 1、0、None のいずれかで指定してください。',
  },
  {
    field: 'diseaseCategory',
    allowed: new Set(['PD', 'None']),
    message: 'diseaseCategory は ORCA 仕様コード PD または None で指定してください。',
  },
  {
    field: 'diseaseClass',
    allowed: new Set(['03', '04', '05', '07', '08', '09', 'Auto', 'None']),
    message: 'diseaseClass は ORCA 仕様コード 03、04、05、07、08、09、Auto、None のいずれかで指定してください。',
  },
  {
    field: 'diseaseReceiptPrint',
    allowed: new Set(['1', 'None']),
    message: 'diseaseReceiptPrint は ORCA 仕様コード 1 または None で指定してください。',
  },
  {
    field: 'insuranceDisease',
    allowed: new Set(['1', 'None']),
    message: 'insuranceDisease は ORCA 仕様コード 1 または None で指定してください。',
  },
  {
    field: 'dischargeCertificate',
    allowed: new Set(['0', '1', 'None']),
    message: 'dischargeCertificate は ORCA 仕様コード 0、1、None のいずれかで指定してください。',
  },
  {
    field: 'mainDiseaseClass',
    allowed: new Set(['01', '02', '03', '04', '05', 'None']),
    message: 'mainDiseaseClass は ORCA 仕様コード 01、02、03、04、05、None のいずれかで指定してください。',
  },
  {
    field: 'subDiseaseClass',
    allowed: new Set(['01', '02', '03', '04', '05', 'None']),
    message: 'subDiseaseClass は ORCA 仕様コード 01、02、03、04、05、None のいずれかで指定してください。',
  },
];

function normalizeOptionalOrcaCode(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function assertOrcaDiseaseAttributeCode(
  fieldPath: string,
  value: string | undefined,
  allowed: ReadonlySet<string>,
  message: string,
): string | undefined {
  const normalized = normalizeOptionalOrcaCode(value);
  if (normalized === undefined) return undefined;
  if (!allowed.has(normalized)) {
    throw new Error(`${fieldPath}: ${message}`);
  }
  return normalized;
}

function assertDiseaseReceiptPrintPeriod(fieldPath: string, value: string | undefined): string | undefined {
  const normalized = normalizeOptionalOrcaCode(value);
  if (normalized === undefined) return undefined;
  if (normalized !== 'None' && !/^\d{2}$/.test(normalized)) {
    throw new Error(`${fieldPath}: diseaseReceiptPrintPeriod は ORCA 仕様コード None または 00-99 で指定してください。`);
  }
  return normalized;
}

function normalizeOrcaDiseaseMutationEntry(
  entry: OrcaDiseaseMutationEntry,
  fieldPath: string,
): OrcaDiseaseMutationEntry {
  const normalized: OrcaDiseaseMutationEntry = { ...entry };
  for (const rule of ORCA_DISEASE_ATTRIBUTE_RULES) {
    const value = assertOrcaDiseaseAttributeCode(
      `${fieldPath}.${rule.field}`,
      entry[rule.field],
      rule.allowed,
      rule.message,
    );
    if (value === undefined) {
      delete normalized[rule.field];
    } else {
      normalized[rule.field] = value;
    }
  }
  const diseaseReceiptPrintPeriod = assertDiseaseReceiptPrintPeriod(
    `${fieldPath}.diseaseReceiptPrintPeriod`,
    entry.diseaseReceiptPrintPeriod,
  );
  if (diseaseReceiptPrintPeriod === undefined) {
    delete normalized.diseaseReceiptPrintPeriod;
  } else {
    normalized.diseaseReceiptPrintPeriod = diseaseReceiptPrintPeriod;
  }
  return normalized;
}

function normalizeOrcaDiseaseMutationRequest(params: OrcaDiseaseMutationRequest): OrcaDiseaseMutationRequest {
  return {
    ...params,
    diseaseInformation: params.diseaseInformation?.map((entry, index) =>
      normalizeOrcaDiseaseMutationEntry(entry, `diseaseInformation[${index}]`),
    ),
    targetDisease: params.targetDisease
      ? normalizeOrcaDiseaseMutationEntry(params.targetDisease, 'targetDisease')
      : undefined,
  };
}

type DiseaseMasterEntry = {
  code?: string;
  name?: string;
  kana?: string;
  icdTen?: string;
  disUseDate?: string;
};

export type DiseaseMasterCandidate = {
  name: string;
  code?: string;
  icdTen?: string;
  disUseDate?: string;
};

type ResolveDiseaseCodeParams = {
  diagnosisName: string;
  prefix?: string;
  mainName?: string;
  suffix?: string;
  referenceDate?: string;
};

const ORCA_DISEASE_CODE_REGEX = /^[0-9]{7}$/;
const ORCA_MODIFIER_CODE_REGEX = /^ZZZ[0-9]{4}$/;

const normalizeTerm = (value?: string | null) => (value ?? '').trim();
const normalizeNameKey = (value?: string | null) => normalizeTerm(value).replaceAll(' ', '').replaceAll('　', '');

export const toOrcaOutcome = (value?: string): { outcome: string; sendCode?: string } => {
  const normalized = normalizeTerm(value);
  switch (normalized) {
    case '':
    case '継続':
    case '継続中':
    case 'ACTIVE':
      return { outcome: 'ACTIVE', sendCode: undefined };
    case '治癒':
    case 'CURED':
    case 'F':
      return { outcome: 'CURED', sendCode: 'F' };
    case '死亡':
    case 'DEATH':
    case 'D':
      return { outcome: 'DEATH', sendCode: 'D' };
    case '中止':
    case 'DISCONTINUED':
    case 'P':
      return { outcome: 'DISCONTINUED', sendCode: 'P' };
    case '移行(ORCA送信保留)':
    case 'TRANSFERRED':
      return { outcome: 'TRANSFERRED', sendCode: undefined };
    case '削除':
    case 'DELETED':
    case 'O':
      return { outcome: 'DELETED', sendCode: 'O' };
    default:
      throw new Error(`転帰は ${DISEASE_OUTCOME_PRESETS.join('、')} のいずれかを入力してください。`);
  }
};

const normalizeDiseaseLayer = (value?: string | null): DiseaseLayer => {
  const normalized = normalizeTerm(value);
  if (normalized === 'orca-mirror' || normalized === 'candidate') {
    return normalized;
  }
  return 'candidate';
};

const normalizeCandidateKind = (value?: string | null, layer?: DiseaseLayer): DiseaseEntry['candidateKind'] => {
  const normalized = normalizeTerm(value);
  if (normalized === 'draftCandidate' || normalized === 'candidate') return normalized;
  return layer === 'candidate' ? 'draftCandidate' : undefined;
};

const normalizeDiseaseSyncState = (value?: string | null): DiseaseSyncState => {
  const normalized = normalizeTerm(value);
  switch (normalized) {
    case 'candidate':
    case 'conflict':
    case 'manual-resolution':
    case 'stale':
    case 'mirror-unavailable':
    case 'clinical-unavailable':
      return normalized;
    default:
      return 'none';
  }
};

const normalizeDiseaseEntry = (entry: DiseaseEntry): DiseaseEntry => {
  const layer = normalizeDiseaseLayer(entry.layer);
  const components = normalizeDiseaseComponents(entry.components, entry.diagnosisCode, entry.diagnosisName);
  return {
    ...entry,
    diagnosisName: normalizeTerm(entry.displayName) || entry.diagnosisName,
    components,
    supplements: normalizeDiseaseSupplements(entry.supplements),
    warnings: Array.isArray(entry.warnings) ? entry.warnings : [],
    unmatchInformation: Array.isArray(entry.unmatchInformation) ? entry.unmatchInformation : [],
    layer,
    syncState: normalizeDiseaseSyncState(entry.syncState),
    syncStatus: normalizeDiseaseSyncStatus(entry.syncStatus),
    readOnly: typeof entry.readOnly === 'boolean' ? entry.readOnly : layer === 'orca-mirror' || layer === 'candidate',
    candidateOnly: typeof entry.candidateOnly === 'boolean' ? entry.candidateOnly : layer === 'candidate',
    candidateKind: normalizeCandidateKind(entry.candidateKind, layer),
    sourceOfTruth:
      entry.sourceOfTruth === 'orca' || entry.sourceOfTruth === 'local-candidate' || entry.sourceOfTruth === 'chart-text'
        ? entry.sourceOfTruth
        : layer === 'orca-mirror'
          ? 'orca'
          : layer === 'candidate'
            ? 'local-candidate'
            : undefined,
    note: normalizeTerm(entry.note) || undefined,
  };
};

const normalizeDiseaseWarning = (value: unknown): DiseaseWarning | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const position = typeof record.position === 'number' && Number.isFinite(record.position) ? record.position : undefined;
  return {
    code: normalizeTerm(typeof record.code === 'string' ? record.code : undefined) || undefined,
    messageCategory: normalizeTerm(typeof record.messageCategory === 'string' ? record.messageCategory : undefined) || undefined,
    position,
  };
};

const normalizeDiseaseWarnings = (value: unknown): DiseaseWarning[] =>
  Array.isArray(value) ? value.map((item) => normalizeDiseaseWarning(item)).filter((item): item is DiseaseWarning => item !== null) : [];

const normalizeDiseaseUnmatch = (value: unknown): DiseaseUnmatchInformation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    code: normalizeTerm(typeof record.code === 'string' ? record.code : undefined) || undefined,
    name: normalizeTerm(typeof record.name === 'string' ? record.name : undefined) || undefined,
    supplementName: normalizeTerm(typeof record.supplementName === 'string' ? record.supplementName : undefined) || undefined,
    inOut: normalizeTerm(typeof record.inOut === 'string' ? record.inOut : undefined) || undefined,
    category: normalizeTerm(typeof record.category === 'string' ? record.category : undefined) || undefined,
    suspectedFlag: normalizeTerm(typeof record.suspectedFlag === 'string' ? record.suspectedFlag : undefined) || undefined,
    startDate: normalizeTerm(typeof record.startDate === 'string' ? record.startDate : undefined) || undefined,
    endDate: normalizeTerm(typeof record.endDate === 'string' ? record.endDate : undefined) || undefined,
    outcome: normalizeTerm(typeof record.outcome === 'string' ? record.outcome : undefined) || undefined,
    messageCategory: normalizeTerm(typeof record.messageCategory === 'string' ? record.messageCategory : undefined) || undefined,
  };
};

const normalizeDiseaseUnmatches = (value: unknown): DiseaseUnmatchInformation[] =>
  Array.isArray(value) ? value.map((item) => normalizeDiseaseUnmatch(item)).filter((item): item is DiseaseUnmatchInformation => item !== null) : [];

const normalizeDiseaseSyncStatus = (value?: string | null): DiseaseSyncStatus => {
  switch (normalizeTerm(value)) {
    case 'PENDING':
    case 'WARNING':
    case 'ERROR':
      return normalizeTerm(value) as DiseaseSyncStatus;
    default:
      return 'SYNCED';
  }
};

const normalizeComponentType = (value?: string | null): DiseaseComponentType => {
  switch (normalizeTerm(value).toUpperCase()) {
    case 'PREFIX':
    case 'SITE':
    case 'BODY':
    case 'SUFFIX':
      return normalizeTerm(value).toUpperCase() as DiseaseComponentType;
    default:
      return 'UNKNOWN';
  }
};

const normalizeDiseaseComponents = (
  components?: DiseaseComponent[],
  diagnosisCode?: string,
  diagnosisName?: string,
): DiseaseComponent[] => {
  if (Array.isArray(components) && components.length > 0) {
    return components
      .map((component, index) => ({
        ...component,
        seq: Number.isFinite(component.seq) ? Number(component.seq) : index + 1,
        componentType: normalizeComponentType(component.componentType),
        code: normalizeTerm(component.code),
        name: normalizeTerm(component.name),
      }))
      .filter((component) => component.code && component.name)
      .slice(0, 21);
  }
  const code = normalizeTerm(diagnosisCode);
  const name = normalizeTerm(diagnosisName);
  if (ORCA_DISEASE_CODE_REGEX.test(code) && name) {
    return [{ seq: 1, componentType: 'BODY', code, name, sourceMaster: 'ORCA disease master' }];
  }
  return [];
};

const normalizeDiseaseSupplements = (supplements?: DiseaseSupplement[]): DiseaseSupplement[] => {
  if (!Array.isArray(supplements)) return [];
  return supplements
    .map((supplement, index) => ({
      ...supplement,
      seq: Number.isFinite(supplement.seq) ? Number(supplement.seq) : index + 1,
      supplementCode: normalizeTerm(supplement.supplementCode) || undefined,
      supplementName: normalizeTerm(supplement.supplementName) || undefined,
    }))
    .filter((supplement) => supplement.supplementCode || supplement.supplementName);
};

const normalizeMasterReferenceDate = (referenceDate?: string) => {
  const normalized = (referenceDate ?? '').replaceAll('-', '').trim();
  if (/^\d{8}$/.test(normalized)) {
    return normalized;
  }
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
};

const pickStringValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return undefined;
};

const toDiseaseMasterEntry = (record: Record<string, unknown>): DiseaseMasterEntry | null => {
  const entry: DiseaseMasterEntry = {
    code: pickStringValue(record, ['code', 'Code', 'diseaseCode', 'Disease_Code', 'byomeicd', 'byomeiCd']),
    name: pickStringValue(record, ['name', 'Name', 'diseaseName', 'Disease_Name', 'byomei']),
    kana: pickStringValue(record, ['kana', 'Kana', 'byomeikana']),
    icdTen: pickStringValue(record, ['icdTen', 'IcdTen', 'icd10', 'icd10_1']),
    disUseDate: pickStringValue(record, ['disUseDate', 'DisUseDate', 'haisiymd']),
  };
  if (!entry.code && !entry.name) {
    return null;
  }
  return entry;
};

const extractDiseaseMasterEntries = (raw: unknown): DiseaseMasterEntry[] => {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const queue: unknown[] = [raw];
  const entries: DiseaseMasterEntry[] = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (!current || typeof current !== 'object') {
      continue;
    }
    const record = current as Record<string, unknown>;
    const parsed = toDiseaseMasterEntry(record);
    if (parsed) {
      const key = `${parsed.code ?? ''}\u0000${parsed.name ?? ''}\u0000${parsed.kana ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(parsed);
      }
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }
  return entries;
};

async function fetchDiseaseMasterByName(params: {
  term: string;
  referenceDate: string;
  partialMatch?: boolean;
}): Promise<DiseaseMasterEntry[]> {
  const term = normalizeTerm(params.term);
  if (!term) {
    return [];
  }
  const requestParam = `${encodeURIComponent(term)},${encodeURIComponent(params.referenceDate)},${params.partialMatch ? 'true' : 'false'}`;
  const response = await httpFetch(`/api/orca/official/disease-master/name/${requestParam}/`);
  if (!response.ok) {
    return [];
  }
  const json = (await response.json().catch(() => null)) as unknown;
  return extractDiseaseMasterEntries(json);
}

export async function searchDiseaseMasterCandidates(params: {
  keyword: string;
  referenceDate?: string;
  limit?: number;
}): Promise<DiseaseMasterCandidate[]> {
  const keyword = normalizeTerm(params.keyword);
  if (!keyword) {
    return [];
  }
  const referenceDate = normalizeMasterReferenceDate(params.referenceDate);
  const limit = Number.isFinite(params.limit) ? Math.max(1, Math.trunc(params.limit ?? 20)) : 20;
  try {
    const entries = await fetchDiseaseMasterByName({ term: keyword, referenceDate, partialMatch: true });
    const deduped = new Map<string, DiseaseMasterCandidate>();
    for (const entry of entries) {
      const name = normalizeTerm(entry.name);
      if (!name) {
        continue;
      }
      const code = normalizeTerm(entry.code) || undefined;
      const icdTen = normalizeTerm(entry.icdTen) || undefined;
      const key = `${name}\u0000${code ?? ''}\u0000${icdTen ?? ''}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          name,
          code,
          icdTen,
          disUseDate: normalizeTerm(entry.disUseDate) || undefined,
        });
      }
    }

    const keywordKey = normalizeNameKey(keyword);
    return [...deduped.values()]
      .sort((left, right) => {
        const leftNameKey = normalizeNameKey(left.name);
        const rightNameKey = normalizeNameKey(right.name);
        const leftExact = leftNameKey === keywordKey ? 0 : leftNameKey.startsWith(keywordKey) ? 1 : 2;
        const rightExact = rightNameKey === keywordKey ? 0 : rightNameKey.startsWith(keywordKey) ? 1 : 2;
        if (leftExact !== rightExact) {
          return leftExact - rightExact;
        }
        return leftNameKey.localeCompare(rightNameKey, 'ja');
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

const toUniqueCodes = (entries: DiseaseMasterEntry[], matcher: (code: string) => boolean) =>
  [...new Set(entries.map((entry) => (entry.code ?? '').trim()).filter((code) => code && matcher(code)))];

const pickCode = (codes: string[]) => (codes.length === 1 ? codes[0] : undefined);

export async function resolveDiseaseCodeFromOrcaMaster(params: ResolveDiseaseCodeParams): Promise<string | undefined> {
  const diagnosisName = normalizeTerm(params.diagnosisName);
  if (!diagnosisName) {
    return undefined;
  }
  const referenceDate = normalizeMasterReferenceDate(params.referenceDate);
  const exactLookupCache = new Map<string, Promise<DiseaseMasterEntry[]>>();
  const fetchExactEntries = async (term: string) => {
    const normalized = normalizeTerm(term);
    if (!normalized) {
      return [] as DiseaseMasterEntry[];
    }
    const cacheKey = `${referenceDate}:${normalized}`;
    if (!exactLookupCache.has(cacheKey)) {
      exactLookupCache.set(cacheKey, fetchDiseaseMasterByName({ term: normalized, referenceDate, partialMatch: false }));
    }
    return exactLookupCache.get(cacheKey) ?? Promise.resolve([]);
  };

  const lookupExactCodes = async (term: string, codeType: 'base' | 'modifier') => {
    const normalized = normalizeTerm(term);
    if (!normalized) {
      return [] as string[];
    }
    const exactByName = await lookupExactEntriesByName(normalized);
    if (exactByName.length === 0) {
      return [] as string[];
    }
    if (codeType === 'base') {
      return toUniqueCodes(exactByName, (code) => ORCA_DISEASE_CODE_REGEX.test(code));
    }
    return toUniqueCodes(exactByName, (code) => !ORCA_DISEASE_CODE_REGEX.test(code));
  };

  const lookupExactEntriesByName = async (term: string) => {
    const normalized = normalizeTerm(term);
    if (!normalized) {
      return [] as DiseaseMasterEntry[];
    }
    const entries = await fetchExactEntries(normalized);
    return entries.filter((entry) => normalizeTerm(entry.name) === normalized);
  };

  const lookupExactCodesAny = async (term: string) => {
    const normalized = normalizeTerm(term);
    if (!normalized) {
      return [] as string[];
    }
    const exactByName = await lookupExactEntriesByName(normalized);
    return [
      ...new Set(
        exactByName
          .map((entry) => (entry.code ?? '').trim())
          .filter((code) => ORCA_DISEASE_CODE_REGEX.test(code) || ORCA_MODIFIER_CODE_REGEX.test(code)),
      ),
    ];
  };

  try {
    const hintedMainName = normalizeTerm(params.mainName);

    const exactAnyCode = pickCode(await lookupExactCodesAny(diagnosisName));
    if (exactAnyCode) {
      return exactAnyCode;
    }

    if (hintedMainName && !normalizeTerm(params.prefix) && !normalizeTerm(params.suffix)) {
      const baseCode = pickCode(await lookupExactCodes(hintedMainName, 'base'));
      if (baseCode) return baseCode;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function fetchDiseases(params: FetchDiseasesParams): Promise<DiseaseImportResponse> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const baseMonth = normalizeBaseMonth(params.baseMonth) ?? baseMonthFromVisitDate(params.to);
  if (baseMonth) query.set('baseMonth', baseMonth);
  if (params.activeOnly) query.set('activeOnly', 'true');
  if (params.includeEnded) query.set('includeEnded', 'true');
  const queryString = query.toString();
  const response = await httpFetch(`/api/local/diagnoses/${encodeURIComponent(params.patientId)}${queryString ? `?${queryString}` : ''}`);
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '病名情報の取得に失敗しました。' });
  if (parsed.ok && !parsed.json) {
    return {
      ok: false,
      status: parsed.status,
      message: '病名情報APIがJSON以外を返しました。ルーティング設定を確認してください。',
      errorKind: 'route_not_found',
      routeMismatch: true,
      runId,
      diseases: [],
    };
  }
  const json = (parsed.json ?? {}) as DiseaseImportResponse;
  const normalized = normalizeDiseaseImportResponse(json, parsed.runId ?? runId);
  return {
    ...normalized,
    ...json,
    ok: parsed.ok,
    status: parsed.status,
    message: parsed.message,
    errorCode: parsed.ok ? undefined : parsed.errorCode,
    errorKind: parsed.ok ? undefined : parsed.errorKind,
    routeMismatch: parsed.ok ? false : parsed.routeMismatch,
    runId: normalized.runId,
    diseases: normalized.diseases,
    pendingLocalDiseases: normalized.pendingLocalDiseases,
  };
}

const normalizeDiseaseImportResponse = (json: DiseaseImportResponse, fallbackRunId?: string): DiseaseImportResponse => ({
  ...json,
  runId: json.runId ?? fallbackRunId,
  diseases: Array.isArray(json.diseases) ? json.diseases.map((entry) => normalizeDiseaseEntry(entry)) : [],
  pendingLocalDiseases: Array.isArray(json.pendingLocalDiseases)
    ? json.pendingLocalDiseases.map((entry) => normalizeDiseaseEntry(entry))
    : [],
});

const toDiseaseImportResponse = (value: unknown, fallbackRunId?: string): DiseaseImportResponse | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return normalizeDiseaseImportResponse(value as DiseaseImportResponse, fallbackRunId);
};

const normalizeBaseMonth = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized && /^\d{6}$/.test(normalized) ? normalized : undefined;
};

const baseMonthFromVisitDate = (value?: string): string | undefined => {
  const normalized = value?.trim();
  if (!normalized || !/^\d{4}-\d{2}-\d{2}/.test(normalized)) return undefined;
  return normalized.slice(0, 7).replace('-', '');
};

export async function fetchDiseasesWithPatientImportRecovery(
  params: FetchDiseasesParams,
): Promise<DiseaseImportResponse> {
  const primary = await fetchDiseases(params);
  if (primary.ok) return primary;

  if (
    !isRecoverableOrcaNotFound({
      patientId: params.patientId,
      status: primary.status,
      errorCode: primary.errorCode,
      errorKind: primary.errorKind,
    })
  ) {
    return primary;
  }

  const importResult = await importPatientsFromOrca({
    patientIds: [params.patientId],
    runId: primary.runId,
  });

  if (!importResult.ok) {
    return {
      ...primary,
      ok: false,
      diseases: [],
      runId: importResult.runId ?? primary.runId,
      status: importResult.status || primary.status,
      message: buildPatientImportFailureMessage('病名情報', importResult),
      errorCode: importResult.errorCode ?? primary.errorCode,
      errorKind: importResult.errorKind ?? primary.errorKind,
      routeMismatch: importResult.routeMismatch ?? primary.routeMismatch,
      patientImportAttempted: true,
      patientImportStatus: importResult.status,
    };
  }

  const retried = await fetchDiseases(params);
  return {
    ...retried,
    runId: retried.runId ?? importResult.runId ?? primary.runId,
    patientImportAttempted: true,
    patientImportStatus: importResult.status,
  };
}

export async function mutateOrcaDisease(params: OrcaDiseaseMutationRequest): Promise<OrcaDiseaseMutationResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const requestBody = normalizeOrcaDiseaseMutationRequest(params);
  const response = await httpFetch('/api/orca/official/chart-support/disease-mod-v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: 'ORCA病名の登録に失敗しました。' });
  const json = (parsed.json ?? {}) as Record<string, unknown>;
  const postMutationMirrorStatus =
    json.postMutationMirrorStatus === 'connected' || json.postMutationMirrorStatus === 'unavailable'
      ? json.postMutationMirrorStatus
      : undefined;
  const postMutationMirror = toDiseaseImportResponse(json.postMutationMirror, typeof json.runId === 'string' ? json.runId : parsed.runId ?? runId);
  const warnings = normalizeDiseaseWarnings(json.warnings);
  const unmatchInformation = normalizeDiseaseUnmatches(json.unmatchInformation);
  return {
    ok: parsed.ok && json.businessAccepted === true && json.needsUserReview !== true && postMutationMirrorStatus !== 'unavailable',
    businessAccepted: json.businessAccepted === true,
    status: parsed.status,
    apiResult: typeof json.apiResult === 'string' ? json.apiResult : undefined,
    responseClassification: typeof json.responseClassification === 'string' ? json.responseClassification : undefined,
    operationStatus: typeof json.operationStatus === 'string' ? json.operationStatus : undefined,
    needsUserReview: json.needsUserReview === true,
    warnings,
    unmatchInformation,
    unmatchInformationOverflow: typeof json.unmatchInformationOverflow === 'string' ? json.unmatchInformationOverflow : undefined,
    postMutationMirrorStatus,
    postMutationMirror,
    runId: typeof json.runId === 'string' ? json.runId : parsed.runId ?? runId,
    traceId: typeof json.traceId === 'string' ? json.traceId : undefined,
    message: parsed.ok
      ? json.businessAccepted === true && json.needsUserReview !== true
        ? postMutationMirrorStatus === 'unavailable'
          ? 'ORCA病名の送信は受け付けられましたが、ORCA病名の再取得が完了していません。ORCA正本を再取得して確認してください。'
          : undefined
        : json.needsUserReview === true
          ? postMutationMirrorStatus === 'unavailable'
            ? 'ORCA病名の送信は受け付けられましたが、ORCA病名の再取得が完了していません。ORCA正本を再取得して確認してください。'
            : 'ORCA病名の処理結果に確認が必要です。警告または不一致を確認してください。'
          : 'ORCA病名の処理を完了確認できませんでした。再取得後に状態を確認してください。'
      : parsed.message,
    raw: json,
  };
}
