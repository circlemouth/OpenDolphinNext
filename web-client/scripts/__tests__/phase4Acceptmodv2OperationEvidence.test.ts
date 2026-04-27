import { describe, expect, it } from 'vitest';

import {
  buildAcceptmodOperationDryRunSummary,
  classifyAcceptmodOperationResponse,
  deriveAcceptmodOperationPreconditionStatus,
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

const rn03Preconditions = {
  activeAcceptanceRow: true,
  serverDerivedAcceptanceId: true,
  serverAuthoritativeUpdateFields: true,
  duplicateLiveCheckpoint: true,
  parserSanitizerContract: true,
};

const rn04Preconditions = {
  activeAcceptanceRow: true,
  serverDerivedAcceptanceIdentifiers: true,
  explicitClaimSendInfoPolicy: true,
  duplicateLiveCheckpoint: true,
  rollbackDuplicatePolicy: true,
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

  it('accepts sanitized dry-run mode for Request_Number=03 and 04 without live mutation', () => {
    for (const [requestNumber, operation] of [
      ['03', 'reception_update_or_change'],
      ['04', 'claim_send_information_update_or_supporting_action'],
    ] as const) {
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

      expect(gate.ok).toBe(true);
      expect(gate.options.operation).toBe(operation);
      expect(gate.liveTrialMutationExecuted).toBe(false);
    }
  });

  it('fails closed for live/raw artifact flags and unsupported request numbers', () => {
    const liveGate = validateAcceptmodOperationCommand({
      argv: [...requiredArgs, '--execute-live'],
      env: {},
    });
    expect(liveGate.ok).toBe(false);
    expect(liveGate.blockers).toContain('forbidden flag: --execute-live');

    const unsupportedGate = validateAcceptmodOperationCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--request-number',
        '01',
      ],
      env: {},
    });
    expect(unsupportedGate.ok).toBe(false);
    expect(unsupportedGate.blockers).toContain('--request-number must be one of 02, 03, or 04');
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

  it('classifies RN03 success only with server-authoritative update preconditions and evidence', () => {
    const missingEvidence = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '03',
      apiResult: '00',
      preconditions: rn03Preconditions,
      completionEvidence: {},
    });
    expect(missingEvidence.responseClassification).toBe('notVerified');
    expect(missingEvidence.businessAccepted).toBe(false);

    const missingPrecondition = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '03',
      apiResult: '00',
      preconditions: {
        ...rn03Preconditions,
        serverAuthoritativeUpdateFields: false,
      },
      completionEvidence: { updateEvidencePresent: true },
    });
    expect(missingPrecondition.responseClassification).toBe('preconditionNotVerified');

    const accepted = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '03',
      apiResult: '00',
      preconditions: rn03Preconditions,
      completionEvidence: { updateEvidencePresent: true },
    });
    expect(accepted.responseClassification).toBe('businessAccepted');
    expect(accepted.mutationSuccess).toBe(true);
  });

  it('classifies RN04 success only with explicit Claim_Send_Info policy and evidence', () => {
    const missingPolicy = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '04',
      apiResult: '00',
      preconditions: {
        ...rn04Preconditions,
        explicitClaimSendInfoPolicy: false,
      },
      completionEvidence: { claimSendInfoEvidencePresent: true },
    });
    expect(missingPolicy.responseClassification).toBe('preconditionNotVerified');
    expect(missingPolicy.businessAccepted).toBe(false);

    const missingEvidence = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '04',
      apiResult: '00',
      preconditions: rn04Preconditions,
      completionEvidence: {},
    });
    expect(missingEvidence.responseClassification).toBe('notVerified');

    const accepted = classifyAcceptmodOperationResponse({
      httpStatus: 200,
      requestNumber: '04',
      apiResult: '00',
      preconditions: rn04Preconditions,
      completionEvidence: { claimSendInfoEvidencePresent: true },
    });
    expect(accepted.responseClassification).toBe('businessAccepted');
    expect(accepted.businessAccepted).toBe(true);
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

  it('fails closed when RN02 precondition evidence lacks server-derived acceptance id', () => {
    const status = deriveAcceptmodOperationPreconditionStatus({
      requestNumber: '02',
      preconditionSummary: {
        runId: '20260426T150137Z',
        taskId: 'RWO-06G_READONLY_FIRST_VISIT_CHECK',
        target: { patientId: '00001', acceptanceDate: '20260427' },
        readOnlyResult: {
          activeAcceptanceEvidencePresent: false,
          evidenceHash: 'hash-only',
        },
        credentialsCaptured: false,
        rawArtifactsCommittedOrPackaged: false,
      },
    });

    expect(status.liveReady).toBe(false);
    expect(status.status).toBe('preconditions_missing_stop_before_live');
    expect(status.missing).toContain('active_acceptance_row');
    expect(status.missing).toContain('server_derived_acceptance_id');
    expect(status.derived.parserSanitizerContract).toBe(true);
    expect(status.clientProvidedIdentifiersTrusted).toBe(false);
  });

  it('records precondition preflight in dry-run summaries without making live claims', () => {
    const gate = validateAcceptmodOperationCommand({ argv: requiredArgs, env: {} });
    const summary = buildAcceptmodOperationDryRunSummary({
      runId: '20260427T114612Z',
      requestNumber: '02',
      commandGate: gate,
      preconditionSummary: {
        target: { patientId: '00001', acceptanceDate: '20260427' },
        readOnlyResult: {
          activeAcceptanceEvidencePresent: true,
          evidenceHash: 'sanitized-hash',
        },
        credentialsCaptured: false,
        rawArtifactsCommittedOrPackaged: false,
      },
    });

    expect(summary.preconditionPreflight.sourcePresent).toBe(true);
    expect(summary.preconditionPreflight.liveReady).toBe(false);
    expect(summary.preconditionPreflight.missing).toContain('server_derived_acceptance_id');
    expect(summary.liveTrialOrca.executed).toBe(false);
  });

  it('builds RN03/RN04 summaries with request-specific claim boundaries', () => {
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
      const summary = buildAcceptmodOperationDryRunSummary({
        runId: '20260427T043310Z',
        requestNumber,
        commandGate: gate,
      });

      expect(summary.liveTrialOrca.executed).toBe(false);
      expect(summary.claimBoundary).toContain(`Request_Number ${requestNumber}`);
      expect(summary.noLivePacket.requiredPreconditions.length).toBeGreaterThan(0);
    }
  });
});
