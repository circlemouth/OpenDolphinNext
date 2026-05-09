import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta } from '../../libs/observability/observability';

export type CloseAndSendBillingResponse = {
  ok: boolean;
  status?: string;
  state?: string;
  encounterKey?: string;
  scheduleKey?: string;
  patientId?: string;
  snapshotId?: number;
  transmissionId?: number;
  idempotencyKey?: string;
  medicalUid?: string;
  apiResult?: string;
  apiResultMessage?: string;
  message?: string;
  confirmationRequired?: boolean;
  orderBundleCount?: number;
  medicalInformationCount?: number;
  diseaseSyncCount?: number;
  runId?: string;
  traceId?: string;
};

export async function closeAndSendToBilling(
  encounterKey: string,
  options: { idempotencyKey: string; runPrecheck?: boolean; signal?: AbortSignal },
): Promise<CloseAndSendBillingResponse> {
  const runId = getObservabilityMeta().runId;
  const response = await httpFetch(
    `/api/local/encounters/${encodeURIComponent(encounterKey)}/close-and-send-to-billing`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: options.idempotencyKey,
        runPrecheck: options.runPrecheck ?? false,
      }),
      signal: options.signal,
    },
  );
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: response.ok && json.ok === true,
    status: typeof json.status === 'string' ? json.status : undefined,
    state: typeof json.state === 'string' ? json.state : undefined,
    encounterKey: typeof json.encounterKey === 'string' ? json.encounterKey : undefined,
    scheduleKey: typeof json.scheduleKey === 'string' ? json.scheduleKey : undefined,
    patientId: typeof json.patientId === 'string' ? json.patientId : undefined,
    snapshotId: typeof json.snapshotId === 'number' ? json.snapshotId : undefined,
    transmissionId: typeof json.transmissionId === 'number' ? json.transmissionId : undefined,
    idempotencyKey: typeof json.idempotencyKey === 'string' ? json.idempotencyKey : undefined,
    medicalUid: typeof json.medicalUid === 'string' ? json.medicalUid : undefined,
    apiResult: typeof json.apiResult === 'string' ? json.apiResult : undefined,
    apiResultMessage: typeof json.apiResultMessage === 'string' ? json.apiResultMessage : undefined,
    message: typeof json.message === 'string' ? json.message : undefined,
    confirmationRequired: typeof json.confirmationRequired === 'boolean' ? json.confirmationRequired : undefined,
    orderBundleCount: typeof json.orderBundleCount === 'number' ? json.orderBundleCount : undefined,
    medicalInformationCount: typeof json.medicalInformationCount === 'number' ? json.medicalInformationCount : undefined,
    diseaseSyncCount: typeof json.diseaseSyncCount === 'number' ? json.diseaseSyncCount : undefined,
    runId: typeof json.runId === 'string' ? json.runId : runId,
    traceId: typeof json.traceId === 'string' ? json.traceId : getObservabilityMeta().traceId,
  };
}
