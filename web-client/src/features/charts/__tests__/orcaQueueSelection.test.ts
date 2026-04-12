import { describe, expect, it } from 'vitest';

import type { OutpatientEncounterContext } from '../encounterContext';
import { resolveClaimQueueEntryForEncounter, resolveOrcaQueueEntryForEncounter } from '../orcaQueueSelection';

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
});
