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
    expect(result.targetMutationRequestCount).toBe(1);
    expect(result.violationCount).toBe(1);
    expect(result.violation).toBe('C7');
    expect(result.violatedKeys).toEqual(['medicalInformation']);
    expect(result.bodyKeysObserved).toEqual(['medicalInformation', 'patientId', 'requestNumber']);
    expect(result.medicalInformationFieldPresent).toBe(true);
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
    expect(result.medicalInformationFieldPresent).toBe(true);
  });

  it('QA_MEDICAL_INFORMATION 未指定で Medical_Information empty string でも failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","visit":{"Medical_Information":""}}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violationCount).toBe(1);
    expect(result.violatedKeys).toEqual(['Medical_Information']);
    expect(result.medicalInformationFieldPresent).toBe(true);
  });

  it.each(['medicalInformation', 'Medical_Information'])(
    'QA_MEDICAL_INFORMATION 未指定で key-only JSON fragment でも failure にする: %s',
    (key) => {
      const result = evaluateMedicalInformationGate({
        medicalInformation: '',
        requestRecords: [
          {
            url: 'https://localhost/api/orca/official/visits/mutation',
            postData: `{"requestNumber":"01","patientId":"00001","visit":{ "${key}": }`,
          },
        ],
      });

      expect(result.ok).toBe(false);
      expect(result.violationCount).toBe(1);
      expect(result.violatedKeys).toEqual(['rawBodyDecisionRequired']);
      expect(result.medicalInformationFieldPresent).toBe(true);
    },
  );

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
    expect(result.violatedKeys).toEqual(['medicalInformation']);
    expect(result.medicalInformationFieldPresent).toBe(true);
  });

  it('QA_MEDICAL_INFORMATION 未指定で Medical_Information null でも failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","Medical_Information":null}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violationCount).toBe(1);
    expect(result.violatedKeys).toEqual(['Medical_Information']);
    expect(result.medicalInformationFieldPresent).toBe(true);
  });

  it('target mutation request を 1 件も捕捉できない場合は failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [],
    });

    expect(result.ok).toBe(false);
    expect(result.targetMutationRequestCount).toBe(0);
    expect(result.checkedRequests).toBe(0);
    expect(result.violatedKeys).toEqual(['targetMutationRequest']);
    expect(result.error).toContain('1 件も捕捉できませんでした');
  });

  it('target mutation request が複数ある場合は failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","acceptancePush":"1"}',
        },
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","acceptancePush":"1"}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.targetMutationRequestCount).toBe(2);
    expect(result.violatedKeys).toEqual(['targetMutationRequest']);
    expect(result.error).toContain('1 件だけ');
  });

  it('Request_Number=01 と patientId=00001 を strict に検証する', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"Request_Number":"01","Patient_ID":"00001","acceptancePush":"1"}',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.intendedRequestNumber01).toBe(true);
    expect(result.requestNumberKeyPresent).toBe(true);
    expect(result.requestNumber01ValueVerified).toBe(true);
    expect(result.requestNumber02_03_04Absent).toBe(true);
    expect(result.targetPatientId00001Verified).toBe(true);
    expect(result.targetCandidateOnly00001).toBe(true);
  });

  it('malformed body は raw body 依存になるため failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001",',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violatedKeys).toEqual(['rawBodyDecisionRequired']);
    expect(result.error).toContain('malformed body');
  });

  it.each(['00', '02', '03', '04', '', null, { value: '01' }, ['01'], '1'])(
    'Request_Number/requestNumber が 01 以外なら failure にする: %s',
    (requestNumber) => {
      const result = evaluateMedicalInformationGate({
        medicalInformation: '',
        requestRecords: [
          {
            url: 'https://localhost/api/orca/official/visits/mutation',
            postData: JSON.stringify({ requestNumber, patientId: '00001', acceptancePush: '1' }),
          },
        ],
      });

      expect(result.ok).toBe(false);
      expect(result.requestNumber01ValueVerified).toBe(false);
      expect(result.violatedKeys).toEqual(['requestNumber']);
    },
  );

  it('requestNumber missing は failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"patientId":"00001","acceptancePush":"1"}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.requestNumberKeyPresent).toBe(false);
    expect(result.requestNumber01ValueVerified).toBe(false);
    expect(result.violatedKeys).toEqual(['requestNumber']);
  });

  it('patientId が 00001 以外なら failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00002","acceptancePush":"1"}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.requestNumber01ValueVerified).toBe(true);
    expect(result.targetPatientId00001Verified).toBe(false);
    expect(result.violatedKeys).toEqual(['patientId']);
  });

  it('fullflow 診断では expectedPatientId を指定して runtime-smoke 対象患者を検証できる', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      expectedPatientId: '00999',
      expectedCandidateId: '00999',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00999","acceptancePush":"1"}',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.requestNumber01ValueVerified).toBe(true);
    expect(result.targetPatientId00001Verified).toBe(true);
    expect(result.targetCandidateOnly00001).toBe(true);
    expect(result.medicalInformationFieldPresent).toBe(false);
  });

  it('current selected candidate を expectedPatientId/expectedCandidateId として検証できる', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      expectedPatientId: '00002',
      expectedCandidateId: '00002',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00002","candidateId":"00002","acceptancePush":"1"}',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.targetPatientIdVerified).toBe(true);
    expect(result.targetCandidateOnly).toBe(true);
    expect(result.targetPatientId00001Verified).toBe(true);
    expect(result.targetCandidateOnly00001).toBe(true);
  });

  it('candidate が 00001 以外なら failure にする', () => {
    const result = evaluateMedicalInformationGate({
      medicalInformation: '',
      requestRecords: [
        {
          url: 'https://localhost/api/orca/official/visits/mutation',
          postData: '{"requestNumber":"01","patientId":"00001","candidateId":"00002","acceptancePush":"1"}',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.targetCandidateOnly00001).toBe(false);
    expect(result.violatedKeys).toEqual(['candidateId']);
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
    expect(result.medicalInformationFieldPresent).toBe(false);
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
