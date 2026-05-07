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

  it('keeps visit canonical ORCA context fields from raw payloads', () => {
    const entries = parseAppointmentEntries({
      visitDate: '2026-03-26',
      visits: [
        {
          voucherNumber: 'V-100',
          sequentialNumber: 'S-100',
          insuranceCombinationNumber: '0003',
          departmentCode: '01',
          physicianCode: '10001',
          patient: { patientId: '000003' },
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        patientId: '000003',
        visitDate: '2026-03-26',
        voucherNumber: 'V-100',
        sequentialNumber: 'S-100',
        insuranceCombinationNumber: '0003',
        departmentCode: '01',
        physicianCode: '10001',
      }),
    );
  });

  it('keeps projected schedule rows usable when only canonical keys and root patient id are present', () => {
    const entries = parseAppointmentEntries({
      appointmentDate: '2026-05-07',
      slots: [
        {
          scheduleKey: 'F001:S-PROJECTED',
          encounterKey: 'F001:E-PROJECTED',
          patientId: '000099',
          appointmentTime: '0930',
          departmentCode: '01',
          physicianCode: '10001',
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: 'F001:S-PROJECTED',
        patientId: '000099',
        scheduleKey: 'F001:S-PROJECTED',
        encounterKey: 'F001:E-PROJECTED',
      }),
    );
  });

  it('ignores selector option rows returned alongside appointment and visit records', () => {
    const entries = parseAppointmentEntries({
      appointmentDate: '2026-05-07',
      visitDate: '2026-05-07',
      slots: [
        { physicianCode: '10001', physicianName: '内科 太郎' },
        {
          scheduleKey: 'F001:S300',
          appointmentTime: '0900',
          patient: { patientId: '000004', wholeName: '予約 患者' },
        },
      ],
      visits: [
        { departmentCode: '01', departmentName: '内科' },
        {
          voucherNumber: '00001',
          updateTime: '0505',
          departmentCode: '01',
          physicianCode: '10001',
          patient: { patientId: '000003', wholeName: '事例 三' },
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.patientId).sort()).toEqual(['000003', '000004']);
  });

  it('keeps rows with canonical identity even when patient context is missing so integrity checks can warn', () => {
    const entries = parseAppointmentEntries({
      appointmentDate: '2026-05-07',
      slots: [
        {
          scheduleKey: 'F001:S-MISSING-PATIENT',
          appointmentTime: '1000',
          physicianCode: '10001',
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        scheduleKey: 'F001:S-MISSING-PATIENT',
        patientId: undefined,
      }),
    );
  });

  it('classifies accepted visit rows with updateTime as 受付中 instead of 予約', () => {
    const entries = parseAppointmentEntries({
      visitDate: '2026-05-03',
      visits: [
        {
          receptionId: '00002',
          updateTime: '051501',
          departmentCode: '01',
          physicianCode: '10001',
          patient: { patientId: '000001', wholeName: 'Seed Patient' },
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        patientId: '000001',
        receptionId: '00002',
        status: '受付中',
        source: 'visits',
      }),
    );
  });
});
