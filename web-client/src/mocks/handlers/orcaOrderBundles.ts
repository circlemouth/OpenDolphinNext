import { http, HttpResponse, passthrough } from 'msw';

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

const shouldBypass = (request: Request): boolean => {
  // When the app explicitly requests server-backed data (e.g. E2E with
  // X-DataSource-Transition=server), do not fake persistence.
  // This fixes POST success -> immediate GET empty bundles observed in
  // RUN_ID=20260206T053729Z-procedure-usage-recheck8.
  const transition = request.headers.get('x-datasource-transition');
  return transition != null && transition.trim().toLowerCase() === 'server';
};

const respond = (body: Record<string, unknown>, status = 200) =>
  HttpResponse.json(body, {
    status,
    headers: {
      'x-run-id': String(body.runId ?? ''),
      'x-trace-id': String((body as any).traceId ?? ''),
    },
  });

const resolveOperationBuckets = (operations: any[]) => {
  const created: number[] = [];
  const updated: number[] = [];
  const deleted: number[] = [];
  const base = Date.now();
  operations.forEach((operation, index) => {
    const op = typeof operation?.operation === 'string' ? operation.operation.toLowerCase() : '';
    const id = base + index;
    if (op === 'create') created.push(id);
    if (op === 'update') updated.push(id);
    if (op === 'delete') deleted.push(id);
  });
  return { created, updated, deleted };
};

export const orcaOrderBundleHandlers = [
  http.get(/\/api\/local\/order\/bundles(?:\?.*)?$/, ({ request }) => {
    if (shouldBypass(request)) {
      return passthrough();
    }
    const { runId, traceId } = resolveAuditHeaders(request);
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId') ?? '';
    if (!patientId.trim()) {
      return respond(
        {
          apiResult: 'ERROR',
          apiResultMessage: 'patientId is required',
          runId,
          traceId,
          errorCode: 'invalid_request',
        },
        400,
      );
    }
    return respond(
      {
        apiResult: '00',
        apiResultMessage: '処理終了',
        runId,
        traceId,
        patientId,
        recordsReturned: 0,
        bundles: [],
      },
      200,
    );
  }),
  http.post(/\/api\/local\/order\/bundles$/, async ({ request }) => {
    if (shouldBypass(request)) {
      return passthrough();
    }
    const { runId, traceId } = resolveAuditHeaders(request);
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patientId = typeof payload.patientId === 'string' ? payload.patientId : '';
    const operations = Array.isArray(payload.operations) ? payload.operations : [];
    if (!patientId.trim()) {
      return respond(
        {
          apiResult: 'ERROR',
          apiResultMessage: 'patientId is required',
          runId,
          traceId,
          errorCode: 'invalid_request',
        },
        400,
      );
    }
    if (operations.length === 0) {
      return respond(
        {
          apiResult: 'ERROR',
          apiResultMessage: 'operations is required',
          runId,
          traceId,
          errorCode: 'invalid_request',
        },
        400,
      );
    }
    const buckets = resolveOperationBuckets(operations);
    return respond(
      {
        apiResult: '00',
        apiResultMessage: '処理終了',
        runId,
        traceId,
        createdDocumentIds: buckets.created,
        updatedDocumentIds: buckets.updated,
        deletedDocumentIds: buckets.deleted,
      },
      200,
    );
  }),
];
