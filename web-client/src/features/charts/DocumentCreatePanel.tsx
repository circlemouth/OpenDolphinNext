import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { logUiState } from '../../libs/audit/auditLogger';
import { readStoredAuth, resolveAuditActor } from '../../libs/auth/storedAuth';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { hasStoredAuth } from '../../libs/http/httpClient';
import { ensureObservabilityMeta, resolveAriaLive } from '../../libs/observability/observability';
import {
  buildAttachmentReferencePayload,
  sendKarteDocumentWithAttachments,
  IMAGE_ATTACHMENT_MAX_SIZE_BYTES,
  type KarteAttachmentReference,
} from '../images/api';
import type { StorageScope } from '../../libs/session/storageScope';
import { recordChartsAuditEvent, type ChartsOperationPhase } from './audit';
import type { DataSourceTransition } from './authService';
import {
  DOCUMENT_TEMPLATES,
  DOCUMENT_TYPE_LABELS,
  getTemplateById,
  type DocumentType,
} from './documentTemplates';
import {
  clearDocumentOutputResult,
  loadDocumentOutputResult,
  saveDocumentPrintPreview,
  type DocumentOutputResult,
  type DocumentOutputMode,
} from './print/documentPrintPreviewStorage';
import { useOptionalSession } from '../../AppRouter';
import { useAppNavigation } from '../../routes/useAppNavigation';
import { readStoredSession } from '../../libs/session/storedSession';
import {
  deleteLetter,
  type LetterDatePayload,
  fetchKarteIdByPatientId,
  fetchLetterDetail,
  fetchLetterList,
  saveLetterModule,
  type LetterItemPayload,
  type LetterModulePayload,
  type LetterTextPayload,
} from './letterApi';
import { resolveUserSafeFetchFailure } from './userSafeErrorCopy';

export type DocumentCreatePanelMeta = {
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  visitDate?: string;
  actorRole?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
};

export type DocumentOpenIntent = 'edit' | 'preview' | DocumentOutputMode;

export type DocumentOpenRequest = {
  requestId?: string;
  intent?: DocumentOpenIntent;
  documentId?: number;
  letterId?: number;
  query?: string;
  source?: string;
};

export type DocumentCreatePanelProps = {
  patientId?: string;
  meta: DocumentCreatePanelMeta;
  onClose?: () => void;
  onStateChange?: (next: {
    dirty: boolean;
    attachmentCount: number;
    isSaving: boolean;
    hasError: boolean;
  }) => void;
  imageAttachments?: KarteAttachmentReference[];
  onImageAttachmentsChange?: (next: KarteAttachmentReference[]) => void;
  onImageAttachmentsClear?: () => void;
  openRequest?: DocumentOpenRequest | null;
  historyCopyRequest?: { requestId: string; letterId: number } | null;
  onHistoryCopyConsumed?: (requestId: string) => void;
};

type ReferralFormState = {
  issuedAt: string;
  templateId: string;
  hospital: string;
  department: string;
  doctor: string;
  purpose: string;
  diagnosis: string;
  body: string;
};

type CertificateFormState = {
  issuedAt: string;
  templateId: string;
  submitTo: string;
  diagnosis: string;
  purpose: string;
  body: string;
};

type ReplyFormState = {
  issuedAt: string;
  templateId: string;
  hospital: string;
  department: string;
  doctor: string;
  summary: string;
};

type DocumentFormState = {
  referral: ReferralFormState;
  certificate: CertificateFormState;
  reply: ReplyFormState;
};

type SavedDocument = {
  id: string;
  letterId?: number;
  type: DocumentType;
  issuedAt: string;
  title: string;
  savedAt: string;
  templateId: string;
  templateLabel: string;
  form: DocumentFormState[DocumentType];
  patientId: string;
  documentId?: number;
  attachmentIds?: number[];
  detailLoaded?: boolean;
  outputAudit?: {
    status: 'success' | 'failed' | 'blocked' | 'started' | 'completed';
    mode?: DocumentOutputMode;
    at: string;
    detail?: string;
    runId?: string;
    traceId?: string;
    endpoint?: string;
    httpStatus?: number;
  };
};

const PRINT_HELP_URL = 'https://support.google.com/chrome/answer/1069693?hl=ja';
const LETTER_ITEM_TEMPLATE_ID = 'webTemplateId';
const LETTER_ITEM_TEMPLATE_LABEL = 'webTemplateLabel';
const LETTER_ITEM_DOCUMENT_ID = 'webDocumentId';
const LETTER_ITEM_ATTACHMENT_IDS = 'webAttachmentIds';
const LETTER_ITEM_SUBMIT_TO = 'webSubmitTo';
const LETTER_ITEM_PURPOSE = 'purpose';
const LETTER_ITEM_DISEASE = 'disease';
const LETTER_ITEM_ISSUED_AT = 'webIssuedAtDate';
const LETTER_ITEM_VISITED_DATE = 'visitedDate';
const LETTER_ITEM_VISITED = 'visited';
const LETTER_TEXT_PAST_FAMILY = 'pastFamily';
const LETTER_TEXT_CLINICAL_COURSE = 'clinicalCourse';
const LETTER_TEXT_MEDICATION = 'medication';
const LETTER_TEXT_INFORMED_CONTENT = 'informedContent';
const LETTER_DATE_ISSUED_AT = 'issuedAt';
const HANDLE_CLASS_REFERRAL = 'open.dolphin.letter.LetterViewer';
const HANDLE_CLASS_REPLY1 = 'open.dolphin.letter.Reply1Viewer';
const HANDLE_CLASS_REPLY2 = 'open.dolphin.letter.Reply2Viewer';
const HANDLE_CLASS_CERTIFICATE = 'open.dolphin.letter.MedicalCertificateViewer';
const LETTER_TYPE_REFERRAL = 'client';
const LETTER_TYPE_REPLY = 'consultant';
const LETTER_TYPE_CERTIFICATE = 'medicalCertificate';

const DOCUMENT_TYPES: { type: DocumentType; label: string; hint: string }[] = [
  { type: 'referral', label: DOCUMENT_TYPE_LABELS.referral, hint: '宛先・目的・診断名を入力して保存します。' },
  { type: 'certificate', label: DOCUMENT_TYPE_LABELS.certificate, hint: '提出先と診断内容を記録します。' },
  { type: 'reply', label: DOCUMENT_TYPE_LABELS.reply, hint: '紹介元への返信内容を簡潔にまとめます。' },
];

const buildEmptyForms = (today: string): DocumentFormState => ({
  referral: {
    issuedAt: today,
    templateId: '',
    hospital: '',
    department: '',
    doctor: '',
    purpose: '',
    diagnosis: '',
    body: '',
  },
  certificate: {
    issuedAt: today,
    templateId: '',
    submitTo: '',
    diagnosis: '',
    purpose: '',
    body: '',
  },
  reply: {
    issuedAt: today,
    templateId: '',
    hospital: '',
    department: '',
    doctor: '',
    summary: '',
  },
});

const resolveOutputAuditStatus = (
  outcome: DocumentOutputResult['outcome'],
): NonNullable<SavedDocument['outputAudit']>['status'] => {
  if (outcome === 'success') return 'success';
  if (outcome === 'blocked') return 'blocked';
  if (outcome === 'completed') return 'completed';
  return 'failed';
};

const buildDocumentSummary = (type: DocumentType, form: DocumentFormState): string => {
  if (type === 'referral') {
    return form.referral.hospital || '宛先未設定の紹介状';
  }
  if (type === 'certificate') {
    return form.certificate.submitTo || '提出先未設定の診断書';
  }
  return form.reply.hospital || '返信先未設定の返信書';
};

const resolveRequiredFields = (type: DocumentType): { key: string; label: string }[] => {
  if (type === 'referral') {
    return [
      { key: 'issuedAt', label: '発行日' },
      { key: 'templateId', label: 'テンプレート' },
      { key: 'hospital', label: '宛先医療機関' },
      { key: 'doctor', label: '宛先医師' },
      { key: 'purpose', label: '紹介目的' },
      { key: 'diagnosis', label: '主病名' },
      { key: 'body', label: '紹介内容' },
    ];
  }
  if (type === 'certificate') {
    return [
      { key: 'issuedAt', label: '発行日' },
      { key: 'templateId', label: 'テンプレート' },
      { key: 'submitTo', label: '提出先' },
      { key: 'diagnosis', label: '診断名' },
      { key: 'purpose', label: '用途' },
      { key: 'body', label: '所見' },
    ];
  }
  return [
    { key: 'issuedAt', label: '発行日' },
    { key: 'templateId', label: 'テンプレート' },
    { key: 'hospital', label: '返信先医療機関' },
    { key: 'doctor', label: '返信先医師' },
    { key: 'summary', label: '返信内容' },
  ];
};

const resolveMissingFields = (type: DocumentType, form: DocumentFormState): string[] => {
  const required = resolveRequiredFields(type);
  const payload = form[type];
  return required
    .filter((field) => {
      const value = (payload as Record<string, string>)[field.key];
      return !value || value.trim().length === 0;
    })
    .map((field) => field.label);
};

const formatLocalDateYmd = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const resolveDateOnlyText = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const asDateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (asDateOnly) return asDateOnly[1];
  return undefined;
};

const resolveLocalDate = (value?: string): string | undefined => {
  const dateOnly = resolveDateOnlyText(value);
  if (dateOnly) return dateOnly;
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatLocalDateYmd(date);
};

const toLocalDateTime = (value?: string): string => `${resolveLocalDate(value) ?? formatLocalDateYmd(new Date())}T00:00:00`;

const buildItemMap = (items?: LetterItemPayload[] | null): Map<string, string> => {
  const map = new Map<string, string>();
  if (!items) return map;
  items.forEach((item) => {
    if (!item?.name) return;
    map.set(item.name, item.value ?? '');
  });
  return map;
};

