import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PHASE4_WRAPPER_CONTRACT = 'phase4-safe-medicalmodv2-sanitized-only';
export const PHASE4_ENDPOINT_PATH = '/api/orca/official/chart-support/medical-mod-v2';
export const PHASE4_REQUEST_CLASS = 'medicalmodv2';
export const PHASE4_TARGET_PATIENT_ID = '00001';
export const PHASE4_TARGET_CANDIDATE_ID = '00001';
export const PHASE4_TRIAL_DEPARTMENT_CODE = '01';
export const PHASE4_TRIAL_PHYSICIAN_CODE = '10001';
export const PHASE4_ALLOWED_REQUEST_NUMBER = '01';
export const PHASE4_ALLOWED_CLASS_CODE = '01';
export const PHASE4_FORBIDDEN_REQUEST_NUMBERS = ['02', '03', '04'];
export const PHASE4_ENDPOINT_WORKFLOWS = {
  prescription: {
    checkpointNamespace: 'rwo06d',
    workflowId: 'rwo06d-prescription-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['medOrder'],
    allowedMedicalClasses: ['212'],
  },
  'treatment-generic': {
    checkpointNamespace: 'rwo06d',
    workflowId: 'rwo06d-treatment-generic-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['treatmentOrder'],
    allowedMedicalClasses: ['400'],
  },
  'instruction-charge': {
    checkpointNamespace: 'rwo06f',
    workflowId: 'rwo06f-instruction-charge-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['instractionChargeOrder'],
    allowedMedicalClasses: ['130'],
  },
  'base-charge': {
    checkpointNamespace: 'rwo06g',
    workflowId: 'rwo06g-base-charge-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['baseChargeOrder'],
    allowedMedicalClasses: ['110'],
  },
  injection: {
    checkpointNamespace: 'rwo06h',
    workflowId: 'rwo06h-injection-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['injectionOrder'],
    allowedMedicalClasses: ['310'],
  },
  surgery: {
    checkpointNamespace: 'rwo06i',
    workflowId: 'rwo06i-surgery-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['surgeryOrder'],
    allowedMedicalClasses: ['500'],
  },
  'test-order': {
    checkpointNamespace: 'rwo06j',
    workflowId: 'rwo06j-test-order-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['testOrder'],
    allowedMedicalClasses: ['600'],
  },
  radiology: {
    checkpointNamespace: 'rwo06k',
    workflowId: 'rwo06k-radiology-medicalmodv2-v1',
    endpointEvidenceLevel: 'L3',
    requiredEntityKinds: ['radiologyOrder'],
    allowedMedicalClasses: ['700'],
  },
};

const FORBIDDEN_FLAGS = new Set([
  '--phase3',
  '--run-phase3',
  '--acceptmodv2',
  '--fullflow',
  '--run-fullflow',
  '--record-har',
  '--har',
  '--trace',
  '--video',
  '--screenshot',
  '--screenshots',
  '--raw-network',
  '--network-dump',
  '--dump-request',
  '--dump-response',
  '--request-xml',
  '--browser-artifacts',
]);

const FORBIDDEN_ENV = [
  ['QA_RECORD_HAR', '1', 'HAR recording is forbidden'],
  ['QA_TRACE', '1', 'trace recording is forbidden'],
  ['QA_VIDEO', '1', 'video recording is forbidden'],
  ['QA_SCREENSHOT', '1', 'screenshot recording is forbidden'],
  ['QA_SCREENSHOTS', '1', 'screenshot recording is forbidden'],
  ['QA_RAW_NETWORK', '1', 'raw network capture is forbidden'],
  ['QA_CAPTURE_NETWORK_RAW', '1', 'raw network capture is forbidden'],
  ['QA_PHASE3_APPROVED_MODE', '1', 'Phase 3 mode is forbidden'],
  ['QA_FULLFLOW', '1', 'fullflow is forbidden'],
  ['QA_ALLOW_LOCAL_OPTION_INJECTION', '1', 'local option injection is forbidden'],
];

const VALUE_FLAGS = new Set(['--payload', '--payload-sha256', '--artifact-dir', '--workflow']);
const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--mock',
  '--execute-approved-phase4',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
  '--phase4-only',
]);

const SENSITIVE_MESSAGE_PATTERN =
  /患者|保険|番号|氏名|住所|電話|記号|cookie|authorization|password|passwd|token|session|csrf|jsessionid/i;
const ZERO_API_RESULT_PATTERN = /^0+$/;

export const repoRootFromCwd = (cwd = process.cwd()) =>
  path.basename(cwd) === 'web-client' ? path.dirname(cwd) : cwd;

export const sha256Buffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export const sha256File = (filePath) => sha256Buffer(fs.readFileSync(filePath));

