import { describe, expect, it } from 'vitest';

import {
  buildMasterLastUpdateXml,
  buildMasterValiditySummary,
  buildMedicationGetXml,
  executeReadonlyMasterChecks,
  resolveTrialReadonlyConfig,
  sanitizeReadonlyXmlResult,
  validateMasterValidityCommand,
} from '../qa-lib/phase4-master-validity-evidence.mjs';

const payloadPath = 'qa/payloads/phase4/medicalmodv2_injection_trial_reachability_v2.json';
const payloadSha256 = '1af0b23246e8f9ee79879b28a09888ecc719ec8f6381e2b798cd63fa020e3300';

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
      effectiveDateClass: 'present',
      rawOrcaBodyStored: false,
    }));
    expect(JSON.stringify(sanitized)).not.toContain('raw-name-not-copied');
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
      baseDate: '20260422',
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
    expect(buildMedicationGetXml({ requestCode: '620000012', baseDate: '20260422' })).toContain('620000012');
    expect(fetched.slice(1).every((entry) => entry.body === buildMasterLastUpdateXml())).toBe(true);
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
