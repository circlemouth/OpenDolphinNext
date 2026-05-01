import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DataSourceTransition } from './authService';
import { recordChartsAuditEvent } from './audit';
import type { DraftDirtySource } from './draftSources';
import {
  SOAP_SECTIONS,
  SOAP_SECTION_LABELS,
  SOAP_TEMPLATES,
  buildSoapDraftFromHistory,
  buildSoapEntryId,
  formatSoapAuthoredAt,
  getLatestSoapEntries,
  type SoapDraft,
  type SoapEntry,
  type SoapSectionKey,
} from './soapNote';
import { SubjectivesPanel } from './soap/SubjectivesPanel';
import { appendImageAttachmentPlaceholders, type ChartImageAttachment } from './documentImageAttach';
import {
  postChartSubjectiveEntry,
  type ChartSubjectiveEntryReadback,
  type ChartSubjectiveEntryRequest,
  type ChartSubjectiveEntryResponse,
} from './soap/subjectiveChartApi';
import { RevisionHistoryDrawer } from './revisions/RevisionHistoryDrawer';
import type { RpHistoryEntry } from './karteExtrasApi';
import { mutateOrderBundles, type OrderBundle } from './orderBundleApi';
import {
  OrderBundleEditPanel,
  type OrderBundleEditPanelRequest,
  type OrderBundleEditingContext,
} from './OrderBundleEditPanel';
import { OrderSummaryPane } from './OrderSummaryPane';
import { PrescriptionOrderEditorPanel } from './PrescriptionOrderEditorPanel';
import { RightUtilityDrawer, type RightUtilityTool } from './RightUtilityDrawer';
import { RightUtilityDock } from './RightUtilityDock';
import { resolveLatestBundle } from './orderDetailDisplayViewModel';
import {
  ORDER_GROUP_REGISTRY,
  resolveCanonicalOrderEntity,
  resolveOrderEntity,
  resolveOrderEntityEditorMeta,
  resolveOrderEntityLabel,
  resolveOrderGroupKeyByEntity,
  type OrderEntity,
  type OrderGroupKey,
} from './orderCategoryRegistry';
import { resolveAriaLive } from '../../libs/observability/observability';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { logAuditEvent } from '../../libs/audit/auditLogger';
import { resolveUserSafeSaveFailure } from './userSafeErrorCopy';

export type SoapNoteMeta = {
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  visitDate?: string;
};

export type SoapNoteAuthor = {
  role: string;
  displayName?: string;
  userId: string;
};

export type SoapOrderDockState = {
  hasEditing: boolean;
  targetCategory: OrderGroupKey | null;
  count: number;
  editingLabel?: string;
  source?: 'right-panel' | 'bottom-floating' | 'order-dock' | 'system' | null;
};

type SoapNotePanelProps = {
  history: SoapEntry[];
  meta: SoapNoteMeta;
  author: SoapNoteAuthor;
  readOnly?: boolean;
  readOnlyReason?: string;
  rpHistory?: RpHistoryEntry[];
  rpHistoryLoading?: boolean;
  rpHistoryError?: string;
  orderBundles?: OrderBundle[];
  orderBundlesLoading?: boolean;
  orderBundlesError?: string;
  prescriptionBundles?: OrderBundle[];
  prescriptionBundlesLoading?: boolean;
  prescriptionBundlesError?: string;
  orderDockOpenRequest?: { requestId: string; entity: OrderEntity } | null;
  onOrderDockOpenConsumed?: (requestId: string) => void;
  orderHistoryCopyRequest?: { requestId: string; entity: OrderEntity; bundle: OrderBundle } | null;
  onOrderHistoryCopyConsumed?: (requestId: string) => void;
  documentDockOpenRequest?: { requestId: string; source?: string } | null;
  onDocumentDockOpenConsumed?: (requestId: string) => void;
  documentHistoryCopyRequest?: { requestId: string; letterId: number } | null;
  onDocumentHistoryCopyConsumed?: (requestId: string) => void;
  documentPanel?: ReactNode;
  orcaPanel?: ReactNode;
  onOrderDockStateChange?: (next: SoapOrderDockState) => void;
  bottomOrderHubIntegrationEnabled?: boolean;
  onDraftSnapshot?: (draft: SoapDraft) => void;
  replaceDraftRequest?: { token: string; draft: SoapDraft; note?: string } | null;
  applyDraftPatch?: { token: string; section: SoapSectionKey; body: string; note?: string } | null;
  saveRequest?: { token: string; reason?: string } | null;
  onSaveRequestResult?: (result: {
    token: string;
    ok: boolean;
    message: string;
    serverSynced: boolean;
    localSaved: boolean;
    error?: string | null;
  }) => void;
  attachmentInsert?: { attachment: ChartImageAttachment; section: SoapSectionKey; token: string } | null;
  onAttachmentInserted?: () => void;
  onAppendHistory?: (entries: SoapEntry[]) => void;
  onDraftDirtyChange?: (next: {
    dirty: boolean;
    patientId?: string;
    appointmentId?: string;
    receptionId?: string;
    visitDate?: string;
    dirtySources?: DraftDirtySource[];
  }) => void;
  onSyncStateChange?: (next: {
    localSaved: boolean;
    serverSynced: boolean;
    isSaving: boolean;
    error?: string | null;
    savedAt?: string;
  }) => void;
  onClearHistory?: () => void;
  onAuditLogged?: () => void;
};

const resolveAuthorLabel = (author: SoapNoteAuthor) => {
  return author.displayName ?? author.userId ?? author.role;
};

const filterTemplatesForSection = (section: SoapSectionKey) =>
  SOAP_TEMPLATES.filter((template) => Boolean(template.sections[section]));
const SOAP_TEMPLATE_LABEL_MAP = new Map(SOAP_TEMPLATES.map((template) => [template.id, template.label]));
const resolveSoapTemplateLabel = (templateId?: string | null): string | null => {
  if (!templateId) return null;
  return SOAP_TEMPLATE_LABEL_MAP.get(templateId) ?? templateId;
};

const resolveSoapCategory = (section: SoapSectionKey): 'S' | 'O' | 'A' | 'P' | null => {
  switch (section) {
    case 'subjective':
      return 'S';
    case 'objective':
      return 'O';
    case 'assessment':
      return 'A';
    case 'plan':
      return 'P';
    case 'free':
      return 'S';
    default:
      return null;
  }
};

const resolveSoapSaveErrorCopy = (detail?: string | null): string =>
  `${resolveUserSafeSaveFailure('SOAPのみ', detail)} 病名・オーダー・文書など他領域の保存状態とは別です。未保存のSOAP欄を再試行してください。`;

const SOAP_SECTION_SUPPORT_TEXT: Record<SoapSectionKey, string> = {
  free: 'Free は院内ローカル保存時に S として記録し、保存応答から再読込した場合も Free 欄へ戻します。',
  subjective: '自覚症状・主訴など S に相当する内容を記載します。',
  objective: '所見・検査値など O に相当する内容を記載します。',
  assessment: '評価・鑑別など A に相当する内容を記載します。',
  plan: '方針・処方・検査予定など P に相当する内容を記載します。',
};

const isSoapSectionKey = (value: unknown): value is SoapSectionKey =>
  value === 'free' || value === 'subjective' || value === 'objective' || value === 'assessment' || value === 'plan';

const buildCanonicalSoapEntryFromReadback = (
  fallback: SoapEntry,
  readback?: ChartSubjectiveEntryReadback,
  recordedAt?: string,
): SoapEntry => {
  const section = isSoapSectionKey(readback?.displaySection) ? readback.displaySection : fallback.section;
  const authoredAt = readback?.recordedAt ?? recordedAt ?? fallback.authoredAt;
  return {
    ...fallback,
    id: typeof readback?.documentId === 'number' ? `local-subjective-${readback.documentId}-${section}` : fallback.id,
    section,
    body: readback?.body ?? fallback.body,
    authoredAt,
    authorName: readback?.authorName ?? fallback.authorName,
    patientId: readback?.patientId ?? fallback.patientId,
    visitDate: readback?.performDate ?? fallback.visitDate,
  };
};

const EMPTY_ORDER_BUNDLE_EDITING_CONTEXT: OrderBundleEditingContext = {
  hasRpRequiredIssue: false,
  rpRequiredMissing: [],
};

const resolveGroupSpec = (groupKey: OrderGroupKey) => ORDER_GROUP_REGISTRY.find((spec) => spec.key === groupKey) ?? null;

const cloneDocumentPanelNode = (
  node: ReactNode,
  historyCopyRequest?: { requestId: string; letterId: number } | null,
  onHistoryCopyConsumed?: (requestId: string) => void,
): ReactNode => {
  if (!isValidElement(node)) return node;
  const panel = node as ReactElement<Record<string, unknown>>;
  return cloneElement(panel, {
    historyCopyRequest,
    onHistoryCopyConsumed,
  });
};

const normalizeBundleEntity = (bundle: OrderBundle, fallback: OrderEntity): OrderEntity => {
  const raw = bundle.entity?.trim() ?? '';
  const resolved = resolveCanonicalOrderEntity(raw) ?? resolveOrderEntity(raw);
  if (resolved) return resolved;
  return fallback;
};

const isBundleMatchedToEntity = (bundle: OrderBundle, targetEntity: OrderEntity, fallback: OrderEntity) => {
  const entity = normalizeBundleEntity(bundle, fallback);
  const normalizedTargetEntity = resolveCanonicalOrderEntity(targetEntity) ?? targetEntity;
  return entity === normalizedTargetEntity;
};

