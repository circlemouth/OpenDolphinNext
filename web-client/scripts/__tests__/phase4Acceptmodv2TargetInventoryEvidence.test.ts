import { describe, expect, it } from 'vitest';

import {
  buildAcceptmodTargetInventoryDryRunSummary,
  sanitizeAcceptlstInventoryResponse,
  validateAcceptmodTargetInventoryCommand,
} from '../qa-lib/phase4-acceptmodv2-target-inventory-evidence.mjs';

const requiredArgs = [
  '--dry-run',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
  '--class',
  '01',
  '--acceptance-date',
  '2026-04-27',
];

describe('phase4 acceptmodv2 target inventory no-live evidence', () => {
  it('accepts only sanitized dry-run mode for acceptlstv2 inventory contract', () => {
    const gate = validateAcceptmodTargetInventoryCommand({ argv: requiredArgs, env: {} });

    expect(gate.ok).toBe(true);
    expect(gate.endpoint).toBe('/api/orca/official/visits/acceptance-list');
    expect(gate.orcaEndpoint).toBe('/api01rv2/acceptlstv2');
    expect(gate.readOnlyTrialOrcaExecuted).toBe(false);
    expect(gate.liveTrialMutationExecuted).toBe(false);
  });

  it('fails closed for live/raw artifact flags and unsupported classes', () => {
    const liveGate = validateAcceptmodTargetInventoryCommand({
      argv: [...requiredArgs, '--execute-readonly'],
      env: {},
    });
    expect(liveGate.ok).toBe(false);
    expect(liveGate.blockers).toContain('forbidden flag: --execute-readonly');

    const unsupportedGate = validateAcceptmodTargetInventoryCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--class',
        '04',
      ],
      env: {},
    });
    expect(unsupportedGate.ok).toBe(false);
    expect(unsupportedGate.blockers).toContain('--class must be one of 01, 02, or 03');
  });

  it('sanitizes acceptlstv2 inventory into presence flags and hashes only', () => {
    const sanitized = sanitizeAcceptlstInventoryResponse({
      httpStatus: 200,
      apiResult: '00',
      entries: [
        {
          acceptanceId: 'A-1',
          acceptanceDate: '2026-04-27',
          acceptanceTime: '09:00:00',
          departmentCode: '01',
          departmentName: 'Internal Medicine',
          physicianCode: '10001',
          physicianName: 'Doctor Name',
          medicalInformation: '01',
          insuranceCombinationNumber: '0001',
          patient: {
            patientId: '00001',
            wholeName: 'Patient Name',
            healthInsuredPersonNumber: 'raw-insurance-number',
          },
        },
      ],
    });

    expect(sanitized.targetReady).toBe(true);
    expect(sanitized.targetReadyRowCount).toBe(1);
    expect(sanitized.rows[0].rowHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(sanitized)).not.toContain('Patient Name');
    expect(JSON.stringify(sanitized)).not.toContain('Doctor Name');
    expect(JSON.stringify(sanitized)).not.toContain('raw-insurance-number');
    expect(JSON.stringify(sanitized)).not.toContain('00001');
    expect(sanitized.rows[0].rawSensitiveFieldsExcluded).toBe(true);
  });

  it('does not mark target ready when server-derived identifiers are incomplete', () => {
    const sanitized = sanitizeAcceptlstInventoryResponse({
      status: 200,
      Api_Result: '00',
      acceptances: [
        {
          Acceptance_Date: '2026-04-27',
          Acceptance_Time: '09:00:00',
          Department_Code: '01',
          Physician_Code: '10001',
          Patient_Information: { Patient_ID: '00001' },
        },
      ],
    });

    expect(sanitized.targetReady).toBe(false);
    expect(sanitized.targetReadyRowCount).toBe(0);
    expect(sanitized.rows[0].hasAcceptanceId).toBe(false);
    expect(sanitized.rows[0].hasInsuranceCombinationNumber).toBe(false);
  });

  it('builds dry-run summary with explicit non-claims and no raw artifact claims', () => {
    const gate = validateAcceptmodTargetInventoryCommand({ argv: requiredArgs, env: {} });
    const summary = buildAcceptmodTargetInventoryDryRunSummary({
      runId: '20260427T160229Z',
      commandGate: gate,
    });

    expect(summary.readOnlyTrialOrca.executed).toBe(false);
    expect(summary.liveTrialOrca.executed).toBe(false);
    expect(summary.noLivePacket.clientProvidedIdentifiersTrusted).toBe(false);
    expect(summary.rawArtifactsCommittedOrPackaged).toBe(false);
    expect(summary.claimBoundary).toContain('No-live acceptlstv2 target inventory');
  });
});
