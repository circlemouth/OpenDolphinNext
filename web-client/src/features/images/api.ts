import { logAuditEvent } from '../../libs/audit/auditLogger';
import { buildHttpHeaders, httpFetch } from '../../libs/http/httpClient';
import { captureObservabilityFromResponse, ensureObservabilityMeta, getObservabilityMeta } from '../../libs/observability/observability';
import { fetchPatientImages } from './patientImagesApi';

const IMAGE_DETAIL_ENDPOINT = '/karte/image';
const ATTACHMENT_ENDPOINT = '/karte/attachment';
const DOCUMENT_ENDPOINT = '/api/charts/document-drafts';
const INVALID_DOC_PK = -1;

export type KarteImageListItem = {
  id: number;
  title?: string;
  fileName?: string;
  contentType?: string;
  contentSize?: number;
  recordedAt?: string;
  thumbnailUrl?: string;
};

export type KarteImageListResult = {
  ok: boolean;
  status: number;
  endpoint: string;
  list: KarteImageListItem[];
  page?: number;
  total?: number;
  meta?: Record<string, unknown>;
  runId?: string;
  traceId?: string;
  error?: string;
  errorCode?: string;
  message?: string;
};

export type KarteImageDetailResult = {
  ok: boolean;
  status: number;
  endpoint: string;
  payload?: Record<string, unknown>;
  rawText?: string;
  runId?: string;
  traceId?: string;
  error?: string;
};

export type KarteAttachmentDetailResult = {
  ok: boolean;
  status: number;
  endpoint: string;
  payload?: Record<string, unknown>;
  rawText?: string;
  runId?: string;
  traceId?: string;
  error?: string;
};

export type KarteAttachmentPayload = {
  id?: number;
  fileName?: string;
  contentType?: string;
  contentSize?: number;
  lastModified?: number;
  digest?: string;
  title?: string;
  uri?: string;
  extension?: string;
  memo?: string;
  bytes?: string;
};

export type KarteDocumentAttachmentPayload = {
  id?: number;
  status?: string;
  docInfoModel?: Record<string, unknown>;
  userModel?: { id: number; commonName?: string };
  karteBean?: { id: number };
  attachment: KarteAttachmentPayload[];
};

export type KarteAttachmentReference = {
  id: number;
  title?: string;
  fileName?: string;
  contentType?: string;
  contentSize?: number;
  recordedAt?: string;
};

export type AttachmentValidationError = {
  kind: 'missing' | 'size' | 'extension' | 'missing-extension' | 'content-type-mismatch';
  message: string;
  fileName?: string;
  extension?: string;
  size?: number;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  contentType?: string;
};

export type AttachmentValidationOptions = {
  maxSizeBytes?: number;
  allowedExtensions?: string[];
};

export type AttachmentValidationResult = {
  ok: boolean;
  errors: AttachmentValidationError[];
};

export type KarteDocumentSendResult = {
  ok: boolean;
  status: number;
  endpoint: string;
  docPk: number;
  payload?: Record<string, unknown>;
  rawText?: string;
  runId?: string;
  traceId?: string;
  error?: string;
  reasonCode?: string;
  messageDetail?: string;
  validationErrors?: AttachmentValidationError[];
};

export type UploadProgressMode = 'real' | 'indeterminate';

export type UploadProgressEvent = {
  mode: UploadProgressMode;
  loaded?: number;
  total?: number;
  percent?: number;
};

export const IMAGE_ATTACHMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const IMAGE_ATTACHMENT_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'webp'];

const normalizeExtension = (value?: string) => (value ? value.replace(/^\./, '').trim().toLowerCase() : undefined);

const extensionToContentType: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

const resolveExtensionFromContentType = (contentType?: string) => {
  if (!contentType) return undefined;
  const normalized = contentType.toLowerCase();
  return Object.entries(extensionToContentType).find(([, value]) => value === normalized)?.[0];
};

