import './orca-env.mjs';
import crypto from 'node:crypto';

export const TRIAL_NATIVE_PROBE_CANDIDATES = [
  '00001',
  '00002',
  '00003',
  '00004',
  '00005',
  '00006',
  '00007',
  '00008',
  '00009',
  '00010',
  '00011',
];

export const REJECTED_TRIAL_CANDIDATES = new Set(['0000001']);
export const PREFERRED_EXACT_PREFLIGHT_CANDIDATE_IDS = ['00001', '00005'];
export const CANDIDATE_DISCOVERY_RELEASE_VERDICTS = {
  exactPreflightRequired: 'PARTIAL / EXACT PREFLIGHT REQUIRED',
  readinessBlocker: 'PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER',
  readonlyMutationBlocked: 'PARTIAL / READONLY MUTATION BLOCKER',
};

const normalizeText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};
const normalizePatientId = (value) => normalizeText(value).normalize('NFKC');
const normalizeApiResult = (value) => normalizeText(value).toUpperCase();
const isAllZeroApiResult = (value) => /^0+$/.test(normalizeApiResult(value));
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const AMBIGUOUS_READINESS_HTTP_STATUSES = new Set([0, 401, 403, 404]);
const APPOINTMENT_FLOW_MODES = new Set(['direct_acceptance', 'appointment_row']);
export const READINESS_FAILURE_CATEGORIES = {
  localGuard: 'localGuard',
  csrf: 'csrf',
  sessionAuthRole: 'sessionAuthRole',
  upstream: 'upstream',
  methodPathMismatch: 'methodPathMismatch',
  credentialUnavailable: 'credentialUnavailable',
  wrapperErrorBeforeUpstream: 'wrapperErrorBeforeUpstream',
  parserBlankApiResult: 'parserBlankApiResult',
  upstreamNon2xxNoBody: 'upstreamNon2xxNoBody',
  requestContractRejected: 'requestContractRejected',
  unknownNonzeroApiResult: 'unknownNonzeroApiResult',
  unknownAmbiguous403: 'unknownAmbiguous403',
  unknown: 'unknown',
  none: 'none',
};
const SELECTOR_FIELDS = ['department', 'physician', 'paymentMode', 'visitKind', 'medicalInformation'];

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const asFiniteStatus = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};
const is2xx = (httpStatus) => Number(httpStatus) >= 200 && Number(httpStatus) < 300;
const optionalStatus = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
};

const findFirstDeep = (value, names) => {
  const stack = [value];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }
    for (const [key, entry] of Object.entries(current)) {
      if (names.includes(key)) return entry;
      if (entry && typeof entry === 'object') stack.push(entry);
    }
  }
  return undefined;
};

const collectByKeyDeep = (value, names) => {
  const out = [];
  const stack = [value];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }
    for (const [key, entry] of Object.entries(current)) {
      if (names.includes(key)) {
        out.push(...asArray(entry).filter(isRecord));
      }
      if (entry && typeof entry === 'object') stack.push(entry);
    }
  }
  return out;
};

const hasWrapperError = (body) =>
  Boolean(
    body?.error ??
      body?.errors ??
      body?.errorCategory ??
      body?.wrapperError ??
      body?.upstreamError ??
      body?.status?.error ??
      body?.status?.errors,
  );

const lower = (value) => normalizeText(value).toLowerCase();
const safeBodyErrorTokens = (body) => {
  if (!isRecord(body)) return [];
  return [
    body.error,
    body.code,
    body.errorCode,
    body.errorCategory,
    body.message,
    body.reason,
    body.source,
    body.details?.errorMessage,
    body.details?.message,
    body.details?.reason,
    body.details?.source,
  ]
    .map(lower)
    .filter(Boolean);
};

const includesAny = (values, patterns) => values.some((value) => patterns.some((pattern) => pattern.test(value)));
const bodyIsEmpty = (body) => !isRecord(body) || Object.keys(body).length === 0;
const numberFrom = (...values) => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return undefined;
};

export const classifyReadinessFailureDiagnostic = ({
  httpStatus,
  body,
  apiResult,
  method,
  expectedMethod,
  pathName,
  expectedPath,
  responseBodyChars,
  parsedBodyOk,
} = {}) => {
  const status = asFiniteStatus(httpStatus);
  const tokens = safeBodyErrorTokens(body);
  const normalizedApiResult = normalizeApiResult(apiResult ?? body?.apiResult ?? body?.Api_Result);
  const responseChars = Number(responseBodyChars ?? 0);
  const upstreamStatus = numberFrom(
    body?.orcaHttpStatus,
    body?.upstreamStatus,
    body?.upstreamHttpStatus,
    body?.details?.orcaHttpStatus,
    body?.details?.upstreamStatus,
    body?.details?.upstreamHttpStatus,
  );
  const methodMismatch =
    normalizeText(method) &&
    normalizeText(expectedMethod) &&
    normalizeText(method).toUpperCase() !== normalizeText(expectedMethod).toUpperCase();
  const pathMismatch =
    normalizeText(pathName) &&
    normalizeText(expectedPath) &&
    normalizeText(pathName) !== normalizeText(expectedPath);
  const wrapperErrorPresent = hasWrapperError(body);
  const upstreamErrorPresent =
    Boolean(body?.upstreamError ?? body?.details?.upstreamError) ||
    includesAny(tokens, [/^orca_gateway$/, /orca_gateway_error/, /orca_http_error/, /upstream/, /orca_api_error/]) ||
    upstreamStatus !== undefined;
  const category = (() => {
    if (methodMismatch || pathMismatch || status === 405 || includesAny(tokens, [/method_not_allowed/, /path_mismatch/, /route_not_found/])) {
      return READINESS_FAILURE_CATEGORIES.methodPathMismatch;
    }
    if (includesAny(tokens, [/csrf/])) return READINESS_FAILURE_CATEGORIES.csrf;
    if (includesAny(tokens, [/route.*guard/, /local.*guard/, /blocked.*route/, /taxonomy/])) {
      return READINESS_FAILURE_CATEGORIES.localGuard;
    }
    if (
      (status === 401 || status === 403) &&
      includesAny(tokens, [/unauthorized/, /^forbidden$/, /facility_missing/, /remote_user_missing/, /session_revoked/, /step_up/, /privilege/])
    ) {
      return READINESS_FAILURE_CATEGORIES.sessionAuthRole;
    }
    if (
      includesAny(tokens, [/credential/, /decrypt/, /protector/, /settings/, /not_available/, /not available/, /incomplete/])
    ) {
      return READINESS_FAILURE_CATEGORIES.credentialUnavailable;
    }
    if (upstreamStatus === 401 || upstreamStatus === 403 || upstreamErrorPresent) {
      return READINESS_FAILURE_CATEGORIES.upstream;
    }
    if (wrapperErrorPresent) return READINESS_FAILURE_CATEGORIES.wrapperErrorBeforeUpstream;
    if (status === 200 && !normalizedApiResult) return READINESS_FAILURE_CATEGORIES.parserBlankApiResult;
    if (!is2xx(status) && (responseChars === 0 || bodyIsEmpty(body) || parsedBodyOk === false)) {
      return READINESS_FAILURE_CATEGORIES.upstreamNon2xxNoBody;
    }
    if (status === 403) return READINESS_FAILURE_CATEGORIES.unknownAmbiguous403;
    if (status === 0 || !is2xx(status) || !normalizedApiResult) return READINESS_FAILURE_CATEGORIES.unknown;
    return READINESS_FAILURE_CATEGORIES.none;
  })();
  return {
    category,
    sourceCategory: category,
    status,
    upstreamStatus,
    bodyPresent: !bodyIsEmpty(body),
    apiResultPresent: Boolean(normalizedApiResult),
    wrapperErrorPresent,
    upstreamErrorPresent,
    methodMismatch: Boolean(methodMismatch),
    pathMismatch: Boolean(pathMismatch),
    rawSensitiveFieldsExcluded: true,
  };
};

