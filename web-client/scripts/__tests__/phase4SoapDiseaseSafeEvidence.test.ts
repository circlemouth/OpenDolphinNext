import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildSoapDiseaseDuplicateCheckpointKey,
  buildSoapDiseaseLiveReadinessCheckpointKey,
  classifySoapDiseaseBusinessResult,
  parseSoapDiseaseSafeArgs,
  sanitizeSoapDiseaseOfficialResponse,
  sanitizeSoapDiseaseResponse,
  validateSoapDiseasePayload,
  validateSoapDiseaseSafeCommand,
} from '../qa-lib/phase4-soap-disease-safe-evidence.mjs';

const payloadPath = (fileName: string) => path.join(process.cwd(), 'qa', 'payloads', 'phase4', fileName);
const stubPath = (fileName: string) =>
  path.join(process.cwd(), '..', 'server-modernized', 'src', 'test', 'resources', 'orca', 'stub', fileName);

const SUBJECTIVES_PAYLOAD = payloadPath('subjectivesv2_phase4_dummy_native_intent_v1.json');
const SUBJECTIVES_SHA256 = '9c90a3b0d731bce2b9e1280d01a5c61222bbd97126e3f9fc50aa6135842dc308';
const SUBJECTIVES_STUB = stubPath('64_subjectivesv2_response.sample.xml');
const DISEASE_PAYLOAD = payloadPath('diseasev3_phase4_dummy_native_intent_v1.json');
const DISEASE_SHA256 = 'da4bd8dfd726e0c5838d0e06e0cabcf34d7fd984286c753ae4d59fb629f5f8df';
const DISEASE_STUB = stubPath('57_diseasev3_response.sample.xml');

