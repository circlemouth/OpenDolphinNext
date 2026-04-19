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
  bodyKeysObserved: ['acceptancePush', 'patientId'],
  medicalInformationFieldPresent: false,
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
        apiResultMessage: '警告あり',
        acceptanceId: '',
      },
      medicalInformationGate: c7Pass,
      patientIdMatched: true,
    });

    expect(summary.responseClassification).toBe('businessRejected');
    expect(summary.business.businessAccepted).toBe(false);
    expect(summary.business.businessAcceptedWithWarnings).toBe(false);
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
        headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
        postData: '{"patientId":"0000001","medicalInformation":null}',
      },
      response: {
        headers: { 'set-cookie': 'JSESSIONID=secret' },
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
