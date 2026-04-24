import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PHASE4_TRIAL_DEPARTMENT_CODE,
  PHASE4_TRIAL_PHYSICIAN_CODE,
  PHASE4_TARGET_PATIENT_ID,
  buildPhase4DuplicateLiveCheckpointKey,
  buildSyntheticPayloadFixture,
  classifyPhase4BusinessResult,
  parsePhase4SafeArgs,
  sanitizePhase4Response,
  summarizeRuntimeReadiness,
  validatePhase4Payload,
  validatePhase4SafeCommand,
} from '../qa-lib/phase4-medicalmodv2-safe-evidence.mjs';

const payloadPath = (fileName: string) => path.join(process.cwd(), 'qa', 'payloads', 'phase4', fileName);

const PRESCRIPTION_PAYLOAD = payloadPath('medicalmodv2_prescription_trial_reachability_v2.json');
const PRESCRIPTION_SHA256 = '9146d2ba3cbc5f037ba90c9620a50a36f5c1696de0d4cd36dc2b6fc6d5f876b7';
const TREATMENT_PAYLOAD = payloadPath('medicalmodv2_treatment_generic_trial_reachability_v2.json');
const TREATMENT_SHA256 = '89885a031fa98c95a5fc4758dbac55f4375167178edb12fc9a78e9817a16fe7c';
const INSTRUCTION_CHARGE_PAYLOAD = payloadPath('medicalmodv2_instruction_charge_trial_reachability_v1.json');
const INSTRUCTION_CHARGE_SHA256 = '8b9ec7db74971f7c567945c75bee7ad1fa3cbbaba97c2f8a689c2a1f0c9af64e';
const BASE_CHARGE_PAYLOAD = payloadPath('medicalmodv2_base_charge_trial_reachability_v1.json');
const BASE_CHARGE_SHA256 = 'd2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93';
const INJECTION_PAYLOAD = payloadPath('medicalmodv2_injection_trial_reachability_v1.json');
const INJECTION_SHA256 = 'c01169729cb86d1c68211e4b01f6c38bf3dde0ac948100c53855ec91f1b9010e';
const SURGERY_PAYLOAD = payloadPath('medicalmodv2_surgery_trial_reachability_v1.json');
const SURGERY_SHA256 = '23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000';
const TEST_ORDER_PAYLOAD = payloadPath('medicalmodv2_test_order_trial_reachability_v1.json');
const TEST_ORDER_SHA256 = 'b4fd3a422ac38f51b73a2fb2a56d07e2418339878f9451a6d73eb185bbd334d2';
const RADIOLOGY_PAYLOAD = payloadPath('medicalmodv2_radiology_trial_reachability_v1.json');
const RADIOLOGY_SHA256 = 'd4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e';