export const parsePhase4SafeArgs = (argv) => {
  const options = {
    dryRun: false,
    mock: false,
    executeApprovedPhase4: false,
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
    phase4Only: false,
  };
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_FLAGS.has(arg)) {
      errors.push(`forbidden flag: ${arg}`);
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        errors.push(`missing value for ${arg}`);
        continue;
      }
      index += 1;
      if (arg === '--payload') options.payload = value;
      if (arg === '--payload-sha256') options.payloadSha256 = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      if (arg === '--workflow') options.workflow = value;
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--dry-run') options.dryRun = true;
      if (arg === '--mock') options.mock = true;
      if (arg === '--execute-approved-phase4') options.executeApprovedPhase4 = true;
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      if (arg === '--phase4-only') options.phase4Only = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }

  return { options, errors };
};

const normalizeCode = (value) => String(value ?? '').trim();

const normalizeRequestNumber = (payload) => normalizeCode(payload?.requestNumber || PHASE4_ALLOWED_REQUEST_NUMBER);

const normalizeClassCode = (payload) => {
  const raw = normalizeCode(payload?.classCode || PHASE4_ALLOWED_CLASS_CODE);
  if (raw.length === 1) return `0${raw}`;
  if (raw.toLowerCase().startsWith('class=')) return normalizeClassCode({ classCode: raw.slice('class='.length) });
  return raw;
};

const readPayloadBuffer = (payloadPath) => {
  if (!payloadPath) {
    return Buffer.from(JSON.stringify(buildSyntheticPayloadFixture()), 'utf8');
  }
  return fs.readFileSync(payloadPath);
};

export const buildSyntheticPayloadFixture = () => ({
  classCode: PHASE4_ALLOWED_CLASS_CODE,
  requestNumber: PHASE4_ALLOWED_REQUEST_NUMBER,
  encounterContext: {
    patientId: PHASE4_TARGET_PATIENT_ID,
    visitDate: '2026-04-22',
    departmentCode: PHASE4_TRIAL_DEPARTMENT_CODE,
    physicianCode: PHASE4_TRIAL_PHYSICIAN_CODE,
    insuranceCombinationNumber: 'SYNTHETIC',
    voucherNumber: 'SYNTHETIC',
    sequentialNumber: 'SYNTHETIC',
  },
  includeInitialConsultation: false,
  medicalInformation: [
    {
      entity: 'treatmentOrder',
      medicalClass: '700',
      medicalClassNumber: '1',
      medications: [
        {
          code: 'SYNTHETIC',
          number: '1',
        },
      ],
    },
  ],
});

const getWorkflowContract = (workflow) => PHASE4_ENDPOINT_WORKFLOWS[normalizeCode(workflow)] ?? null;

export const loadPhase4Payload = ({ payloadPath } = {}) => {
  const buffer = readPayloadBuffer(payloadPath);
  const sha256 = sha256Buffer(buffer);
  const payload = JSON.parse(buffer.toString('utf8'));
  return { payload, sha256, bytes: buffer.length };
};

