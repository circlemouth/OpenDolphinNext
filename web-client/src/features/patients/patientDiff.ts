import type { PatientRecord } from './api';

const BASIC_KEYS = ['name', 'kana', 'birthDate', 'sex', 'phone', 'zip', 'address'] as const satisfies readonly (keyof PatientRecord)[];

type PatientDiffKey = (typeof BASIC_KEYS)[number] | 'patientId';

export const PATIENT_FIELD_LABEL = {
  patientId: '患者ID',
  name: '氏名',
  kana: 'カナ',
  birthDate: '生年月日',
  sex: '性別',
  phone: '電話',
  zip: '郵便番号',
  address: '住所',
} satisfies Record<PatientDiffKey, string>;

const normalize = (value: unknown) => (value === undefined || value === null ? '' : String(value)).trim();

export function diffPatientKeys(params: {
  baseline: PatientRecord | null;
  draft: PatientRecord;
}): (typeof BASIC_KEYS)[number][] {
  const { baseline, draft } = params;
  if (!baseline) {
    return BASIC_KEYS.filter((key) => normalize(draft[key]) !== '');
  }
  return BASIC_KEYS.filter((key) => normalize(baseline[key]) !== normalize(draft[key]));
}

export function pickPatientSection(params: {
  baseline?: PatientRecord | null;
  fallback?: PatientRecord | null;
}): PatientRecord {
  const { baseline, fallback } = params;
  const source = baseline ?? fallback ?? {};
  return {
    patientId: source.patientId,
    name: source.name,
    kana: source.kana,
    birthDate: source.birthDate,
    sex: source.sex,
    phone: source.phone,
    zip: source.zip,
    address: source.address,
  };
}
