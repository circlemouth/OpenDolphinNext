import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta } from '../../libs/observability/observability';

export type OrcaReportType =
  | 'prescription'
  | 'medicinenotebook'
  | 'karteno1'
  | 'karteno3'
  | 'invoicereceipt'
  | 'statement';

export const ORCA_REPORT_LABELS: Record<OrcaReportType, string> = {
  prescription: '処方箋',
  medicinenotebook: 'お薬手帳',
  karteno1: 'カルテ1号紙（外来）',
  karteno3: 'カルテ3号紙（外来）',
  invoicereceipt: '請求書兼領収書',
  statement: '診療費明細書',
};

export type OrcaReportRequest = {
  patientId: string;
  invoiceNumber?: string;
  outsideClass?: string;
  orderClass?: string;
  departmentCode?: string;
  insuranceCombinationNumber?: string;
  performMonth?: string;
  startDay?: string;
  lastPageNumber?: string;
  lastRowNumber?: string;
};

export type OrcaReportResponse = {
  ok: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  informationDate?: string;
  informationTime?: string;
  dataId?: string;
  formId?: string;
  formName?: string;
  runId?: string;
  traceId?: string;
  error?: string;
};

export type OrcaReportPdfResult = {
  ok: boolean;
  status: number;
  pdfBlob?: Blob;
  runId?: string;
  traceId?: string;
  dataId?: string;
  error?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

export function buildOrcaReportRequest(type: OrcaReportType, params: OrcaReportRequest): OrcaReportRequest {
  return {
    patientId: params.patientId,
    invoiceNumber: params.invoiceNumber,
    outsideClass:
      type === 'prescription' || type === 'medicinenotebook' ? (params.outsideClass ?? 'False') : undefined,
    orderClass: type === 'karteno1' || type === 'karteno3' ? (params.orderClass ?? '1') : undefined,
    departmentCode: params.departmentCode,
    insuranceCombinationNumber: params.insuranceCombinationNumber,
    performMonth: params.performMonth,
    startDay: params.startDay,
    lastPageNumber: params.lastPageNumber,
    lastRowNumber: params.lastRowNumber,
  };
}

export async function postOrcaReport(type: OrcaReportType, request: OrcaReportRequest): Promise<OrcaReportResponse> {
  const runId = getObservabilityMeta().runId;
  const response = await httpFetch(resolveOrcaReportEndpoint(type), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });
  const json = asRecord(await response.json().catch(() => ({}))) ?? {};

  return {
    ok: Boolean(json.ok ?? response.ok),
    status: response.status,
    apiResult: asString(json.apiResult),
    apiResultMessage: asString(json.apiResultMessage),
    informationDate: asString(json.informationDate),
    informationTime: asString(json.informationTime),
    dataId: asString(json.dataId),
    formId: asString(json.formId),
    formName: asString(json.formName),
    runId: asString(json.runId) ?? getObservabilityMeta().runId ?? runId,
    traceId: asString(json.traceId) ?? getObservabilityMeta().traceId,
    error: asString(json.error),
  };
}

const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

const isPdfBytes = (bytes: Uint8Array) => {
  if (bytes.length < PDF_SIGNATURE.length) return false;
  for (let i = 0; i < PDF_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PDF_SIGNATURE[i]) return false;
  }
  return true;
};

const readUint32 = (view: DataView, offset: number) => view.getUint32(offset, true);
const readUint16 = (view: DataView, offset: number) => view.getUint16(offset, true);

const extractPdfFromZip = async (buffer: ArrayBuffer): Promise<Uint8Array> => {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const textDecoder = new TextDecoder('utf-8');

  while (offset + 30 <= bytes.length) {
    const signature = readUint32(view, offset);
    if (signature !== 0x04034b50) {
      break;
    }
    const flags = readUint16(view, offset + 6);
    const compression = readUint16(view, offset + 8);
    const compressedSize = readUint32(view, offset + 18);
    const fileNameLength = readUint16(view, offset + 26);
    const extraLength = readUint16(view, offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const extraStart = nameEnd + extraLength;
    const dataStart = extraStart;
    const dataEnd = dataStart + compressedSize;
    if (nameEnd > bytes.length || dataEnd > bytes.length) {
      break;
    }
    const fileName = textDecoder.decode(bytes.slice(nameStart, nameEnd));
    if (fileName.toLowerCase().endsWith('.pdf')) {
      if (compression === 0) {
        return bytes.slice(dataStart, dataEnd);
      }
      if (compression === 8) {
        if (!('DecompressionStream' in globalThis)) {
          throw new Error('zip 解凍に対応していない環境のため PDF を表示できません。');
        }
        if ((flags & 0x08) !== 0) {
          throw new Error('ZIP のサイズ情報が不足しているため PDF を展開できません。');
        }
        const stream = new Blob([bytes.slice(dataStart, dataEnd)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
        return decompressed;
      }
    }
    offset = dataEnd;
  }
  throw new Error('PDF を含む blob を解析できませんでした。');
};

export async function fetchOrcaReportPdf(dataId: string): Promise<OrcaReportPdfResult> {
  const runId = getObservabilityMeta().runId;
  const response = await httpFetch(`/blobapi/${dataId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/octet-stream',
    },
  });
  const buffer = await response.arrayBuffer();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      runId: getObservabilityMeta().runId ?? runId,
      traceId: getObservabilityMeta().traceId,
      dataId,
      error: `blobapi failed (HTTP ${response.status})`,
    };
  }
  const bytes = new Uint8Array(buffer);
  try {
    const pdfBytes = isPdfBytes(bytes) ? bytes : await extractPdfFromZip(buffer);
    const pdfBuffer = pdfBytes.byteLength ? pdfBytes.slice().buffer : new ArrayBuffer(0);
    return {
      ok: true,
      status: response.status,
      pdfBlob: new Blob([pdfBuffer], {
        type: 'application/pdf',
      }),
      runId: getObservabilityMeta().runId ?? runId,
      traceId: getObservabilityMeta().traceId,
      dataId,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'blobapi PDF extract failed';
    return {
      ok: false,
      status: response.status,
      runId: getObservabilityMeta().runId ?? runId,
      traceId: getObservabilityMeta().traceId,
      dataId,
      error: detail,
    };
  }
}

export const resolveOrcaReportEndpoint = (type: OrcaReportType) => `/api/orca/official/reports/${type}`;
