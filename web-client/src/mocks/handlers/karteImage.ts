import { http, HttpResponse } from 'msw';

type StoredImage = {
  id: number;
  title?: string;
  fileName?: string;
  contentType?: string;
  contentSize?: number;
  recordedAt?: string;
  thumbnailUrl?: string;
};

const resolveAuditHeaders = (request: Request) => {
  const runId = request.headers.get('x-run-id') ?? 'MSW-RUN-IMAGES';
  const traceId = request.headers.get('x-trace-id') ?? `trace-${runId}`;
  return { runId, traceId };
};

const respondJson = (body: Record<string, unknown>, headers: Record<string, string> = {}, status = 200) =>
  HttpResponse.json(body, {
    status,
    headers: {
      ...headers,
    },
  });

const respondText = (body: string, headers: Record<string, string> = {}, status = 200) =>
  new HttpResponse(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=UTF-8',
      ...headers,
    },
  });

const logRequest = (label: string, request: Request) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  if (typeof console !== 'undefined') {
    console.info('[msw][karte-image]', {
      label,
      method: request.method,
      url: request.url,
      runId,
      traceId,
    });
  }
  return { runId, traceId };
};

// NOTE: In-memory MSW store (dev-only). Supports "upload -> list contains it" proof while server API is pending.
const imageStoreByChart = new Map<string, StoredImage[]>();
let nextImageId = 1000;

const ensureSeeded = (chartKey: string) => {
  if (imageStoreByChart.has(chartKey)) return;
  imageStoreByChart.set(chartKey, [
    {
      id: 901,
      title: '胸部X線',
      fileName: 'xray_2026_01_21.png',
      contentType: 'image/png',
      contentSize: 245_120,
      recordedAt: '2026-01-21T12:00:00Z',
      thumbnailUrl: '/mock/thumbnail/901',
    },
  ]);
};

const decodeBase64 = (value: string) => {
  // MSW handlers run in the browser (Service Worker), so atob exists.
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// 1x1 PNG (opaque gray). Used for /mock/thumbnail/* to avoid broken <img>.
const THUMBNAIL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axlN9cAAAAASUVORK5CYII=';

export const karteImageHandlers = [
  http.get('/karte/image/:id', ({ request, params }) => {
    const { runId, traceId } = logRequest('detail', request);
    return respondJson(
      {
        ok: true,
        id: Number(params.id),
        title: '胸部X線',
        contentType: 'image/png',
        contentSize: 245_120,
        recordedAt: '2026-01-21T12:00:00Z',
        bytes: 'BASE64_PLACEHOLDER',
        runId,
        traceId,
      },
      {
        'x-run-id': runId,
        'x-trace-id': traceId,
      },
    );
  }),
  http.get('/karte/attachment/:id', ({ request, params }) => {
    const { runId, traceId } = logRequest('attachment', request);
    return respondJson(
      {
        ok: true,
        id: Number(params.id),
        title: '添付ファイル',
        fileName: 'attachment-20260121.pdf',
        contentType: 'application/pdf',
        contentSize: 1024,
        bytes: 'BASE64_PLACEHOLDER',
        runId,
        traceId,
      },
      {
        'x-run-id': runId,
        'x-trace-id': traceId,
      },
    );
  }),
  http.post('/api/charts/document-drafts', async ({ request }) => {
    const { runId, traceId } = logRequest('document-put', request);
    const payload = await request.json().catch(() => null);
    const attachments = Array.isArray((payload as any)?.attachment) ? ((payload as any).attachment as unknown[]) : [];
    if (!payload || attachments.length === 0) {
      return respondJson(
        { ok: false, reason: 'missing_attachment', runId, traceId },
        { 'x-run-id': runId, 'x-trace-id': traceId },
        400,
      );
    }
    // For PhaseA proof, treat document PUT as "saved" and add image list entries (best-effort).
    const chartKey = String((payload as any)?.docInfoModel?.patientId ?? 'default');
    ensureSeeded(chartKey);
    const list = imageStoreByChart.get(chartKey) ?? [];
    const recordedAt = String((payload as any)?.docInfoModel?.recordedAt ?? new Date().toISOString());
    attachments.forEach((entry: any) => {
      const fileName = typeof entry?.fileName === 'string' ? entry.fileName : `upload-${nextImageId}.png`;
      const title = typeof entry?.title === 'string' ? entry.title : fileName;
      const id = nextImageId++;
      list.unshift({
        id,
        title,
        fileName,
        contentType: typeof entry?.contentType === 'string' ? entry.contentType : 'image/png',
        contentSize: typeof entry?.contentSize === 'number' ? entry.contentSize : undefined,
        recordedAt,
        thumbnailUrl: `/mock/thumbnail/${id}`,
      });
    });
    imageStoreByChart.set(chartKey, list);
    return respondText(
      '9024',
      { 'x-run-id': runId, 'x-trace-id': traceId },
      200,
    );
  }),
  http.post('/api/charts/document-drafts', async ({ request }) => {
    const { runId, traceId } = logRequest('document-post', request);
    const payload = await request.json().catch(() => null);
    const attachments = Array.isArray((payload as any)?.attachment) ? ((payload as any).attachment as unknown[]) : [];
    if (!payload || attachments.length === 0) {
      return respondJson(
        { ok: false, reason: 'missing_attachment', runId, traceId },
        { 'x-run-id': runId, 'x-trace-id': traceId },
        400,
      );
    }
    // For PhaseA proof, persist to in-memory store so the subsequent list fetch shows the new image.
    const chartKey = String((payload as any)?.docInfoModel?.patientId ?? 'default');
    ensureSeeded(chartKey);
    const list = imageStoreByChart.get(chartKey) ?? [];
    const recordedAt = String((payload as any)?.docInfoModel?.recordedAt ?? new Date().toISOString());
    attachments.forEach((entry: any) => {
      const fileName = typeof entry?.fileName === 'string' ? entry.fileName : `upload-${nextImageId}.png`;
      const title = typeof entry?.title === 'string' ? entry.title : fileName;
      const id = nextImageId++;
      list.unshift({
        id,
        title,
        fileName,
        contentType: typeof entry?.contentType === 'string' ? entry.contentType : 'image/png',
        contentSize: typeof entry?.contentSize === 'number' ? entry.contentSize : undefined,
        recordedAt,
        thumbnailUrl: `/mock/thumbnail/${id}`,
      });
    });
    imageStoreByChart.set(chartKey, list);
    return respondText(
      '9025',
      { 'x-run-id': runId, 'x-trace-id': traceId },
      200,
    );
  }),
  http.get('/mock/thumbnail/:id', ({ request }) => {
    logRequest('thumbnail', request);
    const bytes = decodeBase64(THUMBNAIL_PNG_BASE64);
    return HttpResponse.arrayBuffer(bytes.buffer, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-store',
      },
    });
  }),
];
