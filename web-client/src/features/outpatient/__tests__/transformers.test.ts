import { describe, expect, it } from 'vitest';

import { parseAppointmentEntries } from '../transformers';

describe('outpatient transformers', () => {
  it('parseAppointmentEntries keeps canonical scheduleKey / encounterKey from raw payloads', () => {
    const entries = parseAppointmentEntries({
      appointmentDate: '2026-03-26',
      slots: [
        {
          appointmentId: 'A-100',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          patient: { patientId: '000001', wholeName: '山田' },
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        appointmentId: 'A-100',
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        patientId: '000001',
      }),
    );
  });

  it('prefers encounterKey over older identifiers during de-duplication', () => {
    const entries = parseAppointmentEntries({
      visits: [
        {
          receptionId: 'R-1',
          scheduleKey: 'F001:S200',
          encounterKey: 'F001:E200',
          patient: { patientId: '000002' },
        },
        {
          receptionId: 'R-2',
          scheduleKey: 'F001:S200',
          encounterKey: 'F001:E200',
          patient: { patientId: '000002' },
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.encounterKey).toBe('F001:E200');
    expect(entries[0]?.scheduleKey).toBe('F001:S200');
  });
});
