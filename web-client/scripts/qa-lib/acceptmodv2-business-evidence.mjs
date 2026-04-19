const REDACTED = '<<redacted>>';

const SENSITIVE_HEADER_PATTERN = /^(authorization|cookie|set-cookie|x-csrf-token|csrf-token|username|password)$/i;
const SENSITIVE_QUERY_PATTERN = /auth|token|password|passwd|cookie|session|jsessionid|csrf/i;

const sortKeys = (values) => [...new Set(values.filter(Boolean))].sort();

export const redactText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value)
    .replace(/(Authorization|Cookie|Set-Cookie|JSESSIONID|password|passwd|token|csrf)[=:]\s*([^&\s;]+)/gi, `$1=${REDACTED}`)
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, REDACTED)
    .replace(/\b\d{4,}\b/g, REDACTED);
};

export const redactHeaders = (headers) => {
  const out = { ...(headers ?? {}) };
  for (const key of Object.keys(out)) {
    if (SENSITIVE_HEADER_PATTERN.test(key)) {
      out[key] = REDACTED;
    }
  }
  return out;
};

export const redactUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.username) url.username = 'redacted';
    if (url.password) url.password = 'redacted';
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PATTERN.test(key)) {
        url.searchParams.set(key, REDACTED);
      }
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return redactText(value);
  }
};

const redactJsonValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactJsonValue(child)]));
  }
  return REDACTED;
};

export const redactBody = (body) => {
  if (body === undefined || body === null || body === '') {
    return '';
  }
  const raw = String(body);
  try {
    return JSON.stringify(redactJsonValue(JSON.parse(raw)));
  } catch {
    return REDACTED;
  }
};

export const sanitizeNetworkRecord = (record) => ({
  url: redactUrl(record?.url ?? ''),
  status: record?.status ?? 0,
  statusText: redactText(record?.statusText ?? ''),
  request: {
    method: record?.request?.method ?? record?.method ?? '',
    headers: redactHeaders(record?.request?.headers ?? record?.headers ?? {}),
    postData: redactBody(record?.request?.postData ?? record?.postData ?? ''),
  },
  response: {
    headers: redactHeaders(record?.response?.headers ?? {}),
    body: redactBody(record?.response?.body ?? ''),
  },
});

export const sanitizeRequestRecord = (record) => ({
  url: redactUrl(record?.url ?? ''),
  method: record?.method ?? '',
  headers: redactHeaders(record?.headers ?? {}),
  postData: redactBody(record?.postData ?? ''),
});

export const classifyBusinessResult = ({ httpStatus, apiResult, businessStatus }) => {
  const normalizedApiResult = String(apiResult ?? '').trim().toUpperCase();
  const statusAccepted = businessStatus === 'businessAccepted' || businessStatus === 'businessAcceptedWithWarnings';
  const businessAccepted = statusAccepted;
  if (!httpStatus) {
    return {
      responseClassification: 'notObserved',
      businessAccepted: false,
      businessRejected: false,
    };
  }
  if (httpStatus >= 500) {
    return {
      responseClassification: 'transportRejected',
      businessAccepted: false,
      businessRejected: false,
    };
  }
  if (businessAccepted) {
    return {
      responseClassification: businessStatus === 'businessAcceptedWithWarnings' ? 'businessAcceptedWithWarnings' : 'businessAccepted',
      businessAccepted: true,
      businessAcceptedWithWarnings: businessStatus === 'businessAcceptedWithWarnings',
      businessRejected: false,
    };
  }
  if (businessStatus === 'diagnosticNoExistingAcceptance') {
    return {
      responseClassification: 'diagnosticNoExistingAcceptance',
      businessAccepted: false,
      businessAcceptedWithWarnings: false,
      businessRejected: false,
    };
  }
  if (businessStatus === 'notVerified' || normalizedApiResult === '') {
    return {
      responseClassification: 'notVerified',
      businessAccepted: false,
      businessAcceptedWithWarnings: false,
      businessRejected: false,
    };
  }
  return {
    responseClassification: 'businessRejected',
    businessAccepted: false,
    businessAcceptedWithWarnings: false,
    businessRejected: true,
  };
};

export const buildSanitizedAcceptmodv2Summary = ({
  runId,
  candidateId,
  preflightPath,
  preflightSha256,
  command,
  cwd,
  startTime,
  endTime,
  exitCode,
  acceptResponse,
  medicalInformationGate,
  patientIdMatched,
}) => {
  const httpStatus = acceptResponse?.status ?? null;
  const apiResult = acceptResponse?.apiResult ?? '';
  const acceptanceIdPresent = Boolean(acceptResponse?.acceptanceId);
  const business = classifyBusinessResult({
    httpStatus,
    apiResult,
    businessStatus: acceptResponse?.businessStatus,
  });
  const c7Pass = medicalInformationGate?.ok === true;
  const rejectionReason = business.businessRejected
    ? redactText(acceptResponse?.apiResultMessage || `apiResult=${apiResult || 'unknown'}`)
    : '';

  return {
    schemaVersion: 1,
    runId,
    candidateId,
    preflight: {
      path: preflightPath || '',
      sha256: preflightSha256 || '',
    },
    command,
    cwd,
    startTime,
    endTime,
    exitCode,
    httpStatus,
    apiResult,
    sanitizedMessage: redactText(acceptResponse?.apiResultMessage ?? ''),
    responseClassification: business.responseClassification,
    business: {
      businessAccepted: business.businessAccepted,
      businessAcceptedWithWarnings: business.businessAcceptedWithWarnings === true,
      businessRejected: business.businessRejected,
      diagnosticNoExistingAcceptance: acceptResponse?.businessStatus === 'diagnosticNoExistingAcceptance',
      notVerified: business.responseClassification === 'notVerified',
      c7GateObserved: c7Pass,
    },
    rejectionReason,
    acceptanceIdPresent,
    patientIdMatched,
    c7: {
      ok: c7Pass,
      targetMutationRequestCount: medicalInformationGate?.targetMutationRequestCount ?? 0,
      checkedRequests: medicalInformationGate?.checkedRequests ?? 0,
      violationCount: medicalInformationGate?.violationCount ?? 0,
      violatedKeys: sortKeys(medicalInformationGate?.violatedKeys ?? []),
      bodyKeysObserved: sortKeys(medicalInformationGate?.bodyKeysObserved ?? []),
      medicalInformationFieldPresent: Boolean(medicalInformationGate?.medicalInformationFieldPresent),
      unspecifiedRun: Boolean(medicalInformationGate?.unspecifiedRun),
    },
    secretScanScope: [
      'acceptmodv2-summary',
      'request-headers',
      'response-headers',
      'request-body-values',
      'response-body-values',
      'urls',
      'messages',
    ],
    rawSensitiveFieldsExcluded: true,
  };
};
