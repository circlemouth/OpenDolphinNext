import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';

export type LetterItemPayload = {
  name: string;
  value?: string | null;
};

export type LetterTextPayload = {
  name: string;
  textValue?: string | null;
};

export type LetterDatePayload = {
  name: string;
  value?: string | null;
};

export type LetterModulePayload = {
  id?: number;
  linkId?: number;
  confirmed?: string;
  started?: string;
  ended?: string;
  recorded?: string;
  status?: string;
  title?: string;
  letterType?: string;
  handleClass?: string;
  clientHospital?: string;
  clientDept?: string;
  clientDoctor?: string;
  clientZipCode?: string;
  clientAddress?: string;
  clientTelephone?: string;
  clientFax?: string;
  consultantHospital?: string;
  consultantDept?: string;
  consultantDoctor?: string;
  consultantZipCode?: string;
  consultantAddress?: string;
  consultantTelephone?: string;
  consultantFax?: string;
  patientId?: string;
  patientName?: string;
  patientKana?: string;
  patientGender?: string;
  patientBirthday?: string;
  patientAge?: string;
  patientOccupation?: string;
  patientZipCode?: string;
  patientAddress?: string;
  patientTelephone?: string;
  patientMobilePhone?: string;
  patientFaxNumber?: string;
  userModel?: {
    id?: number;
    userId?: string;
  } | null;
  karteBean?: {
    id?: number;
  } | null;
  letterItems?: LetterItemPayload[] | null;
  letterTexts?: LetterTextPayload[] | null;
  letterDates?: LetterDatePayload[] | null;
};

type ApiResultBase = {
  ok: boolean;
  runId?: string;
  status?: number;
  endpoint?: string;
  error?: string;
  reasonCode?: string;
  messageDetail?: string;
};

export type KarteIdResult = ApiResultBase & {
  karteId?: number;
};

export type LetterListResult = ApiResultBase & {
  letters: LetterModulePayload[];
};

export type LetterDetailResult = ApiResultBase & {
  letter?: LetterModulePayload;
};

export type LetterSaveResult = ApiResultBase & {
  letterId?: number;
};

const DEFAULT_KARTE_FROM_DATE = '2000-01-01 00:00:00';

const ensureRunId = (): string => {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  return runId;
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }
};

const pickString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const resolveErrorMessage = (status: number, json?: Record<string, unknown>): string => {
  const safeMessage = json ? pickString(json, ['apiResultMessage', 'message', 'error']) : undefined;
  if (safeMessage && !/exception|stack trace|\/Users\/|\/opt\/|java\./i.test(safeMessage)) return safeMessage;
  if (status >= 500) return 'サーバーエラーが発生しました。時間をおいて再試行してください。';
  if (status === 401 || status === 403) return '権限がありません。再ログインしてください。';
  if (status >= 400) return '文書保存リクエストを処理できませんでした。テンプレートと必須項目を確認してください。';
  return '通信に失敗しました。';
};

const parseNumeric = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export async function fetchKarteIdByPatientId({
  patientId,
  fromDate = DEFAULT_KARTE_FROM_DATE,
}: {
  patientId: string;
  fromDate?: string;
}): Promise<KarteIdResult> {
  const runId = ensureRunId();
  const param = `${encodeURIComponent(patientId)},${encodeURIComponent(fromDate)}`;
  const endpoint = `/api/karte/pid/${param}`;
  const response = await httpFetch(endpoint);
  const json = (await parseJson(response)) as Record<string, unknown>;
  return {
    ok: response.ok,
    runId,
    status: response.status,
    endpoint,
    karteId: response.ok ? parseNumeric(json.id) : undefined,
    error: response.ok ? undefined : resolveErrorMessage(response.status, json as Record<string, unknown>),
    reasonCode: response.ok ? undefined : pickString(json as Record<string, unknown>, ['reasonCode', 'errorCode']),
    messageDetail: response.ok ? undefined : pickString(json as Record<string, unknown>, ['messageDetail']),
  };
}

export async function fetchLetterList({ karteId }: { karteId: number }): Promise<LetterListResult> {
  const runId = ensureRunId();
  const endpoint = `/odletter/list/${encodeURIComponent(String(karteId))}`;
  const response = await httpFetch(endpoint);
  const json = (await parseJson(response)) as Record<string, unknown>;
  const list = Array.isArray(json.list) ? (json.list as LetterModulePayload[]) : [];
  return {
    ok: response.ok,
    runId,
    status: response.status,
    endpoint,
    letters: response.ok ? list : [],
    error: response.ok ? undefined : resolveErrorMessage(response.status, json as Record<string, unknown>),
    reasonCode: response.ok ? undefined : pickString(json as Record<string, unknown>, ['reasonCode', 'errorCode']),
    messageDetail: response.ok ? undefined : pickString(json as Record<string, unknown>, ['messageDetail']),
  };
}

export async function fetchLetterDetail({ letterId }: { letterId: number }): Promise<LetterDetailResult> {
  const runId = ensureRunId();
  const endpoint = `/odletter/letter/${encodeURIComponent(String(letterId))}`;
  const response = await httpFetch(endpoint);
  const json = (await parseJson(response)) as Record<string, unknown>;
  return {
    ok: response.ok,
    runId,
    status: response.status,
    endpoint,
    letter: response.ok ? (json as LetterModulePayload) : undefined,
    error: response.ok ? undefined : resolveErrorMessage(response.status, json as Record<string, unknown>),
    reasonCode: response.ok ? undefined : pickString(json as Record<string, unknown>, ['reasonCode', 'errorCode']),
    messageDetail: response.ok ? undefined : pickString(json as Record<string, unknown>, ['messageDetail']),
  };
}

export async function saveLetterModule({ payload }: { payload: LetterModulePayload }): Promise<LetterSaveResult> {
  const runId = ensureRunId();
  const endpoint = '/odletter/letter';
  const response = await httpFetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let json: Record<string, unknown> = {};
  if (!response.ok && raw.trim().startsWith('{')) {
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      json = {};
    }
  }
  return {
    ok: response.ok,
    runId,
    status: response.status,
    endpoint,
    letterId: response.ok ? parseNumeric(raw) : undefined,
    error: response.ok ? undefined : resolveErrorMessage(response.status, json),
    reasonCode: response.ok ? undefined : pickString(json, ['reasonCode', 'errorCode']),
    messageDetail: response.ok ? undefined : pickString(json, ['messageDetail']),
  };
}

export async function deleteLetter({ letterId }: { letterId: number }): Promise<ApiResultBase> {
  const runId = ensureRunId();
  const endpoint = `/odletter/letter/${encodeURIComponent(String(letterId))}`;
  const response = await httpFetch(endpoint, { method: 'DELETE' });
  let error: string | undefined;
  if (!response.ok) {
    const json = (await parseJson(response)) as Record<string, unknown>;
    error = resolveErrorMessage(response.status, json);
  }
  return {
    ok: response.ok,
    runId,
    status: response.status,
    endpoint,
    error,
  };
}
