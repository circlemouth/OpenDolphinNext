import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchKarteImageList,
  fetchKarteImageDetail,
  fetchKarteAttachmentDetail,
  sendKarteDocumentWithAttachments,
  IMAGE_ATTACHMENT_MAX_SIZE_BYTES,
  type KarteDocumentAttachmentPayload,
  sendKarteDocumentWithAttachmentsViaXhr,
  validateAttachmentPayload,
} from '../api';
import { httpFetch } from '../../../libs/http/httpClient';
import { updateObservabilityMeta } from '../../../libs/observability/observability';
import { logAuditEvent } from '../../../libs/audit/auditLogger';
import { fetchPatientImages } from '../patientImagesApi';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
  buildHttpHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('../patientImagesApi', () => ({
  fetchPatientImages: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);
const mockLogAuditEvent = vi.mocked(logAuditEvent);
const mockFetchPatientImages = vi.mocked(fetchPatientImages);

beforeEach(() => {
  mockHttpFetch.mockReset();
  mockLogAuditEvent.mockReset();
  mockFetchPatientImages.mockReset();
  updateObservabilityMeta({ runId: 'RUN-IMAGE', traceId: 'TRACE-IMAGE' });
});

describe('image api', () => {
  it('image list は /patients/{patientId}/images を正規化する', async () => {
    mockFetchPatientImages.mockResolvedValueOnce({
      ok: true,
      status: 200,
      endpoint: '/patients/100/images',
      list: [
        {
          imageId: 1,
          fileName: 'mock.png',
          contentType: 'image/png',
          size: 128,
          createdAt: '2026-03-07T00:00:00Z',
          downloadUrl: '/patients/100/images/1',
        },
      ],
      runId: 'RUN-IMAGE',
      traceId: 'TRACE-IMAGE',
    });

    const result = await fetchKarteImageList({ chartId: '100' });

    expect(mockFetchPatientImages).toHaveBeenCalledTimes(1);
    expect(mockFetchPatientImages).toHaveBeenCalledWith('100');
    expect(result.ok).toBe(true);
    expect(result.endpoint).toBe('/patients/100/images');
    expect(result.list).toHaveLength(1);
    expect(result.list[0]).toMatchObject({
      id: 1,
      title: 'mock.png',
      fileName: 'mock.png',
      thumbnailUrl: '/patients/100/images/1',
    });
    expect(result.runId).toBe('RUN-IMAGE');
    expect(result.traceId).toBe('TRACE-IMAGE');
    expect(mockLogAuditEvent).toHaveBeenCalled();
    const audit = mockLogAuditEvent.mock.calls[0]?.[0] as { payload?: { action?: string; details?: Record<string, unknown> } };
    expect(audit.payload?.action).toBe('image_api_call');
    expect(audit.payload?.details?.runId).toBe('RUN-IMAGE');
    expect(audit.payload?.details?.traceId).toBe('TRACE-IMAGE');
  });

  it('image list は feature_disabled を空一覧扱いしない', async () => {
    mockFetchPatientImages.mockResolvedValueOnce({
      ok: false,
      status: 404,
      endpoint: '/patients/100/images',
      list: [],
      error: 'HTTP 404',
      errorCode: 'feature_disabled',
      message: 'Images PhaseA is disabled',
      runId: 'RUN-IMAGE',
      traceId: 'TRACE-IMAGE',
    });

    const result = await fetchKarteImageList({ chartId: '100' });

    expect(mockFetchPatientImages).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.endpoint).toBe('/patients/100/images');
    expect(result.errorCode).toBe('feature_disabled');
  });

  it('添付のバリデーションでサイズ超過を検知する', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [
        {
          fileName: 'large.png',
          contentType: 'image/png',
          contentSize: IMAGE_ATTACHMENT_MAX_SIZE_BYTES + 1,
          extension: 'png',
          bytes: 'BASE64',
        },
      ],
    };

    const result = await sendKarteDocumentWithAttachments(payload, { validate: true });

    expect(result.ok).toBe(false);
    expect(result.validationErrors).toBeTruthy();
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('添付の必須メタが欠落していると missing エラーになる', () => {
    const validation = validateAttachmentPayload([
      {
        contentType: 'image/png',
        contentSize: 100,
        bytes: 'BASE64',
      },
    ]);
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]?.kind).toBe('missing');
  });

  it('拡張子不明の image/* は missing-extension として扱う', () => {
    const validation = validateAttachmentPayload([
      {
        fileName: 'photo',
        contentType: 'image/heic',
        contentSize: 100,
        bytes: 'BASE64',
      },
    ]);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((error) => error.kind === 'missing-extension')).toBe(true);
  });

  it('拡張子未指定でも contentType から推測できれば許可する', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [
        {
          fileName: 'image',
          contentType: 'image/png',
          contentSize: 1024,
          bytes: 'BASE64',
        },
      ],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, docPk: 124 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });

    expect(result.ok).toBe(true);
    expect(result.docPk).toBe(124);
    expect(mockHttpFetch).toHaveBeenCalled();
  });

  it('document 送信は plain text numeric PK を docPk に正規化する', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [{ id: 999 }],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response('123', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });

    expect(result.ok).toBe(true);
    expect(result.docPk).toBe(123);
  });

  it('document 送信は top-level docPk を docPk に正規化する', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [{ id: 999 }],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ docPk: 123 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });

    expect(result.ok).toBe(true);
    expect(result.docPk).toBe(123);
  });

  it('document 送信は payload.docPk を docPk に正規化する', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [{ id: 999 }],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ payload: { docPk: 123 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });

    expect(result.ok).toBe(true);
    expect(result.docPk).toBe(123);
  });

  it('contentType と拡張子が不一致ならエラーにする', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [
        {
          fileName: 'image.png',
          contentType: 'image/jpeg',
          contentSize: 1024,
          extension: 'png',
          bytes: 'BASE64',
        },
      ],
    };

    const result = await sendKarteDocumentWithAttachments(payload, { validate: true });

    expect(result.ok).toBe(false);
    expect(result.validationErrors?.[0]?.kind).toBe('content-type-mismatch');
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('fileName 由来の拡張子と contentType が不一致でもエラーにする', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [
        {
          fileName: 'image.jpg',
          contentType: 'image/png',
          contentSize: 1024,
          bytes: 'BASE64',
        },
      ],
    };

    const result = await sendKarteDocumentWithAttachments(payload, { validate: true });

    expect(result.ok).toBe(false);
    expect(result.validationErrors?.[0]?.kind).toBe('content-type-mismatch');
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('参照添付(idのみ)はバリデーション対象外として許可する', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 20,
      attachment: [
        {
          id: 999,
        },
      ],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, docPk: 456 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });

    expect(result.ok).toBe(true);
    expect(result.docPk).toBe(456);
    expect(mockHttpFetch).toHaveBeenCalled();
  });

  it('document 送信は JSON payload を送る', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [
        {
          fileName: 'image.png',
          contentType: 'image/png',
          contentSize: 1024,
          extension: 'png',
          bytes: 'BASE64',
        },
      ],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, docPk: 123 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });

    expect(result.ok).toBe(true);
    expect(result.docPk).toBe(123);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/charts/document-drafts',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(result.payload?.ok).toBe(true);
  });

  it('5MB 添付の送信が 3 秒以内で完了する', async () => {
    const sizeBytes = 5 * 1024 * 1024;
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [
        {
          fileName: 'image-5mb.png',
          contentType: 'image/png',
          contentSize: sizeBytes,
          extension: 'png',
          bytes: Buffer.alloc(sizeBytes, 1).toString('base64'),
        },
      ],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, docPk: 999 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const started = Date.now();
    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(3000);
  });

  it('XHR アップロードは実進捗モードを返す', async () => {
    const originalXhr = globalThis.XMLHttpRequest;
    const progressEvents: Array<{ mode?: string }> = [];

    class MockXMLHttpRequest {
      public static lastInstance: MockXMLHttpRequest | null = null;
      public upload = new EventTarget();
      public status = 0;
      public responseText = '';
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public ontimeout: (() => void) | null = null;
      private responseHeaders: Record<string, string> = {};

      constructor() {
        MockXMLHttpRequest.lastInstance = this;
      }

      open() {
        // noop
      }

      setRequestHeader() {
        // noop
      }

      getAllResponseHeaders() {
        return Object.entries(this.responseHeaders)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\r\n');
      }

      send() {
        const event = typeof ProgressEvent !== 'undefined'
          ? new ProgressEvent('progress', { lengthComputable: true, loaded: 5, total: 10 })
          : Object.assign(new Event('progress'), { lengthComputable: true, loaded: 5, total: 10 });
        this.upload.dispatchEvent(event);
        this.status = 200;
        this.responseText = '789';
        this.responseHeaders = {
          'content-type': 'text/plain',
          'x-run-id': 'RUN-XHR',
          'x-trace-id': 'TRACE-XHR',
        };
        this.onload?.();
      }
    }

    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [
        {
          fileName: 'image.png',
          contentType: 'image/png',
          contentSize: 1024,
          extension: 'png',
          bytes: 'BASE64',
        },
      ],
    };

    const result = await sendKarteDocumentWithAttachmentsViaXhr(payload, {
      onProgress: (event) => progressEvents.push(event),
    });

    expect(result.ok).toBe(true);
    expect(result.docPk).toBe(789);
    expect(result.progressMode).toBe('real');
    expect(progressEvents.some((event) => event.mode === 'real')).toBe(true);

    globalThis.XMLHttpRequest = originalXhr;
  });

  it('document 送信は docPk が無い成功応答を成功扱いしない', async () => {
    const payload: KarteDocumentAttachmentPayload = {
      id: 10,
      attachment: [{ id: 999 }],
    };

    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_doc_pk');
  });

  it('image detail はテキスト応答を rawText に格納する', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response('plain-response', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    const result = await fetchKarteImageDetail(100);

    expect(result.ok).toBe(true);
    expect(result.rawText).toBe('plain-response');
  });

  it('attachment detail はJSONを payload に格納する', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 10, ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchKarteAttachmentDetail(10);

    expect(result.ok).toBe(true);
    expect(result.payload?.id).toBe(10);
  });
});
