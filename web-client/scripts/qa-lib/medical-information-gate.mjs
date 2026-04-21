const TARGET_MUTATION_PATH = '/api/orca/official/visits/mutation';

const MEDICAL_INFORMATION_KEYS = new Set(['medicalInformation', 'Medical_Information']);
const REQUEST_NUMBER_KEYS = new Set(['requestNumber', 'Request_Number']);
const PATIENT_ID_KEYS = new Set(['patientId', 'Patient_ID']);
const CANDIDATE_ID_KEYS = new Set(['candidateId', 'candidate', 'Candidate_ID']);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort();

const normalizeScalar = (value) => (typeof value === 'string' ? value.trim() : '');

const isValidScalar = (value) => typeof value === 'string';

const valueMatches = (value, expectedValue) =>
  isValidScalar(value) && normalizeScalar(value) === expectedValue;

const inspectPayload = (postData) => {
  const bodyKeysObserved = new Set();
  const medicalInformationKeysObserved = new Set();
  const requestNumberKeysObserved = new Set();
  const patientIdKeysObserved = new Set();
  const candidateIdKeysObserved = new Set();
  const requestNumberValues = [];
  const patientIdValues = [];
  const candidateIdValues = [];

  if (typeof postData !== 'string' || postData.length === 0) {
    return {
      bodyKeysObserved: [],
      medicalInformationFieldPresent: false,
      medicalInformationKeysObserved: [],
      parseOk: false,
      requestNumberFieldPresent: false,
      requestNumberKeysObserved: [],
      requestNumberValues: [],
      patientIdFieldPresent: false,
      patientIdKeysObserved: [],
      patientIdValues: [],
      candidateIdFieldPresent: false,
      candidateIdKeysObserved: [],
      candidateIdValues: [],
    };
  }

  try {
    const parsed = JSON.parse(postData);
    const stack = [parsed];
    while (stack.length > 0) {
      const current = stack.pop();
      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }
      if (!current || typeof current !== 'object') {
        continue;
      }
      for (const [key, value] of Object.entries(current)) {
        bodyKeysObserved.add(key);
        if (MEDICAL_INFORMATION_KEYS.has(key)) {
          medicalInformationKeysObserved.add(key);
        }
        if (REQUEST_NUMBER_KEYS.has(key)) {
          requestNumberKeysObserved.add(key);
          requestNumberValues.push(value);
        }
        if (PATIENT_ID_KEYS.has(key)) {
          patientIdKeysObserved.add(key);
          patientIdValues.push(value);
        }
        if (CANDIDATE_ID_KEYS.has(key)) {
          candidateIdKeysObserved.add(key);
          candidateIdValues.push(value);
        }
        if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }
    const keys = uniqueSorted([...bodyKeysObserved]);
    const medicalKeys = uniqueSorted([...medicalInformationKeysObserved]);
    const requestNumberKeys = uniqueSorted([...requestNumberKeysObserved]);
    const patientIdKeys = uniqueSorted([...patientIdKeysObserved]);
    const candidateIdKeys = uniqueSorted([...candidateIdKeysObserved]);
    return {
      bodyKeysObserved: keys,
      medicalInformationFieldPresent: medicalKeys.length > 0,
      medicalInformationKeysObserved: medicalKeys,
      parseOk: true,
      requestNumberFieldPresent: requestNumberKeys.length > 0,
      requestNumberKeysObserved: requestNumberKeys,
      requestNumberValues,
      patientIdFieldPresent: patientIdKeys.length > 0,
      patientIdKeysObserved: patientIdKeys,
      patientIdValues,
      candidateIdFieldPresent: candidateIdKeys.length > 0,
      candidateIdKeysObserved: candidateIdKeys,
      candidateIdValues,
    };
  } catch {
    for (const match of postData.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g)) {
      const key = match[1];
      bodyKeysObserved.add(key);
      if (MEDICAL_INFORMATION_KEYS.has(key)) {
        medicalInformationKeysObserved.add(key);
      }
      if (REQUEST_NUMBER_KEYS.has(key)) {
        requestNumberKeysObserved.add(key);
        const valueMatch = postData
          .slice(match.index ?? 0)
          .match(/^"[^"\\]*(?:\\.[^"\\]*)*"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        requestNumberValues.push(valueMatch ? valueMatch[1] : undefined);
      }
      if (PATIENT_ID_KEYS.has(key)) {
        patientIdKeysObserved.add(key);
        const valueMatch = postData
          .slice(match.index ?? 0)
          .match(/^"[^"\\]*(?:\\.[^"\\]*)*"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        patientIdValues.push(valueMatch ? valueMatch[1] : undefined);
      }
      if (CANDIDATE_ID_KEYS.has(key)) {
        candidateIdKeysObserved.add(key);
        const valueMatch = postData
          .slice(match.index ?? 0)
          .match(/^"[^"\\]*(?:\\.[^"\\]*)*"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        candidateIdValues.push(valueMatch ? valueMatch[1] : undefined);
      }
    }
  }

  const keys = uniqueSorted([...bodyKeysObserved]);
  const medicalKeys = uniqueSorted([...medicalInformationKeysObserved]);
  const requestNumberKeys = uniqueSorted([...requestNumberKeysObserved]);
  const patientIdKeys = uniqueSorted([...patientIdKeysObserved]);
  const candidateIdKeys = uniqueSorted([...candidateIdKeysObserved]);
  return {
    bodyKeysObserved: keys,
    medicalInformationFieldPresent: medicalKeys.length > 0,
    medicalInformationKeysObserved: medicalKeys,
    parseOk: false,
    requestNumberFieldPresent: requestNumberKeys.length > 0,
    requestNumberKeysObserved: requestNumberKeys,
    requestNumberValues,
    patientIdFieldPresent: patientIdKeys.length > 0,
    patientIdKeysObserved: patientIdKeys,
    patientIdValues,
    candidateIdFieldPresent: candidateIdKeys.length > 0,
    candidateIdKeysObserved: candidateIdKeys,
    candidateIdValues,
  };
};

const walkPayload = (postData, visitor, fallbackVisitor) => {
  if (typeof postData !== 'string' || postData.length === 0) {
    return false;
  }

  try {
    const parsed = JSON.parse(postData);
    const stack = [parsed];
    while (stack.length > 0) {
      const current = stack.pop();
      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }
      if (!current || typeof current !== 'object') {
        continue;
      }
      for (const [key, value] of Object.entries(current)) {
        if (MEDICAL_INFORMATION_KEYS.has(key) && visitor(value)) {
          return true;
        }
        if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }
    return false;
  } catch {
    return fallbackVisitor(postData);
  }
};

const hasMedicalInformationField = (postData) =>
  walkPayload(postData, () => true, (raw) => /"(?:medicalInformation|Medical_Information)"\s*:/.test(raw));

const hasMatchingMedicalInformationValue = (postData, expectedValue) =>
  walkPayload(
    postData,
    (value) => typeof value === 'string' && value.trim() === expectedValue,
    (raw) =>
      new RegExp(
        `"(?:(?:medicalInformation)|(?:Medical_Information))"\\s*:\\s*"${escapeRegExp(expectedValue)}"`,
      ).test(raw),
  );

export const evaluateMedicalInformationGate = ({
  requestRecords,
  medicalInformation,
  expectedRequestNumber = '01',
  expectedPatientId = '00001',
  expectedCandidateId = '00001',
  targetPath = TARGET_MUTATION_PATH,
}) => {
  const normalizedSelection = typeof medicalInformation === 'string' ? medicalInformation.trim() : '';
  const mutationRequests = Array.isArray(requestRecords)
    ? requestRecords.filter((record) =>
        record
        && typeof record.url === 'string'
        && record.url.includes(targetPath)
        && typeof record.postData === 'string')
    : [];
  const mutationInspections = mutationRequests.map((record) => inspectPayload(record.postData));
  const bodyKeysObserved = uniqueSorted(mutationInspections.flatMap((inspection) => inspection.bodyKeysObserved));
  const observedMedicalInformationKeys = uniqueSorted(
    mutationInspections.flatMap((inspection) => inspection.medicalInformationKeysObserved),
  );
  const observedRequestNumberKeys = uniqueSorted(
    mutationInspections.flatMap((inspection) => inspection.requestNumberKeysObserved),
  );
  const observedPatientIdKeys = uniqueSorted(
    mutationInspections.flatMap((inspection) => inspection.patientIdKeysObserved),
  );
  const observedCandidateIdKeys = uniqueSorted(
    mutationInspections.flatMap((inspection) => inspection.candidateIdKeysObserved),
  );
  const medicalInformationFieldPresent = mutationInspections.some((inspection) => inspection.medicalInformationFieldPresent);
  const requestNumberFieldPresent = mutationInspections.some((inspection) => inspection.requestNumberFieldPresent);
  const requestNumberValues = mutationInspections.flatMap((inspection) => inspection.requestNumberValues);
  const requestNumber01ValueVerified =
    mutationRequests.length === 1 &&
    requestNumberValues.length === 1 &&
    valueMatches(requestNumberValues[0], expectedRequestNumber);
  const requestNumber02_03_04Absent = !requestNumberValues.some((value) =>
    ['02', '03', '04'].includes(normalizeScalar(value)),
  );
  const targetPatientId00001Verified =
    mutationRequests.length === 1 &&
    mutationInspections.every((inspection) =>
      inspection.patientIdFieldPresent &&
      inspection.patientIdValues.length === 1 &&
      valueMatches(inspection.patientIdValues[0], expectedPatientId),
    );
  const targetCandidateOnly00001 =
    mutationRequests.length === 1 &&
    mutationInspections.every((inspection) =>
      !inspection.candidateIdFieldPresent ||
      (
        inspection.candidateIdValues.length === 1 &&
        valueMatches(inspection.candidateIdValues[0], expectedCandidateId)
      ),
    );
  const baseResult = {
    enforced: true,
    targetMutationRequestCount: mutationRequests.length,
    checkedRequests: mutationRequests.length,
    bodyKeysObserved,
    medicalInformationFieldPresent,
    intendedRequestNumber01: expectedRequestNumber === '01',
    requestNumberKeyPresent: requestNumberFieldPresent,
    requestNumberKeysObserved: observedRequestNumberKeys,
    requestNumber01ValueVerified,
    requestNumber02_03_04Absent,
    targetPatientId00001Verified,
    targetCandidateOnly00001,
    patientIdKeysObserved: observedPatientIdKeys,
    candidateIdKeysObserved: observedCandidateIdKeys,
    unspecifiedRun: !normalizedSelection,
  };

  if (mutationRequests.length === 0) {
    return {
      ...baseResult,
      ok: false,
      violation: 'C7',
      checkedRequests: 0,
      violationCount: 1,
      violatedKeys: ['targetMutationRequest'],
      violatingUrls: [],
      error: 'visits mutation browser request body を 1 件も捕捉できませんでした。target mutation request は必須です。',
    };
  }

  if (mutationRequests.length > 1) {
    return {
      ...baseResult,
      ok: false,
      violation: 'C7',
      violationCount: mutationRequests.length,
      violatedKeys: ['targetMutationRequest'],
      violatingUrls: mutationRequests.map((record) => record.url),
      error: 'visits mutation browser request body は 1 件だけ捕捉される必要があります。複数の mutation request は Phase 3 success evidence にできません。',
    };
  }

  if (mutationInspections.some((inspection) => inspection.parseOk !== true)) {
    return {
      ...baseResult,
      ok: false,
      violation: 'C7',
      violationCount: 1,
      violatedKeys: ['rawBodyDecisionRequired'],
      violatingUrls: mutationRequests.map((record) => record.url),
      error: 'visits mutation browser request body は parsed sanitized fields だけで判定できる必要があります。malformed body は Phase 3 success evidence にできません。',
    };
  }

  if (!requestNumber01ValueVerified) {
    return {
      ...baseResult,
      ok: false,
      violation: 'C7',
      violationCount: 1,
      violatedKeys: observedRequestNumberKeys.length > 0 ? observedRequestNumberKeys : ['requestNumber'],
      violatingUrls: mutationRequests.map((record) => record.url),
      error: `visits mutation browser request body の Request_Number/requestNumber は厳密に ${expectedRequestNumber} である必要があります。`,
    };
  }

  if (!requestNumber02_03_04Absent) {
    return {
      ...baseResult,
      ok: false,
      violation: 'C7',
      violationCount: 1,
      violatedKeys: observedRequestNumberKeys.length > 0 ? observedRequestNumberKeys : ['requestNumber'],
      violatingUrls: mutationRequests.map((record) => record.url),
      error: 'Request_Number 02/03/04 は Phase 3 retry success evidence として禁止されています。',
    };
  }

  if (!targetPatientId00001Verified) {
    return {
      ...baseResult,
      ok: false,
      violation: 'C7',
      violationCount: 1,
      violatedKeys: observedPatientIdKeys.length > 0 ? observedPatientIdKeys : ['patientId'],
      violatingUrls: mutationRequests.map((record) => record.url),
      error: `visits mutation browser request body の target patientId は ${expectedPatientId} として検証される必要があります。`,
    };
  }

  if (!targetCandidateOnly00001) {
    return {
      ...baseResult,
      ok: false,
      violation: 'C7',
      violationCount: 1,
      violatedKeys: observedCandidateIdKeys.length > 0 ? observedCandidateIdKeys : ['candidateId'],
      violatingUrls: mutationRequests.map((record) => record.url),
      error: `visits mutation browser request body の candidate は ${expectedCandidateId} のみである必要があります。`,
    };
  }

  if (normalizedSelection) {
    const violatingRequests = mutationRequests.filter(
      (record) => !hasMatchingMedicalInformationValue(record.postData, normalizedSelection),
    );
    if (violatingRequests.length > 0) {
      return {
        ...baseResult,
        ok: false,
        violation: 'C7',
        violationCount: violatingRequests.length,
        violatedKeys: observedMedicalInformationKeys.length > 0 ? observedMedicalInformationKeys : ['medicalInformation'],
        violatingUrls: violatingRequests.map((record) => record.url),
        error: `QA_MEDICAL_INFORMATION=${normalizedSelection} run で visits mutation browser request body に一致する medicalInformation が含まれませんでした。`,
      };
    }
    return {
      ...baseResult,
      ok: true,
      violationCount: 0,
      violatedKeys: [],
      violatingUrls: [],
      reason: 'selection_verified',
    };
  }

  const violatingRequests = mutationRequests.filter((record) => hasMedicalInformationField(record.postData));
  if (violatingRequests.length === 0) {
    return {
      ...baseResult,
      ok: true,
      violationCount: 0,
      violatedKeys: [],
      violatingUrls: [],
    };
  }

  return {
    ...baseResult,
    ok: false,
    violation: 'C7',
    violationCount: violatingRequests.length,
    violatedKeys: observedMedicalInformationKeys.length > 0 ? observedMedicalInformationKeys : ['medicalInformation'],
    violatingUrls: violatingRequests.map((record) => record.url),
    error: 'QA_MEDICAL_INFORMATION 未指定 run で visits mutation browser request body に medicalInformation が含まれました。',
  };
};
