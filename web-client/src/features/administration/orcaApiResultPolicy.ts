import type { LiveRegionTone } from '../../libs/observability/types';

type OrcaApiResultLike = {
  ok: boolean;
  apiResult?: string;
  stub?: boolean;
};

export const isOrcaStubResult = (apiResult?: string) => Boolean(apiResult && apiResult.startsWith('79'));

export const isOrcaSuccessResult = (apiResult?: string) => Boolean(apiResult && /^0+$/.test(apiResult));

export const resolveOrcaResultTone = (
  result: OrcaApiResultLike | null | undefined,
  pending = false,
): 'pending' | 'idle' | 'ok' | 'warn' | 'error' => {
  if (pending) return 'pending';
  if (!result) return 'idle';
  if (!result.ok) return 'error';
  if (result.stub || isOrcaStubResult(result.apiResult)) return 'warn';
  if (result.apiResult && !isOrcaSuccessResult(result.apiResult)) return 'warn';
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
