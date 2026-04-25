import {
  hasHandoffEncounterKey,
  normalizeEncounterContext,
  normalizeVisitDate,
  type OutpatientEncounterContext,
} from '../charts/encounterContext';
import type { ReceptionEntry } from '../outpatient/types';
import type { VisitMutationParams, VisitMutationPayload } from './api';

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeEntryEncounter = (
  entry?: Pick<
    ReceptionEntry,
    'patientId' | 'appointmentId' | 'receptionId' | 'scheduleKey' | 'encounterKey' | 'visitDate'
  > | null,
) =>
  normalizeEncounterContext({
    patientId: entry?.patientId,
    appointmentId: entry?.appointmentId,
    receptionId: entry?.receptionId,
    scheduleKey: entry?.scheduleKey,
    encounterKey: entry?.encounterKey,
    visitDate: entry?.visitDate,
  });

const normalizePayloadEncounter = (payload: VisitMutationPayload, params: VisitMutationParams) =>
  normalizeEncounterContext({
    patientId: payload.patient?.patientId ?? params.patientId,
    appointmentId: payload.visitNumber ?? payload.appointmentDate,
    receptionId: payload.acceptanceId,
    scheduleKey: payload.scheduleKey,
    encounterKey: payload.encounterKey,
    visitDate: payload.acceptanceDate ?? params.acceptanceDate,
  });

export type PendingReceptionHandoff = {
  patientId: string;
  receptionId?: string;
  appointmentId?: string;
  visitDate?: string;
  departmentCode?: string;
  physicianCode?: string;
};

export type ResolvedReceptionHandoff = {
  source: 'mutation' | 'refreshed-entry';
  encounter: OutpatientEncounterContext;
};

export type PatientChartsHandoffCandidate =
  | {
      kind: 'ready';
      encounter: OutpatientEncounterContext;
      source: 'accepted' | 'patient-entry';
    }
  | {
      kind: 'blocked';
      reason: 'no_active_entry' | 'missing_handoff_key' | 'ambiguous_active_entries';
    };

export const buildReceptionEncounterFromEntry = normalizeEntryEncounter;

export const resolveAcceptMutationHandoff = (
  payload: VisitMutationPayload,
  params: VisitMutationParams,
): ResolvedReceptionHandoff | null => {
  const encounter = normalizePayloadEncounter(payload, params);
  if (!hasHandoffEncounterKey(encounter)) {
    return null;
  }
  return {
    source: 'mutation',
    encounter,
  };
};

export const buildPendingAcceptHandoff = (
  payload: VisitMutationPayload,
  params: VisitMutationParams,
): PendingReceptionHandoff | null => {
  const patientId = normalizeOptionalString(payload.patient?.patientId ?? params.patientId);
  if (!patientId) {
    return null;
  }
  return {
    patientId,
    receptionId: normalizeOptionalString(payload.acceptanceId),
    appointmentId: normalizeOptionalString(payload.visitNumber ?? payload.appointmentDate),
    visitDate: normalizeVisitDate(payload.acceptanceDate ?? params.acceptanceDate),
    departmentCode: normalizeOptionalString(payload.departmentCode ?? params.departmentCode),
    physicianCode: normalizeOptionalString(payload.physicianCode ?? params.physicianCode),
  };
};

const entryMatchesPendingHandoff = (entry: ReceptionEntry, pending: PendingReceptionHandoff) => {
  const patientId = normalizeOptionalString(entry.patientId);
  if (!patientId || patientId !== pending.patientId) {
    return false;
  }
  if (pending.receptionId) {
    return normalizeOptionalString(entry.receptionId) === pending.receptionId;
  }
  if (pending.appointmentId) {
    if (normalizeOptionalString(entry.appointmentId) !== pending.appointmentId) {
      return false;
    }
  } else {
    if (!pending.visitDate || !pending.departmentCode || !pending.physicianCode) {
      return false;
    }
  }
  if (pending.visitDate) {
    const entryVisitDate = normalizeVisitDate(entry.visitDate);
    if (!entryVisitDate || entryVisitDate !== pending.visitDate) {
      return false;
    }
  }
  if (pending.departmentCode) {
    const entryDepartmentCode = normalizeOptionalString(entry.departmentCode);
    if (!entryDepartmentCode || entryDepartmentCode !== pending.departmentCode) {
      return false;
    }
  }
  if (pending.physicianCode) {
    const entryPhysicianCode = normalizeOptionalString(entry.physicianCode);
    if (!entryPhysicianCode || entryPhysicianCode !== pending.physicianCode) {
      return false;
    }
  }
  return true;
};

export const resolvePendingAcceptHandoffFromEntries = (
  entries: ReceptionEntry[],
  pending: PendingReceptionHandoff | null | undefined,
): ResolvedReceptionHandoff | null => {
  if (!pending) {
    return null;
  }
  const matches = entries
    .filter((entry) => entryMatchesPendingHandoff(entry, pending))
    .map((entry) => normalizeEntryEncounter(entry))
    .filter((encounter) => hasHandoffEncounterKey(encounter));
  if (matches.length !== 1) {
    return null;
  }
  return {
    source: 'refreshed-entry',
    encounter: matches[0],
  };
};

export const resolvePatientChartsHandoff = (params: {
  patientId?: string;
  acceptedHandoff?: ResolvedReceptionHandoff | null;
  entries: ReceptionEntry[];
}): PatientChartsHandoffCandidate => {
  const patientId = normalizeOptionalString(params.patientId);
  if (!patientId) {
    return {
      kind: 'blocked',
      reason: 'no_active_entry',
    };
  }

  if (params.acceptedHandoff?.encounter.patientId === patientId && hasHandoffEncounterKey(params.acceptedHandoff.encounter)) {
    return {
      kind: 'ready',
      source: 'accepted',
      encounter: params.acceptedHandoff.encounter,
    };
  }

  const activeEntries = params.entries.filter(
    (entry) => normalizeOptionalString(entry.patientId) === patientId && entry.status !== '予約',
  );
  const keyedEntries = activeEntries
    .map((entry) => normalizeEntryEncounter(entry))
    .filter((encounter) => hasHandoffEncounterKey(encounter));

  if (keyedEntries.length === 1) {
    return {
      kind: 'ready',
      source: 'patient-entry',
      encounter: keyedEntries[0],
    };
  }
  if (keyedEntries.length > 1) {
    return {
      kind: 'blocked',
      reason: 'ambiguous_active_entries',
    };
  }
  return {
    kind: 'blocked',
    reason: activeEntries.length > 0 ? 'missing_handoff_key' : 'no_active_entry',
  };
};