const resolveExtension = (attachment: KarteAttachmentPayload) => {
  const direct = normalizeExtension(attachment.extension);
  if (direct) return direct;
  if (!attachment.fileName) return undefined;
  const idx = attachment.fileName.lastIndexOf('.');
  if (idx < 0) return undefined;
  return normalizeExtension(attachment.fileName.slice(idx + 1));
};

const logImageApiAudit = (params: {
  operation: 'list' | 'detail' | 'attachment' | 'document';
  endpoint: string;
  ok: boolean;
  status: number;
  runId?: string;
  traceId?: string;
  details?: Record<string, unknown>;
}) => {
  logAuditEvent({
    runId: params.runId,
    traceId: params.traceId,
    payload: {
      action: 'image_api_call',
      outcome: params.ok ? 'success' : 'error',
      details: {
        operation: params.operation,
        endpoint: params.endpoint,
        status: params.status,
        runId: params.runId,
        traceId: params.traceId,
        ...params.details,
      },
    },
  });
};

const parsePositiveDocPk = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

const extractDocPk = (payload?: Record<string, unknown>, rawText?: string) =>
  parsePositiveDocPk((payload?.payload as Record<string, unknown> | undefined)?.docPk) ??
  parsePositiveDocPk(payload ? payload.docPk : undefined) ??
  parsePositiveDocPk(rawText);

// Validation policy:
// - Missing extension is allowed only when contentType is image/* and maps to a known extension.
// - contentType and extension must match when both are present (image/* only).
export function validateAttachmentPayload(
  attachments: KarteAttachmentPayload[],
  options: AttachmentValidationOptions = {},
): AttachmentValidationResult {
  const maxSizeBytes = options.maxSizeBytes ?? IMAGE_ATTACHMENT_MAX_SIZE_BYTES;
  const allowedExtensions = options.allowedExtensions ?? IMAGE_ATTACHMENT_ALLOWED_EXTENSIONS;
  const errors: AttachmentValidationError[] = [];

  attachments.forEach((attachment) => {
    const isReference = attachment.id !== undefined && !attachment.bytes;
    if (isReference) return;
    const fileName = attachment.fileName;
    const size = attachment.contentSize;
    const extension = resolveExtension(attachment);
    const contentType = attachment.contentType?.trim().toLowerCase();

    if (!attachment.bytes || !attachment.contentType || !fileName) {
      errors.push({
        kind: 'missing',
        message: '添付ファイルの必須メタデータが不足しています。',
        fileName,
      });
    }

    if (typeof size === 'number' && size > maxSizeBytes) {
      errors.push({
        kind: 'size',
        message: `添付ファイルが最大サイズ(${maxSizeBytes} bytes)を超えています。`,
        fileName,
        size,
        maxSizeBytes,
      });
    }

    if (!extension && contentType?.startsWith('image/')) {
      const inferred = resolveExtensionFromContentType(contentType);
      if (!inferred) {
        errors.push({
          kind: 'missing-extension',
          message: '拡張子が未指定のため判定できません。',
          fileName,
          contentType,
        });
      } else if (!allowedExtensions.includes(inferred)) {
        errors.push({
          kind: 'extension',
          message: `許可されていない拡張子です。(${inferred})`,
          fileName,
          extension: inferred,
          allowedExtensions,
          contentType,
        });
      }
    }

    if (extension && !allowedExtensions.includes(extension)) {
      errors.push({
        kind: 'extension',
        message: `許可されていない拡張子です。(${extension})`,
        fileName,
        extension,
        allowedExtensions,
        contentType,
      });
    }

    if (extension && contentType && contentType.startsWith('image/')) {
      const expected = extensionToContentType[extension];
      if (expected && expected !== contentType) {
        errors.push({
          kind: 'content-type-mismatch',
          message: `contentType と拡張子が一致しません。(${contentType} != ${expected})`,
          fileName,
          extension,
          contentType,
        });
      }
    }
  });

  return { ok: errors.length === 0, errors };
}

