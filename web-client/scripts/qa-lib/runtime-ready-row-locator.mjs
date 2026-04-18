export const ROW_MATCH_PRIORITIES = [
  'encounterKey',
  'scheduleKey',
  'receptionId',
  'appointmentId',
  'patientIdentity',
  'visibleText',
];

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeText = (value) => normalize(value).replace(/\s+/g, ' ');

export const cssString = (value) => JSON.stringify(String(value));

export const normalizeSmokeEntry = (entry = {}) => ({
  encounterKey: normalize(entry.encounterKey),
  scheduleKey: normalize(entry.scheduleKey),
  receptionId: normalize(entry.receptionId),
  appointmentId: normalize(entry.appointmentId),
  patientId: normalize(entry.patientId),
  name: normalizeText(entry.name),
  status: normalize(entry.status),
  source: normalize(entry.source),
  appointmentTime: normalize(entry.appointmentTime ?? entry.acceptanceTime ?? entry.reservationTime),
});

export const summarizeSmokeEntry = (entry = {}) => {
  const normalized = normalizeSmokeEntry(entry);
  return {
    receptionId: normalized.receptionId || undefined,
    encounterKey: normalized.encounterKey || undefined,
    scheduleKey: normalized.scheduleKey || undefined,
    appointmentId: normalized.appointmentId || undefined,
    patientId: normalized.patientId || undefined,
    name: normalized.name || undefined,
    status: normalized.status || undefined,
    source: normalized.source || undefined,
    appointmentTime: normalized.appointmentTime || undefined,
  };
};

const rowValue = (row, key) => normalize(row?.[key]);

const rowText = (row) => normalizeText(row?.text);

export const findMatchingVisibleRow = (entry, visibleRows = []) => {
  const smoke = normalizeSmokeEntry(entry);
  const rows = Array.isArray(visibleRows) ? visibleRows : [];
  const exactChecks = [
    ['encounterKey', smoke.encounterKey],
    ['scheduleKey', smoke.scheduleKey],
    ['receptionId', smoke.receptionId],
    ['appointmentId', smoke.appointmentId],
  ];

  for (const [key, expected] of exactChecks) {
    if (!expected) continue;
    const row = rows.find((candidate) => rowValue(candidate, key) === expected);
    if (row) return { matched: true, strategy: key, row };
  }

  if (smoke.patientId && smoke.name) {
    const row = rows.find((candidate) => rowValue(candidate, 'patientId') === smoke.patientId && rowText(candidate).includes(smoke.name));
    if (row) return { matched: true, strategy: 'patientIdentity', row };
  }

  const textCandidates = [
    smoke.encounterKey,
    smoke.scheduleKey,
    smoke.receptionId,
    smoke.appointmentId,
    smoke.patientId && smoke.name ? `${smoke.patientId} ${smoke.name}` : '',
  ].filter(Boolean);
  for (const expected of textCandidates) {
    const row = rows.find((candidate) => rowText(candidate).includes(expected));
    if (row) return { matched: true, strategy: 'visibleText', row };
  }

  return { matched: false, strategy: 'none', row: null };
};

export const buildRowFailureClassification = ({
  appointmentEvidence,
  selectedSmokeEntry,
  visibleRowsSummary,
  activeStatusTab,
  selectedDate,
}) => {
  const rows = Array.isArray(visibleRowsSummary) ? visibleRowsSummary : [];
  const smoke = normalizeSmokeEntry(selectedSmokeEntry);
  const activeTab = normalize(activeStatusTab);
  const queryDate = normalize(appointmentEvidence?.queryDate);
  const uiDate = normalize(selectedDate);
  const match = findMatchingVisibleRow(smoke, rows);

  if (queryDate && uiDate && queryDate !== uiDate) {
    return {
      code: 'selected-date-mismatch',
      detail: `queryDate=${queryDate} selectedDate=${uiDate}`,
      rowMatch: match,
    };
  }
  if (smoke.status && activeTab && smoke.status !== activeTab) {
    return {
      code: 'active-status-tab-mismatch',
      detail: `smokeEntry.status=${smoke.status} activeStatusTab=${activeTab}`,
      rowMatch: match,
    };
  }
  if (rows.length === 0) {
    return {
      code: 'row-absent-in-active-tab',
      detail: `activeStatusTab=${activeTab || 'unknown'} has no visible rows`,
      rowMatch: match,
    };
  }
  if (match.matched) {
    return {
      code: 'selector-mismatch',
      detail: `visible row matched by ${match.strategy} but Playwright locator did not resolve`,
      rowMatch: match,
    };
  }
  if (smoke.patientId && rows.some((row) => rowValue(row, 'patientId') === smoke.patientId)) {
    return {
      code: 'row-metadata-missing-or-name-mismatch',
      detail: `patientId=${smoke.patientId} is visible but canonical keys/name did not match`,
      rowMatch: match,
    };
  }
  if (appointmentEvidence?.selectionReason && appointmentEvidence.selectionReason !== 'preferred_keys') {
    return {
      code: 'smoke-seed-key-mismatch',
      detail: `selectionReason=${appointmentEvidence.selectionReason}; preferred smoke keys were not returned`,
      rowMatch: match,
    };
  }
  return {
    code: 'row-absent-or-read-model-mismatch',
    detail: 'selected smoke entry was not visible in the active reception list',
    rowMatch: match,
  };
};
