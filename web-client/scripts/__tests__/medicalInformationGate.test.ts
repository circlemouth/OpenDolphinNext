import { describe, expect, it } from 'vitest';

import { evaluateMedicalInformationGate } from '../qa-lib/medical-information-gate.mjs';

describe('evaluateMedicalInformationGate', () => {
  it('QA_MEDICAL_INFORMATION 未指定で actual browser payload の medicalInformation を failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","medicalInformation":"01"}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.enforced).toBe(true);
    expect(result.violationCount).toBe(1);
    expect(result.error).toContain('medicalInformation');
  });

  it('QA_MEDICAL_INFORMATION 未指定で empty string でも failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","medicalInformation":""}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violationCount).toBe(1);
  });

  it('QA_MEDICAL_INFORMATION 未指定で Medical_Information empty string でも failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"visit":{"Medical_Information":""}}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violationCount).toBe(1);
  });

  it('QA_MEDICAL_INFORMATION 未指定で null でも failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","medicalInformation":null}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violationCount).toBe(1);
  });

  it('target mutation request を 1 件も捕捉できない場合は failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [],
    });

    expect(result.ok).toBe(false);
    expect(result.checkedRequests).toBe(0);
    expect(result.error).toContain('1 件も捕捉できませんでした');
  });

  it('QA_MEDICAL_INFORMATION 未指定で field が無ければ pass にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","acceptancePush":"1"}',
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
          postData: '{"requestNumber":"01","patientId":"00001","medicalInformation":"01"}',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.enforced).toBe(true);
    expect(result.reason).toBe('selection_verified');
  });

  it('QA_MEDICAL_INFORMATION 指定 run で一致する値が無ければ failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '02',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","medicalInformation":"01"}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('一致する medicalInformation が含まれませんでした');
  });
});
