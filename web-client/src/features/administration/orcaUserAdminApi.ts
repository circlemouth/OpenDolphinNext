import { httpFetch } from '../../libs/http/httpClient';

export type OrcaAdminErrorKind = 'permission' | 'input' | 'conflict' | 'server' | 'network' | 'unknown';

export type OrcaAdminApiError = Error & {
  status?: number;
  apiResult?: string;
  apiResultMessage?: string;
  runId?: string;
  traceId?: string;
  kind: OrcaAdminErrorKind;
};

export type OrcaUserLinkStatus = {
  linked: boolean;
  ehrUserId?: string;
  ehrLoginId?: string;
  ehrDisplayName?: string;
};

export type OrcaAdminUser = {
  userId: string;
  fullName?: string;
  fullNameKana?: string;
  staffClass?: string;
  staffNumber?: string;
  isAdmin: boolean;
  link: OrcaUserLinkStatus;
};

export type OrcaSyncStatus = {
  running: boolean;
  lastSyncedAt?: string;
  syncedCount?: number;
  recentErrorSummary?: string;
};

export type OrcaUsersResponse = {
  ok: boolean;
  status: number;
  users: OrcaAdminUser[];
  syncStatus: OrcaSyncStatus;
  apiResult?: string;
  apiResultMessage?: string;
  runId?: string;
  traceId?: string;
};

export type OrcaAdminMutationResponse = {
  ok: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  runId?: string;
  traceId?: string;
  user?: OrcaAdminUser;
  syncStatus?: OrcaSyncStatus;
};

export type OrcaUserCreatePayload = {
  userId: string;
  password: string;
  staffClass: string;
  fullName: string;
  fullNameKana?: string;
  isAdmin?: boolean;
};

export type OrcaUserUpdatePayload = {
  password?: string;
  fullName?: string;
  fullNameKana?: string;
};

export type OrcaUserLinkPayload = {
  orcaUserId: string;
};

const ORCA_USERS_ENDPOINT = '/api/admin/orca/users';
const ORCA_SYNC_ENDPOINT = '/api/admin/orca/sync';

const USER_ID_PATTERN = /^[A-Za-z0-9_]+$/;