export const buildAttachmentReferencePayload = (params: {
  attachments: KarteAttachmentReference[];
  patientId?: string;
  title?: string;
  memo?: string;
  recordedAt?: string;
  documentType?: string;
}): KarteDocumentAttachmentPayload => {
  const recordedAt = params.recordedAt ?? new Date().toISOString();
  return {
    status: 'temp',
    docInfoModel: {
      title: params.title ?? '文書添付',
      patientId: params.patientId,
      recordedAt,
      documentType: params.documentType,
    },
    attachment: params.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      contentSize: attachment.contentSize,
      title: attachment.title ?? attachment.fileName ?? `attachment-${attachment.id}`,
      memo: params.memo,
    })),
  };
};

const parseMaybeJson = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return { json: undefined as Record<string, unknown> | undefined, text: undefined as string | undefined };
  }
  try {
    return { json: JSON.parse(text) as Record<string, unknown>, text };
  } catch {
    return { json: undefined as Record<string, unknown> | undefined, text };
  }
};

export async function fetchKarteImageList(params: {
  chartId?: string;
  karteId?: string;
  from?: string;
  to?: string;
  allowTypoFallback?: boolean;
}): Promise<KarteImageListResult> {
  const patientId = params.chartId ?? params.karteId;
  if (!patientId) {
    const meta = ensureObservabilityMeta();
    return {
      ok: false,
      status: 0,
      endpoint: '/patients/{patientId}/images',
      list: [],
      runId: meta.runId,
      traceId: meta.traceId,
      error: 'patient_id_required',
      errorCode: 'patient_id_required',
      message: '患者IDが必要です。',
    };
  }
  const response = await fetchPatientImages(patientId);
  const list = response.list.map((item) => ({
    id: item.imageId,
    title: item.fileName,
    fileName: item.fileName,
    contentType: item.contentType,
    contentSize: item.size,
    recordedAt: item.createdAt,
    thumbnailUrl: item.downloadUrl,
  }));
  const result: KarteImageListResult = {
    ok: response.ok,
    status: response.status,
    endpoint: response.endpoint,
    list,
    page: 1,
    total: list.length,
    runId: response.runId,
    traceId: response.traceId,
    error: response.error,
    errorCode: response.errorCode,
    message: response.message,
  };

  logImageApiAudit({
    operation: 'list',
    endpoint: response.endpoint,
    ok: result.ok,
    status: result.status,
    runId: result.runId,
    traceId: result.traceId,
    details: {
      recordsReturned: list.length,
      page: 1,
      total: list.length,
    },
  });

  return result;
}

export async function fetchKarteImageDetail(id: number | string): Promise<KarteImageDetailResult> {
  const metaBefore = ensureObservabilityMeta();
  const endpoint = `${IMAGE_DETAIL_ENDPOINT}/${encodeURIComponent(String(id))}`;
  const response = await httpFetch(endpoint, { method: 'GET' });
  const parsed = await parseMaybeJson(response);
  const metaAfter = getObservabilityMeta();
  const result: KarteImageDetailResult = {
    ok: response.ok,
    status: response.status,
    endpoint,
    payload: parsed.json,
    rawText: parsed.text,
    runId: metaAfter.runId ?? metaBefore.runId,
    traceId: metaAfter.traceId ?? metaBefore.traceId,
    error: response.ok ? undefined : `HTTP ${response.status}`,
  };

  logImageApiAudit({
    operation: 'detail',
    endpoint,
    ok: result.ok,
    status: result.status,
    runId: result.runId,
    traceId: result.traceId,
    details: { imageId: id },
  });

  return result;
}

