import { normalizeOrcaApiResult } from '../../libs/orca/orcaApiResultPolicy';

export const ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH = '21';
export const ACCEPTMOD_API_RESULT_NO_ACCEPTANCE = '60';

export const resolveAcceptmodFallbackMessage = (apiResult?: string) => {
  const normalized = normalizeOrcaApiResult(apiResult);
  if (normalized === ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH) return '保険不一致';
  if (normalized === ACCEPTMOD_API_RESULT_NO_ACCEPTANCE) return '受付なし';
  return undefined;
};

export const isAcceptmodInsuranceMismatch = (apiResult?: string) =>
  normalizeOrcaApiResult(apiResult) === ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH;

export const isAcceptmodNoAcceptance = (apiResult?: string) =>
  normalizeOrcaApiResult(apiResult) === ACCEPTMOD_API_RESULT_NO_ACCEPTANCE;
