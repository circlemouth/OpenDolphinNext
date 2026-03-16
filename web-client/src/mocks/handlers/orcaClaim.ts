import { http, HttpResponse } from 'msw';

import { applyFaultDelay, parseFaultSpec } from '../utils/faultInjection';

const buildMedicalModV2Response = (options: {
  apiResult?: string;
  apiResultMessage?: string;
  invoiceNumber?: string;
  dataId?: string;
}) => {
  const apiResult = options.apiResult ?? '00';
  const apiResultMessage = options.apiResultMessage ?? 'OK';
  const invoiceNumber = options.invoiceNumber ?? 'INV-000001';
  const dataId = options.dataId ?? 'DATA-000001';
  return {
    ok: apiResult === '00',
    apiOk: apiResult === '00',
    apiResult,
    apiResultMessage,
    informationDate: '2026-01-20',
    informationTime: '09:00:00',
    invoiceNumber,
    dataId,
    medicalWarnings: apiResult === '21' ? [{ medicalWarning: '21', medicalWarningMessage: '警告' }] : [],
  };
};

const buildMedicalModV23Response = (options: { apiResult?: string; apiResultMessage?: string }) => {
  const apiResult = options.apiResult ?? '00';
  const apiResultMessage = options.apiResultMessage ?? 'OK';
  return {
    ok: apiResult === '00',
    apiOk: apiResult === '00',
    apiResult,
    apiResultMessage,
    informationDate: '2026-01-20',
    informationTime: '09:00:00',
  };
};

export const orcaClaimHandlers = [
  http.post('/api/orca/chart-support/medical-mod-v2', async ({ request }) => {
    const fault = parseFaultSpec(request);
    await applyFaultDelay(fault);
    const apiResult = fault.tokens.has('api-21') ? '21' : fault.tokens.has('api-error') ? 'E99' : '00';
    const apiResultMessage = apiResult === '21' ? '警告' : apiResult === 'E99' ? 'mocked error' : 'OK';
    const body = buildMedicalModV2Response({ apiResult, apiResultMessage });
    if (fault.tokens.has('timeout')) return HttpResponse.json(body, { status: 504 });
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) return HttpResponse.json(body, { status: 500 });
    return HttpResponse.json(body);
  }),
  http.post('/api/orca/chart-support/medical-mod-v23', async ({ request }) => {
    const fault = parseFaultSpec(request);
    await applyFaultDelay(fault);
    const apiResult = fault.tokens.has('api-21') ? '21' : fault.tokens.has('api-error') ? 'E99' : '00';
    const apiResultMessage = apiResult === '21' ? '警告' : apiResult === 'E99' ? 'mocked error' : 'OK';
    const body = buildMedicalModV23Response({ apiResult, apiResultMessage });
    if (fault.tokens.has('timeout')) return HttpResponse.json(body, { status: 504 });
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) return HttpResponse.json(body, { status: 500 });
    return HttpResponse.json(body);
  }),
];