const RIGHT_DRAWER_WIDTH_STORAGE_KEY = 'opendolphin:web-client:soap-right-drawer:width';
const RIGHT_DRAWER_HANDLE_WIDTH = 56;
const RIGHT_DRAWER_MIN_WIDTH = 560;
const RIGHT_DRAWER_MAX_WIDTH = 960;
const RIGHT_DRAWER_DEFAULT_MIN = 760;
const RIGHT_DRAWER_DEFAULT_MAX = 920;
const RIGHT_DRAWER_OVERLAY_BREAKPOINT = 1023;
const RIGHT_DRAWER_REQUIRED_MAIN_WIDTH = 980;

const clampNumber = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

const resolveViewportWidth = () => {
  if (typeof window === 'undefined') return 1440;
  return window.innerWidth;
};

const resolveRightDrawerWidthBounds = (viewportWidth: number) => {
  const maxByViewport = Math.min(RIGHT_DRAWER_MAX_WIDTH, viewportWidth - 80);
  const max = Math.max(RIGHT_DRAWER_MIN_WIDTH, maxByViewport);
  return {
    min: RIGHT_DRAWER_MIN_WIDTH,
    max,
  };
};

const clampRightDrawerWidth = (value: number, viewportWidth: number) => {
  const { min, max } = resolveRightDrawerWidthBounds(viewportWidth);
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.round(clampNumber(min, safeValue, max));
};

const resolveDefaultRightDrawerWidth = (viewportWidth: number) => {
  const preferred = clampNumber(RIGHT_DRAWER_DEFAULT_MIN, viewportWidth * 0.52, RIGHT_DRAWER_DEFAULT_MAX);
  return clampRightDrawerWidth(preferred, viewportWidth);
};

const loadStoredRightDrawerWidth = (viewportWidth: number) => {
  if (typeof localStorage === 'undefined') return resolveDefaultRightDrawerWidth(viewportWidth);
  try {
    const raw = localStorage.getItem(RIGHT_DRAWER_WIDTH_STORAGE_KEY);
    if (!raw) return resolveDefaultRightDrawerWidth(viewportWidth);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return resolveDefaultRightDrawerWidth(viewportWidth);
    return clampRightDrawerWidth(parsed, viewportWidth);
  } catch {
    return resolveDefaultRightDrawerWidth(viewportWidth);
  }
};

type OrderSummaryDeleteTarget = {
  group: OrderGroupKey;
  entity: OrderEntity;
  bundle: OrderBundle;
  label: string;
};

