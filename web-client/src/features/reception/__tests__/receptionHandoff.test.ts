import { describe, expect, it } from 'vitest';

import {
  buildPendingAcceptHandoff,
  resolveAcceptMutationHandoff,
  resolvePatientChartsHandoff,
  resolvePendingAcceptHandoffFromEntries,
} from '../receptionHandoff';
import type { VisitMutationParams, VisitMutationPayload } from '../api';

const baseParams: VisitMutationParams = {
  patientId: 'P-001',
  requestNumber: '01',
  acceptanceDate: '2026-04-13',
  acceptanceTime: '09:00:00',
  acceptancePush: '1',
  departmentCode: '01',
  physicianCode: '10001',
};

describe('receptionHandoff', () => {
  it('accept mutation が canonical key を返した場合は mutation source で handoff を確立する', () => {
    const payload: VisitMutationPayload = {
      patient: { patientId: 'P-001' },
      acceptanceId: 'R-001',
      scheduleKey: 'F001:S100',
      encounterKey: 'F001:E100',
      acceptanceDate: '2026-04-13',
    };

    expect(resolveAcceptMutationHandoff(payload, baseParams)).toEqual({
      source: 'mutation',
      encounter: {
        patientId: 'P-001',
        appointmentId: undefined,
        receptionId: 'R-001',
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        visitDate: '2026-04-13',
      },
    });
  });

  it('pending handoff は patientId 単独一致では解決しない', () => {
    const pending = buildPendingAcceptHandoff(
      {
        patient: { patientId: 'P-001' },
        acceptanceDate: '2026-04-13',
      },
      baseParams,
    );

    const resolved = resolvePendingAcceptHandoffFromEntries(
      [
        {
          id: 'row-1',
          patientId: 'P-001',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          visitDate: '2026-04-13',
          status: '受付中',
          source: 'visits',
        },
      ],
      pending,
    );

    expect(resolved).toBeNull();
  });

  it('pending handoff は受付IDがなくても日付・診療科・医師で一意な refreshed entry を補完する', () => {
    const pending = buildPendingAcceptHandoff(
      {
        patient: { patientId: 'P-001' },
        acceptanceDate: '2026-04-13',
      },
      baseParams,
    );

    const resolved = resolvePendingAcceptHandoffFromEntries(
      [
        {
          id: 'row-1',
          patientId: 'P-001',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          visitDate: '2026-04-13',
          departmentCode: '01',
          physicianCode: '10001',
          status: '受付中',
          source: 'visits',
        },
      ],
      pending,
    );

    expect(resolved).toEqual({
      source: 'refreshed-entry',
      encounter: {
        patientId: 'P-001',
        appointmentId: undefined,
        receptionId: undefined,
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        visitDate: '2026-04-13',
      },
    });
  });

  it('pending handoff は日付・診療科・医師候補が複数ある場合 fail-close する', () => {
    const pending = buildPendingAcceptHandoff(
      {
        patient: { patientId: 'P-001' },
        acceptanceDate: '2026-04-13',
      },
      baseParams,
    );

    const resolved = resolvePendingAcceptHandoffFromEntries(
      [
        {
          id: 'row-1',
          patientId: 'P-001',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          visitDate: '2026-04-13',
          departmentCode: '01',
          physicianCode: '10001',
          status: '受付中',
          source: 'visits',
        },
        {
          id: 'row-2',
          patientId: 'P-001',
          scheduleKey: 'F001:S101',
          encounterKey: 'F001:E101',
          visitDate: '2026-04-13',
          departmentCode: '01',
          physicianCode: '10001',
          status: '診療中',
          source: 'visits',
        },
      ],
      pending,
    );

    expect(resolved).toBeNull();
  });

  it('pending handoff は acceptanceId 一致の refreshed entry で補完する', () => {
    const pending = buildPendingAcceptHandoff(
      {
        patient: { patientId: 'P-001' },
        acceptanceId: 'R-001',
        acceptanceDate: '2026-04-13',
      },
      baseParams,
    );

    const resolved = resolvePendingAcceptHandoffFromEntries(
      [
        {
          id: 'row-1',
          patientId: 'P-001',
          receptionId: 'R-001',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          visitDate: '2026-04-13',
          status: '受付中',
          source: 'visits',
        },
      ],
      pending,
    );

    expect(resolved).toEqual({
      source: 'refreshed-entry',
      encounter: {
        patientId: 'P-001',
        appointmentId: undefined,
        receptionId: 'R-001',
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        visitDate: '2026-04-13',
      },
    });
  });

  it('patient search charts handoff は accepted handoff を優先する', () => {
    const candidate = resolvePatientChartsHandoff({
      patientId: 'P-001',
      acceptedHandoff: {
        source: 'mutation',
        encounter: {
          patientId: 'P-001',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          visitDate: '2026-04-13',
        },
      },
      entries: [],
    });

    expect(candidate).toEqual({
      kind: 'ready',
      source: 'accepted',
      encounter: {
        patientId: 'P-001',
        appointmentId: undefined,
        receptionId: undefined,
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        visitDate: '2026-04-13',
      },
    });
  });

  it('patient search charts handoff は同一患者の active entry が複数ある場合 fail-close する', () => {
    const candidate = resolvePatientChartsHandoff({
      patientId: 'P-001',
      entries: [
        {
          id: 'row-1',
          patientId: 'P-001',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          status: '受付中',
          source: 'visits',
        },
        {
          id: 'row-2',
          patientId: 'P-001',
          scheduleKey: 'F001:S101',
          encounterKey: 'F001:E101',
          status: '診療中',
          source: 'visits',
        },
      ],
    });

    expect(candidate).toEqual({
      kind: 'blocked',
      reason: 'ambiguous_active_entries',
    });
  });

  it('patient search charts handoff は canonical key が無い active entry を block する', () => {
    const candidate = resolvePatientChartsHandoff({
      patientId: 'P-001',
      entries: [
        {
          id: 'row-1',
          patientId: 'P-001',
          receptionId: 'R-001',
          status: '受付中',
          source: 'visits',
        },
      ],
    });

    expect(candidate).toEqual({
      kind: 'blocked',
      reason: 'missing_handoff_key',
    });
  });
});
