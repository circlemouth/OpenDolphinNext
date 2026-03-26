export type MedicalSectionOutcome = 'SUCCESS' | 'PARTIAL' | 'MISSING' | 'ERROR' | 'UNKNOWN';

export type MedicalSectionKey = 'diagnosis' | 'prescription' | 'lab' | 'procedure' | 'memo';

export type MedicalSectionItem = {
  headline: string;
  subline?: string;
  meta?: string;
};

export type MedicalSectionState = {
  key: MedicalSectionKey;
  label: string;
  outcome: MedicalSectionOutcome;
  recordsReturned?: number;
  message?: string;
  items: MedicalSectionItem[];
  raw?: unknown;
};

export type MedicalOutpatientRecord = {
  encounterKey?: string;
  scheduleKey?: string;
  patientId?: string;
  patientName?: string;
  department?: string;
  physician?: string;
  appointmentId?: string;
  voucherNumber?: string;
  outcome: MedicalSectionOutcome;
  recordsReturned?: number;
  sections: MedicalSectionState[];
  raw?: unknown;
};

const normalizeOutcome = (value: unknown): MedicalSectionOutcome => {
  if (typeof value !== 'string') return 'UNKNOWN';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'success' || normalized === 'ok' || normalized === '00') return 'SUCCESS';
  if (normalized === 'partial' || normalized === 'partial_success' || normalized === 'partial-success') return 'PARTIAL';
  if (normalized === 'missing' || normalized === 'not_found' || normalized === 'notfound') return 'MISSING';
  if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') return 'ERROR';
  return 'UNKNOWN';
};

const extractString = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

const extractNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const asArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const formatFallback = (item: unknown): MedicalSectionItem | undefined => {
  const record = asRecord(item);
  if (!record) {
    const text = extractString(item);
    return text ? { headline: text } : undefined;
  }
  const headline =
    extractString(record.headline) ??
    extractString(record.name) ??
    extractString(record.title) ??
    extractString(record.text) ??
    extractString(record.code) ??
    undefined;
  if (!headline) return undefined;
  const subline = extractString(record.subline) ?? extractString(record.detail) ?? extractString(record.description);
  const meta = extractString(record.meta) ?? extractString(record.date) ?? extractString(record.status);
  return { headline, subline, meta };
};

const formatItemForSection = (key: MedicalSectionKey, item: unknown): MedicalSectionItem | undefined => {
  const record = asRecord(item);
  if (!record) return formatFallback(item);

  if (key === 'diagnosis') {
    const name = extractString(record.name ?? record.title ?? record.headline);
    if (!name) return formatFallback(item);
    const code = extractString(record.code);
    const status = extractString(record.status);
    const date = extractString(record.date ?? record.onsetDate);
    return {
      headline: code ? `${name}（${code}）` : name,
      subline: status,
      meta: date,
    };
  }

  if (key === 'prescription') {
    const name = extractString(record.name ?? record.title ?? record.headline);
    if (!name) return formatFallback(item);
    const dose = extractString(record.dose ?? record.amount);
    const frequency = extractString(record.frequency ?? record.sig);
    const days = extractString(record.days) ?? (typeof record.days === 'number' ? `${record.days}日` : undefined);
    const date = extractString(record.date);
    const subline = [dose, frequency, days].filter(Boolean).join(' / ') || undefined;
    return { headline: name, subline, meta: date };
  }

  if (key === 'lab') {
    const name = extractString(record.name ?? record.title ?? record.headline);
    if (!name) return formatFallback(item);
    const value = extractString(record.value ?? record.result);
    const unit = extractString(record.unit);
    const date = extractString(record.date);
    const subline = value ? `${value}${unit ? ` ${unit}` : ''}` : undefined;
    return { headline: name, subline, meta: date };
  }

  if (key === 'procedure') {
    const name = extractString(record.name ?? record.title ?? record.headline);
    if (!name) return formatFallback(item);
    const result = extractString(record.result ?? record.value ?? record.note);
    const date = extractString(record.date);
    return { headline: name, subline: result, meta: date };
  }

  if (key === 'memo') {
    const text = extractString(record.text ?? record.note ?? record.message ?? record.headline);
    if (!text) return formatFallback(item);
    const date = extractString(record.date);
    return { headline: text, meta: date };
  }

  return formatFallback(item);
};

const buildSection = ({
  key,
  label,
  source,
  defaultOutcome,
}: {
  key: MedicalSectionKey;
  label: string;
  source: unknown;
  defaultOutcome: MedicalSectionOutcome;
}): MedicalSectionState => {
  const sectionRecord = asRecord(source);
  const candidates = sectionRecord ? asArray(sectionRecord.items ?? sectionRecord.list ?? sectionRecord.records) : asArray(source);
  const items = candidates.map((entry) => formatItemForSection(key, entry)).filter(Boolean) as MedicalSectionItem[];
  const recordsReturned = extractNumber(sectionRecord?.recordsReturned) ?? (items.length > 0 ? items.length : undefined);
  const message = extractString(sectionRecord?.message ?? sectionRecord?.errorMessage ?? sectionRecord?.error);
  const outcome = sectionRecord?.outcome !== undefined ? normalizeOutcome(sectionRecord.outcome) : defaultOutcome;

  return {
    key,
    label,
    outcome: outcome === 'UNKNOWN' && defaultOutcome !== 'UNKNOWN' ? defaultOutcome : outcome,
    recordsReturned,
    message,
    items,
    raw: source,
  };
};

