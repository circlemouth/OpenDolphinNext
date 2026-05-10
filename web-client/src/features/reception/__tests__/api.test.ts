import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchBillingOrcaTransmissionReviewList, reconcileBillingOrcaTemporaryMedical } from '../api';

const httpFetch = vi.hoisted(() => vi.fn());

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch,
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/devtools/mockGate', () => ({
  readMockRuntimeState: vi.fn(),
  resolveMockGateDecision: () => ({ allowed: false }),
}));

vi.mock('../../../libs/observability/observability', () => ({
  updateObservabilityMeta: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

describe('fetchBillingOrcaTransmissionReviewList', () => {
  beforeEach(() => {
    httpFetch.mockReset();
  });

  it('calls the server-scoped review endpoint with only a clamped limit and removes sensitive fields from the client model', async () => {
    httpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        limit: 20,
        count: 1,
        runId: 'RUN-REVIEW',
        traceId: 'TRACE-SERVER',
        entries: [
          {
            transmissionId: 1,
            encounterKey: 'encounter-1',
            scheduleKey: 'schedule-1',
            patientId: 'P-001',
            state: 'ORCA_UNKNOWN',
            operationStatus: 'UNKNOWN',
            needsUserReview: true,
            confirmationRequired: true,
            idempotencyKey: 'IDEMPOTENCY-SECRET',
            requestId: 'REQUEST-SERVER',
            traceId: 'TRACE-ENTRY',
            apiResult: 'UNKNOWN',
            apiResultMessage: '結果未確定',
          },
        ],
      }),
    });

    const response = await fetchBillingOrcaTransmissionReviewList({ limit: 500 });

    expect(httpFetch).toHaveBeenCalledWith(
      '/api/local/encounters/orca-transmissions/review?limit=100',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    );
    expect(response).toMatchObject({
      ok: true,
      limit: 20,
      count: 1,
      runId: 'RUN-REVIEW',
      entries: [
        {
          transmissionId: 1,
          encounterKey: 'encounter-1',
          scheduleKey: 'schedule-1',
          patientId: 'P-001',
          state: 'ORCA_UNKNOWN',
          operationStatus: 'UNKNOWN',
          needsUserReview: true,
          confirmationRequired: true,
          apiResult: 'UNKNOWN',
          apiResultMessage: '結果未確定',
        },
      ],
    });
    expect(response.entries[0]).not.toHaveProperty('idempotencyKey');
    expect(response.entries[0]).not.toHaveProperty('requestId');
    expect(response.entries[0]).not.toHaveProperty('traceId');
  });
});

describe('reconcileBillingOrcaTemporaryMedical', () => {
  beforeEach(() => {
    httpFetch.mockReset();
  });

  it('posts only the transmission id path and drops sensitive ORCA fields from the client model', async () => {
    httpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        transmissionId: 42,
        snapshotId: 100,
        encounterKey: 'encounter-1',
        scheduleKey: 'schedule-1',
        patientId: 'P-001',
        operationStatus: 'ORCA_TEMPORARY_MEDICAL_FOUND',
        reconciliationStatus: 'TEMPORARY_MEDICAL_FOUND',
        needsUserReview: true,
        rawSensitiveFieldsExcluded: true,
        clientProvidedIdentifiersTrusted: false,
        serverDerivedAuthorityRequired: true,
        apiResult: '00',
        apiResultMessage: '処理終了',
        httpStatus: 200,
        temporaryMedicalRowCount: 2,
        matchingTemporaryMedicalRowCount: 1,
        medicalUidPresent: true,
        medicalMode: '0',
        medicalMode2: '0',
        medicalUid: 'SECRET-MEDICAL-UID',
        insuranceCombinationNumber: 'SECRET-INSURANCE',
        rawResponseBody: '<xml>secret</xml>',
      }),
    });

    const response = await reconcileBillingOrcaTemporaryMedical({ transmissionId: 42 });

    expect(httpFetch).toHaveBeenCalledWith(
      '/api/local/encounters/orca-transmissions/42/reconcile-temporary-medical',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json' },
      }),
    );
    const requestOptions = httpFetch.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(requestOptions).not.toHaveProperty('body');
    expect(response).toMatchObject({
      ok: true,
      transmissionId: 42,
      operationStatus: 'ORCA_TEMPORARY_MEDICAL_FOUND',
      reconciliationStatus: 'TEMPORARY_MEDICAL_FOUND',
      needsUserReview: true,
      rawSensitiveFieldsExcluded: true,
      clientProvidedIdentifiersTrusted: false,
      serverDerivedAuthorityRequired: true,
      matchingTemporaryMedicalRowCount: 1,
      temporaryMedicalRowCount: 2,
      medicalUidPresent: true,
      medicalMode: '0',
      medicalMode2: '0',
    });
    expect(response).not.toHaveProperty('medicalUid');
    expect(response).not.toHaveProperty('insuranceCombinationNumber');
    expect(response).not.toHaveProperty('rawResponseBody');
  });
});
