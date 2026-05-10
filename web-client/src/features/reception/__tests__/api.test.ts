import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchBillingOrcaTransmissionReviewList } from '../api';

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