const isAmbiguousReadinessStatus = (status) =>
  AMBIGUOUS_READINESS_HTTP_STATUSES.has(asFiniteStatus(status)) || asFiniteStatus(status) >= 500;

const parsedOrcaBodyAccepted = (body, parsedBodyOk) => {
  if (parsedBodyOk === false) return false;
  if (parsedBodyOk === true) return isRecord(body);
  return isRecord(body);
};

const isRequestContractApiResult = (apiResult) => {
  const normalized = normalizeApiResult(apiResult);
  return /^E/.test(normalized) || /^0*91$/.test(normalized);
};

const classifyNonZeroOrcaResult = (apiResult) =>
  isRequestContractApiResult(apiResult) ? 'request_contract_rejected' : 'unknown_nonzero';

const nonZeroReadinessCategory = (apiResult) =>
  isRequestContractApiResult(apiResult)
    ? READINESS_FAILURE_CATEGORIES.requestContractRejected
    : READINESS_FAILURE_CATEGORIES.unknownNonzeroApiResult;

const collectPatientRecords = (body) => {
  const records = [];
  const push = (value) => {
    if (value && typeof value === 'object') records.push(value);
  };
  for (const item of asArray(body?.patients)) push(item);
  for (const item of asArray(body?.Patients)) push(item);
  for (const item of asArray(body?.Patient_Information)) push(item);
  for (const item of asArray(body?.patientlst2res?.Patient_Information)) push(item);
  return records;
};

const collectOfficialPatientInformationRecords = (body) =>
  collectByKeyDeep(body, [
    'Patient_Information',
    'Patient_Information_child',
  ]);

const patientIdOf = (record) =>
  normalizePatientId(
    record?.patientId ??
      record?.Patient_ID ??
      record?.PatientId ??
      record?.PatientID ??
      record?.Patient_No ??
      record?.Patient_Number ??
      record?.summary?.patientId ??
      record?.summary?.Patient_ID ??
      record?.summary?.PatientId ??
      record?.summary?.PatientID ??
      record?.summary?.Patient_No ??
      record?.summary?.Patient_Number ??
      record?.patient?.patientId ??
      record?.patient?.Patient_ID ??
      record?.patient?.PatientId ??
      record?.patient?.PatientID ??
      record?.patient?.Patient_No ??
      record?.patient?.Patient_Number,
  );

const hasPatientNotFoundMessage = (body) =>
  /(患者番号がありません|patient[-_\s]*not[-_\s]*found|no\s+patient|患者番号に該当する患者が存在しません|該当する患者が存在しません|患者.*存在しません)/i.test(
    JSON.stringify(body ?? {}),
  );

const collectDiagnosticText = (body) => {
  if (!isRecord(body)) return '';
  const fields = [
    body.error,
    body.code,
    body.errorCode,
    body.errorCategory,
    body.message,
    body.reason,
    body.reasonCode,
    body.exceptionClass,
    body.exceptionClassName,
    body.details?.error,
    body.details?.code,
    body.details?.errorCode,
    body.details?.errorCategory,
    body.details?.message,
    body.details?.reason,
    body.details?.reasonCode,
    body.details?.exceptionClass,
    body.details?.exceptionClassName,
  ];
  return fields.map(normalizeText).filter(Boolean).join(' ');
};

const diagnosticField = (body, names) =>
  normalizeText(names.map((name) => findFirstDeep(body, [name])).find((value) => normalizeText(value)));

const resolveUpstreamStatus = ({ body, responseHeaders }) => {
  const headerStatus = responseHeaders
    ? optionalStatus(responseHeaders['x-orca-upstream-status'] ?? responseHeaders['X-Orca-Upstream-Status'])
    : undefined;
  if (headerStatus) return headerStatus;
  const explicit = optionalStatus(
    body?.upstreamStatus ??
      body?.upstreamHttpStatus ??
      body?.orcaStatus ??
      body?.details?.upstreamStatus ??
      body?.details?.upstreamHttpStatus ??
      body?.details?.orcaStatus,
  );
  if (explicit) return explicit;
  const text = collectDiagnosticText(body);
  const match = /\bORCA\s+HTTP\s+response\s+status\s+([1-5][0-9]{2})\b/i.exec(text);
  return match ? optionalStatus(match[1]) : undefined;
};

const sanitizeErrorCategory = (body, httpStatus) => {
  const value =
    diagnosticField(body, ['diagnosticCategory']) ||
    diagnosticField(body, ['errorCategory']) ||
    diagnosticField(body, ['errorCode']) ||
    diagnosticField(body, ['code']) ||
    (httpStatus >= 500 ? 'server_error' : '');
  const normalized = value.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'none';
};

const sanitizeExceptionClassName = (body) => {
  const value = diagnosticField(body, ['exceptionClassName', 'exceptionClass', 'exception', 'type']);
  if (!/^[A-Za-z_$][A-Za-z0-9_$.]*(Exception|Error)$/.test(value)) return undefined;
  if (/auth|credential|password|secret|token|session|cookie|csrf/i.test(value)) return undefined;
  return value.split('.').pop();
};

const apiResultCategoryOf = (apiResult) => {
  const normalized = normalizeApiResult(apiResult);
  if (!normalized) return 'missing';
  return isAllZeroApiResult(normalized) ? 'all_zero' : 'non_zero';
};

const classifyOfficialPatientGetDiagnostic = ({
  localStatus,
  upstreamStatus,
  body,
  parsedOrcaBody,
  apiResult,
  patientInformationPresent,
  exactIdMatched,
  notFoundMessage,
  responseCategory,
  errorCategory,
  exceptionClassName,
}) => {
  const text = collectDiagnosticText(body);
  const status = asFiniteStatus(localStatus);
  if (status === 401 || status === 403 || /unauthori[sz]ed|forbidden|csrf|role|permission|auth/i.test(text)) {
    return 'local_auth_failure';
  }
  if (/credential|decrypt|orca_mode|orca\.mode|transport settings|settings are incomplete|not available/i.test(text)) {
    return 'credential_unavailable';
  }
  if (optionalStatus(upstreamStatus) && !is2xx(upstreamStatus)) {
    return 'upstream_http_not_2xx';
  }
  if (status >= 500 && /parse|parser|json|xml|deseriali[sz]e|mapping|converter/i.test(text)) {
    return 'parser_error';
  }
  if (status >= 500 && exceptionClassName) {
    return 'local_exception';
  }
  if (status >= 500) {
    const genericText = text
      .toLowerCase()
      .replace(/\b(server_error|internal_error|orca_gateway_error|error)\b/g, '')
      .replace(/[\s_.-]+/g, '');
    return errorCategory === 'server_error' && !genericText ? 'unknown' : 'local_exception';
  }
  if (!is2xx(status)) {
    return 'unknown';
  }
  if (parsedOrcaBody !== true) {
    return 'orca_body_missing';
  }
  if (notFoundMessage) {
    return 'patient_not_found_wording_present';
  }
  const apiResultCategory = apiResultCategoryOf(apiResult);
  if (apiResultCategory === 'missing') {
    return 'api_result_missing';
  }
  if (apiResultCategory === 'non_zero') {
    return 'api_result_non_zero';
  }
  if (!patientInformationPresent) {
    return 'patient_information_missing';
  }
  if (!exactIdMatched) {
    return 'exact_patient_id_mismatch';
  }
  if (responseCategory === 'empty' || responseCategory === 'not_found') {
    return `response_category_${responseCategory}`;
  }
  return 'accepted';
};

export const isRejectedTrialCandidate = (candidateId) => REJECTED_TRIAL_CANDIDATES.has(normalizeText(candidateId));

export const normalizeCandidateExclusionSet = (value) => {
  const entries = Array.isArray(value) ? value : normalizeText(value).split(/[,\s]+/);
  return new Set(entries.map(normalizePatientId).filter(Boolean));
};

