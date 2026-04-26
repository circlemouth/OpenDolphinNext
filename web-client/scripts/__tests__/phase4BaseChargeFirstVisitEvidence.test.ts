import { describe, expect, it } from 'vitest';

import {
  buildAcceptmodReadonlyXml,
  buildBaseChargeFirstVisitSummary,
  sanitizeAcceptmodReadonlyResult,
  validateBaseChargeFirstVisitCommand,
} from '../qa-lib/phase4-base-charge-first-visit-evidence.mjs';

const payload = 'qa/payloads/phase4/medicalmodv2_base_charge_trial_reachability_v2.json';
const payloadSha = '4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a';

describe('phase4 base-charge first-visit read-only evidence', () => {
  it('accepts the exact sanitized read-only command shape', () => {
    const guard = validateBaseChargeFirstVisitCommand({
      cwd: process.cwd(),
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payload,
        '--payload-sha256',
        payloadSha,
        '--patient-id',
        '00001',
        '--acceptance-date',
        '20260426',
      ],
      env: {},
    });

    expect(guard.ok).toBe(true);
    expect(guard.requestNumber).toBe('00');
    expect(guard.payloadEvidence?.entity).toBe('baseChargeOrder');
    expect(guard.payloadEvidence?.claim007Class).toBe('110');
    expect(guard.rawOrcaBodyStored).toBe(false);
    expect(guard.credentialsCaptured).toBe(false);
  });

  it('fails closed on mutation/artifact flags, wrong target, and SHA drift', () => {
    const guard = validateBaseChargeFirstVisitCommand({
      cwd: process.cwd(),
      argv: [
        '--execute-readonly',
        '--execute-live',
        '--record-har',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payload,
        '--payload-sha256',
        'bad',
        '--patient-id',
        '00005',
      ],
      env: { QA_SCREENSHOT: '1' },
    });

    expect(guard.ok).toBe(false);
    expect(guard.blockers).toContain('forbidden flag: --execute-live');
    expect(guard.blockers).toContain('forbidden flag: --record-har');
    expect(guard.blockers).toContain('forbidden env enabled: QA_SCREENSHOT');
    expect(guard.blockers).toContain('target patient must be 00001 for this checkpoint');
    expect(guard.blockers).toContain('payload sha256 mismatch');
  });

  it('builds Request_Number=00 XML without insurance or raw payload details', () => {
    const xml = buildAcceptmodReadonlyXml({ patientId: '00001', acceptanceDate: '20260426' });

    expect(xml).toContain('<Request_Number>00</Request_Number>');
    expect(xml).toContain('<Patient_ID>00001</Patient_ID>');
    expect(xml).toContain('<Acceptance_Date>20260426</Acceptance_Date>');
    expect(xml).not.toContain('HealthInsurance_Information');
    expect(xml).not.toContain('Request_Number>01');
  });

  it('classifies apiResult=60 as first-visit-compatible read-only precondition only', () => {
    const result = sanitizeAcceptmodReadonlyResult({
      httpStatus: 200,
      xml: '<data><acceptres><Api_Result>60</Api_Result><Request_Number>00</Request_Number></acceptres></data>',
    });

    expect(result.httpStatusClass).toBe('2xx');
    expect(result.apiResultClass).toBe('no_existing_acceptance');
    expect(result.classification).toBe('first_visit_compatible_no_existing_acceptance');
    expect(result.firstVisitCompatible).toBe(true);
    expect(result.mutationSuccess).toBe(false);
  });

  it('does not promote existing acceptance or HTTP 200 to compatibility', () => {
    const result = sanitizeAcceptmodReadonlyResult({
      httpStatus: 200,
      xml:
        '<data><acceptres><Api_Result>00</Api_Result><Request_Number>00</Request_Number>' +
        '<Acceptance_Id>A-1</Acceptance_Id></acceptres></data>',
    });

    expect(result.classification).toBe('existing_acceptance_not_first_visit_compatible');
    expect(result.firstVisitCompatible).toBe(false);
    expect(result.mutationSuccess).toBe(false);
  });

  it('summary keeps read-only compatibility separate from business success', () => {
    const summary = buildBaseChargeFirstVisitSummary({
      runId: '20260426T150137Z',
      traceId: 'trace-20260426T150137Z',
      guard: {
        ok: true,
        blockers: [],
        options: {
          dryRun: false,
          executeReadonly: true,
          sanitizedEvidenceOnly: true,
          disableBrowserArtifacts: true,
          patientId: '00001',
          acceptanceDate: '20260426',
          payload,
        },
        payloadEvidence: {
          sha256: payloadSha,
          bytes: 10,
          workflow: 'base-charge',
          entity: 'baseChargeOrder',
          claim007Class: '110',
          candidateCode: '111000110',
        },
      },
      readonlyResult: sanitizeAcceptmodReadonlyResult({
        httpStatus: 200,
        xml: '<data><acceptres><Api_Result>60</Api_Result><Request_Number>00</Request_Number></acceptres></data>',
      }),
    });

    expect(summary.verdict).toBe('readonly_first_visit_compatible');
    expect(summary.successCriteria.mutationSuccess).toBe(false);
    expect(summary.liveTrialOrca.executed).toBe(false);
    expect(summary.liveTrialOrca.businessAccepted).toBe(false);
    expect(summary.rawArtifactsCommittedOrPackaged).toBe(false);
  });
});
