import { describe, expect, it } from 'vitest';

import { buildPatientImportFailureMessage, isRecoverableOrcaNotFound } from './orcaPatientImportRecovery';

describe('orcaPatientImportRecovery', () => {
  it('treats patient_not_found/karte_not_found 404 on numeric patient id as recoverable', () => {
    expect(
      isRecoverableOrcaNotFound({
        patientId: '000123',
        status: 404,
        errorCode: 'patient_not_found',
        errorKind: 'business_not_found',
      }),
    ).toBe(true);
    expect(
      isRecoverableOrcaNotFound({
        patientId: '000123',
        status: 404,
        errorCode: 'karte_not_found',
        errorKind: 'business_not_found',
      }),
    ).toBe(true);
    expect(
      isRecoverableOrcaNotFound({
        patientId: 'P-001',
        status: 404,
        errorCode: 'patient_not_found',
        errorKind: 'business_not_found',
      }),
    ).toBe(false);
  });

  it('builds explicit auth failure message without raw reason tokens', () => {
    const message = buildPatientImportFailureMessage('病名情報', {
      ok: false,
      runId: 'RUN-TEST',
      status: 401,
      errorKind: 'auth',
      errorCode: 'authentication_failed',
      error: 'unauthorized',
    });

    expect(message).toBe('病名情報の再取得前に患者取込を完了できませんでした。認証状態を確認してからやり直してください。');
    expect(message).not.toContain('authentication_failed');
    expect(message).not.toContain('RUN-TEST');
  });

  it('builds route mismatch message without internal config hints', () => {
    const message = buildPatientImportFailureMessage('オーダー情報', {
      ok: false,
      runId: 'RUN-TEST',
      status: 404,
      errorKind: 'route_not_found',
      routeMismatch: true,
      error: 'not found',
    });

    expect(message).toBe('オーダー情報の再取得前に患者取込を完了できませんでした。利用可能な画面からやり直してください。');
    expect(message).not.toContain('VITE_ORCA_API_PATH_PREFIX');
  });

  it('builds canonical refetch failure message without internal sync wording', () => {
    const message = buildPatientImportFailureMessage('病名情報', {
      ok: false,
      runId: 'RUN-TEST',
      status: 503,
      errorKind: 'http',
      errorCategory: 'canonical_refetch_failed',
      error: 'canonical 再取得に失敗したため完了扱いにできません',
      writeAccepted: true,
    });

    expect(message).toBe(
      '病名情報の再取得前に患者取込は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。時間をおいて再取得してください。',
    );
    expect(message).not.toContain('canonical');
    expect(message).not.toContain('完了扱い');
    expect(message).not.toContain('RUN-TEST');
  });
});