export const selectPreferredExactPreflightCandidate = (
  candidates,
  isAccepted = (candidate) => candidate?.acceptedForExactPreflightProposal === true,
  { excludedPatientIds = new Set() } = {},
) => {
  const rows = Array.isArray(candidates) ? candidates : Object.values(candidates ?? {});
  const excluded = excludedPatientIds instanceof Set ? excludedPatientIds : normalizeCandidateExclusionSet(excludedPatientIds);
  const acceptedRows = rows.filter((candidate) => {
    if (!candidate || !isAccepted(candidate)) return false;
    const patientId = normalizePatientId(candidate.patientId ?? candidate.candidateId);
    return !excluded.has(patientId);
  });
  for (const preferredId of PREFERRED_EXACT_PREFLIGHT_CANDIDATE_IDS) {
    const match = acceptedRows.find(
      (candidate) => normalizePatientId(candidate.patientId ?? candidate.candidateId) === preferredId,
    );
    if (match) return match;
  }
  return acceptedRows[0] ?? null;
};

export const summarizeOfficialPatientExistence = ({
  httpStatus,
  localStatus,
  upstreamStatus,
  responseHeaders,
  body,
  candidateId,
  parsedOrcaBody: parsedOrcaBodyInput,
  method = 'GET',
  endpointKind = 'official_patientgetv2',
}) => {
  const status = asFiniteStatus(localStatus ?? httpStatus);
  const resolvedUpstreamStatus = optionalStatus(upstreamStatus) ?? resolveUpstreamStatus({ body, responseHeaders });
  const parsedOrcaBody = parsedOrcaBodyInput !== undefined ? parsedOrcaBodyInput === true && isRecord(body) : isRecord(body);
  const apiResult = normalizeApiResult(
    body?.apiResult ?? body?.Api_Result ?? findFirstDeep(body, ['apiResult', 'Api_Result', 'result', 'Result']),
  );
  const apiResultAccepted = isAllZeroApiResult(apiResult);
  const records = collectOfficialPatientInformationRecords(body);
  const patientInformationPresent = records.length > 0;
  const normalizedCandidateId = normalizePatientId(candidateId);
  const exactIdMatched = records.some((record) => patientIdOf(record) === normalizedCandidateId);
  const notFoundMessage = hasPatientNotFoundMessage(body);
  const category = notFoundMessage
    ? 'not_found'
    : !patientInformationPresent
      ? 'empty'
      : exactIdMatched
        ? 'present'
        : 'different_patient_id_present';
  const errorCategory = sanitizeErrorCategory(body, status);
  const exceptionClassName = sanitizeExceptionClassName(body);
  const apiResultCategory = apiResultCategoryOf(apiResult);
  const diagnosticCategory = classifyOfficialPatientGetDiagnostic({
    localStatus: status,
    upstreamStatus: resolvedUpstreamStatus,
    body,
    parsedOrcaBody,
    apiResult,
    patientInformationPresent,
    exactIdMatched,
    notFoundMessage,
    responseCategory: category,
    errorCategory,
    exceptionClassName,
  });
  const bodyHash = hash(
    `${status}:${resolvedUpstreamStatus ?? 'unknown'}:${endpointKind}:${method}:${errorCategory}:${exceptionClassName ?? 'none'}:${parsedOrcaBody}:${apiResultCategory}:${patientInformationPresent}:${exactIdMatched}:${notFoundMessage}:${category}`,
  );
  const rejectionReason =
    resolvedUpstreamStatus && !is2xx(resolvedUpstreamStatus)
      ? 'upstream_http_not_2xx'
      : !is2xx(status)
        ? diagnosticCategory
      : !parsedOrcaBody
        ? 'orca_body_not_parsed'
      : !apiResultAccepted
        ? apiResult
          ? 'api_result_not_all_zero'
          : 'api_result_missing'
        : !patientInformationPresent
          ? 'patient_information_missing'
          : !exactIdMatched
            ? 'exact_patient_id_mismatch'
            : notFoundMessage
              ? 'patient_not_found_wording_present'
              : category === 'empty' || category === 'not_found'
                ? `response_category_${category}`
                : 'none';
  const accepted =
    is2xx(status) &&
    (!resolvedUpstreamStatus || is2xx(resolvedUpstreamStatus)) &&
    parsedOrcaBody &&
    apiResultAccepted &&
    patientInformationPresent &&
    exactIdMatched &&
    !notFoundMessage &&
    category !== 'empty' &&
    category !== 'not_found';
  return {
    status,
    httpStatus: status,
    localStatus: status,
    upstreamStatus: resolvedUpstreamStatus,
    endpointKind,
    method,
    diagnosticCategory,
    errorCategory,
    exceptionClassName,
    hasParsedBody: parsedOrcaBody,
    hasPatientInformation: patientInformationPresent,
    apiResultCategory,
    exactPatientIdMatch: exactIdMatched,
    bodyHash,
    parsedOrcaBody,
    apiResult,
    apiResultAccepted,
    patientInformationPresent,
    exactIdMatched,
    patientIdMatched: exactIdMatched,
    category,
    responseCategory: category,
    recordCount: records.length,
    accepted,
    verdict: accepted ? 'accepted' : 'rejected',
    rejectionReason,
    evidenceHash: hash(
      `${normalizedCandidateId}:${status}:${resolvedUpstreamStatus ?? 'unknown'}:${apiResult}:${apiResultAccepted}:${patientInformationPresent}:${exactIdMatched}:${records.length}:${notFoundMessage}:${category}:${diagnosticCategory}:${bodyHash}`,
    ),
    notFoundMessage,
  };
};

export const sanitizeOfficialPatientExistenceEvidence = (summary) => {
  const httpStatus = asFiniteStatus(summary?.httpStatus ?? summary?.status ?? summary?.localStatus);
  const localStatus = asFiniteStatus(summary?.localStatus ?? httpStatus);
  const upstreamStatus = optionalStatus(summary?.upstreamStatus);
  const parsedOrcaBody = summary?.parsedOrcaBody === true;
  const apiResult = normalizeApiResult(summary?.apiResult);
  const apiResultAccepted = summary?.apiResultAccepted === true;
  const patientInformationPresent = summary?.patientInformationPresent === true;
  const exactIdMatched = summary?.exactIdMatched === true;
  const notFoundMessage = summary?.notFoundMessage === true;
  const responseCategory = normalizeText(summary?.responseCategory ?? summary?.category) || 'not_verified';
  const rejectionReason = normalizeText(summary?.rejectionReason) || 'not_verified';
  const endpointKind = normalizeText(summary?.endpointKind) || 'official_patientgetv2';
  const method = normalizeText(summary?.method) || 'GET';
  const diagnosticCategory = normalizeText(summary?.diagnosticCategory) || 'unknown';
  const errorCategory = normalizeText(summary?.errorCategory) || 'none';
  const exceptionClassName = normalizeText(summary?.exceptionClassName) || undefined;
  const apiResultCategory = normalizeText(summary?.apiResultCategory) || apiResultCategoryOf(apiResult);
  const exactPatientIdMatch = summary?.exactPatientIdMatch === true || exactIdMatched;
  const bodyHash =
    normalizeText(summary?.bodyHash) ||
    hash(
      `${localStatus}:${upstreamStatus ?? 'unknown'}:${endpointKind}:${method}:${errorCategory}:${exceptionClassName ?? 'none'}:${parsedOrcaBody}:${apiResultCategory}:${patientInformationPresent}:${exactPatientIdMatch}:${notFoundMessage}:${responseCategory}`,
    );
  const evidenceHash =
    normalizeText(summary?.evidenceHash) ||
    hash(
      `${httpStatus}:${localStatus}:${upstreamStatus ?? 'unknown'}:${parsedOrcaBody}:${apiResult}:${apiResultAccepted}:${patientInformationPresent}:${exactIdMatched}:${notFoundMessage}:${responseCategory}:${rejectionReason}:${diagnosticCategory}:${bodyHash}`,
    );
  return {
    httpStatus,
    localStatus,
    upstreamStatus,
    endpointKind,
    method,
    diagnosticCategory,
    errorCategory,
    exceptionClassName,
    hasParsedBody: parsedOrcaBody,
    hasPatientInformation: patientInformationPresent,
    apiResultCategory,
    exactPatientIdMatch,
    bodyHash,
    parsedOrcaBody,
    apiResult,
    apiResultAccepted,
    patientInformationPresent,
    exactIdMatched,
    notFoundMessage,
    responseCategory,
    rejectionReason,
    evidenceHash,
    rawSensitiveFieldsExcluded: true,
  };
};

