export type DataSourceTransition = 'mock' | 'snapshot' | 'server' | 'fallback' | 'local';

// dataSourceTransition と同じ語彙で master ソースの決定を表現する。
export type ResolveMasterSource = DataSourceTransition;

export type LiveRegionAria = 'off' | 'polite' | 'assertive';
export type LiveRegionTone = 'info' | 'warning' | 'error' | 'success';

export type ObservabilityMeta = {
  runId?: string;
  traceId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  dataSourceTransition?: DataSourceTransition;
  fallbackUsed?: boolean;
  fetchedAt?: string;
  recordsReturned?: number;
};
