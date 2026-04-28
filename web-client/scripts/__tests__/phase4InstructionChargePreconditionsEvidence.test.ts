import { describe, expect, it } from 'vitest';

import {
  buildDiseaseGetXml,
  buildInstructionChargePreconditionSummary,
  buildMedicalGetMonthlyXml,
  buildSystem01DailyXml,
  buildSystem01ManageXml,
  executeInstructionChargeReadonlyPreconditionChecks,
  resolveInstructionChargeReadonlyConfig,
  sanitizeInstructionChargeReadonlyXmlResult,
  validateInstructionChargePreconditionCommand,
} from '../qa-lib/phase4-instruction-charge-preconditions-evidence.mjs';

const payloadPath = 'qa/payloads/phase4/medicalmodv2_instruction_charge_trial_reachability_v2.json';
const payloadSha256 = '043c2a657746820a96950d6c05e2179d65040123d677a028e9ab86bc9af98858';

describe('phase4 instruction charge precondition readonly evidence', () => {
  it('accepts the instruction-charge v2 payload only in sanitized dry-run mode', () => {
    const guard = validateInstructionChargePreconditionCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payloadPath,
        '--payload-sha256',
        payloadSha256,
      ],
      env: {},
      cwd: process.cwd(),
    });

    expect(guard.ok).toBe(true);
    expect(guard.payloadEvidence?.plan.candidateCodes).toEqual(['113001810']);
    expect(guard.payloadEvidence?.context).toEqual(expect.objectContaining({
      patientId: '00001',
      departmentCode: '01',
      insuranceCombinationNumber: '0001',
      baseDate: '2026-04-25',
      baseMonth: '2026-04',
    }));
    expect(guard.rawPayloadStored).toBe(false);
    expect(guard.rawOrcaBodyStored).toBe(false);
    expect(guard.credentialsCaptured).toBe(false);
    expect(guard.payloadEvidence?.duplicateLiveCheckpoint).toEqual(expect.objectContaining({
      key: `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${payloadSha256}`,
      status: 'not_checked_no_live_packet_hardening',
    }));
  });

  it('rejects raw artifact flags and ambiguous execution mode before network use', () => {
    const guard = validateInstructionChargePreconditionCommand({
      argv: [
        '--dry-run',
        '--execute-readonly',
        '--record-har',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payloadPath,
      ],
      env: {},
      cwd: process.cwd(),
    });

    expect(guard.ok).toBe(false);
    expect(guard.blockers).toContain('forbidden flag: --record-har');
    expect(guard.blockers).toContain('exactly one of --dry-run or --execute-readonly is required');
  });

  it('fail-closes direct readonly execution to the WebORCA Trial allowlist and credentials', () => {
    expect(resolveInstructionChargeReadonlyConfig({
      ORCA_BASE_URL: 'https://example.test/',
      ORCA_API_USER: 'u',
      ORCA_API_PASSWORD: 'p',
    })).toEqual(expect.objectContaining({
      ok: false,
      blockers: ['non_trial_orca_host_forbidden'],
      credentialConfigured: true,
    }));
    expect(resolveInstructionChargeReadonlyConfig({ ORCA_BASE_URL: 'https://weborca-trial.orca.med.or.jp/' }))
      .toEqual(expect.objectContaining({
        ok: false,
        blockers: ['missing_trial_basic_credential'],
        credentialConfigured: false,
      }));
  });

  it('builds official readonly XML without request-number mutation paths', () => {
    expect(buildDiseaseGetXml({ patientId: '00001', baseMonth: '2026-04' })).toContain(
      '<Base_Date type="string">2026-04</Base_Date>',
    );
    expect(buildMedicalGetMonthlyXml({
      patientId: '00001',
      baseDate: '2026-04-25',
      departmentCode: '01',
      insuranceCombinationNumber: '0001',
    })).toContain('<Perform_Date type="string">2026-04-25</Perform_Date>');
    expect(buildSystem01DailyXml({ baseDate: '2026-04-25' })).toContain('<Request_Number type="string">01</Request_Number>');
    expect(buildSystem01ManageXml({ baseDate: '2026-04-25' })).toContain('<Request_Number type="string">04</Request_Number>');
  });

  it('sanitizes disease context without preserving raw disease or patient detail', () => {
    const xml = [
      '<xmlio2><disease_infores><Api_Result>00</Api_Result>',
      '<Disease_Infores><WholeName>raw patient name</WholeName></Disease_Infores>',
      '<Disease_Information><Disease_Information_child>',
      '<Disease_Name>raw disease name</Disease_Name><Department_Code>01</Department_Code>',
      '<Insurance_Combination_Number>0001</Insurance_Combination_Number><Disease_Class>05</Disease_Class>',
      '</Disease_Information_child></Disease_Information>',
      '</disease_infores></xmlio2>',
    ].join('');
    const sanitized = sanitizeInstructionChargeReadonlyXmlResult({
      role: 'diseaseContext',
      endpoint: 'diseasegetv2',
      httpStatus: 200,
      xml,
      context: { departmentCode: '01', insuranceCombinationNumber: '0001' },
    });

    expect(sanitized).toEqual(expect.objectContaining({
      httpStatusClass: '2xx',
      apiResultClass: 'success_zero',
      diseaseRowCountClass: 'one',
      managementFeeDiseaseClassPresent: true,
      targetDepartmentReferenced: true,
      targetInsuranceCombinationReferenced: true,
      rawDiseaseNameStored: false,
    }));
    expect(JSON.stringify(sanitized)).not.toContain('raw disease name');
    expect(JSON.stringify(sanitized)).not.toContain('raw patient name');
  });

  it('sanitizes monthly duplicate and facility evidence using allowlisted fields only', () => {
    const monthly = sanitizeInstructionChargeReadonlyXmlResult({
      role: 'monthlyDuplicateContext',
      endpoint: 'medicalgetv2',
      httpStatus: 200,
      xml: [
        '<xmlio2><medicalgetres><Api_Result>00</Api_Result>',
        '<Department_Code>01</Department_Code><Insurance_Combination_Number>0001</Insurance_Combination_Number>',
        '<Medication_Code>113001810</Medication_Code><Medication_Name>raw fee name</Medication_Name>',
        '</medicalgetres></xmlio2>',
      ].join(''),
      context: { candidateCode: '113001810', departmentCode: '01', insuranceCombinationNumber: '0001' },
    });
    expect(monthly).toEqual(expect.objectContaining({
      candidateCodeReferenced: true,
      candidateReferenceCountClass: 'one',
      targetDepartmentReferenced: true,
      targetInsuranceCombinationReferenced: true,
      rawMedicalRowsStored: false,
    }));
    expect(JSON.stringify(monthly)).not.toContain('raw fee name');

    const facility = sanitizeInstructionChargeReadonlyXmlResult({
      role: 'facilityContext',
      endpoint: 'system01dailyv2',
      httpStatus: 200,
      xml: '<xmlio2><system01_dailyres><Api_Result>00</Api_Result><Medical_Auto_Class>1</Medical_Auto_Class><Disease_Med_Auto_Class>1</Disease_Med_Auto_Class></system01_dailyres></xmlio2>',
      context: {},
    });
    expect(facility).toEqual(expect.objectContaining({
      medicalAutoClassPresence: 'present',
      diseaseMedAutoClassPresence: 'present',
      facilitySummaryOnly: true,
    }));
  });

  it('executes all readonly probes through sanitized fetch results only', async () => {
    const fetched: Array<{ url: string; body?: string }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      fetched.push({ url, body: typeof init.body === 'string' ? init.body : undefined });
      let body = '<xmlio2><res><Api_Result>00</Api_Result></res></xmlio2>';
      if (url.includes('diseasegetv2')) {
        body = '<xmlio2><disease_infores><Api_Result>00</Api_Result><Disease_Class>05</Disease_Class><Department_Code>01</Department_Code><Insurance_Combination_Number>0001</Insurance_Combination_Number></disease_infores></xmlio2>';
      }
      if (url.includes('medicalgetv2')) {
        body = '<xmlio2><medicalgetres><Api_Result>00</Api_Result><Department_Code>01</Department_Code><Insurance_Combination_Number>0001</Insurance_Combination_Number></medicalgetres></xmlio2>';
      }
      if (url.includes('system01dailyv2')) {
        body = '<xmlio2><system01_dailyres><Api_Result>00</Api_Result><Disease_Med_Auto_Class>1</Disease_Med_Auto_Class></system01_dailyres></xmlio2>';
      }
      if (url.includes('system01lstv2')) {
        body = '<xmlio2><medicalores><Api_Result>00</Api_Result><Institution_Code>1</Institution_Code></medicalores></xmlio2>';
      }
      return new Response(body, { status: 200 });
    };

    const checks = await executeInstructionChargeReadonlyPreconditionChecks({
      config: {
        baseUrl: new URL('https://weborca-trial.orca.med.or.jp/'),
        user: 'user',
        password: 'password',
      },
      context: {
        patientId: '00001',
        departmentCode: '01',
        insuranceCombinationNumber: '0001',
        baseDate: '2026-04-25',
        baseMonth: '2026-04',
        candidateCode: '113001810',
      },
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(checks).toHaveLength(4);
    expect(fetched.map((entry) => new URL(entry.url).hostname)).toEqual([
      'weborca-trial.orca.med.or.jp',
      'weborca-trial.orca.med.or.jp',
      'weborca-trial.orca.med.or.jp',
      'weborca-trial.orca.med.or.jp',
    ]);
    expect(fetched[0].url).toContain('/api01rv2/diseasegetv2?class=01');
    expect(fetched[1].url).toContain('/api01rv2/medicalgetv2?class=03');
    expect(fetched[2].url).toContain('/api01rv2/system01dailyv2');
    expect(fetched[3].url).toContain('/api01rv2/system01lstv2?class=04');
    expect(fetched[1].body).toContain('<Insurance_Combination_Number type="string">0001</Insurance_Combination_Number>');
  });

  it('classifies incomplete readonly preconditions separately from live business acceptance', () => {
    const guard = validateInstructionChargePreconditionCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payloadPath,
        '--payload-sha256',
        payloadSha256,
      ],
      env: {},
      cwd: process.cwd(),
    });
    const summary = buildInstructionChargePreconditionSummary({
      guard,
      runId: 'RUN',
      traceId: 'TRACE',
      verdict: 'readonly_preconditions_probe_completed',
      readonlyChecks: [
        {
          role: 'diseaseContext',
          httpStatusClass: '2xx',
          apiResultClass: 'success_zero',
          managementFeeDiseaseClassPresent: true,
        },
        {
          role: 'monthlyDuplicateContext',
          httpStatusClass: '2xx',
          apiResultClass: 'success_zero',
          candidateCodeReferenced: false,
          targetDepartmentReferenced: true,
          targetInsuranceCombinationReferenced: true,
        },
        { role: 'facilityContext', httpStatusClass: '2xx', apiResultClass: 'success_zero' },
      ],
    });

    expect(summary.liveTrialMutation).toBe('not_run');
    expect(summary.endpointPacket.duplicateLiveCheckpoint).toEqual(expect.objectContaining({
      key: `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-00001:request-01:class-01:payload-sha256-${payloadSha256}`,
    }));
    expect(summary.endpointPacket.parserSanitizerContract).toEqual(expect.objectContaining({
      contextStatusSchemaPresent: true,
      rawOrcaBodyStored: false,
      rawPatientOrInsuranceDetailStored: false,
    }));
    expect(summary.endpointPacket.endpointSpecificBusinessSuccessCriteria).toContain(
      'http200_or_apiResult_zero_alone_is_not_success',
    );
    expect(summary.endpointPacket.stopConditions).toContain('candidate_code_not_readonly_validated');
    expect(summary.endpointPacket.businessSuccessSeparation).toEqual({
      readonlyPreflightIsBusinessSuccess: false,
      dryRunIsBusinessSuccess: false,
      http200OrApiResultZeroAloneIsBusinessSuccess: false,
    });
    expect(summary.preconditions.preconditionStatus).toEqual(expect.objectContaining({
      candidateCodeValidity: 'static_shape_valid_readonly_probe_required',
      selectableCommentStatus: 'not_applicable_candidate_is_not_selectable_comment',
      departmentContext: 'observed_in_readonly_orca_response_sanitized',
      physicianContext: 'not_proven',
      insuranceCombinationContext: 'observed_in_readonly_orca_response_sanitized',
      masterFreshnessStatus: 'not_proven',
    }));
    expect(summary.preconditions.allPreconditionsProven).toBe(false);
    expect(summary.preconditions.businessSuccessClassification).toBe(
      'not_applicable_or_readonly_preconditions_not_proven',
    );
    expect(summary.security.credentialsCaptured).toBe(false);
  });
});
