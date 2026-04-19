import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearUiStateLog,
  clearAuditEventLog,
  getAuditEventLog,
  getUiStateLog,
  logAuditEvent,
  logUiState,
} from '../../../libs/audit/auditLogger';
import { maskSensitiveLog } from '../../../libs/logging/mask';
import {
  clearOutpatientFunnelLog,
  getOutpatientFunnelLog,
  recordOutpatientFunnel,
} from '../../../libs/telemetry/telemetryClient';
import { updateObservabilityMeta } from '../../../libs/observability/observability';
import { recordChartsAuditEvent } from '../audit';

const RUN_ID = '20251218T183545Z';
const TRACE_ID = 'trace-52-run';

describe('auditEvent と telemetry の runId 整合', () => {
  beforeEach(() => {
    updateObservabilityMeta({
      runId: RUN_ID,
      traceId: TRACE_ID,
      dataSourceTransition: 'server',
      cacheHit: false,
      missingMaster: false,
      fallbackUsed: false,
    });
  });

  afterEach(() => {
    clearOutpatientFunnelLog();
    clearAuditEventLog();
    clearUiStateLog();
  });

  it('主要操作(ORCA_SEND)で runId/traceId が一致する', () => {
    recordOutpatientFunnel('charts_action', {
      action: 'ORCA_SEND',
      outcome: 'started',
      durationMs: 1200,
      cacheHit: false,
      missingMaster: false,
      fallbackUsed: false,
      dataSourceTransition: 'server',
    });

    recordChartsAuditEvent({
      action: 'ORCA_SEND',
      outcome: 'started',
      durationMs: 1200,
      note: 'telemetry-audit-run-id-check',
    });

    const telemetry = getOutpatientFunnelLog()[0];
    const audit = getAuditEventLog()[0];
    const auditDetails =
      (audit?.payload as { details?: Record<string, unknown> } | undefined)
        ?.details ?? {};

    expect(telemetry?.runId).toBe(RUN_ID);
    expect(auditDetails.runId ?? audit?.runId).toBe(RUN_ID);
    expect(telemetry?.traceId).toBe(TRACE_ID);
    expect(auditDetails.traceId).toBe(TRACE_ID);
  });

  it('監査ログはマスク済みビューで機微情報を露出しない', () => {
    logUiState({
      action: 'navigate',
      screen: 'test',
      runId: RUN_ID,
      details: {
        facilityId: 'FAC-01',
        patientId: 'PT-999',
        appointmentId: 'APT-999',
        actor: 'FAC-01:USER-01',
        email: 'test@example.com',
      },
    });

    logAuditEvent({
      runId: RUN_ID,
      source: 'test',
      note: 'mask-check',
      payload: {
        action: 'TEST_ACTION',
        details: {
          facilityId: 'FAC-01',
          patientId: 'PT-999',
          appointmentId: 'APT-999',
          actor: 'FAC-01:USER-01',
          email: 'test@example.com',
          passwordMd5: 'deadbeef',
        },
      },
    });

    expect((window as any).__AUDIT_UI_STATE__).toBeUndefined();
    expect((window as any).__AUDIT_EVENTS__).toBeUndefined();

    const latestUiEntry = maskSensitiveLog(getUiStateLog().slice(-1)[0]);
    const eventEntry = maskSensitiveLog(getAuditEventLog().slice(-1)[0]);

    expect(latestUiEntry?.details?.facilityId).toBe('[REDACTED]');
    expect(latestUiEntry?.details?.patientId).toBeUndefined();
    expect(latestUiEntry?.details?.appointmentId).toBeUndefined();
    expect(latestUiEntry?.details?.actor).toBe('[REDACTED]');
    expect(latestUiEntry?.details?.email).toBeUndefined();

    const eventDetails = (eventEntry?.payload?.details ?? {}) as Record<string, unknown>;
    expect(eventDetails?.facilityId).toBe('[REDACTED]');
    expect(eventDetails?.patientId).toBeUndefined();
    expect(eventDetails?.appointmentId).toBeUndefined();
    expect(eventDetails?.actor).toBe('[REDACTED]');
    expect(eventDetails?.email).toBeUndefined();
    expect(eventDetails?.passwordMd5).toBeUndefined();
  });

  it('監査 payload は query/rawXml/authorization/cookie を保持しない', () => {
    logAuditEvent({
      runId: RUN_ID,
      source: 'test',
      note: 'payload-sanitize-check',
      payload: {
        action: 'TEST_ACTION',
        endpoint: '/api/patient/search?query=alice',
        query: 'alice',
        rawXml: '<Patient><Patient_ID>0001</Patient_ID></Patient>',
        authorization: 'Basic {{BASIC_AUTH}}',
        cookie: 'JSESSIONID=secret',
        details: {
          endpoint: '/api/patient/search?query=alice',
          query: 'alice',
          rawXml: '<Patient><Patient_ID>0001</Patient_ID></Patient>',
          authorization: 'Basic {{BASIC_AUTH}}',
          cookie: 'JSESSIONID=secret',
          facilityId: 'FAC-01',
        },
      },
    });

    const payload = getAuditEventLog()[0]?.payload as Record<string, unknown>;
    const details = (payload?.details ?? {}) as Record<string, unknown>;

    expect(payload?.endpoint).toBe('/api/patient/search');
    expect(payload?.query).toBeUndefined();
    expect(payload?.rawXml).toBeUndefined();
    expect(payload?.authorization).toBeUndefined();
    expect(payload?.cookie).toBeUndefined();
    expect(details.endpoint).toBe('/api/patient/search');
    expect(details.query).toBeUndefined();
    expect(details.rawXml).toBeUndefined();
    expect(details.authorization).toBeUndefined();
    expect(details.cookie).toBeUndefined();
    expect(details.facilityId).toBe('FAC-01');
  });
});
