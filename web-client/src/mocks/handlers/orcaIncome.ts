import { http, HttpResponse } from 'msw';

import { applyFaultDelay, parseFaultSpec } from '../utils/faultInjection';

const respondEmpty = (status = 200) => HttpResponse.text('', { status });

export const orcaIncomeHandlers = [
  http.post('/api/orca/chart-support/income-info', async ({ request }) => {
    const fault = parseFaultSpec(request);
    await applyFaultDelay(fault);
    const body = {
      ok: !fault.tokens.has('api-error'),
      apiOk: !fault.tokens.has('api-error'),
      apiResult: fault.tokens.has('api-error') ? 'E99' : '00',
      apiResultMessage: fault.tokens.has('api-error') ? 'mocked error' : 'OK',
      informationDate: '20260113',
      informationTime: '220000',
      entries: [
        {
          performDate: '2026-01-10',
          performEndDate: '2026-01-10',
          inOut: 'O',
          invoiceNumber: 'INV-001',
          departmentName: 'Internal',
          insuranceCombinationNumber: '0001',
          acMoney: 100,
          icMoney: 50,
          aiMoney: 25,
          oeMoney: 0,
          mlSmoney: 0,
        },
      ],
    };
    if (fault.tokens.has('timeout')) return HttpResponse.json(body, { status: 504 });
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) return HttpResponse.json(body, { status: 500 });
    if (fault.tokens.has('empty-body')) return respondEmpty();
    return HttpResponse.json(body);
  }),
];
