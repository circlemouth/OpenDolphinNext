import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import type { OrcaResponseErrorKind, ParsedOrcaApiResponse } from '../shared/orcaApiResponse';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';
import { refetchOfficialCanonicalPatients, type PatientRecord } from '../patients/api';

export type OrcaPatientImportResult = {
  ok: boolean;
  writeAccepted?: boolean;
  businessOk?: boolean;
  runId: string;
  status: number;
  payload?: any;
  canonicalPatients?: PatientRecord[];
  canonicalRefetch?: {
    source: 'patientlst2v2';
    ok: boolean;
    status?: number;
    apiResult?: string;
    apiResultMessage?: string;
    expectedPatientIds: string[];
    matchedPatientIds: string[];
    missingPatientIds: string[];
  };
  error?: string;
  errorCode?: string;
  errorKind?: OrcaResponseErrorKind;
  errorCategory?: string;
  routeMismatch?: boolean;
  importSummary?: {
    apiResult?: string;
    apiResultMessage?: string;
    requestedCount?: number;
    fetchedCount?: number;
    createdCount?: number;
    updatedCount?: number;
    importedCount?: number;
    skippedCount?: number;
    errorsCount: number;
  };
};

const resolveAuthFailureReason = (parsed: ParsedOrcaApiResponse): string => {
  if (parsed.errorCode) return parsed.errorCode;
  const reason = parsed.json && typeof parsed.json.reason === 'string' ? parsed.json.reason.trim() : '';
  if (reason.length > 0) return reason;
  return 'authentication_failed';
};

const resolveImportFailureMessage = (parsed: ParsedOrcaApiResponse): string => {
  if (parsed.errorKind === 'auth') {
    const reason = resolveAuthFailureReason(parsed);
    return `ORCA認証エラーで患者取込に失敗しました（reason=${reason}）。ORCA認証情報を確認してください。`;
  }
  if (parsed.errorKind === 'route_not_found' || parsed.routeMismatch) {
    return '患者取込APIの経路不一致を検知しました。server-modernized の ORCA official route taxonomy を確認してください。';
  }
  return parsed.message ?? `HTTP ${parsed.status}`;
};

const normalizeCount = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
};

const extractImportSummary = (json: Record<string, unknown>) => {
  const errors = Array.isArray(json.errors) ? json.errors : [];
  const createdCount = normalizeCount(json.createdCount);
  const updatedCount = normalizeCount(json.updatedCount);
  return {
    apiResult: typeof json.apiResult === 'string' ? json.apiResult : undefined,
    apiResultMessage: typeof json.apiResultMessage === 'string' ? json.apiResultMessage : undefined,
    requestedCount: normalizeCount(json.requestedCount),
    fetchedCount: normalizeCount(json.fetchedCount),
    createdCount,
    updatedCount,
    importedCount:
      createdCount !== undefined && updatedCount !== undefined ? createdCount + updatedCount : undefined,
    skippedCount: normalizeCount(json.skippedCount),
    errorsCount: errors.length,
  };
};

const normalizeExpectedPatientIds = (patientIds: string[]) => {
  return Array.from(new Set(patientIds.map((patientId) => patientId.trim()).filter(Boolean)));
};

const formatImportCount = (value: number | undefined) => (value === undefined ? '—' : String(value));

const formatImportSummaryMetrics = (
  summary: ReturnType<typeof extractImportSummary>,
  expectedPatientIdsCount: number,
) => {
  return [
    `入力 ${expectedPatientIdsCount}`,
    `requested ${formatImportCount(summary.requestedCount)}`,
    `fetched ${formatImportCount(summary.fetchedCount)}`,
    `imported ${formatImportCount(summary.importedCount)}`,
    `skipped ${formatImportCount(summary.skippedCount)}`,
    `errors ${summary.errorsCount}`,
  ].join(' / ');
};

const resolveImportPartialMessage = (
  summary: ReturnType<typeof extractImportSummary>,
  expectedPatientIdsCount: number,
  reason: string,
) => {
  return `ORCA既存患者取込は ${reason}ため同期確認済みにできません（${formatImportSummaryMetrics(summary, expectedPatientIdsCount)}）。`;
};

