import type { QueryFunctionContext } from '@tanstack/react-query';

import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import type { DataSourceTransition, ResolveMasterSource } from '../../libs/observability/types';
import { normalizeBoolean } from './transformers';
import type { OutpatientMeta } from './types';

export type FetchCandidate = {
  path: string;
  source: ResolveMasterSource;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: HeadersInit;
};

export type FetchWithResolverOptions = {
  candidates: FetchCandidate[];
  body?: Record<string, unknown>;
  method?: FetchCandidate['method'];
  headers?: HeadersInit;
  queryContext?: QueryFunctionContext;
  preferredSource?: ResolveMasterSource;
  description?: string;
};

export type FetchWithResolverResult = {
  raw: Record<string, unknown>;
  meta: OutpatientMeta;
  ok: boolean;
  error?: string;
};

const orderCandidates = (candidates: FetchCandidate[], preferred?: ResolveMasterSource) => {
  if (!preferred) return candidates;
  const preferredOnes = candidates.filter((candidate) => candidate.source === preferred);
  const others = candidates.filter((candidate) => candidate.source !== preferred);
  return [...preferredOnes, ...others];
};

export async function fetchWithResolver(options: FetchWithResolverOptions): Promise<FetchWithResolverResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });

  const cacheHitHint = options.queryContext?.meta?.servedFromCache === true ? true : undefined;
  const retryCount = (options.queryContext?.meta?.retryCount as number | undefined) ?? undefined;
  const abortSignal = options.queryContext?.signal;
  const orderedCandidates = orderCandidates(options.candidates, options.preferredSource);
  const fallbackSource = (options.preferredSource ?? orderedCandidates[0]?.source ?? 'snapshot') as ResolveMasterSource;
  const isAbortError = (error: unknown) =>
    error instanceof DOMException
      ? error.name === 'AbortError'
      : typeof error === 'object' && error !== null && 'name' in error
        ? (error as { name?: string }).name === 'AbortError'
        : typeof error === 'string'
          ? error.toLowerCase().includes('abort')
          : error instanceof Error
            ? error.message.toLowerCase().includes('abort')
            : false;

  let lastResult: FetchWithResolverResult | undefined;

  for (const candidate of orderedCandidates) {
    try {
      const method = candidate.method ?? options.method ?? 'POST';
      const body = method === 'GET' ? undefined : options.body ? JSON.stringify(options.body) : undefined;
      const suppressSessionExpiry = candidate.path.startsWith('/api/orca');
      const fetchOnce = async (signal?: AbortSignal) => {
        const response = await httpFetch(candidate.path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
            ...(candidate.headers ?? {}),
          },
          body,
          signal,
          notifySessionExpired: suppressSessionExpiry ? false : undefined,
        });
        const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        return { response, json };
      };

      const responseResult = await fetchOnce(abortSignal);
      const response = responseResult.response;
      const json = responseResult.json;
      const after = getObservabilityMeta();
      const missingMaster = normalizeBoolean(json.missingMaster) ?? false;
      const fallbackUsed = normalizeBoolean(json.fallbackUsed) ?? false;
      const meta: OutpatientMeta = {
        runId: (json.runId as string | undefined) ?? after.runId ?? runId,
        traceId: (json.traceId as string | undefined) ?? after.traceId,
        requestId: typeof json.requestId === 'string' ? (json.requestId as string) : undefined,
        dataSourceTransition: (json.dataSourceTransition as DataSourceTransition | undefined) ?? candidate.source,
        resolveMasterSource: candidate.source,
        cacheHit: normalizeBoolean(json.cacheHit ?? cacheHitHint ?? after.cacheHit),
        // Missing flags must not inherit stale state from a previous request.
        missingMaster,
        fallbackUsed,
        fallbackFlagMissing: json.fallbackUsed === undefined ? true : undefined,
        fetchedAt: (json.fetchedAt as string | undefined) ?? after.fetchedAt,
        recordsReturned: typeof json.recordsReturned === 'number' ? (json.recordsReturned as number) : undefined,
        outcome: typeof json.outcome === 'string' ? (json.outcome as string) : undefined,
        fromCache: cacheHitHint,
        retryCount,
        sourcePath: candidate.path,
        httpStatus: response.status,
        auditEvent: (json.auditEvent as Record<string, unknown> | undefined) ?? undefined,
        abortRetryAttempted: false,
        abortRetryReason: undefined,
        abortSignalAborted: abortSignal?.aborted,
      };

      updateObservabilityMeta({
        runId: meta.runId,
        traceId: meta.traceId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        dataSourceTransition: meta.dataSourceTransition,
        fallbackUsed: meta.fallbackUsed,
        fetchedAt: meta.fetchedAt,
        recordsReturned: meta.recordsReturned,
      });

      const ok = response.ok;
      const result: FetchWithResolverResult = {
        raw: json,
        meta,
        ok,
        error: ok ? undefined : `status ${response.status}`,
      };

      if (ok) {
        return result;
      }
      lastResult = result;
    } catch (error) {
      if (isAbortError(error) && abortSignal && !abortSignal.aborted) {
        try {
          const method = candidate.method ?? options.method ?? 'POST';
          const body = method === 'GET' ? undefined : options.body ? JSON.stringify(options.body) : undefined;
          const suppressSessionExpiry = candidate.path.startsWith('/api/orca');
          const response = await httpFetch(candidate.path, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...(options.headers ?? {}),
              ...(candidate.headers ?? {}),
            },
            body,
            notifySessionExpired: suppressSessionExpiry ? false : undefined,
          });
          const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          const after = getObservabilityMeta();
          const missingMaster = normalizeBoolean(json.missingMaster) ?? false;
          const fallbackUsed = normalizeBoolean(json.fallbackUsed) ?? false;
          const meta: OutpatientMeta = {
            runId: (json.runId as string | undefined) ?? after.runId ?? runId,
            traceId: (json.traceId as string | undefined) ?? after.traceId,
            requestId: typeof json.requestId === 'string' ? (json.requestId as string) : undefined,
            dataSourceTransition: (json.dataSourceTransition as DataSourceTransition | undefined) ?? candidate.source,
            resolveMasterSource: candidate.source,
            cacheHit: normalizeBoolean(json.cacheHit ?? cacheHitHint ?? after.cacheHit),
            // Missing flags must not inherit stale state from a previous request.
            missingMaster,
            fallbackUsed,
            fallbackFlagMissing: json.fallbackUsed === undefined ? true : undefined,
            fetchedAt: (json.fetchedAt as string | undefined) ?? after.fetchedAt,
            recordsReturned: typeof json.recordsReturned === 'number' ? (json.recordsReturned as number) : undefined,
            outcome: typeof json.outcome === 'string' ? (json.outcome as string) : undefined,
            fromCache: cacheHitHint,
            retryCount,
            sourcePath: candidate.path,
            httpStatus: response.status,
            auditEvent: (json.auditEvent as Record<string, unknown> | undefined) ?? undefined,
            abortRetryAttempted: true,
            abortRetryReason: error instanceof Error ? error.message : String(error),
            abortSignalAborted: abortSignal?.aborted,
          };

          updateObservabilityMeta({
            runId: meta.runId,
            traceId: meta.traceId,
            cacheHit: meta.cacheHit,
            missingMaster: meta.missingMaster,
            dataSourceTransition: meta.dataSourceTransition,
            fallbackUsed: meta.fallbackUsed,
            fetchedAt: meta.fetchedAt,
            recordsReturned: meta.recordsReturned,
          });

          const ok = response.ok;
          const result: FetchWithResolverResult = {
            raw: json,
            meta,
            ok,
            error: ok ? undefined : `status ${response.status}`,
          };

          if (ok) {
            return result;
          }
          lastResult = result;
          continue;
        } catch (retryError) {
          lastResult = {
            raw: {},
            meta: {
              runId,
              dataSourceTransition: candidate.source ?? fallbackSource,
              resolveMasterSource: candidate.source ?? fallbackSource,
              cacheHit: cacheHitHint,
              fromCache: cacheHitHint,
              retryCount,
              sourcePath: candidate.path,
              httpStatus: 0,
              abortRetryAttempted: true,
              abortRetryReason: retryError instanceof Error ? retryError.message : String(retryError),
              abortSignalAborted: abortSignal?.aborted,
            },
            ok: false,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          };
          continue;
        }
      }
      lastResult = {
        raw: {},
        meta: {
          runId,
          dataSourceTransition: candidate.source ?? fallbackSource,
          resolveMasterSource: candidate.source ?? fallbackSource,
          cacheHit: cacheHitHint,
          fromCache: cacheHitHint,
          retryCount,
          sourcePath: candidate.path,
          httpStatus: 0,
          abortSignalAborted: abortSignal?.aborted,
        },
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const fallbackMeta: OutpatientMeta = {
    runId,
    dataSourceTransition: fallbackSource,
    resolveMasterSource: fallbackSource,
    cacheHit: cacheHitHint,
    fromCache: cacheHitHint,
    fallbackFlagMissing: lastResult?.meta.fallbackFlagMissing,
    retryCount,
    ...(lastResult?.meta ?? {}),
  };

  updateObservabilityMeta({
    runId: fallbackMeta.runId,
    cacheHit: fallbackMeta.cacheHit,
    missingMaster: fallbackMeta.missingMaster,
    dataSourceTransition: fallbackMeta.dataSourceTransition,
    fallbackUsed: fallbackMeta.fallbackUsed,
    fetchedAt: fallbackMeta.fetchedAt,
    recordsReturned: fallbackMeta.recordsReturned,
  });

  return lastResult ?? { raw: {}, meta: fallbackMeta, ok: false, error: 'no response' };
}