export function SoapNotePanel({
  history,
  meta,
  author,
  readOnly,
  readOnlyReason,
  orderBundles,
  orderBundlesLoading = false,
  orderBundlesError,
  prescriptionBundles,
  prescriptionBundlesLoading = false,
  prescriptionBundlesError,
  orderDockOpenRequest,
  onOrderDockOpenConsumed,
  orderHistoryCopyRequest,
  onOrderHistoryCopyConsumed,
  documentDockOpenRequest,
  onDocumentDockOpenConsumed,
  documentHistoryCopyRequest,
  onDocumentHistoryCopyConsumed,
  documentPanel,
  orcaPanel,
  onOrderDockStateChange,
  onDraftSnapshot,
  replaceDraftRequest,
  applyDraftPatch,
  saveRequest,
  onSaveRequestResult,
  attachmentInsert,
  onAttachmentInserted,
  onAppendHistory,
  onDraftDirtyChange,
  onSyncStateChange,
  onClearHistory,
  onAuditLogged,
}: SoapNotePanelProps) {
  const isRevisionHistoryEnabled = import.meta.env.VITE_CHARTS_REVISION_HISTORY === '1';
  const queryClient = useQueryClient();
  type SoapNoteViewMode = 'both' | 'soap' | 'free';
  const SOAP_VIEW_MODE_STORAGE_KEY = 'opendolphin:web-client:charts:soap-view-mode:v1';
  const loadViewMode = (): SoapNoteViewMode => {
    if (typeof sessionStorage === 'undefined') return 'both';
    try {
      const raw = sessionStorage.getItem(SOAP_VIEW_MODE_STORAGE_KEY);
      return raw === 'soap' || raw === 'free' || raw === 'both' ? raw : 'both';
    } catch {
      return 'both';
    }
  };
  const [viewMode, setViewMode] = useState<SoapNoteViewMode>(() => loadViewMode());
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(SOAP_VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore storage errors
    }
  }, [viewMode]);
  const SOAP_HISTORY_VIEW_STORAGE_KEY = 'opendolphin:web-client:charts:soap-history-view:v1';
  const loadHistoryView = (): boolean => {
    if (typeof sessionStorage === 'undefined') return false;
    try {
      const raw = sessionStorage.getItem(SOAP_HISTORY_VIEW_STORAGE_KEY);
      return raw === '1';
    } catch {
      return false;
    }
  };
  const [historyView, setHistoryView] = useState<boolean>(() => loadHistoryView());
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(SOAP_HISTORY_VIEW_STORAGE_KEY, historyView ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, [historyView]);
  const [draft, setDraft] = useState<SoapDraft>(() => buildSoapDraftFromHistory(history));
  const [pendingTemplate, setPendingTemplate] = useState<Partial<Record<SoapSectionKey, string>>>({});
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateTargetSection, setTemplateTargetSection] = useState<SoapSectionKey>('subjective');
  const [templateSelection, setTemplateSelection] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{
    localSaved: boolean;
    serverSynced: boolean;
    isSaving: boolean;
    error?: string | null;
    savedAt?: string;
  }>({
    localSaved: false,
    serverSynced: true,
    isSaving: false,
    error: undefined,
  });
  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);
  const [subjectivesOpen, setSubjectivesOpen] = useState(false);
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false);
  const [saveRequestTokenHandled, setSaveRequestTokenHandled] = useState<string | null>(null);
  const dirtySectionsRef = useRef<Set<SoapSectionKey>>(new Set());

  const latestBySection = useMemo(() => getLatestSoapEntries(history), [history]);
  const markSectionsDirty = useCallback((sections: SoapSectionKey[]) => {
    sections.forEach((section) => dirtySectionsRef.current.add(section));
  }, []);
  const markSectionsClean = useCallback((sections: SoapSectionKey[]) => {
    sections.forEach((section) => dirtySectionsRef.current.delete(section));
  }, []);
  const clearPendingTemplatesForSections = useCallback((sections: SoapSectionKey[]) => {
    if (sections.length === 0) return;
    setPendingTemplate((prev) => {
      const next = { ...prev };
      sections.forEach((section) => {
        delete next[section];
      });
      return next;
    });
  }, []);
  const visibleSections = useMemo<SoapSectionKey[]>(() => {
    switch (viewMode) {
      case 'soap':
        return SOAP_SECTIONS.filter((section) => section !== 'free');
      case 'free':
        return ['free'];
      default:
        return SOAP_SECTIONS;
    }
  }, [viewMode]);
  useEffect(() => {
    if (SOAP_SECTIONS.includes(templateTargetSection)) return;
    setTemplateTargetSection(SOAP_SECTIONS[0] ?? 'subjective');
  }, [templateTargetSection]);
  const templateOptions = useMemo(() => filterTemplatesForSection(templateTargetSection), [templateTargetSection]);
  useEffect(() => {
    if (!templateSelection) return;
    const matched = templateOptions.some((item) => item.id === templateSelection);
    if (matched) return;
    setTemplateSelection('');
  }, [templateOptions, templateSelection]);
  const selectedTemplateOption = useMemo(
    () => templateOptions.find((item) => item.id === templateSelection) ?? null,
    [templateOptions, templateSelection],
  );
  const authoredMeta = useMemo(() => {
    if (history.length === 0) return { first: null as SoapEntry | null, last: null as SoapEntry | null };
    let first = history[0];
    let last = history[0];
    let firstTs = Date.parse(first.authoredAt);
    let lastTs = Date.parse(last.authoredAt);
    history.slice(1).forEach((entry) => {
      const ts = Date.parse(entry.authoredAt);
      if (!Number.isNaN(ts) && (Number.isNaN(firstTs) || ts < firstTs)) {
        first = entry;
        firstTs = ts;
      }
      if (!Number.isNaN(ts) && (Number.isNaN(lastTs) || ts > lastTs)) {
        last = entry;
        lastTs = ts;
      }
    });
    return { first, last };
  }, [history]);

  const orderEditorMeta = useMemo(
    () => ({
      ...meta,
      actorRole: author.role,
      readOnly,
      readOnlyReason,
    }),
    [author.role, meta, readOnly, readOnlyReason],
  );

  const effectiveOrderBundles = useMemo(() => {
    const baseBundles = orderBundles ?? [];
    if (!prescriptionBundles) return baseBundles;
    const nonPrescriptionBundles = baseBundles.filter((bundle) => {
      const group = resolveOrderGroupKeyByEntity(bundle.entity?.trim() ?? '');
      return group !== 'prescription';
    });
    return [...prescriptionBundles, ...nonPrescriptionBundles];
  }, [orderBundles, prescriptionBundles]);

  const resolvedOrderBundlesLoading = orderBundlesLoading || prescriptionBundlesLoading;
  const resolvedOrderBundlesError = orderBundlesError ?? prescriptionBundlesError;

  const requestSequenceRef = useRef(0);
  const buildDrawerRequestId = useCallback(() => {
    requestSequenceRef.current += 1;
    const ts = Date.now().toString(36);
    const perf = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000).toString(36) : '0';
    const seq = requestSequenceRef.current.toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `soap-order-${ts}-${perf}-${seq}-${rand}`;
  }, []);

  const [viewportW, setViewportW] = useState(() => resolveViewportWidth());
  const [rightDrawerWidth, setRightDrawerWidth] = useState(() => loadStoredRightDrawerWidth(resolveViewportWidth()));
  const [drawerMinimized, setDrawerMinimized] = useState(false);
  const [drawerPeek, setDrawerPeek] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<RightUtilityTool>('prescription');
  const [activeOrderEntity, setActiveOrderEntity] = useState<OrderEntity | null>(null);
  const [activeOrderRequest, setActiveOrderRequest] = useState<OrderBundleEditPanelRequest | null>(null);
  const [activeCenterPanel, setActiveCenterPanel] = useState<'order' | 'document' | null>(null);
  const [activeOrderContext, setActiveOrderContext] = useState<OrderBundleEditingContext>(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
  const [activeOrderSource, setActiveOrderSource] = useState<SoapOrderDockState['source']>(null);
  const [orderSummaryNotice, setOrderSummaryNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [orderSummaryDeleteTarget, setOrderSummaryDeleteTarget] = useState<OrderSummaryDeleteTarget | null>(null);
  const [pendingDocumentHistoryCopyRequest, setPendingDocumentHistoryCopyRequest] = useState<{
    requestId: string;
    letterId: number;
  } | null>(null);

  const lastOrderDockOpenRequestIdRef = useRef<string | null>(null);
  const lastOrderHistoryCopyRequestIdRef = useRef<string | null>(null);
  const lastDocumentDockOpenRequestIdRef = useRef<string | null>(null);
  const lastDocumentHistoryCopyRequestIdRef = useRef<string | null>(null);
  const pendingExternalHistoryCopyRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setViewportW(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setRightDrawerWidth((prev) => clampRightDrawerWidth(prev, viewportW));
  }, [viewportW]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(RIGHT_DRAWER_WIDTH_STORAGE_KEY, String(Math.round(rightDrawerWidth)));
    } catch {
      // ignore storage errors
    }
  }, [rightDrawerWidth]);

  const forcedOverlay = useMemo(
    () => viewportW <= RIGHT_DRAWER_OVERLAY_BREAKPOINT || viewportW - rightDrawerWidth < RIGHT_DRAWER_REQUIRED_MAIN_WIDTH,
    [rightDrawerWidth, viewportW],
  );
  const effectiveMode: 'dock' | 'overlay' = forcedOverlay ? 'overlay' : 'dock';
  const effectiveMinimized = drawerMinimized || drawerPeek;

  const orderBundlesByGroup = useMemo(() => {
    const map = new Map<OrderGroupKey, OrderBundle[]>();
    ORDER_GROUP_REGISTRY.forEach((spec) => map.set(spec.key, []));
    effectiveOrderBundles.forEach((bundle) => {
      const group = resolveOrderGroupKeyByEntity(bundle.entity?.trim() ?? '');
      if (!group) return;
      const list = map.get(group) ?? [];
      list.push(bundle);
      map.set(group, list);
    });
    return map;
  }, [effectiveOrderBundles]);

  const totalOrderBundleCount = useMemo(() => {
    return ORDER_GROUP_REGISTRY.reduce((sum, spec) => sum + (orderBundlesByGroup.get(spec.key)?.length ?? 0), 0);
  }, [orderBundlesByGroup]);

  const openOrderCategoryFromTool = useCallback(
    (groupKey: OrderGroupKey, source: SoapOrderDockState['source']) => {
      const groupSpec = resolveGroupSpec(groupKey);
      if (!groupSpec) return;
      const categoryBundles = orderBundlesByGroup.get(groupKey) ?? [];
      const latestBundle = resolveLatestBundle(categoryBundles);
      const nextEntity = latestBundle
        ? normalizeBundleEntity(latestBundle, groupSpec.defaultEntity)
        : groupSpec.defaultEntity;
      setActiveTool(groupKey);
      setDrawerOpen(true);
      setActiveOrderEntity(nextEntity);
      setActiveOrderRequest(null);
      setActiveOrderSource(source ?? null);
      setActiveOrderContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
      setActiveCenterPanel(null);
    },
    [orderBundlesByGroup],
  );

  const selectUtilityTool = useCallback(
    (tool: RightUtilityTool, source: SoapOrderDockState['source']) => {
      openOrderCategoryFromTool(tool, source);
    },
    [openOrderCategoryFromTool],
  );

  const handleDockToolSelect = useCallback(
    (tool: RightUtilityTool) => {
      if (drawerOpen && tool === activeTool) {
        setDrawerPeek(false);
        if (effectiveMode === 'dock') {
          setDrawerMinimized((prev) => !prev);
        } else {
          setDrawerOpen(false);
        }
        return;
      }
      setDrawerPeek(false);
      setDrawerMinimized(false);
      selectUtilityTool(tool, 'right-panel');
    },
    [activeTool, drawerOpen, effectiveMode, selectUtilityTool],
  );

  const handleDrawerToolSelect = useCallback(
    (tool: RightUtilityTool) => {
      setDrawerPeek(false);
      setDrawerMinimized(false);
      selectUtilityTool(tool, 'right-panel');
    },
    [selectUtilityTool],
  );

  const handleOrderSummaryBundleSelect = useCallback(
    (payload: { group: OrderGroupKey; entity: OrderEntity; bundle: OrderBundle }) => {
      setActiveTool(payload.group);
      setDrawerOpen(true);
      setActiveOrderEntity(payload.entity);
      setActiveOrderRequest({ requestId: buildDrawerRequestId(), kind: 'edit', bundle: payload.bundle });
      setActiveOrderSource('right-panel');
      setActiveOrderContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
      setActiveCenterPanel('order');
    },
    [buildDrawerRequestId],
  );

  const handleDrawerOrderRequest = useCallback(
    (entity: OrderEntity, request: OrderBundleEditPanelRequest) => {
      const groupKey = resolveOrderGroupKeyByEntity(entity);
      if (!groupKey) return;
      setActiveTool(groupKey);
      setDrawerPeek(false);
      if (request.kind === 'new') {
        setDrawerMinimized(true);
      }
      setActiveOrderEntity(entity);
      setActiveOrderRequest(request);
      setActiveOrderSource('right-panel');
      setActiveOrderContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
      setActiveCenterPanel('order');
    },
    [],
  );

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setDrawerPeek(false);
  }, []);

  const handleDrawerWidthChange = useCallback(
    (nextWidth: number) => {
      setRightDrawerWidth(clampRightDrawerWidth(nextWidth, viewportW));
    },
    [viewportW],
  );

  const handleDrawerOrderEntitySwitch = useCallback(
    (entity: OrderEntity) => {
      setActiveOrderEntity(entity);
      setActiveOrderRequest(null);
      setActiveCenterPanel(null);
    },
    [],
  );

  const handleDrawerOrderRequestConsumed = useCallback(
    (requestId: string) => {
      setActiveOrderRequest((prev) => (prev?.requestId === requestId ? null : prev));
      if (pendingExternalHistoryCopyRequestIdRef.current === requestId) {
        pendingExternalHistoryCopyRequestIdRef.current = null;
        onOrderHistoryCopyConsumed?.(requestId);
      }
    },
    [onOrderHistoryCopyConsumed],
  );

  const handleDocumentHistoryCopyConsumed = useCallback(
    (requestId: string) => {
      setPendingDocumentHistoryCopyRequest((prev) => (prev?.requestId === requestId ? null : prev));
      onDocumentHistoryCopyConsumed?.(requestId);
    },
    [onDocumentHistoryCopyConsumed],
  );

  useEffect(() => {
    if (!orderDockOpenRequest) return;
    if (orderDockOpenRequest.requestId === lastOrderDockOpenRequestIdRef.current) return;
    lastOrderDockOpenRequestIdRef.current = orderDockOpenRequest.requestId;
    const groupKey = resolveOrderGroupKeyByEntity(orderDockOpenRequest.entity);
    if (groupKey) {
      const groupSpec = resolveGroupSpec(groupKey);
      if (groupSpec) {
        const entityBundles = (orderBundlesByGroup.get(groupKey) ?? []).filter((bundle) =>
          isBundleMatchedToEntity(bundle, orderDockOpenRequest.entity, groupSpec.defaultEntity),
        );
        const latestBundle = resolveLatestBundle(entityBundles);
        setActiveTool(groupKey);
        setDrawerOpen(true);
        setDrawerPeek(false);
        if (!latestBundle) {
          setDrawerMinimized(true);
        }
        setActiveOrderEntity(orderDockOpenRequest.entity);
        setActiveOrderRequest(
          latestBundle
            ? { requestId: orderDockOpenRequest.requestId, kind: 'edit', bundle: latestBundle }
            : { requestId: orderDockOpenRequest.requestId, kind: 'new' },
        );
        setActiveOrderSource('bottom-floating');
        setActiveOrderContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
        setActiveCenterPanel('order');
      }
    }
    onOrderDockOpenConsumed?.(orderDockOpenRequest.requestId);
  }, [onOrderDockOpenConsumed, orderBundlesByGroup, orderDockOpenRequest]);

  useEffect(() => {
    if (!orderHistoryCopyRequest) return;
    if (orderHistoryCopyRequest.requestId === lastOrderHistoryCopyRequestIdRef.current) return;
    lastOrderHistoryCopyRequestIdRef.current = orderHistoryCopyRequest.requestId;
    const groupKey = resolveOrderGroupKeyByEntity(orderHistoryCopyRequest.entity);
    if (!groupKey) {
      onOrderHistoryCopyConsumed?.(orderHistoryCopyRequest.requestId);
      return;
    }
    pendingExternalHistoryCopyRequestIdRef.current = orderHistoryCopyRequest.requestId;
    setActiveTool(groupKey);
    setDrawerOpen(true);
    setActiveOrderEntity(orderHistoryCopyRequest.entity);
    setActiveOrderRequest({
      requestId: orderHistoryCopyRequest.requestId,
      kind: 'copy',
      bundle: orderHistoryCopyRequest.bundle,
    });
    setActiveOrderSource('bottom-floating');
    setActiveOrderContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
    setActiveCenterPanel('order');
  }, [onOrderHistoryCopyConsumed, orderHistoryCopyRequest]);

  useEffect(() => {
    if (!documentDockOpenRequest) return;
    if (documentDockOpenRequest.requestId === lastDocumentDockOpenRequestIdRef.current) return;
    lastDocumentDockOpenRequestIdRef.current = documentDockOpenRequest.requestId;
    setActiveCenterPanel('document');
    onDocumentDockOpenConsumed?.(documentDockOpenRequest.requestId);
  }, [documentDockOpenRequest, onDocumentDockOpenConsumed]);

  useEffect(() => {
    if (!documentHistoryCopyRequest) return;
    if (documentHistoryCopyRequest.requestId === lastDocumentHistoryCopyRequestIdRef.current) return;
    lastDocumentHistoryCopyRequestIdRef.current = documentHistoryCopyRequest.requestId;
    setPendingDocumentHistoryCopyRequest(documentHistoryCopyRequest);
    setActiveCenterPanel('document');
  }, [documentHistoryCopyRequest]);

  useEffect(() => {
    const targetCategory = activeOrderEntity ? resolveOrderGroupKeyByEntity(activeOrderEntity) ?? activeTool : null;
    const hasEditing = activeCenterPanel === 'order' && Boolean(targetCategory && activeOrderEntity);
    const count = targetCategory
      ? orderBundlesByGroup.get(targetCategory)?.length ?? 0
      : totalOrderBundleCount;
    const editingLabel = hasEditing
      ? `${resolveOrderEntityLabel(activeOrderEntity ?? '')}${activeOrderContext.hasRpRequiredIssue ? '（必須不足）' : ''}`
      : undefined;
    onOrderDockStateChange?.({
      hasEditing,
      targetCategory,
      count,
      editingLabel,
      source: hasEditing ? activeOrderSource : null,
    });
  }, [
    activeOrderContext.hasRpRequiredIssue,
    activeCenterPanel,
    activeOrderEntity,
    activeOrderSource,
    activeTool,
    drawerOpen,
    onOrderDockStateChange,
    orderBundlesByGroup,
    totalOrderBundleCount,
  ]);

  const handleOpenDocumentPanel = useCallback(() => {
    setActiveCenterPanel('document');
  }, []);

  const handleCloseCenterPanel = useCallback(() => {
    setActiveCenterPanel(null);
  }, []);

  const orderSummaryDeleteMutation = useMutation({
    mutationFn: async (target: OrderSummaryDeleteTarget) => {
      if (readOnly) throw new Error(readOnlyReason ?? '読み取り専用のため削除できません。');
      if (!meta.patientId) throw new Error('patientId is required');
      return mutateOrderBundles({
        patientId: meta.patientId,
        operations: [
          {
            operation: 'delete',
            documentId: target.bundle.documentId,
            moduleId: target.bundle.moduleId,
            entity: target.entity,
          },
        ],
      });
    },
    onSuccess: (result, target) => {
      const message = result.ok ? 'オーダーを削除しました。' : result.message ?? 'オーダーの削除に失敗しました。';
      setOrderSummaryNotice({ tone: result.ok ? 'success' : 'error', message });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: result.ok ? 'success' : 'error',
          subject: 'charts',
          details: {
            runId: result.runId ?? meta.runId,
            operation: 'delete',
            entity: target.entity,
            patientId: meta.patientId,
            documentId: target.bundle.documentId,
            moduleId: target.bundle.moduleId,
            bundleName: target.bundle.bundleName,
            itemCount: target.bundle.items?.length ?? 0,
            ...(result.ok ? {} : { error: message }),
          },
        },
      });
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ['charts-order-bundles'] });
        const activeEditBundle =
          activeOrderRequest && (activeOrderRequest.kind === 'edit' || activeOrderRequest.kind === 'copy')
            ? activeOrderRequest.bundle
            : null;
        if (activeEditBundle?.documentId === target.bundle.documentId && activeEditBundle?.moduleId === target.bundle.moduleId) {
          setActiveOrderRequest(null);
          setActiveCenterPanel(null);
        }
      }
      onAuditLogged?.();
    },
    onError: (error: unknown, target) => {
      const message = error instanceof Error ? error.message : String(error);
      setOrderSummaryNotice({ tone: 'error', message: `オーダーの削除に失敗しました: ${message}` });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: 'error',
          subject: 'charts',
          details: {
            runId: meta.runId,
            operation: 'delete',
            entity: target.entity,
            patientId: meta.patientId,
            documentId: target.bundle.documentId,
            moduleId: target.bundle.moduleId,
            bundleName: target.bundle.bundleName,
            itemCount: target.bundle.items?.length ?? 0,
            error: message,
          },
        },
      });
      onAuditLogged?.();
    },
    onSettled: () => {
      setOrderSummaryDeleteTarget(null);
    },
  });

  const closeOrderSummaryDeleteDialog = useCallback(() => {
    if (orderSummaryDeleteMutation.isPending) return;
    setOrderSummaryDeleteTarget(null);
  }, [orderSummaryDeleteMutation.isPending]);

  const historySignature = useMemo(
    () => history.map((entry) => entry.id ?? entry.authoredAt ?? '').join('|'),
    [history],
  );

  useEffect(() => {
    const nextDraft = buildSoapDraftFromHistory(history);
    const dirtySections = dirtySectionsRef.current;
    setDraft((prev) => {
      if (dirtySections.size === 0) return nextDraft;
      return SOAP_SECTIONS.reduce<SoapDraft>(
        (acc, section) => {
          acc[section] = dirtySections.has(section) ? (prev[section] ?? '') : nextDraft[section];
          return acc;
        },
        {
          free: '',
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
        },
      );
    });
    setTemplateSelection('');
    setTemplateDialogOpen(false);
    setPendingTemplate((prev) => {
      if (dirtySectionsRef.current.size === 0) return {};
      const next = { ...prev };
      SOAP_SECTIONS.forEach((section) => {
        if (!dirtySectionsRef.current.has(section)) {
          delete next[section];
        }
      });
      return next;
    });
    if (dirtySectionsRef.current.size === 0) {
      setFeedback(null);
    }
    setSyncState((prev) =>
      dirtySectionsRef.current.size === 0
        ? {
            localSaved: false,
            serverSynced: true,
            isSaving: false,
            error: undefined,
            savedAt: undefined,
          }
        : {
            ...prev,
            serverSynced: false,
            isSaving: false,
          },
    );
    setSubjectivesOpen(false);
  }, [historySignature]);

  useEffect(() => {
    onDraftSnapshot?.(draft);
  }, [draft, onDraftSnapshot]);

  useEffect(() => {
    onSyncStateChange?.(syncState);
  }, [onSyncStateChange, syncState]);

  const markDirtyPendingSync = useCallback(() => {
    setSyncState({
      localSaved: false,
      serverSynced: false,
      isSaving: false,
      error: undefined,
      savedAt: undefined,
    });
  }, []);

  useEffect(() => {
    if (!replaceDraftRequest) return;
    if (readOnly) {
      setFeedback(readOnlyReason ?? '読み取り専用のためセット反映できません。');
      return;
    }
    markDirtyPendingSync();
    markSectionsDirty(SOAP_SECTIONS);
    setDraft(replaceDraftRequest.draft);
    setFeedback(replaceDraftRequest.note ?? 'SOAPドラフトをオーダーセットから反映しました。');
    onDraftDirtyChange?.({
      dirty: true,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      receptionId: meta.receptionId,
      visitDate: meta.visitDate,
      dirtySources: ['soap'],
    });
  }, [
    meta.appointmentId,
    meta.patientId,
    meta.receptionId,
    meta.visitDate,
    markDirtyPendingSync,
    markSectionsDirty,
    onDraftDirtyChange,
    readOnly,
    readOnlyReason,
    replaceDraftRequest?.token,
  ]);

  useEffect(() => {
    if (!applyDraftPatch) return;
    if (readOnly) {
      setFeedback(readOnlyReason ?? '読み取り専用のため転記できません。');
      return;
    }
    markDirtyPendingSync();
    markSectionsDirty([applyDraftPatch.section]);
    setDraft((prev) => ({ ...prev, [applyDraftPatch.section]: applyDraftPatch.body }));
    setFeedback(applyDraftPatch.note ?? `${SOAP_SECTION_LABELS[applyDraftPatch.section]} を転記しました。`);
    onDraftDirtyChange?.({
      dirty: true,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      receptionId: meta.receptionId,
      visitDate: meta.visitDate,
      dirtySources: ['soap'],
    });
  }, [
    applyDraftPatch?.token,
    markDirtyPendingSync,
    markSectionsDirty,
    meta.appointmentId,
    meta.patientId,
    meta.receptionId,
    meta.visitDate,
    onDraftDirtyChange,
    readOnly,
    readOnlyReason,
  ]);

  useEffect(() => {
    if (!isRevisionHistoryEnabled) setRevisionDrawerOpen(false);
  }, [isRevisionHistoryEnabled]);

  useEffect(() => {
    if (!attachmentInsert) return;
    if (readOnly) {
      setFeedback(readOnlyReason ?? '読み取り専用のため挿入できません。');
      onAttachmentInserted?.();
      return;
    }
    markDirtyPendingSync();
    const targetSection = attachmentInsert.section ?? 'free';
    markSectionsDirty([targetSection]);
    setDraft((prev) => ({
      ...prev,
      [targetSection]: appendImageAttachmentPlaceholders(prev[targetSection], attachmentInsert.attachment),
    }));
    setFeedback(`画像リンクを ${SOAP_SECTION_LABELS[targetSection]} に挿入しました。`);
    onDraftDirtyChange?.({
      dirty: true,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      receptionId: meta.receptionId,
      visitDate: meta.visitDate,
      dirtySources: ['soap'],
    });
    onAttachmentInserted?.();
  }, [
    attachmentInsert?.token,
    attachmentInsert,
    meta.appointmentId,
    meta.patientId,
    meta.receptionId,
    meta.visitDate,
    markDirtyPendingSync,
    markSectionsDirty,
    onAttachmentInserted,
    onDraftDirtyChange,
    readOnly,
    readOnlyReason,
  ]);

  const updateDraft = useCallback(
    (section: SoapSectionKey, value: string) => {
      markDirtyPendingSync();
      markSectionsDirty([section]);
      setDraft((prev) => ({ ...prev, [section]: value }));
      setFeedback(null);
      onDraftDirtyChange?.({
        dirty: true,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        dirtySources: ['soap'],
      });
    },
    [markDirtyPendingSync, markSectionsDirty, meta.appointmentId, meta.patientId, meta.receptionId, meta.visitDate, onDraftDirtyChange],
  );

  const handleTemplateInsert = useCallback(
    (section: SoapSectionKey, templateId: string) => {
      if (!templateId) {
        setFeedback('テンプレートを選択してください。');
        return;
      }
      const template = SOAP_TEMPLATES.find((item) => item.id === templateId);
      const snippet = template?.sections?.[section];
      if (!snippet) {
        setFeedback('テンプレート本文が見つかりません。');
        return;
      }
      setDraft((prev) => {
        const current = prev[section];
        const next = current ? `${current}\n${snippet}` : snippet;
        return { ...prev, [section]: next };
      });
      setPendingTemplate((prev) => ({ ...prev, [section]: templateId }));
      setTemplateSelection('');
      markDirtyPendingSync();
      markSectionsDirty([section]);
      const authoredAt = new Date().toISOString();
      recordChartsAuditEvent({
        action: 'SOAP_TEMPLATE_APPLY',
        outcome: 'success',
        subject: 'chart-soap-template',
        actor: resolveAuthorLabel(author),
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        note: `${SOAP_SECTION_LABELS[section]} テンプレ挿入`,
        details: {
          soapSection: section,
          templateId,
          authoredAt,
          authorRole: author.role,
          authorName: resolveAuthorLabel(author),
          receptionId: meta.receptionId,
          visitDate: meta.visitDate,
          soapLength: snippet.length,
        },
      });
      setFeedback(`テンプレート「${template?.label ?? templateId}」を挿入しました。`);
      onDraftDirtyChange?.({
        dirty: true,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        dirtySources: ['soap'],
      });
    },
    [
      author,
      markDirtyPendingSync,
      markSectionsDirty,
      meta.appointmentId,
      meta.cacheHit,
      meta.dataSourceTransition,
      meta.fallbackUsed,
      meta.missingMaster,
      meta.patientId,
      meta.receptionId,
      meta.runId,
      meta.visitDate,
      onDraftDirtyChange,
    ],
  );

  const handleSave = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
    serverSynced: boolean;
    localSaved: boolean;
    error?: string | null;
  }> => {
    if (readOnly) {
      const message = readOnlyReason ?? '読み取り専用のため保存できません。';
      setFeedback(message);
      return { ok: false, message, serverSynced: false, localSaved: false, error: 'read_only' };
    }

    const authoredAt = new Date().toISOString();
    const entries: SoapEntry[] = [];
    const emptyClears: SoapSectionKey[] = [];
    SOAP_SECTIONS.forEach((section) => {
      const bodyRaw = draft[section] ?? '';
      const body = bodyRaw.trim();
      const prior = latestBySection.get(section);
      const priorBody = (prior?.body ?? '').trim();
      const sectionDirty = dirtySectionsRef.current.has(section) || Boolean(pendingTemplate[section]);

      if (!body) {
        if (priorBody.length > 0) {
          emptyClears.push(section);
        }
        return;
      }

      if (!sectionDirty) return;
      if (prior && body === priorBody && !pendingTemplate[section]) return;

      const action = prior ? 'update' : 'save';
      const templateId = pendingTemplate[section] ?? prior?.templateId ?? null;
      const authorLabel = resolveAuthorLabel(author);
      const soapLength = body.length;
      const entry: SoapEntry = {
        id: buildSoapEntryId(section, authoredAt),
        section,
        body,
        templateId: templateId ?? undefined,
        authoredAt,
        authorRole: author.role,
        authorName: authorLabel,
        action,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
      };
      entries.push(entry);

      recordChartsAuditEvent({
        action: action === 'save' ? 'SOAP_NOTE_SAVE' : 'SOAP_NOTE_UPDATE',
        outcome: 'success',
        subject: 'chart-soap-note',
        actor: authorLabel,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        note: `${SOAP_SECTION_LABELS[section]} 記載`,
        details: {
          soapSection: section,
          authoredAt,
          authorRole: author.role,
          authorName: authorLabel,
          templateId,
          soapLength,
          receptionId: meta.receptionId,
          visitDate: meta.visitDate,
        },
      });
    });

    if (emptyClears.length > 0) {
      const targets = emptyClears.map((section) => SOAP_SECTION_LABELS[section]).join(', ');
      const message = `保存前確認: 既存記載を空欄にする削除操作は未対応です。対象: ${targets}`;
      setFeedback(message);
      setSyncState({
        localSaved: false,
        serverSynced: false,
        isSaving: false,
        error: 'clear_not_supported',
        savedAt: undefined,
      });
      onDraftDirtyChange?.({
        dirty: true,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        dirtySources: ['soap'],
      });
      return { ok: false, message, serverSynced: false, localSaved: false, error: 'clear_not_supported' };
    }

    if (entries.length === 0) {
      const message = '変更がないため保存できません。';
      setFeedback(message);
      return { ok: false, message, serverSynced: syncState.serverSynced, localSaved: syncState.localSaved, error: 'no_changes' };
    }

    setSyncState({
      localSaved: false,
      serverSynced: false,
      isSaving: true,
      error: undefined,
      savedAt: authoredAt,
    });
    setFeedback(`${entries.length} セクションを保存中です...`);
    onDraftDirtyChange?.({
      dirty: true,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      receptionId: meta.receptionId,
      visitDate: meta.visitDate,
      dirtySources: ['soap'],
    });

    if (!meta.patientId) {
      onAppendHistory?.(entries);
      onAuditLogged?.();
      setPendingTemplate({});
      const detail = '患者未選択のため院内ローカル SOAP 保存をカルテへ確定できません。患者選択後に再確認してください。';
      const message = `${entries.length} セクションを院内ローカル保存しました。${detail}`;
      setFeedback(message);
      setSyncState({
        localSaved: true,
        serverSynced: false,
        isSaving: false,
        error: detail,
        savedAt: authoredAt,
      });
      return { ok: false, message, serverSynced: false, localSaved: true, error: detail };
    }

    const performDate = meta.visitDate ?? new Date().toISOString().slice(0, 10);
    const requests = entries.reduce<Array<{ entry: SoapEntry; payload: ChartSubjectiveEntryRequest }>>((acc, entry) => {
      const soapCategory = resolveSoapCategory(entry.section);
      if (!soapCategory) return acc;
      acc.push({
        entry,
        payload: {
          patientId: meta.patientId as string,
          performDate,
          soapCategory,
          displaySection: entry.section,
          body: entry.body,
        },
      });
      return acc;
    }, []);

    if (requests.length === 0) {
      onAppendHistory?.(entries);
      onAuditLogged?.();
      setPendingTemplate({});
      const message = `SOAP保存完了（ローカル下書きのみ: ${entries.length} セクション）`;
      setFeedback(message);
      setSyncState({
        localSaved: true,
        serverSynced: true,
        isSaving: false,
        error: undefined,
        savedAt: authoredAt,
      });
      onDraftDirtyChange?.({
        dirty: false,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        dirtySources: [],
      });
      return { ok: true, message, serverSynced: true, localSaved: true };
    }

    try {
      const results = await Promise.all(
        requests.map(async ({ entry, payload }) => {
          try {
            const result = await postChartSubjectiveEntry(payload);
            return { entry, result };
          } catch (error) {
            const result: ChartSubjectiveEntryResponse = { ok: false, status: 0, apiResultMessage: String(error) };
            return { entry, result };
          }
        }),
      );
      const failures = results.filter(({ result }) => !result.ok || (result.apiResult && result.apiResult !== '00'));
      const successfulEntries = results
        .filter(({ result }) => result.ok && (!result.apiResult || result.apiResult === '00'))
        .map(({ entry, result }) => buildCanonicalSoapEntryFromReadback(entry, result.entry, result.recordedAt));
      if (failures.length > 0) {
        const successfulSections = successfulEntries.map((entry) => entry.section);
        if (successfulEntries.length > 0) {
          markSectionsClean(successfulSections);
          clearPendingTemplatesForSections(successfulSections);
          onAppendHistory?.(successfulEntries);
          onAuditLogged?.();
        }
        const detail = failures[0]?.result.apiResultMessage ?? failures[0]?.result.apiResult ?? 'unknown';
        const safeMessage = resolveSoapSaveErrorCopy(detail);
        const message =
          successfulEntries.length > 0
            ? `SOAPのみ未保存: 成功 ${successfulEntries.length} 件 / 未保存 ${failures.length} 件。${safeMessage}`
            : `SOAPのみ未保存: ${safeMessage}`;
        setFeedback(message);
        setSyncState({
          localSaved: successfulEntries.length > 0,
          serverSynced: false,
          isSaving: false,
          error: safeMessage,
          savedAt: authoredAt,
        });
        onDraftDirtyChange?.({
          dirty: true,
          patientId: meta.patientId,
          appointmentId: meta.appointmentId,
          receptionId: meta.receptionId,
          visitDate: meta.visitDate,
          dirtySources: ['soap'],
        });
        return { ok: false, message, serverSynced: false, localSaved: successfulEntries.length > 0, error: safeMessage };
      }

      const successfulSections = successfulEntries.map((entry) => entry.section);
      markSectionsClean(successfulSections);
      onAppendHistory?.(successfulEntries);
      onAuditLogged?.();
      setPendingTemplate({});
      const message = `SOAP保存完了（ローカル下書き + ローカルカルテ ${results.length} 件）`;
      setFeedback(message);
      setSyncState({
        localSaved: true,
        serverSynced: true,
        isSaving: false,
        error: undefined,
        savedAt: authoredAt,
      });
      onDraftDirtyChange?.({
        dirty: false,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        dirtySources: [],
      });
      return { ok: true, message, serverSynced: true, localSaved: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const safeMessage = resolveSoapSaveErrorCopy(detail);
      const message = `SOAPのみ未保存: ${safeMessage}`;
      setFeedback(message);
      setSyncState({
        localSaved: false,
        serverSynced: false,
        isSaving: false,
        error: safeMessage,
        savedAt: authoredAt,
      });
      onDraftDirtyChange?.({
        dirty: true,
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        dirtySources: ['soap'],
      });
      return { ok: false, message, serverSynced: false, localSaved: false, error: safeMessage };
    }
  }, [
    author,
    clearPendingTemplatesForSections,
    draft,
    latestBySection,
    markSectionsClean,
    meta.appointmentId,
    meta.cacheHit,
    meta.dataSourceTransition,
    meta.fallbackUsed,
    meta.missingMaster,
    meta.patientId,
    meta.receptionId,
    meta.runId,
    meta.visitDate,
    onAppendHistory,
    onAuditLogged,
    onDraftDirtyChange,
    pendingTemplate,
    readOnly,
    readOnlyReason,
    syncState.localSaved,
    syncState.serverSynced,
  ]);

  useEffect(() => {
    if (!saveRequest?.token) return;
    if (saveRequest.token === saveRequestTokenHandled) return;
    setSaveRequestTokenHandled(saveRequest.token);
    void (async () => {
      const result = await handleSave();
      onSaveRequestResult?.({
        token: saveRequest.token,
        ok: result.ok,
        message: result.message,
        serverSynced: result.serverSynced,
        localSaved: result.localSaved,
        error: result.error,
      });
    })();
  }, [handleSave, onSaveRequestResult, saveRequest, saveRequestTokenHandled]);

  const handleClear = useCallback(() => {
    markDirtyPendingSync();
    markSectionsDirty(SOAP_SECTIONS);
    setDraft({
      free: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    });
    setPendingTemplate({});
    setFeedback('入力内容をクリアしました。');
    onDraftDirtyChange?.({
      dirty: true,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      receptionId: meta.receptionId,
      visitDate: meta.visitDate,
      dirtySources: ['soap'],
    });
  }, [markDirtyPendingSync, markSectionsDirty, meta.appointmentId, meta.patientId, meta.receptionId, meta.visitDate, onDraftDirtyChange]);

  const handleClearHistory = useCallback(() => {
    if (!onClearHistory) return;
    setClearHistoryDialogOpen(true);
  }, [onClearHistory]);

  const handleConfirmClearHistory = useCallback(() => {
    if (!onClearHistory) return;
    setClearHistoryDialogOpen(false);
    onClearHistory();
    setDraft({
      free: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    });
    setPendingTemplate({});
    setTemplateSelection('');
    setTemplateDialogOpen(false);
    setSyncState({
      localSaved: false,
      serverSynced: true,
      isSaving: false,
      error: undefined,
      savedAt: undefined,
    });
    setFeedback('SOAP履歴をクリアしました。');
  }, [onClearHistory]);

  const cycleViewMode = useCallback(() => {
    setViewMode((prev) => {
      switch (prev) {
        case 'both':
          return 'soap';
        case 'soap':
          return 'free';
        default:
          return 'both';
      }
    });
  }, []);

  const viewModeLabel = useMemo(() => {
    switch (viewMode) {
      case 'soap':
        return 'SOAPのみ';
      case 'free':
        return 'FREEのみ';
      default:
        return '両方';
    }
  }, [viewMode]);
  const handleTemplateDialogOpen = useCallback(() => {
    setTemplateSelection('');
    if (!SOAP_SECTIONS.includes(templateTargetSection)) {
      setTemplateTargetSection(SOAP_SECTIONS[0] ?? 'subjective');
    }
    setTemplateDialogOpen(true);
  }, [templateTargetSection]);
  const handleTemplateDialogApply = useCallback(() => {
    if (!templateSelection) {
      setFeedback('テンプレートを選択してください。');
      return;
    }
    handleTemplateInsert(templateTargetSection, templateSelection);
    setTemplateDialogOpen(false);
  }, [handleTemplateInsert, templateSelection, templateTargetSection]);

  const resolveEntryActor = (entry?: SoapEntry | null): string => {
    if (!entry) return '—';
    const raw = entry.authorName ?? entry.authorRole ?? '';
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : '不明';
  };

  const authoredFirst = authoredMeta.first;
  const authoredLast = authoredMeta.last;
  const authoredSummary = authoredLast
    ? `最終更新: ${formatSoapAuthoredAt(authoredLast.authoredAt)} / ${resolveEntryActor(authoredLast)}`
    : '記載履歴なし';

  useEffect(() => {
    if (!historyView) return;
    setSubjectivesOpen(false);
  }, [historyView]);

  type HistoryDiff = { section: SoapSectionKey; removed: string[]; added: string[] };
  type HistoryStep = { key: string; authoredAt: string; actor: string; actionLabel: string; diffs: HistoryDiff[] };

  const historyTimeline = useMemo<HistoryStep[]>(() => {
    if (!history || history.length === 0) return [];
    const sorted = history
      .slice()
      .sort((a, b) => (a.authoredAt ?? '').localeCompare(b.authoredAt ?? ''))
      .filter(Boolean);

    const groupEntries = new Map<string, SoapEntry[]>();
    sorted.forEach((entry) => {
      const key = entry.authoredAt?.trim() ? entry.authoredAt.trim() : `unknown:${entry.section}:${entry.id ?? ''}`;
      const list = groupEntries.get(key) ?? [];
      list.push(entry);
      groupEntries.set(key, list);
    });

    const snapshot: Record<SoapSectionKey, string> = {
      free: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    };

    const diffLines = (before: string, after: string): { removed: string[]; added: string[] } => {
      const normalizeLine = (line: string) => line.trimEnd();
      const beforeLines = before
        .split('\n')
        .map(normalizeLine)
        .filter((line) => line.trim().length > 0);
      const afterLines = after
        .split('\n')
        .map(normalizeLine)
        .filter((line) => line.trim().length > 0);
      const afterSet = new Set(afterLines);
      const beforeSet = new Set(beforeLines);
      const removed = beforeLines.filter((line) => !afterSet.has(line));
      const added = afterLines.filter((line) => !beforeSet.has(line));
      return {
        removed: removed.slice(0, 12),
        added: added.slice(0, 12),
      };
    };

    const steps: HistoryStep[] = [];

    Array.from(groupEntries.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([authoredAt, entries], index) => {
        const before = { ...snapshot };
        entries.forEach((entry) => {
          snapshot[entry.section] = entry.body ?? '';
        });

        const actorRaw = entries[0]?.authorName ?? entries[0]?.authorRole ?? '';
        const actor = actorRaw.trim() ? actorRaw.trim() : '不明';
        const actionLabel = (() => {
          const actions = new Set(entries.map((e) => e.action));
          if (actions.has('update')) return '更新';
          if (actions.has('save')) return '保存';
          return actions.size > 0 ? Array.from(actions.values()).join(',') : '—';
        })();
        const diffs: HistoryDiff[] = [];
        entries.forEach((entry) => {
          const { removed, added } = diffLines(before[entry.section] ?? '', snapshot[entry.section] ?? '');
          if (removed.length === 0 && added.length === 0) return;
          diffs.push({ section: entry.section, removed, added });
        });

        steps.push({
          key: `${authoredAt}-${index}`,
          authoredAt,
          actor,
          actionLabel,
          diffs,
        });
      });

    // Newest first.
    steps.reverse();
    return steps;
  }, [history]);

  const rightDrawerReservedWidth =
    drawerOpen && effectiveMode === 'dock'
      ? (effectiveMinimized ? RIGHT_DRAWER_HANDLE_WIDTH : rightDrawerWidth) + 12
      : 0;
  const soapNoteStyle = useMemo(
    () =>
      ({
        '--soap-right-drawer-reserved': `${rightDrawerReservedWidth}px`,
      }) as CSSProperties,
    [rightDrawerReservedWidth],
  );
  const rightUtilityDrawerProps = {
    open: drawerOpen,
    activeTool,
    patientId: meta.patientId,
    meta: orderEditorMeta,
    orderBundles: effectiveOrderBundles,
    orderBundlesLoading: resolvedOrderBundlesLoading,
    orderBundlesError: resolvedOrderBundlesError,
    prescriptionBundles,
    prescriptionBundlesLoading,
    prescriptionBundlesError,
    activeOrderEntity,
    activeOrderRequest,
    onOrderEntitySwitch: handleDrawerOrderEntitySwitch,
    onOrderRequest: handleDrawerOrderRequest,
    onClose: handleDrawerClose,
    mode: effectiveMode,
    minimized: effectiveMinimized,
    width: rightDrawerWidth,
    onMinimizedChange: setDrawerMinimized,
    onPeekChange: setDrawerPeek,
    onWidthChange: handleDrawerWidthChange,
    onToolSelect: handleDrawerToolSelect,
  };

  const centerDocumentPanel = useMemo(
    () => cloneDocumentPanelNode(documentPanel, pendingDocumentHistoryCopyRequest, handleDocumentHistoryCopyConsumed),
    [documentPanel, handleDocumentHistoryCopyConsumed, pendingDocumentHistoryCopyRequest],
  );

  const centerOrderPanel = useMemo(() => {
    if (!activeOrderEntity || activeCenterPanel !== 'order') return null;
    const entityMeta = resolveOrderEntityEditorMeta(activeOrderEntity);
    const activeGroup = resolveOrderGroupKeyByEntity(activeOrderEntity);
    if (!entityMeta || !activeGroup) return null;
    if (activeGroup === 'prescription') {
      return (
        <PrescriptionOrderEditorPanel
          patientId={meta.patientId}
          meta={orderEditorMeta}
          variant="embedded"
          request={activeOrderRequest}
          onRequestConsumed={handleDrawerOrderRequestConsumed}
          onEditingContextChange={setActiveOrderContext}
          onClose={handleCloseCenterPanel}
          active
        />
      );
    }
    return (
      <OrderBundleEditPanel
        patientId={meta.patientId}
        entity={activeOrderEntity}
        title={entityMeta.title}
        bundleLabel={entityMeta.bundleLabel}
        itemQuantityLabel={entityMeta.itemQuantityLabel}
        meta={orderEditorMeta}
        variant="embedded"
        bundlesOverride={activeGroup ? orderBundlesByGroup.get(activeGroup) ?? [] : []}
        request={activeOrderRequest}
        onRequestConsumed={handleDrawerOrderRequestConsumed}
        onEditingContextChange={setActiveOrderContext}
        onClose={handleCloseCenterPanel}
      />
    );
  }, [
    activeCenterPanel,
    activeOrderEntity,
    activeOrderRequest,
    handleCloseCenterPanel,
    handleDrawerOrderRequestConsumed,
    meta.patientId,
    orderBundlesByGroup,
    orderEditorMeta,
  ]);

  return (
    <section
      className="soap-note"
      aria-label="SOAP 記載"
      data-run-id={meta.runId}
      data-view-mode={viewMode}
      data-right-drawer-open={drawerOpen ? 'true' : 'false'}
      data-right-drawer-mode={effectiveMode}
      data-right-drawer-min={effectiveMinimized ? 'true' : 'false'}
      style={soapNoteStyle}
    >
      <header className="soap-note__header">
        <div className="soap-note__header-main">
          <p className="soap-note__eyebrow">Primary Workspace</p>
          <div className="soap-note__title-row">
            <h2>SOAP 記載</h2>
            <div className="soap-note__sync" role="status" aria-live={resolveAriaLive(syncState.error ? 'error' : 'info')}>
              <span
                className={`soap-note__sync-badge${
                  syncState.serverSynced ? ' soap-note__sync-badge--synced' : syncState.localSaved ? ' soap-note__sync-badge--local' : ''
                }${syncState.error ? ' soap-note__sync-badge--error' : ''}`}
                title={syncState.savedAt ? `最終保存: ${formatSoapAuthoredAt(syncState.savedAt)}` : undefined}
              >
                {syncState.isSaving
                  ? '保存中'
                  : syncState.error
                    ? '保存エラー'
                    : syncState.serverSynced
                      ? '保存済'
                      : syncState.localSaved
                        ? 'ローカル下書き保存済 / カルテ未反映'
                        : '未保存'}
              </span>
            </div>
          </div>
          <p className="soap-note__subtitle soap-note__subtitle--meta">{authoredSummary}</p>
          <details className="soap-note__meta-details">
            <summary className="soap-note__subtitle">記載情報</summary>
            <p className="soap-note__subtitle">
              記載者: {resolveAuthorLabel(author)} ／ role: {author.role} ／ 受付ID: {meta.receptionId ?? '—'} ／ 初回:{' '}
              {authoredFirst ? `${formatSoapAuthoredAt(authoredFirst.authoredAt)} / ${resolveEntryActor(authoredFirst)}` : '—'} ／
              最終: {authoredLast ? `${formatSoapAuthoredAt(authoredLast.authoredAt)} / ${resolveEntryActor(authoredLast)}` : '—'}
            </p>
          </details>
        </div>
        <div className="soap-note__actions">
          <button
            type="button"
            onClick={() => setHistoryView((prev) => !prev)}
            className="soap-note__ghost"
            title={historyView ? 'SOAP入力へ戻ります。' : '訂正履歴を表示します（取り消し線で差分を可視化）。'}
          >
            {historyView ? '履歴終了' : '履歴'}
          </button>
          <button
            type="button"
            onClick={cycleViewMode}
            className="soap-note__ghost"
            disabled={historyView}
            title={historyView ? '履歴表示中は変更できません。' : '表示モードを切り替えます（SOAPのみ / FREEのみ / 両方）'}
          >
            表示:{viewModeLabel}
          </button>
          <button
            type="button"
            onClick={handleTemplateDialogOpen}
            className="soap-note__ghost"
            disabled={readOnly || historyView}
            title={
              readOnly
                ? readOnlyReason ?? '読み取り専用のためテンプレ操作できません。'
                : historyView
                  ? '履歴表示中はテンプレ操作できません。'
                  : '共通テンプレダイアログを開きます。'
            }
          >
            テンプレ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={readOnly || historyView || syncState.isSaving}
            className="soap-note__primary"
            title={
              readOnly
                ? readOnlyReason ?? '読み取り専用のため保存できません。'
                : historyView
                  ? '履歴表示中は保存できません。'
                  : undefined
            }
          >
            {syncState.isSaving ? '保存中...' : history.length === 0 ? '保存' : '更新'}
          </button>
          <details className="soap-note__menu">
            <summary className="soap-note__ghost">その他</summary>
            <div className="soap-note__menu-items" role="menu" aria-label="SOAP追加操作">
              {isRevisionHistoryEnabled ? (
                <button
                  type="button"
                  onClick={() => setRevisionDrawerOpen(true)}
                  className="soap-note__ghost"
                  aria-haspopup="dialog"
                  aria-expanded={revisionDrawerOpen}
                >
                  版履歴
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleClear}
                disabled={readOnly || historyView}
                className="soap-note__ghost"
                title={readOnly ? readOnlyReason ?? '読み取り専用のためクリアできません。' : undefined}
              >
                クリア
              </button>
              {onClearHistory ? (
                <button type="button" onClick={handleClearHistory} className="soap-note__ghost" disabled={historyView}>
                  履歴クリア
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </header>
      {isRevisionHistoryEnabled ? (
        <RevisionHistoryDrawer
          open={revisionDrawerOpen}
          onClose={() => setRevisionDrawerOpen(false)}
          meta={{
            patientId: meta.patientId,
            appointmentId: meta.appointmentId,
            receptionId: meta.receptionId,
            visitDate: meta.visitDate,
          }}
          soapHistory={history}
        />
      ) : null}
      <FocusTrapDialog
        open={clearHistoryDialogOpen}
        role="alertdialog"
        title="SOAP履歴をクリアしますか？"
        description="この患者の画面上履歴をクリアします。影響範囲を確認して実行してください。"
        onClose={() => setClearHistoryDialogOpen(false)}
        testId="soap-clear-history-dialog"
      >
        <section className="charts-tab-guard" aria-label="SOAP履歴クリア確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>対象患者ID</dt>
              <dd>{meta.patientId ?? '—'}</dd>
            </div>
            <div>
              <dt>診療日</dt>
              <dd>{meta.visitDate ?? '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>SOAP履歴表示をクリアし、編集入力も初期化します。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="SOAP履歴クリア操作">
            <button type="button" onClick={() => setClearHistoryDialogOpen(false)}>
              キャンセル
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={handleConfirmClearHistory}>
              クリアを実行
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={templateDialogOpen}
        title="テンプレ挿入"
        description="対象セクションとテンプレートを選択して挿入します。"
        onClose={() => setTemplateDialogOpen(false)}
        testId="soap-template-dialog"
      >
        <section className="charts-tab-guard" aria-label="SOAPテンプレ操作">
          <div className="soap-note__template-dialog-fields">
            <label>
              対象セクション
              <select
                value={templateTargetSection}
                onChange={(event) => setTemplateTargetSection(event.target.value as SoapSectionKey)}
                disabled={readOnly}
              >
                {SOAP_SECTIONS.map((section) => (
                  <option key={`template-section-${section}`} value={section}>
                    {SOAP_SECTION_LABELS[section]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              テンプレ
              <select
                value={templateSelection}
                onChange={(event) => setTemplateSelection(event.target.value)}
                disabled={readOnly}
              >
                <option value="">選択してください</option>
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedTemplateOption ? (
            <p className="soap-note__subtitle soap-note__subtitle--meta">選択中: {selectedTemplateOption.label}</p>
          ) : null}
          {pendingTemplate[templateTargetSection] ? (
            <p className="soap-note__subtitle">挿入待ち: {pendingTemplate[templateTargetSection]}</p>
          ) : null}
          <div className="charts-tab-guard__actions soap-note__template-dialog-actions" role="group" aria-label="SOAPテンプレ操作">
            <button type="button" onClick={() => setTemplateDialogOpen(false)}>
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleTemplateDialogApply}
              disabled={readOnly || !templateSelection}
              title={readOnly ? readOnlyReason ?? '読み取り専用のため挿入できません。' : undefined}
            >
              挿入
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      {readOnly ? (
        <p className="soap-note__guard">読み取り専用: {readOnlyReason ?? '編集はロック中です。'}</p>
      ) : null}
      {feedback ? <p className="soap-note__feedback" role="status">{feedback}</p> : null}
      <div className="soap-note__body">
        <div className="soap-note__editor">
          {historyView ? (
            <div className="soap-note__history-mode" aria-label="訂正履歴">
              <p className="soap-note__history-hint">
                訂正履歴を差分表示します（この端末の SOAP 履歴）。編集は「編集へ戻る」で切り替えます。
              </p>
              {historyTimeline.length === 0 ? (
                <p className="soap-note__history-empty" role="status">
                  履歴がありません。
                </p>
              ) : (
                <ol className="soap-note__history-timeline" aria-label="訂正履歴（新しい順）">
                  {historyTimeline.map((step) => (
                    <li key={step.key} className="soap-note__history-step">
                      <div className="soap-note__history-step-head">
                        <strong>{formatSoapAuthoredAt(step.authoredAt)}</strong>
                        <span>{step.actor}</span>
                        <span>{step.actionLabel}</span>
                      </div>
                      {step.diffs.length === 0 ? (
                        <p className="soap-note__history-nochange">差分はありません。</p>
                      ) : (
                        <div className="soap-note__history-diffs">
                          {step.diffs.map((diff) => (
                            <div key={`${step.key}-${diff.section}`} className="soap-note__history-diff" data-section={diff.section}>
                              <div className="soap-note__history-diff-title">{SOAP_SECTION_LABELS[diff.section]}</div>
                              {diff.removed.length > 0 ? (
                                <ul className="soap-note__history-lines soap-note__history-lines--removed" aria-label="削除">
                                  {diff.removed.map((line, idx) => (
                                    <li key={`${step.key}-${diff.section}-rm-${idx}`}>
                                      <del>{line}</del>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              {diff.added.length > 0 ? (
                                <ul className="soap-note__history-lines soap-note__history-lines--added" aria-label="追加">
                                  {diff.added.map((line, idx) => (
                                    <li key={`${step.key}-${diff.section}-add-${idx}`}>
                                      <span className="soap-note__history-added">+ {line}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <>
              <div className="soap-note__grid">
                {visibleSections.map((section) => {
                  const latest = latestBySection.get(section);
                  const templateId = pendingTemplate[section] ?? latest?.templateId ?? null;
                  const templateLabel = resolveSoapTemplateLabel(templateId);
                  const textareaRows = (() => {
                    if (section === 'free') return viewMode === 'free' ? 6 : 4;
                    return viewMode === 'soap' ? 4 : 2;
                  })();
                  const textareaId = `soap-note-${section}`;
                  const supportTextId = `${textareaId}-support`;
                  return (
                    <article key={section} className="soap-note__section" data-section={section}>
                      <div className="soap-note__section-header">
                        <div className="soap-note__section-title-row">
                          <span className="soap-note__section-code" aria-hidden="true">
                            {section === 'free' ? 'F' : resolveSoapCategory(section)}
                          </span>
                          <label htmlFor={textareaId}>{SOAP_SECTION_LABELS[section]}</label>
                        </div>
                        <div className="soap-note__section-meta">
                          {templateLabel ? <span className="soap-note__section-chip">テンプレ: {templateLabel}</span> : null}
                          {latest ? (
                            <span>
                              最終更新: {formatSoapAuthoredAt(latest.authoredAt)} ／ {resolveEntryActor(latest)}
                            </span>
                          ) : (
                            <span>記載履歴なし</span>
                          )}
                        </div>
                      </div>
                      <p id={supportTextId} className="soap-note__section-support">
                        {SOAP_SECTION_SUPPORT_TEXT[section]}
                      </p>
                      <textarea
                        id={textareaId}
                        name={`soapNote-${section}`}
                        value={draft[section]}
                        onChange={(event) => updateDraft(section, event.target.value)}
                        rows={textareaRows}
                        placeholder={`${SOAP_SECTION_LABELS[section]} を記載してください。`}
                        readOnly={readOnly}
                        aria-readonly={readOnly}
                        aria-describedby={supportTextId}
                      />
                      <div className="soap-note__section-actions">
                        {section === 'free' ? (
                          <button
                            type="button"
                            onClick={() => updateDraft('free', '')}
                            className="soap-note__ghost"
                            disabled={readOnly}
                            title={readOnly ? readOnlyReason ?? '読み取り専用のため操作できません。' : 'Free を新規カードとして開始します'}
                          >
                            新規カード
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
              <details
                className="soap-note__subjectives-fold"
                open={subjectivesOpen}
                onToggle={(event) => {
                  setSubjectivesOpen(event.currentTarget.open);
                }}
              >
                <summary className="soap-note__subjectives-summary">症状詳記（院内ローカル）</summary>
                {subjectivesOpen ? (
                  <div className="soap-note__subjectives-content">
                    <SubjectivesPanel
                      patientId={meta.patientId}
                      visitDate={meta.visitDate}
                      runId={meta.runId}
                      readOnly={readOnly}
                      readOnlyReason={readOnlyReason}
                      suggestedText={draft.subjective}
                    />
                  </div>
                ) : null}
              </details>
            </>
          )}
        </div>
        <OrderSummaryPane
          orderBundles={effectiveOrderBundles}
          orderBundlesLoading={resolvedOrderBundlesLoading}
          orderBundlesError={resolvedOrderBundlesError}
          prescriptionBundles={prescriptionBundles}
          onBundleSelect={handleOrderSummaryBundleSelect}
          onBundleDeleteRequest={
            readOnly
              ? undefined
              : (payload) => {
                  setOrderSummaryNotice(null);
                  setOrderSummaryDeleteTarget(payload);
                }
          }
          notice={orderSummaryNotice}
          onDocumentSelect={handleOpenDocumentPanel}
          activeOrderPanel={centerOrderPanel}
          activeOrderTitle={activeOrderEntity ? `${resolveOrderEntityLabel(activeOrderEntity)}入力` : undefined}
          onActiveOrderClose={handleCloseCenterPanel}
          documentPanel={centerDocumentPanel}
          documentPanelVisible={activeCenterPanel === 'document'}
          onDocumentClose={handleCloseCenterPanel}
          orcaPanel={orcaPanel}
        />
        <div className="soap-note__right-dock-area">
          <RightUtilityDock activeTool={activeTool} onSelectTool={handleDockToolSelect} />
        </div>
        <RightUtilityDrawer {...rightUtilityDrawerProps} />
        <FocusTrapDialog
          open={Boolean(orderSummaryDeleteTarget)}
          role="alertdialog"
          title="オーダーを削除しますか？"
          description="対象と影響範囲を確認して実行してください。"
          onClose={closeOrderSummaryDeleteDialog}
          testId="order-summary-delete-dialog"
        >
          <section className="charts-tab-guard" aria-label="オーダー削除確認">
            <dl className="charts-actions__send-confirm-list">
              <div>
                <dt>対象名</dt>
                <dd>{orderSummaryDeleteTarget?.label ?? '—'}</dd>
              </div>
              <div>
                <dt>患者ID</dt>
                <dd>{meta.patientId ?? '—'}</dd>
              </div>
              <div>
                <dt>対象カテゴリ</dt>
                <dd>{orderSummaryDeleteTarget ? resolveOrderEntityLabel(orderSummaryDeleteTarget.entity) : '—'}</dd>
              </div>
              <div>
                <dt>影響範囲</dt>
                <dd>該当オーダー束が一覧から削除されます。</dd>
              </div>
            </dl>
            <div className="charts-tab-guard__actions" role="group" aria-label="オーダー削除操作">
              <button type="button" onClick={closeOrderSummaryDeleteDialog} disabled={orderSummaryDeleteMutation.isPending}>
                キャンセル
              </button>
              <button
                type="button"
                className="charts-tab-guard__danger"
                onClick={() => {
                  if (orderSummaryDeleteTarget) orderSummaryDeleteMutation.mutate(orderSummaryDeleteTarget);
                }}
                disabled={orderSummaryDeleteMutation.isPending}
              >
                削除する
              </button>
            </div>
          </section>
        </FocusTrapDialog>
      </div>
    </section>
  );
}
