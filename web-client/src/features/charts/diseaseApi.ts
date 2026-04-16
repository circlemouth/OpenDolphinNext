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
  departmentCode?: string;
  insuranceCombinationNumber?: string;
  startDate?: string;
  endDate?: string;
  outcome?: string;
  category?: string;
  suspectedFlag?: string;
  layer?: DiseaseLayer;
  syncState?: DiseaseSyncState;
  readOnly?: boolean;
  candidateOnly?: boolean;
  note?: string;
};

export type DiseaseLayer = 'insurance-local' | 'orca-mirror' | 'candidate';
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
export const DISEASE_MIRROR_UNAVAILABLE_NOTE = 'ORCA mirror を取得できないため、同期状態は未確認です。';
export const DISEASE_CLINICAL_UNAVAILABLE_NOTE = 'clinical source が未実装のため、この画面では保険病名だけを扱います。';
export const DISEASE_CANDIDATE_CONFIRM_NOTE = '候補は自動反映されません。内容を確認してから保険病名に追加してください。';
export const ORDER_SET_CANDIDATE_NOTE = '候補です。オーダーセット適用時も保険病名へ自動登録しません。';

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
  diseases?: DiseaseEntry[];
  patientImportAttempted?: boolean;
  patientImportStatus?: number;
};

type FetchDiseasesParams = {
  patientId: string;
  from?: string;
  to?: string;
  activeOnly?: boolean;
};

export type DiseaseMutationOperation = {
  operation: 'create' | 'update' | 'delete';
  diagnosisId?: number;
  diagnosisName?: string;
  diagnosisCode?: string;
  departmentCode?: string;
  insuranceCombinationNumber?: string;
  startDate?: string;
  endDate?: string;
  outcome?: string;
  category?: string;
  suspectedFlag?: string;
  note?: string;
};

export type DiseaseMutationResult = {
  ok: boolean;
  runId?: string;
  message?: string;
  createdDiagnosisIds?: number[];
  updatedDiagnosisIds?: number[];
  removedDiagnosisIds?: number[];
  raw?: unknown;
};

const assignMutationScopedDiagnosisIds = (operations: DiseaseMutationOperation[]): DiseaseMutationOperation[] => {
  let nextTemporaryId = -1;
  return operations.map((operation) => {
    if (typeof operation.diagnosisId === 'number' && Number.isFinite(operation.diagnosisId)) {
      return operation;
    }
    return {
      ...operation,
      diagnosisId: nextTemporaryId--,
    };
  });
};

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

const normalizeTerm = (value?: string | null) => (value ?? '').trim();
const normalizeNameKey = (value?: string | null) => normalizeTerm(value).replaceAll(' ', '').replaceAll('　', '');