describe('phase4 medicalmodv2 safe evidence', () => {
  it('accepts only the fixed Phase 4 medicalmodv2 target and sanitized mode', () => {
    const result = validatePhase4SafeCommand({
      argv: ['--dry-run', '--sanitized-evidence-only', '--disable-browser-artifacts', '--phase4-only'],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-22T14:57:04Z'),
    });

    expect(result.blockers).toEqual([]);
    expect(result.blockers).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.evidence.endpoint).toBe('/api/orca/official/chart-support/medical-mod-v2');
    expect(result.evidence.requestClass).toBe('medicalmodv2');
    expect(result.evidence.target.patientId).toBe(PHASE4_TARGET_PATIENT_ID);
    expect(result.evidence.payload.summary.departmentCodeMatched).toBe(true);
    expect(result.evidence.payload.summary.physicianCodeMatched).toBe(true);
    expect(result.evidence.payload.summary.rawPayloadStored).toBe(false);
    expect(result.evidence.rawSensitiveFieldsExcluded).toBe(true);
  });

  it('accepts the prescription endpoint payload identity with a duplicate-live checkpoint key', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'prescription',
        '--payload',
        PRESCRIPTION_PAYLOAD,
        '--payload-sha256',
        PRESCRIPTION_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T03:16:08Z'),
    });

    expect(result.blockers).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'prescription',
        workflowId: 'rwo06d-prescription-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['medOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['212']);
    expect(result.evidence.duplicateLiveCheckpoint).toEqual(
      expect.objectContaining({
        key: buildPhase4DuplicateLiveCheckpointKey({
          workflow: 'prescription',
          payloadSha256: PRESCRIPTION_SHA256,
        }),
        status: 'not_checked_no_live',
        liveMutationPermittedWhenReady: true,
      }),
    );
  });

  it('accepts the representative treatment/generic endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'treatment-generic',
        '--payload',
        TREATMENT_PAYLOAD,
        '--payload-sha256',
        TREATMENT_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T03:16:08Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'treatment-generic',
        workflowId: 'rwo06d-treatment-generic-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['treatmentOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['400']);
  });

  it('accepts the representative instruction-charge endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'instruction-charge',
        '--payload',
        INSTRUCTION_CHARGE_PAYLOAD,
        '--payload-sha256',
        INSTRUCTION_CHARGE_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T04:48:03Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'instruction-charge',
        workflowId: 'rwo06f-instruction-charge-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['instractionChargeOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['130']);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${INSTRUCTION_CHARGE_SHA256}`,
    );
  });

  it('accepts the representative base-charge endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'base-charge',
        '--payload',
        BASE_CHARGE_PAYLOAD,
        '--payload-sha256',
        BASE_CHARGE_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T05:02:23Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'base-charge',
        workflowId: 'rwo06g-base-charge-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['baseChargeOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['110']);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06g:medicalmodv2:rwo06g-base-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${BASE_CHARGE_SHA256}`,
    );
  });

  it('accepts the representative injection endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'injection',
        '--payload',
        INJECTION_PAYLOAD,
        '--payload-sha256',
        INJECTION_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T05:26:54Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'injection',
        workflowId: 'rwo06h-injection-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['injectionOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['310']);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06h:medicalmodv2:rwo06h-injection-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${INJECTION_SHA256}`,
    );
  });

  it('accepts the representative surgery endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'surgery',
        '--payload',
        SURGERY_PAYLOAD,
        '--payload-sha256',
        SURGERY_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T05:50:36Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'surgery',
        workflowId: 'rwo06i-surgery-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['surgeryOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['500']);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06i:medicalmodv2:rwo06i-surgery-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${SURGERY_SHA256}`,
    );
  });

  it('accepts the representative test-order endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'test-order',
        '--payload',
        TEST_ORDER_PAYLOAD,
        '--payload-sha256',
        TEST_ORDER_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T06:02:17Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'test-order',
        workflowId: 'rwo06j-test-order-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['testOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['600']);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06j:medicalmodv2:rwo06j-test-order-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${TEST_ORDER_SHA256}`,
    );
  });

  it('accepts the representative radiology endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'radiology',
        '--payload',
        RADIOLOGY_PAYLOAD,
        '--payload-sha256',
        RADIOLOGY_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T06:15:49Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpointWorkflow).toEqual(
      expect.objectContaining({
        workflow: 'radiology',
        workflowId: 'rwo06k-radiology-medicalmodv2-v1',
        requiredEntityKindsPresent: true,
        allowedMedicalClassesOnly: true,
      }),
    );
    expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(['radiologyOrder']);
    expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(['700']);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06k:medicalmodv2:rwo06k-radiology-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${RADIOLOGY_SHA256}`,
    );
  });

  it('rejects endpoint workflow and payload identity mismatches before live ORCA', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'prescription',
        '--payload',
        TREATMENT_PAYLOAD,
        '--payload-sha256',
        TREATMENT_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T03:16:08Z'),
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('workflow prescription requires entity kind medOrder');
    expect(result.blockers).toContain('workflow prescription allows only medical class 212');
  });

  it('requires an endpoint workflow for live execution and blocks accepted duplicate checkpoints', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase4-medicalmodv2-'));
    const cwd = path.join(repoRoot, 'web-client');
    fs.mkdirSync(cwd, { recursive: true });
    const acceptedDir = path.join(repoRoot, 'artifacts', 'orca-remediation', 'closeout', 'prior', 'qa');
    fs.mkdirSync(acceptedDir, { recursive: true });
    const checkpointKey = buildPhase4DuplicateLiveCheckpointKey({
      workflow: 'prescription',
      payloadSha256: PRESCRIPTION_SHA256,
    });
    fs.writeFileSync(
      path.join(acceptedDir, 'phase4-medicalmodv2-summary.sanitized.json'),
      JSON.stringify({
        duplicateLiveCheckpoint: { key: checkpointKey },
        response: { businessAccepted: true },
      }),
      'utf8',
    );

    try {
      const missingWorkflow = validatePhase4SafeCommand({
        argv: [
          '--execute-approved-phase4',
          '--sanitized-evidence-only',
          '--disable-browser-artifacts',
          '--phase4-only',
          '--payload',
          PRESCRIPTION_PAYLOAD,
          '--payload-sha256',
          PRESCRIPTION_SHA256,
        ],
        env: {},
        cwd,
        now: new Date('2026-04-24T03:16:08Z'),
      });
      expect(missingWorkflow.ok).toBe(false);
      expect(missingWorkflow.blockers).toContain('--workflow is required for endpoint-specific live Phase 4 execution');

      const duplicate = validatePhase4SafeCommand({
        argv: [
          '--execute-approved-phase4',
          '--sanitized-evidence-only',
          '--disable-browser-artifacts',
          '--phase4-only',
          '--workflow',
          'prescription',
          '--payload',
          PRESCRIPTION_PAYLOAD,
          '--payload-sha256',
          PRESCRIPTION_SHA256,
        ],
        env: {},
        cwd,
        now: new Date('2026-04-24T03:16:08Z'),
      });
      expect(duplicate.ok).toBe(false);
      expect(duplicate.blockers).toContain('duplicate live checkpoint already accepted');
      expect(duplicate.evidence.duplicateLiveCheckpoint.status).toBe('accepted_checkpoint_found');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
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

  it('rejects the stale Phase 4 department and physician context before live ORCA', () => {
    const payload = buildSyntheticPayloadFixture();
    payload.encounterContext.departmentCode = '11';
    payload.encounterContext.physicianCode = '0005';

    const gate = validatePhase4Payload({ payload, payloadSha256: 'abc' });

    expect(gate.ok).toBe(false);
    expect(gate.blockers).toContain(`departmentCode must be ${PHASE4_TRIAL_DEPARTMENT_CODE}`);
    expect(gate.blockers).toContain(`physicianCode must be ${PHASE4_TRIAL_PHYSICIAN_CODE}`);
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

  it('requires readiness before live Trial execution and stores status only', () => {
    const summary = summarizeRuntimeReadiness({
      healthStatus: 200,
      readinessStatus: 503,
    });

    expect(summary.ok).toBe(false);
    expect(summary.healthHttpStatus).toBe(200);
    expect(summary.readinessHttpStatus).toBe(503);
    expect(summary.blockers).toEqual(['backend readiness endpoint is not ready']);
    expect(summary.rawReadinessBodyStored).toBe(false);
    expect(summary.rawHealthBodyStored).toBe(false);
  });
});