describe('phase4 SOAP/disease no-live safe evidence', () => {
  it('accepts subjectivesv2 dry-run with fixed endpoint and target only', () => {
    const result = validateSoapDiseaseSafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'subjectivesv2',
        '--payload',
        SUBJECTIVES_PAYLOAD,
        '--payload-sha256',
        SUBJECTIVES_SHA256,
        '--fixture',
        SUBJECTIVES_STUB,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T06:39:36Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpoint).toBe('/orca25/subjectivesv2');
    expect(result.evidence.officialServerRoute).toBe('/api/orca/official/chart-support/subjectives-mod-v2');
    expect(result.evidence.liveTrialAction).toBe('not_run_forbidden_by_contract');
    expect(result.evidence.liveReadinessIdentity.status).toBe('prepared_no_live');
    expect(result.evidence.liveReadinessIdentity.liveMutationPermittedByThisPrompt).toBe(false);
    expect(result.evidence.liveReadinessIdentity.successCriteria.completionEvidenceRequired).toBe(true);
    expect(result.evidence.payload.summary.endpointMatched).toBe(true);
    expect(result.evidence.payload.summary.patientIdMatched).toBe(true);
    expect(result.evidence.response.responseClassification).toBe('notVerified');
    expect(result.evidence.response.businessAccepted).toBe(false);
    expect(result.evidence.payload.rawPayloadStored).toBe(false);
    expect(result.evidence.response.rawResponseBodyStored).toBe(false);
  });

  it('accepts diseasev3 create dry-run and keeps update/delete not authorized', () => {
    const result = validateSoapDiseaseSafeCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'diseasev3',
        '--payload',
        DISEASE_PAYLOAD,
        '--payload-sha256',
        DISEASE_SHA256,
        '--fixture',
        DISEASE_STUB,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T06:39:36Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.endpoint).toBe('/orca22/diseasev3');
    expect(result.evidence.requestSemantics.createOnly).toBe(true);
    expect(result.evidence.requestSemantics.updateDeleteNotAuthorized).toBe(true);
    expect(result.evidence.payload.summary.disease.recordCount).toBe(1);
    expect(result.evidence.response.apiResultZeroEquivalent).toBe(true);
    expect(result.evidence.response.responseClassification).toBe('notVerified');
  });

  it('builds stable no-live duplicate checkpoint identities', () => {
    expect(
      buildSoapDiseaseDuplicateCheckpointKey({
        workflow: 'subjectivesv2',
        payloadSha256: SUBJECTIVES_SHA256,
      }),
    ).toBe(`rwo06b:subjectivesv2:rwo06b-subjectivesv2-no-live-v1:target-00001:operation-create:payload-sha256-${SUBJECTIVES_SHA256}`);
    expect(
      buildSoapDiseaseDuplicateCheckpointKey({
        workflow: 'diseasev3',
        payloadSha256: DISEASE_SHA256,
      }),
    ).toBe(`rwo06b:diseasev3:rwo06b-diseasev3-create-no-live-v1:target-00001:operation-create:payload-sha256-${DISEASE_SHA256}`);
  });

  it('builds endpoint-specific live-readiness checkpoint identity without allowing live mutation', () => {
    expect(
      buildSoapDiseaseLiveReadinessCheckpointKey({
        workflow: 'subjectivesv2',
        payloadSha256: SUBJECTIVES_SHA256,
      }),
    ).toBe(
      `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-${SUBJECTIVES_SHA256}`,
    );
    expect(
      buildSoapDiseaseLiveReadinessCheckpointKey({
        workflow: 'diseasev3',
        payloadSha256: DISEASE_SHA256,
      }),
    ).toBe(
      `rwo06b:diseasev3:rwo06b-diseasev3-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-${DISEASE_SHA256}`,
    );
  });

  it('rejects fullflow and raw artifact flags before any action', () => {
    const parsed = parseSoapDiseaseSafeArgs([
      '--dry-run',
      '--sanitized-evidence-only',
      '--disable-browser-artifacts',
      '--phase4-only',
      '--workflow',
      'subjectivesv2',
      '--fullflow',
      '--request-xml',
    ]);

    expect(parsed.errors).toContain('forbidden flag: --fullflow');
    expect(parsed.errors).toContain('forbidden flag: --request-xml');
  });

  it('accepts the exact subjectivesv2 live checkpoint command without running network', () => {
    const result = validateSoapDiseaseSafeCommand({
      argv: [
        '--execute-approved-phase4',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase4-only',
        '--workflow',
        'subjectivesv2',
        '--payload',
        SUBJECTIVES_PAYLOAD,
        '--payload-sha256',
        SUBJECTIVES_SHA256,
      ],
      env: {},
      cwd: '/repo/web-client',
      now: new Date('2026-04-24T10:02:23Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.liveTrialAction).toBe('approved_to_execute_by_command_contract');
    expect(result.evidence.liveReadinessIdentity.key).toBe(
      `rwo06b:subjectivesv2:rwo06b-subjectivesv2-live-readiness-v1:target-00001:operation-create:request-01:class-01:payload-sha256-${SUBJECTIVES_SHA256}`,
    );
    expect(result.evidence.liveReadinessIdentity.liveMutationPermittedByThisPrompt).toBe(true);
    expect(result.evidence.duplicateCheckpoint.liveMutationPermittedWhenReady).toBe(true);
  });

  it('fails closed on target drift, endpoint drift, forbidden Request_Number, and sha mismatch', () => {
    const payload = JSON.parse(fs.readFileSync(DISEASE_PAYLOAD, 'utf8'));
    payload.patientId = '00002';
    payload.endpoint = '/orca21/medicalmodv2';
    payload.requestNumber = '02';

    const result = validateSoapDiseasePayload({
      workflow: 'diseasev3',
      payload,
      payloadSha256: 'actual',
      expectedPayloadSha256: 'expected',
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('endpoint must be /orca22/diseasev3');
    expect(result.blockers).toContain('target patient must be 00001');
    expect(result.blockers).toContain('Request_Number 02/03/04 is forbidden for subjectivesv2/diseasev3 no-live wrappers');
    expect(result.blockers).toContain('diseasev3 no-live wrapper allows only create semantics; Request_Number must be absent or 01');
    expect(result.blockers).toContain('payload sha256 mismatch');
  });

  it('does not classify HTTP 200 and apiResult zero alone as business success', () => {
    const response = sanitizeSoapDiseaseResponse({
      workflow: 'subjectivesv2',
      httpStatus: 200,
      xml: fs.readFileSync(SUBJECTIVES_STUB, 'utf8'),
    });

    expect(response.apiResultZeroEquivalent).toBe(true);
    expect(response.responseClassification).toBe('notVerified');
    expect(response.businessAccepted).toBe(false);
    expect(response.rawApiResultMessageStored).toBe(false);
    expect(JSON.stringify(response)).not.toContain('<xmlio2>');
  });

  it('redacts sensitive-shaped Api_Result_Message into a category only', () => {
    const sensitiveMessage = ['患者', '番号 00001 は', '保険', '未確認'].join('');
    const xml = [
      '<xmlio2><diseaseres><Api_Result>0010</Api_Result><Api_Result_Message>',
      sensitiveMessage,
      '</Api_Result_Message></diseaseres></xmlio2>',
    ].join('');
    const response = sanitizeSoapDiseaseResponse({
      workflow: 'diseasev3',
      httpStatus: 200,
      xml,
    });

    expect(response.responseClassification).toBe('businessRejected');
    expect(response.apiResultMessageCategory).toBe('present_redacted_sensitive_shape');
    expect(JSON.stringify(response)).not.toContain(sensitiveMessage);
  });

  it('requires completion evidence beyond parser success before business acceptance', () => {
    const business = classifySoapDiseaseBusinessResult({
      httpStatus: 200,
      parsedResponse: {
        parserAmbiguous: false,
        apiResultZeroEquivalent: true,
        completionEvidence: {
          subjectivesCompletionMarkerPresent: false,
          diseaseMutationMarkerPresent: false,
        },
      },
    });

    expect(business.responseClassification).toBe('notVerified');
    expect(business.businessAccepted).toBe(false);
  });

  it('classifies official subjectivesv2 JSON only with completion evidence', () => {
    const response = sanitizeSoapDiseaseOfficialResponse({
      workflow: 'subjectivesv2',
      httpStatus: 200,
      responseJson: {
        ok: true,
        apiOk: true,
        businessAccepted: true,
        apiResult: '00',
        informationDate: '2026-04-24',
        informationTime: '10:15:00',
      },
    });

    expect(response.responseClassification).toBe('businessAccepted');
    expect(response.businessAccepted).toBe(true);
    expect(response.completionEvidence.subjectivesCompletionMarkerPresent).toBe(true);
    expect(response.rawResponseBodyStored).toBe(false);
  });
});
