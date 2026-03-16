import { http, HttpResponse } from 'msw';

import { applyFaultDelay, parseFaultSpec } from '../utils/faultInjection';
import { ORCA_ADDITIONAL_PDF_BYTES, buildReportBody } from '../fixtures/orcaAdditional';

const reportLabels: Record<string, string> = {
  prescriptionv2: 'Prescription',
  medicinenotebookv2: 'MedicineNotebook',
  karteno1v2: 'KarteNo1',
  karteno3v2: 'KarteNo3',
  invoicereceiptv2: 'InvoiceReceipt',
  statementv2: 'Statement',
};

const respondEmpty = (status = 200) => HttpResponse.text('', { status });

const resolveReportMeta = (faultTokens: Set<string>) => {
  if (faultTokens.has('api-0001')) {
    return { apiResult: '0001', apiResultMessage: '帳票データなし' };
  }
  if (faultTokens.has('api-error')) {
    return { apiResult: 'E99', apiResultMessage: 'mock error' };
  }
  return { apiResult: '0000', apiResultMessage: 'OK' };
};

export const orcaReportHandlers = [
  http.get('/blobapi/:dataId', async ({ request }) => {
    const fault = parseFaultSpec(request);
    await applyFaultDelay(fault);
    if (fault.tokens.has('timeout')) {
      return HttpResponse.arrayBuffer(ORCA_ADDITIONAL_PDF_BYTES.buffer, {
        status: 504,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) {
      return HttpResponse.arrayBuffer(ORCA_ADDITIONAL_PDF_BYTES.buffer, {
        status: 500,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
    if (fault.tokens.has('empty-body')) {
      return HttpResponse.arrayBuffer(new ArrayBuffer(0), {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
    return HttpResponse.arrayBuffer(ORCA_ADDITIONAL_PDF_BYTES.buffer, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }),
  ...Object.keys(reportLabels).map((key) =>
    http.post(`/api/orca/reports/${key.replace(/v2$/, '')}`, async ({ request }) => {
      const fault = parseFaultSpec(request);
      await applyFaultDelay(fault);
      const label = reportLabels[key] ?? key;
      const dataId = `DATA-${key.toUpperCase()}`;
      const omitRequired = fault.tokens.has('missing-required');
      const meta = resolveReportMeta(fault.tokens);
      const body = buildReportBody({
        label,
        dataId,
        apiResult: meta.apiResult,
        apiResultMessage: meta.apiResultMessage,
        omitDataId: fault.tokens.has('missing-data-id'),
        omitApiResult: omitRequired,
        omitApiResultMessage: omitRequired,
      });
      if (fault.tokens.has('timeout')) {
        return HttpResponse.json(body, { status: 504 });
      }
      if (fault.tokens.has('http-500') || fault.tokens.has('500')) {
        return HttpResponse.json(body, { status: 500 });
      }
      if (fault.tokens.has('empty-body')) return respondEmpty();
      return HttpResponse.json(body);
    }),
  ),
];
