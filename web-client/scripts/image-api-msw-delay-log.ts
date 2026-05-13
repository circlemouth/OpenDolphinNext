import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const RUN_ID = '20260121T052657Z';
const baseUrl = 'http://localhost';
const delayMs = 3200;

const server = setupServer(
  http.post(`${baseUrl}/api/charts/document-drafts`, async ({ request }) => {
    const traceId = request.headers.get('x-trace-id') ?? `trace-${RUN_ID}`;
    const started = Date.now();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const elapsed = Date.now() - started;
    console.info('[msw][delay]', {
      runId: RUN_ID,
      traceId,
      delayMs,
      elapsedMs: elapsed,
    });
    return HttpResponse.json(
      { ok: true, docPk: 9000, runId: RUN_ID, traceId },
      { status: 200, headers: { 'x-run-id': RUN_ID, 'x-trace-id': traceId } },
    );
  }),
);

const main = async () => {
  server.listen({ onUnhandledRequest: 'warn' });

  const start = Date.now();
  const response = await fetch(`${baseUrl}/api/charts/document-drafts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-run-id': RUN_ID,
      'x-trace-id': `trace-${RUN_ID}`,
    },
    body: JSON.stringify({ attachment: [{ fileName: 'delay.png', bytes: 'AA==' }] }),
  });
  const elapsed = Date.now() - start;

  const body = await response.text();
  const overLimit = elapsed > 3000;
  console.info('[msw][delay-result]', {
    runId: RUN_ID,
    status: response.status,
    elapsedMs: elapsed,
    overLimit,
    body,
  });

  server.close();
};

main().catch((error) => {
  console.error('[msw][delay-result] failed', error);
  server.close();
  process.exit(1);
});