export const officialPatientEvidenceAccepted = (evidence) =>
  is2xx(evidence?.httpStatus) &&
  evidence?.parsedOrcaBody === true &&
  evidence?.apiResultAccepted === true &&
  evidence?.patientInformationPresent === true &&
  evidence?.exactIdMatched === true &&
  evidence?.notFoundMessage !== true &&
  evidence?.rawSensitiveFieldsExcluded === true;

export const buildOfficialPatientReadinessAxes = (candidateEvidenceMap) => {
  const entries = Object.entries(candidateEvidenceMap ?? {});
  return {
    meaning:
      '00001-00011 are official ORCA Trial initial patients; rejected exact preflight rows mean Phase 3 mutation-ready read-only evidence is incomplete and do not contradict official initial patient registration.',
    officialTrialInitialPatientsExistenceAssumption: 'registered_by_official_orca_trial_docs',
    rawSensitiveFieldsExcluded: true,
    patientgetv2: entries.map(([patientId, value]) => {
      const evidence = sanitizeOfficialPatientExistenceEvidence(value);
      return {
        patientId,
        httpStatus: evidence.httpStatus,
        parsedOrcaBody: evidence.parsedOrcaBody,
        apiResult: evidence.apiResult,
        apiResultAccepted: evidence.apiResultAccepted,
        patientInformationPresent: evidence.patientInformationPresent,
        exactIdMatched: evidence.exactIdMatched,
        patientNotFoundWordingAbsent: evidence.notFoundMessage !== true,
        responseCategory: evidence.responseCategory,
        rejectionReason: evidence.rejectionReason,
        diagnosticCategory: evidence.diagnosticCategory,
        localStatus: evidence.localStatus,
        upstreamStatus: evidence.upstreamStatus,
        endpointKind: evidence.endpointKind,
        method: evidence.method,
        errorCategory: evidence.errorCategory,
        exceptionClassName: evidence.exceptionClassName,
        hasParsedBody: evidence.hasParsedBody,
        hasPatientInformation: evidence.hasPatientInformation,
        apiResultCategory: evidence.apiResultCategory,
        exactPatientIdMatch: evidence.exactPatientIdMatch,
        bodyHash: evidence.bodyHash,
        accepted: officialPatientEvidenceAccepted(evidence),
        evidenceHash: evidence.evidenceHash,
        rawSensitiveFieldsExcluded: true,
      };
    }),
  };
};

const collectInsuranceCombinations = (body) => {
  const combinations = [];
  const push = (value) => {
    if (value && typeof value === 'object') combinations.push(value);
  };
  for (const item of asArray(body?.combinations)) push(item);
  for (const patient of collectPatientRecords(body)) {
    for (const item of asArray(patient?.insurances)) push(item);
    for (const item of asArray(patient?.HealthInsurance_Information)) push(item);
  }
  for (const item of asArray(body?.HealthInsurance_Information)) push(item);
  for (const item of asArray(body?.patientlst2res?.HealthInsurance_Information)) push(item);
  return combinations;
};

const normalizeDate = (value) => {
  const text = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return '';
};

const combinationNumberOf = (combination) =>
  normalizeText(combination?.combinationNumber ?? combination?.Insurance_Combination_Number);

const dateInRange = (baseDate, startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (start && baseDate < start) return false;
  if (end && end !== '9999-12-31' && baseDate > end) return false;
  return true;
};

export const summarizeInsuranceReadiness = ({
  httpStatus,
  body,
  baseDate,
  endpointKind,
  method,
  expectedMethod,
  pathName,
  expectedPath,
  responseBodyChars,
  parsedBodyOk,
}) => {
  const apiResult = normalizeApiResult(body?.apiResult ?? body?.Api_Result);
  const parsedOrcaBody = parsedOrcaBodyAccepted(body, parsedBodyOk);
  const semantic = normalizeText(endpointKind ?? body?.endpointKind ?? body?.orcaApi ?? body?.apiName ?? pathName).toLowerCase();
  const patientlst6v2Semantics = semantic.includes('patientlst6v2') || semantic.includes('insurance/combinations');
  const combinations = collectInsuranceCombinations(body);
  const eligible = combinations.filter((combination) =>
    dateInRange(
      baseDate,
      combination?.certificateStartDate ?? combination?.Certificate_StartDate,
      combination?.certificateExpiredDate ?? combination?.Certificate_ExpiredDate,
    ),
  );
  const usable = eligible.filter((combination) => combinationNumberOf(combination));
  const selected = usable[0];
  const selectedCombinationHash = selected ? hash(combinationNumberOf(selected) || JSON.stringify(Object.keys(selected))) : undefined;
  const status = asFiniteStatus(httpStatus);
  const diagnostic = classifyReadinessFailureDiagnostic({
    httpStatus: status,
    body,
    apiResult,
    method,
    expectedMethod,
    pathName,
    expectedPath,
    responseBodyChars,
    parsedBodyOk,
  });
  const classification = (() => {
    if (hasWrapperError(body) || isAmbiguousReadinessStatus(status)) return 'ambiguous_readiness_failure';
    if (!parsedOrcaBody) return 'ambiguous_readiness_failure';
    if (!apiResult) return 'ambiguous_readiness_failure';
    if (status !== 200) return 'ambiguous_readiness_failure';
    if (apiResult === '20' && patientlst6v2Semantics) return 'business_no_insurance_combination';
    if (apiResult === '21' && patientlst6v2Semantics) return 'business_too_many_insurance_combinations';
    if (!isAllZeroApiResult(apiResult)) return classifyNonZeroOrcaResult(apiResult);
    if (usable.length === 0) return 'insurance_not_usable';
    return 'accepted';
  })();
  const readinessFailureCategory =
    classification === 'accepted'
      ? READINESS_FAILURE_CATEGORIES.none
      : classification === 'request_contract_rejected' || classification === 'unknown_nonzero'
        ? nonZeroReadinessCategory(apiResult)
        : diagnostic.category;
  return {
    checked: true,
    status,
    httpStatus,
    parsedOrcaBody,
    apiResult,
    classification,
    combinationsCount: combinations.length,
    eligibleCount: eligible.length,
    usableCombinationCount: usable.length,
    effectiveCount: usable.length,
    selectedCombinationHash,
    diagnosticCategory: diagnostic.category,
    readinessFailureCategory,
    diagnostic,
    accepted: classification === 'accepted',
  };
};

const collectAppointmentRows = (body) => {
  const rows = [];
  const push = (value) => {
    if (value && typeof value === 'object') rows.push(value);
  };
  for (const item of asArray(body?.slots)) push(item);
  for (const item of asArray(body?.reservations)) push(item);
  for (const item of asArray(body?.appointments)) push(item);
  for (const item of asArray(body?.items)) push(item);
  for (const item of asArray(body?.Appointment_Information)) push(item);
  for (const item of asArray(body?.Reservation_Information)) push(item);
  return rows;
};

const appointmentPatientIdOf = (row, body) =>
  normalizeText(
    row?.patientId ??
      row?.Patient_ID ??
      row?.patient?.patientId ??
      row?.patient?.Patient_ID ??
      row?.Patient_Information?.Patient_ID ??
      body?.patient?.patientId ??
      body?.patient?.Patient_ID,
  );

const appointmentDateOf = (row, body) =>
  normalizeDate(
    row?.appointmentDate ??
      row?.Appointment_Date ??
      row?.visitDate ??
      row?.Visit_Date ??
      row?.date ??
      body?.appointmentDate ??
      body?.baseDate,
  );

