import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { buildIncomeInfoRequest, fetchOrcaIncomeInfo } from './orcaIncomeInfoApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

describe('orcaIncomeInfoApi', () => {
  beforeEach(() => {
    vi.mocked(httpFetch).mockReset();
  });

  it('buildIncomeInfoRequest は official sample に必要な patientId / baseDate のみを返す', () => {
    expect(
      buildIncomeInfoRequest({
        patientId: 'P-1',
        baseDate: '2026-03-09',
      }),
    ).toEqual({
      patientId: 'P-1',
      baseDate: '2026-03-09',
    });
  });

  it('fetchOrcaIncomeInfo は official semantics と未収一覧を正規化する', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          apiOk: true,
          apiResult: '0000',
          apiResultMessage: 'OK',
          informationDate: '20260309',
          informationTime: '093000',
          entries: [
            {
              performDate: '2026-03-09',
              issuedDate: '2026-03-10',
              invoiceNumber: 'INV-1',
              groupInvoiceNumber: 'GRP-1',
              departmentCode: '01',
              departmentName: '内科',
              insuranceCombinationNumber: '0001',
              acMoney: 1200,
              icMoney: 700,
              aiMoney: 400,
              oeMoney: 100,
              mlSmoney: 0,
            },
          ],
          unpaidMoneyTotal: 500,
          unpaidMoneyInformationOverflow: false,
          unpaidMoneyInformation: [
            {
              performDate: '2026-03-09',
              invoiceNumber: 'INV-1',
              unpaidMoney: 500,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await fetchOrcaIncomeInfo({
      patientId: 'P-1',
      baseDate: '2026-03-09',
    });

    const requestInit = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      patientId: 'P-1',
      baseDate: '2026-03-09',
    });
    expect(response.entries[0]).toEqual(
      expect.objectContaining({
        performDate: '2026-03-09',
        issuedDate: '2026-03-10',
        invoiceNumber: 'INV-1',
        groupInvoiceNumber: 'GRP-1',
        departmentCode: '01',
        departmentName: '内科',
        insuranceCombinationNumber: '0001',
        claimAmount: 1200,
        paymentAmount: 700,
        insuranceAppliedAmount: 400,
        selfPayAmount: 100,
        mealLivingCopayAmount: 0,
      }),
    );
    expect(response.unpaidMoneyTotal).toBe(500);
    expect(response.unpaidMoneyInformationOverflow).toBe(false);
    expect(response.unpaidMoneyInformation).toEqual([
      {
        performDate: '2026-03-09',
        inOut: undefined,
        invoiceNumber: 'INV-1',
        unpaidMoney: 500,
      },
    ]);
  });
});
