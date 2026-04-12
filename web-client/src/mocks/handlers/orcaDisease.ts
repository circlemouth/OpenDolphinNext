import { http, HttpResponse } from 'msw';

const generateRunId = () => new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

const generateTraceId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `trace-${Date.now()}`;
};

const resolveAuditHeaders = (request: Request) => {
  const runId = request.headers.get('x-run-id') ?? generateRunId();
  const traceId = request.headers.get('x-trace-id') ?? generateTraceId();
  return { runId, traceId };
};

const respond = (body: Record<string, unknown>, status = 200) =>
  HttpResponse.json(body, {
    status,
    headers: {
      'x-run-id': String(body.runId ?? ''),
      'x-trace-id': String((body as any).traceId ?? ''),
    },
  });

const resolveBaseDate = (url: URL) => {
  const from = url.searchParams.get('from');
  if (from && from.trim()) {
    return from.trim();
  }
  return new Date().toISOString().slice(0, 10);
};

const resolvePatientId = (request: Request) => {
  const path = new URL(request.url).pathname;
  const tokens = path.split('/').filter(Boolean);
  return tokens[tokens.length - 1] ?? '';
};

export const orcaDiseaseHandlers = [
  http.get(/\/api\/orca\/official\/disease-master\/name\/[^/]+\/$/, ({ request }) => {
    const { runId, traceId } = resolveAuditHeaders(request);
    return respond(
      {
        runId,
        traceId,
        list: [],
      },
      200,
    );
  }),
  http.get(/\/api\/local\/diagnoses\/[^/?]+(?:\?.*)?$/, ({ request }) => {
    const { runId, traceId } = resolveAuditHeaders(request);
    const patientId = resolvePatientId(request);
    const url = new URL(request.url);
    const baseDate = resolveBaseDate(url);
    return respond(
      {
        apiResult: '00',
        apiResultMessage: '処理終了',
        runId,
        traceId,
        patientId,
        baseDate,
        diseases: [],
      },
      200,
    );
  }),
];