export async function fetchKarteAttachmentDetail(id: number | string): Promise<KarteAttachmentDetailResult> {
  const metaBefore = ensureObservabilityMeta();
  const endpoint = `${ATTACHMENT_ENDPOINT}/${encodeURIComponent(String(id))}`;
  const response = await httpFetch(endpoint, { method: 'GET' });
  const parsed = await parseMaybeJson(response);
  const metaAfter = getObservabilityMeta();
  const result: KarteAttachmentDetailResult = {
    ok: response.ok,
    status: response.status,
    endpoint,
    payload: parsed.json,
    rawText: parsed.text,
    runId: metaAfter.runId ?? metaBefore.runId,
    traceId: metaAfter.traceId ?? metaBefore.traceId,
    error: response.ok ? undefined : `HTTP ${response.status}`,
  };

  logImageApiAudit({
    operation: 'attachment',
    endpoint,
    ok: result.ok,
    status: result.status,
    runId: result.runId,
    traceId: result.traceId,
    details: { attachmentId: id },
  });

  return result;
}

export async function sendKarteDocumentWithAttachments(
  payload: KarteDocumentAttachmentPayload,
  options: {
    method?: 'POST';
    validate?: boolean;
    validationOptions?: AttachmentValidationOptions;
  } = {},
): Promise<KarteDocumentSendResult> {
  const metaBefore = ensureObservabilityMeta();
  const validation = options.validate === false
    ? { ok: true, errors: [] }
    : validateAttachmentPayload(payload.attachment ?? [], options.validationOptions);

  if (!validation.ok) {
    const metaAfter = getObservabilityMeta();
    const result: KarteDocumentSendResult = {
      ok: false,
      status: 0,
      endpoint: DOCUMENT_ENDPOINT,
      docPk: INVALID_DOC_PK,
      runId: metaAfter.runId ?? metaBefore.runId,
      traceId: metaAfter.traceId ?? metaBefore.traceId,
      error: 'validation_failed',
      validationErrors: validation.errors,
    };
    logImageApiAudit({
      operation: 'document',
      endpoint: DOCUMENT_ENDPOINT,
      ok: false,
      status: 0,
      runId: result.runId,
      traceId: result.traceId,
      details: {
        attachmentsSent: payload.attachment?.length ?? 0,
        validationErrors: validation.errors.map((entry) => entry.message),
      },
    });
    return result;
  }

  const response = await httpFetch(DOCUMENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const parsed = await parseMaybeJson(response);
  const metaAfter = getObservabilityMeta();
  const resolvedDocPk = response.ok ? extractDocPk(parsed.json, parsed.text) : null;
  const ok = response.ok && resolvedDocPk !== null;
  const responsePayload = parsed.json && typeof parsed.json === 'object' ? (parsed.json as Record<string, unknown>) : {};
  const responseMessage =
    typeof responsePayload.apiResultMessage === 'string'
      ? responsePayload.apiResultMessage
      : typeof responsePayload.message === 'string'
        ? responsePayload.message
        : undefined;
  const result: KarteDocumentSendResult = {
    ok,
    status: response.status,
    endpoint: DOCUMENT_ENDPOINT,
    docPk: resolvedDocPk ?? INVALID_DOC_PK,
    payload: parsed.json,
    rawText: parsed.text,
    runId: metaAfter.runId ?? metaBefore.runId,
    traceId: metaAfter.traceId ?? metaBefore.traceId,
    error: !response.ok ? responseMessage ?? `HTTP ${response.status}` : resolvedDocPk === null ? 'invalid_doc_pk' : undefined,
    reasonCode:
      typeof responsePayload.reasonCode === 'string'
        ? responsePayload.reasonCode
        : typeof responsePayload.errorCode === 'string'
          ? responsePayload.errorCode
          : undefined,
    messageDetail: typeof responsePayload.messageDetail === 'string' ? responsePayload.messageDetail : undefined,
  };

  logImageApiAudit({
    operation: 'document',
    endpoint: DOCUMENT_ENDPOINT,
    ok: result.ok,
    status: result.status,
    runId: result.runId,
    traceId: result.traceId,
    details: {
      attachmentsSent: payload.attachment?.length ?? 0,
      documentId: resolvedDocPk ?? payload.id,
    },
  });

  return result;
}

const parseXhrHeaders = (xhr: XMLHttpRequest) => {
  const raw = xhr.getAllResponseHeaders?.() ?? '';
  const headers = new Headers();
  raw
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      const parts = line.split(': ');
      const key = parts.shift();
      if (!key) return;
      const value = parts.join(': ');
      headers.append(key, value);
    });
  return headers;
};