const buildTextMap = (texts?: LetterTextPayload[] | null): Map<string, string> => {
  const map = new Map<string, string>();
  if (!texts) return map;
  texts.forEach((text) => {
    if (!text?.name) return;
    map.set(text.name, text.textValue ?? '');
  });
  return map;
};

const buildDateMap = (dates?: LetterDatePayload[] | null): Map<string, string> => {
  const map = new Map<string, string>();
  if (!dates) return map;
  dates.forEach((date) => {
    if (!date?.name) return;
    map.set(date.name, date.value ?? '');
  });
  return map;
};

const parseAttachmentIds = (raw?: string): number[] | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
  } catch {
    // ignore parse error
  }
  const fallback = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  return fallback.length > 0 ? fallback : undefined;
};

const resolveDocumentType = (letterType?: string): DocumentType => {
  if (letterType === LETTER_TYPE_CERTIFICATE) return 'certificate';
  if (letterType === LETTER_TYPE_REPLY) return 'reply';
  return 'referral';
};

const resolveTemplateMeta = (type: DocumentType, templateId: string, fallbackLabel?: string) => {
  const template = getTemplateById(type, templateId);
  return {
    templateId,
    templateLabel: template?.label ?? fallbackLabel ?? '未選択',
  };
};

const normalizeUserName = (facilityId?: string | null, userId?: string | null) => {
  if (!facilityId || !userId) return null;
  const prefix = `${facilityId}:`;
  return userId.startsWith(prefix) ? userId : `${facilityId}:${userId}`;
};

const mapLetterToDocument = (letter: LetterModulePayload, fallbackIssuedAt: string): SavedDocument => {
  const type = resolveDocumentType(letter.letterType);
  const itemMap = buildItemMap(letter.letterItems);
  const textMap = buildTextMap(letter.letterTexts);
  const dateMap = buildDateMap(letter.letterDates);
  const issuedAt =
    resolveDateOnlyText(itemMap.get(LETTER_ITEM_ISSUED_AT)) ??
    resolveDateOnlyText(dateMap.get(LETTER_DATE_ISSUED_AT)) ??
    resolveLocalDate(letter.started) ??
    resolveLocalDate(letter.confirmed) ??
    resolveLocalDate(letter.recorded) ??
    fallbackIssuedAt;
  const templateId =
    itemMap.get(LETTER_ITEM_TEMPLATE_ID) ??
    itemMap.get('templateId') ??
    '';
  const templateLabelFallback =
    itemMap.get(LETTER_ITEM_TEMPLATE_LABEL) ??
    itemMap.get('templateLabel') ??
    undefined;
  const { templateLabel } = resolveTemplateMeta(type, templateId, templateLabelFallback);
  const form: DocumentFormState[DocumentType] =
    type === 'referral'
      ? {
          issuedAt,
          templateId,
          hospital: letter.consultantHospital ?? '',
          department: letter.consultantDept ?? '',
          doctor: letter.consultantDoctor ?? '',
          purpose: itemMap.get(LETTER_ITEM_PURPOSE) ?? '',
          diagnosis: itemMap.get(LETTER_ITEM_DISEASE) ?? '',
          body:
            textMap.get(LETTER_TEXT_CLINICAL_COURSE) ??
            textMap.get(LETTER_TEXT_PAST_FAMILY) ??
            textMap.get(LETTER_TEXT_MEDICATION) ??
            '',
        }
      : type === 'certificate'
        ? {
            issuedAt,
            templateId,
            submitTo: itemMap.get(LETTER_ITEM_SUBMIT_TO) ?? '',
            diagnosis: itemMap.get(LETTER_ITEM_DISEASE) ?? '',
            purpose: itemMap.get(LETTER_ITEM_PURPOSE) ?? '',
            body: textMap.get(LETTER_TEXT_INFORMED_CONTENT) ?? '',
          }
        : {
            issuedAt,
            templateId,
            hospital: letter.clientHospital ?? '',
            department: letter.clientDept ?? '',
            doctor: letter.clientDoctor ?? '',
            summary: textMap.get(LETTER_TEXT_INFORMED_CONTENT) ?? '',
          };
  const title = letter.title ?? buildDocumentSummary(type, { ...buildEmptyForms(issuedAt), [type]: form } as DocumentFormState);
  const savedAt = letter.recorded ?? letter.confirmed ?? letter.started ?? new Date().toISOString();
  const documentIdRaw = itemMap.get(LETTER_ITEM_DOCUMENT_ID);
  const attachmentIds = parseAttachmentIds(itemMap.get(LETTER_ITEM_ATTACHMENT_IDS));
  const documentId = documentIdRaw ? Number(documentIdRaw) : undefined;
  return {
    id: `letter-${letter.id ?? letter.linkId ?? Date.now()}`,
    letterId: letter.id,
    type,
    issuedAt,
    title,
    savedAt,
    templateId,
    templateLabel,
    form,
    patientId: letter.patientId ?? '',
    documentId: Number.isFinite(documentId ?? NaN) ? documentId : undefined,
    attachmentIds,
    detailLoaded: Boolean(letter.letterItems || letter.letterTexts || letter.letterDates),
  };
};

const buildLetterModulePayload = <T extends DocumentType>(params: {
  type: T;
  form: DocumentFormState[T];
  issuedAt: string;
  patientId: string;
  userPk: number;
  userName?: string | null;
  karteId: number;
  templateLabel: string;
  documentId?: number;
  attachmentIds?: number[];
  linkId?: number;
}): LetterModulePayload => {
  const items: LetterItemPayload[] = [];
  const texts: LetterTextPayload[] = [];
  const dates: LetterDatePayload[] = [];

  const pushItem = (name: string, value?: string | number | null) => {
    if (value === undefined || value === null) return;
    items.push({ name, value: String(value) });
  };
  const pushText = (name: string, value?: string | null) => {
    if (value === undefined || value === null) return;
    texts.push({ name, textValue: String(value) });
  };
  const pushDate = (name: string, value?: string | null) => {
    const resolved = resolveDateOnlyText(value ?? undefined);
    if (!resolved) return;
    dates.push({ name, value: resolved });
  };

  pushItem(LETTER_ITEM_TEMPLATE_ID, params.form.templateId);
  pushItem(LETTER_ITEM_TEMPLATE_LABEL, params.templateLabel);
  pushItem(LETTER_ITEM_ISSUED_AT, params.issuedAt);
  pushDate(LETTER_DATE_ISSUED_AT, params.issuedAt);
  if (params.documentId !== undefined) {
    pushItem(LETTER_ITEM_DOCUMENT_ID, params.documentId);
  }
  if (params.attachmentIds && params.attachmentIds.length > 0) {
    pushItem(LETTER_ITEM_ATTACHMENT_IDS, JSON.stringify(params.attachmentIds));
  }

  let letterType = LETTER_TYPE_REFERRAL;
  let handleClass = HANDLE_CLASS_REFERRAL;
  let consultantHospital: string | undefined;
  let consultantDept: string | undefined;
  let consultantDoctor: string | undefined;
  let clientHospital: string | undefined;
  let clientDept: string | undefined;
  let clientDoctor: string | undefined;

  if (params.type === 'referral') {
    const form = params.form as ReferralFormState;
    letterType = LETTER_TYPE_REFERRAL;
    handleClass = HANDLE_CLASS_REFERRAL;
    consultantHospital = form.hospital;
    consultantDept = form.department;
    consultantDoctor = form.doctor;
    pushItem(LETTER_ITEM_PURPOSE, form.purpose);
    pushItem(LETTER_ITEM_DISEASE, form.diagnosis);
    pushText(LETTER_TEXT_CLINICAL_COURSE, form.body);
  } else if (params.type === 'certificate') {
    const form = params.form as CertificateFormState;
    letterType = LETTER_TYPE_CERTIFICATE;
    handleClass = HANDLE_CLASS_CERTIFICATE;
    pushItem(LETTER_ITEM_SUBMIT_TO, form.submitTo);
    pushItem(LETTER_ITEM_DISEASE, form.diagnosis);
    pushItem(LETTER_ITEM_PURPOSE, form.purpose);
    pushText(LETTER_TEXT_INFORMED_CONTENT, form.body);
  } else {
    const form = params.form as ReplyFormState;
    letterType = LETTER_TYPE_REPLY;
    handleClass = form.templateId === 'REPLY-ODT-FU' ? HANDLE_CLASS_REPLY1 : HANDLE_CLASS_REPLY2;
    clientHospital = form.hospital;
    clientDept = form.department;
    clientDoctor = form.doctor;
    pushText(LETTER_TEXT_INFORMED_CONTENT, form.summary);
    const visitedName = form.templateId === 'REPLY-ODT-FU' ? LETTER_ITEM_VISITED_DATE : LETTER_ITEM_VISITED;
    pushItem(visitedName, params.issuedAt);
  }

  const issuedAtDateTime = toLocalDateTime(params.issuedAt);
  const payload: LetterModulePayload = {
    id: params.linkId ? 0 : undefined,
    linkId: params.linkId ?? 0,
    confirmed: issuedAtDateTime,
    started: issuedAtDateTime,
    recorded: issuedAtDateTime,
    status: 'F',
    title: buildDocumentSummary(params.type, { ...buildEmptyForms(params.issuedAt), [params.type]: params.form } as DocumentFormState),
    letterType,
    handleClass,
    clientHospital,
    clientDept,
    clientDoctor,
    consultantHospital,
    consultantDept,
    consultantDoctor,
    patientId: params.patientId,
    userModel: {
      id: params.userPk,
      userId: params.userName ?? undefined,
    },
    karteBean: {
      id: params.karteId,
    },
    letterItems: items,
    letterTexts: texts,
    letterDates: dates.length > 0 ? dates : undefined,
  };

  return payload;
};

