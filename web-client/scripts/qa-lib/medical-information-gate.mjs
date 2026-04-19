const TARGET_MUTATION_PATH = '/api/orca/official/visits/mutation';

const MEDICAL_INFORMATION_KEYS = new Set(['medicalInformation', 'Medical_Information']);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort();

const inspectPayload = (postData) => {
  const bodyKeysObserved = new Set();
  const medicalInformationKeysObserved = new Set();

  if (typeof postData !== 'string' || postData.length === 0) {
    return {
      bodyKeysObserved: [],
      medicalInformationFieldPresent: false,
      medicalInformationKeysObserved: [],
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
        if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }
  } catch {
    for (const match of postData.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g)) {
      const key = match[1];
      bodyKeysObserved.add(key);
      if (MEDICAL_INFORMATION_KEYS.has(key)) {
        medicalInformationKeysObserved.add(key);
      }
    }
  }

  const keys = uniqueSorted([...bodyKeysObserved]);
  const medicalKeys = uniqueSorted([...medicalInformationKeysObserved]);
  return {
    bodyKeysObserved: keys,
    medicalInformationFieldPresent: medicalKeys.length > 0,
    medicalInformationKeysObserved: medicalKeys,
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
  const medicalInformationFieldPresent = mutationInspections.some((inspection) => inspection.medicalInformationFieldPresent);
  const baseResult = {
    enforced: true,
    targetMutationRequestCount: mutationRequests.length,
    checkedRequests: mutationRequests.length,
    bodyKeysObserved,
    medicalInformationFieldPresent,
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