const deriveOverallOutcome = (sections: MedicalSectionState[], fallback: MedicalSectionOutcome): MedicalSectionOutcome => {
  const outcomes = sections.map((s) => s.outcome);
  if (outcomes.includes('ERROR')) return outcomes.some((o) => o === 'SUCCESS' || o === 'PARTIAL') ? 'PARTIAL' : 'ERROR';
  if (outcomes.includes('MISSING')) return outcomes.some((o) => o === 'SUCCESS' || o === 'PARTIAL') ? 'PARTIAL' : 'MISSING';
  if (outcomes.every((o) => o === 'SUCCESS')) return 'SUCCESS';
  if (outcomes.some((o) => o === 'PARTIAL')) return 'PARTIAL';
  return fallback;
};

const getDefaultSectionOutcome = (source: unknown): MedicalSectionOutcome => {
  if (source === undefined || source === null) return 'MISSING';
  if (Array.isArray(source) && source.length === 0) return 'MISSING';
  const record = asRecord(source);
  if (record && record.error) return 'ERROR';
  if (record && record.message && /error|fail|timeout/i.test(String(record.message))) return 'ERROR';
  return 'SUCCESS';
};

export function extractMedicalOutpatientRecord(
  payload: unknown,
  selectedPatientId?: string,
): MedicalOutpatientRecord | undefined {
  const root = asRecord(payload);
  if (!root) return undefined;

  const list = asArray(root.outpatientList ?? root.records ?? root.list);
  if (list.length === 0) return undefined;

  const pick = (candidate: unknown) => {
    const record = asRecord(candidate);
    const patient = asRecord(record?.patient);
    const patientId = extractString(patient?.patientId ?? record?.patientId);
    if (!selectedPatientId) return true;
    return patientId === selectedPatientId;
  };
  const selected = list.find(pick) ?? list[0];
  const record = asRecord(selected) ?? {};
  const patient = asRecord(record.patient) ?? {};

  const sectionsSource = asRecord(record.sections ?? root.sections) ?? {};

  const diagnosisSource =
    sectionsSource.diagnosis ??
    sectionsSource.diagnoses ??
    record.diagnosis ??
    record.diagnoses ??
    record.disease ??
    record.diseases ??
    undefined;
  const prescriptionSource =
    sectionsSource.prescription ??
    sectionsSource.prescriptions ??
    record.prescription ??
    record.prescriptions ??
    record.medication ??
    record.medications ??
    undefined;
  const labSource =
    sectionsSource.lab ??
    sectionsSource.labs ??
    sectionsSource.test ??
    sectionsSource.tests ??
    record.lab ??
    record.labs ??
    record.test ??
    record.tests ??
    undefined;
  const procedureSource =
    sectionsSource.procedure ??
    sectionsSource.procedures ??
    record.procedure ??
    record.procedures ??
    record.treatment ??
    record.treatments ??
    undefined;
  const memoSource = sectionsSource.memo ?? sectionsSource.memos ?? record.memo ?? record.memos ?? record.note ?? record.notes ?? undefined;

  const sections: MedicalSectionState[] = [
    buildSection({
      key: 'diagnosis',
      label: '診断',
      source: diagnosisSource,
      defaultOutcome: getDefaultSectionOutcome(diagnosisSource),
    }),
    buildSection({
      key: 'prescription',
      label: '処方',
      source: prescriptionSource,
      defaultOutcome: getDefaultSectionOutcome(prescriptionSource),
    }),
    buildSection({
      key: 'lab',
      label: '検査',
      source: labSource,
      defaultOutcome: getDefaultSectionOutcome(labSource),
    }),
    buildSection({
      key: 'procedure',
      label: '処置',
      source: procedureSource,
      defaultOutcome: getDefaultSectionOutcome(procedureSource),
    }),
    buildSection({
      key: 'memo',
      label: 'メモ',
      source: memoSource,
      defaultOutcome: getDefaultSectionOutcome(memoSource),
    }),
  ];

  const topOutcome = normalizeOutcome(root.outcome);
  const recordOutcome = normalizeOutcome(record.outcome);
  const fallbackOutcome = recordOutcome !== 'UNKNOWN' ? recordOutcome : topOutcome !== 'UNKNOWN' ? topOutcome : 'UNKNOWN';
  const derivedOutcome = deriveOverallOutcome(sections, fallbackOutcome);

  return {
    encounterKey: extractString(record.encounterKey ?? root.encounterKey),
    scheduleKey: extractString(record.scheduleKey ?? root.scheduleKey),
    patientId: extractString(patient.patientId ?? record.patientId),
    patientName: extractString(patient.wholeName ?? record.patientName),
    department: extractString(record.department ?? record.departmentName),
    physician: extractString(record.physician ?? record.physicianName),
    appointmentId: extractString(record.appointmentId),
    voucherNumber: extractString(record.voucherNumber ?? record.voucherNo),
    outcome: derivedOutcome,
    recordsReturned: extractNumber(record.recordsReturned) ?? extractNumber(root.recordsReturned),
    sections,
    raw: selected,
  };
}

export function toOutcomeLabel(outcome: MedicalSectionOutcome): string {
  switch (outcome) {
    case 'SUCCESS':
      return '成功';
    case 'PARTIAL':
      return '一部欠落';
    case 'MISSING':
      return '未取得';
    case 'ERROR':
      return 'エラー';
    case 'UNKNOWN':
    default:
      return '不明';
  }
}

export function toOutcomeTone(outcome: MedicalSectionOutcome): 'success' | 'warning' | 'error' | 'info' {
  switch (outcome) {
    case 'SUCCESS':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'MISSING':
      return 'warning';
    case 'ERROR':
      return 'error';
    case 'UNKNOWN':
    default:
      return 'info';
  }
}
