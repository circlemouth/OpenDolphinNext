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
  summarizeInjectionMasterValidityNoLivePlan,
  summarizeInjectionOrderNoLiveContract,
  summarizeBaseChargeRowOrderNoLiveContract,
  summarizeRuntimeReadiness,
  summarizeInstructionChargePreconditionNoLivePlan,
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
const INSTRUCTION_CHARGE_V2_PAYLOAD = payloadPath('medicalmodv2_instruction_charge_trial_reachability_v2.json');
const INSTRUCTION_CHARGE_V2_SHA256 = '043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858';
const BASE_CHARGE_PAYLOAD = payloadPath('medicalmodv2_base_charge_trial_reachability_v1.json');
const BASE_CHARGE_SHA256 = 'd2db1ff2ad68174bcb236498786c87a8fffa0879917712c7ca639aa2732b9d93';
const BASE_CHARGE_V2_PAYLOAD = payloadPath('medicalmodv2_base_charge_trial_reachability_v2.json');
const BASE_CHARGE_V2_SHA256 = '4c092e032dd6f56eb5542ad65b2b6b28a8e1c1c802900f83e795dbbdba7a403a';
const INJECTION_PAYLOAD = payloadPath('medicalmodv2_injection_trial_reachability_v1.json');
const INJECTION_SHA256 = 'c01169729cb86d1c68211e4b01f6c38bf3dde0ac948100c53855ec91f1b9010e';
const INJECTION_V2_PAYLOAD = payloadPath('medicalmodv2_injection_trial_reachability_v2.json');
const INJECTION_V2_SHA256 = '1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300';
const SURGERY_PAYLOAD = payloadPath('medicalmodv2_surgery_trial_reachability_v1.json');
const SURGERY_SHA256 = '23441f818148820c2b1364c6a7424b1255995738cd05fa35e1328f41db96c000';
const SURGERY_V2_PAYLOAD = payloadPath('medicalmodv2_surgery_trial_reachability_v2.json');
const SURGERY_V2_SHA256 = 'f7fbb890b62b7211b47c2672e85f0e70acbcdee18c9cbe9d7ea24c7942bbaa0e';
const TEST_ORDER_PAYLOAD = payloadPath('medicalmodv2_test_order_trial_reachability_v1.json');
const TEST_ORDER_SHA256 = 'b4fd3a422ac38f51b73a2fb2a56d07e2418339878f9451a6d73eb185bbd334d2';
const TEST_ORDER_V3_PAYLOAD = payloadPath('medicalmodv2_test_order_trial_reachability_v3.json');
const TEST_ORDER_V3_SHA256 = '6a4e1800dbc6993c08c90d01a5ed57e490c0b38a346b6966325bfa0d86a61a28';
const RADIOLOGY_PAYLOAD = payloadPath('medicalmodv2_radiology_trial_reachability_v1.json');
const RADIOLOGY_SHA256 = 'd4dede12f9c7a43ab3c20bf972ef35a44ef0a33411e91a22429e85e985004f9e';
const RADIOLOGY_V2_PAYLOAD = payloadPath('medicalmodv2_radiology_trial_reachability_v2.json');
const RADIOLOGY_V2_SHA256 = 'ba41ca8d029b362d197361def1653a334ea27032935a6979298548465df4d436';
const RADIOLOGY_V3_PAYLOAD = payloadPath('medicalmodv2_radiology_trial_reachability_v3.json');
const RADIOLOGY_V3_SHA256 = '144850285178276d543ebb424610cbf91a2e188b8dc597f957cc882577c4a16a';

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

  it('accepts source-backed instruction-charge/base-charge/injection v2 endpoint payload identities', () => {
    const cases = [
      {
        workflow: 'instruction-charge',
        payload: INSTRUCTION_CHARGE_V2_PAYLOAD,
        sha256: INSTRUCTION_CHARGE_V2_SHA256,
        entityKinds: ['instractionChargeOrder'],
        medicalClasses: ['130'],
        checkpointNamespace: 'rwo06f',
        workflowId: 'rwo06f-instruction-charge-medicalmodv2-v1',
      },
      {
        workflow: 'base-charge',
        payload: BASE_CHARGE_V2_PAYLOAD,
        sha256: BASE_CHARGE_V2_SHA256,
        entityKinds: ['baseChargeOrder'],
        medicalClasses: ['110'],
        checkpointNamespace: 'rwo06g',
        workflowId: 'rwo06g-base-charge-medicalmodv2-v1',
      },
      {
        workflow: 'injection',
        payload: INJECTION_V2_PAYLOAD,
        sha256: INJECTION_V2_SHA256,
        entityKinds: ['injectionOrder'],
        medicalClasses: ['310'],
        checkpointNamespace: 'rwo06h',
        workflowId: 'rwo06h-injection-medicalmodv2-v1',
      },
    ];

    for (const item of cases) {
      const result = validatePhase4SafeCommand({
        argv: [
          '--dry-run',
          '--sanitized-evidence-only',
          '--disable-browser-artifacts',
          '--phase4-only',
          '--workflow',
          item.workflow,
          '--payload',
          item.payload,
          '--payload-sha256',
          item.sha256,
        ],
        env: {},
        cwd: '/repo/web-client',
        now: new Date('2026-04-25T03:02:45Z'),
      });

      expect(result.ok).toBe(true);
      expect(result.evidence.endpointWorkflow).toEqual(
        expect.objectContaining({
          workflow: item.workflow,
          workflowId: item.workflowId,
          requiredEntityKindsPresent: true,
          allowedMedicalClassesOnly: true,
        }),
      );
      expect(result.evidence.payload.summary.medicalInformation.entityKinds).toEqual(item.entityKinds);
      expect(result.evidence.payload.summary.medicalInformation.medicalClasses).toEqual(item.medicalClasses);
      expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
        `${item.checkpointNamespace}:medicalmodv2:${item.workflowId}:target-00001:request-01:class-01:payload-sha256-${item.sha256}`,
      );
    }
  });

  it('classifies the injection v2 payload row roles and code shapes before live ORCA', () => {
    const payload = JSON.parse(fs.readFileSync(INJECTION_V2_PAYLOAD, 'utf8'));
    const result = summarizeInjectionOrderNoLiveContract(payload);

    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.rowCount).toBe(4);
    expect(result.roles).toEqual(['procedure', 'main', 'material', 'comment']);
    expect(result.codeShape).toEqual({
      procedureInjectionFee: true,
      medication: true,
      material: true,
      comment: true,
    });
    expect(result.requestSemantics).toEqual({
      requestNumber01Only: true,
      classCode01Only: true,
      requestNumber02To04Forbidden: true,
    });
    expect(result.masterRuntimeLookupExecuted).toBe(false);
    expect(result.liveTrialAction).toBe('not_run');
    expect(result.rawPayloadStored).toBe(false);
    expect(result.rawPatientOrInsuranceDetailStored).toBe(false);
  });

  it('builds the instruction-charge v2 precondition plan without live ORCA', () => {
    const payload = JSON.parse(fs.readFileSync(INSTRUCTION_CHARGE_V2_PAYLOAD, 'utf8'));
    const result = summarizeInstructionChargePreconditionNoLivePlan(payload);

    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.candidateCodes).toEqual(['113001810']);
    expect(result.preconditionsRequiredBeforeLive.map((item) => item.name)).toEqual([
      'candidateCodeValidity',
      'selectableCommentStatus',
      'diseaseContext',
      'facilityContext',
      'monthlyDuplicateContext',
      'departmentContext',
      'physicianContext',
      'insuranceCombinationContext',
      'masterFreshnessStatus',
    ]);
    expect(result.contextStatusSchema).toEqual(expect.objectContaining({
      candidateCodeValidity: expect.arrayContaining(['static_shape_valid_readonly_probe_required']),
      selectableCommentStatus: expect.arrayContaining(['not_applicable_candidate_is_not_selectable_comment']),
      masterFreshnessStatus: expect.arrayContaining(['readonly_master_freshness_observed_sanitized']),
    }));
    expect(result.readOnlyChecksAllowedBeforeLive).toEqual([
      expect.objectContaining({ endpoint: 'medicationgetv2' }),
      expect.objectContaining({ endpoint: 'diseasegetv2_or_diseasev3_sanitized_summary' }),
      expect.objectContaining({ endpoint: 'medicalgetv2' }),
      expect.objectContaining({ endpoint: 'system01dailyv2_or_system01lstv2' }),
      expect.objectContaining({ endpoint: 'patientlst6v2_or_readonly_medical_context' }),
      expect.objectContaining({ endpoint: 'masterlastupdatev3' }),
    ]);
    expect(result.endpointSpecificBusinessSuccessCriteria).toContain(
      'http200_or_apiResult_zero_alone_is_not_success',
    );
    expect(result.stopConditions).toContain('duplicate_live_checkpoint_already_accepted');
    expect(result.stopConditions).toContain(
      'prior_rejected_checkpoint_unchanged_retry_without_changed_precondition',
    );
    expect(result.requestSemantics).toEqual({
      requestNumber01Only: true,
      classCode01Only: true,
      requestNumber02To04Forbidden: true,
    });
    expect(result.stopBeforeLiveUntilAllPreconditionsProven).toBe(true);
    expect(result.runtimeReadOnlyProbeExecuted).toBe(false);
    expect(result.liveTrialAction).toBe('not_run');
    expect(result.rawPayloadStored).toBe(false);
    expect(result.rawOrcaBodyStored).toBe(false);
    expect(result.rawPatientOrInsuranceDetailStored).toBe(false);
  });

  it('locks base-charge v2 consultation fee as first row of first set without duplicates', () => {
    const payload = JSON.parse(fs.readFileSync(BASE_CHARGE_V2_PAYLOAD, 'utf8'));
    const result = summarizeBaseChargeRowOrderNoLiveContract(payload);

    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.rowOrder).toEqual({
      firstSetEntity: 'baseChargeOrder',
      firstSetMedicalClass: '110',
      firstRowCode: '111000110',
      consultationFeeFirstRowOfFirstSet: true,
      consultationFeeOccurrences: 1,
    });
    expect(result.requestSemantics).toEqual({
      requestNumber01Only: true,
      classCode01Only: true,
      requestNumber02To04Forbidden: true,
    });
    expect(result.stopBeforeLiveIfDuplicateOrNotFirstRow).toBe(true);
    expect(result.runtimeMasterLookupExecuted).toBe(false);
    expect(result.liveTrialAction).toBe('not_run');
    expect(result.rawPayloadStored).toBe(false);
    expect(result.rawOrcaBodyStored).toBe(false);
    expect(result.rawPatientOrInsuranceDetailStored).toBe(false);
  });

  it('rejects base-charge payloads when consultation fee is duplicated or not first', () => {
    const notFirst = JSON.parse(fs.readFileSync(BASE_CHARGE_V2_PAYLOAD, 'utf8'));
    notFirst.medicalInformation.unshift({
      entity: 'treatmentOrder',
      medicalClass: '400',
      medications: [{ code: '140000610', number: '1' }],
    });

    const notFirstResult = summarizeBaseChargeRowOrderNoLiveContract(notFirst);
    expect(notFirstResult.ok).toBe(false);
    expect(notFirstResult.blockers).toContain(
      'baseChargeOrder class 110 group must be the first medicalInformation set',
    );
    expect(notFirstResult.blockers).toContain('consultation fee row must be first row of first set');
    expect(notFirstResult.liveTrialAction).toBe('not_run');

    const duplicated = JSON.parse(fs.readFileSync(BASE_CHARGE_V2_PAYLOAD, 'utf8'));
    duplicated.includeInitialConsultation = true;
    duplicated.medicalInformation[0].medications.push({ code: '111000110', number: '1' });

    const duplicatedResult = summarizeBaseChargeRowOrderNoLiveContract(duplicated);
    expect(duplicatedResult.ok).toBe(false);
    expect(duplicatedResult.blockers).toContain('consultation fee code 111000110 must appear exactly once');
    expect(duplicatedResult.blockers).toContain('includeInitialConsultation must not add a second consultation fee row');
    expect(duplicatedResult.rawOrcaBodyStored).toBe(false);
  });

  it('rejects instruction-charge payloads with mismatched class-130 code shape before live ORCA', () => {
    const payload = JSON.parse(fs.readFileSync(INSTRUCTION_CHARGE_V2_PAYLOAD, 'utf8'));
    payload.medicalInformation[0].medications[0].code = '112007410';

    const result = summarizeInstructionChargePreconditionNoLivePlan(payload);

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain(
      'instruction-charge row must use a class-130 guidance/management fee code shape',
    );
    expect(result.liveTrialAction).toBe('not_run');
  });

  it('builds the injection v2 master-validity read-only preflight plan without live ORCA', () => {
    const payload = JSON.parse(fs.readFileSync(INJECTION_V2_PAYLOAD, 'utf8'));
    const result = summarizeInjectionMasterValidityNoLivePlan(payload);

    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.candidateCodes).toEqual({
      procedure: '130000510',
      medication: '620000012',
      material: '700000031',
      comment: '0085001',
    });
    expect(result.readOnlyChecksRequiredBeforeLive).toEqual([
      expect.objectContaining({
        role: 'medication',
        endpoint: 'medicationgetv2',
        code: '620000012',
      }),
      expect.objectContaining({
        role: 'procedure',
        endpoint: 'masterlastupdatev3',
        code: '130000510',
      }),
      expect.objectContaining({
        role: 'material',
        endpoint: 'masterlastupdatev3',
        code: '700000031',
      }),
      expect.objectContaining({
        role: 'comment',
        endpoint: 'masterlastupdatev3',
        code: '0085001',
      }),
    ]);
    expect(result.stopBeforeLiveIfAnyMasterUnverified).toBe(true);
    expect(result.runtimeMasterLookupExecuted).toBe(false);
    expect(result.liveTrialAction).toBe('not_run');
    expect(result.rawPayloadStored).toBe(false);
    expect(result.rawOrcaBodyStored).toBe(false);
    expect(result.rawPatientOrInsuranceDetailStored).toBe(false);
  });

  it('rejects injection payloads without an explicit procedure row before live ORCA', () => {
    const payload = JSON.parse(fs.readFileSync(INJECTION_PAYLOAD, 'utf8'));
    const result = summarizeInjectionOrderNoLiveContract(payload);

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('injection rows must be ordered procedure, main, material, comment');
    expect(result.blockers).toContain('procedure row must use a class-310 injection procedure code shape');
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

  it('accepts the source-backed surgery v2 endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'surgery',
        '--payload',
        SURGERY_V2_PAYLOAD,
        '--payload-sha256',
        SURGERY_V2_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-25T01:01:43Z'),
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
      `rwo06i:medicalmodv2:rwo06i-surgery-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${SURGERY_V2_SHA256}`,
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

  it('accepts the changed test-order v3 endpoint payload identity with structured comment code', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'test-order',
        '--payload',
        TEST_ORDER_V3_PAYLOAD,
        '--payload-sha256',
        TEST_ORDER_V3_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-27T00:33:10Z'),
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
    expect(result.evidence.payload.summary.medicalInformation.medicationCount).toBe(2);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06j:medicalmodv2:rwo06j-test-order-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${TEST_ORDER_V3_SHA256}`,
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

  it('accepts the source-backed radiology v2 endpoint payload identity', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'radiology',
        '--payload',
        RADIOLOGY_V2_PAYLOAD,
        '--payload-sha256',
        RADIOLOGY_V2_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T22:55:33Z'),
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
      `rwo06k:medicalmodv2:rwo06k-radiology-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${RADIOLOGY_V2_SHA256}`,
    );
  });

  it('accepts the changed radiology v3 endpoint payload identity with body-part comment', () => {
    const result = validatePhase4SafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'radiology',
        '--payload',
        RADIOLOGY_V3_PAYLOAD,
        '--payload-sha256',
        RADIOLOGY_V3_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-26T23:32:44Z'),
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
    expect(result.evidence.payload.summary.medicalInformation.medicationCount).toBe(3);
    expect(result.evidence.duplicateLiveCheckpoint.key).toBe(
      `rwo06k:medicalmodv2:rwo06k-radiology-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${RADIOLOGY_V3_SHA256}`,
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
