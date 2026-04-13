import { describe, expect, it } from 'vitest';

import {
  isOrcaStubResult,
  isOrcaSuccessResult,
  normalizeOrcaApiResult,
  resolveOrcaResultTone,
  resolveOrcaResultToneForBanner,
} from './orcaApiResultPolicy';

describe('orcaApiResultPolicy', () => {
  it('Api_Result を trim して大文字化する', () => {
    expect(normalizeOrcaApiResult(' 00 ')).toBe('00');
    expect(normalizeOrcaApiResult('k3')).toBe('K3');
    expect(normalizeOrcaApiResult(79)).toBe('79');
    expect(normalizeOrcaApiResult(undefined)).toBe('');
  });

  it('success / stub 判定を共通化する', () => {
    expect(isOrcaSuccessResult('00')).toBe(true);
    expect(isOrcaSuccessResult('0000')).toBe(true);
    expect(isOrcaSuccessResult('21')).toBe(false);
    expect(isOrcaStubResult('79')).toBe(true);
    expect(isOrcaStubResult('7901')).toBe(true);
    expect(isOrcaStubResult('00')).toBe(false);
  });

  it('tone 判定を drift させない', () => {
    expect(resolveOrcaResultTone(undefined)).toBe('idle');
    expect(resolveOrcaResultTone({ ok: true, apiResult: '00' })).toBe('ok');
    expect(resolveOrcaResultTone({ ok: true, apiResult: '21' })).toBe('warn');
    expect(resolveOrcaResultTone({ ok: true, apiResult: '79' })).toBe('warn');
    expect(resolveOrcaResultTone({ ok: false, apiResult: '00' })).toBe('error');
    expect(resolveOrcaResultTone({ ok: true, apiResult: '00' }, true)).toBe('pending');
    expect(resolveOrcaResultToneForBanner({ ok: true, apiResult: '21' })).toBe('warning');
  });
});
