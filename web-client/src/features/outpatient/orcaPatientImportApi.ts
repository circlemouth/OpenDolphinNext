import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import type { OrcaResponseErrorKind, ParsedOrcaApiResponse } from '../shared/orcaApiResponse';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';
import { refetchOfficialCanonicalPatients, type PatientRecord } from '../patients/api';

export type OrcaPatientImportResult = {
  ok: boolean;
  runId: string;
  status: number;
  payload?: any;
  canonicalPatients?: PatientRecord[];
  error?: string;
  errorCode?: string;
  errorKind?: OrcaResponseErrorKind;
  errorCategory?: string;
  routeMismatch?: boolean;
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
    return '患者取込APIの経路不一致を検知しました。Vite の /orca リライト設定と VITE_ORCA_API_PATH_PREFIX を確認してください。';
  }
  return parsed.message ?? `HTTP ${parsed.status}`;
};

export async function importPatientsFromOrca(params: {
  patientIds: string[];
  includeInsurance?: boolean;
  runId?: string;
}): Promise<OrcaPatientImportResult> {
  const runId = params.runId ?? getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });

  if (!params.patientIds?.length) {
    return { ok: false, runId, status: 0, error: 'patientIds is required' };
  }

  let response: Response;
  try {
    response = await httpFetch('/api/orca/patients/import', {
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
      runId: resolvedRunId,
      status: parsed.status,
      payload: parsed.text,
      error: '患者取り込みAPIがJSON以外を返しました。プロキシ設定を確認してください。',
      errorCode: parsed.errorCode,
      errorKind: 'route_not_found',
      routeMismatch: true,
    };
  }

  const canonicalRefetch = await refetchOfficialCanonicalPatients({
    patientIds: params.patientIds,
    runId: resolvedRunId,
  });

  return {
    ok: true,
    runId: resolvedRunId,
    status: parsed.status,
    payload: parsed.json,
    canonicalPatients: canonicalRefetch.patients,
  };
}
