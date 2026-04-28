import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildMasterLastUpdateXml,
  buildMasterValiditySummary,
  buildMedicationGetInputCodeXml,
  buildMedicationGetXml,
  buildSurgeryMasterProofSummary,
  executeReadonlyMasterChecks,
  executeReadonlySurgeryMasterProofChecks,
  MEDICATIONGETV2_REQUEST_SEMANTICS,
  resolveTrialReadonlyConfig,
  sanitizeReadonlyXmlResult,
  summarizeSurgeryV3AdjunctMasterProofPlan,
  validateMasterValidityCommand,
  validateSurgeryMasterProofCommand,
} from '../qa-lib/phase4-master-validity-evidence.mjs';

const payloadPath = 'qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v2.json';
const payloadSha256 = '1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300';
const surgeryPayloadPath = 'qa/payloads/phase4/medicalmodv2_surgery_trial_reachability_v3.json';
const surgeryPayloadSha256 = 'f1046a303a1d78e12c6409efc7cb68bcb96bc6737428846c24e2fa4981af9421';

describe('phase4 injection master validity readonly evidence', () => {
  it('accepts the injection v2 payload only in sanitized dry-run mode', () => {
    const guard = validateMasterValidityCommand({
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
    expect(guard.payloadEvidence?.plan.candidateCodes).toEqual({
      procedure: '130000510',
      medication: '620000012',
      material: '700000031',
      comment: '0085001',
    });
    expect(guard.rawPayloadStored).toBe(false);
    expect(guard.rawOrcaBodyStored).toBe(false);
    expect(guard.credentialsCaptured).toBe(false);
  });

  it('requires a changed injectable medication candidate for read-only row proof', () => {
    const rejectedOldCode = validateMasterValidityCommand({
      argv: [
        '--execute-readonly',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payloadPath,
        '--payload-sha256',
        payloadSha256,
        '--medication-code',
        '620000012',
      ],
      env: {},
      cwd: process.cwd(),
    });

    expect(rejectedOldCode.ok).toBe(false);
    expect(rejectedOldCode.blockers).toContain('620000012 must not be retried unchanged as injectable medication evidence');

    const acceptedChangedCode = validateMasterValidityCommand({
      argv: [
        '--execute-readonly',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payloadPath,
        '--payload-sha256',
        payloadSha256,
        '--medication-code',
        '620076111',
      ],
      env: {},
      cwd: process.cwd(),
    });

    expect(acceptedChangedCode.ok).toBe(true);
    expect(acceptedChangedCode.payloadEvidence?.plan.candidateCodes.medication).toBe('620076111');
    expect(acceptedChangedCode.payloadEvidence?.plan.selectedReadonlyCandidate).toEqual(expect.objectContaining({
      requestNumber: '02',
      code: '620076111',
      payloadMedicationCodeOverridden: true,
    }));
    expect(acceptedChangedCode.payloadEvidence?.plan.readOnlyChecksRequiredBeforeLive[0].code).toBe('620076111');
  });

  it('rejects raw artifact flags and ambiguous execution mode before any network use', () => {
    const guard = validateMasterValidityCommand({
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
    expect(resolveTrialReadonlyConfig({ ORCA_BASE_URL: 'https://example.test/', ORCA_API_USER: 'u', ORCA_API_PASSWORD: 'p' }))
      .toEqual(expect.objectContaining({
        ok: false,
        blockers: ['non_trial_orca_host_forbidden'],
        credentialConfigured: true,
      }));
    expect(resolveTrialReadonlyConfig({ ORCA_BASE_URL: 'https://weborca-trial.orca.med.or.jp/' }))
      .toEqual(expect.objectContaining({
        ok: false,
        blockers: ['missing_trial_basic_credential'],
        credentialConfigured: false,
      }));
  });

  it('sanitizes medicationgetv2 XML without preserving raw body or sensitive detail', () => {
    const xml = [
      '<data><medicationgetv2res>',
      '<Api_Result>0000</Api_Result>',
      '<Medication_Information><Medication_Code>620000012</Medication_Code>',
      '<Medication_Name>raw-name-not-copied</Medication_Name><StartDate>20260401</StartDate></Medication_Information>',
      '</medicationgetv2res></data>',
    ].join('');
    const sanitized = sanitizeReadonlyXmlResult({
      role: 'medication',
      endpoint: 'medicationgetv2',
      code: '620000012',
      httpStatus: 200,
      xml,
    });

    expect(sanitized).toEqual(expect.objectContaining({
      role: 'medication',
      endpoint: 'medicationgetv2',
      code: '620000012',
      httpStatusClass: '2xx',
      apiResultClass: 'success_zero',
      masterFound: true,
      request02ResultClass: 'row_found_with_selection_comments',
      effectiveDateClass: 'present',
      rawOrcaBodyStored: false,
    }));
    expect(JSON.stringify(sanitized)).not.toContain('raw-name-not-copied');
  });

  it('classifies official medicationgetv2 E/W results without treating them as row proof', () => {
    const officialError = sanitizeReadonlyXmlResult({
      role: 'medication',
      endpoint: 'medicationgetv2',
      code: '620000012',
      httpStatus: 200,
      xml: '<xmlio2><medicationgetres><Api_Result>E02</Api_Result></medicationgetres></xmlio2>',
    });
    expect(officialError).toEqual(expect.objectContaining({
      apiResultClass: 'official_error',
      request02ResultClass: 'official_error_no_row_proof',
      masterFound: false,
    }));

    const officialWarning = sanitizeReadonlyXmlResult({
      role: 'medication',
      endpoint: 'medicationgetv2',
      code: '620000012',
      httpStatus: 200,
      xml: '<xmlio2><medicationgetres><Api_Result>W24</Api_Result><Medication_Code>620000012</Medication_Code></medicationgetres></xmlio2>',
    });
    expect(officialWarning).toEqual(expect.objectContaining({
      apiResultClass: 'official_warning',
      request02ResultClass: 'official_warning_no_row_proof',
      masterFound: false,
    }));
  });

  it('keeps medicationgetv2 RN01 input-code lookup separate from RN02 selectable-comment row proof', () => {
    expect(MEDICATIONGETV2_REQUEST_SEMANTICS['01']).toEqual(expect.objectContaining({
      proofClass: 'point_master_lookup_only',
      selectableCommentProof: false,
    }));
    expect(MEDICATIONGETV2_REQUEST_SEMANTICS['02']).toEqual(expect.objectContaining({
      proofClass: 'row_level_selectable_comment_lookup',
      selectableCommentProof: true,
    }));
    expect(buildMedicationGetInputCodeXml({ inputCode: 'Y00001', baseDate: '2026-04-27' }))
      .toContain('<Request_Number type="string">01</Request_Number>');
    expect(buildMedicationGetXml({ requestCode: '621894701', baseDate: '2026-04-27' }))
      .toContain('<Request_Number type="string">02</Request_Number>');

    const rn01 = sanitizeReadonlyXmlResult({
      role: 'medication',
      endpoint: 'medicationgetv2',
      requestNumber: '01',
      code: '621894701',
      httpStatus: 200,
      xml:
        '<xmlio2><medicationgetres><Api_Result>000</Api_Result>' +
        '<Medication_Information><Medication_Code>621894701</Medication_Code></Medication_Information></medicationgetres></xmlio2>',
    });
    expect(rn01).toEqual(expect.objectContaining({
      requestNumber: '01',
      requestSemantics: 'point_master_lookup_only',
      request02ResultClass: 'input_code_point_master_lookup_not_selectable_comment_proof',
      selectableCommentProof: false,
      masterFound: false,
    }));

    const rn02 = sanitizeReadonlyXmlResult({
      role: 'medication',
      endpoint: 'medicationgetv2',
      requestNumber: '02',
      code: '621894701',
      httpStatus: 200,
      xml:
        '<xmlio2><medicationgetres><Api_Result>000</Api_Result>' +
        '<Medication_Information><Medication_Code>621894701</Medication_Code></Medication_Information>' +
        '<Selection_Expression_Information></Selection_Expression_Information></medicationgetres></xmlio2>',
    });
    expect(rn02).toEqual(expect.objectContaining({
      requestNumber: '02',
      requestSemantics: 'row_level_selectable_comment_lookup',
      request02ResultClass: 'row_found_with_selection_comments',
      selectableCommentProof: true,
      masterFound: true,
    }));
  });

  it('executes readonly checks through sanitized fetch results only', async () => {
    const fetched: Array<{ url: string; body?: string }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      fetched.push({ url, body: typeof init.body === 'string' ? init.body : undefined });
      const endpoint = url.includes('medicationgetv2') ? 'medication' : 'master';
      const body =
        endpoint === 'medication'
          ? '<data><Api_Result>0000</Api_Result><Medication_Code>620000012</Medication_Code><StartDate>20260401</StartDate></data>'
          : '<data><Api_Result>0000</Api_Result><Last_Update_Date>20260401</Last_Update_Date></data>';
      return new Response(body, { status: 200 });
    };

    const checks = await executeReadonlyMasterChecks({
      config: {
        baseUrl: new URL('https://weborca-trial.orca.med.or.jp/'),
        user: 'user',
        password: 'password',
      },
      plan: {
        candidateCodes: {
          medication: '620000012',
          procedure: '130000510',
          material: '700000031',
          comment: '0085001',
        },
      },
      baseDate: '2026-04-22',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(checks).toHaveLength(4);
    expect(checks.every((entry) => entry.masterFound)).toBe(true);
    expect(fetched.map((entry) => new URL(entry.url).hostname)).toEqual([
      'weborca-trial.orca.med.or.jp',
      'weborca-trial.orca.med.or.jp',
      'weborca-trial.orca.med.or.jp',
      'weborca-trial.orca.med.or.jp',
    ]);
    expect(fetched[0].url).toContain('/api/api01rv2/medicationgetv2?class=01');
    expect(fetched[0].body).toContain('<Base_Date type="string">2026-04-22</Base_Date>');
    expect(buildMedicationGetXml({ requestCode: '620000012', baseDate: '2026-04-22' })).toContain('620000012');
    expect(fetched.slice(1).every((entry) => entry.body === buildMasterLastUpdateXml())).toBe(true);
  });

  it('normalizes compact base dates to the official dashed medicationgetv2 format', () => {
    const guard = validateMasterValidityCommand({
      argv: [
        '--execute-readonly',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        payloadPath,
        '--payload-sha256',
        payloadSha256,
        '--base-date',
        '20260422',
        '--medication-code',
        '620076111',
      ],
      env: {},
      cwd: process.cwd(),
    });

    expect(guard.ok).toBe(true);
    expect(guard.options.baseDate).toBe('2026-04-22');
  });

  it('classifies readonly validation separately from live business acceptance', () => {
    const summary = buildMasterValiditySummary({
      guard: {
        payloadEvidence: {
          sha256: payloadSha256,
          bytes: 10,
          plan: {},
        },
      },
      runId: 'RUN',
      traceId: 'TRACE',
      verdict: 'readonly_master_validity_validated',
      readonlyChecks: [
        { httpStatusClass: '2xx', apiResultClass: 'success_zero', masterFound: true },
        { httpStatusClass: '2xx', apiResultClass: 'success_zero', masterFound: true },
        { httpStatusClass: '2xx', apiResultClass: 'success_zero', masterFound: true },
        { httpStatusClass: '2xx', apiResultClass: 'success_zero', masterFound: true },
      ],
    });

    expect(summary.liveTrialMutation).toBe('not_run');
    expect(summary.masterValidity.businessSuccessClassification).toBe(
      'readonly_master_validity_validated_not_business_acceptance',
    );
    expect(summary.security.credentialsCaptured).toBe(false);
  });
});

describe('phase4 surgery v3 adjunct master proof evidence', () => {
  it('accepts only the official-sample-style surgery v3 payload in sanitized mode', () => {
    const guard = validateSurgeryMasterProofCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        surgeryPayloadPath,
        '--payload-sha256',
        surgeryPayloadSha256,
      ],
      env: {},
      cwd: process.cwd(),
    });

    expect(guard.ok).toBe(true);
    expect(guard.payloadEvidence?.plan.candidateCodes).toEqual(['150003110', '641210099', '840000042']);
    expect(guard.payloadEvidence?.plan.officialSampleRowRoles).toEqual([
      { role: 'surgeryProcedure', code: '150003110' },
      { role: 'surgeryAdjunct', code: '641210099' },
      { role: 'surgeryAdjunct', code: '840000042' },
    ]);
    expect(guard.payloadEvidence?.plan.rowRoleProofScope).toEqual(
      expect.objectContaining({
        rowOrderFixtureSource: 'official_medicalmodv2_class_500_sample',
        rowCodeValiditySeparatedFromRoleApplicability: true,
        roleApplicabilityProofEndpointFound: false,
      }),
    );
    expect(guard.payloadEvidence?.plan.readOnlyChecksRequiredBeforeLive).toEqual([
      expect.objectContaining({ role: 'surgeryProcedure', endpoint: 'medicationgetv2', requestNumber: '02', code: '150003110' }),
      expect.objectContaining({ role: 'surgeryAdjunct', endpoint: 'medicationgetv2', requestNumber: '02', code: '641210099' }),
      expect.objectContaining({ role: 'surgeryAdjunct', endpoint: 'medicationgetv2', requestNumber: '02', code: '840000042' }),
    ]);
    expect(guard.rawPayloadStored).toBe(false);
    expect(guard.rawOrcaBodyStored).toBe(false);
    expect(guard.credentialsCaptured).toBe(false);
  });

  it('rejects surgery row-role fixtures that do not preserve official sample ordering', () => {
    const payload = JSON.parse(fs.readFileSync(surgeryPayloadPath, 'utf8'));
    payload.medicalInformation[0].medications = [
      payload.medicalInformation[0].medications[1],
      payload.medicalInformation[0].medications[0],
      payload.medicalInformation[0].medications[2],
    ];
    const plan = summarizeSurgeryV3AdjunctMasterProofPlan(payload);

    expect(plan.ok).toBe(false);
    expect(plan.blockers).toContain('official surgery sample row 1 must be surgeryProcedure:150003110');
    expect(plan.blockers).toContain('official surgery sample row 2 must be surgeryAdjunct:641210099');
    expect(plan.rawPayloadStored).toBe(false);
    expect(plan.rawPatientOrInsuranceDetailStored).toBe(false);
  });

  it('rejects ambiguous surgery proof modes and raw artifact flags before network use', () => {
    const guard = validateSurgeryMasterProofCommand({
      argv: [
        '--dry-run',
        '--execute-readonly',
        '--record-har',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        surgeryPayloadPath,
      ],
      env: {},
      cwd: process.cwd(),
    });

    expect(guard.ok).toBe(false);
    expect(guard.blockers).toContain('forbidden flag: --record-har');
    expect(guard.blockers).toContain('exactly one of --dry-run or --execute-readonly is required');
  });

  it('executes surgery row proof checks through medicationgetv2 Request_Number 02 without storing raw bodies', async () => {
    const guard = validateSurgeryMasterProofCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--payload',
        surgeryPayloadPath,
        '--payload-sha256',
        surgeryPayloadSha256,
      ],
      env: {},
      cwd: process.cwd(),
    });
    const fetched: Array<{ url: string; body?: string }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      const body = typeof init.body === 'string' ? init.body : '';
      fetched.push({ url, body });
      const code = body.match(/<Request_Code type="string">(\d+)<\/Request_Code>/)?.[1] ?? '';
      return new Response(
        `<data><Api_Result>0000</Api_Result><Medication_Code>${code}</Medication_Code><StartDate>20260401</StartDate></data>`,
        { status: 200 },
      );
    };

    const checks = await executeReadonlySurgeryMasterProofChecks({
      config: {
        baseUrl: new URL('https://weborca-trial.orca.med.or.jp/'),
        user: 'user',
        password: 'password',
      },
      plan: guard.payloadEvidence?.plan,
      baseDate: '2026-04-27',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const summary = buildSurgeryMasterProofSummary({
      guard,
      runId: '20260427T094613Z',
      traceId: 'trace-test',
      readonlyChecks: checks,
      verdict: 'readonly_surgery_adjunct_rows_validated',
    });

    expect(checks).toHaveLength(3);
    expect(checks.every((entry) => entry.masterFound && entry.rawOrcaBodyStored === false)).toBe(true);
    expect(fetched.every((entry) => entry.url.includes('/api/api01rv2/medicationgetv2?class=01'))).toBe(true);
    expect(fetched.map((entry) => entry.body?.includes('<Request_Number type="string">02</Request_Number>'))).toEqual([
      true,
      true,
      true,
    ]);
    expect(summary.surgeryMasterProof.allRowsProven).toBe(true);
    expect(summary.surgeryMasterProof.businessSuccessClassification).toBe(
      'readonly_surgery_adjunct_rows_validated_not_business_acceptance',
    );
    expect(JSON.stringify(summary)).not.toContain('password');
  });
});
