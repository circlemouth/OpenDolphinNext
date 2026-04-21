import { describe, expect, it } from 'vitest';

import {
  buildSanitizedAcceptmodv2Summary,
  redactBody,
  sanitizeNetworkRecord,
} from '../qa-lib/acceptmodv2-business-evidence.mjs';

const c7Pass = {
  ok: true,
  targetMutationRequestCount: 1,
  checkedRequests: 1,
  violationCount: 0,
  violatedKeys: [],
  bodyKeysObserved: ['acceptancePush', 'patientId', 'requestNumber'],
  medicalInformationFieldPresent: false,
  intendedRequestNumber01: true,
  requestNumberKeyPresent: true,
  requestNumberKeysObserved: ['requestNumber'],
  requestNumber01ValueVerified: true,
  requestNumber02_03_04Absent: true,
  targetPatientId00001Verified: true,
  targetCandidateOnly00001: true,
  patientIdKeysObserved: ['patientId'],
  unspecifiedRun: true,
};

describe('acceptmodv2 business evidence summary', () => {
  it('apiResult=10 と C7 pass を businessRejected + C7GateObserved として分離する', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-1',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '10',
        apiResultMessage: '患者番号 0000001 に該当する患者が存在しません',
        acceptanceId: '',
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('businessRejected');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.business.businessRejected).toBe(true);
    expect(summary.business.c7GateObserved).toBe(true);
    expect(summary.rejectionReason).not.toContain('0000001');
    expect(summary.c7.checkedRequests).toBe(1);
    expect(summary.c7.violationCount).toBe(0);
  });

  it('K1 warning と C7 pass を business accepted として扱い acceptanceId 有無は別に記録する', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-2',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 0,
      acceptResponse: {
        status: 200,
        apiResult: 'K1',
        businessStatus: 'businessAcceptedWithWarnings',
        apiResultMessage: '警告あり',
        acceptanceId: '',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('businessAcceptedWithWarnings');
    expect(summary.business.businessAccepted).toBe(true);
    expect(summary.business.businessAcceptedWithWarnings).toBe(true);
    expect(summary.business.c7GateObserved).toBe(true);
    expect(summary.acceptanceIdPresent).toBe(false);
  });

  it('K3 warning と registration evidence と C7 pass が揃った場合だけ acceptedWithWarnings にする', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-2',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 0,
      acceptResponse: {
        status: 200,
        apiResult: 'K3',
        requestNumber: '01',
        businessStatus: 'businessAcceptedWithWarnings',
        apiResultMessage: '警告あり',
        acceptanceId: '',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('businessAcceptedWithWarnings');
    expect(summary.business.businessAccepted).toBe(true);
    expect(summary.business.businessAcceptedWithWarnings).toBe(true);
    expect(summary.c7.accepted).toBe(true);
    expect(summary.c7.requestNumber01ValueVerified).toBe(true);
  });

  it('K1 warning code だけでは business accepted にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-2',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: 'K1',
        businessStatus: 'businessAcceptedWithWarnings',
        apiResultMessage: '警告あり',
        acceptanceId: '',
        hasRegistrationEvidence: false,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.business.businessAcceptedWithWarnings).toBe(false);
  });

  it('K3 warning code だけでは business accepted にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-2',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: 'K3',
        requestNumber: '01',
        businessStatus: 'businessAcceptedWithWarnings',
        apiResultMessage: '警告あり',
        acceptanceId: '',
        hasRegistrationEvidence: false,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.business.businessAcceptedWithWarnings).toBe(false);
  });

  it('Request_Number=00 diagnostic は registration evidence があっても mutation success にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-3',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '00',
        requestNumber: '00',
        businessStatus: 'businessAccepted',
        acceptanceId: 'redacted-by-summary',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.business.mutationSuccess).toBe(false);
  });

  it('Request_Number=02/03/04 は Phase 3 mutation success にしない', () => {
    for (const requestNumber of ['02', '03', '04']) {
      const summary = buildSanitizedAcceptmodv2Summary({
        runId: '20260419T013639Z',
        candidateId: 'candidate-3',
        preflightPath: 'artifacts/preflight/summary.json',
        preflightSha256: 'abc123',
        command: 'node scripts/qa-acceptmodv2-weborca.mjs',
        cwd: 'web-client',
        startTime: '2026-04-19T01:36:39.000Z',
        endTime: '2026-04-19T01:36:40.000Z',
        exitCode: 1,
        acceptResponse: {
          status: 200,
          apiResult: '00',
          requestNumber,
          businessStatus: 'businessAccepted',
          acceptanceId: 'redacted-by-summary',
          hasRegistrationEvidence: true,
        },
        medicalInformationGate: c7Pass,
        patientIdMatched: true,
      });

      expect(summary.responseClassification).toBe('forbiddenMutationRequest');
      expect(summary.business.businessAccepted).toBe(false);
      expect(summary.business.mutationSuccess).toBe(false);
      expect(summary.phase3RequestNumberPolicy.intendedMutationRequestNumber).toBe('01');
      expect(summary.phase3RequestNumberPolicy.requestNumber02To04Forbidden).toBe(true);
    }
  });

  it('apiResult=60 diagnostic は mutation success にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-3',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '60',
        requestNumber: '01',
        businessStatus: 'diagnosticNoExistingAcceptance',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('diagnosticNoExistingAcceptance');
    expect(summary.business.diagnosticNoExistingAcceptance).toBe(true);
    expect(summary.business.mutationSuccess).toBe(false);
    expect(summary.phase3RequestNumberPolicy.apiResult60IsDiagnosticOnly).toBe(true);
  });

  it('Phase 3 not-run summary は success と読めない explicit not-run evidence を持つ', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-4',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: null,
      medicalInformationGate: {
        ok: false,
        targetMutationRequestCount: 0,
        checkedRequests: 0,
        violationCount: 1,
        violatedKeys: ['targetMutationRequest'],
        bodyKeysObserved: [],
        medicalInformationFieldPresent: false,
        unspecifiedRun: true,
      },
      patientIdMatched: true,
    });

    expect(summary.phase3.ran).toBe(false);
    expect(summary.phase3.mutationSuccess).toBe(false);
    expect(summary.phase3.notRunBusinessEvidenceAbsent).toBe(true);
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.business.businessAcceptedWithWarnings).toBe(false);
    expect(summary.business.notRunBusinessEvidenceAbsent).toBe(true);
    expect(summary.c7.verdict).toBe('not_verified');
    expect(summary.c7.accepted).toBe(false);
  });

  it('C7 target mutation request count が 0 の summary は business accepted にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-5',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '00',
        businessStatus: 'businessAccepted',
        acceptanceId: 'redacted-by-summary',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: {
        ok: true,
        targetMutationRequestCount: 0,
        checkedRequests: 0,
        violationCount: 0,
        violatedKeys: [],
        bodyKeysObserved: [],
        medicalInformationFieldPresent: false,
        unspecifiedRun: true,
      },
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.c7.accepted).toBe(false);
    expect(summary.c7.verdict).toBe('not_verified');
  });

  it('C7 target mutation request count が複数の summary は business accepted にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-5',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '00',
        requestNumber: '01',
        businessStatus: 'businessAccepted',
        acceptanceId: 'redacted-by-summary',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: {
        ...c7Pass,
        targetMutationRequestCount: 2,
        checkedRequests: 2,
      },
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.c7.accepted).toBe(false);
  });

  it('C7 requestNumber01ValueVerified が false の summary は business accepted にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-5',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '00',
        requestNumber: '00',
        businessStatus: 'businessAccepted',
        acceptanceId: 'redacted-by-summary',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: {
        ...c7Pass,
        requestNumber01ValueVerified: false,
      },
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.c7.accepted).toBe(false);
    expect(summary.c7.requestNumber01ValueVerified).toBe(false);
  });

  it('patient identity mismatch は business accepted にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-5',
      preflightPath: 'artifacts/preflight/summary.json',
      preflightSha256: 'abc123',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '00',
        requestNumber: '01',
        businessStatus: 'businessAccepted',
        acceptanceId: 'redacted-by-summary',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: false,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.c7.accepted).toBe(false);
  });

  it('preflight artifact path/hash が無ければ C7 accepted と business accepted にしない', () => {
    const summary = buildSanitizedAcceptmodv2Summary({
      runId: '20260419T013639Z',
      candidateId: 'candidate-6',
      preflightPath: '',
      preflightSha256: '',
      command: 'node scripts/qa-acceptmodv2-weborca.mjs',
      cwd: 'web-client',
      startTime: '2026-04-19T01:36:39.000Z',
      endTime: '2026-04-19T01:36:40.000Z',
      exitCode: 1,
      acceptResponse: {
        status: 200,
        apiResult: '00',
        businessStatus: 'businessAccepted',
        acceptanceId: 'redacted-by-summary',
        hasRegistrationEvidence: true,
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('notVerified');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.c7.preflightArtifactIncluded).toBe(false);
    expect(summary.c7.accepted).toBe(false);
  });


  it('body redaction helper は key を残して値を保存しない', () => {
    const redacted = redactBody('{"patientId":"0000001","nested":{"token":"secret"},"count":1}');

    expect(redacted).toContain('"patientId"');
    expect(redacted).toContain('"nested"');
    expect(redacted).not.toContain('0000001');
    expect(redacted).not.toContain('secret');
    expect(redacted).not.toContain(':1');
  });

  it('network artifact redaction は raw request/response body と secret header を除外する', () => {
    const record = sanitizeNetworkRecord({
      url: 'https://localhost/api/orca/official/visits/mutation?token=secret-token',
      status: 200,
      statusText: 'OK',
      request: {
        method: 'POST',
        headers: { authorization: 'fixture-token', 'content-type': 'application/json' },
        postData: '{"patientId":"0000001","medicalInformation":null}',
      },
      response: {
        headers: { 'set-cookie': 'fixture-session' },
        body: '{"apiResult":"10","apiResultMessage":"patient 0000001"}',
      },
    });

    expect(record.url).not.toContain('secret-token');
    expect(record.request.headers.authorization).toBe('<<redacted>>');
    expect(record.response.headers['set-cookie']).toBe('<<redacted>>');
    expect(record.request.postData).not.toContain('0000001');
    expect(record.response.body).not.toContain('patient 0000001');
  });
});