export const summarizePayload = (payload) => {
  const encounter = payload?.encounterContext ?? {};
  const requestNumber = normalizeRequestNumber(payload);
  const classCode = normalizeClassCode(payload);
  const medicalInformation = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const medications = medicalInformation.flatMap((entry) => Array.isArray(entry?.medications) ? entry.medications : []);
  const entityKinds = [...new Set(medicalInformation.map((entry) => normalizeCode(entry?.entity)).filter(Boolean))].sort();
  const medicalClasses = [...new Set(medicalInformation.map((entry) => normalizeCode(entry?.medicalClass)).filter(Boolean))].sort();
  return {
    patientIdMatched: normalizeCode(encounter?.patientId || payload?.patientId) === PHASE4_TARGET_PATIENT_ID,
    candidateIdMatched: true,
    departmentCodeMatched:
      normalizeCode(encounter?.departmentCode || payload?.departmentCode) === PHASE4_TRIAL_DEPARTMENT_CODE,
    physicianCodeMatched:
      normalizeCode(encounter?.physicianCode || payload?.physicianCode) === PHASE4_TRIAL_PHYSICIAN_CODE,
    requestNumber,
    classCode,
    requiredFieldsPresent: {
      visitDate: Boolean(normalizeCode(encounter?.visitDate || payload?.performDate)),
      departmentCode: Boolean(normalizeCode(encounter?.departmentCode || payload?.departmentCode)),
      physicianCode: Boolean(normalizeCode(encounter?.physicianCode || payload?.physicianCode)),
      insuranceCombinationNumber: Boolean(normalizeCode(encounter?.insuranceCombinationNumber || payload?.insuranceCombinationNumber)),
      voucherNumber: Boolean(normalizeCode(encounter?.voucherNumber || payload?.voucherNumber)),
      sequentialNumber: Boolean(normalizeCode(encounter?.sequentialNumber || payload?.sequentialNumber)),
    },
    medicalInformation: {
      groupCount: medicalInformation.length,
      medicationCount: medications.length,
      entityKinds,
      medicalClasses,
      unsupportedPhysiologyOrderPresent: entityKinds.includes('physiologyOrder'),
    },
    rawPayloadStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

const codeLooksLike = (code, pattern) => pattern.test(normalizeCode(code));

export const summarizeInjectionOrderNoLiveContract = (payload) => {
  const summary = summarizePayload(payload);
  const groups = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const injectionGroups = groups.filter(
    (entry) => normalizeCode(entry?.entity) === 'injectionOrder' && normalizeCode(entry?.medicalClass) === '310',
  );
  const medications = injectionGroups.flatMap((entry) => (Array.isArray(entry?.medications) ? entry.medications : []));
  const roles = medications.map((row) => normalizeCode(row?.rowRole));
  const codeByRole = Object.fromEntries(
    medications
      .map((row) => [normalizeCode(row?.rowRole), normalizeCode(row?.code)])
      .filter(([role, code]) => role && code),
  );
  const blockers = [];

  if (summary.requestNumber !== PHASE4_ALLOWED_REQUEST_NUMBER) {
    blockers.push(`requestNumber must be ${PHASE4_ALLOWED_REQUEST_NUMBER}`);
  }
  if (summary.classCode !== PHASE4_ALLOWED_CLASS_CODE) {
    blockers.push(`classCode must be ${PHASE4_ALLOWED_CLASS_CODE}`);
  }
  if (injectionGroups.length !== 1) {
    blockers.push('exactly one injectionOrder class 310 group is required');
  }
  if (roles.join(',') !== 'procedure,main,material,comment') {
    blockers.push('injection rows must be ordered procedure, main, material, comment');
  }
  if (!codeLooksLike(codeByRole.procedure, /^130\d+$/)) {
    blockers.push('procedure row must use a class-310 injection procedure code shape');
  }
  if (!codeLooksLike(codeByRole.main, /^62\d+$/)) {
    blockers.push('main row must use a medication code shape');
  }
  if (!codeLooksLike(codeByRole.material, /^7\d+$/)) {
    blockers.push('material row must use a material code shape');
  }
  if (!codeLooksLike(codeByRole.comment, /^(00|8)\d+$/)) {
    blockers.push('comment row must use a comment code shape');
  }
  const numberedClinicalRows = medications.filter((row) => row?.rowRole !== 'comment');
  if (numberedClinicalRows.some((row) => !normalizeCode(row?.number))) {
    blockers.push('procedure, main, and material rows require medication numbers');
  }
  const commentRows = medications.filter((row) => row?.rowRole === 'comment');
  if (commentRows.some((row) => normalizeCode(row?.number))) {
    blockers.push('comment rows must not carry medication numbers');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    rowCount: medications.length,
    roles,
    codeShape: {
      procedureInjectionFee: codeLooksLike(codeByRole.procedure, /^130\d+$/),
      medication: codeLooksLike(codeByRole.main, /^62\d+$/),
      material: codeLooksLike(codeByRole.material, /^7\d+$/),
      comment: codeLooksLike(codeByRole.comment, /^(00|8)\d+$/),
    },
    requestSemantics: {
      requestNumber01Only: summary.requestNumber === PHASE4_ALLOWED_REQUEST_NUMBER,
      classCode01Only: summary.classCode === PHASE4_ALLOWED_CLASS_CODE,
      requestNumber02To04Forbidden: true,
    },
    rawPayloadStored: false,
    rawPatientOrInsuranceDetailStored: false,
    masterRuntimeLookupExecuted: false,
    liveTrialAction: 'not_run',
  };
};

export const summarizeBaseChargeRowOrderNoLiveContract = (payload) => {
  const summary = summarizePayload(payload);
  const groups = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const firstGroup = groups[0] ?? null;
  const baseChargeGroups = groups.filter(
    (entry) => normalizeCode(entry?.entity) === 'baseChargeOrder' && normalizeCode(entry?.medicalClass) === '110',
  );
  const rows = groups.flatMap((entry, groupIndex) =>
    (Array.isArray(entry?.medications) ? entry.medications : []).map((row, rowIndex) => ({
      groupIndex,
      rowIndex,
      entity: normalizeCode(entry?.entity),
      medicalClass: normalizeCode(entry?.medicalClass),
      code: normalizeCode(row?.code),
      number: normalizeCode(row?.number),
    })),
  );
  const baseChargeRows = rows.filter((row) => row.entity === 'baseChargeOrder' && row.medicalClass === '110');
  const consultationFeeRows = rows.filter((row) => row.code === '111000110');
  const blockers = [];

  if (summary.requestNumber !== PHASE4_ALLOWED_REQUEST_NUMBER) {
    blockers.push(`requestNumber must be ${PHASE4_ALLOWED_REQUEST_NUMBER}`);
  }
  if (summary.classCode !== PHASE4_ALLOWED_CLASS_CODE) {
    blockers.push(`classCode must be ${PHASE4_ALLOWED_CLASS_CODE}`);
  }
  if (baseChargeGroups.length !== 1) {
    blockers.push('exactly one baseChargeOrder class 110 group is required');
  }
  if (
    normalizeCode(firstGroup?.entity) !== 'baseChargeOrder' ||
    normalizeCode(firstGroup?.medicalClass) !== '110'
  ) {
    blockers.push('baseChargeOrder class 110 group must be the first medicalInformation set');
  }
  if (baseChargeRows.length !== 1 || baseChargeRows[0]?.code !== '111000110') {
    blockers.push('base-charge first row must be the consultation fee code 111000110');
  }
  if (baseChargeRows[0] && (baseChargeRows[0].groupIndex !== 0 || baseChargeRows[0].rowIndex !== 0)) {
    blockers.push('consultation fee row must be first row of first set');
  }
  if (consultationFeeRows.length !== 1) {
    blockers.push('consultation fee code 111000110 must appear exactly once');
  }
  if (baseChargeRows.some((row) => !row.number)) {
    blockers.push('base-charge row requires a medication number');
  }
  if (payload?.includeInitialConsultation === true) {
    blockers.push('includeInitialConsultation must not add a second consultation fee row');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    rowOrder: {
      firstSetEntity: normalizeCode(firstGroup?.entity) || null,
      firstSetMedicalClass: normalizeCode(firstGroup?.medicalClass) || null,
      firstRowCode: rows[0]?.code || null,
      consultationFeeFirstRowOfFirstSet:
        baseChargeRows[0]?.groupIndex === 0 && baseChargeRows[0]?.rowIndex === 0 && baseChargeRows[0]?.code === '111000110',
      consultationFeeOccurrences: consultationFeeRows.length,
    },
    requestSemantics: {
      requestNumber01Only: summary.requestNumber === PHASE4_ALLOWED_REQUEST_NUMBER,
      classCode01Only: summary.classCode === PHASE4_ALLOWED_CLASS_CODE,
      requestNumber02To04Forbidden: true,
    },
    stopBeforeLiveIfDuplicateOrNotFirstRow: true,
    runtimeMasterLookupExecuted: false,
    liveTrialAction: 'not_run',
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const summarizeInjectionMasterValidityNoLivePlan = (payload) => {
  const contract = summarizeInjectionOrderNoLiveContract(payload);
  const groups = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const injectionGroup = groups.find(
    (entry) => normalizeCode(entry?.entity) === 'injectionOrder' && normalizeCode(entry?.medicalClass) === '310',
  );
  const rows = Array.isArray(injectionGroup?.medications) ? injectionGroup.medications : [];
  const codeByRole = Object.fromEntries(
    rows
      .map((row) => [normalizeCode(row?.rowRole), normalizeCode(row?.code)])
      .filter(([role, code]) => role && code),
  );
  const blockers = [...contract.blockers];

  if (!codeByRole.procedure) blockers.push('procedure code must be present for master-validity preflight');
  if (!codeByRole.main) blockers.push('main medication code must be present for medicationgetv2 preflight');
  if (!codeByRole.material) blockers.push('material code must be present for master-validity preflight');
  if (!codeByRole.comment) blockers.push('comment code must be present for master-validity preflight');

  return {
    ok: blockers.length === 0,
    blockers,
    candidateCodes: {
      procedure: codeByRole.procedure || null,
      medication: codeByRole.main || null,
      material: codeByRole.material || null,
      comment: codeByRole.comment || null,
    },
    readOnlyChecksRequiredBeforeLive: [
      {
        role: 'medication',
        endpoint: 'medicationgetv2',
        code: codeByRole.main || null,
        expectedSanitizedEvidence: [
          'httpStatusClass',
          'apiResultClass',
          'masterFoundBoolean',
          'effectiveDateClass',
          'evidenceHash',
        ],
      },
      {
        role: 'procedure',
        endpoint: 'masterlastupdatev3',
        code: codeByRole.procedure || null,
        expectedSanitizedEvidence: [
          'httpStatusClass',
          'apiResultClass',
          'masterFoundBoolean',
          'lastUpdateDateClass',
          'evidenceHash',
        ],
      },
      {
        role: 'material',
        endpoint: 'masterlastupdatev3',
        code: codeByRole.material || null,
        expectedSanitizedEvidence: [
          'httpStatusClass',
          'apiResultClass',
          'masterFoundBoolean',
          'lastUpdateDateClass',
          'evidenceHash',
        ],
      },
      {
        role: 'comment',
        endpoint: 'masterlastupdatev3',
        code: codeByRole.comment || null,
        expectedSanitizedEvidence: [
          'httpStatusClass',
          'apiResultClass',
          'masterFoundBoolean',
          'lastUpdateDateClass',
          'evidenceHash',
        ],
      },
    ],
    stopBeforeLiveIfAnyMasterUnverified: true,
    runtimeMasterLookupExecuted: false,
    liveTrialAction: 'not_run',
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const summarizeInstructionChargePreconditionNoLivePlan = (payload) => {
  const summary = summarizePayload(payload);
  const groups = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const instructionGroups = groups.filter(
    (entry) => normalizeCode(entry?.entity) === 'instractionChargeOrder' && normalizeCode(entry?.medicalClass) === '130',
  );
  const medications = instructionGroups.flatMap((entry) => (Array.isArray(entry?.medications) ? entry.medications : []));
  const candidateCodes = medications.map((row) => normalizeCode(row?.code)).filter(Boolean);
  const blockers = [];

  if (summary.requestNumber !== PHASE4_ALLOWED_REQUEST_NUMBER) {
    blockers.push(`requestNumber must be ${PHASE4_ALLOWED_REQUEST_NUMBER}`);
  }
  if (summary.classCode !== PHASE4_ALLOWED_CLASS_CODE) {
    blockers.push(`classCode must be ${PHASE4_ALLOWED_CLASS_CODE}`);
  }
  if (instructionGroups.length !== 1) {
    blockers.push('exactly one instractionChargeOrder class 130 group is required');
  }
  if (candidateCodes.length !== 1 || !codeLooksLike(candidateCodes[0], /^113\d+$/)) {
    blockers.push('instruction-charge row must use a class-130 guidance/management fee code shape');
  }
  if (medications.some((row) => !normalizeCode(row?.number))) {
    blockers.push('instruction-charge row requires a medication number');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    candidateCodes,
    preconditionsRequiredBeforeLive: [
      {
        name: 'diseaseContext',
        requiredEvidence: [
          'sanitizedDiseasePresence',
          'specificManagementFeeDiseaseClassOrEquivalent',
          'noRawDiseaseNameOrPatientDetail',
        ],
      },
      {
        name: 'facilityContext',
        requiredEvidence: [
          'facilityTypeCompatibleWithCandidate',
          'sanitizedFacilityClassificationOnly',
        ],
      },
      {
        name: 'monthlyDuplicateContext',
        requiredEvidence: [
          'medicalgetv2MonthlyReadOnlyCheck',
          'sameMonthDuplicateStatus',
          'noRawMedicalRowsOrInsuranceDetail',
        ],
      },
      {
        name: 'departmentInsuranceContext',
        requiredEvidence: [
          'departmentCodeServerDerived',
          'insuranceCombinationReadiness',
          'noClientProvidedInsuranceAuthority',
        ],
      },
    ],
    stopBeforeLiveUntilAllPreconditionsProven: true,
    readOnlyChecksAllowedBeforeLive: [
      {
        endpoint: 'diseasegetv2_or_diseasev3_sanitized_summary',
        purpose: 'prove target has compatible disease context without raw disease or patient detail',
      },
      {
        endpoint: 'medicalgetv2',
        purpose: 'prove monthly duplicate/department/insurance context without raw medical or insurance rows',
      },
      {
        endpoint: 'system01dailyv2_or_system01lstv2',
        purpose: 'prove facility/system classification only when safe sanitized wrapper exists',
      },
    ],
    requestSemantics: {
      requestNumber01Only: summary.requestNumber === PHASE4_ALLOWED_REQUEST_NUMBER,
      classCode01Only: summary.classCode === PHASE4_ALLOWED_CLASS_CODE,
      requestNumber02To04Forbidden: true,
    },
    runtimeReadOnlyProbeExecuted: false,
    liveTrialAction: 'not_run',
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const validatePhase4Payload = ({ payload, payloadSha256, expectedPayloadSha256 = '' }) => {
  const summary = summarizePayload(payload);
  const blockers = [];
  if (!summary.patientIdMatched) blockers.push(`target patient must be ${PHASE4_TARGET_PATIENT_ID}`);
  if (!summary.departmentCodeMatched) {
    blockers.push(`departmentCode must be ${PHASE4_TRIAL_DEPARTMENT_CODE}`);
  }
  if (!summary.physicianCodeMatched) {
    blockers.push(`physicianCode must be ${PHASE4_TRIAL_PHYSICIAN_CODE}`);
  }
  if (summary.requestNumber !== PHASE4_ALLOWED_REQUEST_NUMBER) {
    blockers.push(`requestNumber must be ${PHASE4_ALLOWED_REQUEST_NUMBER}`);
  }
  if (PHASE4_FORBIDDEN_REQUEST_NUMBERS.includes(summary.requestNumber)) {
    blockers.push('Request_Number 02/03/04 is forbidden for this Phase 4 wrapper');
  }
  if (summary.classCode !== PHASE4_ALLOWED_CLASS_CODE) {
    blockers.push(`classCode must be ${PHASE4_ALLOWED_CLASS_CODE}`);
  }
  for (const [field, present] of Object.entries(summary.requiredFieldsPresent)) {
    if (!present) blockers.push(`encounterContext.${field} is required`);
  }
  if (summary.medicalInformation.unsupportedPhysiologyOrderPresent) {
    blockers.push('physiologyOrder is not supported by medicalmodv2 carrier');
  }
  if (summary.medicalInformation.groupCount === 0 || summary.medicalInformation.medicationCount === 0) {
    blockers.push('medicalInformation with at least one medication is required');
  }
  if (expectedPayloadSha256 && payloadSha256 !== expectedPayloadSha256) {
    blockers.push('payload sha256 mismatch');
  }
  return {
    ok: blockers.length === 0,
    blockers,
    summary,
  };
};

export const buildPhase4DuplicateLiveCheckpointKey = ({ workflow, payloadSha256 }) => {
  const workflowContract = getWorkflowContract(workflow);
  const workflowId = workflowContract?.workflowId ?? 'generic';
  const checkpointNamespace = workflowContract?.checkpointNamespace ?? 'rwo06d';
  const hash = normalizeCode(payloadSha256) || 'no-payload-sha256';
  return [
    checkpointNamespace,
    PHASE4_REQUEST_CLASS,
    workflowId,
    `target-${PHASE4_TARGET_PATIENT_ID}`,
    `request-${PHASE4_ALLOWED_REQUEST_NUMBER}`,
    `class-${PHASE4_ALLOWED_CLASS_CODE}`,
    `payload-sha256-${hash}`,
  ].join(':');
};

export const validatePhase4EndpointWorkflow = ({ workflow, payloadSummary }) => {
  const workflowContract = getWorkflowContract(workflow);
  const blockers = [];
  if (!workflowContract) {
    blockers.push(`--workflow must be one of: ${Object.keys(PHASE4_ENDPOINT_WORKFLOWS).join(', ')}`);
    return {
      ok: false,
      blockers,
      workflow: normalizeCode(workflow) || 'unspecified',
      workflowId: 'unknown',
      endpointEvidenceLevel: 'unknown',
      requiredEntityKindsPresent: false,
      allowedMedicalClassesOnly: false,
    };
  }

  const entityKinds = payloadSummary?.medicalInformation?.entityKinds ?? [];
  const medicalClasses = payloadSummary?.medicalInformation?.medicalClasses ?? [];
  const requiredEntityKindsPresent = workflowContract.requiredEntityKinds.every((entity) => entityKinds.includes(entity));
  const allowedMedicalClassesOnly =
    medicalClasses.length > 0 && medicalClasses.every((medicalClass) => workflowContract.allowedMedicalClasses.includes(medicalClass));

  if (!requiredEntityKindsPresent) {
    blockers.push(`workflow ${workflow} requires entity kind ${workflowContract.requiredEntityKinds.join(',')}`);
  }
  if (!allowedMedicalClassesOnly) {
    blockers.push(`workflow ${workflow} allows only medical class ${workflowContract.allowedMedicalClasses.join(',')}`);
  }

  return {
    ok: blockers.length === 0,
    blockers,
    workflow: normalizeCode(workflow),
    workflowId: workflowContract.workflowId,
    endpointEvidenceLevel: workflowContract.endpointEvidenceLevel,
    requiredEntityKinds: workflowContract.requiredEntityKinds,
    allowedMedicalClasses: workflowContract.allowedMedicalClasses,
    requiredEntityKindsPresent,
    allowedMedicalClassesOnly,
  };
};

const walkJsonFiles = (root, predicate, limit = 400) => {
  const results = [];
  if (!fs.existsSync(root)) return results;
  const stack = [root];
  while (stack.length > 0 && results.length < limit) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.json') && predicate(entryPath)) {
        results.push(entryPath);
      }
    }
  }
  return results;
};

export const findAcceptedPhase4Checkpoint = ({ repoRoot, checkpointKey }) => {
  const normalizedCheckpointKey = normalizeCode(checkpointKey);
  if (!normalizedCheckpointKey) return null;
  const candidates = [
    path.join(repoRoot, 'artifacts', 'orca-remediation', 'closeout'),
    path.join(repoRoot, 'docs', 'implementation'),
  ].flatMap((root) =>
    walkJsonFiles(root, (entryPath) => {
      const basename = path.basename(entryPath);
      return basename === 'phase4-medicalmodv2-summary.sanitized.json' || basename === 'summary.sanitized.json';
    }),
  );

  for (const candidate of candidates) {
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch {
      continue;
    }
    const duplicateLiveCheckpoint = parsed?.duplicateLiveCheckpoint ?? parsed?.phase4?.duplicateLiveCheckpoint;
    const sameKey = duplicateLiveCheckpoint?.key === normalizedCheckpointKey;
    const accepted =
      parsed?.response?.businessAccepted === true ||
      parsed?.liveTrialOrca?.businessSuccessClassification === 'live_trial_business_accepted';
    if (sameKey && accepted) {
      return {
        status: 'accepted_checkpoint_found',
        evidencePath: path.relative(repoRoot, candidate).split(path.sep).join('/'),
      };
    }
  }

  return null;
};

export const classifyMessageCategory = (message) => {
  const value = normalizeCode(message);
  if (!value) return 'none';
  if (SENSITIVE_MESSAGE_PATTERN.test(value)) return 'present_redacted_sensitive_shape';
  if (/正常|完了|ok|success/i.test(value)) return 'ok_like';
  if (/警告|warning/i.test(value)) return 'warning_like';
  if (/error|エラー|失敗|不可|reject/i.test(value)) return 'error_like';
  return 'present_redacted';
};

export const classifyPhase4BusinessResult = ({ httpStatus, responseJson }) => {
  const apiResult = normalizeCode(responseJson?.apiResult ?? responseJson?.Api_Result).toUpperCase();
  const httpOk = Number(httpStatus) >= 200 && Number(httpStatus) < 300;
  const apiOk = responseJson?.apiOk === true || ZERO_API_RESULT_PATTERN.test(apiResult);
  const completionEvidence = {
    informationTimestampPresent: Boolean(normalizeCode(responseJson?.informationDate) && normalizeCode(responseJson?.informationTime)),
    medicalUidPresent: Boolean(normalizeCode(responseJson?.medicalUid)),
    invoiceNumberPresent: Boolean(normalizeCode(responseJson?.invoiceNumber)),
    dataIdPresent: Boolean(normalizeCode(responseJson?.dataId)),
  };
  const completionEvidencePresent = Object.values(completionEvidence).some(Boolean);

  if (!httpStatus) return { responseClassification: 'notObserved', businessAccepted: false, completionEvidence };
  if (!httpOk) return { responseClassification: 'transportRejected', businessAccepted: false, completionEvidence };
  if (!apiOk) return { responseClassification: 'businessRejected', businessAccepted: false, completionEvidence };
  if (!completionEvidencePresent) return { responseClassification: 'notVerified', businessAccepted: false, completionEvidence };
  return { responseClassification: 'businessAccepted', businessAccepted: true, completionEvidence };
};

export const sanitizePhase4Response = ({ httpStatus, responseJson }) => {
  const business = classifyPhase4BusinessResult({ httpStatus, responseJson });
  const warnings = Array.isArray(responseJson?.medicalWarnings) ? responseJson.medicalWarnings : [];
  return {
    httpStatus: Number(httpStatus) || 0,
    apiResult: normalizeCode(responseJson?.apiResult ?? responseJson?.Api_Result),
    apiOk: responseJson?.apiOk === true,
    ok: responseJson?.ok === true,
    apiResultMessageCategory: classifyMessageCategory(responseJson?.apiResultMessage ?? responseJson?.Api_Result_Message),
    warningCount: warnings.length,
    responseClassification: business.responseClassification,
    businessAccepted: business.businessAccepted,
    completionEvidence: business.completionEvidence,
    rawResponseBodyStored: false,
    rawApiResultMessageStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const summarizeRuntimeReadiness = ({ healthStatus = 0, readinessStatus = 0 } = {}) => {
  const healthHttpStatus = Number(healthStatus) || 0;
  const readinessHttpStatus = Number(readinessStatus) || 0;
  const healthOk = healthHttpStatus >= 200 && healthHttpStatus < 300;
  const readinessOk = readinessHttpStatus >= 200 && readinessHttpStatus < 300;
  const blockers = [];
  if (!healthOk) blockers.push('backend health endpoint is not reachable');
  if (!readinessOk) blockers.push('backend readiness endpoint is not ready');
  return {
    ok: healthOk && readinessOk,
    healthHttpStatus,
    readinessHttpStatus,
    blockers,
    rawReadinessBodyStored: false,
    rawHealthBodyStored: false,
  };
};

export const validatePhase4SafeCommand = ({
  argv = [],
  env = process.env,
  cwd = process.cwd(),
  now = new Date(),
} = {}) => {
  const repoRoot = repoRootFromCwd(cwd);
  const { options, errors } = parsePhase4SafeArgs(argv);
  const blockers = [...errors];
  const modeCount = [options.dryRun, options.mock, options.executeApprovedPhase4].filter(Boolean).length;
  if (modeCount !== 1) {
    blockers.push('exactly one of --dry-run, --mock, or --execute-approved-phase4 is required');
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.phase4Only) blockers.push('--phase4-only is required');
  if (options.executeApprovedPhase4 && !options.payload) blockers.push('--payload is required for live Phase 4 execution');
  if (options.executeApprovedPhase4 && !options.payloadSha256) {
    blockers.push('--payload-sha256 is required for live Phase 4 execution');
  }
  if (options.executeApprovedPhase4 && !options.workflow) {
    blockers.push('--workflow is required for endpoint-specific live Phase 4 execution');
  }

  for (const [key, forbiddenValue, reason] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`${key}=${forbiddenValue}: ${reason}`);
  }

  let payload = null;
  let payloadSha256 = '';
  let payloadBytes = 0;
  let payloadGate = {
    ok: false,
    blockers: ['payload was not parsed'],
    summary: summarizePayload(buildSyntheticPayloadFixture()),
  };
  try {
    const loaded = loadPhase4Payload({ payloadPath: options.payload });
    payload = loaded.payload;
    payloadSha256 = loaded.sha256;
    payloadBytes = loaded.bytes;
    payloadGate = validatePhase4Payload({
      payload,
      payloadSha256,
      expectedPayloadSha256: options.payloadSha256 ?? '',
    });
    blockers.push(...payloadGate.blockers);
  } catch (error) {
    blockers.push(`payload cannot be parsed: ${String(error)}`);
  }

  const endpointWorkflow = validatePhase4EndpointWorkflow({
    workflow: options.workflow,
    payloadSummary: payloadGate.summary,
  });
  if (options.workflow || options.executeApprovedPhase4) {
    blockers.push(...endpointWorkflow.blockers);
  }

  const checkpointKey = buildPhase4DuplicateLiveCheckpointKey({
    workflow: endpointWorkflow.workflow,
    payloadSha256,
  });
  const acceptedCheckpoint = options.executeApprovedPhase4
    ? findAcceptedPhase4Checkpoint({ repoRoot, checkpointKey })
    : null;
  if (acceptedCheckpoint) {
    blockers.push('duplicate live checkpoint already accepted');
  }

  const ok = blockers.length === 0;
  const evidence = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    commandContract: PHASE4_WRAPPER_CONTRACT,
    endpoint: PHASE4_ENDPOINT_PATH,
    requestClass: PHASE4_REQUEST_CLASS,
    target: {
      candidateId: PHASE4_TARGET_CANDIDATE_ID,
      patientId: PHASE4_TARGET_PATIENT_ID,
      candidateOnly00001: true,
    },
    verdict: ok ? 'accepted' : 'rejected_before_live_orca',
    dryRun: options.dryRun === true,
    mock: options.mock === true,
    liveTrialAction: options.executeApprovedPhase4 && ok ? 'approved_to_execute_by_command_contract' : 'not_run',
    phase3: 'not_run',
    fullflow: 'not_run',
    browserNetworkArtifactMode: 'disabled',
    sanitizedEvidenceOnly: true,
    rawSensitiveFieldsExcluded: true,
    payload: {
      sha256: payloadSha256,
      bytes: payloadBytes,
      pathRecorded: false,
      rawPayloadStored: false,
      summary: payloadGate.summary,
    },
    endpointWorkflow,
    duplicateLiveCheckpoint: {
      key: checkpointKey,
      status: acceptedCheckpoint?.status ?? (options.executeApprovedPhase4 ? 'not_found' : 'not_checked_no_live'),
      evidencePath: acceptedCheckpoint?.evidencePath,
      liveMutationPermittedWhenReady: !acceptedCheckpoint,
    },
    requestSemantics: {
      requestNumber01Only: true,
      requestNumber02To04Forbidden: true,
      classCode01Only: true,
      http200AloneIsNotBusinessSuccess: true,
      apiResultZeroAloneIsNotBusinessSuccess: true,
      completionEvidenceRequired: true,
    },
    guard: {
      ok,
      blockers,
    },
  };

  return {
    ok,
    options,
    blockers,
    repoRoot,
    payload,
    payloadSha256,
    payloadBytes,
    payloadGate,
    evidence,
  };
};
