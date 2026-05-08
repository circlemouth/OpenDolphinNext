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
        orcaMirrorStatus: 'connected',
        diseases: [
          {
            diagnosisName: 'ORCA登録済み病名',
            diagnosisCode: 'I10',
            startDate: baseDate,
            layer: 'orca-mirror',
            readOnly: true,
            syncState: 'none',
          },
        ],
      },
      200,
    );
  }),
  http.post('/api/orca/official/chart-support/disease-mod-v3', async ({ request }) => {
    const { runId, traceId } = resolveAuditHeaders(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const operation = typeof body.operation === 'string' ? body.operation : '';
    if (!['create', 'update', 'delete', 'organizeDeletedDiseases'].includes(operation)) {
      return respond(
        {
          runId,
          traceId,
          message: 'ORCA病名操作を確認できませんでした。',
        },
        400,
      );
    }
    return respond(
      {
        apiResult: '00',
        apiResultMessage: '処理終了',
        businessAccepted: true,
        operation,
        runId,
        traceId,
      },
      200,
    );
  }),
];