const appointmentRowMatches = (row, body, { patientId, baseDate } = {}) => {
  const expectedPatientId = normalizeText(patientId);
  const expectedDate = normalizeDate(baseDate);
  const rowPatientId = appointmentPatientIdOf(row, body);
  const rowDate = appointmentDateOf(row, body);
  if (expectedPatientId && rowPatientId !== expectedPatientId) return false;
  if (expectedDate && rowDate && rowDate !== expectedDate) return false;
  return Boolean(rowPatientId || !expectedPatientId);
};

export const summarizeAppointmentDependency = ({
  flowMode,
  httpStatus,
  body,
  apiResult,
  patientId,
  baseDate,
  method,
  expectedMethod,
  pathName,
  expectedPath,
  responseBodyChars,
  parsedBodyOk,
}) => {
  const normalizedFlowMode = APPOINTMENT_FLOW_MODES.has(normalizeText(flowMode)) ? normalizeText(flowMode) : 'unknown';
  const hasProbe = httpStatus !== undefined && httpStatus !== null;
  const status = hasProbe ? asFiniteStatus(httpStatus) : undefined;
  const normalizedApiResult = normalizeApiResult(apiResult ?? body?.apiResult ?? body?.Api_Result);
  const parsedOrcaBody = hasProbe ? parsedOrcaBodyAccepted(body, parsedBodyOk) : false;
  const rows = collectAppointmentRows(body);
  const exactRowCount = rows.filter((row) => appointmentRowMatches(row, body, { patientId, baseDate })).length;
  const diagnostic = hasProbe
    ? classifyReadinessFailureDiagnostic({
        httpStatus: status,
        body,
        apiResult: normalizedApiResult,
        method,
        expectedMethod,
        pathName,
        expectedPath,
        responseBodyChars,
        parsedBodyOk,
      })
    : {
        category: READINESS_FAILURE_CATEGORIES.none,
        sourceCategory: READINESS_FAILURE_CATEGORIES.none,
        status: 0,
        bodyPresent: false,
        apiResultPresent: false,
        wrapperErrorPresent: false,
        upstreamErrorPresent: false,
        methodMismatch: false,
        pathMismatch: false,
        rawSensitiveFieldsExcluded: true,
      };
  const base = {
    flowMode: normalizedFlowMode,
    mode: normalizedFlowMode === 'direct_acceptance' ? 'direct_patient_acceptance_flow' : normalizedFlowMode,
    required: normalizedFlowMode === 'appointment_row',
    absenceBlocker: normalizedFlowMode === 'appointment_row',
    status,
    httpStatus: status,
    parsedOrcaBody,
    apiResult: normalizedApiResult,
    rowCount: rows.length,
    exactRowCount,
    diagnosticCategory: diagnostic.category,
    readinessFailureCategory: diagnostic.category,
    diagnostic,
  };

  if (normalizedFlowMode === 'unknown') {
    return { ...base, classification: 'unknown_flow_mode', verdict: 'not_verified', accepted: false };
  }

  if (!hasProbe && normalizedFlowMode === 'direct_acceptance') {
    return {
      ...base,
      required: false,
      absenceBlocker: false,
      classification: 'direct_acceptance_no_appointment_required',
      verdict: 'accepted',
      accepted: true,
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.none,
      reason: 'direct flow does not require an existing appointment row',
    };
  }

  if (hasWrapperError(body) || isAmbiguousReadinessStatus(status)) {
    return { ...base, classification: 'ambiguous_readiness_failure', verdict: 'rejected', accepted: false };
  }
  if (!parsedOrcaBody) {
    return { ...base, classification: 'ambiguous_readiness_failure', verdict: 'rejected', accepted: false };
  }
  if (!normalizedApiResult) {
    return { ...base, classification: 'ambiguous_readiness_failure', verdict: 'rejected', accepted: false };
  }
  if (status !== 200) {
    return { ...base, classification: 'ambiguous_readiness_failure', verdict: 'rejected', accepted: false };
  }
  if (normalizedApiResult === '21') {
    if (normalizedFlowMode === 'direct_acceptance') {
      return {
        ...base,
        required: false,
        absenceBlocker: false,
        classification: 'direct_acceptance_no_appointment_required',
        verdict: 'accepted',
        accepted: true,
        readinessFailureCategory: READINESS_FAILURE_CATEGORIES.none,
        reason: 'known_no_appointment_row_benign_for_direct_acceptance',
      };
    }
    return {
      ...base,
      classification: 'appointment_absent',
      verdict: 'rejected',
      accepted: false,
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.none,
      reason: 'known_no_appointment_row_for_appointment_row_flow',
    };
  }
  if (!isAllZeroApiResult(normalizedApiResult)) {
    return {
      ...base,
      classification: classifyNonZeroOrcaResult(normalizedApiResult),
      readinessFailureCategory: nonZeroReadinessCategory(normalizedApiResult),
      verdict: 'rejected',
      accepted: false,
    };
  }

  if (normalizedFlowMode === 'direct_acceptance') {
    return {
      ...base,
      required: false,
      absenceBlocker: false,
      classification: exactRowCount > 0 ? 'appointment_row_present' : 'direct_acceptance_no_appointment_required',
      verdict: 'accepted',
      accepted: true,
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.none,
      reason: exactRowCount > 0
        ? 'direct flow observed an appointment row but does not require it'
        : 'direct flow does not require an existing appointment row',
    };
  }

  if (exactRowCount > 0) {
    return {
      ...base,
      classification: 'appointment_row_present',
      verdict: 'accepted',
      accepted: true,
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.none,
    };
  }
  return { ...base, classification: 'appointment_row_missing', verdict: 'rejected', accepted: false };
};

export const summarizeSelectorReadiness = (selectors) => {
  const summarize = (item) => ({
    exists: item?.exists === true,
    optionCount: Number(item?.optionCount ?? 0),
    hasDesiredValue: item?.hasDesiredValue !== false,
    accepted: item?.exists === true && Number(item?.optionCount ?? 0) > 0 && item?.hasDesiredValue !== false,
  });
  const department = summarize(selectors?.department);
  const physician = summarize(selectors?.physician);
  const medicalInformation = summarize(selectors?.medicalInformation);
  return {
    department,
    physician,
    medicalInformation,
    accepted: department.accepted && physician.accepted && medicalInformation.accepted,
  };
};

export const summarizeLocalSelectableReadiness = ({ candidateId, selectableCount, exactMatch }) => ({
  selectableCount: Number(selectableCount ?? 0),
  exactMatch: exactMatch === true,
  accepted: Number(selectableCount ?? 0) === 1 && exactMatch === true,
  evidenceHash: hash(`${candidateId}:${selectableCount}:${exactMatch}`),
});

const safeCount = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
};

const normalizeStatus = (value, accepted) => {
  if (accepted === true || value === 'accepted') return 'accepted';
  if (value === 'not_verified') return 'not_verified';
  return 'rejected';
};

const sanitizeLocalSelectableReason = ({ status, reason, exactMatchCount, exactMatch, selectable }) => {
  if (status === 'accepted') return 'none';
  const normalizedReason = normalizeText(reason);
  if (
    normalizedReason === 'local_exact_match_missing' ||
    normalizedReason === 'local_exact_match_ambiguous' ||
    normalizedReason === 'local_exact_match_not_selectable' ||
    normalizedReason === 'local_search_failed' ||
    normalizedReason === 'no_accepted_trial_candidate'
  ) {
    return normalizedReason;
  }
  if (normalizedReason === 'local_sync_required') return 'local_exact_match_missing';
  if (exactMatchCount === 0 || exactMatch === false) return 'local_exact_match_missing';
  if (selectable === false) return 'local_exact_match_not_selectable';
  return status === 'not_verified' ? 'unknown' : 'local_selectable_not_ready';
};