export function DocumentCreatePanel({
  patientId,
  meta,
  onClose,
  onStateChange,
  imageAttachments,
  onImageAttachmentsChange,
  onImageAttachmentsClear,
  openRequest,
  historyCopyRequest,
  onHistoryCopyConsumed,
}: DocumentCreatePanelProps) {
  const session = useOptionalSession();
  const storageScope = useMemo<StorageScope | undefined>(() => {
    if (session?.facilityId && session?.userId) {
      return { facilityId: session.facilityId, userId: session.userId };
    }
    const stored = readStoredAuth();
    if (stored) return { facilityId: stored.facilityId, userId: stored.userId };
    return undefined;
  }, [session?.facilityId, session?.userId]);
  const userName = useMemo(() => {
    const sessionName = normalizeUserName(session?.facilityId, session?.userId);
    if (sessionName) return sessionName;
    const stored = readStoredAuth();
    return stored ? normalizeUserName(stored.facilityId, stored.userId) : null;
  }, [session?.facilityId, session?.userId]);
  const storedSession = useMemo(() => readStoredSession(), []);
  const appNav = useAppNavigation({ facilityId: session?.facilityId, userId: session?.userId });
  const today = useMemo(() => formatLocalDateYmd(new Date()), []);
  const [activeType, setActiveType] = useState<DocumentType>('referral');
  const [forms, setForms] = useState<DocumentFormState>(() => buildEmptyForms(today));
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveRetryable, setSaveRetryable] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savedDocs, setSavedDocs] = useState<SavedDocument[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [karteId, setKarteId] = useState<number | null | undefined>(undefined);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all');
  const [filterOutput, setFilterOutput] = useState<'all' | 'available' | 'blocked'>('all');
  const [filterAudit, setFilterAudit] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [filterPatient, setFilterPatient] = useState<'current' | 'all'>('current');
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<SavedDocument | null>(null);
  const lastOpenRequestRef = useRef<string | null>(null);
  const pendingOutputResultRef = useRef<DocumentOutputResult | null>(null);
  const historyRequestSeqRef = useRef(0);
  const historyPatientIdRef = useRef<string | undefined>(patientId);
  const observability = useMemo(() => ensureObservabilityMeta({ runId: meta.runId }), [meta.runId]);
  const resolvedRunId = observability.runId ?? meta.runId;
  const hasPermission = useMemo(() => hasStoredAuth(), []);
  const attachmentsForDocument = useMemo(() => imageAttachments ?? [], [imageAttachments]);
  const userPk = useMemo(() => {
    if (typeof session?.userPk === 'number' && Number.isFinite(session.userPk) && session.userPk > 0) {
      return session.userPk;
    }
    if (typeof storedSession?.userPk === 'number' && Number.isFinite(storedSession.userPk) && storedSession.userPk > 0) {
      return storedSession.userPk;
    }
    return null;
  }, [session?.userPk, storedSession?.userPk]);
  const blockReasons = useMemo(() => {
    const reasons: string[] = [];
    if (meta.readOnly) {
      reasons.push(meta.readOnlyReason ?? '閲覧専用のため文書作成はできません。');
    }
    if (meta.missingMaster) {
      reasons.push('マスター未同期のため文書作成はできません。');
    }
    if (meta.fallbackUsed) {
      reasons.push('フォールバックデータのため文書作成はできません。');
    }
    return reasons;
  }, [meta.fallbackUsed, meta.missingMaster, meta.readOnly, meta.readOnlyReason]);
  const isBlocked = blockReasons.length > 0;
  // 再送は「添付付き保存がサーバーエラーになった場合のみ」有効にする。
  const canRetrySave = saveRetryable && !isBlocked && !isSaving;
  const noticeLive = notice
    ? resolveAriaLive(notice.tone === 'info' ? 'info' : notice.tone === 'error' ? 'error' : 'success')
    : resolveAriaLive('info');
  const noticeRole = notice?.tone === 'error' ? 'alert' : 'status';
  const panelDirty = draftDirty || attachmentsForDocument.length > 0 || isSaving;

  const handleRemoveAttachment = useCallback(
    (attachmentId: number) => {
      if (!onImageAttachmentsChange) return;
      onImageAttachmentsChange(attachmentsForDocument.filter((attachment) => attachment.id !== attachmentId));
    },
    [attachmentsForDocument, onImageAttachmentsChange],
  );

  useEffect(() => {
    logUiState({
      action: 'navigate',
      screen: 'charts/document-create',
      runId: resolvedRunId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      details: {
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        documentType: activeType,
      },
    });
  }, [
    activeType,
    meta.appointmentId,
    meta.cacheHit,
    meta.dataSourceTransition,
    meta.fallbackUsed,
    meta.missingMaster,
    meta.patientId,
    meta.receptionId,
    meta.visitDate,
    resolvedRunId,
  ]);

  useEffect(() => {
    historyPatientIdRef.current = patientId;
    historyRequestSeqRef.current += 1;
  }, [patientId]);

  useEffect(() => {
    let active = true;
    if (!patientId) {
      setKarteId(null);
      setSavedDocs([]);
      setIsHistoryLoading(false);
      setHistoryLoaded(true);
      setHistoryError(null);
      setDraftDirty(false);
      return;
    }
    // patientId が切り替わった直後は karteId 未確定。履歴は karteId が確定してから取得する。
    setKarteId(undefined);
    setIsHistoryLoading(true);
    setHistoryLoaded(false);
    setHistoryError(null);
    fetchKarteIdByPatientId({ patientId }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setKarteId(null);
        setSavedDocs([]);
        setIsHistoryLoading(false);
        setHistoryLoaded(true);
        setHistoryError(result.error ?? 'カルテ情報の取得に失敗しました。');
        setDraftDirty(false);
        return;
      }
      setKarteId(result.karteId ?? null);
    });
    return () => {
      active = false;
    };
  }, [patientId]);

  useEffect(() => {
    onStateChange?.({
      dirty: panelDirty,
      attachmentCount: attachmentsForDocument.length,
      isSaving,
      hasError: notice?.tone === 'error',
    });
  }, [attachmentsForDocument.length, isSaving, notice?.tone, onStateChange, panelDirty]);

  useEffect(() => {
    const outputResult = loadDocumentOutputResult(storageScope);
    if (!outputResult) return;
    pendingOutputResultRef.current = outputResult;
    clearDocumentOutputResult(storageScope);
    const outcomeTone =
      outputResult.outcome === 'success'
        ? 'success'
        : outputResult.outcome === 'completed'
          ? 'info'
          : 'error';
    const outcomeLabel =
      outputResult.outcome === 'success'
        ? '成功'
        : outputResult.outcome === 'completed'
          ? '未判定'
          : '失敗';
    setNotice({
      tone: outcomeTone,
      message: `文書出力${outcomeLabel}: ${outputResult.detail ?? outputResult.mode ?? '出力処理'}`,
    });
    setSavedDocs((prev) => {
      const applied = prev.some((doc) => doc.id === outputResult.documentId);
      const next = prev.map((doc) => {
        if (doc.id !== outputResult.documentId) return doc;
        return {
          ...doc,
          outputAudit: {
            status: resolveOutputAuditStatus(outputResult.outcome),
            mode: outputResult.mode,
            at: outputResult.at,
            detail: outputResult.detail,
            runId: outputResult.runId,
            traceId: outputResult.traceId,
            endpoint: outputResult.endpoint,
            httpStatus: outputResult.httpStatus,
          },
        };
      });
      if (applied) pendingOutputResultRef.current = null;
      return next;
    });
    recordChartsAuditEvent({
      action: 'PRINT_DOCUMENT',
      outcome:
        outputResult.outcome === 'success'
          ? 'success'
          : outputResult.outcome === 'completed'
            ? 'warning'
            : 'error',
      subject: 'charts-document-output-result',
      note: outputResult.detail,
      runId: outputResult.runId ?? resolvedRunId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      details: {
        operationPhase: 'do',
        documentId: outputResult.documentId,
        outputMode: outputResult.mode,
        endpoint: outputResult.endpoint,
        httpStatus: outputResult.httpStatus,
        outcome: outputResult.outcome,
        traceId: outputResult.traceId,
      },
    });
  }, [
    meta.appointmentId,
    meta.cacheHit,
    meta.dataSourceTransition,
    meta.fallbackUsed,
    meta.missingMaster,
    meta.patientId,
    resolvedRunId,
  ]);

  useEffect(() => {
    const outputResult = pendingOutputResultRef.current;
    if (!outputResult) return;
    if (!savedDocs.some((doc) => doc.id === outputResult.documentId)) return;
    // 履歴ロード後に出力結果を反映（ロード時点で savedDocs が空だと取りこぼすため）
    setSavedDocs((prev) => {
      const applied = prev.some((doc) => doc.id === outputResult.documentId);
      if (!applied) return prev;
      pendingOutputResultRef.current = null;
      return prev.map((doc) => {
        if (doc.id !== outputResult.documentId) return doc;
        return {
          ...doc,
          outputAudit: {
            status: resolveOutputAuditStatus(outputResult.outcome),
            mode: outputResult.mode,
            at: outputResult.at,
            detail: outputResult.detail,
            runId: outputResult.runId,
            traceId: outputResult.traceId,
            endpoint: outputResult.endpoint,
            httpStatus: outputResult.httpStatus,
          },
        };
      });
    });
  }, [savedDocs]);

  const refreshDocumentHistory = useCallback(async () => {
    const requestSeq = ++historyRequestSeqRef.current;
    const requestPatientId = patientId;
    const isStaleRequest = () =>
      historyRequestSeqRef.current !== requestSeq || historyPatientIdRef.current !== requestPatientId;

    if (karteId === undefined) return;
    if (!karteId) {
      if (isStaleRequest()) return;
      setSavedDocs([]);
      setIsHistoryLoading(false);
      setHistoryLoaded(true);
      return;
    }
    if (isStaleRequest()) return;
    setIsHistoryLoading(true);
    setHistoryLoaded(false);
    setHistoryError(null);
    const listResult = await fetchLetterList({ karteId });
    if (isStaleRequest()) return;
    if (!listResult.ok) {
      setHistoryError(resolveUserSafeFetchFailure('文書履歴', listResult.error));
      setIsHistoryLoading(false);
      setHistoryLoaded(true);
      return;
    }

    const summaryDocs = listResult.letters.map((letter) => mapLetterToDocument(letter, today));
    if (isStaleRequest()) return;
    // まず一覧(サマリ)を即時反映して、検索/フィルタ UI をブロックしない。
    setSavedDocs((prev) => {
      const prevMap = new Map(prev.map((doc) => [doc.id, doc]));
      return summaryDocs.map((doc) => {
        const existing = prevMap.get(doc.id);
        if (!existing) return doc;
        const useExistingForm = !doc.detailLoaded && Boolean(existing.detailLoaded);
        return {
          ...doc,
          form: useExistingForm ? existing.form : doc.form,
          detailLoaded: doc.detailLoaded || existing.detailLoaded,
          documentId: doc.documentId ?? existing.documentId,
          attachmentIds: doc.attachmentIds ?? existing.attachmentIds,
          outputAudit: doc.outputAudit ?? existing.outputAudit,
        };
      });
    });
    setIsHistoryLoading(false);
    setHistoryLoaded(true);

    // サマリに詳細が含まれないケースのみ、必要なものだけ追いかけて補完する。
    const needsDetail = summaryDocs.filter((doc) => doc.letterId && !doc.detailLoaded);
    if (needsDetail.length === 0) return;

    const detailedDocs = await Promise.all(
      needsDetail.map(async (doc) => {
        if (!doc.letterId) return doc;
        const detail = await fetchLetterDetail({ letterId: doc.letterId });
        if (!detail.ok || !detail.letter) return doc;
        return mapLetterToDocument(detail.letter, doc.issuedAt || today);
      }),
    );
    if (isStaleRequest()) return;

    setSavedDocs((prev) => {
      const prevMap = new Map(prev.map((doc) => [doc.id, doc]));
      return prev.map((doc) => {
        const updated = detailedDocs.find((item) => item.id === doc.id);
        if (!updated) return doc;
        const existing = prevMap.get(doc.id);
        if (!existing) return updated;
        const useExistingForm = !updated.detailLoaded && Boolean(existing.detailLoaded);
        return {
          ...updated,
          form: useExistingForm ? existing.form : updated.form,
          detailLoaded: updated.detailLoaded || existing.detailLoaded,
          documentId: updated.documentId ?? existing.documentId,
          attachmentIds: updated.attachmentIds ?? existing.attachmentIds,
          outputAudit: updated.outputAudit ?? existing.outputAudit,
        };
      });
    });
  }, [karteId, patientId, today]);

  useEffect(() => {
    refreshDocumentHistory();
  }, [refreshDocumentHistory]);

  const updateForm = <T extends DocumentType>(type: T, next: Partial<DocumentFormState[T]>) => {
    setDraftDirty(true);
    setForms((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        ...next,
      },
    }));
  };

  const templateOptions = useMemo(() => DOCUMENT_TEMPLATES[activeType], [activeType]);
  const activeTemplate = useMemo(() => getTemplateById(activeType, forms[activeType].templateId), [activeType, forms]);
  const editingDoc = useMemo(
    () => savedDocs.find((doc) => doc.id === editingDocId) ?? null,
    [editingDocId, savedDocs],
  );

  useEffect(() => {
    if (editingDocId && !editingDoc) {
      setEditingDocId(null);
    }
  }, [editingDoc, editingDocId]);

  const upsertSavedDocument = useCallback((doc: SavedDocument) => {
    setSavedDocs((prev) => {
      const existing = prev.find((item) => item.id === doc.id);
      if (!existing) return [...prev, doc];
      return prev.map((item) =>
        item.id === doc.id
          ? {
              ...doc,
              outputAudit: doc.outputAudit ?? existing.outputAudit,
              attachmentIds: doc.attachmentIds ?? existing.attachmentIds,
              detailLoaded: doc.detailLoaded || existing.detailLoaded,
            }
          : item,
      );
    });
  }, []);

  const updateOutputAudit = useCallback((docId: string, audit: SavedDocument['outputAudit']) => {
    setSavedDocs((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, outputAudit: audit ?? doc.outputAudit } : doc)),
    );
  }, []);

  const ensureDocumentDetail = useCallback(
    async (doc: SavedDocument) => {
      if (doc.detailLoaded || !doc.letterId) return doc;
      const detail = await fetchLetterDetail({ letterId: doc.letterId });
      if (!detail.ok || !detail.letter) return doc;
      const mapped = mapLetterToDocument(detail.letter, doc.issuedAt || today);
      setSavedDocs((prev) =>
        prev.map((item) => (item.id === doc.id ? { ...mapped, outputAudit: item.outputAudit ?? mapped.outputAudit } : item)),
      );
      return mapped;
    },
    [today],
  );

  const handleReuseDocument = useCallback(
    async (doc: SavedDocument) => {
      if (doc.patientId !== patientId) {
        setNotice({ tone: 'error', message: '患者が一致しないため文書を再適用できません。' });
        recordChartsAuditEvent({
          action: 'document_template_reuse',
          outcome: 'blocked',
          subject: 'charts-document-history',
          runId: resolvedRunId,
          cacheHit: meta.cacheHit,
          missingMaster: meta.missingMaster,
          fallbackUsed: meta.fallbackUsed,
          dataSourceTransition: meta.dataSourceTransition,
          patientId: patientId,
          appointmentId: meta.appointmentId,
          details: {
            operationPhase: 'do',
            documentId: doc.id,
            documentType: doc.type,
            documentTitle: doc.title,
            documentIssuedAt: doc.issuedAt,
            templateId: doc.templateId,
            inputSource: 'history_copy',
            blockedReasons: ['patient_mismatch'],
          },
        });
        return;
      }
      const resolvedDoc = await ensureDocumentDetail(doc);
      setActiveType(resolvedDoc.type);
      setForms((prev) => ({
        ...prev,
        [resolvedDoc.type]: {
          ...resolvedDoc.form,
          templateId: resolvedDoc.templateId,
          issuedAt: resolvedDoc.issuedAt,
        },
      }));
      setEditingDocId(null);
      setDraftDirty(false);
      setNotice({ tone: 'success', message: '履歴からコピーして編集フォームに反映しました。' });
      recordChartsAuditEvent({
        action: 'document_template_reuse',
        outcome: 'success',
        subject: 'charts-document-history',
        runId: resolvedRunId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        patientId: patientId,
        appointmentId: meta.appointmentId,
        details: {
          operationPhase: 'do',
          documentId: resolvedDoc.id,
          documentType: resolvedDoc.type,
          documentTitle: resolvedDoc.title,
          documentIssuedAt: resolvedDoc.issuedAt,
          templateId: resolvedDoc.templateId,
          inputSource: 'history_copy',
        },
      });
    },
    [
      ensureDocumentDetail,
      meta.appointmentId,
      meta.cacheHit,
      meta.dataSourceTransition,
      meta.fallbackUsed,
      meta.missingMaster,
      patientId,
      resolvedRunId,
    ],
  );

  const lastExternalHistoryCopyRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!historyCopyRequest) return;
    if (historyCopyRequest.requestId === lastExternalHistoryCopyRequestIdRef.current) return;
    if (isHistoryLoading || !historyLoaded) return;
    const target = savedDocs.find((doc) => doc.letterId === historyCopyRequest.letterId);
    if (!target) {
      lastExternalHistoryCopyRequestIdRef.current = historyCopyRequest.requestId;
      setNotice({ tone: 'error', message: '指定の文書履歴が見つからないためコピーできません。' });
      onHistoryCopyConsumed?.(historyCopyRequest.requestId);
      return;
    }
    lastExternalHistoryCopyRequestIdRef.current = historyCopyRequest.requestId;
    void handleReuseDocument(target);
    onHistoryCopyConsumed?.(historyCopyRequest.requestId);
  }, [handleReuseDocument, historyCopyRequest, historyLoaded, isHistoryLoading, onHistoryCopyConsumed, savedDocs]);

  const handleEditDocument = useCallback(
    async (doc: SavedDocument) => {
      if (doc.patientId !== patientId) {
        setNotice({ tone: 'error', message: '患者が一致しないため文書を編集できません。' });
        return;
      }
      const resolvedDoc = await ensureDocumentDetail(doc);
      if (!resolvedDoc.letterId) {
        setNotice({ tone: 'error', message: '文書IDが取得できないため編集を開始できません。' });
        return;
      }
      setActiveType(resolvedDoc.type);
      setForms((prev) => ({
        ...prev,
        [resolvedDoc.type]: {
          ...resolvedDoc.form,
          templateId: resolvedDoc.templateId,
          issuedAt: resolvedDoc.issuedAt,
        },
      }));
      setEditingDocId(resolvedDoc.id);
      setDraftDirty(false);
      setNotice({ tone: 'info', message: '文書を編集モードで読み込みました。' });
    },
    [ensureDocumentDetail, patientId],
  );

  const handleDeleteDocument = useCallback(
    async (doc: SavedDocument) => {
      if (!doc.letterId) {
        setNotice({ tone: 'error', message: '文書IDが取得できないため削除できません。' });
        return;
      }
      setDeleteTargetDoc(doc);
    },
    [],
  );

  const handleConfirmDeleteDocument = useCallback(async () => {
    const target = deleteTargetDoc;
    if (!target?.letterId) {
      setDeleteTargetDoc(null);
      return;
    }
    setDeleteTargetDoc(null);
    const result = await deleteLetter({ letterId: target.letterId });
    if (!result.ok) {
      setNotice({
        tone: 'error',
        message: `文書削除に失敗しました: ${result.error ?? `HTTP ${result.status}`}`,
      });
      return;
    }
    setNotice({ tone: 'success', message: '文書を削除しました。' });
    await refreshDocumentHistory();
  },
    [deleteTargetDoc, refreshDocumentHistory],
  );

  const applyTemplate = () => {
    const template = activeTemplate;
    if (!template) {
      setNotice({ tone: 'error', message: 'テンプレートを選択してください。' });
      return;
    }
    setForms((prev) => {
      const current = prev[activeType];
      const nextValues: Record<string, string> = {};
      Object.entries(template.defaults).forEach(([key, value]) => {
        const currentValue = (current as Record<string, string>)[key];
        if (!currentValue || currentValue.trim().length === 0) {
          nextValues[key] = value;
        }
      });
      return {
        ...prev,
        [activeType]: {
          ...current,
          ...nextValues,
        },
      };
    });
    setDraftDirty(true);
    setNotice({ tone: 'success', message: `テンプレート「${template.label}」を差し込みました。` });
  };

  const logDocumentAudit = (action: 'CHARTS_DOCUMENT_CREATE' | 'CHARTS_DOCUMENT_CANCEL', phase: ChartsOperationPhase, details: Record<string, unknown>) => {
    recordChartsAuditEvent({
      action,
      outcome: action === 'CHARTS_DOCUMENT_CREATE' ? 'success' : 'resolved',
      runId: resolvedRunId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      subject: 'charts',
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      details: {
        operationPhase: phase,
        documentType: activeType,
        ...details,
      },
    });
  };

  const handleSave = async () => {
    if (!patientId) {
      setNotice({ tone: 'error', message: '患者IDが未選択のため文書を保存できません。' });
      setSaveRetryable(false);
      recordChartsAuditEvent({
        action: 'CHARTS_DOCUMENT_CREATE',
        outcome: 'blocked',
        runId: resolvedRunId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        subject: 'charts',
        details: {
          operationPhase: 'save',
          documentType: activeType,
          blockedReasons: ['patient_not_selected'],
        },
      });
      return;
    }
    if (isBlocked) {
      setNotice({ tone: 'error', message: '編集制限のため文書を保存できません。' });
      setSaveRetryable(false);
      recordChartsAuditEvent({
        action: 'CHARTS_DOCUMENT_CREATE',
        outcome: 'blocked',
        runId: resolvedRunId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        subject: 'charts',
        details: {
          operationPhase: 'save',
          documentType: activeType,
          blockedReasons: blockReasons,
        },
      });
      return;
    }

    const missing = resolveMissingFields(activeType, forms);
    if (missing.length > 0) {
      setNotice({ tone: 'error', message: `必須項目が未入力です: ${missing.join('、')}` });
      setSaveRetryable(false);
      recordChartsAuditEvent({
        action: 'CHARTS_DOCUMENT_CREATE',
        outcome: 'warning',
        runId: resolvedRunId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        subject: 'charts',
        details: {
          operationPhase: 'save',
          documentType: activeType,
          missingFields: missing,
        },
      });
      return;
    }

    const summary = buildDocumentSummary(activeType, forms);
    const issuedAt = forms[activeType].issuedAt;
    const templateLabel = activeTemplate?.label ?? '未選択';
    if (!userPk) {
      setNotice({ tone: 'error', message: 'ユーザー情報が取得できないため文書を保存できません。' });
      setSaveRetryable(false);
      return;
    }
    if (!karteId) {
      setNotice({ tone: 'error', message: 'カルテ情報が取得できないため文書を保存できません。' });
      setSaveRetryable(false);
      return;
    }
    const oversized = attachmentsForDocument.filter(
      (attachment) =>
        typeof attachment.contentSize === 'number' && attachment.contentSize > IMAGE_ATTACHMENT_MAX_SIZE_BYTES,
    );
    if (oversized.length > 0) {
      setNotice({
        tone: 'error',
        message: `添付サイズ超過のため保存できません: ${oversized.map((item) => item.fileName ?? item.id).join('、')}`,
      });
      setSaveRetryable(false);
      oversized.forEach((attachment) => {
        recordChartsAuditEvent({
          action: 'chart_image_attach',
          outcome: 'blocked',
          subject: 'charts-document-attachment',
          runId: resolvedRunId,
          cacheHit: meta.cacheHit,
          missingMaster: meta.missingMaster,
          fallbackUsed: meta.fallbackUsed,
          dataSourceTransition: meta.dataSourceTransition,
          patientId,
          appointmentId: meta.appointmentId,
          details: {
            operationPhase: 'save',
            documentType: activeType,
            documentTitle: summary,
            documentIssuedAt: issuedAt,
            attachmentId: attachment.id,
            blockedReasons: ['attachment_size_exceeded'],
          },
        });
      });
      recordChartsAuditEvent({
        action: 'CHARTS_DOCUMENT_CREATE',
        outcome: 'blocked',
        runId: resolvedRunId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        subject: 'charts',
        patientId,
        appointmentId: meta.appointmentId,
        details: {
          operationPhase: 'save',
          documentType: activeType,
          blockedReasons: ['attachment_size_exceeded'],
          attachmentIds: oversized.map((item) => item.id),
        },
      });
      return;
    }

    const hasAttachments = attachmentsForDocument.length > 0;
    let documentId: number | undefined;
    let documentEndpoint: string | undefined;
    let documentStatus: number | undefined;
    let documentError: string | undefined;
    let documentDurationMs: number | undefined;
    setIsSaving(true);
    setNotice({ tone: 'info', message: '文書を保存しています。' });
    setSaveRetryable(false);
    if (hasAttachments) {
      const payload = buildAttachmentReferencePayload({
        attachments: attachmentsForDocument,
        patientId,
        title: summary,
        documentType: activeType,
      });
      const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const result = await sendKarteDocumentWithAttachments(payload, { method: 'POST', validate: true });
      const finishedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      documentDurationMs = Math.max(0, finishedAt - startedAt);
      documentEndpoint = result.endpoint;
      documentStatus = result.status;
      documentError = result.error;
      documentId = result.docPk > 0 ? result.docPk : undefined;
      if (!result.ok) {
        setIsSaving(false);
        setNotice({
          tone: 'error',
          message: `文書保存に失敗しました: ${result.error ?? `HTTP ${result.status}`}`,
        });
        setSaveRetryable(true);
        attachmentsForDocument.forEach((attachment) => {
          recordChartsAuditEvent({
            action: 'chart_image_attach',
            outcome: 'error',
            subject: 'charts-document-attachment',
            runId: resolvedRunId,
            cacheHit: meta.cacheHit,
            missingMaster: meta.missingMaster,
            fallbackUsed: meta.fallbackUsed,
            dataSourceTransition: meta.dataSourceTransition,
            patientId,
            appointmentId: meta.appointmentId,
            details: {
              operationPhase: 'save',
              documentType: activeType,
              documentTitle: summary,
              documentIssuedAt: issuedAt,
              documentId,
              attachmentId: attachment.id,
              endpoint: result.endpoint,
              httpStatus: result.status,
              error: result.error,
            },
          });
        });
        return;
      }
    }

    if (editingDocId && !editingDoc?.letterId) {
      setIsSaving(false);
      setNotice({ tone: 'error', message: '編集中の文書IDが取得できないため更新できません。' });
      return;
    }

    const letterPayload = buildLetterModulePayload({
      type: activeType,
      form: forms[activeType],
      issuedAt,
      patientId,
      userPk,
      userName,
      karteId,
      templateLabel,
      documentId,
      attachmentIds: attachmentsForDocument.map((attachment) => attachment.id),
      linkId: editingDoc?.letterId,
    });
    const letterResult = await saveLetterModule({ payload: letterPayload });
    setIsSaving(false);
    if (!letterResult.ok) {
      setNotice({
        tone: 'error',
        message: `文書保存に失敗しました: ${letterResult.error ?? `HTTP ${letterResult.status}`}`,
      });
      return;
    }

    await refreshDocumentHistory();
    setNotice({
      tone: 'success',
      message: hasAttachments
        ? `文書を${editingDoc ? '更新' : '保存'}しました。添付 ${attachmentsForDocument.length} 件を送信しました。`
        : `文書を${editingDoc ? '更新' : '保存'}しました。テンプレ/印刷導線を利用できます。`,
    });
    setSaveRetryable(false);
    setForms((prev) => ({
      ...prev,
      [activeType]: buildEmptyForms(today)[activeType],
    }));
    setEditingDocId(null);
    setDraftDirty(false);
    if (hasAttachments) {
      onImageAttachmentsClear?.();
      attachmentsForDocument.forEach((attachment) => {
        recordChartsAuditEvent({
          action: 'chart_image_attach',
          outcome: 'success',
          subject: 'charts-document-attachment',
          runId: resolvedRunId,
          cacheHit: meta.cacheHit,
          missingMaster: meta.missingMaster,
          fallbackUsed: meta.fallbackUsed,
          dataSourceTransition: meta.dataSourceTransition,
          patientId,
          appointmentId: meta.appointmentId,
          details: {
            operationPhase: 'save',
            documentType: activeType,
            documentTitle: summary,
            documentIssuedAt: issuedAt,
            documentId,
            attachmentId: attachment.id,
            endpoint: documentEndpoint,
            httpStatus: documentStatus,
            durationMs: documentDurationMs,
          },
        });
      });
    }

    logDocumentAudit('CHARTS_DOCUMENT_CREATE', 'save', {
      documentTitle: summary,
      documentIssuedAt: issuedAt,
      templateId: forms[activeType].templateId,
      documentId,
      letterId: letterResult.letterId,
      linkId: editingDoc?.letterId,
      attachmentIds: attachmentsForDocument.map((attachment) => attachment.id),
      endpoint: letterResult.endpoint ?? documentEndpoint,
      httpStatus: letterResult.status ?? documentStatus,
      durationMs: documentDurationMs,
      error: letterResult.error ?? documentError,
    });
  };

  const handleCancel = () => {
    setForms(buildEmptyForms(today));
    setEditingDocId(null);
    setDraftDirty(false);
    setNotice({ tone: 'info', message: '入力を中断しました。' });
    onImageAttachmentsClear?.();
    logDocumentAudit('CHARTS_DOCUMENT_CANCEL', 'do', {
      documentTitle: buildDocumentSummary(activeType, forms),
      documentIssuedAt: forms[activeType].issuedAt,
      templateId: forms[activeType].templateId,
    });
    if (onClose) onClose();
  };

  const resolveOutputGuardReasons = useCallback((doc: SavedDocument) => {
    const reasons: Array<{ key: string; summary: string; detail: string }> = [];
    if (meta.missingMaster) {
      reasons.push({
        key: 'missing_master',
        summary: 'missingMaster=true',
        detail: 'マスタ欠損を検知したため出力を停止します。',
      });
    }
    if (meta.fallbackUsed) {
      reasons.push({
        key: 'fallback_used',
        summary: 'fallbackUsed=true',
        detail: 'フォールバック経路のため出力を停止します。',
      });
    }
    if (!doc.patientId) {
      reasons.push({
        key: 'patient_not_selected',
        summary: '患者未選択',
        detail: '患者IDが未確定のため出力できません。',
      });
    }
    if (!doc.templateId) {
      reasons.push({
        key: 'template_missing',
        summary: 'テンプレ未選択',
        detail: 'テンプレートを選択してから出力してください。',
      });
    }
    if (!hasPermission) {
      reasons.push({
        key: 'permission_denied',
        summary: '権限不足/認証不備',
        detail: '認証情報が揃っていないため出力を停止します。',
      });
    }
    return reasons;
  }, [hasPermission, meta.fallbackUsed, meta.missingMaster]);

  const resolveAuditOutcome = useCallback((doc: SavedDocument) => {
    if (!doc.outputAudit) return 'pending';
    if (doc.outputAudit.status === 'success') return 'success';
    if (doc.outputAudit.status === 'blocked') return 'failed';
    if (doc.outputAudit.status === 'failed') return 'failed';
    if (doc.outputAudit.status === 'completed') return 'pending';
    if (doc.outputAudit.status === 'started') return 'pending';
    return 'pending';
  }, []);

  const filteredDocs = useMemo(() => {
    if (savedDocs.length === 0) return [];
    const keyword = filterText.trim().toLowerCase();
    return savedDocs.filter((doc) => {
      if (filterPatient === 'current' && patientId && doc.patientId !== patientId) return false;
      if (filterType !== 'all' && doc.type !== filterType) return false;
      if (keyword) {
        const haystack = [
          doc.title,
          doc.templateLabel,
          doc.issuedAt,
          DOCUMENT_TYPE_LABELS[doc.type],
        ]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (filterOutput !== 'all') {
        const blocked = resolveOutputGuardReasons(doc).length > 0;
        if (filterOutput === 'available' && blocked) return false;
        if (filterOutput === 'blocked' && !blocked) return false;
      }
      if (filterAudit !== 'all') {
        const outcome = resolveAuditOutcome(doc);
        if (filterAudit === 'success' && outcome !== 'success') return false;
        if (filterAudit === 'failed' && outcome !== 'failed') return false;
        if (filterAudit === 'pending' && outcome !== 'pending') return false;
      }
      return true;
    });
  }, [
    filterAudit,
    filterOutput,
    filterPatient,
    filterText,
    filterType,
    patientId,
    resolveAuditOutcome,
    resolveOutputGuardReasons,
    savedDocs,
  ]);

  const handleOpenDocumentPreview = async (doc: SavedDocument, initialOutputMode?: DocumentOutputMode) => {
    const resolvedDoc = await ensureDocumentDetail(doc);
    const { actor, facilityId } = resolveAuditActor();
    const blockedReasons = resolveOutputGuardReasons(resolvedDoc);
    if (blockedReasons.length > 0) {
      setNotice({ tone: 'error', message: `出力できません: ${blockedReasons[0].detail}` });
      updateOutputAudit(resolvedDoc.id, {
        status: 'blocked',
        mode: initialOutputMode,
        at: new Date().toISOString(),
        detail: blockedReasons[0].detail,
        runId: resolvedRunId,
      });
      recordChartsAuditEvent({
        action: 'PRINT_DOCUMENT',
        outcome: 'blocked',
        subject: 'charts-document-preview',
        note: blockedReasons[0].detail,
        patientId: resolvedDoc.patientId,
        actor,
        runId: resolvedRunId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        details: {
          operationPhase: 'lock',
          blockedReasons: blockedReasons.map((reason) => reason.key),
          documentType: resolvedDoc.type,
          documentTitle: resolvedDoc.title,
          documentIssuedAt: resolvedDoc.issuedAt,
          templateId: resolvedDoc.templateId,
          documentId: resolvedDoc.id,
        },
      });
      return;
    }

    const outputLabel =
      initialOutputMode === 'print' ? '印刷' : initialOutputMode === 'pdf' ? 'PDF出力' : 'プレビュー';
    const detail = `文書${outputLabel}プレビューを開きました。実行者は監査ログに記録しました。`;
    setNotice({ tone: 'success', message: `文書${outputLabel}プレビューを開きました。` });
    updateOutputAudit(resolvedDoc.id, {
      status: 'started',
      mode: initialOutputMode,
      at: new Date().toISOString(),
      detail,
      runId: resolvedRunId,
    });
    recordChartsAuditEvent({
      action: 'PRINT_DOCUMENT',
      outcome: 'started',
      subject: 'charts-document-preview',
      note: detail,
      actor,
      patientId: resolvedDoc.patientId,
      runId: resolvedRunId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      details: {
        operationPhase: 'do',
        documentType: resolvedDoc.type,
        documentTitle: resolvedDoc.title,
        documentIssuedAt: resolvedDoc.issuedAt,
        templateId: resolvedDoc.templateId,
        documentId: resolvedDoc.id,
        endpoint: '/charts/print/document',
      },
    });

    const previewState = {
      document: { ...resolvedDoc, form: resolvedDoc.form as Record<string, string> },
      meta: {
        runId: resolvedRunId ?? meta.runId ?? '',
        cacheHit: meta.cacheHit ?? false,
        missingMaster: meta.missingMaster ?? false,
        fallbackUsed: meta.fallbackUsed ?? false,
        dataSourceTransition: meta.dataSourceTransition ?? 'snapshot',
      },
      actor,
      facilityId,
      initialOutputMode,
    };
    const returnTo = appNav.currentUrl;
    const navigatedState = { ...previewState, from: 'charts', returnTo };
    appNav.openPrintDocument({ state: navigatedState });
    saveDocumentPrintPreview(navigatedState, storageScope);
  };

  useEffect(() => {
    if (!openRequest) return;
    const requestKey = openRequest.requestId ?? JSON.stringify(openRequest);
    const requiresHistory = !openRequest.letterId && Boolean(openRequest.documentId);
    if (requiresHistory && !historyLoaded) return;
    if (lastOpenRequestRef.current === requestKey) return;
    lastOpenRequestRef.current = requestKey;
    let active = true;

    const applyRequest = async () => {
      if (!active) return;
      if (openRequest.query) {
        setFilterText(openRequest.query);
      }

      let resolvedDoc: SavedDocument | null = null;
      if (openRequest.letterId) {
        resolvedDoc = savedDocs.find((doc) => doc.letterId === openRequest.letterId) ?? null;
        if (!resolvedDoc) {
          const detail = await fetchLetterDetail({ letterId: openRequest.letterId });
          if (!active) return;
          if (detail.ok && detail.letter) {
            resolvedDoc = mapLetterToDocument(detail.letter, today);
            upsertSavedDocument(resolvedDoc);
          }
        }
      } else if (openRequest.documentId) {
        resolvedDoc = savedDocs.find((doc) => doc.documentId === openRequest.documentId) ?? null;
      }

      if (!active) return;
      if (!resolvedDoc) {
        const shouldNotifyMissing = Boolean(openRequest.letterId || (openRequest.documentId && !openRequest.query));
        if (shouldNotifyMissing) {
          setNotice({ tone: 'error', message: '指定された文書が見つかりませんでした。' });
        }
        return;
      }

      if (openRequest.intent === 'print' || openRequest.intent === 'pdf') {
        await handleOpenDocumentPreview(resolvedDoc, openRequest.intent);
        return;
      }
      if (openRequest.intent === 'preview') {
        await handleOpenDocumentPreview(resolvedDoc);
        return;
      }
      await handleEditDocument(resolvedDoc);
    };

    applyRequest();
    return () => {
      active = false;
    };
  }, [
    handleEditDocument,
    handleOpenDocumentPreview,
    historyLoaded,
    openRequest,
    savedDocs,
    today,
    upsertSavedDocument,
  ]);

  const activeForm = forms[activeType];
  const previewFallback = '（未入力）';
  const previewValue = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : previewFallback;
  };
  const previewIssuedAt = activeForm.issuedAt || today;
  const previewTemplateLabel = activeTemplate?.label ?? 'テンプレート未選択';
  const previewPatientLabel = patientId || '未選択';

  if (!patientId) {
    return <p className="charts-side-panel__empty">患者IDが未選択のため文書作成を開始できません。</p>;
  }

  return (
    <section className="charts-side-panel__section" data-test-id="document-create-panel">
      <FocusTrapDialog
        open={Boolean(deleteTargetDoc)}
        role="alertdialog"
        title="文書を削除しますか？"
        description="削除対象と影響範囲を確認して実行してください。"
        onClose={() => setDeleteTargetDoc(null)}
        testId="document-delete-dialog"
      >
        <section className="charts-tab-guard" aria-label="文書削除確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>対象文書</dt>
              <dd>{deleteTargetDoc?.title ?? '—'}</dd>
            </div>
            <div>
              <dt>患者ID</dt>
              <dd>{deleteTargetDoc?.patientId ?? patientId ?? '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>保存済み文書履歴から削除され、元に戻せません。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="文書削除操作">
            <button type="button" onClick={() => setDeleteTargetDoc(null)}>
              キャンセル
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={() => void handleConfirmDeleteDocument()}>
              削除する
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <header className="charts-side-panel__section-header">
        <div>
          <h4>文書作成メニュー</h4>
          <p>文書別テンプレを差し込み、保存後に印刷/プレビューできます。</p>
        </div>
        <button type="button" className="charts-side-panel__ghost" onClick={handleCancel}>
          中断して閉じる
        </button>
      </header>
      {notice && (
        <div
          className={`charts-side-panel__notice charts-side-panel__notice--${notice.tone}`}
          role={noticeRole}
          aria-live={noticeLive}
          aria-atomic="true"
        >
          {notice.message}
        </div>
      )}
      {blockReasons.length > 0 && (
        <div className="charts-side-panel__notice charts-side-panel__notice--info">
          {blockReasons.map((reason) => (
            <p key={reason} className="charts-side-panel__message">
              {reason}
            </p>
          ))}
        </div>
      )}
      {attachmentsForDocument.length > 0 && (
        <div className="charts-side-panel__notice charts-side-panel__notice--info" data-test-id="document-attachment-summary">
          <div className="charts-document-attachment__header">
            <strong>文書へ貼付予定の画像</strong>
            <span>{attachmentsForDocument.length} 件</span>
            {onImageAttachmentsClear ? (
              <button type="button" onClick={onImageAttachmentsClear} disabled={isSaving}>
                すべて解除
              </button>
            ) : null}
          </div>
          <ul className="charts-document-attachment__list">
            {attachmentsForDocument.map((attachment) => (
              <li key={attachment.id} className="charts-document-attachment__item">
                <span>
                  {attachment.title ?? attachment.fileName ?? `attachment-${attachment.id}`} (ID:{attachment.id})
                </span>
                {onImageAttachmentsChange ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    disabled={isSaving}
                  >
                    解除
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="charts-document-menu" role="tablist" aria-label="文書種類">
        {DOCUMENT_TYPES.map((entry) => (
          <button
            key={entry.type}
            type="button"
            role="tab"
            aria-selected={activeType === entry.type}
            className={`charts-document-menu__button${activeType === entry.type ? ' charts-document-menu__button--active' : ''}`}
            onClick={() => setActiveType(entry.type)}
            disabled={isBlocked}
          >
            <span>{entry.label}</span>
            <small>{entry.hint}</small>
          </button>
        ))}
      </div>
      <div className="charts-document-editor">
        <form className="charts-side-panel__form charts-side-panel__form--document" onSubmit={(event) => event.preventDefault()}>
        <div className="charts-side-panel__field">
          <label htmlFor="document-template">テンプレート *</label>
          <select
            id="document-template"
            value={forms[activeType].templateId}
            onChange={(event) => {
              const templateId = event.target.value;
              const template = getTemplateById(activeType, templateId);
              updateForm(activeType, { templateId });
              logUiState({
                action: 'scenario_change',
                screen: 'charts/document-create',
                controlId: 'document-template',
                runId: resolvedRunId,
                cacheHit: meta.cacheHit,
                missingMaster: meta.missingMaster,
                fallbackUsed: meta.fallbackUsed,
                dataSourceTransition: meta.dataSourceTransition,
                details: {
                  documentType: activeType,
                  templateId,
                  templateLabel: template?.label ?? '未選択',
                },
              });
            }}
            disabled={isBlocked}
          >
            <option value="">テンプレートを選択</option>
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <p className="charts-side-panel__help">
            {activeTemplate?.description ?? '選択したテンプレの説明がここに表示されます。'}
          </p>
          <div className="charts-side-panel__template-actions">
            <button type="button" onClick={applyTemplate} disabled={isBlocked || !forms[activeType].templateId}>
              テンプレ挿入
            </button>
          </div>
        </div>
        {activeType === 'referral' && (
          <>
            <div className="charts-side-panel__field">
              <label htmlFor="referral-issued">発行日 *</label>
              <input
                id="referral-issued"
                type="date"
                value={forms.referral.issuedAt}
                onChange={(event) => updateForm('referral', { issuedAt: event.target.value })}
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="referral-hospital">宛先医療機関 *</label>
              <input
                id="referral-hospital"
                type="text"
                value={forms.referral.hospital}
                onChange={(event) => updateForm('referral', { hospital: event.target.value })}
                placeholder="○○病院/クリニック"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="referral-department">宛先診療科</label>
              <input
                id="referral-department"
                type="text"
                value={forms.referral.department}
                onChange={(event) => updateForm('referral', { department: event.target.value })}
                placeholder="診療科/部署"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="referral-doctor">宛先医師 *</label>
              <input
                id="referral-doctor"
                type="text"
                value={forms.referral.doctor}
                onChange={(event) => updateForm('referral', { doctor: event.target.value })}
                placeholder="担当医師名"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="referral-purpose">紹介目的 *</label>
              <input
                id="referral-purpose"
                type="text"
                value={forms.referral.purpose}
                onChange={(event) => updateForm('referral', { purpose: event.target.value })}
                placeholder="精査依頼/治療依頼など"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="referral-diagnosis">主病名 *</label>
              <input
                id="referral-diagnosis"
                type="text"
                value={forms.referral.diagnosis}
                onChange={(event) => updateForm('referral', { diagnosis: event.target.value })}
                placeholder="例: 高血圧症"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="referral-body">紹介内容 *</label>
              <textarea
                id="referral-body"
                value={forms.referral.body}
                onChange={(event) => updateForm('referral', { body: event.target.value })}
                placeholder="既往歴/検査結果/依頼内容を要約"
                disabled={isBlocked}
              />
            </div>
          </>
        )}
        {activeType === 'certificate' && (
          <>
            <div className="charts-side-panel__field">
              <label htmlFor="certificate-issued">発行日 *</label>
              <input
                id="certificate-issued"
                type="date"
                value={forms.certificate.issuedAt}
                onChange={(event) => updateForm('certificate', { issuedAt: event.target.value })}
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="certificate-submit">提出先 *</label>
              <input
                id="certificate-submit"
                type="text"
                value={forms.certificate.submitTo}
                onChange={(event) => updateForm('certificate', { submitTo: event.target.value })}
                placeholder="提出先/提出目的"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="certificate-diagnosis">診断名 *</label>
              <input
                id="certificate-diagnosis"
                type="text"
                value={forms.certificate.diagnosis}
                onChange={(event) => updateForm('certificate', { diagnosis: event.target.value })}
                placeholder="診断名"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="certificate-purpose">用途 *</label>
              <input
                id="certificate-purpose"
                type="text"
                value={forms.certificate.purpose}
                onChange={(event) => updateForm('certificate', { purpose: event.target.value })}
                placeholder="保険/学校/勤務先など"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="certificate-body">所見 *</label>
              <textarea
                id="certificate-body"
                value={forms.certificate.body}
                onChange={(event) => updateForm('certificate', { body: event.target.value })}
                placeholder="所見/経過を簡潔に記載"
                disabled={isBlocked}
              />
            </div>
          </>
        )}
        {activeType === 'reply' && (
          <>
            <div className="charts-side-panel__field">
              <label htmlFor="reply-issued">発行日 *</label>
              <input
                id="reply-issued"
                type="date"
                value={forms.reply.issuedAt}
                onChange={(event) => updateForm('reply', { issuedAt: event.target.value })}
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="reply-hospital">返信先医療機関 *</label>
              <input
                id="reply-hospital"
                type="text"
                value={forms.reply.hospital}
                onChange={(event) => updateForm('reply', { hospital: event.target.value })}
                placeholder="紹介元医療機関"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="reply-department">返信先診療科</label>
              <input
                id="reply-department"
                type="text"
                value={forms.reply.department}
                onChange={(event) => updateForm('reply', { department: event.target.value })}
                placeholder="診療科/部署"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="reply-doctor">返信先医師 *</label>
              <input
                id="reply-doctor"
                type="text"
                value={forms.reply.doctor}
                onChange={(event) => updateForm('reply', { doctor: event.target.value })}
                placeholder="担当医師名"
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field">
              <label htmlFor="reply-summary">返信内容 *</label>
              <textarea
                id="reply-summary"
                value={forms.reply.summary}
                onChange={(event) => updateForm('reply', { summary: event.target.value })}
                placeholder="診断結果/今後の方針を記載"
                disabled={isBlocked}
              />
            </div>
          </>
        )}
        {editingDoc ? (
          <div className="charts-side-panel__notice charts-side-panel__notice--info">
            <div className="charts-side-panel__message">編集中: {editingDoc.title}</div>
            <button
              type="button"
              onClick={() => {
                setEditingDocId(null);
                setNotice({ tone: 'info', message: '編集モードを解除しました。' });
              }}
            >
              編集解除
            </button>
          </div>
        ) : null}
        <div className="charts-side-panel__actions">
          <button type="button" onClick={handleSave} disabled={isBlocked || isSaving}>
            {editingDoc ? '更新' : '保存'}
          </button>
          {canRetrySave ? (
            <button type="button" onClick={handleSave} disabled={!canRetrySave}>
              再送
            </button>
          ) : null}
          <button type="button" onClick={handleCancel}>
            中断
          </button>
        </div>
        {canRetrySave ? <p className="charts-side-panel__message">添付付き保存が失敗した場合のみ再送できます。</p> : null}
        </form>
        <section className="charts-document-paper" aria-label="文書ドラフトの紙面プレビュー">
          <header className="charts-document-paper__header">
            <p className="charts-document-paper__eyebrow">Paper Preview</p>
            <h5 className="charts-document-paper__title">{`${DOCUMENT_TYPE_LABELS[activeType] ?? '文書'}（下書きプレビュー）`}</h5>
            <p className="charts-document-paper__meta">
              発行日: {previewIssuedAt} / 患者ID: {previewPatientLabel}
            </p>
            <p className="charts-document-paper__meta">
              テンプレート: {previewTemplateLabel} / 添付予定: {attachmentsForDocument.length}件
            </p>
          </header>
          <div className="charts-document-paper__sheet" data-type={activeType}>
            {activeType === 'referral' ? (
              <>
                <p className="charts-document-paper__doc-title">診療情報提供書</p>
                <p className="charts-document-paper__line charts-document-paper__line--right">作成日: {previewIssuedAt}</p>
                <p className="charts-document-paper__line">
                  宛先: {previewValue(forms.referral.hospital)} {forms.referral.department?.trim() ? `（${forms.referral.department.trim()}）` : ''}
                </p>
                <p className="charts-document-paper__line">宛先医師: {previewValue(forms.referral.doctor)} 先生</p>
                <dl className="charts-document-paper__table">
                  <div>
                    <dt>紹介目的</dt>
                    <dd>{previewValue(forms.referral.purpose)}</dd>
                  </div>
                  <div>
                    <dt>主病名</dt>
                    <dd>{previewValue(forms.referral.diagnosis)}</dd>
                  </div>
                </dl>
                <section className="charts-document-paper__section">
                  <h6>紹介内容</h6>
                  <p>{previewValue(forms.referral.body)}</p>
                </section>
              </>
            ) : null}
            {activeType === 'certificate' ? (
              <>
                <p className="charts-document-paper__doc-title">診断書</p>
                <p className="charts-document-paper__line charts-document-paper__line--right">作成日: {previewIssuedAt}</p>
                <p className="charts-document-paper__line">提出先: {previewValue(forms.certificate.submitTo)}</p>
                <dl className="charts-document-paper__table">
                  <div>
                    <dt>診断名</dt>
                    <dd>{previewValue(forms.certificate.diagnosis)}</dd>
                  </div>
                  <div>
                    <dt>用途</dt>
                    <dd>{previewValue(forms.certificate.purpose)}</dd>
                  </div>
                </dl>
                <section className="charts-document-paper__section">
                  <h6>所見</h6>
                  <p>{previewValue(forms.certificate.body)}</p>
                </section>
              </>
            ) : null}
            {activeType === 'reply' ? (
              <>
                <p className="charts-document-paper__doc-title">紹介患者経過報告書（返書）</p>
                <p className="charts-document-paper__line charts-document-paper__line--right">作成日: {previewIssuedAt}</p>
                <p className="charts-document-paper__line">
                  返信先: {previewValue(forms.reply.hospital)} {forms.reply.department?.trim() ? `（${forms.reply.department.trim()}）` : ''}
                </p>
                <p className="charts-document-paper__line">返信先医師: {previewValue(forms.reply.doctor)} 先生</p>
                <section className="charts-document-paper__section">
                  <h6>返信内容</h6>
                  <p>{previewValue(forms.reply.summary)}</p>
                </section>
              </>
            ) : null}
          </div>
        </section>
      </div>
      <div className="charts-document-list" aria-live={resolveAriaLive('info')}>
        <div className="charts-document-list__header">
          <strong>保存済み文書</strong>
          <span>
            {isHistoryLoading ? '取得中...' : `${filteredDocs.length}/${savedDocs.length} 件`}
          </span>
        </div>
        {historyError && (
          <div className="charts-side-panel__notice charts-side-panel__notice--error">
            <div className="charts-side-panel__message">{historyError}</div>
            <button type="button" onClick={refreshDocumentHistory} disabled={isHistoryLoading}>
              再読み込み
            </button>
          </div>
        )}
        {isHistoryLoading ? (
          <p className="charts-side-panel__empty">文書履歴を取得しています...</p>
        ) : savedDocs.length === 0 ? (
          <>
            <div className="charts-side-panel__notice charts-side-panel__notice--info">
              文書履歴はサーバー側に保存されます。保存後に一覧へ反映されます。
            </div>
            <p className="charts-side-panel__empty">保存履歴はまだありません。</p>
          </>
        ) : (
          <>
            <div className="charts-document-list__filters" role="group" aria-label="文書履歴の検索フィルタ">
              <input
                id="document-filter-text"
                name="documentFilterText"
                type="search"
                placeholder="検索（タイトル/テンプレ/発行日）"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                aria-label="文書履歴の検索"
              />
              <select
                id="document-filter-patient"
                name="documentFilterPatient"
                value={filterPatient}
                onChange={(event) => setFilterPatient(event.target.value as 'current' | 'all')}
                aria-label="患者フィルタ"
              >
                <option value="current">選択患者のみ</option>
                <option value="all">全患者</option>
              </select>
              <select
                id="document-filter-type"
                name="documentFilterType"
                value={filterType}
                onChange={(event) => setFilterType(event.target.value as DocumentType | 'all')}
                aria-label="文書種別フィルタ"
              >
                <option value="all">すべての文書</option>
                {DOCUMENT_TYPES.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                id="document-filter-output"
                name="documentFilterOutput"
                value={filterOutput}
                onChange={(event) => setFilterOutput(event.target.value as 'all' | 'available' | 'blocked')}
                aria-label="出力可否フィルタ"
              >
                <option value="all">出力可否: すべて</option>
                <option value="available">出力可能のみ</option>
                <option value="blocked">出力停止のみ</option>
              </select>
              <select
                id="document-filter-audit"
                name="documentFilterAudit"
                value={filterAudit}
                onChange={(event) => setFilterAudit(event.target.value as 'all' | 'success' | 'failed' | 'pending')}
                aria-label="監査結果フィルタ"
              >
                <option value="all">監査結果: すべて</option>
                <option value="success">監査結果: 成功</option>
                <option value="failed">監査結果: 失敗</option>
                <option value="pending">監査結果: 処理中/未実行</option>
              </select>
              {(filterText.trim().length > 0 ||
                filterPatient !== 'current' ||
                filterType !== 'all' ||
                filterOutput !== 'all' ||
                filterAudit !== 'all') && (
                <button
                  type="button"
                  className="charts-document-list__clear"
                  onClick={() => {
                    setFilterText('');
                    setFilterPatient('current');
                    setFilterType('all');
                    setFilterOutput('all');
                    setFilterAudit('all');
                  }}
                >
                  フィルタをクリア
                </button>
              )}
            </div>
            {filteredDocs.length === 0 ? (
              <p className="charts-side-panel__empty">検索条件に該当する文書がありません。</p>
            ) : (
              <ul className="charts-document-list__items">
                {filteredDocs.map((doc) => {
                  const guards = resolveOutputGuardReasons(doc);
                  const auditOutcome = resolveAuditOutcome(doc);
                  const outputStatusLabel =
                    doc.outputAudit?.status === 'success'
                      ? '成功'
                      : doc.outputAudit?.status === 'failed' || doc.outputAudit?.status === 'blocked'
                        ? '失敗'
                        : doc.outputAudit?.status === 'completed'
                          ? '未判定'
                          : doc.outputAudit?.status === 'started'
                            ? '処理中'
                            : '未実行';
                  const lastMode = doc.outputAudit?.mode ?? 'print';
                  return (
                    <li key={doc.id}>
                      <div className="charts-document-list__row">
                        <strong>{DOCUMENT_TYPE_LABELS[doc.type] ?? '文書'}</strong>
                        <span>{doc.title}</span>
                      </div>
                      <div className="charts-document-list__meta">
                        <small>
                          発行日: {doc.issuedAt} / テンプレ: {doc.templateLabel} / 添付: {doc.attachmentIds?.length ?? 0} /
                          保存: {new Date(doc.savedAt).toLocaleString()}
                        </small>
                        <span className={`charts-document-list__status charts-document-list__status--${auditOutcome}`}>
                          監査結果: {outputStatusLabel}
                        </span>
                      </div>
                      <div className="charts-document-list__actions" role="group" aria-label="文書編集操作">
                        <button
                          type="button"
                          onClick={() => handleReuseDocument(doc)}
                          disabled={doc.patientId !== patientId}
                        >
                          コピーして編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditDocument(doc)}
                          disabled={doc.patientId !== patientId}
                        >
                          編集
                        </button>
                        <button type="button" onClick={() => handleDeleteDocument(doc)}>
                          削除
                        </button>
                      </div>
                      <div className="charts-document-list__actions" role="group" aria-label="文書出力操作">
                        <button type="button" onClick={() => handleOpenDocumentPreview(doc)} disabled={guards.length > 0}>
                          プレビュー
                        </button>
                        <button type="button" onClick={() => handleOpenDocumentPreview(doc, 'print')} disabled={guards.length > 0}>
                          印刷
                        </button>
                        <button type="button" onClick={() => handleOpenDocumentPreview(doc, 'pdf')} disabled={guards.length > 0}>
                          PDF出力
                        </button>
                      </div>
                      {guards.length > 0 && <div className="charts-document-list__guard">出力停止: {guards[0]?.summary}</div>}
                      {doc.patientId !== patientId && (
                        <div className="charts-document-list__guard">患者が異なるためコピー編集はできません。</div>
                      )}
                      {auditOutcome === 'failed' && (
                        <div className="charts-document-list__recovery" role="group" aria-label="出力失敗時の復旧導線">
                          <button type="button" onClick={() => handleOpenDocumentPreview(doc, lastMode)}>
                            再試行
                          </button>
                          <button type="button" onClick={() => handleOpenDocumentPreview(doc, 'print')}>
                            再出力（印刷）
                          </button>
                          <button type="button" onClick={() => appNav.openReception()}>
                            再取得（受付）
                          </button>
                          <a href={PRINT_HELP_URL} target="_blank" rel="noopener noreferrer">
                            印刷ヘルプ
                          </a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
