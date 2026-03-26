import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';

export type PatientFreeDocumentPayload = {
  id?: number;
  facilityPatId?: string;
  confirmed?: number | string;
  comment?: string;
};

export type PatientFreeDocumentFetchResult = {
  ok: boolean;
  supported: boolean;
  runId: string;
  status: number;
  payload: PatientFreeDocumentPayload | null;
  error?: string;
};

export type PatientFreeDocumentSaveResult = {
  ok: boolean;
  supported: boolean;
  runId: string;
  status: number;
  error?: string;
};

const ensureRunId = (): string => {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  return runId;
};

const safeJsonParse = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
};

const resolveErrorText = (raw: string, fallback: string): string => {
  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : fallback;
};

export async function fetchPatientFreeDocument({ patientId }: { patientId: string }): Promise<PatientFreeDocumentFetchResult> {
  const runId = ensureRunId();
  const endpoint = `/api/karte/freedocument/${encodeURIComponent(patientId)}`;
  const response = await httpFetch(endpoint);
  const status = response.status;
  const raw = await response.text().catch(() => '');

  if (status === 404) {
    // server route itself is missing => feature not supported on this backend.
    return { ok: false, supported: false, runId, status, payload: null, error: 'NOT_SUPPORTED' };
  }
  if (!response.ok) {
    return {
      ok: false,
      supported: true,
      runId,
      status,
      payload: null,
      error: resolveErrorText(raw, response.statusText),
    };
  }

  const parsed = safeJsonParse(raw);
  if (parsed === null) {
    // 200 + empty or JSON "null" => supported but no record yet.
    return { ok: true, supported: true, runId, status, payload: null };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, supported: true, runId, status, payload: null, error: 'Unexpected response shape' };
  }

  const obj = parsed as Record<string, unknown>;
  const id = typeof obj.id === 'number' ? obj.id : typeof obj.id === 'string' ? Number(obj.id) : undefined;
  const confirmedRaw = obj.confirmed;
  const confirmed =
    typeof confirmedRaw === 'number'
      ? confirmedRaw
      : typeof confirmedRaw === 'string' && confirmedRaw.trim()
        ? confirmedRaw.trim()
        : undefined;
  const facilityPatId = typeof obj.facilityPatId === 'string' ? obj.facilityPatId : undefined;
  const comment = typeof obj.comment === 'string' ? obj.comment : undefined;

  return {
    ok: true,
    supported: true,
    runId,
    status,
    payload: {
      id: Number.isFinite(id ?? Number.NaN) ? (id as number) : undefined,
      facilityPatId,
      confirmed,
      comment,
    },
  };
}

export async function savePatientFreeDocument(params: {
  patientId: string;
  id?: number;
  confirmed?: number;
  comment: string;
}): Promise<PatientFreeDocumentSaveResult> {
  const runId = ensureRunId();
  const endpoint = '/api/karte/freedocument';
  const response = await httpFetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: params.id ?? 0,
      facilityPatId: params.patientId,
      confirmed: params.confirmed ?? Date.now(),
      comment: params.comment,
    }),
  });
  const status = response.status;
  const raw = await response.text().catch(() => '');

  if (status === 404) {
    return { ok: false, supported: false, runId, status, error: 'NOT_SUPPORTED' };
  }
  if (!response.ok) {
    return { ok: false, supported: true, runId, status, error: resolveErrorText(raw, response.statusText) };
  }
  return { ok: true, supported: true, runId, status };
}