export const summarizeLocalSelectableDiagnostic = ({
  patientId,
  normalizedTargetPatientId,
  selectableCount,
  recordsReturned,
  exactResultCount,
  exactMatchCount,
  exactMatch,
  selectable,
  accepted,
  verdict,
  reason,
}) => {
  const localCandidateCount = safeCount(recordsReturned ?? selectableCount);
  const exactCount = safeCount(exactResultCount ?? exactMatchCount ?? (exactMatch === true ? 1 : 0));
  const localAccepted = accepted === true || selectable === true || verdict === 'accepted';
  const status = normalizeStatus(verdict, localAccepted);
  const sanitizedReason = sanitizeLocalSelectableReason({
    status,
    reason,
    exactMatchCount: exactCount,
    exactMatch: exactMatch ?? exactCount > 0,
    selectable,
  });
  return {
    status,
    verdict: status,
    accepted: status === 'accepted',
    reason: sanitizedReason,
    normalizedTargetPatientId: normalizePatientId(normalizedTargetPatientId || patientId),
    localCandidateCount,
    selectableCount: safeCount(selectableCount ?? recordsReturned),
    exactMatchCount: exactCount,
    exactNormalizedPatientIdMatchCount: exactCount,
    exactMatch: exactCount === 1,
    rawSensitiveFieldsExcluded: true,
  };
};

const selectorItemDiagnostic = (item) => {
  const exists = item?.exists === true;
  const disabled = item?.disabled === true;
  const optionCount = safeCount(item?.optionCount);
  const targetMatch = item?.hasDesiredValue !== false;
  const notVerifiedReason = normalizeText(item?.notVerifiedReason);
  if (notVerifiedReason) {
    return {
      status: 'not_verified',
      verdict: 'not_verified',
      reason: notVerifiedReason === 'local_exact_match_missing' ? 'local_exact_match_missing' : 'unknown',
      exists,
      disabled,
      optionCount,
      targetMatch,
      accepted: false,
    };
  }
  if (!exists) {
    return {
      status: 'rejected',
      verdict: 'rejected',
      reason: 'selector_unavailable',
      exists,
      disabled,
      optionCount,
      targetMatch,
      accepted: false,
    };
  }
  if (disabled) {
    return {
      status: 'rejected',
      verdict: 'rejected',
      reason: 'selector_disabled',
      exists,
      disabled,
      optionCount,
      targetMatch,
      accepted: false,
    };
  }
  if (optionCount === 0) {
    return {
      status: 'rejected',
      verdict: 'rejected',
      reason: 'selector_option_missing',
      exists,
      disabled,
      optionCount,
      targetMatch,
      accepted: false,
    };
  }
  if (!targetMatch) {
    return {
      status: 'rejected',
      verdict: 'rejected',
      reason: 'selector_exact_match_missing',
      exists,
      disabled,
      optionCount,
      targetMatch,
      accepted: false,
    };
  }
  return {
    status: 'accepted',
    verdict: 'accepted',
    reason: 'none',
    exists,
    disabled,
    optionCount,
    targetMatch,
    accepted: true,
  };
};

export const summarizeSelectorDiagnostic = ({ selectors, localSelectableDiagnostic } = {}) => {
  const localReason = normalizeText(localSelectableDiagnostic?.reason);
  if (localSelectableDiagnostic?.status === 'rejected' && localReason === 'local_exact_match_missing') {
    const fields = Object.fromEntries(
      SELECTOR_FIELDS.map((field) => [
        field,
        {
          status: 'not_verified',
          verdict: 'not_verified',
          reason: 'local_exact_match_missing',
          exists: false,
          disabled: false,
          optionCount: 0,
          targetMatch: false,
          accepted: false,
        },
      ]),
    );
    return {
      status: 'not_verified',
      verdict: 'not_verified',
      accepted: false,
      reason: 'local_exact_match_missing',
      fields,
      selectorOptionCount: 0,
      selectorOptionCounts: Object.fromEntries(SELECTOR_FIELDS.map((field) => [field, 0])),
      selectorTargetMatch: false,
      selectorTargetMatches: Object.fromEntries(SELECTOR_FIELDS.map((field) => [field, false])),
      rawSensitiveFieldsExcluded: true,
    };
  }

  const fields = Object.fromEntries(
    SELECTOR_FIELDS.map((field) => [field, selectorItemDiagnostic(selectors?.[field])]),
  );
  const values = Object.values(fields);
  const selectorOptionCounts = Object.fromEntries(
    Object.entries(fields).map(([field, item]) => [field, item.optionCount]),
  );
  const selectorTargetMatches = Object.fromEntries(
    Object.entries(fields).map(([field, item]) => [field, item.targetMatch === true]),
  );
  const status = values.every((item) => item.status === 'accepted')
    ? 'accepted'
    : values.some((item) => item.status === 'not_verified')
      ? 'not_verified'
      : 'rejected';
  const failed = values.find((item) => item.status !== 'accepted');
  return {
    status,
    verdict: status,
    accepted: status === 'accepted',
    reason: failed?.reason ?? 'none',
    fields,
    selectorOptionCount: values.reduce((sum, item) => sum + item.optionCount, 0),
    selectorOptionCounts,
    selectorTargetMatch: values.every((item) => item.targetMatch === true),
    selectorTargetMatches,
    rawSensitiveFieldsExcluded: true,
  };
};

const readinessDimension = (ready, reason = '') => ({
  ready: ready === true,
  reason: ready === true ? 'none' : reason || 'not_ready',
});

export const summarizeMedicalInformationReadiness = ({
  patientId,
  departmentCode,
  physicianCode,
  paymentMode,
  visitKind,
  medicalInformation,
  medicalInformationState,
  medicalInformationProbe,
  selectorDiagnostic,
  localSelectableDiagnostic,
} = {}) => {
  const expectedState = normalizeText(medicalInformation) ? 'selected' : 'omitted';
  const observedState = normalizeText(medicalInformationState?.state) || expectedState;
  const selectorFields = selectorDiagnostic?.fields ?? {};
  const departmentReady = selectorFields.department?.status === 'accepted';
  const physicianReady = selectorFields.physician?.status === 'accepted';
  const paymentReady = selectorFields.paymentMode?.status === 'accepted';
  const visitKindReady = selectorFields.visitKind?.status === 'accepted';
  const medicalSelectorReady = selectorFields.medicalInformation?.status === 'accepted';
  const medicalProbeReady = medicalInformationProbe?.accepted === true || medicalInformationProbe?.verdict === 'accepted';
  const medicalInformationInputReady = medicalProbeReady && medicalSelectorReady;
  const medicalInformationOmittedStateMatches =
    expectedState === observedState &&
    (expectedState === 'selected' || normalizeText(medicalInformationState?.value) === '');
  const requiredIdentityFieldsMatch = Boolean(
    normalizePatientId(patientId) &&
      normalizeText(departmentCode) &&
      normalizeText(physicianCode) &&
      normalizeText(paymentMode) &&
      normalizeText(visitKind) &&
      medicalInformationOmittedStateMatches &&
      localSelectableDiagnostic?.status === 'accepted',
  );
  const dimensions = {
    department_ready: readinessDimension(departmentReady, selectorFields.department?.reason),
    physician_ready: readinessDimension(physicianReady, selectorFields.physician?.reason),
    payment_ready: readinessDimension(paymentReady, selectorFields.paymentMode?.reason),
    visitKind_ready: readinessDimension(visitKindReady, selectorFields.visitKind?.reason),
    medicalInformation_input_ready: readinessDimension(
      medicalInformationInputReady,
      medicalProbeReady ? selectorFields.medicalInformation?.reason : 'medical_information_probe_not_accepted',
    ),
    medicalInformation_omitted_state_matches: readinessDimension(
      medicalInformationOmittedStateMatches,
      'medical_information_omitted_state_mismatch',
    ),
    required_identity_fields_match: readinessDimension(requiredIdentityFieldsMatch, 'required_identity_fields_missing_or_unmatched'),
  };
  const failedSubdimensions = Object.entries(dimensions)
    .filter(([, value]) => value.ready !== true)
    .map(([key]) => key);
  return {
    status: failedSubdimensions.length === 0 ? 'accepted' : selectorDiagnostic?.status === 'not_verified' ? 'not_verified' : 'rejected',
    verdict: failedSubdimensions.length === 0 ? 'accepted' : selectorDiagnostic?.status === 'not_verified' ? 'not_verified' : 'rejected',
    accepted: failedSubdimensions.length === 0,
    reason: failedSubdimensions.length === 0 ? 'none' : 'medical_information_not_ready',
    failedSubdimensions,
    dimensions,
    expectedMedicalInformationState: expectedState,
    observedMedicalInformationState: observedState,
    rawSensitiveFieldsExcluded: true,
  };
};

