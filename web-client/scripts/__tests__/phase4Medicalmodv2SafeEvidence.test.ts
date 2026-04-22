import { describe, expect, it } from 'vitest';

import {
  PHASE4_TARGET_PATIENT_ID,
  buildSyntheticPayloadFixture,
  classifyPhase4BusinessResult,
  parsePhase4SafeArgs,
  sanitizePhase4Response,
  validatePhase4Payload,
  validatePhase4SafeCommand,
} from '../qa-lib/phase4-medicalmodv2-safe-evidence.mjs';

describe('phase4 medicalmodv2 safe evidence', () => {
  it('accepts only the fixed Phase 4 medicalmodv2 target and sanitized mode', () => {
    const result = validatePhase4SafeCommand({
      argv: ['--dry-run', '--sanitized-evidence-only', '--disable-browser-artifacts', '--phase4-only'],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-22T14:57:04Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpoint).toBe('/api/orca/official/chart-support/medical-mod-v2');
    expect(result.evidence.requestClass).toBe('medicalmodv2');
    expect(result.evidence.target.patientId).toBe(PHASE4_TARGET_PATIENT_ID);
    expect(result.evidence.payload.summary.rawPayloadStored).toBe(false);
    expect(result.evidence.rawSensitiveFieldsExcluded).toBe(true);
  });

  it('rejects fullflow/raw artifact flags before any live action', () => {
    const parsed = parsePhase4SafeArgs([
      '--dry-run',
      '--sanitized-evidence-only',
      '--disable-browser-artifacts',
      '--phase4-only',
      '--fullflow',
      '--screenshot',
    ]);

    expect(parsed.errors).toContain('forbidden flag: --fullflow');
    expect(parsed.errors).toContain('forbidden flag: --screenshot');
  });

  it('rejects wrong patient, forbidden request number, and wrong classCode', () => {
    const payload = buildSyntheticPayloadFixture();
    payload.encounterContext.patientId = '00002';
    payload.requestNumber = '02';
    payload.classCode = '02';

    const gate = validatePhase4Payload({ payload, payloadSha256: 'abc' });

    expect(gate.ok).toBe(false);
    expect(gate.blockers).toContain('target patient must be 00001');
    expect(gate.blockers).toContain('requestNumber must be 01');
    expect(gate.blockers).toContain('Request_Number 02/03/04 is forbidden for this Phase 4 wrapper');
    expect(gate.blockers).toContain('classCode must be 01');
  });

  it('does not treat HTTP 200 and apiResult zero alone as business success', () => {
    const business = classifyPhase4BusinessResult({
      httpStatus: 200,
      responseJson: {
        ok: true,
        apiOk: true,
        apiResult: '0000',
        apiResultMessage: '正常終了',
      },
    });

    expect(business.responseClassification).toBe('notVerified');
    expect(business.businessAccepted).toBe(false);
  });

  it('accepts business success only with endpoint-specific completion evidence', () => {
    const summary = sanitizePhase4Response({
      httpStatus: 200,
      responseJson: {
        ok: true,
        apiOk: true,
        apiResult: '0000',
        apiResultMessage: '正常終了',
        informationDate: '2026-04-22',
        informationTime: '09:00:00',
      },
    });

    expect(summary.responseClassification).toBe('businessAccepted');
    expect(summary.businessAccepted).toBe(true);
    expect(summary.apiResultMessageCategory).toBe('ok_like');
    expect(summary.rawResponseBodyStored).toBe(false);
  });

  it('redacts sensitive-shaped messages into categories only', () => {
    const summary = sanitizePhase4Response({
      httpStatus: 200,
      responseJson: {
        ok: false,
        apiOk: false,
        apiResult: '10',
        apiResultMessage: '患者番号 00001 は保険未確認',
      },
    });

    expect(summary.responseClassification).toBe('businessRejected');
    expect(summary.apiResultMessageCategory).toBe('present_redacted_sensitive_shape');
    expect(JSON.stringify(summary)).not.toContain('保険未確認');
  });
});