type ApiEnvelope = {
  ok: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  runId?: string;
  traceId?: string;
  message?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const getString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const getBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'enabled', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'disabled', 'off'].includes(normalized)) return false;
  return undefined;
};

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const pickString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = getString(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const pickBoolean = (record: Record<string, unknown>, keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const value = getBoolean(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const pickNumber = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = getNumber(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const isApiResultSuccess = (apiResult?: string) => {
  if (!apiResult) return true;
  return apiResult.startsWith('00');
};

const classifyErrorKind = (status?: number, apiResult?: string, message?: string): OrcaAdminErrorKind => {
  if (status === 401 || status === 403) return 'permission';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'input';
  if (typeof status === 'number' && status >= 500) return 'server';
  if (apiResult && /^[eE]/.test(apiResult)) {
    const hint = (message ?? '').toLowerCase();
    if (hint.includes('link') || hint.includes('conflict') || hint.includes('already')) {
      return 'conflict';
    }
    return 'input';
  }
  return 'unknown';
};

const toApiError = (envelope: ApiEnvelope): OrcaAdminApiError => {
  const message = envelope.message ?? `HTTP ${envelope.status}`;
  const error = new Error(message) as OrcaAdminApiError;
  error.status = envelope.status;
  error.apiResult = envelope.apiResult;
  error.apiResultMessage = envelope.apiResultMessage;
  error.runId = envelope.runId;
  error.traceId = envelope.traceId;
  error.kind = classifyErrorKind(envelope.status, envelope.apiResult, envelope.message);
  return error;
};

const toNetworkError = (cause: unknown): OrcaAdminApiError => {
  if (cause && typeof cause === 'object' && 'kind' in (cause as Record<string, unknown>)) {
    return cause as OrcaAdminApiError;
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  const error = new Error(message) as OrcaAdminApiError;
  error.kind = cause instanceof TypeError ? 'network' : 'unknown';
  return error;
};

const readJsonBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { rawText: text };
  }
};

const normalizeUser = (value: unknown): OrcaAdminUser | null => {
  const record = asRecord(value);
  if (!record) return null;
  const linkRecord = asRecord(record.link) ?? {};

  const userId = pickString(record, ['userId', 'User_Id', 'orcaUserId', 'orca_user_id', 'id']);
  if (!userId) return null;

  const ehrUserId =
    pickString(linkRecord, ['ehrUserId', 'linkedEhrUserId', 'ehr_user_id'])
    ?? pickString(record, ['ehrUserId', 'linkedEhrUserId', 'ehr_user_id']);

  const ehrLoginId =
    pickString(linkRecord, ['ehrLoginId', 'linkedLoginId', 'ehr_login_id'])
    ?? pickString(record, ['ehrLoginId', 'linkedLoginId', 'ehr_login_id']);

  const linkStatus =
    pickString(linkRecord, ['status', 'linkStatus'])
    ?? pickString(record, ['status', 'linkStatus']);

  const linked =
    pickBoolean(linkRecord, ['linked', 'isLinked'])
    ?? pickBoolean(record, ['linked', 'isLinked'])
    ?? Boolean(ehrUserId || (linkStatus ? linkStatus.toLowerCase() === 'linked' : false));

  return {
    userId,
    fullName: pickString(record, ['fullName', 'name', 'full_name', 'Name']),
    fullNameKana: pickString(record, ['fullNameKana', 'kana', 'nameKana', 'full_name_kana', 'Kana']),
    staffClass: pickString(record, ['staffClass', 'staffType', 'employeeType', 'classCode', 'staff_class']),
    staffNumber: pickString(record, ['staffNumber', 'employeeNumber', 'staffNo', 'staff_number']),
    isAdmin:
      pickBoolean(record, ['isAdmin', 'admin', 'adminFlag', 'managerFlag'])
      ?? pickBoolean(linkRecord, ['isAdmin'])
      ?? false,
    link: {
      linked,
      ehrUserId,
      ehrLoginId,
      ehrDisplayName:
        pickString(linkRecord, ['ehrDisplayName', 'displayName'])
        ?? pickString(record, ['ehrDisplayName', 'displayName']),
    },
  };
};

const normalizeSyncStatus = (body: Record<string, unknown>): OrcaSyncStatus => {
  const syncRecord = asRecord(body.syncStatus) ?? asRecord(body.sync) ?? body;
  return {
    running: pickBoolean(syncRecord, ['running', 'syncing', 'inProgress']) ?? false,
    lastSyncedAt: pickString(syncRecord, ['lastSyncedAt', 'lastSyncAt', 'syncedAt']),
    syncedCount: pickNumber(syncRecord, ['syncedCount', 'lastSyncCount', 'count']),
    recentErrorSummary: pickString(syncRecord, ['recentErrorSummary', 'lastError', 'errorSummary']),
  };
};

const normalizeEnvelope = (
  status: number,
  headers: Headers,
  body: Record<string, unknown>,
): Pick<ApiEnvelope, 'status' | 'apiResult' | 'apiResultMessage' | 'runId' | 'traceId' | 'message'> => {
  const apiResult = pickString(body, ['apiResult', 'Api_Result', 'api_result']);
  const apiResultMessage = pickString(body, ['apiResultMessage', 'Api_Result_Message', 'api_result_message']);
  return {
    status,
    apiResult,
    apiResultMessage,
    runId: pickString(body, ['runId']) ?? headers.get('x-run-id') ?? undefined,
    traceId: pickString(body, ['traceId']) ?? headers.get('x-trace-id') ?? undefined,
    message:
      apiResultMessage
      ?? pickString(body, ['error', 'message', 'errorMessage', 'detail'])
      ?? (status >= 400 ? `HTTP ${status}` : undefined),
  };
};

const normalizeUsersResponse = (status: number, body: unknown, headers: Headers): OrcaUsersResponse => {
  const payload = asRecord(body) ?? {};
  const usersRaw = Array.isArray(payload.users)
    ? payload.users
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(body)
          ? body
          : [];

  const users = usersRaw
    .map((entry) => normalizeUser(entry))
    .filter((entry): entry is OrcaAdminUser => Boolean(entry));

  const envelope = normalizeEnvelope(status, headers, payload);
  const ok = status >= 200 && status < 300 && isApiResultSuccess(envelope.apiResult);

  return {
    ok,
    status,
    users,
    syncStatus: normalizeSyncStatus(payload),
    apiResult: envelope.apiResult,
    apiResultMessage: envelope.apiResultMessage,
    runId: envelope.runId,
    traceId: envelope.traceId,
  };
};

const normalizeMutationResponse = (status: number, body: unknown, headers: Headers): OrcaAdminMutationResponse => {
  const payload = asRecord(body) ?? {};
  const envelope = normalizeEnvelope(status, headers, payload);
  const ok = status >= 200 && status < 300 && isApiResultSuccess(envelope.apiResult);

  const normalizedUser = normalizeUser(payload.user ?? payload.orcaUser ?? payload);

  return {
    ok,
    status,
    apiResult: envelope.apiResult,
    apiResultMessage: envelope.apiResultMessage,
    runId: envelope.runId,
    traceId: envelope.traceId,
    user: normalizedUser ?? undefined,
    syncStatus: normalizeSyncStatus(payload),
  };
};

const requestUsers = async (): Promise<OrcaUsersResponse> => {
  const response = await httpFetch(ORCA_USERS_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    notifySessionExpired: false,
  });
  const body = await readJsonBody(response);
  const normalized = normalizeUsersResponse(response.status, body, response.headers);
  if (!normalized.ok) {
    const payload = asRecord(body) ?? {};
    throw toApiError({
      ...normalizeEnvelope(response.status, response.headers, payload),
      ok: normalized.ok,
    });
  }
  return normalized;
};

const requestMutation = async (
  path: string,
  init: {
    method: 'POST' | 'PUT' | 'DELETE';
    body?: string;
  },
): Promise<OrcaAdminMutationResponse> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (init.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const response = await httpFetch(path, {
    method: init.method,
    headers,
    body: init.body,
    notifySessionExpired: false,
  });
  const body = await readJsonBody(response);
  const normalized = normalizeMutationResponse(response.status, body, response.headers);
  if (!normalized.ok) {
    const payload = asRecord(body) ?? {};
    throw toApiError({
      ...normalizeEnvelope(response.status, response.headers, payload),
      ok: normalized.ok,
    });
  }
  return normalized;
};

export const isValidOrcaUserId = (value: string) => USER_ID_PATTERN.test(value.trim());

export async function fetchOrcaUsers(): Promise<OrcaUsersResponse> {
  try {
    return await requestUsers();
  } catch (error) {
    throw toNetworkError(error);
  }
}

export async function syncOrcaUsers(): Promise<OrcaAdminMutationResponse> {
  try {
    return await requestMutation(ORCA_SYNC_ENDPOINT, { method: 'POST' });
  } catch (error) {
    throw toNetworkError(error);
  }
}

export async function linkEhrUserToOrca(ehrUserId: string, payload: OrcaUserLinkPayload): Promise<OrcaAdminMutationResponse> {
  const userId = payload.orcaUserId.trim();
  try {
    return await requestMutation(`/api/admin/users/${encodeURIComponent(ehrUserId)}/orca-link`, {
      method: 'PUT',
      body: JSON.stringify({
        orcaUserId: userId,
        userId,
        User_Id: userId,
      }),
    });
  } catch (error) {
    throw toNetworkError(error);
  }
}

export async function unlinkEhrUserFromOrca(ehrUserId: string): Promise<OrcaAdminMutationResponse> {
  try {
    return await requestMutation(`/api/admin/users/${encodeURIComponent(ehrUserId)}/orca-link`, {
      method: 'DELETE',
    });
  } catch (error) {
    throw toNetworkError(error);
  }
}

export async function createOrcaUser(payload: OrcaUserCreatePayload): Promise<OrcaAdminMutationResponse> {
  const userId = payload.userId.trim();
  const password = payload.password.trim();
  const staffClass = payload.staffClass.trim();
  const fullName = payload.fullName.trim();
  const fullNameKana = payload.fullNameKana?.trim();
  try {
    return await requestMutation(ORCA_USERS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        password,
        staffClass,
        fullName,
        fullNameKana: fullNameKana || undefined,
        isAdmin: payload.isAdmin,
        User_Id: userId,
        Password: password,
        Staff_Class: staffClass,
        WholeName: fullName,
        WholeName_inKana: fullNameKana || undefined,
        Admin_Flag: payload.isAdmin,
      }),
    });
  } catch (error) {
    throw toNetworkError(error);
  }
}

export async function updateOrcaUser(orcaUserId: string, payload: OrcaUserUpdatePayload): Promise<OrcaAdminMutationResponse> {
  const password = payload.password?.trim();
  const fullName = payload.fullName?.trim();
  const fullNameKana = payload.fullNameKana?.trim();
  try {
    return await requestMutation(`${ORCA_USERS_ENDPOINT}/${encodeURIComponent(orcaUserId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        password: password || undefined,
        fullName: fullName || undefined,
        fullNameKana: fullNameKana || undefined,
        Password: password || undefined,
        WholeName: fullName || undefined,
        WholeName_inKana: fullNameKana || undefined,
      }),
    });
  } catch (error) {
    throw toNetworkError(error);
  }
}

export async function deleteOrcaUser(orcaUserId: string): Promise<OrcaAdminMutationResponse> {
  try {
    return await requestMutation(`${ORCA_USERS_ENDPOINT}/${encodeURIComponent(orcaUserId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    throw toNetworkError(error);
  }
}