const pushUniqueReason = (reasons, reason) => {
  const normalized = normalizeText(reason);
  if (!normalized || normalized === 'none') return;
  if (!reasons.includes(normalized)) reasons.push(normalized);
};

const localSelectableAccepted = (localSelectable) =>
  localSelectable?.accepted === true ||
  localSelectable?.selectable === true ||
  localSelectable?.verdict === 'accepted' ||
  localSelectable?.status === 'accepted';

const selectorAccepted = (selector) =>
  selector?.accepted === true || selector?.verdict === 'accepted' || selector?.status === 'accepted';

export const collectCandidateRejectionReasons = ({
  officialPatientExistence,
  insuranceReadiness,
  appointmentDependency,
  localSelectable,
  localSelectableReadiness,
  selectorReadiness,
  medicalInformationProbe,
  medicalInformationReadiness,
  diagnosticNoPatientNotFound,
  mutationProhibited,
} = {}) => {
  const reasons = [];
  const localSelectableDiagnostic = localSelectableReadiness ?? localSelectable;

  if (officialPatientExistence?.accepted !== true) {
    pushUniqueReason(reasons, officialPatientExistence?.rejectionReason || 'official_patient_missing');
  }

  if (insuranceReadiness?.accepted !== true) {
    pushUniqueReason(reasons, insuranceReadiness?.classification || insuranceReadiness?.reason || 'insurance_not_ready');
  }

  if (appointmentDependency?.accepted !== true) {
    pushUniqueReason(
      reasons,
      appointmentDependency?.classification || appointmentDependency?.reason || 'appointment_dependency_not_ready',
    );
  }

  if (!localSelectableAccepted(localSelectableDiagnostic)) {
    pushUniqueReason(reasons, localSelectableDiagnostic?.reason || 'local_selectable_not_ready');
  }

  if (!selectorAccepted(selectorReadiness)) {
    pushUniqueReason(reasons, selectorReadiness?.reason || 'selector_not_ready');
  }

  if (medicalInformationProbe && medicalInformationProbe.accepted !== true) {
    pushUniqueReason(reasons, 'medical_information_probe_not_accepted');
  }

  if (medicalInformationReadiness?.accepted !== true) {
    const failed = Array.isArray(medicalInformationReadiness?.failedSubdimensions)
      ? medicalInformationReadiness.failedSubdimensions.filter(Boolean)
      : [];
    pushUniqueReason(
      reasons,
      failed.length > 0 ? `medical_information_not_ready:${failed.join(',')}` : 'medical_information_not_ready',
    );
  }

  if (diagnosticNoPatientNotFound && diagnosticNoPatientNotFound.accepted !== true) {
    pushUniqueReason(reasons, 'patient_not_found_wording_detected');
  }

  if (Number(mutationProhibited?.blockedRequestCount ?? 0) > 0) {
    pushUniqueReason(reasons, 'readonly_mutation_attempt_blocked');
  }

  return reasons;
};

export const buildCandidateReadinessDecision = (readiness) => {
  const rejectionReasons = collectCandidateRejectionReasons(readiness);
  const acceptedForExactPreflightProposal = rejectionReasons.length === 0;
  return {
    acceptedForExactPreflightProposal,
    primaryRejectionReason: acceptedForExactPreflightProposal ? 'none' : rejectionReasons[0],
    rejectionReasons,
  };
};

export const classifyAcceptmodReadOnlyDiagnostic = ({
  executed,
  httpStatus,
  apiResult,
  body,
  parsedOrcaBody,
  diagnosticBodyParseSucceeded,
  wrapperError,
  upstreamError,
  errors,
  errorCategory,
}) => {
  if (!executed) {
    return {
      executed: false,
      apiResult: '',
      classification: 'not_verified',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
    };
  }
  const status = asFiniteStatus(httpStatus);
  const normalized = normalizeApiResult(
    apiResult ?? body?.apiResult ?? body?.Api_Result ?? findFirstDeep(body, ['apiResult', 'Api_Result', 'result', 'Result']),
  );
  const parseStateProvided = parsedOrcaBody !== undefined || diagnosticBodyParseSucceeded !== undefined;
  const bodyPresent = isRecord(body) === true;
  const diagnosticBodyParsed = parseStateProvided
    ? (parsedOrcaBody === true || diagnosticBodyParseSucceeded === true) && bodyPresent
    : bodyPresent;
  const wrapperRejected =
    hasWrapperError(body) ||
    hasWrapperError({
      wrapperError,
      upstreamError,
      errors,
      errorCategory,
    });
  const acceptedDiagnosticTransport = is2xx(status) && !wrapperRejected && diagnosticBodyParsed;
  const rejectionReason =
    wrapperRejected
      ? 'wrapper_or_upstream_error'
      : !is2xx(status)
        ? 'http_not_2xx'
        : !diagnosticBodyParsed
          ? 'orca_body_not_parsed'
          : 'none';
  if (normalized === '10') {
    return {
      executed: true,
      httpStatus: status,
      apiResult: normalized,
      classification: 'patient_not_found',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason,
    };
  }
  if (normalized === '60') {
    const acceptedForPhase3Attempt = acceptedDiagnosticTransport;
    return {
      executed: true,
      httpStatus: status,
      apiResult: normalized,
      classification: 'diagnostic_no_existing_acceptance',
      accepted: acceptedForPhase3Attempt,
      acceptedForPhase3Attempt,
      mutationSuccess: false,
      rejectionReason,
    };
  }
  if (acceptedDiagnosticTransport && isAllZeroApiResult(normalized)) {
    return {
      executed: true,
      httpStatus: status,
      apiResult: normalized,
      classification: 'diagnostic_existing_acceptance',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason: 'existing_acceptance',
    };
  }
  return {
    executed: true,
    httpStatus: status,
    apiResult: normalized,
    classification: 'not_verified',
    accepted: false,
    acceptedForPhase3Attempt: false,
    mutationSuccess: false,
    rejectionReason,
  };
};

export const buildCandidateDiscoveryGate = ({
  candidateCount,
  acceptedCandidateCount,
  blockedRequestCount = 0,
  selectedCandidate = null,
}) => {
  const acceptedCount = Number(acceptedCandidateCount ?? 0);
  const blockedCount = Number(blockedRequestCount ?? 0);
  const readonlyMutationBlocked = blockedCount > 0;
  const hasProposal = acceptedCount > 0 && selectedCandidate;
  const releaseVerdict = readonlyMutationBlocked
    ? CANDIDATE_DISCOVERY_RELEASE_VERDICTS.readonlyMutationBlocked
    : hasProposal
      ? CANDIDATE_DISCOVERY_RELEASE_VERDICTS.exactPreflightRequired
      : CANDIDATE_DISCOVERY_RELEASE_VERDICTS.readinessBlocker;
  const blockerClassification = readonlyMutationBlocked
    ? 'readonly-mutation-blocker'
    : hasProposal
      ? 'candidate_discovery_only'
      : 'test-data-or-harness-readiness-blocker';
  const blockerReason = readonlyMutationBlocked
    ? 'readonly_mutation_attempt_blocked'
    : hasProposal
      ? 'exact_selected_candidate_preflight_required'
      : 'phase3_mutation_ready_readonly_evidence_missing';
  return {
    candidateDiscoveryAloneAuthorizesPhase3: false,
    acceptedForPhase3Attempt: false,
    phase3AttemptPatientId: null,
    releaseVerdict,
    verdict: 'partial',
    blockerClassification,
    blockerReason,
    mutationPolicy: {
      prohibited: true,
      blockedRequestCount: blockedCount,
    },
    exactSelectedCandidatePreflight: {
      ran: false,
      reason: hasProposal ? 'exact_selected_candidate_preflight_required' : 'phase3_mutation_ready_readonly_evidence_missing',
    },
    phase3: {
      ran: false,
      reason: hasProposal ? 'exact_selected_candidate_preflight_required' : 'phase3_mutation_ready_readonly_evidence_missing',
    },
    phase4: { ran: false, reason: 'phase3_not_run' },
    candidateDiscovery: {
      candidateCount: Number(candidateCount ?? 0),
      acceptedCandidateCount: acceptedCount,
    },
  };
};