export function sendKarteDocumentWithAttachmentsViaXhr(
  payload: KarteDocumentAttachmentPayload,
  options: {
    method?: 'POST';
    onProgress?: (event: UploadProgressEvent) => void;
  } = {},
): Promise<KarteDocumentSendResult & { progressMode: UploadProgressMode }> {
  const metaBefore = ensureObservabilityMeta();
  const endpoint = DOCUMENT_ENDPOINT;
  const method = 'POST';
  const body = JSON.stringify(payload);
  let progressMode: UploadProgressMode = 'indeterminate';

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, endpoint, true);

    const headers = buildHttpHeaders({
      method,
      headers: { 'Content-Type': 'application/json' },
    }, endpoint);
    Object.entries(headers).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value);
    });

    const emitProgress = (event: UploadProgressEvent) => {
      progressMode = event.mode;
      options.onProgress?.(event);
    };

    if (xhr.upload && typeof xhr.upload.addEventListener === 'function') {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          emitProgress({ mode: 'real', loaded: event.loaded, total: event.total, percent });
          return;
        }
        emitProgress({ mode: 'indeterminate' });
      });
    } else {
      emitProgress({ mode: 'indeterminate' });
    }

    xhr.onload = () => {
      const headers = parseXhrHeaders(xhr);
      const response = new Response(xhr.responseText ?? '', {
        status: xhr.status,
        headers,
      });
      captureObservabilityFromResponse(response);
      const metaAfter = getObservabilityMeta();
      let payloadData: Record<string, unknown> | undefined;
      const rawText = xhr.responseText ?? '';
      if (rawText) {
        try {
          payloadData = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          payloadData = undefined;
        }
      }
      const resolvedDocPk = xhr.status >= 200 && xhr.status < 300 ? extractDocPk(payloadData, rawText) : null;
      const ok = xhr.status >= 200 && xhr.status < 300 && resolvedDocPk !== null;

      resolve({
        ok,
        status: xhr.status,
        endpoint,
        docPk: resolvedDocPk ?? INVALID_DOC_PK,
        payload: payloadData,
        rawText,
        runId: metaAfter.runId ?? metaBefore.runId,
        traceId: metaAfter.traceId ?? metaBefore.traceId,
        error: xhr.status >= 200 && xhr.status < 300
          ? resolvedDocPk === null ? 'invalid_doc_pk' : undefined
          : `HTTP ${xhr.status}`,
        progressMode,
      });
    };

    xhr.onerror = () => {
      const metaAfter = getObservabilityMeta();
      resolve({
        ok: false,
        status: 0,
        endpoint,
        docPk: INVALID_DOC_PK,
        runId: metaAfter.runId ?? metaBefore.runId,
        traceId: metaAfter.traceId ?? metaBefore.traceId,
        error: 'network_error',
        progressMode,
      });
    };

    xhr.ontimeout = () => {
      const metaAfter = getObservabilityMeta();
      resolve({
        ok: false,
        status: 0,
        endpoint,
        docPk: INVALID_DOC_PK,
        runId: metaAfter.runId ?? metaBefore.runId,
        traceId: metaAfter.traceId ?? metaBefore.traceId,
        error: 'timeout',
        progressMode,
      });
    };

    xhr.send(body);
  });
}
