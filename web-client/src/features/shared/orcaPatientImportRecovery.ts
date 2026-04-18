import type { OrcaPatientImportResult } from '../outpatient/orcaPatientImportApi';
import type { OrcaResponseErrorKind } from './orcaApiResponse';

const RECOVERABLE_NOT_FOUND_CODES = new Set(['patient_not_found', 'karte_not_found']);

const normalizeToken = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveImportFailureCause = (result: OrcaPatientImportResult): string | undefined => {
  return normalizeToken(result.errorCode) ?? normalizeToken(result.errorCategory);
};

export const isOrcaPatientId = (patientId: string): boolean => /^\d+$/.test(patientId.trim());

export const isRecoverableOrcaNotFound = (params: {
  patientId: string;
  status?: number;
  errorCode?: string;
  errorKind?: OrcaResponseErrorKind;
}): boolean => {
  if (!isOrcaPatientId(params.patientId)) return false;
  if (params.status !== 404) return false;
  const code = normalizeToken(params.errorCode);
  if (!code || !RECOVERABLE_NOT_FOUND_CODES.has(code)) return false;
  if (params.errorKind && params.errorKind !== 'business_not_found') return false;
  return true;
};

export const buildPatientImportFailureMessage = (contextLabel: string, result: OrcaPatientImportResult): string => {
  const cause = resolveImportFailureCause(result);

  if (result.errorKind === 'auth') {
    return `${contextLabel}の再取得前に患者取込を完了できませんでした。認証状態を確認してからやり直してください。`;
  }

  if (result.errorKind === 'route_not_found' || result.routeMismatch) {
    return `${contextLabel}の再取得前に患者取込を完了できませんでした。利用可能な画面からやり直してください。`;
  }

  if (cause === 'patient_not_found' || cause === 'karte_not_found' || result.status === 404) {
    return `${contextLabel}の再取得前に患者取込を完了できませんでした。対象患者が見つからないため、患者選択からやり直してください。`;
  }

  if (cause === 'canonical_refetch_failed') {
    return `${contextLabel}の再取得前に患者取込は受け付けられましたが、canonical 再取得に失敗したため同期完了を確認できませんでした。時間をおいて再試行してください。`;
  }

  return `${contextLabel}の再取得前に患者取込を完了できませんでした。時間をおいて再試行してください。`;
};