export const buildReadinessRejectionReasons = ({
  medicalInformationProbe,
  medicalInformationReadiness,
  officialPatientExistence,
  insuranceReadiness,
  appointmentDependency,
  localSelectableReadiness,
  selectorReadiness,
  diagnosticNoPatientNotFound,
  mutationProhibited,
} = {}) => {
  const reasons = [];
  const push = (dimension, reason, details = {}) => {
    const normalizedReason = normalizeText(reason) || 'not_ready';
    if (normalizedReason === 'none') return;
    reasons.push({
      dimension,
      reason: normalizedReason,
      ...details,
    });
  };

  if (officialPatientExistence && officialPatientExistence.accepted !== true) {
    push('official_patient', officialPatientExistence.rejectionReason ?? 'official_patient_missing', {
      verdict: officialPatientExistence.verdict ?? 'rejected',
      apiResult: normalizeApiResult(officialPatientExistence.apiResult),
    });
  }
  if (insuranceReadiness && insuranceReadiness.accepted !== true) {
    push('insurance', insuranceReadiness.classification ?? 'insurance_not_ready', {
      verdict: insuranceReadiness.verdict ?? 'rejected',
      apiResult: normalizeApiResult(insuranceReadiness.apiResult),
      classification: insuranceReadiness.classification ?? 'unknown',
    });
  }
  if (appointmentDependency && appointmentDependency.accepted !== true && appointmentDependency.verdict !== 'accepted') {
    push('appointment', appointmentDependency.classification ?? 'appointment_dependency_not_ready', {
      verdict: appointmentDependency.verdict ?? 'rejected',
      apiResult: normalizeApiResult(appointmentDependency.apiResult),
      classification: appointmentDependency.classification ?? 'unknown',
      flowMode: appointmentDependency.flowMode ?? 'unknown',
    });
  }
  const localStatus = localSelectableReadiness?.status ?? localSelectableReadiness?.verdict;
  if (localSelectableReadiness && localSelectableReadiness.accepted !== true && localSelectableReadiness.selectable !== true) {
    push('local_selectable', localSelectableReadiness.reason ?? 'local_selectable_not_ready', {
      verdict: localStatus ?? 'rejected',
    });
  }
  if (selectorReadiness && selectorReadiness.accepted !== true && selectorReadiness.verdict !== 'accepted') {
    push('selector', selectorReadiness.reason ?? 'selector_not_ready', {
      verdict: selectorReadiness.verdict ?? selectorReadiness.status ?? 'rejected',
    });
  }
  if (medicalInformationProbe && medicalInformationProbe.accepted !== true && medicalInformationProbe.verdict !== 'accepted') {
    push('medical_information_probe', 'medical_information_probe_not_accepted', {
      verdict: medicalInformationProbe.verdict ?? 'rejected',
      apiResult: normalizeApiResult(medicalInformationProbe.apiResult),
    });
  }
  if (medicalInformationReadiness && medicalInformationReadiness.accepted !== true) {
    push('medical_information', medicalInformationReadiness.reason ?? 'medical_information_not_ready', {
      verdict: medicalInformationReadiness.verdict ?? medicalInformationReadiness.status ?? 'rejected',
      failedSubdimensions: medicalInformationReadiness.failedSubdimensions ?? [],
    });
  }
  if (diagnosticNoPatientNotFound && diagnosticNoPatientNotFound.accepted !== true) {
    push('diagnostic_no_patient_not_found', 'patient_not_found_wording_detected', {
      verdict: diagnosticNoPatientNotFound.verdict ?? 'rejected',
    });
  }
  if (Number(mutationProhibited?.blockedRequestCount ?? 0) > 0) {
    push('mutation_policy', 'readonly_mutation_attempt_blocked', {
      verdict: mutationProhibited?.verdict ?? 'rejected',
      blockedRequestCount: Number(mutationProhibited?.blockedRequestCount ?? 0),
    });
  }
  return reasons;
};

export const primaryReadinessRejectionReason = (rejectionReasons) =>
  Array.isArray(rejectionReasons) && rejectionReasons.length > 0 ? rejectionReasons[0].reason : 'none';

export const evaluatePreflightSummary = (summary) => {
  if (isRejectedTrialCandidate(summary?.candidateId)) return 'rejected_candidate';
  if (!summary?.officialPatientExistence?.accepted) return 'official_patient_missing';
  if (!summary?.insuranceReadiness?.accepted) {
    if (summary?.insuranceReadiness?.classification === 'ambiguous_readiness_failure') return 'ambiguous_readiness_failure';
    if (summary?.insuranceReadiness?.classification === 'request_contract_rejected') return 'request_contract_rejected';
    if (summary?.insuranceReadiness?.classification === 'unknown_nonzero') return 'unknown_nonzero';
    return 'insurance_missing';
  }
  if (!summary?.selectorReadiness?.accepted) return 'selector_missing';
  if (!summary?.localSelectableReadiness?.accepted) return 'local_selectable_missing';
  if (summary?.appointmentDependency?.classification === 'ambiguous_readiness_failure') return 'ambiguous_readiness_failure';
  if (summary?.appointmentDependency?.classification === 'request_contract_rejected') return 'request_contract_rejected';
  if (summary?.appointmentDependency?.classification === 'unknown_nonzero') return 'unknown_nonzero';
  if (summary?.appointmentDependency?.verdict === 'rejected' || summary?.appointmentDependency?.accepted === false) {
    if (summary?.appointmentDependency?.classification === 'appointment_row_missing') return 'appointment_row_missing';
    if (summary?.appointmentDependency?.classification === 'appointment_absent') return 'appointment_absent';
    return summary?.appointmentDependency?.classification ?? 'appointment_dependency_not_ready';
  }
  if (summary?.acceptmodv2ReadOnlyDiagnostic?.classification === 'patient_not_found') return 'diagnostic_patient_not_found';
  if (summary?.secretScanClean === false) return 'secret_scan_failed';
  return 'none';
};

export const buildInputIdentity = ({
  patientId,
  departmentCode,
  physicianCode,
  paymentMode,
  visitKind,
  medicalInformation,
  insuranceReadiness,
  officialPatientExistence,
  localSelectableReadiness,
}) => ({
  patientId,
  departmentCode,
  physicianCode,
  paymentMode,
  visitKind,
  medicalInformationState: normalizeText(medicalInformation) ? 'selected' : 'omitted',
  medicalInformationHash: normalizeText(medicalInformation) ? hash(normalizeText(medicalInformation)) : undefined,
  insuranceReadinessHash: insuranceReadiness?.selectedCombinationHash,
  officialPatientEvidenceHash: officialPatientExistence?.evidenceHash,
  localSelectableEvidenceHash: localSelectableReadiness?.evidenceHash,
});

export const verifyAcceptmodInputIdentity = ({ preflightSummary, current }) => {
  if (!preflightSummary?.acceptedForPhase3Attempt) {
    return `preflight_not_accepted:${preflightSummary?.blockerClassification ?? 'unknown'}`;
  }
  if (preflightSummary.runId !== current.runId) return `runId_mismatch:${preflightSummary.runId ?? 'none'}:${current.runId}`;
  const expected = preflightSummary.inputIdentity ?? {};
  for (const key of ['patientId', 'departmentCode', 'physicianCode', 'paymentMode', 'visitKind', 'medicalInformationState']) {
    if ((expected[key] ?? '') !== (current[key] ?? '')) {
      return `input_identity_mismatch:${key}`;
    }
  }
  return 'none';
};
