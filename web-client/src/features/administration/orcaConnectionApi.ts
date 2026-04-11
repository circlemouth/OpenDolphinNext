import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta, getObservabilityMeta } from '../../libs/observability/observability';

export type OrcaConnectionConfigResponse = {
  ok: boolean;
  status: number;
  facilityId?: string;
  defaultFacilityId?: string;
  useWeborca?: boolean;
  serverUrl?: string;
  port?: number;
  username?: string;
  pushUrl?: string;
  pushTenantId?: string;
  pushConfigured?: boolean;
  passwordConfigured?: boolean;
  passwordUpdatedAt?: string;
  clientAuthEnabled?: boolean;
  clientCertificateConfigured?: boolean;
  clientCertificateFileName?: string;
  clientCertificateUploadedAt?: string;
  clientCertificatePassphraseConfigured?: boolean;
  clientCertificatePassphraseUpdatedAt?: string;
  caCertificateConfigured?: boolean;
  caCertificateFileName?: string;
  caCertificateUploadedAt?: string;
  updatedAt?: string;
  auditSummary?: string;
  runId?: string;
  traceId?: string;
  error?: string;
};

export type OrcaConnectionSaveRequest = {
  useWeborca: boolean;
  serverUrl: string;
  port: number;
  username: string;
  pushUrl?: string;
  pushTenantId?: string;
  password?: string;
  clientAuthEnabled: boolean;
  clientCertificatePassphrase?: string;
  clientCertificateFile?: File | null;
  caCertificateFile?: File | null;
};

export type OrcaConnectionTestResponse = {
  ok: boolean;
  status: number;
  orcaHttpStatus?: number;
  apiResult?: string;
  apiResultMessage?: string;
  errorCategory?: string;
  error?: string;
  testedAt?: string;
  runId?: string;
  traceId?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const getBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const getNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeConfig = (
  status: number,
  ok: boolean,
  json: unknown,
  beforeMeta: { runId?: string; traceId?: string },
): OrcaConnectionConfigResponse => {
  const body = asRecord(json) ?? {};
  const runId = getString(body.runId) ?? getObservabilityMeta().runId ?? beforeMeta.runId;
  const traceId = getString(body.traceId) ?? getObservabilityMeta().traceId ?? beforeMeta.traceId;
  const error = getString(body.error ?? body.message ?? body.errorMessage ?? body.code);
  const payloadOk = getBoolean(body.ok);
  const resolvedOk = ok && (payloadOk === undefined ? true : payloadOk);

  return {
    ok: resolvedOk,
    status,
    facilityId: getString(body.facilityId),
    defaultFacilityId: getString(body.defaultFacilityId),
    useWeborca: getBoolean(body.useWeborca),
    serverUrl: getString(body.serverUrl),
    port: getNumber(body.port),
    username: getString(body.username),
    pushUrl: getString(body.pushUrl),
    pushTenantId: getString(body.pushTenantId),
    pushConfigured: getBoolean(body.pushConfigured),
    passwordConfigured: getBoolean(body.passwordConfigured),
    passwordUpdatedAt: getString(body.passwordUpdatedAt),
    clientAuthEnabled: getBoolean(body.clientAuthEnabled),
    clientCertificateConfigured: getBoolean(body.clientCertificateConfigured),
    clientCertificateFileName: getString(body.clientCertificateFileName),
    clientCertificateUploadedAt: getString(body.clientCertificateUploadedAt),
    clientCertificatePassphraseConfigured: getBoolean(body.clientCertificatePassphraseConfigured),
    clientCertificatePassphraseUpdatedAt: getString(body.clientCertificatePassphraseUpdatedAt),
    caCertificateConfigured: getBoolean(body.caCertificateConfigured),
    caCertificateFileName: getString(body.caCertificateFileName),
    caCertificateUploadedAt: getString(body.caCertificateUploadedAt),
    updatedAt: getString(body.updatedAt),
    auditSummary: getString(body.auditSummary),
    runId,
    traceId,
    error: !resolvedOk ? error ?? `HTTP ${status}` : undefined,
  };
};

const normalizeTest = (
  status: number,
  ok: boolean,
  json: unknown,
  beforeMeta: { runId?: string; traceId?: string },
): OrcaConnectionTestResponse => {
  const body = asRecord(json) ?? {};
  const runId = getString(body.runId) ?? getObservabilityMeta().runId ?? beforeMeta.runId;
  const traceId = getString(body.traceId) ?? getObservabilityMeta().traceId ?? beforeMeta.traceId;
  const payloadOk = getBoolean(body.ok);
  const resolvedOk = ok && (payloadOk === undefined ? true : payloadOk);
  const error = getString(body.error ?? body.message ?? body.errorMessage);
  return {
    ok: resolvedOk,
    status,
    orcaHttpStatus: getNumber(body.orcaHttpStatus),
    apiResult: getString(body.apiResult),
    apiResultMessage: getString(body.apiResultMessage),
    errorCategory: getString(body.errorCategory),
    error: !resolvedOk ? error ?? `HTTP ${status}` : undefined,
    testedAt: getString(body.testedAt),
    runId,
    traceId,
  };
};

export async function fetchOrcaConnectionConfig(): Promise<OrcaConnectionConfigResponse> {
  const beforeMeta = ensureObservabilityMeta();
  const response = await httpFetch('/api/admin/orca/connection', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return normalizeConfig(response.status, response.ok, json, beforeMeta);
}

export async function saveOrcaConnectionConfig(req: OrcaConnectionSaveRequest): Promise<OrcaConnectionConfigResponse> {
  const beforeMeta = ensureObservabilityMeta();
  const form = new FormData();
  const configPayload: Record<string, unknown> = {
    useWeborca: req.useWeborca,
    serverUrl: req.serverUrl,
    port: req.port,
    username: req.username,
    pushUrl: req.pushUrl?.trim() || undefined,
    pushTenantId: req.pushTenantId?.trim() || undefined,
    clientAuthEnabled: req.clientAuthEnabled,
  };
  const password = req.password?.trim();
  if (password) {
    configPayload.password = password;
  }
  const passphrase = req.clientCertificatePassphrase?.trim();
  if (passphrase) {
    configPayload.clientCertificatePassphrase = passphrase;
  }
  form.append('config', JSON.stringify(configPayload));
  if (req.clientCertificateFile) {
    form.append('clientCertificate', req.clientCertificateFile);
  }
  if (req.caCertificateFile) {
    form.append('caCertificate', req.caCertificateFile);
  }

  const response = await httpFetch('/api/admin/orca/connection', {
    method: 'PUT',
    headers: { Accept: 'application/json' },
    body: form,
    notifySessionExpired: false,
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return normalizeConfig(response.status, response.ok, json, beforeMeta);
}

export async function testOrcaConnection(): Promise<OrcaConnectionTestResponse> {
  const beforeMeta = ensureObservabilityMeta();
  const response = await httpFetch('/api/admin/orca/connection/test', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return normalizeTest(response.status, response.ok, json, beforeMeta);
}
