const TARGET_MUTATION_PATH = '/api/orca/official/visits/mutation';

const hasMedicalInformationField = (postData) => {
  if (typeof postData !== 'string' || postData.length === 0) {
    return false;
  }
  return /Medical_Information/.test(postData);
};

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

  if (normalizedSelection) {
    return {
      ok: true,
      enforced: false,
      checkedRequests: mutationRequests.length,
      violationCount: 0,
      violatingUrls: [],
      reason: 'selection_present',
    };
  }

  const violatingRequests = mutationRequests.filter((record) => hasMedicalInformationField(record.postData));
  if (violatingRequests.length === 0) {
    return {
      ok: true,
      enforced: true,
      checkedRequests: mutationRequests.length,
      violationCount: 0,
      violatingUrls: [],
    };
  }

  return {
    ok: false,
    enforced: true,
    checkedRequests: mutationRequests.length,
    violationCount: violatingRequests.length,
    violatingUrls: violatingRequests.map((record) => record.url),
    error: 'QA_MEDICAL_INFORMATION 未指定 run で visits mutation request に Medical_Information が含まれました。',
  };
};
