import { httpFetch } from '../../libs/http/httpClient';

const BASE = '/api/admin/master-updates';

export type MasterUpdateDatasetVersion = {
  versionId: string;
  capturedAt?: string;
  status?: string;
  hash?: string;
  recordCount?: number;
  artifactPath?: string;
  sourceUrl?: string;
  sourceKind?: 'official_fetch' | 'local_upload' | string;
  summary?: string;
  triggerType?: string;
  requestedBy?: string;
  runId?: string;
  addedCount?: number;
  removedCount?: number;
  changedCount?: number;
  note?: string;
  current?: boolean;
};

export type MasterUpdateOfficialSource = {
  kind?: string;
  label?: string;
  sourceUrl?: string;
  updateFrequency?: string;
  format?: string;
  usageNotes?: string;
  lastCheckedAt?: string;
  lastPolledAt?: string;
  updateDetected?: boolean;
  latestRunId?: string;
  latestJobMessage?: string;
  officialLastUpdateDate?: string;
  officialCapturedAt?: string;
  officialSummary?: string;
};

export type MasterUpdateLocalArtifacts = {
  manualUploadAllowed?: boolean;
  currentVersionId?: string;
  currentRecordCount?: number;
  currentCapturedAt?: string;
  currentHash?: string;
  currentSummary?: string;
  currentArtifactPath?: string;
  versionCount?: number;
  versions?: MasterUpdateDatasetVersion[];
};

export type MasterUpdateDataset = {
  code: string;
  name: string;
  sourceUrl?: string;
  updateFrequency?: string;
  format?: string;
  usageNotes?: string;
  active?: boolean;
  autoEnabled?: boolean;
  manualUploadAllowed?: boolean;
  status?: string;
  lastCheckedAt?: string;
  lastSuccessfulAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  latestRunId?: string;
  latestJobMessage?: string;
  currentVersionId?: string;
  currentRecordCount?: number;
  currentCapturedAt?: string;
  currentHash?: string;
  currentSummary?: string;
  updateDetected?: boolean;
  lastAutoRunAt?: string;
  lastPolledAt?: string;
  running?: boolean;
  versionCount?: number;
  versions?: MasterUpdateDatasetVersion[];
  officialSource?: MasterUpdateOfficialSource;
  localArtifacts?: MasterUpdateLocalArtifacts;
};

export type MasterUpdateSchedule = {
  autoUpdateTime: string;
  retryCount: number;
  timeoutSeconds: number;
  maxConcurrency: number;
  orcaPollIntervalMinutes: number;
  datasetAutoEnabledOverrides: Record<string, boolean | null>;
};

export type MasterUpdateDatasetListResponse = {
  runId?: string;
  generatedAt?: string;
  datasets: MasterUpdateDataset[];
  schedule?: MasterUpdateSchedule;
};

export type MasterUpdateDatasetDetailResponse = {
  runId?: string;
  generatedAt?: string;
  dataset: MasterUpdateDataset;
};

export type MasterUpdateActionResponse = {
  runId?: string;
  ok: boolean;
  message?: string;
  dataset: MasterUpdateDataset;
  triggerType?: string;
  artifactPath?: string;
};

export type MasterUpdateUploadPreview = {
  runId?: string;
  importable?: boolean;
  uploadedSha256?: string;
  importedRows?: number;
  affectedMasterTypes?: string[];
  masterTypeCounts?: Record<string, number>;
  sourceKind?: string;
  sourceId?: string;
  masterVersion?: string;
  generatedAt?: string;
  artifactSha256?: string;
  warnings?: string[];
};

export type MasterUpdateUploadPreviewResponse = {
  runId?: string;
  ok: boolean;
  message?: string;
  datasetCode?: string;
  preview?: MasterUpdateUploadPreview;
};

export type MasterUpdateScheduleResponse = {
  runId?: string;
  generatedAt?: string;
  schedule: MasterUpdateSchedule;
};

const safeJson = async (response: Response) => {
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

const requireOk = async <T>(response: Response): Promise<T> => {
  const json = (await safeJson(response)) as T;
  if (!response.ok) {
    const message = readErrorMessage(json, `HTTP ${response.status}`);
    throw new Error(message);
  }
  return json;
};

export async function fetchMasterUpdateDatasets(): Promise<MasterUpdateDatasetListResponse> {
  const response = await httpFetch(`${BASE}/datasets`, { method: 'GET', notifySessionExpired: false });
  return requireOk<MasterUpdateDatasetListResponse>(response);
}

export async function fetchMasterUpdateDatasetDetail(datasetCode: string): Promise<MasterUpdateDatasetDetailResponse> {
  const response = await httpFetch(`${BASE}/datasets/${encodeURIComponent(datasetCode)}`, {
    method: 'GET',
    notifySessionExpired: false,
  });
  return requireOk<MasterUpdateDatasetDetailResponse>(response);
}

export async function runMasterUpdateDataset(datasetCode: string, force = false): Promise<MasterUpdateActionResponse> {
  const response = await httpFetch(`${BASE}/datasets/${encodeURIComponent(datasetCode)}/run`, {
    method: 'POST',
    notifySessionExpired: false,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ force }),
  });
  return requireOk<MasterUpdateActionResponse>(response);
}

export async function rollbackMasterUpdateDataset(
  datasetCode: string,
  versionId: string,
): Promise<MasterUpdateActionResponse> {
  const response = await httpFetch(`${BASE}/datasets/${encodeURIComponent(datasetCode)}/rollback`, {
    method: 'POST',
    notifySessionExpired: false,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ versionId }),
  });
  return requireOk<MasterUpdateActionResponse>(response);
}

export async function uploadMasterUpdateDataset(
  datasetCode: string,
  file: File,
  previewHash?: string,
): Promise<MasterUpdateActionResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const headers: Record<string, string> = {};
  if (previewHash) {
    headers['X-Master-Artifact-Preview-Hash'] = previewHash;
  }
  const response = await httpFetch(`${BASE}/datasets/${encodeURIComponent(datasetCode)}/upload`, {
    method: 'POST',
    notifySessionExpired: false,
    headers,
    body: formData,
  });
  return requireOk<MasterUpdateActionResponse>(response);
}

export async function previewMasterUpdateDatasetUpload(
  datasetCode: string,
  file: File,
): Promise<MasterUpdateUploadPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await httpFetch(`${BASE}/datasets/${encodeURIComponent(datasetCode)}/upload/preview`, {
    method: 'POST',
    notifySessionExpired: false,
    body: formData,
  });
  return requireOk<MasterUpdateUploadPreviewResponse>(response);
}

export async function fetchMasterUpdateSchedule(): Promise<MasterUpdateScheduleResponse> {
  const response = await httpFetch(`${BASE}/schedule`, { method: 'GET', notifySessionExpired: false });
  return requireOk<MasterUpdateScheduleResponse>(response);
}

export async function saveMasterUpdateSchedule(schedule: Partial<MasterUpdateSchedule>): Promise<MasterUpdateScheduleResponse> {
  const response = await httpFetch(`${BASE}/schedule`, {
    method: 'PUT',
    notifySessionExpired: false,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(schedule),
  });
  return requireOk<MasterUpdateScheduleResponse>(response);
}
