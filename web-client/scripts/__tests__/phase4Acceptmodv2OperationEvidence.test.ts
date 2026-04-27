import { describe, expect, it } from 'vitest';

import {
  buildAcceptmodOperationDryRunSummary,
  classifyAcceptmodOperationResponse,
  validateAcceptmodOperationCommand,
} from '../qa-lib/phase4-acceptmodv2-operation-evidence.mjs';

const requiredArgs = [
  '--dry-run',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
  '--request-number',
  '02',
];

const rn02Preconditions = {
  activeAcceptanceRow: true,
  serverDerivedAcceptanceId: true,
  matchingPatientId: true,
  acceptanceDate: true,
  departmentPhysicianScope: true,
  duplicateLiveCheckpoint: true,
  parserSanitizerContract: true,
};

describe('phase4 acceptmodv2 operation no-live evidence', () => {
  it('accepts only sanitized dry-run mode for Request_Number=02', () => {
    const gate = validateAcceptmodOperationCommand({ argv: requiredArgs, env: {} });

    expect(gate.ok).toBe(true);
    expect(gate.endpoint).toBe('/orca11/acceptmodv2');
    expect(gate.options.operation).toBe('reception_delete_or_cancel');
    expect(gate.liveTrialMutationExecuted).toBe(false);
  });

  it('fails closed for live/raw artifact flags and Request_Number=03/04 in this revision', () => {
    const liveGate = validateAcceptmodOperationCommand({
      argv: [...requiredArgs, '--execute-live'],
      env: {},
    });
    expect(liveGate.ok).toBe(false);
    expect(liveGate.blockers).toContain('forbidden flag: --execute-live');

    for (const requestNumber of ['03', '04']) {
      const gate = validateAcceptmodOperationCommand({
        argv: [
          '--dry-run',
          '--sanitized-evidence-only',
          '--disable-browser-artifacts',
          '--request-number',
          requestNumber,
        ],
        env: {},
      });
      expect(gate.ok).toBe(false);
      expect(gate.blockers).toContain('only Request_Number=02 has a no-live dry-run packet in this wrapper revision');
    }
  });

  it('does not treat HTTP 2xx or apiResult zero alone as RN02 business success', () => {
    const result = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '02',
      apiResult: '00',
      preconditions: rn02Preconditions,
      completionEvidence: {},
    });

    expect(result.responseClassification).toBe('notVerified');
    expect(result.businessAccepted).toBe(false);
    expect(result.mutationSuccess).toBe(false);
  });

  it('requires server-derived RN02 preconditions before any success classification', () => {
    const result = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '02',
      apiResult: '00',
      preconditions: {
        ...rn02Preconditions,
        serverDerivedAcceptanceId: false,
      },
      completionEvidence: { cancellationEvidencePresent: true },
    });

    expect(result.responseClassification).toBe('preconditionNotVerified');
    expect(result.businessAccepted).toBe(false);
  });

  it('classifies RN02 success only when preconditions and cancellation evidence are both present', () => {
    const result = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '02',
      apiResult: '00',
      preconditions: rn02Preconditions,
      completionEvidence: { cancellationEvidencePresent: true },
    });

    expect(result.responseClassification).toBe('businessAccepted');
    expect(result.businessAccepted).toBe(true);
    expect(result.mutationSuccess).toBe(true);
  });

  it('builds sanitized no-live summary with explicit non-claims', () => {
    const gate = validateAcceptmodOperationCommand({ argv: requiredArgs, env: {} });
    const summary = buildAcceptmodOperationDryRunSummary({
      runId: '20260427T040311Z',
      requestNumber: '02',
      commandGate: gate,
    });

    expect(summary.liveTrialOrca.executed).toBe(false);
    expect(summary.noLivePacket.clientProvidedIdentifiersTrusted).toBe(false);
    expect(summary.rawArtifactsCommittedOrPackaged).toBe(false);
    expect(summary.claimBoundary).toContain('No-live acceptmodv2 Request_Number 02');
  });
});
