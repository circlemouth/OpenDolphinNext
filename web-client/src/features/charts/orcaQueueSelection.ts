import type { ClaimQueueEntry, ReceptionEntry } from '../outpatient/types';
import type { OrcaQueueEntry } from '../outpatient/orcaQueueApi';
import type { OutpatientEncounterContext } from './encounterContext';

const normalizeId = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const findEntryByField = <T>(
  entries: T[],
  selector: (entry: T) => string | undefined,
  expected?: string,
) => {
  if (!expected) return undefined;
  return entries.find((entry) => selector(entry) === expected);
};

export const resolveClaimQueueEntryForEncounter = (
  entries: ClaimQueueEntry[],
  encounterContext?: OutpatientEncounterContext | null,
): ClaimQueueEntry | undefined => {
  const encounterKey = normalizeId(encounterContext?.encounterKey);
  const scheduleKey = normalizeId(encounterContext?.scheduleKey);
  const appointmentId = normalizeId(encounterContext?.appointmentId);
  const patientId = normalizeId(encounterContext?.patientId);

  const exactMatch =
    findEntryByField(entries, (entry) => normalizeId(entry.encounterKey), encounterKey) ??
    findEntryByField(entries, (entry) => normalizeId(entry.scheduleKey), scheduleKey) ??
    findEntryByField(entries, (entry) => normalizeId(entry.appointmentId), appointmentId);
  if (exactMatch) return exactMatch;
  if (!patientId) return undefined;

  const patientMatches = entries.filter((entry) => normalizeId(entry.patientId) === patientId);
  return patientMatches.length === 1 ? patientMatches[0] : undefined;
};

export const resolveOrcaQueueEntryForEncounter = (
  entries: OrcaQueueEntry[],
  encounterContext?: OutpatientEncounterContext | null,
): OrcaQueueEntry | undefined => {
  const patientId = normalizeId(encounterContext?.patientId);
  if (!patientId) return undefined;

  const patientMatches = entries.filter((entry) => normalizeId(entry.patientId) === patientId);
  return patientMatches.length === 1 ? patientMatches[0] : undefined;
};

export const resolveChartsAppointmentQueryDate = (
  encounterContext: OutpatientEncounterContext | null | undefined,
  fallbackDate: string,
): string => {
  const visitDate = normalizeId(encounterContext?.visitDate);
  return visitDate ?? fallbackDate;
};

const hasOfficialVisitIdentifiers = (entry: ReceptionEntry): boolean =>
  Boolean(
    normalizeId(entry.insuranceCombinationNumber) &&
      normalizeId(entry.voucherNumber) &&
      normalizeId(entry.sequentialNumber),
  );

export const resolveReceptionEntryForEncounter = (
  entries: ReceptionEntry[],
  encounterContext?: OutpatientEncounterContext | null,
): ReceptionEntry | undefined => {
  const encounterKey = normalizeId(encounterContext?.encounterKey);
  const scheduleKey = normalizeId(encounterContext?.scheduleKey);
  const receptionId = normalizeId(encounterContext?.receptionId);
  const appointmentId = normalizeId(encounterContext?.appointmentId);
  const patientId = normalizeId(encounterContext?.patientId);
  const visitDate = normalizeId(encounterContext?.visitDate);

  const exactMatch =
    findEntryByField(entries, (entry) => normalizeId(entry.encounterKey), encounterKey) ??
    findEntryByField(entries, (entry) => normalizeId(entry.scheduleKey), scheduleKey) ??
    findEntryByField(entries, (entry) => normalizeId(entry.receptionId), receptionId) ??
    findEntryByField(entries, (entry) => normalizeId(entry.appointmentId), appointmentId);
  if (exactMatch && hasOfficialVisitIdentifiers(exactMatch)) return exactMatch;

  const officialVisitMatches =
    patientId && visitDate
      ? entries.filter(
          (entry) =>
            entry.source === 'visits' &&
            entry.status !== '予約' &&
            normalizeId(entry.patientId) === patientId &&
            normalizeId(entry.visitDate) === visitDate &&
            hasOfficialVisitIdentifiers(entry),
        )
      : [];
  if (officialVisitMatches.length === 1) return officialVisitMatches[0];
  return exactMatch;
};
