import type { ClaimQueueEntry } from '../outpatient/types';
import type { OrcaQueueEntry } from '../outpatient/orcaQueueApi';
import type { OutpatientEncounterContext } from './encounterContext';

const normalizeId = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const findClaimQueueEntryByField = (
  entries: ClaimQueueEntry[],
  selector: (entry: ClaimQueueEntry) => string | undefined,
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
    findClaimQueueEntryByField(entries, (entry) => normalizeId(entry.encounterKey), encounterKey) ??
    findClaimQueueEntryByField(entries, (entry) => normalizeId(entry.scheduleKey), scheduleKey) ??
    findClaimQueueEntryByField(entries, (entry) => normalizeId(entry.appointmentId), appointmentId);
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
