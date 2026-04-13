import type { LiveRegionTone } from '../observability/types';

export type OrcaApiResultLike = {
  ok: boolean;
  apiResult?: string;
  stub?: boolean;
};

export type OrcaResultTone = 'pending' | 'idle' | 'ok' | 'warn' | 'error';

export const normalizeOrcaApiResult = (value?: string | number | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).trim().toUpperCase();
  }
  if (typeof value === 'string') {
    return value.trim().toUpperCase();
  }
  return '';
};

export const isOrcaStubResult = (apiResult?: string | number | null) =>
  normalizeOrcaApiResult(apiResult).startsWith('79');

export const isOrcaSuccessResult = (apiResult?: string | number | null) =>
  /^0+$/.test(normalizeOrcaApiResult(apiResult));

export const resolveOrcaResultTone = (
  result: OrcaApiResultLike | null | undefined,
  pending = false,
): OrcaResultTone => {
  if (pending) return 'pending';
  if (!result) return 'idle';
  if (!result.ok) return 'error';
  if (result.stub || isOrcaStubResult(result.apiResult)) return 'warn';
  if (normalizeOrcaApiResult(result.apiResult) && !isOrcaSuccessResult(result.apiResult)) return 'warn';
  return 'ok';
};

export const resolveOrcaResultToneForBanner = (
  result: OrcaApiResultLike | null | undefined,
  pending = false,
): LiveRegionTone => {
  const tone = resolveOrcaResultTone(result, pending);
  switch (tone) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    case 'ok':
      return 'success';
    default:
      return 'info';
  }
};