const evaluateImportBusinessSuccess = (options: {
  parsedBusinessOk: boolean;
  summary: ReturnType<typeof extractImportSummary>;
  expectedPatientIdsCount: number;
}) => {
  const { parsedBusinessOk, summary, expectedPatientIdsCount } = options;

  if (!parsedBusinessOk) {
    const apiResult = summary.apiResult ?? '—';
    const apiResultMessage = summary.apiResultMessage ? ` / message=${summary.apiResultMessage}` : '';
    return {
      ok: false as const,
      errorCategory: 'business_partial' as const,
      error: resolveImportPartialMessage(
        summary,
        expectedPatientIdsCount,
        `Api_Result=${apiResult}${apiResultMessage} で business success ではない`,
      ),
    };
  }

  if (summary.errorsCount !== 0) {
    return {
      ok: false as const,
      errorCategory: 'business_partial' as const,
      error: resolveImportPartialMessage(summary, expectedPatientIdsCount, `errors=${summary.errorsCount} が返された`),
    };
  }

  if (summary.skippedCount === undefined) {
    return {
      ok: false as const,
      errorCategory: 'business_partial' as const,
      error: resolveImportPartialMessage(summary, expectedPatientIdsCount, 'skippedCount を確認できず full success を判定できない'),
    };
  }

  if (summary.skippedCount !== 0) {
    return {
      ok: false as const,
      errorCategory: 'business_partial' as const,
      error: resolveImportPartialMessage(summary, expectedPatientIdsCount, `skippedCount=${summary.skippedCount} が返された`),
    };
  }

  if (
    summary.requestedCount === undefined
    || summary.fetchedCount === undefined
    || summary.importedCount === undefined
  ) {
    return {
      ok: false as const,
      errorCategory: 'business_partial' as const,
      error: resolveImportPartialMessage(summary, expectedPatientIdsCount, 'requested/fetched/imported count を確認できず'),
    };
  }

  if (summary.requestedCount !== expectedPatientIdsCount) {
    return {
      ok: false as const,
      errorCategory: 'business_partial' as const,
      error: resolveImportPartialMessage(
        summary,
        expectedPatientIdsCount,
        `入力 patientIds=${expectedPatientIdsCount} と requestedCount=${summary.requestedCount} が一致しない`,
      ),
    };
  }

  if (summary.requestedCount !== summary.fetchedCount || summary.fetchedCount !== summary.importedCount) {
    return {
      ok: false as const,
      errorCategory: 'business_partial' as const,
      error: resolveImportPartialMessage(summary, expectedPatientIdsCount, 'requested/fetched/imported の件数整合が取れない'),
    };
  }

  return {
    ok: true as const,
  };
};

export async function importPatientsFromOrca(params: {
  patientIds: string[];
  includeInsurance?: boolean;
  runId?: string;
}): Promise<OrcaPatientImportResult> {
  const runId = params.runId ?? getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const expectedPatientIds = normalizeExpectedPatientIds(params.patientIds ?? []);

  if (!expectedPatientIds.length) {
    return { ok: false, writeAccepted: false, businessOk: false, runId, status: 0, error: 'patientIds is required' };
  }

  let response: Response;
  try {
    response = await httpFetch('/api/orca/official/patients/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientIds: params.patientIds,
        includeInsurance: Boolean(params.includeInsurance),
      }),
      // 患者取込 API は ORCA 側認証が失敗してもアプリ全体のセッション失効扱いにしない。
      notifySessionExpired: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      writeAccepted: false,
      businessOk: false,
      runId,
      status: 0,
      error: `患者取込APIへの接続に失敗しました: ${message}`,
      errorKind: 'http',
      routeMismatch: false,
    };
  }

  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '患者取り込みに失敗しました。' });
  const resolvedRunId = parsed.runId ?? runId;
  if (!parsed.ok) {
    return {
      ok: false,
      writeAccepted: false,
      businessOk: false,
      runId: resolvedRunId,
      status: parsed.status,
      payload: parsed.json ?? parsed.text,
      error: resolveImportFailureMessage(parsed),
      errorCode: parsed.errorCode,
      errorKind: parsed.errorKind,
      errorCategory: typeof parsed.json?.errorCategory === 'string' ? parsed.json.errorCategory : undefined,
      routeMismatch: parsed.routeMismatch,
    };
  }

  if (!parsed.json) {
    return {
      ok: false,
      writeAccepted: false,
      businessOk: false,
      runId: resolvedRunId,
      status: parsed.status,
      payload: parsed.text,
      error: '患者取り込みAPIがJSON以外を返しました。プロキシ設定を確認してください。',
      errorCode: parsed.errorCode,
      errorKind: 'route_not_found',
      routeMismatch: true,
    };
  }

  const importSummary = extractImportSummary(parsed.json);
  const businessEvaluation = evaluateImportBusinessSuccess({
    parsedBusinessOk: parsed.businessOk === true,
    summary: importSummary,
    expectedPatientIdsCount: expectedPatientIds.length,
  });
  if (!businessEvaluation.ok) {
    return {
      ok: false,
      writeAccepted: true,
      businessOk: false,
      runId: resolvedRunId,
      status: parsed.status,
      payload: parsed.json,
      error: businessEvaluation.error,
      errorCategory: businessEvaluation.errorCategory,
      routeMismatch: false,
      importSummary,
    };
  }

  const canonicalRefetch = await refetchOfficialCanonicalPatients({
    patientIds: expectedPatientIds,
    runId: resolvedRunId,
  });
  const canonicalReadbackOk =
    canonicalRefetch.ok && expectedPatientIds.every((patientId) => canonicalRefetch.matchedPatientIds.includes(patientId));

  return {
    ok: canonicalReadbackOk,
    writeAccepted: true,
    businessOk: true,
    runId: resolvedRunId,
    status: parsed.status,
    payload: parsed.json,
    canonicalPatients: canonicalRefetch.patients,
    canonicalRefetch: {
      source: 'patientlst2v2',
      ok: canonicalReadbackOk,
      status: canonicalRefetch.status,
      apiResult: canonicalRefetch.apiResult,
      apiResultMessage: canonicalRefetch.apiResultMessage,
      expectedPatientIds,
      matchedPatientIds: canonicalRefetch.matchedPatientIds,
      missingPatientIds: canonicalRefetch.missingPatientIds,
    },
    error: canonicalReadbackOk
      ? undefined
      : 'ORCA既存患者取込は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。',
    errorCategory: canonicalReadbackOk ? undefined : 'canonical_refetch_failed',
    importSummary,
  };
}
