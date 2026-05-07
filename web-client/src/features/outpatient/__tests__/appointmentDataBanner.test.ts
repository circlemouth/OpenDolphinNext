import { describe, expect, it } from 'vitest';

import { countAppointmentDataIntegrity, getAppointmentDataBanner } from '../appointmentDataBanner';
import type { ReceptionEntry } from '../types';

const buildEntry = (overrides: Partial<ReceptionEntry> = {}): ReceptionEntry => ({
  id: overrides.id ?? 'entry-1',
  appointmentId: overrides.appointmentId ?? 'A-001',
  receptionId: overrides.receptionId ?? 'R-001',
  patientId: overrides.patientId ?? '00001',
  name: overrides.name ?? 'テスト患者',
  status: overrides.status ?? '予約',
  source: overrides.source ?? 'reservations',
  ...overrides,
});

describe('appointmentDataBanner', () => {
  it('予約外受付（visits）は appointmentId 未設定でも予約ID欠損にしない', () => {
    const entries: ReceptionEntry[] = [
      buildEntry({
        source: 'visits',
        status: '受付中',
        appointmentId: undefined,
        receptionId: 'R-WALKIN-1',
      }),
    ];

    const counts = countAppointmentDataIntegrity(entries);
    expect(counts.missingPatientId).toBe(0);
    expect(counts.missingAppointmentId).toBe(0);
    expect(counts.missingReceptionId).toBe(0);
    expect(getAppointmentDataBanner({ entries })).toBeNull();
  });

  it('visits は receptionId がなくても canonical key があれば受付識別子欠損にしない', () => {
    const entries: ReceptionEntry[] = [
      buildEntry({
        source: 'visits',
        status: '受付中',
        appointmentId: undefined,
        receptionId: undefined,
        encounterKey: 'FAC:E-001',
      }),
    ];

    const counts = countAppointmentDataIntegrity(entries);
    expect(counts.missingReceptionId).toBe(0);
    expect(getAppointmentDataBanner({ entries })).toBeNull();
  });

  it('予約データ（reservations）は appointmentId がなくても canonical key があれば欠損にしない', () => {
    const entries: ReceptionEntry[] = [
      buildEntry({
        source: 'reservations',
        status: '予約',
        appointmentId: undefined,
        scheduleKey: 'FAC:S-001',
      }),
    ];

    const counts = countAppointmentDataIntegrity(entries);
    expect(counts.missingAppointmentId).toBe(0);
    expect(getAppointmentDataBanner({ entries })).toBeNull();
  });

  it('予約データ（reservations）で予約識別子が欠損なら警告する', () => {
    const entries: ReceptionEntry[] = [
      buildEntry({
        source: 'reservations',
        status: '予約',
        appointmentId: undefined,
        scheduleKey: undefined,
        encounterKey: undefined,
      }),
    ];

    const banner = getAppointmentDataBanner({ entries });
    expect(banner?.tone).toBe('warning');
    expect(banner?.message).toContain('予約識別子欠損: 1');
  });

  it('visits の受付識別子欠損は警告する', () => {
    const entries: ReceptionEntry[] = [
      buildEntry({
        source: 'visits',
        status: '受付中',
        appointmentId: undefined,
        receptionId: undefined,
      }),
    ];

    const banner = getAppointmentDataBanner({ entries });
    expect(banner?.tone).toBe('warning');
    expect(banner?.message).toContain('受付識別子欠損: 1');
  });
});
