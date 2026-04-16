import type { ChartsPrintMeta } from './outpatientClinicalDocument';
import type { DocumentType } from '../documentTemplates';
import { buildScopedStorageKey, type StorageScope } from '../../../libs/session/storageScope';

export type DocumentOutputMode = 'print' | 'pdf';

export type DocumentPrintEntry = {
  id: string;
  type: DocumentType;
  issuedAt: string;
  title: string;
  savedAt: string;
  templateId: string;
  templateLabel: string;
  form: Record<string, string>;
  patientId: string;
};

export type DocumentPrintPreviewState = {
  document: DocumentPrintEntry;
  meta: ChartsPrintMeta;
  actor: string;
  facilityId: string;
  initialOutputMode?: DocumentOutputMode;
};

const OUTPUT_RESULT_BASE = 'opendolphin:web-client:charts:printResult:document';
const STORAGE_VERSION = 'v2';
const LEGACY_OUTPUT_KEY = `${OUTPUT_RESULT_BASE}:v1`;

type ScopedIdentity = {
  facilityId: string;
  userId: string;
};

const normalizeText = (value?: string) => value?.trim() ?? '';

const resolveScopedIdentity = (scope?: StorageScope): ScopedIdentity | null => {
  const facilityId = normalizeText(scope?.facilityId);
  const userId = normalizeText(scope?.userId);
  if (!facilityId || !userId) return null;
  return { facilityId, userId };
};

const resolveScopedKey = (base: string, scope?: StorageScope): string | null => {
  const scopedIdentity = resolveScopedIdentity(scope);
  if (!scopedIdentity) return null;
  return buildScopedStorageKey(base, STORAGE_VERSION, scopedIdentity);
};

export type DocumentOutputResult = {
  documentId: string;
  outcome: 'success' | 'failed' | 'blocked' | 'completed';
  mode?: DocumentOutputMode;
  at: string;
  detail?: string;
  runId?: string;
  traceId?: string;
  endpoint?: string;
  httpStatus?: number;
};

export function saveDocumentPrintPreview(_value: DocumentPrintPreviewState, _scope?: StorageScope) {
  // Print preview is route-state only. Do not persist patient-specific preview state.
}

export function loadDocumentPrintPreview(
  _scope?: StorageScope,
): { value: DocumentPrintPreviewState; storedAt: string } | null {
  return null;
}

export function clearDocumentPrintPreview(_scope?: StorageScope) {
  // Route-state only. No persisted preview state to clear.
}

export function saveDocumentOutputResult(value: DocumentOutputResult, scope?: StorageScope) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const key = resolveScopedKey(OUTPUT_RESULT_BASE, scope);
    if (!key) {
      sessionStorage.removeItem(LEGACY_OUTPUT_KEY);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify(value));
    sessionStorage.removeItem(LEGACY_OUTPUT_KEY);
  } catch {
    // ignore
  }
}

export function loadDocumentOutputResult(scope?: StorageScope): DocumentOutputResult | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const scopedKey = resolveScopedKey(OUTPUT_RESULT_BASE, scope);
    if (!scopedKey) return null;
    const raw = sessionStorage.getItem(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DocumentOutputResult;
    if (!parsed || typeof parsed !== 'object' || !parsed.documentId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDocumentOutputResult(scope?: StorageScope) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const key = resolveScopedKey(OUTPUT_RESULT_BASE, scope);
    if (key) {
      sessionStorage.removeItem(key);
    }
    sessionStorage.removeItem(LEGACY_OUTPUT_KEY);
  } catch {
    // ignore
  }
}
