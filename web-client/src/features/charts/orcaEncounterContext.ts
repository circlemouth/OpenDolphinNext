import type { ReceptionEntry } from '../outpatient/types';

export type OrcaEncounterContext = {
  patientId: string;
  visitDate: string;
  departmentCode: string;
  physicianCode: string;
  insuranceCombinationNumber: string;
  voucherNumber: string;
  sequentialNumber: string;
};

export type OrcaEncounterContextField = keyof OrcaEncounterContext;

const FIELD_LABELS: Record<OrcaEncounterContextField, string> = {
  patientId: 'Patient_ID',
  visitDate: 'Perform_Date',
  departmentCode: 'Department_Code',
  physicianCode: 'Physician_Code',
  insuranceCombinationNumber: 'Insurance_Combination_Number',
  voucherNumber: 'Voucher_Number',
  sequentialNumber: 'Sequential_Number',
};

const normalizeText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeVisitDate = (value?: string | null): string | undefined => {
  const trimmed = normalizeText(value);
  if (!trimmed) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
};

export const buildOrcaEncounterContext = (
  entry?: Pick<
    ReceptionEntry,
    | 'patientId'
    | 'visitDate'
    | 'departmentCode'
    | 'physicianCode'
    | 'insuranceCombinationNumber'
    | 'voucherNumber'
    | 'sequentialNumber'
  > | null,
): Partial<OrcaEncounterContext> => ({
  patientId: normalizeText(entry?.patientId),
  visitDate: normalizeVisitDate(entry?.visitDate),
  departmentCode: normalizeText(entry?.departmentCode),
  physicianCode: normalizeText(entry?.physicianCode),
  insuranceCombinationNumber: normalizeText(entry?.insuranceCombinationNumber),
  voucherNumber: normalizeText(entry?.voucherNumber),
  sequentialNumber: normalizeText(entry?.sequentialNumber),
});

export const resolveMissingOrcaEncounterContextFields = (
  context?: Partial<OrcaEncounterContext> | null,
): OrcaEncounterContextField[] => {
  const normalized = buildOrcaEncounterContext(context as ReceptionEntry | undefined);
  return (Object.keys(FIELD_LABELS) as OrcaEncounterContextField[]).filter((field) => !normalized[field]);
};

export const hasCompleteOrcaEncounterContext = (
  context?: Partial<OrcaEncounterContext> | null,
): context is OrcaEncounterContext => resolveMissingOrcaEncounterContextFields(context).length === 0;

export const formatMissingOrcaEncounterContextLabels = (
  fields: OrcaEncounterContextField[],
): string[] => fields.map((field) => FIELD_LABELS[field]);

export const ORCA_ENCOUNTER_CONTEXT_LABELS = FIELD_LABELS;
