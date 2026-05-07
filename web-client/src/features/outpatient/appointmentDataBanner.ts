import type { BannerTone } from '../reception/components/ToneBanner';
import { buildApiFailureBanner } from '../shared/apiError';
import type { ReceptionEntry } from './types';

export type AppointmentDataBanner = {
  tone: BannerTone;
  message: string;
};

type AppointmentDataBannerInput = {
  entries: ReceptionEntry[];
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  date?: string;
};

export type AppointmentDataIntegrityCounts = {
  missingPatientId: number;
  missingAppointmentId: number;
  missingReceptionId: number;
};

const hasReceptionIdentity = (entry: ReceptionEntry) =>
  Boolean(entry.receptionId || entry.scheduleKey || entry.encounterKey);

const hasScheduleIdentity = (entry: ReceptionEntry) =>
  Boolean(entry.appointmentId || entry.scheduleKey || entry.encounterKey);

export const countAppointmentDataIntegrity = (entries: ReceptionEntry[]): AppointmentDataIntegrityCounts => ({
  missingPatientId: entries.filter((entry) => !entry.patientId).length,
  // projected schedule rows may be keyed by canonical schedule/encounter keys before ORCA assigns a visible appointment id.
  missingAppointmentId: entries.filter((entry) => entry.source !== 'visits' && !hasScheduleIdentity(entry)).length,
  missingReceptionId: entries.filter((entry) => entry.source === 'visits' && !hasReceptionIdentity(entry)).length,
});

export function getAppointmentDataBanner({
  entries,
  isLoading,
  isError,
  error,
  date,
}: AppointmentDataBannerInput): AppointmentDataBanner | null {
  if (isLoading && entries.length === 0) {
    return { tone: 'info', message: `予約/来院データを取得中…${date ? `（${date}）` : ''}` };
  }

  if (isError) {
    const banner = buildApiFailureBanner('予約/来院データ', { error }, '取得');
    return { tone: banner.tone, message: banner.message };
  }

  if (entries.length === 0) {
    return { tone: 'info', message: `予約/来院データがありません。${date ? `（${date}）` : ''}` };
  }

  const { missingPatientId, missingAppointmentId, missingReceptionId } = countAppointmentDataIntegrity(entries);

  if (missingPatientId === 0 && missingAppointmentId === 0 && missingReceptionId === 0) return null;

  const parts = [
    missingPatientId > 0 ? `患者ID欠損: ${missingPatientId}` : undefined,
    missingAppointmentId > 0 ? `予約識別子欠損: ${missingAppointmentId}` : undefined,
    missingReceptionId > 0 ? `受付識別子欠損: ${missingReceptionId}` : undefined,
  ].filter((value): value is string => typeof value === 'string');

  return { tone: 'warning', message: `予約/来院データに不整合があります（${parts.join(' / ')}）` };
}
