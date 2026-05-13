import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const baseUrl = 'http://localhost';

const logRequest = (label: string, request: Request) => {
  const runId = request.headers.get('x-run-id') ?? 'RUN-MSW-IMAGE';
  const traceId = request.headers.get('x-trace-id') ?? `trace-${runId}`;
  console.info('[msw][karte-image]', { label, method: request.method, url: request.url, runId, traceId });
  return { runId, traceId };
};

const server = setupServer(
  http.get(`${baseUrl}/karte/images`, ({ request }) => {
    const { runId, traceId } = logRequest('list', request);
    return HttpResponse.json(
      { list: [], page: 1, total: 0, runId, traceId },
      { status: 200, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
  http.get(`${baseUrl}/karte/iamges`, ({ request }) => {
    const { runId, traceId } = logRequest('list-typo', request);
    return HttpResponse.json(
      { list: [], page: 1, total: 0, runId, traceId },
      { status: 200, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
  http.get(`${baseUrl}/karte/image/:id`, ({ request, params }) => {
    const { runId, traceId } = logRequest('detail', request);
    return HttpResponse.json(
      { id: Number(params.id), runId, traceId },
      { status: 200, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
  http.get(`${baseUrl}/karte/attachment/:id`, ({ request, params }) => {
    const { runId, traceId } = logRequest('attachment', request);
    return HttpResponse.json(
      { id: Number(params.id), runId, traceId },
      { status: 200, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
  http.post(`${baseUrl}/api/charts/document-drafts`, async ({ request }) => {
    const { runId, traceId } = logRequest('document-put', request);
    const payload = await request.json().catch(() => null);
    return HttpResponse.json(
      { ok: Boolean(payload), runId, traceId },
      { status: 200, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
);

const main = async () => {
  server.listen({ onUnhandledRequest: 'error' });

  const headers = { 'x-run-id': 'RUN-MSW-IMAGE', 'x-trace-id': 'TRACE-MSW-IMAGE' };
  await fetch(`${baseUrl}/karte/images`, { headers });
  await fetch(`${baseUrl}/karte/iamges`, { headers });
  await fetch(`${baseUrl}/karte/image/901`, { headers });
  await fetch(`${baseUrl}/karte/attachment/777`, { headers });
  await fetch(`${baseUrl}/api/charts/document-drafts`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ attachment: [{ fileName: 'mock.png', contentType: 'image/png', contentSize: 10, bytes: 'AA==' }] }),
  });

  server.close();
};

main().catch((error) => {
  console.error('[msw-log] failed', error);
  server.close();
  process.exit(1);
});