const normalizeDiseaseLayer = (value?: string | null): DiseaseLayer => {
  const normalized = normalizeTerm(value);
  if (normalized === 'orca-mirror' || normalized === 'candidate') {
    return normalized;
  }
  return 'insurance-local';
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
  return {
    ...entry,
    layer,
    syncState: normalizeDiseaseSyncState(entry.syncState),
    readOnly: typeof entry.readOnly === 'boolean' ? entry.readOnly : layer === 'orca-mirror',
    candidateOnly: typeof entry.candidateOnly === 'boolean' ? entry.candidateOnly : layer === 'candidate',
    note: normalizeTerm(entry.note) || undefined,
  };
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

const toUniqueIcdTenCodes = (entries: DiseaseMasterEntry[]) =>
  [
    ...new Set(
      entries
        .map((entry) => normalizeTerm(entry.icdTen))
        .filter((code): code is string => Boolean(code)),
    ),
  ];

const pickCode = (codes: string[]) => (codes.length === 1 ? codes[0] : undefined);

const buildCompositeCode = (prefixCode: string | null | undefined, baseCode: string, suffixCode: string | null | undefined) =>
  [prefixCode, baseCode, suffixCode].filter((part): part is string => !!part && part.trim().length > 0).join('.');

const collectCompositeCandidates = async (
  diagnosisName: string,
  lookupExactCodes: (term: string, codeType: 'base' | 'modifier') => Promise<string[]>,
): Promise<Set<string>> => {
  const candidates = new Set<string>();
  const length = diagnosisName.length;

  for (let split = 1; split < length; split += 1) {
    const prefix = diagnosisName.slice(0, split);
    const base = diagnosisName.slice(split);
    const prefixCodes = await lookupExactCodes(prefix, 'modifier');
    const baseCodes = await lookupExactCodes(base, 'base');
    for (const prefixCode of prefixCodes) {
      for (const baseCode of baseCodes) {
        candidates.add(buildCompositeCode(prefixCode, baseCode, null));
      }
    }
  }

  for (let split = length - 1; split > 0; split -= 1) {
    const base = diagnosisName.slice(0, split);
    const suffix = diagnosisName.slice(split);
    const baseCodes = await lookupExactCodes(base, 'base');
    const suffixCodes = await lookupExactCodes(suffix, 'modifier');
    for (const baseCode of baseCodes) {
      for (const suffixCode of suffixCodes) {
        candidates.add(buildCompositeCode(null, baseCode, suffixCode));
      }
    }
  }

  for (let left = 1; left < length - 1; left += 1) {
    for (let right = left + 1; right < length; right += 1) {
      const prefix = diagnosisName.slice(0, left);
      const base = diagnosisName.slice(left, right);
      const suffix = diagnosisName.slice(right);
      const prefixCodes = await lookupExactCodes(prefix, 'modifier');
      const baseCodes = await lookupExactCodes(base, 'base');
      const suffixCodes = await lookupExactCodes(suffix, 'modifier');
      for (const prefixCode of prefixCodes) {
        for (const baseCode of baseCodes) {
          for (const suffixCode of suffixCodes) {
            candidates.add(buildCompositeCode(prefixCode, baseCode, suffixCode));
          }
        }
      }
    }
  }

  return candidates;
};

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
    return [...new Set(exactByName.map((entry) => (entry.code ?? '').trim()).filter((code) => code.length > 0))];
  };

  const lookupExactIcdTenCodes = async (term: string) => {
    const exactByName = await lookupExactEntriesByName(term);
    return toUniqueIcdTenCodes(exactByName);
  };

  try {
    const hintedPrefix = normalizeTerm(params.prefix);
    const hintedMainName = normalizeTerm(params.mainName);
    const hintedSuffix = normalizeTerm(params.suffix);

    const exactAnyCode = pickCode(await lookupExactCodesAny(diagnosisName));
    if (exactAnyCode) {
      return exactAnyCode;
    }
    const exactIcdTenCode = pickCode(await lookupExactIcdTenCodes(diagnosisName));
    if (exactIcdTenCode) {
      return exactIcdTenCode;
    }

    if (hintedMainName && (hintedPrefix || hintedSuffix)) {
      const baseCode = pickCode(await lookupExactCodes(hintedMainName, 'base'));
      const prefixCode = hintedPrefix ? pickCode(await lookupExactCodes(hintedPrefix, 'modifier')) : null;
      const suffixCode = hintedSuffix ? pickCode(await lookupExactCodes(hintedSuffix, 'modifier')) : null;
      const hintedResolved =
        baseCode &&
        (hintedPrefix ? !!prefixCode : true) &&
        (hintedSuffix ? !!suffixCode : true)
          ? buildCompositeCode(prefixCode, baseCode, suffixCode)
          : undefined;
      if (hintedResolved) {
        return hintedResolved;
      }
    }

    const compositeCandidates = await collectCompositeCandidates(diagnosisName, lookupExactCodes);
    return compositeCandidates.size === 1 ? [...compositeCandidates][0] : undefined;
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
  if (params.activeOnly) query.set('activeOnly', 'true');
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
  return {
    ...json,
    ok: parsed.ok,
    status: parsed.status,
    message: parsed.message,
    errorCode: parsed.ok ? undefined : parsed.errorCode,
    errorKind: parsed.ok ? undefined : parsed.errorKind,
    routeMismatch: parsed.ok ? false : parsed.routeMismatch,
    runId: json.runId ?? parsed.runId ?? runId,
    diseases: Array.isArray(json.diseases) ? json.diseases.map((entry) => normalizeDiseaseEntry(entry)) : [],
  };
}

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

export async function mutateDiseases(params: {
  patientId: string;
  karteId: number;
  operations: DiseaseMutationOperation[];
}): Promise<DiseaseMutationResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const normalizedOperations = assignMutationScopedDiagnosisIds(params.operations);
  const response = await httpFetch('/api/local/diagnoses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: params.patientId, karteId: params.karteId, operations: normalizedOperations }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const message =
    typeof json.message === 'string'
      ? (json.message as string)
      : typeof json.apiResultMessage === 'string'
        ? (json.apiResultMessage as string)
        : undefined;
  return {
    ok: response.ok,
    runId: typeof json.runId === 'string' ? (json.runId as string) : runId,
    message,
    createdDiagnosisIds: Array.isArray(json.createdDiagnosisIds) ? (json.createdDiagnosisIds as number[]) : undefined,
    updatedDiagnosisIds: Array.isArray(json.updatedDiagnosisIds) ? (json.updatedDiagnosisIds as number[]) : undefined,
    removedDiagnosisIds: Array.isArray(json.removedDiagnosisIds) ? (json.removedDiagnosisIds as number[]) : undefined,
    raw: json,
  };
}
