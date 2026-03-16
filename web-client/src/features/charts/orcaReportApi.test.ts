import { describe, expect, it } from 'vitest';

import { buildOrcaReportRequest } from './orcaReportApi';

describe('buildOrcaReportRequest', () => {
  it('処方箋向け既定値を JSON 契約で補完する', () => {
    const request = buildOrcaReportRequest('prescription', {
      patientId: 'P-1',
    });

    expect(request).toEqual({
      patientId: 'P-1',
      invoiceNumber: undefined,
      outsideClass: 'False',
      orderClass: undefined,
      departmentCode: undefined,
      insuranceCombinationNumber: undefined,
      performMonth: undefined,
      startDay: undefined,
      lastPageNumber: undefined,
      lastRowNumber: undefined,
    });
  });
});
