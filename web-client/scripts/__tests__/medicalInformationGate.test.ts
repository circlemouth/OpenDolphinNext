import { describe, expect, it } from 'vitest';

import { evaluateMedicalInformationGate } from '../qa-lib/medical-information-gate.mjs';

describe('evaluateMedicalInformationGate', () => {
  it('QA_MEDICAL_INFORMATION 未指定で Medical_Information が含まれた request を failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"visit":{"Medical_Information":"01"}}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.enforced).toBe(true);
    expect(result.violationCount).toBe(1);
    expect(result.error).toContain('Medical_Information');
  });

  it('QA_MEDICAL_INFORMATION 未指定で field が無ければ pass にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"visit":{"Visit_Kbn":"1"}}',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.enforced).toBe(true);
    expect(result.violationCount).toBe(0);
  });

  it('QA_MEDICAL_INFORMATION 指定 run では omission gate を強制しない', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '01',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"visit":{"Medical_Information":"01"}}',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.enforced).toBe(false);
    expect(result.reason).toBe('selection_present');
  });
});
