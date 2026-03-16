import { httpFetch } from '../../libs/http/httpClient';

export type MasterReferenceDatasetStatus = {
  code: string;
  name: string;
  status?: string;
  updateDetected?: boolean;
  lastSuccessfulAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  currentRecordCount?: number;
  currentVersionId?: string;
};

export type MasterReferenceStatusResponse = {
  runId?: string;
  generatedAt?: string;
  overallStatus?: string;
  datasets: MasterReferenceDatasetStatus[];
};

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const readErrorMessage = (json: unknown, fallback: string) => {
  if (!json || typeof json !== 'object') return fallback;
  const obj = json as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
  return fallback;
};

export async function fetchMasterReferenceStatus(): Promise<MasterReferenceStatusResponse> {
  const response = await httpFetch('/api/orca/master/reference/status', {
    method: 'GET',
    notifySessionExpired: false,
  });
  const json = (await safeJson(response)) as MasterReferenceStatusResponse;
  if (!response.ok) {
    throw new Error(readErrorMessage(json, `HTTP ${response.status}`));
  }
  return {
    ...json,
    datasets: Array.isArray(json.datasets) ? json.datasets : [],
  };
}

