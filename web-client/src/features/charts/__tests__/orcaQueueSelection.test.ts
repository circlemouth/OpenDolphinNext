import { describe, expect, it } from 'vitest';

import type { OutpatientEncounterContext } from '../encounterContext';
import {
  resolveChartsAppointmentQueryDate,
  resolveClaimQueueEntryForEncounter,
  resolveOrcaQueueEntryForEncounter,
  resolveReceptionEntryForEncounter,
} from '../orcaQueueSelection';

describe('orcaQueueSelection', () => {
  it('claim queue は encounterKey を優先し patientId first-match に戻さない', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-100',
      encounterKey: 'F001:E200',
      appointmentId: 'APT-200',
    };

    const resolved = resolveClaimQueueEntryForEncounter(
      [
        { id: 'queue-1', phase: 'pending', patientId: 'P-100', encounterKey: 'F001:E100', appointmentId: 'APT-100' },
        { id: 'queue-2', phase: 'ack', patientId: 'P-100', encounterKey: 'F001:E200', appointmentId: 'APT-200' },
      ],
      encounterContext,
    );

    expect(resolved?.id).toBe('queue-2');
  });

  it('claim queue は patientId だけで複数候補がある場合に未選択へ倒す', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-100',
    };

    const resolved = resolveClaimQueueEntryForEncounter(
      [
        { id: 'queue-1', phase: 'pending', patientId: 'P-100', encounterKey: 'F001:E100' },
        { id: 'queue-2', phase: 'ack', patientId: 'P-100', encounterKey: 'F001:E200' },
      ],
      encounterContext,
    );

    expect(resolved).toBeUndefined();
  });

  it('ORCA queue も patientId だけで複数候補がある場合は曖昧扱いにする', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-100',
    };

    const resolved = resolveOrcaQueueEntryForEncounter(
      [
        { patientId: 'P-100', status: 'pending', lastDispatchAt: '2026-04-10T09:00:00Z' },
        { patientId: 'P-100', status: 'failed', lastDispatchAt: '2026-04-10T10:00:00Z' },
      ],
      encounterContext,
    );

    expect(resolved).toBeUndefined();
  });

  it('ORCA queue は patientId が一意な場合だけ選択する', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-200',
    };

    const resolved = resolveOrcaQueueEntryForEncounter(
      [
        { patientId: 'P-100', status: 'pending' },
        { patientId: 'P-200', status: 'delivered' },
      ],
      encounterContext,
    );

    expect(resolved).toEqual({ patientId: 'P-200', status: 'delivered' });
  });

  it('Charts 受付一覧の取得日は handoff visitDate を優先する', () => {
    expect(
      resolveChartsAppointmentQueryDate(
        {
          patientId: 'P-250',
          visitDate: '2026-04-24',
          encounterKey: 'F001:E250',
        },
        '2026-04-25',
      ),
    ).toBe('2026-04-24');
  });

  it('Charts 受付一覧の取得日は handoff visitDate がない場合だけ当日へ戻す', () => {
    expect(
      resolveChartsAppointmentQueryDate(
        {
          patientId: 'P-251',
          encounterKey: 'F001:E251',
        },
        '2026-04-25',
      ),
    ).toBe('2026-04-25');
  });

  it('reception entry は handoff key がずれても patientId/visitDate の一意な official visit row で補完する', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-300',
      visitDate: '2026-04-25',
      encounterKey: 'F001:ACCEPT-FROM-MUTATION',
      scheduleKey: 'F001:VISIT-FROM-MUTATION',
    };

    const resolved = resolveReceptionEntryForEncounter(
      [
        {
          id: 'projection-only',
          patientId: 'P-300',
          visitDate: '2026-04-25',
          encounterKey: 'F001:ACCEPT-FROM-MUTATION',
          scheduleKey: 'F001:VISIT-FROM-MUTATION',
          status: '受付中',
          source: 'visits',
        },
        {
          id: 'official-row',
          patientId: 'P-300',
          visitDate: '2026-04-25',
          encounterKey: 'F001:OFFICIAL-VOUCHER',
          scheduleKey: 'F001:OFFICIAL-SEQUENTIAL',
          insuranceCombinationNumber: '0001',
          voucherNumber: 'OFFICIAL-VOUCHER',
          sequentialNumber: 'OFFICIAL-SEQUENTIAL',
          status: '受付中',
          source: 'visits',
        },
      ],
      encounterContext,
    );

    expect(resolved?.id).toBe('official-row');
  });

  it('reception entry は exact key がない場合だけ official visit row の一意補完を使う', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-301',
      visitDate: '2026-04-25',
      encounterKey: 'F001:ACCEPT-FROM-MUTATION',
      scheduleKey: 'F001:VISIT-FROM-MUTATION',
    };

    const resolved = resolveReceptionEntryForEncounter(
      [
        {
          id: 'official-row',
          patientId: 'P-301',
          visitDate: '2026-04-25',
          encounterKey: 'F001:OFFICIAL-VOUCHER',
          scheduleKey: 'F001:OFFICIAL-SEQUENTIAL',
          insuranceCombinationNumber: '0001',
          voucherNumber: 'OFFICIAL-VOUCHER',
          sequentialNumber: 'OFFICIAL-SEQUENTIAL',
          status: '受付中',
          source: 'visits',
        },
      ],
      encounterContext,
    );

    expect(resolved?.id).toBe('official-row');
  });

  it('reception entry は official identifiers が揃わない row を patientId/visitDate で補完しない', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-302',
      visitDate: '2026-04-25',
      encounterKey: 'F001:UNKNOWN-ENCOUNTER',
    };

    const resolved = resolveReceptionEntryForEncounter(
      [
        {
          id: 'projection-only',
          patientId: 'P-302',
          visitDate: '2026-04-25',
          encounterKey: 'F001:OTHER-ENCOUNTER',
          scheduleKey: 'F001:OTHER-SCHEDULE',
          status: '受付中',
          source: 'visits',
        },
      ],
      encounterContext,
    );

    expect(resolved).toBeUndefined();
  });

  it('reception entry は official visit row が複数ある場合に曖昧扱いで補完しない', () => {
    const encounterContext: OutpatientEncounterContext = {
      patientId: 'P-303',
      visitDate: '2026-04-25',
      encounterKey: 'F001:UNKNOWN-ENCOUNTER',
    };

    const resolved = resolveReceptionEntryForEncounter(
      [
        {
          id: 'official-row-1',
          patientId: 'P-303',
          visitDate: '2026-04-25',
          insuranceCombinationNumber: '0001',
          voucherNumber: 'V-1',
          sequentialNumber: 'S-1',
          status: '受付中',
          source: 'visits',
        },
        {
          id: 'official-row-2',
          patientId: 'P-303',
          visitDate: '2026-04-25',
          insuranceCombinationNumber: '0001',
          voucherNumber: 'V-2',
          sequentialNumber: 'S-2',
          status: '受付中',
          source: 'visits',
        },
      ],
      encounterContext,
    );

    expect(resolved).toBeUndefined();
  });
});
