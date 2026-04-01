import { Global } from '@emotion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';

import { useNavigationGuard } from '../../../routes/NavigationGuardProvider';
import { useAppNavigation } from '../../../routes/useAppNavigation';
import { AuthServiceControls } from '../AuthServiceControls';
import { applyAuthServicePatch, useAuthService, type AuthServiceFlags } from '../authService';
import { DocumentTimeline } from '../DocumentTimeline';
import { OrcaSummary } from '../OrcaSummary';
import { MedicalOutpatientRecordPanel } from '../MedicalOutpatientRecordPanel';
import { PatientsTab } from '../PatientsTab';
import { TelemetryFunnelPanel } from '../TelemetryFunnelPanel';
import { ChartsActionBar, type ChartsActionBarHandle } from '../ChartsActionBar';
import { ChartsPatientSummaryBar } from '../ChartsPatientSummaryBar';
	import { DiagnosisEditPanel } from '../DiagnosisEditPanel';
	import { DocumentCreatePanel } from '../DocumentCreatePanel';
	import { PastHubPanel } from '../PastHubPanel';
	import { PatientSummaryPanel } from '../PatientSummaryPanel';
import { StampLibraryPanel } from '../StampLibraryPanel';
import { normalizeAuditEventLog, normalizeAuditEventPayload, recordChartsAuditEvent } from '../audit';
import { SoapNotePanel, type SoapOrderDockState } from '../SoapNotePanel';
import { resolveOrderDockCategoryLabel, resolveOrderGroupKeyByEntity } from '../orderCategoryRegistry';
import { DoCopyDialog, type DoCopyDialogState } from '../DoCopyDialog';
import type { SoapDraft, SoapEntry, SoapSectionKey } from '../soapNote';
import { SOAP_SECTION_LABELS, SOAP_SECTIONS } from '../soapNote';
import { chartsStyles } from '../styles';
import { FocusTrapDialog } from '../../../components/modals/FocusTrapDialog';
import { ImageDockedPanel } from '../../images/components';
import { type KarteImageListItem } from '../../images/api';
import type { ChartImageAttachment } from '../documentImageAttach';
import { receptionStyles } from '../../reception/styles';
import { fetchAppointmentOutpatients, fetchClaimFlags, type AppointmentPayload, type ReceptionEntry } from '../../reception/api';
import { fetchPatients, type PatientRecord } from '../../patients/api';
import { getAuditEventLog, logAuditEvent, logUiState, type AuditEventRecord } from '../../../libs/audit/auditLogger';
import { buildUnavailableMedicalSummary, fetchChartsMedicalSummary } from '../api';
import { openChartEncounter } from '../encounterTransitionApi';
import { fetchKarteIdByPatientId, type LetterModulePayload } from '../letterApi';
import { fetchOrderBundlesWithPatientImportRecovery, mutateOrderBundles, type OrderBundle } from '../orderBundleApi';
import { fetchPrescriptionOrderBundlesWithPatientImportRecovery, mutatePrescriptionOrderBundles } from '../prescriptionOrderApi';
import { fetchDiseases, fetchDiseasesWithPatientImportRecovery, mutateDiseases, type DiseaseImportResponse } from '../diseaseApi';
import { useAdminBroadcast } from '../../../libs/admin/useAdminBroadcast';
import { AdminBroadcastBanner } from '../../shared/AdminBroadcastBanner';
import { RunIdBadge } from '../../shared/RunIdBadge';
import { StatusPill } from '../../shared/StatusPill';
import { AuditSummaryInline } from '../../shared/AuditSummaryInline';
import { resolveCacheHitTone, resolveMetaFlagTone, resolveTransitionTone } from '../../shared/metaPillRules';
import { ToneBanner } from '../../reception/components/ToneBanner';
import { upsertReceptionStatusOverride } from '../../reception/receptionDailyState';
import { useSession } from '../../../AppRouter';
import { ensureObservabilityMeta, getObservabilityMeta, resolveAriaLive, resolveRunId } from '../../../libs/observability/observability';
import { buildFacilityPath } from '../../../routes/facilityRoutes';
import { fetchAdminConfig, type ChartsMasterSourcePolicy } from '../../administration/api';
import type { ClaimOutpatientPayload } from '../../outpatient/types';
import { hasStoredAuth } from '../../../libs/http/httpClient';
import { isSystemAdminRole } from '../../../libs/auth/roles';
import { fetchOrcaPushEvents, fetchOrcaQueue } from '../../outpatient/orcaQueueApi';
import { resolveOrcaSendStatus, toClaimQueueEntryFromOrcaQueueEntry } from '../../outpatient/orcaQueueStatus';
import { fetchRpHistory } from '../karteExtrasApi';
import {
  buildChartsEncounterSearch,
  hasEncounterContext,
  hasHandoffEncounterKey,
  loadChartsEncounterContext,
  normalizeEncounterContext,
  normalizeEncounterId,
  normalizeEncounterKey,
  normalizeVisitDate,
  normalizeRunId,
  parseChartsEncounterContext,
  parseChartsNavigationMeta,
  parseReceptionCarryoverParams,
  resolveEncounterPatientIdFromEntry,
  storeChartsEncounterContext,
  type OutpatientEncounterContext,
} from '../encounterContext';
import {
  buildChartsApprovalStorageKey,
  clearChartsApprovalRecord,
  readChartsApprovalRecord,
  writeChartsApprovalRecord,
  type ChartsApprovalRecord,
} from '../approvalState';
import { useChartsTabLock } from '../useChartsTabLock';
import { isNetworkError } from '../../shared/apiError';
import { getAppointmentDataBanner } from '../../outpatient/appointmentDataBanner';
import { resolveOutpatientFlags } from '../../outpatient/flags';
import { buildScopedStorageKey, type StorageScope } from '../../../libs/session/storageScope';
import type { DraftDirtySource } from '../draftSources';
import {
  listChartOrderSets,
  saveChartOrderSet,
  type ChartOrderSetEntry,
  type ChartOrderSetTemplateSnapshot,
} from '../chartOrderSetStorage';
import {
  applyEncounterTabState,
  buildPatientTabKey,
  hasChartsPatientTabHandoffKey,
  readChartsPatientTabsStorage,
  writeChartsPatientTabsStorage,
  type ChartsPatientTab,
  type ChartsPatientTabsStorage,
} from '../patientTabsStorage';
import {
  WORKSPACE_CHARTS_TAB_REQUEST_EVENT,
  dispatchChartsPatientTabsUpdated,
  type WorkspaceChartsTabRequest,
} from '../../workspaceTabs/workspaceTabEvents';

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatLocalDateYmd = (date: Date): string =>
  `${date.getFullYear().toString().padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatAge = (birthDate?: string, baseDate: Date = new Date()): string => {
  const birth = parseDate(birthDate);
  if (!birth) return '—';
  const baseYear = baseDate.getFullYear();
  const baseMonth = baseDate.getMonth();
  const baseDay = baseDate.getDate();
  const birthYear = birth.getFullYear();
  const birthMonth = birth.getMonth();
  const birthDay = birth.getDate();
  let totalMonths = (baseYear - birthYear) * 12 + (baseMonth - birthMonth);
  if (baseDay < birthDay) totalMonths -= 1;
  if (totalMonths < 0) return '—';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months === 0 ? `${years}歳` : `${years}歳${months}ヶ月`;
};

const formatJapaneseEra = (date: Date): string => {
  const eras = [
    { name: '令和', start: new Date(2019, 4, 1) },
    { name: '平成', start: new Date(1989, 0, 8) },
    { name: '昭和', start: new Date(1926, 11, 25) },
    { name: '大正', start: new Date(1912, 6, 30) },
    { name: '明治', start: new Date(1868, 0, 25) },
  ];
  const found = eras.find((era) => date >= era.start);
  if (!found) return '—';
  const year = date.getFullYear() - found.start.getFullYear() + 1;
  const yearLabel = year === 1 ? '元' : String(year);
  return `${found.name}${yearLabel}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const formatBirthDateParts = (value?: string): { iso: string; era: string; display: string } => {
  const date = parseDate(value);
  if (!date) return { iso: '—', era: '—', display: '—' };
  const iso = formatLocalDateYmd(date);
  const era = formatJapaneseEra(date);
  return { iso, era, display: `${iso}（${era}）` };
};

const normalizeDisplayText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const pickLatestOutpatientMeta = (pages: AppointmentPayload[]): AppointmentPayload | undefined => {
  if (pages.length === 0) return undefined;
  const toTimestamp = (value?: string): number => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  let latest = pages[0];
  let latestTimestamp = toTimestamp(latest.fetchedAt);
  for (const page of pages.slice(1)) {
    const parsed = toTimestamp(page.fetchedAt);
    if (parsed >= latestTimestamp) {
      latest = page;
      latestTimestamp = parsed;
    }
  }
  if (latestTimestamp === Number.NEGATIVE_INFINITY) {
    return pages[pages.length - 1];
  }
  return latest;
};

const SOAP_HISTORY_STORAGE_BASE = 'opendolphin:web-client:soap-history';
const SOAP_HISTORY_STORAGE_VERSION = 'v2';
const SOAP_HISTORY_MAX_ENTRIES = 50;
const SOAP_HISTORY_MAX_ENCOUNTERS = 20;
const SOAP_HISTORY_MAX_BYTES = 200_000;
const UTILITY_PATIENT_UNSELECTED_MESSAGE = '患者が未選択のため利用できません';
const UTILITY_PANEL_LAYOUT_STORAGE_BASE = 'opendolphin:web-client:charts:utility-panel-layout';
const UTILITY_PANEL_LAYOUT_STORAGE_VERSION = 'v1';
const UTILITY_PANEL_DEFAULT_OFFSET_X = 24;
const UTILITY_PANEL_DEFAULT_OFFSET_Y = 28;
const UTILITY_PANEL_MIN_WIDTH = 640;
const UTILITY_PANEL_MAX_WIDTH = 1360;
const UTILITY_PANEL_MIN_HEIGHT = 420;
const UTILITY_PANEL_MAX_HEIGHT = 920;
const EMPTY_ORDER_BUNDLES: OrderBundle[] = [];

type UtilityPanelLayout = {
  width: number;
  height: number;
  left: number;
  top: number;
};

type UtilityPanelLayoutStorage = {
  version: 1;
  updatedAt: string;
  layout: UtilityPanelLayout;
};

const PATIENT_TAB_PREFETCH_LIMIT = 2;
const PATIENT_TAB_PREFETCH_MEDICAL_SUMMARY_STALE_MS = 120_000;
const PATIENT_TAB_PREFETCH_KARTE_ID_STALE_MS = 60_000;
const PATIENT_TAB_PREFETCH_DATA_STALE_MS = 30_000;

const resolvePatientTabActivityAt = (tab: ChartsPatientTab): number => {
  const raw = tab.lastActivatedAt ?? tab.openedAt;
  const parsed = raw ? Date.parse(raw) : Number.NEGATIVE_INFINITY;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

const resolveUtilityPanelFallbackStorageKey = () =>
  `${UTILITY_PANEL_LAYOUT_STORAGE_BASE}:${UTILITY_PANEL_LAYOUT_STORAGE_VERSION}`;

const clampUtilityPanelLayout = (layout: UtilityPanelLayout, viewportWidth: number, viewportHeight: number): UtilityPanelLayout => {
  const minWidth = Math.min(UTILITY_PANEL_MIN_WIDTH, Math.max(320, viewportWidth - 24));
  const minHeight = Math.min(UTILITY_PANEL_MIN_HEIGHT, Math.max(420, viewportHeight - 24));
  const dockedMaxWidth = Math.min(
    UTILITY_PANEL_MAX_WIDTH,
    Math.max(minWidth, Math.floor(viewportWidth * 0.78)),
  );
  const maxWidth = Math.max(minWidth, Math.min(viewportWidth - 16, dockedMaxWidth));
  const maxHeight = Math.max(minHeight, Math.min(viewportHeight - 16, UTILITY_PANEL_MAX_HEIGHT));
  const width = Math.min(maxWidth, Math.max(minWidth, Number.isFinite(layout.width) ? layout.width : minWidth));
  const height = Math.min(maxHeight, Math.max(minHeight, Number.isFinite(layout.height) ? layout.height : minHeight));
  const maxLeft = Math.max(8, viewportWidth - width - 8);
  const maxTop = Math.max(8, viewportHeight - height - 8);
  const left = Math.min(maxLeft, Math.max(8, Number.isFinite(layout.left) ? layout.left : UTILITY_PANEL_DEFAULT_OFFSET_X));
  const top = Math.min(maxTop, Math.max(8, Number.isFinite(layout.top) ? layout.top : UTILITY_PANEL_DEFAULT_OFFSET_Y));
  return { width, height, left, top };
};

const buildDefaultUtilityPanelLayout = (viewportWidth: number, viewportHeight: number): UtilityPanelLayout => {
  const preferredWidth = Math.min(1120, Math.max(760, viewportWidth * 0.64));
  const preferredHeight = Math.min(760, Math.max(UTILITY_PANEL_MIN_HEIGHT, viewportHeight * 0.66));
  const preferredLeft = Math.max(UTILITY_PANEL_DEFAULT_OFFSET_X, (viewportWidth - preferredWidth) / 2);
  const preferredTop = Math.max(
    UTILITY_PANEL_DEFAULT_OFFSET_Y,
    viewportHeight - preferredHeight - UTILITY_PANEL_DEFAULT_OFFSET_Y,
  );
  return clampUtilityPanelLayout(
    {
      width: preferredWidth,
      height: preferredHeight,
      left: preferredLeft,
      top: preferredTop,
    },
    viewportWidth,
    viewportHeight,
  );
};

const readUtilityPanelLayoutStorage = (scope?: StorageScope | null): UtilityPanelLayout | null => {
  if (typeof localStorage === 'undefined' || typeof window === 'undefined') return null;
  const scopedKey = buildScopedStorageKey(
    UTILITY_PANEL_LAYOUT_STORAGE_BASE,
    UTILITY_PANEL_LAYOUT_STORAGE_VERSION,
    scope,
  );
  const fallbackKey = resolveUtilityPanelFallbackStorageKey();
  try {
    const raw = scopedKey ? localStorage.getItem(scopedKey) ?? localStorage.getItem(fallbackKey) : localStorage.getItem(fallbackKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UtilityPanelLayoutStorage> | null;
    if (!parsed || parsed.version !== 1 || !parsed.layout) return null;
    return clampUtilityPanelLayout(parsed.layout, window.innerWidth, window.innerHeight);
  } catch {
    return null;
  }
};

const writeUtilityPanelLayoutStorage = (layout: UtilityPanelLayout, scope?: StorageScope | null) => {
  if (typeof localStorage === 'undefined') return;
  const payload: UtilityPanelLayoutStorage = {
    version: 1,
    updatedAt: new Date().toISOString(),
    layout,
  };
  const scopedKey = buildScopedStorageKey(
    UTILITY_PANEL_LAYOUT_STORAGE_BASE,
    UTILITY_PANEL_LAYOUT_STORAGE_VERSION,
    scope,
  );
  const fallbackKey = resolveUtilityPanelFallbackStorageKey();
  try {
    if (scopedKey) {
      localStorage.setItem(scopedKey, JSON.stringify(payload));
      return;
    }
    localStorage.setItem(fallbackKey, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
};

type SoapHistoryStorage = {
  version: 1;
  updatedAt: string;
  encounters: Record<
    string,
    {
      updatedAt: string;
      entries: SoapEntry[];
    }
  >;
};

type DockedUtilityAction = 'order-set' | 'document' | 'imaging';
type UtilityVisualKind = 'stamp' | 'document' | 'imaging' | 'none';
type UtilityOrderSetSubtab = 'set' | 'stamp';
type UtilityCloseGuardState = {
  open: boolean;
  trigger: 'close' | 'switch';
  reason: string;
  nextAction?: DockedUtilityAction;
};
type DocumentUtilityState = {
  dirty: boolean;
  attachmentCount: number;
  isSaving: boolean;
  hasError: boolean;
};
type ImageUtilityState = {
  queueCount: number;
  uploadingCount: number;
  hasError: boolean;
};

const buildInitialOrderDockState = (): SoapOrderDockState => ({
  hasEditing: false,
  targetCategory: null,
  count: 0,
  editingLabel: undefined,
  source: null,
});

const isSameOrderDockState = (left: SoapOrderDockState, right: SoapOrderDockState) =>
  left.hasEditing === right.hasEditing &&
  left.targetCategory === right.targetCategory &&
  left.count === right.count &&
  left.editingLabel === right.editingLabel &&
  left.source === right.source;

const resolveOrderDockTabMeta = (state: SoapOrderDockState): string | null => {
  if (state.hasEditing) {
    const sourceLabel = state.source === 'bottom-floating' ? '下欄' : '右欄';
    const editingLabel = state.editingLabel || resolveOrderDockCategoryLabel(state.targetCategory) || 'オーダー';
    return `${sourceLabel}編集中:${editingLabel}`;
  }
  const count = Number.isFinite(state.count) ? Math.max(0, Math.trunc(state.count)) : 0;
  if (count <= 0) return null;
  const categoryLabel = resolveOrderDockCategoryLabel(state.targetCategory);
  return categoryLabel ? `${categoryLabel}${count}件` : `全${count}件`;
};

const hasOrderDockRequiredIssue = (state: SoapOrderDockState) =>
  Boolean(state.hasEditing && state.editingLabel?.includes('必須不足'));

type EncounterExitAction = 'pause' | 'finish';
type EncounterExitChoice = 'save' | 'discard' | 'cancel';
type EncounterExitGuardState = {
  action: EncounterExitAction;
  patientName: string;
  patientId?: string;
  visitDate?: string;
  receptionId?: string;
  appointmentId?: string;
  dirtySources: string[];
};

type SoapSaveRequestState = {
  token: string;
  reason: 'pause' | 'finish' | 'tab-transition';
};

type SoapSaveRequestResult = {
  token: string;
  ok: boolean;
  message: string;
  serverSynced: boolean;
  localSaved: boolean;
  error?: string | null;
};

type TabGuardChoice = 'save' | 'discard' | 'cancel';
type TabGuardState = {
  action: 'switch' | 'close';
  targetKey?: string;
  targetLabel?: string;
  patientName: string;
  patientId?: string;
  visitDate?: string;
  dirtySources: DraftDirtySource[];
  saveError?: string | null;
  canSave: boolean;
};

const resolveUtilityVisualKind = (action: DockedUtilityAction | null): UtilityVisualKind => {
  if (!action) return 'none';
  if (action === 'order-set') return 'stamp';
  if (action === 'document') return 'document';
  if (action === 'imaging') return 'imaging';
  return 'none';
};

const readSoapHistoryStorage = (scope?: { facilityId?: string; userId?: string }): SoapHistoryStorage | null => {
  if (typeof sessionStorage === 'undefined') return null;
  const scopedKey =
    buildScopedStorageKey(SOAP_HISTORY_STORAGE_BASE, SOAP_HISTORY_STORAGE_VERSION, scope) ??
    `${SOAP_HISTORY_STORAGE_BASE}:v1`;
  try {
    const raw = sessionStorage.getItem(scopedKey) ?? sessionStorage.getItem(`${SOAP_HISTORY_STORAGE_BASE}:v1`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SoapHistoryStorage;
    if (!parsed || parsed.version !== 1 || !parsed.encounters) return null;

    // migrate legacy to scoped
    const scopedKeyActual = buildScopedStorageKey(SOAP_HISTORY_STORAGE_BASE, SOAP_HISTORY_STORAGE_VERSION, scope);
    if (scopedKeyActual && !sessionStorage.getItem(scopedKeyActual)) {
      try {
        sessionStorage.setItem(scopedKeyActual, raw);
        if (scopedKey !== scopedKeyActual) {
          sessionStorage.removeItem(`${SOAP_HISTORY_STORAGE_BASE}:v1`);
        }
      } catch {
        // ignore migration errors
      }
    }
    return parsed;
  } catch {
    return null;
  }
};

const sanitizeSoapHistory = (entries: Record<string, SoapEntry[]>) => {
  const encounterKeys = Object.keys(entries);
  if (encounterKeys.length === 0) return { encounters: {}, removed: [] as string[] };
  const normalized: Record<string, { updatedAt: string; entries: SoapEntry[] }> = {};
  const removed: string[] = [];
  encounterKeys.forEach((key) => {
    const list = entries[key] ?? [];
    if (list.length === 0) return;
    const trimmed = list.slice(-SOAP_HISTORY_MAX_ENTRIES);
    const updatedAt = trimmed[trimmed.length - 1]?.authoredAt ?? new Date().toISOString();
    normalized[key] = { updatedAt, entries: trimmed };
  });
  const sortedKeys = Object.keys(normalized).sort((a, b) => {
    const left = normalized[a]?.updatedAt ?? '';
    const right = normalized[b]?.updatedAt ?? '';
    return left.localeCompare(right);
  });
  while (sortedKeys.length > SOAP_HISTORY_MAX_ENCOUNTERS) {
    const oldest = sortedKeys.shift();
    if (!oldest) break;
    removed.push(oldest);
    delete normalized[oldest];
  }
  return { encounters: normalized, removed };
};

const toDateOnly = (value?: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatLocalDateYmd(parsed);
};

const filterSameDayOrderBundles = (bundles: OrderBundle[], visitDate?: string) => {
  const day = toDateOnly(visitDate);
  if (!day) return bundles;
  return bundles.filter((bundle) => {
    const startedDay = toDateOnly(bundle.started);
    if (!startedDay) return true;
    return startedDay === day;
  });
};
export function ChartsPage() {
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const handleRequestHardReload = useCallback(() => {
    setReloadEpoch((prev) => prev + 1);
  }, []);

  return (
    <>
      {/* NOTE: Global の配列指定だと chartsStyles が注入されないケースがあったため分離する。 */}
      <Global styles={receptionStyles} />
      <Global styles={chartsStyles} />
      <ChartsContent key={reloadEpoch} onRequestHardReload={handleRequestHardReload} />
    </>
  );
}

function ChartsContent({ onRequestHardReload }: { onRequestHardReload: () => void }) {
  const { flags, setCacheHit, setDataSourceTransition, setMissingMaster, setFallbackUsed, bumpRunId } = useAuthService();
  const session = useSession();
  const { registerDirty } = useNavigationGuard();
  const appNav = useAppNavigation({ facilityId: session.facilityId, userId: session.userId });
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const focusRestoreRef = useRef<HTMLElement | null>(null);
  const tabLockReadOnlyRef = useRef(false);
  const isChartsCompactUi = import.meta.env.VITE_CHARTS_COMPACT_UI === '1';
  const isChartsCompactHeader = import.meta.env.VITE_CHARTS_COMPACT_HEADER === '1';
  const isChartsDoCopyEnabled = import.meta.env.VITE_CHARTS_DO_COPY === '1';
  const isChartsUiOptB = import.meta.env.VITE_CHARTS_UI_OPT_B === '1';
  const isPatientImagesMvpEnabled = import.meta.env.VITE_PATIENT_IMAGES_MVP === '1';
  const isBottomOrderHubIntegrationEnabled = import.meta.env.VITE_CHARTS_BOTTOM_ORDER_HUB_INTEGRATION === '1';
  const showBottomUtilityDock = false;
  const stampboxMvpPhaseRaw = Number(import.meta.env.VITE_STAMPBOX_MVP ?? 0);
  const stampboxMvpPhase: 0 | 1 | 2 =
    Number.isFinite(stampboxMvpPhaseRaw) && stampboxMvpPhaseRaw >= 2
      ? 2
      : Number.isFinite(stampboxMvpPhaseRaw) && stampboxMvpPhaseRaw >= 1
        ? 1
        : 0;
  const stampboxMvpEnabled = stampboxMvpPhase > 0;
  const [isTopbarCollapsed, setIsTopbarCollapsed] = useState<boolean>(() => isChartsCompactHeader);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  type ChartsNavigationState = Partial<OutpatientEncounterContext> & { runId?: string };
  const navigationState = (location.state as ChartsNavigationState | null) ?? {};
  const urlMeta = useMemo(() => parseChartsNavigationMeta(location.search), [location.search]);
  const navigationRunId = normalizeRunId(typeof navigationState.runId === 'string' ? navigationState.runId : undefined);
  const explicitRunId = urlMeta.runId ?? navigationRunId;
  const runIdForUrl = explicitRunId ?? flags.runId;
  const chartsBasePath = useMemo(() => buildFacilityPath(session.facilityId, '/charts'), [session.facilityId]);
  const storageScope = useMemo(
    () => ({ facilityId: session.facilityId, userId: session.userId }),
    [session.facilityId, session.userId],
  );

	  type PastOrderEntity =
	    | 'medOrder'
	    | 'generalOrder'
	    | 'injectionOrder'
	    | 'treatmentOrder'
	    | 'surgeryOrder'
	    | 'otherOrder'
	    | 'testOrder'
	    | 'laboTest'
	    | 'physiologyOrder'
	    | 'bacteriaOrder'
	    | 'radiologyOrder'
	    | 'instractionChargeOrder'
	    | 'baseChargeOrder';
  const today = useMemo(() => formatLocalDateYmd(new Date()), []);
  const [encounterContext, setEncounterContext] = useState<OutpatientEncounterContext>(() => {
    const urlContext = parseChartsEncounterContext(location.search);
    if (hasEncounterContext(urlContext)) return normalizeEncounterContext(urlContext);
    const storedTabs = readChartsPatientTabsStorage(storageScope);
    const activeTab =
      (storedTabs?.activeKey
        ? storedTabs.tabs.find((tab) => tab.key === storedTabs.activeKey)
        : undefined) ?? storedTabs?.tabs?.[0];
    if (activeTab) {
      return normalizeEncounterContext({
        patientId: activeTab.patientId,
        appointmentId: activeTab.appointmentId,
        receptionId: activeTab.receptionId,
        scheduleKey: activeTab.scheduleKey,
        encounterKey: activeTab.encounterKey,
        visitDate: normalizeVisitDate(activeTab.visitDate) ?? undefined,
      });
    }
    const stored = loadChartsEncounterContext(storageScope);
    if (hasEncounterContext(stored)) return normalizeEncounterContext(stored);
    return normalizeEncounterContext({
      patientId: typeof navigationState.patientId === 'string' ? navigationState.patientId : undefined,
      appointmentId: typeof navigationState.appointmentId === 'string' ? navigationState.appointmentId : undefined,
      receptionId: typeof navigationState.receptionId === 'string' ? navigationState.receptionId : undefined,
      scheduleKey: typeof navigationState.scheduleKey === 'string' ? navigationState.scheduleKey : undefined,
      encounterKey: typeof navigationState.encounterKey === 'string' ? navigationState.encounterKey : undefined,
      visitDate: normalizeVisitDate(typeof navigationState.visitDate === 'string' ? navigationState.visitDate : undefined),
    });
  });
  const hasEncounterHandoffKey = hasHandoffEncounterKey(encounterContext);
  const medicalSummaryEncounterKey = encounterContext.encounterKey?.trim() ?? '';
  const hasMedicalSummaryEncounterKey = medicalSummaryEncounterKey.length > 0;
  const [patientTabsState, setPatientTabsState] = useState<ChartsPatientTabsStorage>(() => {
    return (
      readChartsPatientTabsStorage(storageScope) ?? {
        version: 1,
        updatedAt: new Date().toISOString(),
        savedAt: new Date().toISOString(),
        activeKey: undefined,
        tabs: [],
      }
    );
  });
  const patientTabs = patientTabsState.tabs;
  const activePatientTabKey = patientTabsState.activeKey ?? null;
  const showPatientTabs = patientTabs.length >= 2;

  useEffect(() => {
    writeChartsPatientTabsStorage(
      {
        ...patientTabsState,
        updatedAt: new Date().toISOString(),
        savedAt: patientTabsState.savedAt,
      },
      storageScope,
    );
    dispatchChartsPatientTabsUpdated();
  }, [patientTabsState, storageScope]);

  useEffect(() => {
    const patientId = normalizeEncounterId(encounterContext.patientId);
    if (!patientId || !hasHandoffEncounterKey(encounterContext)) return;
    const visitDate = normalizeVisitDate(encounterContext.visitDate) ?? today;
    setPatientTabsState((prev) =>
      applyEncounterTabState(prev, {
        patientId,
        visitDate,
        appointmentId: encounterContext.appointmentId,
        receptionId: encounterContext.receptionId,
        scheduleKey: encounterContext.scheduleKey,
        encounterKey: encounterContext.encounterKey,
      }),
    );
  }, [
    encounterContext.appointmentId,
    encounterContext.encounterKey,
    encounterContext.patientId,
    encounterContext.receptionId,
    encounterContext.scheduleKey,
    encounterContext.visitDate,
    today,
  ]);
  const [draftState, setDraftState] = useState<{
    dirty: boolean;
    patientId?: string;
    appointmentId?: string;
    receptionId?: string;
    scheduleKey?: string;
    encounterKey?: string;
    visitDate?: string;
    dirtySources?: DraftDirtySource[];
  }>({ dirty: false, dirtySources: [] });
  const [soapSyncState, setSoapSyncState] = useState<{
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
    savedAt: undefined,
  });
  const chartsActionBarRef = useRef<ChartsActionBarHandle | null>(null);
  const [encounterExitGuard, setEncounterExitGuard] = useState<EncounterExitGuardState | null>(null);
  const encounterExitResolverRef = useRef<((choice: EncounterExitChoice) => void) | null>(null);
  const [soapSaveRequest, setSoapSaveRequest] = useState<SoapSaveRequestState | null>(null);
  const pendingSoapSaveTokenRef = useRef<string | null>(null);
  const soapSaveResolverRef = useRef<((result: SoapSaveRequestResult) => void) | null>(null);

  useEffect(() => {
    registerDirty('charts', draftState.dirty, 'カルテ: 未保存の入力があります');
    return () => registerDirty('charts', false);
  }, [draftState.dirty, registerDirty]);

  useEffect(() => {
    return () => {
      encounterExitResolverRef.current?.('cancel');
      encounterExitResolverRef.current = null;
      if (pendingSoapSaveTokenRef.current) {
        soapSaveResolverRef.current?.({
          token: pendingSoapSaveTokenRef.current,
          ok: false,
          message: '保存要求を完了できませんでした。',
          serverSynced: false,
          localSaved: false,
          error: 'save_request_aborted',
        });
      }
      pendingSoapSaveTokenRef.current = null;
      soapSaveResolverRef.current = null;
    };
  }, []);

  const [soapHistoryByEncounter, setSoapHistoryByEncounter] = useState<Record<string, SoapEntry[]>>(() => {
    const stored = readSoapHistoryStorage(storageScope);
    if (!stored) return {};
    const entries: Record<string, SoapEntry[]> = {};
    Object.entries(stored.encounters).forEach(([key, value]) => {
      entries[key] = value.entries ?? [];
    });
    return entries;
  });
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [lockState, setLockState] = useState<{ locked: boolean; reason?: string }>({ locked: false });
  const [tabGuard, setTabGuard] = useState<TabGuardState | null>(null);
  const suppressUrlContextSyncRef = useRef(false);
  const [reloadGuardOpen, setReloadGuardOpen] = useState(false);
  const isSystemAdmin = isSystemAdminRole(session.role);
  const showDebugUi = import.meta.env.VITE_ENABLE_DEBUG_UI === '1' && isSystemAdmin;
  const showOperationalMeta = showDebugUi;
  const [approvalState, setApprovalState] = useState<{
    status: 'none' | 'approved';
    record?: ChartsApprovalRecord;
  }>({ status: 'none' });
  const approvalLockLogRef = useRef<string | null>(null);
  const approvalUnlockLogRef = useRef<string | null>(null);
  const approvalLocked = approvalState.status === 'approved';
  const approvalReason = approvalLocked ? '署名確定済みのため編集できません。' : undefined;
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [contextAlert, setContextAlert] = useState<{ tone: 'info' | 'warning'; message: string } | null>(null);
  const [editLockAlert, setEditLockAlert] = useState<{
    tone: 'warning';
    message: string;
    ariaLive: 'polite' | 'assertive';
  } | null>(null);
  const [deliveryImpactBanner, setDeliveryImpactBanner] = useState<{ tone: 'info' | 'warning'; message: string } | null>(null);
  const [utilityPanelAction, setUtilityPanelAction] = useState<DockedUtilityAction | null>(null);
  const utilityPanelActionRef = useRef<DockedUtilityAction | null>(null);
  const utilityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const utilityFocusRestoreRef = useRef(false);
  const utilityLastActionRef = useRef<DockedUtilityAction>('order-set');
  const utilityHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [utilityPanelLayout, setUtilityPanelLayout] = useState<UtilityPanelLayout>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 980,
        height: 760,
        left: UTILITY_PANEL_DEFAULT_OFFSET_X,
        top: UTILITY_PANEL_DEFAULT_OFFSET_Y,
      };
    }
    return readUtilityPanelLayoutStorage(storageScope) ?? buildDefaultUtilityPanelLayout(window.innerWidth, window.innerHeight);
  });
  const utilityPanelLayoutRef = useRef<UtilityPanelLayout>(utilityPanelLayout);
  const utilityPanelResizeRef = useRef<
    | null
    | {
        pointerId: number;
        startX: number;
        startY: number;
        startLayout: UtilityPanelLayout;
      }
  >(null);
  const utilityPanelMoveRef = useRef<
    | null
    | {
        pointerId: number;
        startX: number;
        startY: number;
        startLayout: UtilityPanelLayout;
      }
  >(null);
  const [isUtilityPanelDragging, setIsUtilityPanelDragging] = useState(false);
  const [isUtilityPanelResizing, setIsUtilityPanelResizing] = useState(false);
  const [utilityCloseGuard, setUtilityCloseGuard] = useState<UtilityCloseGuardState | null>(null);
  const [orderSetSubtab, setOrderSetSubtab] = useState<UtilityOrderSetSubtab>('set');
  const [documentUtilityState, setDocumentUtilityState] = useState<DocumentUtilityState>({
    dirty: false,
    attachmentCount: 0,
    isSaving: false,
    hasError: false,
  });
  const [orderDockState, setOrderDockState] = useState<SoapOrderDockState>(() => buildInitialOrderDockState());
  const handleOrderDockStateChange = useCallback((next: SoapOrderDockState) => {
    setOrderDockState((prev) => (isSameOrderDockState(prev, next) ? prev : next));
  }, []);
  const [imageUtilityState, setImageUtilityState] = useState<ImageUtilityState>({
    queueCount: 0,
    uploadingCount: 0,
    hasError: false,
  });
  useEffect(() => {
    if (!stampboxMvpEnabled && orderSetSubtab === 'stamp') {
      setOrderSetSubtab('set');
    }
  }, [orderSetSubtab, stampboxMvpEnabled]);
  const [isPatientPanelOpen, setIsPatientPanelOpen] = useState(false);
  const [orderHistoryCopyRequest, setOrderHistoryCopyRequest] = useState<{
    requestId: string;
    entity: PastOrderEntity;
    bundle: OrderBundle;
  } | null>(null);
  const [orderDockOpenRequest, setOrderDockOpenRequest] = useState<{
    requestId: string;
    entity: PastOrderEntity;
  } | null>(null);
  const [documentHistoryCopyRequest, setDocumentHistoryCopyRequest] = useState<{
    requestId: string;
    letterId: number;
  } | null>(null);
  const [documentDockOpenRequest, setDocumentDockOpenRequest] = useState<{
    requestId: string;
    source: 'past-hub';
  } | null>(null);
  const [orderSetEntries, setOrderSetEntries] = useState<ChartOrderSetEntry[]>(() =>
    listChartOrderSets(session.facilityId, session.userId),
  );
  const [selectedOrderSetId, setSelectedOrderSetId] = useState<string>(() =>
    listChartOrderSets(session.facilityId, session.userId)[0]?.id ?? '',
  );
  const [orderSetName, setOrderSetName] = useState('');
  const [orderSetNotice, setOrderSetNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [replaceSoapDraftRequest, setReplaceSoapDraftRequest] = useState<{
    token: string;
    draft: SoapDraft;
    note?: string;
  } | null>(null);
  const [deliveryAppliedMeta, setDeliveryAppliedMeta] = useState<{
    appliedAt: string;
    appliedTo: string;
    role: string;
    runId?: string;
    deliveredAt?: string;
    deliveryId?: string;
    deliveryVersion?: string;
    deliveryEtag?: string;
  } | null>(null);
  const appliedMeta = useRef<Partial<AuthServiceFlags>>({});
  const { broadcast } = useAdminBroadcast({ facilityId: session.facilityId, userId: session.userId });
  const appliedDelivery = useRef<{ key?: string }>({});
  const previousDeliveryFlags = useRef<{
    chartsDisplayEnabled?: boolean;
    chartsSendEnabled?: boolean;
    chartsMasterSource?: ChartsMasterSourcePolicy;
  }>({});
  const lastEditLockAnnouncement = useRef<string | null>(null);
  const lastOrcaQueueSnapshot = useRef<string | null>(null);

  const openEncounterInTabs = useCallback(
    (next: OutpatientEncounterContext, options?: { name?: string; department?: string }) => {
      const normalizedNext = normalizeEncounterContext(next);
      const patientId = normalizedNext.patientId;
      if (!patientId || !hasHandoffEncounterKey(normalizedNext)) return;
      const visitDate = normalizedNext.visitDate ?? today;
      const name = options?.name?.trim() || undefined;
      const department = options?.department?.trim() || undefined;
      suppressUrlContextSyncRef.current = true;

      setPatientTabsState((prev) =>
        applyEncounterTabState(prev, {
          patientId,
          visitDate,
          appointmentId: normalizedNext.appointmentId,
          receptionId: normalizedNext.receptionId,
          scheduleKey: normalizedNext.scheduleKey,
          encounterKey: normalizedNext.encounterKey,
          name,
          department,
        }),
      );

      setEncounterContext(normalizeEncounterContext({
        patientId,
        appointmentId: normalizedNext.appointmentId,
        receptionId: normalizedNext.receptionId,
        scheduleKey: normalizedNext.scheduleKey,
        encounterKey: normalizedNext.encounterKey,
        visitDate,
      }));
      setContextAlert(null);
    },
    [today],
  );

  const forceSelectPatientTab = useCallback(
    (key: string) => {
      const tab = patientTabs.find((tab) => tab.key === key);
      if (!tab) return;
      openEncounterInTabs(
        {
          patientId: tab.patientId,
          appointmentId: tab.appointmentId,
          receptionId: tab.receptionId,
          scheduleKey: tab.scheduleKey,
          encounterKey: tab.encounterKey,
          visitDate: tab.visitDate,
        },
        { name: tab.name, department: tab.department },
      );
    },
    [openEncounterInTabs, patientTabs],
  );

  const forceClosePatientTab = useCallback(
    (key: string) => {
      const idx = patientTabs.findIndex((tab) => tab.key === key);
      if (idx < 0) return;
      const nextTabs = patientTabs.filter((tab) => tab.key !== key);
      const wasActive = activePatientTabKey === key;
      const nextActive =
        wasActive ? nextTabs[idx - 1] ?? nextTabs[idx] ?? null : activePatientTabKey ? nextTabs.find((tab) => tab.key === activePatientTabKey) ?? null : null;

      setPatientTabsState((prev) => ({
        ...prev,
        activeKey: nextActive?.key,
        tabs: nextTabs,
      }));

      if (!wasActive) return;
      if (nextActive) {
        suppressUrlContextSyncRef.current = true;
        setEncounterContext(normalizeEncounterContext({
          patientId: nextActive.patientId,
          appointmentId: nextActive.appointmentId,
          receptionId: nextActive.receptionId,
          scheduleKey: nextActive.scheduleKey,
          encounterKey: nextActive.encounterKey,
          visitDate: nextActive.visitDate,
        }));
        setContextAlert(null);
        return;
      }

      suppressUrlContextSyncRef.current = true;
      setEncounterContext({});
      setContextAlert({ tone: 'info', message: '患者が未選択です。Reception から患者を選択してください。' });
      navigate({ pathname: chartsBasePath, search: '' }, { replace: true });
    },
    [activePatientTabKey, chartsBasePath, navigate, patientTabs],
  );

  const activePatientTab = useMemo(
    () => patientTabs.find((tab) => tab.key === activePatientTabKey) ?? null,
    [activePatientTabKey, patientTabs],
  );
  const hasPendingTabGuard = draftState.dirty || !soapSyncState.serverSynced || soapSyncState.isSaving;
  const canSaveBeforeTabTransition = (draftState.dirtySources ?? []).every((source) => source === 'soap');
  const requestTabGuard = useCallback(
    (action: 'switch' | 'close', targetKey?: string) => {
      const targetTab = targetKey ? patientTabs.find((tab) => tab.key === targetKey) : undefined;
      setTabGuard({
        action,
        targetKey,
        targetLabel: normalizeDisplayText(targetTab?.name) ?? (targetTab?.patientId ? `患者 ID:${targetTab.patientId}` : undefined),
        patientName:
          normalizeDisplayText(activePatientTab?.name) ??
          (encounterContext.patientId ? `患者 ID:${encounterContext.patientId}` : '患者未選択'),
        patientId: encounterContext.patientId,
        visitDate: normalizeVisitDate(encounterContext.visitDate) ?? today,
        dirtySources: draftState.dirtySources ?? [],
        saveError: null,
        canSave: canSaveBeforeTabTransition,
      });
    },
    [
      activePatientTab?.name,
      canSaveBeforeTabTransition,
      draftState.dirtySources,
      encounterContext.patientId,
      encounterContext.visitDate,
      patientTabs,
      today,
    ],
  );

  const requestSelectPatientTab = useCallback(
    (key: string) => {
      if (key === activePatientTabKey) return;
      if (tabLockReadOnlyRef.current) {
        setContextAlert({
          tone: 'warning',
          message: '別タブが編集中のため患者切替をブロックしました。別タブを閉じるか、強制引き継ぎを実行してください。',
        });
        return;
      }
      if (lockState.locked) {
        setContextAlert({
          tone: 'warning',
          message: lockState.reason ?? '処理中のため患者切替をブロックしました。',
        });
        return;
      }
      if (hasPendingTabGuard) {
        requestTabGuard('switch', key);
        return;
      }
      forceSelectPatientTab(key);
    },
    [activePatientTabKey, forceSelectPatientTab, hasPendingTabGuard, lockState.locked, lockState.reason, requestTabGuard],
  );

  const requestClosePatientTab = useCallback(
    (key: string) => {
      const isActive = key === activePatientTabKey;
      if (!isActive) {
        // Closing an inactive tab does not change encounterContext, so allow it even while locked/read-only.
        forceClosePatientTab(key);
        return;
      }
      if (tabLockReadOnlyRef.current) {
        setContextAlert({
          tone: 'warning',
          message: '別タブが編集中のため、この患者タブを閉じられません。別タブを閉じるか、強制引き継ぎを実行してください。',
        });
        return;
      }
      if (lockState.locked) {
        setContextAlert({
          tone: 'warning',
          message: lockState.reason ?? '処理中のためタブを閉じられません。',
        });
        return;
      }
      if (isActive && hasPendingTabGuard) {
        requestTabGuard('close', key);
        return;
      }
      forceClosePatientTab(key);
    },
    [activePatientTabKey, forceClosePatientTab, hasPendingTabGuard, lockState.locked, lockState.reason, requestTabGuard],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleWorkspaceChartsTabRequest = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceChartsTabRequest>).detail;
      if (!detail || (detail.action !== 'select' && detail.action !== 'close')) return;

      const key = detail.key.trim();
      if (!key) return;

      if (detail.action === 'select') {
        requestSelectPatientTab(key);
        return;
      }
      requestClosePatientTab(key);
    };

    window.addEventListener(WORKSPACE_CHARTS_TAB_REQUEST_EVENT, handleWorkspaceChartsTabRequest as EventListener);
    return () => {
      window.removeEventListener(WORKSPACE_CHARTS_TAB_REQUEST_EVENT, handleWorkspaceChartsTabRequest as EventListener);
    };
  }, [requestClosePatientTab, requestSelectPatientTab]);

  const handleTabGuardCancel = useCallback(() => {
    setTabGuard(null);
  }, []);

  const continueTabGuardTransition = useCallback(
    (guard: TabGuardState) => {
      const { action, targetKey } = guard;
      if (!targetKey) return;
      if (action === 'switch') {
        forceSelectPatientTab(targetKey);
        return;
      }
      forceClosePatientTab(targetKey);
    },
    [forceClosePatientTab, forceSelectPatientTab],
  );

  const requestReload = useCallback(() => {
    if (draftState.dirty) {
      setReloadGuardOpen(true);
      return;
    }
    onRequestHardReload();
  }, [draftState.dirty, onRequestHardReload]);

  const handleCancelReloadGuard = useCallback(() => {
    setReloadGuardOpen(false);
  }, []);

  const handleConfirmReloadGuard = useCallback(() => {
    setReloadGuardOpen(false);
    setDraftState((prev) => ({ ...prev, dirty: false, dirtySources: [] }));
    onRequestHardReload();
  }, [onRequestHardReload]);

  useEffect(() => {
    // Feature flag gate: prevent accessing the Images utility via persisted state / URL triggers.
    if (!isPatientImagesMvpEnabled && utilityPanelAction === 'imaging') {
      setUtilityPanelAction(null);
    }
  }, [isPatientImagesMvpEnabled, utilityPanelAction]);

  const urlContext = useMemo(() => parseChartsEncounterContext(location.search), [location.search]);
  const receptionCarryover = useMemo(() => parseReceptionCarryoverParams(location.search), [location.search]);
  const handleOpenReception = useCallback(() => {
    appNav.openReception({ carryover: receptionCarryover, visitDate: encounterContext.visitDate });
  }, [appNav, encounterContext.visitDate, receptionCarryover]);
  const soapEncounterKey = useMemo(
    () =>
      [
        encounterContext.encounterKey ?? 'none',
        encounterContext.scheduleKey ?? 'none',
        encounterContext.patientId ?? 'none',
        encounterContext.appointmentId ?? 'none',
        encounterContext.receptionId ?? 'none',
        encounterContext.visitDate ?? 'none',
      ].join('::'),
    [
      encounterContext.encounterKey,
      encounterContext.appointmentId,
      encounterContext.scheduleKey,
      encounterContext.patientId,
      encounterContext.receptionId,
      encounterContext.visitDate,
    ],
  );
  const soapHistory = useMemo(() => soapHistoryByEncounter[soapEncounterKey] ?? [], [soapEncounterKey, soapHistoryByEncounter]);
  useEffect(() => {
    setSoapSyncState({
      localSaved: false,
      serverSynced: true,
      isSaving: false,
      error: undefined,
      savedAt: undefined,
    });
    setOrderDockState(buildInitialOrderDockState());
  }, [soapEncounterKey]);
  const [soapDraftSnapshot, setSoapDraftSnapshot] = useState<SoapDraft>(() => ({
    free: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  }));
  const [doCopyDialog, setDoCopyDialog] = useState<DoCopyDialogState | null>(null);

  const openDoCopyDialog = useCallback(
    (payload: { section: SoapSectionKey; entry: SoapEntry }) => {
      const section = payload.section;
      const entry = payload.entry;
      const beforeBody = soapDraftSnapshot?.[section] ?? '';
      setDoCopyDialog({
        open: true,
        sections: [
          {
            section,
            source: {
              authoredAt: entry.authoredAt,
              authorRole: entry.authorRole,
              body: entry.body ?? '',
            },
            target: { body: beforeBody },
          },
        ],
        selectedSections: [section],
        sourceLabel: entry.authoredAt?.slice(0, 10),
        applied: false,
      });
    },
    [soapDraftSnapshot],
  );

  const openDoCopyBatchDialog = useCallback(
    (payload: { sections: Array<{ section: SoapSectionKey; entry: SoapEntry }>; sourceDate?: string }) => {
      const sections = payload.sections.map((item) => ({
        section: item.section,
        source: {
          authoredAt: item.entry.authoredAt,
          authorRole: item.entry.authorRole,
          body: item.entry.body ?? '',
        },
        target: {
          body: soapDraftSnapshot?.[item.section] ?? '',
        },
      }));
      if (sections.length === 0) return;
      setDoCopyDialog({
        open: true,
        sections,
        selectedSections: sections
          .filter((item) => item.source.body.trim().length > 0)
          .map((item) => item.section),
        sourceLabel: payload.sourceDate,
        applied: false,
      });
    },
    [soapDraftSnapshot],
  );

  const closeDoCopyDialog = useCallback(() => {
    setDoCopyDialog(null);
  }, []);

  const handleDoCopyApply = useCallback((requestedSections: SoapSectionKey[]) => {
    setDoCopyDialog((prev) => {
      if (!prev) return prev;
      const sections =
        requestedSections.length > 0
          ? requestedSections
          : prev.selectedSections;
      if (sections.length === 0) return prev;
      const sectionSet = new Set(sections);
      const nextDraft: SoapDraft = { ...soapDraftSnapshot };
      prev.sections.forEach((item) => {
        if (!sectionSet.has(item.section)) return;
        nextDraft[item.section] = item.source.body;
      });
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setReplaceSoapDraftRequest({
        token,
        draft: nextDraft,
        note: `${sections.map((section) => SOAP_SECTION_LABELS[section]).join(' / ')} を Do転記しました。`,
      });
      recordChartsAuditEvent({
        action: 'DRAFT_SAVE',
        outcome: 'started',
        subject: 'charts-do-copy',
        patientId: encounterContext.patientId,
        appointmentId: encounterContext.appointmentId,
        note: `do_copy_apply sections=${sections.join(',')}`,
        runId: flags.runId,
        cacheHit: flags.cacheHit,
        missingMaster: flags.missingMaster,
        fallbackUsed: flags.fallbackUsed,
        dataSourceTransition: flags.dataSourceTransition,
        details: {
          operationPhase: 'do',
          doCopy: true,
          sections,
          sourceAuthoredAt: prev.sections[0]?.source.authoredAt,
          sourceAuthorRole: prev.sections[0]?.source.authorRole,
        },
      });
      return { ...prev, applied: true, selectedSections: sections };
    });
  }, [encounterContext.appointmentId, encounterContext.patientId, flags.cacheHit, flags.dataSourceTransition, flags.fallbackUsed, flags.missingMaster, flags.runId, soapDraftSnapshot]);

  const handleDoCopyUndo = useCallback((requestedSections: SoapSectionKey[]) => {
    setDoCopyDialog((prev) => {
      if (!prev) return prev;
      const sections =
        requestedSections.length > 0
          ? requestedSections
          : prev.selectedSections;
      if (sections.length === 0) return prev;
      const sectionSet = new Set(sections);
      const nextDraft: SoapDraft = { ...soapDraftSnapshot };
      prev.sections.forEach((item) => {
        if (!sectionSet.has(item.section)) return;
        nextDraft[item.section] = item.target.body;
      });
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setReplaceSoapDraftRequest({
        token,
        draft: nextDraft,
        note: `${sections.map((section) => SOAP_SECTION_LABELS[section]).join(' / ')} の Do転記を Undo しました。`,
      });
      recordChartsAuditEvent({
        action: 'DRAFT_CANCEL',
        outcome: 'success',
        subject: 'charts-do-copy',
        patientId: encounterContext.patientId,
        appointmentId: encounterContext.appointmentId,
        note: `do_copy_undo sections=${sections.join(',')}`,
        runId: flags.runId,
        cacheHit: flags.cacheHit,
        missingMaster: flags.missingMaster,
        fallbackUsed: flags.fallbackUsed,
        dataSourceTransition: flags.dataSourceTransition,
        details: {
          operationPhase: 'do',
          doCopy: true,
          sections,
        },
      });
      return { ...prev, applied: false, selectedSections: sections };
    });
  }, [encounterContext.appointmentId, encounterContext.patientId, flags.cacheHit, flags.dataSourceTransition, flags.fallbackUsed, flags.missingMaster, flags.runId, soapDraftSnapshot]);
  const appendSoapHistory = useCallback(
    (entries: SoapEntry[]) => {
      setSoapHistoryByEncounter((prev) => ({
        ...prev,
        [soapEncounterKey]: [...(prev[soapEncounterKey] ?? []), ...entries].slice(-SOAP_HISTORY_MAX_ENTRIES),
      }));
    },
    [soapEncounterKey],
  );
  const clearSoapHistory = useCallback(() => {
    setSoapHistoryByEncounter((prev) => {
      const next = { ...prev };
      delete next[soapEncounterKey];
      return next;
    });
    if (typeof sessionStorage !== 'undefined') {
      const stored = readSoapHistoryStorage(storageScope);
      if (stored?.encounters?.[soapEncounterKey]) {
        delete stored.encounters[soapEncounterKey];
        try {
          const scopedKey =
            buildScopedStorageKey(SOAP_HISTORY_STORAGE_BASE, SOAP_HISTORY_STORAGE_VERSION, storageScope) ??
            `${SOAP_HISTORY_STORAGE_BASE}:v1`;
          sessionStorage.setItem(scopedKey, JSON.stringify({ ...stored, updatedAt: new Date().toISOString() }));
        } catch {
          const scopedKey =
            buildScopedStorageKey(SOAP_HISTORY_STORAGE_BASE, SOAP_HISTORY_STORAGE_VERSION, storageScope) ??
            `${SOAP_HISTORY_STORAGE_BASE}:v1`;
          sessionStorage.removeItem(scopedKey);
        }
      }
    }
  }, [soapEncounterKey, storageScope]);

  const [documentImageAttachments, setDocumentImageAttachments] = useState<ChartImageAttachment[]>([]);
  const [pendingSoapAttachment, setPendingSoapAttachment] = useState<{
    attachment: ChartImageAttachment;
    section: SoapSectionKey;
    token: string;
  } | null>(null);
  const [soapAttachmentTarget, setSoapAttachmentTarget] = useState<SoapSectionKey>('free');
  const soapAttachmentOptions = useMemo(
    () => SOAP_SECTIONS.map((section) => ({ value: section, label: SOAP_SECTION_LABELS[section] })),
    [],
  );

  const normalizeAttachment = useCallback((item: KarteImageListItem): ChartImageAttachment => {
    return {
      id: item.id,
      title: item.title,
      fileName: item.fileName,
      contentType: item.contentType,
      contentSize: item.contentSize,
      recordedAt: item.recordedAt,
    };
  }, []);

  const toggleDocumentAttachment = useCallback(
    (item: KarteImageListItem) => {
      const normalized = normalizeAttachment(item);
      setDocumentImageAttachments((prev) => {
        const exists = prev.some((attachment) => attachment.id === normalized.id);
        if (exists) {
          return prev.filter((attachment) => attachment.id !== normalized.id);
        }
        return [...prev, normalized];
      });
    },
    [normalizeAttachment],
  );

  const clearDocumentAttachments = useCallback(() => {
    setDocumentImageAttachments([]);
  }, []);

  const insertSoapAttachment = useCallback(
    (item: KarteImageListItem) => {
      const normalized = normalizeAttachment(item);
      setPendingSoapAttachment({
        attachment: normalized,
        section: soapAttachmentTarget,
        token: `${normalized.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    },
    [normalizeAttachment, soapAttachmentTarget],
  );

  useEffect(() => {
    setDocumentImageAttachments([]);
    setPendingSoapAttachment(null);
    setSoapAttachmentTarget('free');
  }, [encounterContext.patientId]);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const sanitized = sanitizeSoapHistory(soapHistoryByEncounter);
    if (sanitized.removed.length > 0) {
      setSoapHistoryByEncounter((prev) => {
        const next: Record<string, SoapEntry[]> = { ...prev };
        sanitized.removed.forEach((key) => {
          delete next[key];
        });
        return next;
      });
      setContextAlert({
        tone: 'warning',
        message: 'SOAP履歴が上限を超えたため、古い履歴を削除しました。',
      });
    }
    const payload: SoapHistoryStorage = {
      version: 1,
      updatedAt: new Date().toISOString(),
      encounters: sanitized.encounters,
    };
    try {
      const serialized = JSON.stringify(payload);
      if (serialized.length > SOAP_HISTORY_MAX_BYTES) {
        const scopedKey =
          buildScopedStorageKey(SOAP_HISTORY_STORAGE_BASE, SOAP_HISTORY_STORAGE_VERSION, storageScope) ??
          `${SOAP_HISTORY_STORAGE_BASE}:v1`;
        sessionStorage.removeItem(scopedKey);
        setContextAlert({
          tone: 'warning',
          message: 'SOAP履歴が容量上限を超えたため、セッション保存をクリアしました。',
        });
        return;
      }
      const scopedKey =
        buildScopedStorageKey(SOAP_HISTORY_STORAGE_BASE, SOAP_HISTORY_STORAGE_VERSION, storageScope) ??
        `${SOAP_HISTORY_STORAGE_BASE}:v1`;
      sessionStorage.setItem(scopedKey, serialized);
    } catch {
      const scopedKey =
        buildScopedStorageKey(SOAP_HISTORY_STORAGE_BASE, SOAP_HISTORY_STORAGE_VERSION, storageScope) ??
        `${SOAP_HISTORY_STORAGE_BASE}:v1`;
      sessionStorage.removeItem(scopedKey);
      setContextAlert({
        tone: 'warning',
        message: 'SOAP履歴の保存に失敗したため、セッション保存をクリアしました。',
      });
    }
  }, [soapHistoryByEncounter, setContextAlert, storageScope]);

  const sameEncounterContext = useCallback((left: OutpatientEncounterContext, right: OutpatientEncounterContext) => {
    const leftNormalized = normalizeEncounterContext(left);
    const rightNormalized = normalizeEncounterContext(right);
    return (
      (leftNormalized.scheduleKey ?? '') === (rightNormalized.scheduleKey ?? '') &&
      (leftNormalized.encounterKey ?? '') === (rightNormalized.encounterKey ?? '') &&
      (leftNormalized.patientId ?? '') === (rightNormalized.patientId ?? '') &&
      (leftNormalized.appointmentId ?? '') === (rightNormalized.appointmentId ?? '') &&
      (leftNormalized.receptionId ?? '') === (rightNormalized.receptionId ?? '') &&
      (normalizeVisitDate(leftNormalized.visitDate) ?? '') === (normalizeVisitDate(rightNormalized.visitDate) ?? '')
    );
  }, []);

  useEffect(() => {
    if (!explicitRunId) return;
    if (draftState.dirty || lockState.locked || tabLockReadOnlyRef.current) return;
    if (explicitRunId === flags.runId) return;
    bumpRunId(explicitRunId);
  }, [bumpRunId, draftState.dirty, explicitRunId, flags.runId, lockState.locked]);

  useEffect(() => {
    if (suppressUrlContextSyncRef.current) {
      const urlHasContext = hasEncounterContext(urlContext);
      const encounterHasContext = hasEncounterContext(encounterContext);
      if (urlHasContext !== encounterHasContext) return;
      if (urlHasContext && !sameEncounterContext(urlContext, encounterContext)) return;
      suppressUrlContextSyncRef.current = false;
    }
    if (!hasEncounterContext(urlContext)) return;
    if (sameEncounterContext(urlContext, encounterContext)) return;
    if (draftState.dirty || lockState.locked || tabLockReadOnlyRef.current) {
      setContextAlert({
        tone: 'warning',
        message: '未保存ドラフトまたは処理中のため、URL からの患者切替をブロックしました（別患者混入防止）。',
      });
      const blockedReasons = [
        ...(draftState.dirty ? ['draft_dirty'] : []),
        ...(lockState.locked ? ['ui_locked'] : []),
        ...(tabLockReadOnlyRef.current ? ['tab_read_only'] : []),
      ];
      recordChartsAuditEvent({
        action: 'CHARTS_PATIENT_SWITCH',
        outcome: 'blocked',
        subject: 'charts-url',
        patientId: encounterContext.patientId,
        appointmentId: encounterContext.appointmentId,
        note: `url_context_switch_blocked targetPatientId=${urlContext.patientId ?? '—'} targetAppointmentId=${urlContext.appointmentId ?? '—'}`,
        runId: flags.runId,
        cacheHit: flags.cacheHit,
        missingMaster: flags.missingMaster,
        fallbackUsed: flags.fallbackUsed,
        dataSourceTransition: flags.dataSourceTransition,
        details: {
          operationPhase: 'lock',
          trigger: 'url',
          blockedReasons,
          ...(urlContext.patientId ? {} : encounterContext.patientId ? { fallbackPatientId: encounterContext.patientId } : {}),
          ...(urlContext.appointmentId
            ? {}
            : encounterContext.appointmentId
              ? { fallbackAppointmentId: encounterContext.appointmentId }
              : {}),
        },
      });
      logUiState({
        action: 'navigate',
        screen: 'charts',
        controlId: 'patient-switch-url-blocked',
        runId: flags.runId,
        cacheHit: flags.cacheHit,
        missingMaster: flags.missingMaster,
        dataSourceTransition: flags.dataSourceTransition,
        fallbackUsed: flags.fallbackUsed,
        patientId: encounterContext.patientId,
        appointmentId: encounterContext.appointmentId,
        details: {
          operationPhase: 'lock',
          trigger: 'url',
          blocked: true,
          blockedReasons,
          targetPatientId: urlContext.patientId ?? '—',
          targetAppointmentId: urlContext.appointmentId ?? '—',
        },
      });
      const currentSearch = buildChartsEncounterSearch(encounterContext, receptionCarryover, { runId: flags.runId });
      if (location.search !== currentSearch) {
        navigate({ pathname: chartsBasePath, search: currentSearch }, { replace: true });
      }
      return;
    }
    setEncounterContext(normalizeEncounterContext(urlContext));
    setContextAlert({
      tone: 'info',
      message: 'URL の外来コンテキストに合わせて表示を更新しました（戻る/進む操作）。',
    });
    recordChartsAuditEvent({
      action: 'CHARTS_PATIENT_SWITCH',
      outcome: 'success',
      subject: 'charts-url',
      patientId: urlContext.patientId,
      appointmentId: urlContext.appointmentId,
      note: `url_context_switch targetPatientId=${urlContext.patientId ?? '—'} targetAppointmentId=${urlContext.appointmentId ?? '—'}`,
      runId: flags.runId,
      cacheHit: flags.cacheHit,
      missingMaster: flags.missingMaster,
      fallbackUsed: flags.fallbackUsed,
      dataSourceTransition: flags.dataSourceTransition,
      details: {
        operationPhase: 'do',
        trigger: 'url',
        ...(urlContext.patientId ? {} : encounterContext.patientId ? { fallbackPatientId: encounterContext.patientId } : {}),
        ...(urlContext.appointmentId
          ? {}
          : encounterContext.appointmentId
            ? { fallbackAppointmentId: encounterContext.appointmentId }
            : {}),
      },
    });
    logUiState({
      action: 'navigate',
      screen: 'charts',
      controlId: 'patient-switch-url',
      runId: flags.runId,
      cacheHit: flags.cacheHit,
      missingMaster: flags.missingMaster,
      dataSourceTransition: flags.dataSourceTransition,
      fallbackUsed: flags.fallbackUsed,
      patientId: urlContext.patientId,
      appointmentId: urlContext.appointmentId,
      details: {
        operationPhase: 'do',
        trigger: 'url',
      },
    });
  }, [
    chartsBasePath,
    draftState.dirty,
    encounterContext,
    flags.runId,
    location.search,
    lockState.locked,
    navigate,
    sameEncounterContext,
    urlContext,
  ]);

  useEffect(() => {
    if (!hasEncounterContext(encounterContext)) {
      if (!hasEncounterContext(urlContext)) {
        suppressUrlContextSyncRef.current = false;
      }
      return;
    }
    storeChartsEncounterContext(encounterContext, storageScope);
    const nextSearch = buildChartsEncounterSearch(encounterContext, receptionCarryover, { runId: runIdForUrl });
    if (location.search === nextSearch) {
      suppressUrlContextSyncRef.current = false;
      return;
    }
    navigate({ pathname: chartsBasePath, search: nextSearch }, { replace: true });
  }, [chartsBasePath, encounterContext, location.search, navigate, receptionCarryover, runIdForUrl, storageScope, urlContext]);

  const adminQueryKey = ['admin-config'];
  const adminConfigQuery = useQuery({
    queryKey: adminQueryKey,
    queryFn: fetchAdminConfig,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  useEffect(() => {
    if (!broadcast?.updatedAt) return;
    void adminConfigQuery.refetch();
  }, [adminConfigQuery, broadcast?.updatedAt]);

  const chartsMasterSourcePolicy: ChartsMasterSourcePolicy =
    (adminConfigQuery.data?.chartsMasterSource as ChartsMasterSourcePolicy | undefined) ??
    (broadcast?.chartsMasterSource as ChartsMasterSourcePolicy | undefined) ??
    'auto';
  const chartsDisplayEnabled =
    (adminConfigQuery.data?.chartsDisplayEnabled ?? broadcast?.chartsDisplayEnabled) ?? true;
  const chartsSendEnabled =
    (adminConfigQuery.data?.chartsSendEnabled ?? broadcast?.chartsSendEnabled) ?? true;

  const resolvePreferredSourceOverride = (policy: ChartsMasterSourcePolicy) => {
    if (policy === 'server') return 'server' as const;
    if (policy === 'mock') return 'mock' as const;
    if (policy === 'fallback') return 'mock' as const;
    if (policy === 'snapshot') return 'snapshot' as const;
    return undefined;
  };
  const preferredSourceOverride = resolvePreferredSourceOverride(chartsMasterSourcePolicy);
  const forceFallbackUsed = chartsMasterSourcePolicy === 'fallback';
  const sendAllowedByDelivery = chartsSendEnabled && (chartsMasterSourcePolicy === 'auto' || chartsMasterSourcePolicy === 'server');
  const sendDisabledReason = !chartsSendEnabled
    ? '管理配信で ORCA送信 が disabled になっています。'
    : chartsMasterSourcePolicy === 'fallback'
      ? '管理配信で masterSource=fallback が指定されているため ORCA送信 を停止しています。'
      : chartsMasterSourcePolicy === 'mock'
        ? '管理配信で masterSource=mock が指定されているため ORCA送信 を停止しています。'
        : undefined;

  useEffect(() => {
    const data = adminConfigQuery.data;
    if (!data) return;
    const key = JSON.stringify({
      deliveryId: data.deliveryId,
      deliveryVersion: data.deliveryVersion,
      deliveryEtag: data.deliveryEtag,
      deliveredAt: data.deliveredAt,
      runId: data.runId,
      chartsDisplayEnabled: data.chartsDisplayEnabled,
      chartsSendEnabled: data.chartsSendEnabled,
      chartsMasterSource: data.chartsMasterSource,
    });
    if (appliedDelivery.current.key === key) return;
    appliedDelivery.current.key = key;

    const appliedAt = new Date().toISOString();
    const appliedTo = `${session.facilityId}:${session.userId}`;
    const resolvedDeliveryMode = data.deliveryMode;
    const resolvedEnvironment = data.environment;
    setDeliveryAppliedMeta({
      appliedAt,
      appliedTo,
      role: session.role,
      runId: data.runId ?? flags.runId,
      deliveredAt: data.deliveredAt,
      deliveryId: data.deliveryId,
      deliveryVersion: data.deliveryVersion,
      deliveryEtag: data.deliveryEtag ?? data.deliveryVersion,
    });
    logAuditEvent({
      runId: data.runId ?? flags.runId,
      source: 'admin/config',
      note: 'admin delivery applied',
      payload: {
        operation: 'apply',
        appliedAt,
        appliedTo,
        role: session.role,
        environment: resolvedEnvironment,
        delivery: {
          deliveryId: data.deliveryId,
          deliveryVersion: data.deliveryVersion,
          deliveryEtag: data.deliveryEtag ?? data.deliveryVersion,
          deliveredAt: data.deliveredAt,
          deliveryMode: resolvedDeliveryMode,
        },
        flags: {
          chartsDisplayEnabled: data.chartsDisplayEnabled,
          chartsSendEnabled: data.chartsSendEnabled,
          chartsMasterSource: data.chartsMasterSource,
        },
      },
    });

    const prevSource = previousDeliveryFlags.current.chartsMasterSource ?? 'auto';
    const prevSend = previousDeliveryFlags.current.chartsSendEnabled;
    const prevDisplay = previousDeliveryFlags.current.chartsDisplayEnabled;

    const nextSource = (data.chartsMasterSource ?? chartsMasterSourcePolicy) as ChartsMasterSourcePolicy;
    const nextSend = data.chartsSendEnabled ?? chartsSendEnabled;
    const nextDisplay = data.chartsDisplayEnabled ?? chartsDisplayEnabled;
    const isFirstApply = previousDeliveryFlags.current.chartsMasterSource === undefined;
    previousDeliveryFlags.current = {
      chartsMasterSource: nextSource,
      chartsSendEnabled: nextSend,
      chartsDisplayEnabled: nextDisplay,
    };

    if (isFirstApply && (nextSource === 'fallback' || nextSource === 'mock')) {
      setDeliveryImpactBanner({
        tone: 'warning',
        message: `Charts masterSource=${nextSource} で起動しています（送信は停止扱い）。`,
      });
      return;
    }
    if (isFirstApply && nextSend === false) {
      setDeliveryImpactBanner({
        tone: 'warning',
        message: 'Charts の ORCA送信 は管理配信で disabled の状態です。',
      });
      return;
    }
    if (isFirstApply && nextDisplay === false) {
      setDeliveryImpactBanner({
        tone: 'warning',
        message: 'Charts の表示は管理配信で disabled の状態です。',
      });
      return;
    }
    if (prevSource !== nextSource) {
      const impact =
        nextSource === 'fallback'
          ? '（送信停止・フォールバック扱い）'
          : nextSource === 'mock'
            ? '（送信停止・モック優先）'
            : '';
      setDeliveryImpactBanner({
        tone: nextSource === 'fallback' ? 'warning' : nextSource === 'mock' ? 'warning' : 'info',
        message: `Charts masterSource が ${prevSource} → ${nextSource} に更新されました${impact}`,
      });
      return;
    }
    if (prevSend !== undefined && prevSend !== nextSend && nextSend === false) {
      setDeliveryImpactBanner({
        tone: 'warning',
        message: 'Charts の ORCA送信 が管理配信で無効化されました。',
      });
      return;
    }
    if (prevDisplay !== undefined && prevDisplay !== nextDisplay && nextDisplay === false) {
      setDeliveryImpactBanner({
        tone: 'warning',
        message: 'Charts の表示が管理配信で無効化されました。',
      });
      return;
    }
    setDeliveryImpactBanner(null);
  }, [
    adminConfigQuery.data,
    chartsDisplayEnabled,
    chartsMasterSourcePolicy,
    chartsSendEnabled,
    flags.runId,
    session.facilityId,
    session.role,
    session.userId,
  ]);

  const claimQueryKey = ['charts-claim-flags', chartsMasterSourcePolicy];
  const claimQuery = useQuery({
    queryKey: claimQueryKey,
    queryFn: (context) => fetchClaimFlags(context, { screen: 'charts', preferredSourceOverride }),
    enabled: hasEncounterHandoffKey,
    refetchInterval: 120_000,
    staleTime: 120_000,
    meta: {
      servedFromCache: !!queryClient.getQueryState(claimQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(claimQueryKey)?.fetchFailureCount ?? 0,
    },
  });

  const orcaQueueQueryKey = ['orca-queue', isSystemAdmin ? 'system-admin' : 'non-admin'] as const;
  const orcaQueueQuery = useQuery({
    queryKey: orcaQueueQueryKey,
    queryFn: () => fetchOrcaQueue(undefined, { enabled: isSystemAdmin }),
    enabled: isSystemAdmin && hasEncounterHandoffKey,
    refetchInterval: isSystemAdmin ? 30_000 : false,
    staleTime: isSystemAdmin ? 30_000 : Infinity,
    retry: 1,
    meta: {
      servedFromCache: !!queryClient.getQueryState(orcaQueueQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(orcaQueueQueryKey)?.fetchFailureCount ?? 0,
    },
  });

  const orcaPushEventQueryKey = ['orca-push-events'];
  const orcaPushEventQuery = useQuery({
    queryKey: orcaPushEventQueryKey,
    queryFn: () => fetchOrcaPushEvents(),
    enabled: hasEncounterHandoffKey,
    refetchInterval: 30_000,
    staleTime: 30_000,
    retry: 1,
    meta: {
      servedFromCache: !!queryClient.getQueryState(orcaPushEventQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(orcaPushEventQueryKey)?.fetchFailureCount ?? 0,
    },
  });

  const appointmentQueryKey = ['charts-appointments', today, chartsMasterSourcePolicy];
  const appointmentQuery = useInfiniteQuery({
    queryKey: appointmentQueryKey,
    queryFn: ({ pageParam = 1, ...context }) =>
      fetchAppointmentOutpatients(
        { date: today, page: pageParam, size: 50 },
        context,
        { preferredSourceOverride, screen: 'charts' },
      ),
    enabled: hasEncounterHandoffKey,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasNextPage === false) return undefined;
      if (lastPage.hasNextPage === true) return (lastPage.page ?? allPages.length) + 1;
      const size = lastPage.size ?? 50;
      if (lastPage.recordsReturned !== undefined && lastPage.recordsReturned < size) return undefined;
      return (lastPage.page ?? allPages.length) + 1;
    },
    initialPageParam: 1,
    refetchOnWindowFocus: false,
    meta: {
      servedFromCache: !!queryClient.getQueryState(appointmentQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(appointmentQueryKey)?.fetchFailureCount ?? 0,
    },
  });

  const medicalSummaryQueryKey = ['charts-medical-summary', medicalSummaryEncounterKey || 'missing', chartsMasterSourcePolicy];
  const medicalSummaryQuery = useQuery({
    queryKey: medicalSummaryQueryKey,
    queryFn: (context) =>
      fetchChartsMedicalSummary(context, {
        encounterKey: medicalSummaryEncounterKey,
        preferredSourceOverride,
      }),
    enabled: hasMedicalSummaryEncounterKey,
    refetchInterval: 120_000,
    staleTime: 120_000,
    meta: {
      servedFromCache: !!queryClient.getQueryState(medicalSummaryQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(medicalSummaryQueryKey)?.fetchFailureCount ?? 0,
    },
  });
  const medicalSummaryPanelSummary = useMemo(
    () =>
      medicalSummaryQuery.data ??
      buildUnavailableMedicalSummary(undefined, {
        encounterKey: hasMedicalSummaryEncounterKey ? medicalSummaryEncounterKey : undefined,
        preferredSourceOverride,
      }),
    [hasMedicalSummaryEncounterKey, medicalSummaryEncounterKey, medicalSummaryQuery.data, preferredSourceOverride],
  );

  const appointmentMeta = useMemo(() => {
    const pages = appointmentQuery.data?.pages ?? [];
    return pickLatestOutpatientMeta(pages as AppointmentPayload[]);
  }, [appointmentQuery.data?.pages]);

  const lastMasterSourcePolicy = useRef<ChartsMasterSourcePolicy | null>(null);
  useEffect(() => {
    const previous = lastMasterSourcePolicy.current;
    if (previous && previous !== chartsMasterSourcePolicy) {
      queryClient.invalidateQueries({ queryKey: ['charts-claim-flags'] });
      queryClient.invalidateQueries({ queryKey: ['charts-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['charts-medical-summary'] });
    }
    lastMasterSourcePolicy.current = chartsMasterSourcePolicy;
  }, [chartsMasterSourcePolicy, queryClient]);

  const mergedFlags = useMemo(() => {
    const resolvedFlags = resolveOutpatientFlags(claimQuery.data, medicalSummaryQuery.data, appointmentMeta, flags);
    const runId = resolvedFlags.runId ?? flags.runId;
    const cacheHit = resolvedFlags.cacheHit ?? flags.cacheHit;
    const missingMaster = resolvedFlags.missingMaster ?? flags.missingMaster;
    const dataSourceTransition = resolvedFlags.dataSourceTransition ?? flags.dataSourceTransition;
    const fallbackUsed = resolvedFlags.fallbackUsed ?? flags.fallbackUsed;
    const auditMeta = { runId, cacheHit, missingMaster, dataSourceTransition, fallbackUsed };
    const auditEvent = normalizeAuditEventPayload(
      claimQuery.data?.auditEvent as Record<string, unknown> | undefined,
      auditMeta,
    );
    return { ...resolvedFlags, ...auditMeta, auditEvent };
  }, [
    appointmentMeta,
    claimQuery.data?.auditEvent,
    claimQuery.data?.cacheHit,
    claimQuery.data?.dataSourceTransition,
    claimQuery.data?.missingMaster,
    claimQuery.data?.runId,
    claimQuery.data?.fallbackUsed,
    flags.cacheHit,
    flags.dataSourceTransition,
    flags.fallbackUsed,
    flags.missingMaster,
    flags.runId,
    medicalSummaryQuery.data?.cacheHit,
    medicalSummaryQuery.data?.dataSourceTransition,
    medicalSummaryQuery.data?.missingMaster,
    medicalSummaryQuery.data?.runId,
    medicalSummaryQuery.data?.fallbackUsed,
  ]);

  const resolvedRunId = resolveRunId(mergedFlags.runId ?? flags.runId);
  const resolvedTraceId = useMemo(() => ensureObservabilityMeta().traceId, []);
  const infoLive = resolveAriaLive('info');
  const resolvedCacheHit = mergedFlags.cacheHit ?? flags.cacheHit;
  const resolvedMissingMaster = mergedFlags.missingMaster ?? flags.missingMaster;
  const resolvedTransition = mergedFlags.dataSourceTransition ?? flags.dataSourceTransition;
  const resolvedFallbackUsed = (mergedFlags.fallbackUsed ?? flags.fallbackUsed ?? false) || forceFallbackUsed;
  const soapNoteMeta = useMemo(
    () => ({
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit ?? false,
      missingMaster: resolvedMissingMaster ?? false,
      fallbackUsed: resolvedFallbackUsed ?? false,
      dataSourceTransition: resolvedTransition ?? 'snapshot',
      patientId: encounterContext.patientId,
      appointmentId: encounterContext.appointmentId,
      receptionId: encounterContext.receptionId,
      visitDate: encounterContext.visitDate,
    }),
    [
      encounterContext.appointmentId,
      encounterContext.patientId,
      encounterContext.receptionId,
      encounterContext.visitDate,
      flags.runId,
      resolvedCacheHit,
      resolvedFallbackUsed,
      resolvedMissingMaster,
      resolvedRunId,
      resolvedTransition,
    ],
  );
  const soapNoteAuthor = useMemo(
    () => ({
      role: session.role,
      displayName: session.displayName ?? session.commonName,
      userId: session.userId,
    }),
    [session.commonName, session.displayName, session.role, session.userId],
  );

  const selectedQueueEntry = useMemo(() => {
    const entries = (claimQuery.data as ClaimOutpatientPayload | undefined)?.queueEntries ?? [];
    if (!encounterContext.patientId) return entries[0];
    return entries.find((entry) => entry.patientId === encounterContext.patientId) ?? entries[0];
  }, [claimQuery.data, encounterContext.patientId]);

  const selectedOrcaQueueEntry = useMemo(() => {
    const patientId = encounterContext.patientId;
    if (!patientId) return undefined;
    const entries = orcaQueueQuery.data?.queue ?? [];
    return entries.find((entry) => entry.patientId === patientId);
  }, [encounterContext.patientId, orcaQueueQuery.data?.queue]);

  const selectedOrcaSendStatus = useMemo(() => resolveOrcaSendStatus(selectedOrcaQueueEntry), [selectedOrcaQueueEntry]);

  const orcaQueueCounts = useMemo(() => {
    const queue = orcaQueueQuery.data?.queue ?? [];
    const counts = { waiting: 0, processing: 0, success: 0, failure: 0, unknown: 0, stalled: 0 };
    for (const entry of queue) {
      const status = resolveOrcaSendStatus(entry);
      if (!status) {
        counts.unknown += 1;
        continue;
      }
      counts[status.key] += 1;
      if (status.isStalled) counts.stalled += 1;
    }
    return counts;
  }, [orcaQueueQuery.data?.queue]);

  const actionBarQueueEntry = useMemo(() => {
    if (!selectedOrcaQueueEntry) return selectedQueueEntry;
    const mapped = toClaimQueueEntryFromOrcaQueueEntry(selectedOrcaQueueEntry);
    if (!selectedQueueEntry) return mapped;
    return {
      ...selectedQueueEntry,
      phase: mapped.phase,
      errorMessage: mapped.errorMessage ?? selectedQueueEntry.errorMessage,
      patientId: selectedQueueEntry.patientId ?? mapped.patientId,
    };
  }, [selectedOrcaQueueEntry, selectedQueueEntry]);

  useEffect(() => {
    if (!orcaQueueQuery.data) return;
    const meta = getObservabilityMeta();
    const snapshot = JSON.stringify({
      patientId: encounterContext.patientId ?? null,
      queueRunId: orcaQueueQuery.data.runId ?? null,
      traceId: meta.traceId ?? null,
      selected: selectedOrcaSendStatus
        ? {
            key: selectedOrcaSendStatus.key,
            isStalled: selectedOrcaSendStatus.isStalled,
            lastDispatchAt: selectedOrcaSendStatus.lastDispatchAt ?? null,
            error: selectedOrcaSendStatus.error ?? null,
          }
        : null,
      counts: orcaQueueCounts,
    });
    if (lastOrcaQueueSnapshot.current === snapshot) return;
    lastOrcaQueueSnapshot.current = snapshot;

    logUiState({
      action: 'outpatient_fetch',
      screen: 'charts/orca-queue',
      runId: orcaQueueQuery.data.runId ?? resolvedRunId ?? flags.runId,
      missingMaster: resolvedMissingMaster,
      dataSourceTransition: resolvedTransition,
      fallbackUsed: resolvedFallbackUsed,
      patientId: encounterContext.patientId ?? undefined,
      details: {
        endpoint: 'orca-queue-public-route',
        fetchedAt: orcaQueueQuery.data.fetchedAt,
        queueSource: orcaQueueQuery.data.source,
        queueEntries: orcaQueueQuery.data.queue?.length ?? 0,
        patientId: encounterContext.patientId,
        selectedSendStatus: selectedOrcaSendStatus ?? null,
        counts: orcaQueueCounts,
        traceId: meta.traceId,
      },
    });

    recordChartsAuditEvent({
      action: 'ORCA_QUEUE_STATUS',
      outcome: selectedOrcaSendStatus?.key === 'failure' || selectedOrcaSendStatus?.isStalled ? 'warning' : 'success',
      subject: 'charts-orca-queue',
      patientId: encounterContext.patientId,
      runId: orcaQueueQuery.data.runId ?? resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      fallbackUsed: resolvedFallbackUsed,
      dataSourceTransition: resolvedTransition,
      details: {
        traceId: meta.traceId,
        queueSource: orcaQueueQuery.data.source,
        fetchedAt: orcaQueueQuery.data.fetchedAt,
        counts: orcaQueueCounts,
        selectedSendStatus: selectedOrcaSendStatus ?? null,
      },
    });
  }, [
    encounterContext.patientId,
    flags.runId,
    orcaQueueCounts,
    orcaQueueQuery.data,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
    selectedOrcaSendStatus,
  ]);

  const hasPermission = useMemo(() => hasStoredAuth(), []);

  const networkDegradedReason = useMemo(() => {
    const firstError =
      (claimQuery.isError && isNetworkError(claimQuery.error) ? claimQuery.error : undefined) ??
      (medicalSummaryQuery.isError && isNetworkError(medicalSummaryQuery.error) ? medicalSummaryQuery.error : undefined) ??
      (appointmentQuery.isError && isNetworkError(appointmentQuery.error) ? appointmentQuery.error : undefined);
    if (!firstError) return undefined;
    const message = firstError instanceof Error ? firstError.message : String(firstError);
    return `直近の取得でネットワークエラーを検知: ${message}`;
  }, [appointmentQuery.error, appointmentQuery.isError, claimQuery.error, claimQuery.isError, medicalSummaryQuery.error, medicalSummaryQuery.isError]);

  const handleRetryClaim = () => {
    logAuditEvent({
      runId: claimQuery.data?.runId ?? resolvedRunId,
      cacheHit: claimQuery.data?.cacheHit,
      missingMaster: claimQuery.data?.missingMaster,
      fallbackUsed: claimQuery.data?.fallbackUsed,
      dataSourceTransition: claimQuery.data?.dataSourceTransition ?? resolvedTransition,
      patientId: encounterContext.patientId,
      appointmentId: encounterContext.appointmentId,
      payload: {
        action: 'CLAIM_OUTPATIENT_RETRY',
        outcome: 'started',
        details: {
          runId: claimQuery.data?.runId ?? resolvedRunId,
          dataSourceTransition: claimQuery.data?.dataSourceTransition ?? resolvedTransition,
          cacheHit: claimQuery.data?.cacheHit,
          missingMaster: claimQuery.data?.missingMaster,
          fallbackUsed: claimQuery.data?.fallbackUsed,
          sourcePath: claimQuery.data?.sourcePath,
        },
      },
    });
    logUiState({
      action: 'outpatient_fetch',
      screen: 'charts/document-timeline',
      controlId: 'retry-claim',
      runId: claimQuery.data?.runId ?? resolvedRunId,
      cacheHit: claimQuery.data?.cacheHit ?? resolvedCacheHit,
      missingMaster: claimQuery.data?.missingMaster ?? resolvedMissingMaster,
      dataSourceTransition: claimQuery.data?.dataSourceTransition ?? resolvedTransition,
      fallbackUsed: claimQuery.data?.fallbackUsed ?? resolvedFallbackUsed,
      patientId: encounterContext.patientId ?? undefined,
      appointmentId: encounterContext.appointmentId ?? undefined,
      claimId: (claimQuery.data as ClaimOutpatientPayload | undefined)?.bundles?.[0]?.bundleNumber,
      details: {
        reason: 'manual_retry',
        endpoint: claimQuery.data?.sourcePath,
        httpStatus: claimQuery.data?.httpStatus,
        apiResult: (claimQuery.data as ClaimOutpatientPayload | undefined)?.apiResult,
        patientId: encounterContext.patientId,
        appointmentId: encounterContext.appointmentId,
        claimId: (claimQuery.data as ClaimOutpatientPayload | undefined)?.bundles?.[0]?.bundleNumber,
      },
    });
    void claimQuery.refetch();
  };

  const claimErrorForTimeline = useMemo(() => {
    const data = claimQuery.data as ClaimOutpatientPayload | undefined;
    if (data?.httpStatus === 0 || (typeof data?.httpStatus === 'number' && data.httpStatus >= 400)) {
      const endpoint = data.sourcePath ?? 'unknown';
      const message = data.apiResultMessage ? ` / ${data.apiResultMessage}` : '';
      const httpLabel = data.httpStatus === 0 ? 'NETWORK' : `HTTP ${data.httpStatus}`;
      return new Error(`請求バンドル取得に失敗（${httpLabel} / endpoint=${endpoint}${message}）`);
    }
    if (typeof data?.apiResult === 'string' && /error|^E/i.test(data.apiResult)) {
      const endpoint = data.sourcePath ?? 'unknown';
      const message = data.apiResultMessage ? ` / ${data.apiResultMessage}` : '';
      return new Error(`請求バンドルの処理結果がエラー（apiResult=${data.apiResult} / endpoint=${endpoint}${message}）`);
    }
    if (!claimQuery.isError) return undefined;
    return claimQuery.error instanceof Error ? claimQuery.error : new Error(String(claimQuery.error));
  }, [claimQuery.data, claimQuery.error, claimQuery.isError]);

  useEffect(() => {
    const { runId, cacheHit, missingMaster, dataSourceTransition, fallbackUsed } = mergedFlags;
    appliedMeta.current = applyAuthServicePatch(
      { runId, cacheHit, missingMaster, dataSourceTransition, fallbackUsed },
      appliedMeta.current,
      { bumpRunId, setCacheHit, setMissingMaster, setDataSourceTransition, setFallbackUsed },
    );
    setAuditEvents(getAuditEventLog());
  }, [
    bumpRunId,
    mergedFlags.cacheHit,
    mergedFlags.dataSourceTransition,
    mergedFlags.fallbackUsed,
    mergedFlags.missingMaster,
    mergedFlags.runId,
    setCacheHit,
    setDataSourceTransition,
    setFallbackUsed,
    setMissingMaster,
  ]);

  useEffect(() => {
    setAuditEvents(getAuditEventLog());
  }, [flags.cacheHit, flags.dataSourceTransition, flags.missingMaster, flags.runId]);

  const appointmentPages = appointmentQuery.data?.pages ?? [];
  const patientEntries: ReceptionEntry[] = useMemo(
    () => appointmentPages.flatMap((page) => page.entries ?? []),
    [appointmentPages],
  );

  const selectedEntry = useMemo(() => {
    if (!hasEncounterHandoffKey) return undefined;
    const byEncounterKey = encounterContext.encounterKey
      ? patientEntries.find((entry) => (entry.encounterKey ?? '').trim() === encounterContext.encounterKey)
      : undefined;
    if (byEncounterKey) return byEncounterKey;
    const byScheduleKey = encounterContext.scheduleKey
      ? patientEntries.find((entry) => (entry.scheduleKey ?? '').trim() === encounterContext.scheduleKey)
      : undefined;
    if (byScheduleKey) return byScheduleKey;
    return undefined;
  }, [encounterContext.encounterKey, encounterContext.scheduleKey, hasEncounterHandoffKey, patientEntries]);

  const selectedEntryPatientId = selectedEntry
    ? (() => {
        const pid = (selectedEntry.patientId ?? '').trim();
        if (pid.length > 0) return pid;
        return undefined;
      })()
    : undefined;
  const patientId = selectedEntryPatientId ?? (hasEncounterHandoffKey ? encounterContext.patientId : undefined);
  const receptionId = selectedEntry?.receptionId ?? (hasEncounterHandoffKey ? encounterContext.receptionId : undefined);
  const appointmentId = selectedEntry?.appointmentId ?? (hasEncounterHandoffKey ? encounterContext.appointmentId : undefined);
  const actionVisitDate = useMemo(
    () =>
      normalizeVisitDate(selectedEntry?.visitDate) ??
      normalizeVisitDate(encounterContext.visitDate) ??
      today,
    [encounterContext.visitDate, selectedEntry?.visitDate, today],
  );

  const patientFallbackQuery = useQuery({
    queryKey: ['charts-patient-fallback', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const result = await fetchPatients({ keyword: patientId });
      const exact = result.patients.find((p) => (p.patientId ?? '').trim() === patientId);
      return exact ?? result.patients[0] ?? null;
    },
    enabled: hasEncounterHandoffKey && Boolean(patientId) && !selectedEntry,
    staleTime: 60_000,
    retry: 1,
  });
  const fallbackPatient: PatientRecord | null = patientFallbackQuery.data ?? null;

  const karteIdQuery = useQuery({
    queryKey: ['charts-karte-id', patientId],
    queryFn: async () => {
      if (!patientId) return { ok: false as const, karteId: null as number | null, error: 'patientId is missing' };
      const result = await fetchKarteIdByPatientId({ patientId });
      return { ok: result.ok, karteId: result.karteId ?? null, error: result.error };
    },
    enabled: hasEncounterHandoffKey && Boolean(patientId),
    staleTime: 60_000,
  });
  const karteId = karteIdQuery.data?.karteId ?? null;

  const rpHistoryQuery = useQuery({
    queryKey: ['charts-rp-history', karteId, actionVisitDate],
    queryFn: () => {
      if (!karteId) throw new Error('karteId is missing');
      return fetchRpHistory({
        karteId,
        fromDate: '2000-01-01',
        toDate: actionVisitDate,
        lastOnly: true,
      });
    },
    enabled: hasEncounterHandoffKey && Boolean(karteId),
    staleTime: 60_000,
  });

  const orderBundleSummaryQuery = useQuery({
    queryKey: ['charts-order-bundles', patientId, actionVisitDate],
    queryFn: async () => {
      if (!patientId) return { ok: false as const, bundles: [] as OrderBundle[], message: 'patientId is missing' };
      try {
        return await fetchOrderBundlesWithPatientImportRecovery({ patientId, from: actionVisitDate });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false as const, bundles: [] as OrderBundle[], message };
      }
    },
    enabled: hasEncounterHandoffKey && Boolean(patientId),
    staleTime: 30_000,
    retry: false,
  });
  const prescriptionBundleSummaryQuery = useQuery({
    queryKey: ['charts-prescription-bundles', patientId, actionVisitDate],
    queryFn: async () => {
      if (!patientId) return { ok: false as const, bundles: [] as OrderBundle[], message: 'patientId is missing' };
      try {
        return await fetchPrescriptionOrderBundlesWithPatientImportRecovery({ patientId, from: actionVisitDate });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false as const, bundles: [] as OrderBundle[], message };
      }
    },
    enabled:
      hasEncounterHandoffKey &&
      Boolean(patientId) &&
      orderBundleSummaryQuery.isSuccess &&
      orderBundleSummaryQuery.data?.ok === true,
    staleTime: 30_000,
    retry: false,
  });
  const diagnosisSummaryQuery = useQuery({
    queryKey: ['charts-diagnosis-summary', patientId, actionVisitDate],
    queryFn: async () => {
      if (!patientId) {
        return {
          ok: false,
          diseases: [],
          message: 'patientId is missing',
          errorKind: 'http',
          routeMismatch: false,
          patientImportAttempted: false,
        } satisfies DiseaseImportResponse;
      }
      try {
        return await fetchDiseasesWithPatientImportRecovery({
          patientId,
          from: actionVisitDate,
          to: actionVisitDate,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          diseases: [],
          message,
          errorKind: 'http',
          routeMismatch: false,
          patientImportAttempted: false,
        } satisfies DiseaseImportResponse;
      }
    },
    enabled: hasEncounterHandoffKey && Boolean(patientId && actionVisitDate),
    staleTime: 30_000,
    retry: false,
  });
  const patientTabsToPrefetch = useMemo(
    () =>
      patientTabs
        .filter((tab) => tab.key !== activePatientTabKey && hasChartsPatientTabHandoffKey(tab))
        .sort((left, right) => resolvePatientTabActivityAt(right) - resolvePatientTabActivityAt(left))
        .slice(0, PATIENT_TAB_PREFETCH_LIMIT),
    [activePatientTabKey, patientTabs],
  );
  const prefetchRunIdRef = useRef(0);
  const prefetchPatientTabData = useCallback(
    async (tab: ChartsPatientTab, runId: number) => {
      const patientId = normalizeEncounterId(tab.patientId);
      const visitDate = normalizeVisitDate(tab.visitDate) ?? today;
      if (!patientId) return;
      const shouldContinue = () => prefetchRunIdRef.current === runId;

      const encounterKey = normalizeEncounterKey(tab.encounterKey);
      if (encounterKey && shouldContinue()) {
        await queryClient
          .prefetchQuery({
            queryKey: ['charts-medical-summary', encounterKey, chartsMasterSourcePolicy],
            queryFn: (context) =>
              fetchChartsMedicalSummary(context, {
                encounterKey,
                preferredSourceOverride,
              }),
            staleTime: PATIENT_TAB_PREFETCH_MEDICAL_SUMMARY_STALE_MS,
          })
          .catch(() => undefined);
      }

      if (!shouldContinue()) return;
      const karteResult = await queryClient
        .fetchQuery({
          queryKey: ['charts-karte-id', patientId],
          queryFn: async () => {
            const result = await fetchKarteIdByPatientId({ patientId });
            return { ok: result.ok, karteId: result.karteId ?? null, error: result.error };
          },
          staleTime: PATIENT_TAB_PREFETCH_KARTE_ID_STALE_MS,
        })
        .catch(() => null);

      if (!shouldContinue()) return;
      const orderResult = await queryClient
        .fetchQuery({
          queryKey: ['charts-order-bundles', patientId, visitDate],
          queryFn: async () => {
            try {
              return await fetchOrderBundlesWithPatientImportRecovery({ patientId, from: visitDate });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return { ok: false as const, bundles: [] as OrderBundle[], message };
            }
          },
          staleTime: PATIENT_TAB_PREFETCH_DATA_STALE_MS,
          retry: false,
        })
        .catch(() => null);

      if (!shouldContinue()) return;
      await queryClient
        .prefetchQuery({
          queryKey: ['charts-diagnosis-summary', patientId, visitDate],
          queryFn: async () => {
            try {
              return await fetchDiseasesWithPatientImportRecovery({
                patientId,
                from: visitDate,
                to: visitDate,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return {
                ok: false,
                diseases: [],
                message,
                errorKind: 'http',
                routeMismatch: false,
                patientImportAttempted: false,
              } satisfies DiseaseImportResponse;
            }
          },
          staleTime: PATIENT_TAB_PREFETCH_DATA_STALE_MS,
          retry: false,
        })
        .catch(() => undefined);

      if (!shouldContinue()) return;
      if (orderResult?.ok === true) {
        await queryClient
          .prefetchQuery({
            queryKey: ['charts-prescription-bundles', patientId, visitDate],
            queryFn: async () => {
              try {
                return await fetchPrescriptionOrderBundlesWithPatientImportRecovery({ patientId, from: visitDate });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false as const, bundles: [] as OrderBundle[], message };
              }
            },
            staleTime: PATIENT_TAB_PREFETCH_DATA_STALE_MS,
            retry: false,
          })
          .catch(() => undefined);
      }

      if (!shouldContinue()) return;
      const prefetchKarteId = karteResult?.ok ? karteResult.karteId : null;
      if (prefetchKarteId) {
        await queryClient
          .prefetchQuery({
            queryKey: ['charts-rp-history', prefetchKarteId, visitDate],
            queryFn: () =>
              fetchRpHistory({
                karteId: prefetchKarteId,
                fromDate: '2000-01-01',
                toDate: visitDate,
                lastOnly: true,
              }),
            staleTime: PATIENT_TAB_PREFETCH_KARTE_ID_STALE_MS,
          })
          .catch(() => undefined);
      }
    },
    [chartsMasterSourcePolicy, preferredSourceOverride, queryClient, today],
  );
  useEffect(() => {
    if (patientTabsToPrefetch.length === 0) return;
    const runId = prefetchRunIdRef.current + 1;
    prefetchRunIdRef.current = runId;
    void (async () => {
      for (const tab of patientTabsToPrefetch) {
        if (prefetchRunIdRef.current !== runId) return;
        await prefetchPatientTabData(tab, runId);
      }
    })();
  }, [patientTabsToPrefetch, prefetchPatientTabData]);
  const rpEntries = rpHistoryQuery.data?.ok ? rpHistoryQuery.data.entries : [];
  const rpError = rpHistoryQuery.data && !rpHistoryQuery.data.ok ? rpHistoryQuery.data.error : undefined;
  const baseOrderBundles = orderBundleSummaryQuery.data?.ok ? orderBundleSummaryQuery.data.bundles : EMPTY_ORDER_BUNDLES;
  const prescriptionBundles = useMemo(() => {
    if (prescriptionBundleSummaryQuery.data?.ok) return prescriptionBundleSummaryQuery.data.bundles;
    return baseOrderBundles.filter((bundle) => resolveOrderGroupKeyByEntity(bundle.entity?.trim() ?? '') === 'prescription');
  }, [baseOrderBundles, prescriptionBundleSummaryQuery.data]);
  const orderBundles = useMemo(() => {
    const nonPrescriptionBundles = baseOrderBundles.filter(
      (bundle) => resolveOrderGroupKeyByEntity(bundle.entity?.trim() ?? '') !== 'prescription',
    );
    return [...prescriptionBundles, ...nonPrescriptionBundles];
  }, [baseOrderBundles, prescriptionBundles]);
  const prescriptionBundlesError =
    prescriptionBundleSummaryQuery.data && !prescriptionBundleSummaryQuery.data.ok
      ? prescriptionBundleSummaryQuery.data.message ?? '処方情報の取得に失敗しました。'
      : undefined;
  const orderBundlesError =
    orderBundleSummaryQuery.data && !orderBundleSummaryQuery.data.ok
      ? orderBundleSummaryQuery.data.message ?? 'オーダー情報の取得に失敗しました。'
      : undefined;
  const orcaRecoveryAlert = useMemo(() => {
    if (!patientId) return null;
    const candidates = [
      orderBundleSummaryQuery.data && !orderBundleSummaryQuery.data.ok
        ? {
            message: orderBundleSummaryQuery.data.message,
            errorKind: orderBundleSummaryQuery.data.errorKind,
            routeMismatch: orderBundleSummaryQuery.data.routeMismatch,
            patientImportAttempted: orderBundleSummaryQuery.data.patientImportAttempted,
          }
        : null,
      prescriptionBundleSummaryQuery.data && !prescriptionBundleSummaryQuery.data.ok
        ? {
            message: prescriptionBundleSummaryQuery.data.message,
            errorKind: prescriptionBundleSummaryQuery.data.errorKind,
            routeMismatch: prescriptionBundleSummaryQuery.data.routeMismatch,
            patientImportAttempted: prescriptionBundleSummaryQuery.data.patientImportAttempted,
          }
        : null,
      diagnosisSummaryQuery.data && diagnosisSummaryQuery.data.ok === false
        ? {
            message: diagnosisSummaryQuery.data.message,
            errorKind: diagnosisSummaryQuery.data.errorKind,
            routeMismatch: diagnosisSummaryQuery.data.routeMismatch,
            patientImportAttempted: diagnosisSummaryQuery.data.patientImportAttempted,
          }
        : null,
    ];
    for (const candidate of candidates) {
      if (!candidate?.message) continue;
      const isAuth = candidate.errorKind === 'auth';
      const isRouteMismatch = candidate.routeMismatch || candidate.errorKind === 'route_not_found';
      const isBusinessNotFound = candidate.errorKind === 'business_not_found';
      if (!candidate.patientImportAttempted && !isAuth && !isRouteMismatch && !isBusinessNotFound) continue;
      const tone: 'error' | 'warning' = isAuth || isRouteMismatch ? 'error' : 'warning';
      return {
        tone,
        message: candidate.message,
      };
    }
    return null;
  }, [diagnosisSummaryQuery.data, orderBundleSummaryQuery.data, patientId, prescriptionBundleSummaryQuery.data]);
  const diagnosisCountForSend =
    diagnosisSummaryQuery.data && diagnosisSummaryQuery.data.ok
      ? (diagnosisSummaryQuery.data.diseases ?? []).length
      : undefined;
  const todayOrderBundlesForSet = useMemo(
    () => filterSameDayOrderBundles(orderBundles, actionVisitDate),
    [actionVisitDate, orderBundles],
  );

  const refreshOrderSetEntries = useCallback(() => {
    const next = listChartOrderSets(session.facilityId, session.userId);
    setOrderSetEntries(next);
    if (next.length === 0) {
      setSelectedOrderSetId('');
      return next;
    }
    setSelectedOrderSetId((prev) => (next.some((item) => item.id === prev) ? prev : next[0].id));
    return next;
  }, [session.facilityId, session.userId]);

  const selectedOrderSet = useMemo(
    () => orderSetEntries.find((item) => item.id === selectedOrderSetId) ?? null,
    [orderSetEntries, selectedOrderSetId],
  );

  const patientDisplay = useMemo(() => {
    const baseDate = parseDate(actionVisitDate) ?? new Date();
    const birthDateRaw = selectedEntry?.birthDate ?? fallbackPatient?.birthDate;
    const birthDateParts = formatBirthDateParts(birthDateRaw);
    const resolvedName =
      selectedEntry?.name ??
      fallbackPatient?.name ??
      (patientId ? `患者ID:${patientId}` : '患者未選択');
    return {
      patientId: patientId ?? '—',
      receptionId: receptionId ?? '—',
      appointmentId: appointmentId ?? '—',
      name: resolvedName,
      kana: selectedEntry?.kana ?? fallbackPatient?.kana ?? '—',
      birthDate: birthDateParts.display,
      birthDateIso: birthDateParts.iso,
      birthDateEra: birthDateParts.era,
      age: formatAge(birthDateRaw, baseDate),
      sex: selectedEntry?.sex ?? fallbackPatient?.sex ?? '—',
      zip: fallbackPatient?.zip ?? '—',
      address: fallbackPatient?.address ?? '—',
      status: selectedEntry?.status ?? '—',
      department: selectedEntry?.department ?? '—',
      physician: selectedEntry?.physician ?? '—',
      insurance: selectedEntry?.insurance ?? fallbackPatient?.insurance ?? '—',
      visitDate: actionVisitDate ?? '—',
      appointmentTime: selectedEntry?.appointmentTime ?? '—',
      note: selectedEntry?.note ?? fallbackPatient?.memo ?? 'メモなし',
    };
  }, [
    actionVisitDate,
    appointmentId,
    fallbackPatient?.birthDate,
    fallbackPatient?.insurance,
    fallbackPatient?.kana,
    fallbackPatient?.memo,
    fallbackPatient?.name,
    fallbackPatient?.sex,
    fallbackPatient?.zip,
    fallbackPatient?.address,
    patientId,
    receptionId,
    selectedEntry?.appointmentTime,
    selectedEntry?.birthDate,
    selectedEntry?.department,
    selectedEntry?.insurance,
    selectedEntry?.kana,
    selectedEntry?.name,
    selectedEntry?.note,
    selectedEntry?.physician,
    selectedEntry?.sex,
    selectedEntry?.status,
    selectedEntry?.visitDate,
  ]);
  const soapSendSummary = useMemo(
    () => ({
      subjective: Boolean((soapDraftSnapshot.subjective ?? '').trim()),
      objective: Boolean((soapDraftSnapshot.objective ?? '').trim()),
      assessment: Boolean((soapDraftSnapshot.assessment ?? '').trim()),
      plan: Boolean((soapDraftSnapshot.plan ?? '').trim()),
    }),
    [soapDraftSnapshot.assessment, soapDraftSnapshot.objective, soapDraftSnapshot.plan, soapDraftSnapshot.subjective],
  );
  const sendConfirmSummary = useMemo(
    () => ({
      patientName: patientDisplay.name,
      patientId,
      birthDate: patientDisplay.birthDateIso,
      age: patientDisplay.age,
      visitDate: actionVisitDate,
      receptionId,
      appointmentId,
      diagnosisCount: diagnosisCountForSend,
      orderCount: todayOrderBundlesForSet.length,
      soap: soapSendSummary,
      imageAttachmentCount: documentImageAttachments.length,
    }),
    [
      actionVisitDate,
      appointmentId,
      diagnosisCountForSend,
      documentImageAttachments.length,
      patientDisplay.age,
      patientDisplay.birthDateIso,
      patientDisplay.name,
      patientId,
      receptionId,
      soapSendSummary,
      todayOrderBundlesForSet.length,
    ],
  );

  useEffect(() => {
    refreshOrderSetEntries();
  }, [refreshOrderSetEntries]);

  useEffect(() => {
    const patientName = (patientDisplay.name ?? '').trim();
    if (!patientId) {
      setOrderSetName('');
      return;
    }
    const suffix = patientName ? ` ${patientName}` : '';
    setOrderSetName(`${actionVisitDate} セット${suffix}`);
  }, [actionVisitDate, patientDisplay.name, patientId]);

  useEffect(() => {
    setOrderSetNotice(null);
    setReplaceSoapDraftRequest(null);
  }, [encounterContext.patientId]);

  const patientTabKeyForContext = useMemo(() => {
    const pid = (patientId ?? '').trim();
    if (!pid) return null;
    const visitDate = normalizeVisitDate(encounterContext.visitDate) ?? actionVisitDate ?? today;
    return buildPatientTabKey(pid, visitDate, {
      scheduleKey: encounterContext.scheduleKey,
      encounterKey: encounterContext.encounterKey,
    });
  }, [actionVisitDate, encounterContext.encounterKey, encounterContext.scheduleKey, encounterContext.visitDate, patientId, today]);

  useEffect(() => {
    const key = patientTabKeyForContext;
    if (!key) return;
    const nextName = (selectedEntry?.name ?? fallbackPatient?.name ?? '').trim();
    const nextDepartment = (selectedEntry?.department ?? '').trim();
    if (!nextName && !nextDepartment) return;
    setPatientTabsState((prev) => {
      const existing = prev.tabs.find((tab) => tab.key === key);
      if (!existing) return prev;
      const currentName = (existing.name ?? '').trim();
      const currentDepartment = (existing.department ?? '').trim();
      const resolvedName = nextName || existing.name;
      const resolvedDepartment = nextDepartment || existing.department;
      if (currentName === (resolvedName ?? '').trim() && currentDepartment === (resolvedDepartment ?? '').trim()) {
        return prev;
      }
      const nextTabs = prev.tabs.map((tab) =>
        tab.key === key
          ? {
              ...tab,
              name: resolvedName,
              department: resolvedDepartment,
            }
          : tab,
      );
      return { ...prev, tabs: nextTabs };
    });
  }, [fallbackPatient?.name, patientTabKeyForContext, selectedEntry?.department, selectedEntry?.name]);

  const lockTarget = useMemo(() => {
    const patientId = selectedEntry?.patientId ?? encounterContext.patientId;
    return {
      facilityId: session.facilityId,
      patientId,
      receptionId: selectedEntry?.receptionId ?? encounterContext.receptionId,
      appointmentId: selectedEntry?.appointmentId ?? encounterContext.appointmentId,
    };
  }, [
    encounterContext.appointmentId,
    encounterContext.patientId,
    encounterContext.receptionId,
    selectedEntry?.appointmentId,
    selectedEntry?.patientId,
    selectedEntry?.receptionId,
    session.facilityId,
  ]);
  const approvalTarget = useMemo(
    () => ({
      facilityId: session.facilityId,
      patientId: encounterContext.patientId,
      appointmentId: encounterContext.appointmentId,
      receptionId: encounterContext.receptionId,
    }),
    [
      encounterContext.appointmentId,
      encounterContext.patientId,
      encounterContext.receptionId,
      session.facilityId,
    ],
  );
  const approvalStorageKey = useMemo(
    () => buildChartsApprovalStorageKey(approvalTarget),
    [approvalTarget],
  );
  const handleApprovalConfirmed = useCallback(
    (meta: { action: 'send'; actor?: string }) => {
      if (!approvalStorageKey) return;
      const record: ChartsApprovalRecord = {
        version: 1,
        key: approvalStorageKey,
        approvedAt: new Date().toISOString(),
        runId: resolvedRunId ?? flags.runId,
        actor: meta.actor,
        action: meta.action,
      };
      writeChartsApprovalRecord(record);
      setApprovalState({ status: 'approved', record });
    },
    [approvalStorageKey, flags.runId, resolvedRunId],
  );
  const handleApprovalUnlock = useCallback(() => {
    if (!approvalStorageKey) {
      setApprovalState({ status: 'none' });
      return;
    }
    const approvedAt = approvalState.record?.approvedAt ?? 'unknown';
    const signature = `${approvalStorageKey}:${approvedAt}`;
    clearChartsApprovalRecord(approvalStorageKey);
    setApprovalState({ status: 'none' });
    if (approvalUnlockLogRef.current === signature) return;
    approvalUnlockLogRef.current = signature;
    recordChartsAuditEvent({
      action: 'CHARTS_EDIT_LOCK',
      outcome: 'released',
      subject: 'charts-approval-lock',
      patientId: approvalTarget.patientId,
      appointmentId: approvalTarget.appointmentId,
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      fallbackUsed: resolvedFallbackUsed,
      dataSourceTransition: resolvedTransition,
      details: {
        operationPhase: 'lock',
        trigger: 'approval_unlock',
        approvalState: 'released',
        lockStatus: 'approved',
        patientId: approvalTarget.patientId,
        appointmentId: approvalTarget.appointmentId,
        receptionId: approvalTarget.receptionId,
        facilityId: session.facilityId,
        userId: session.userId,
      },
    });
    logUiState({
      action: 'lock',
      screen: 'charts/action-bar',
      controlId: 'approval-unlock',
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      dataSourceTransition: resolvedTransition,
      fallbackUsed: resolvedFallbackUsed,
      patientId: approvalTarget.patientId,
      appointmentId: approvalTarget.appointmentId,
      details: {
        operationPhase: 'lock',
        trigger: 'approval_unlock',
        approvalState: 'released',
        lockStatus: 'approved',
        patientId: approvalTarget.patientId,
        appointmentId: approvalTarget.appointmentId,
        receptionId: approvalTarget.receptionId,
      },
    });
  }, [
    approvalState.record?.approvedAt,
    approvalStorageKey,
    approvalTarget.appointmentId,
    approvalTarget.patientId,
    approvalTarget.receptionId,
    flags.runId,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
    session.facilityId,
    session.userId,
  ]);
  const tabLock = useChartsTabLock({
    runId: resolvedRunId ?? flags.runId,
    target: lockTarget,
    enabled: chartsDisplayEnabled && Boolean(lockTarget.patientId),
    scope: storageScope,
  });
  tabLockReadOnlyRef.current = tabLock.isReadOnly;

  const sidePanelMeta = useMemo(
    () => ({
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit ?? false,
      missingMaster: resolvedMissingMaster ?? false,
      fallbackUsed: resolvedFallbackUsed ?? false,
      dataSourceTransition: resolvedTransition ?? 'snapshot',
      patientId: encounterContext.patientId,
      appointmentId: encounterContext.appointmentId,
      receptionId: encounterContext.receptionId,
      visitDate: encounterContext.visitDate,
      actorRole: session.role,
      readOnly: lockState.locked || tabLock.isReadOnly || approvalLocked,
      readOnlyReason: approvalLocked ? approvalReason : lockState.reason ?? tabLock.readOnlyReason,
    }),
    [
      approvalLocked,
      approvalReason,
      encounterContext.appointmentId,
      encounterContext.patientId,
      encounterContext.receptionId,
      encounterContext.visitDate,
      flags.runId,
      lockState.locked,
      lockState.reason,
      resolvedCacheHit,
      resolvedFallbackUsed,
      resolvedMissingMaster,
      resolvedRunId,
      resolvedTransition,
      session.role,
      tabLock.isReadOnly,
      tabLock.readOnlyReason,
    ],
  );

  useEffect(() => {
    if (!approvalStorageKey) {
      setApprovalState({ status: 'none' });
      return;
    }
    const record = readChartsApprovalRecord(approvalStorageKey);
    if (record) {
      setApprovalState({ status: 'approved', record });
      return;
    }
    setApprovalState({ status: 'none' });
  }, [approvalStorageKey]);

  useEffect(() => {
    if (!approvalLocked) {
      approvalLockLogRef.current = null;
      return;
    }
    if (!approvalStorageKey) return;
    const approvedAt = approvalState.record?.approvedAt ?? 'unknown';
    const signature = `${approvalStorageKey}:${approvedAt}`;
    if (approvalLockLogRef.current === signature) return;
    approvalLockLogRef.current = signature;
    recordChartsAuditEvent({
      action: 'CHARTS_EDIT_LOCK',
      outcome: 'acquired',
      subject: 'charts-approval-lock',
      patientId: approvalTarget.patientId,
      appointmentId: approvalTarget.appointmentId,
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      fallbackUsed: resolvedFallbackUsed,
      dataSourceTransition: resolvedTransition,
      details: {
        operationPhase: 'lock',
        trigger: 'approval',
        lockStatus: 'approved',
        approvalState: 'confirmed',
        receptionId: approvalTarget.receptionId,
        facilityId: session.facilityId,
        userId: session.userId,
      },
    });
    logUiState({
      action: 'lock',
      screen: 'charts',
      controlId: 'approval-lock',
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      dataSourceTransition: resolvedTransition,
      fallbackUsed: resolvedFallbackUsed,
      patientId: approvalTarget.patientId,
      appointmentId: approvalTarget.appointmentId,
      details: {
        operationPhase: 'lock',
        trigger: 'approval',
        lockStatus: 'approved',
        approvalState: 'confirmed',
        receptionId: approvalTarget.receptionId,
      },
    });
  }, [
    approvalLocked,
    approvalState.record?.approvedAt,
    approvalStorageKey,
    approvalTarget.appointmentId,
    approvalTarget.patientId,
    approvalTarget.receptionId,
    flags.runId,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
    session.facilityId,
    session.userId,
  ]);

  useEffect(() => {
    if (!tabLock.storageKey) {
      setEditLockAlert(null);
      return;
    }
    if (!tabLock.isReadOnly) {
      setEditLockAlert(null);
      return;
    }
    const announcementKey = `${tabLock.storageKey}:${tabLock.ownerTabSessionId ?? 'unknown'}:${tabLock.expiresAt ?? 'unknown'}`;
    const isFirst = lastEditLockAnnouncement.current !== announcementKey;
    lastEditLockAnnouncement.current = announcementKey;

    const message = `${tabLock.readOnlyReason ?? '別タブで編集中のため閲覧専用です。'}（patientId=${lockTarget.patientId ?? '—'} receptionId=${lockTarget.receptionId ?? '—'}）`;
    setEditLockAlert({
      tone: 'warning',
      message,
      ariaLive: isFirst ? 'assertive' : 'polite',
    });

    recordChartsAuditEvent({
      action: 'CHARTS_EDIT_LOCK',
      outcome: 'conflict',
      subject: 'charts-tab-lock',
      patientId: lockTarget.patientId,
      appointmentId: lockTarget.appointmentId,
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      fallbackUsed: resolvedFallbackUsed,
      dataSourceTransition: resolvedTransition,
      details: {
        operationPhase: 'lock',
        trigger: 'tab',
        lockStatus: tabLock.status,
        tabSessionId: tabLock.tabSessionId,
        lockOwnerRunId: tabLock.ownerRunId,
        lockExpiresAt: tabLock.expiresAt,
        receptionId: lockTarget.receptionId,
        facilityId: session.facilityId,
        userId: session.userId,
      },
    });
    logUiState({
      action: 'lock',
      screen: 'charts',
      controlId: 'tab-lock',
      runId: resolvedRunId ?? flags.runId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      dataSourceTransition: resolvedTransition,
      fallbackUsed: resolvedFallbackUsed,
      patientId: lockTarget.patientId,
      appointmentId: lockTarget.appointmentId,
      details: {
        operationPhase: 'lock',
        trigger: 'tab',
        reason: tabLock.readOnlyReason,
        lockStatus: tabLock.status,
        tabSessionId: tabLock.tabSessionId,
        lockOwnerRunId: tabLock.ownerRunId,
        lockExpiresAt: tabLock.expiresAt,
        receptionId: lockTarget.receptionId,
      },
    });
  }, [
    flags.runId,
    lockTarget.appointmentId,
    lockTarget.patientId,
    lockTarget.receptionId,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
    session.facilityId,
    session.userId,
    tabLock.expiresAt,
    tabLock.isReadOnly,
    tabLock.ownerRunId,
    tabLock.ownerTabSessionId,
    tabLock.readOnlyReason,
    tabLock.storageKey,
    tabLock.tabSessionId,
  ]);

  const formattedLastUpdated = useMemo(() => {
    for (let idx = auditEvents.length - 1; idx >= 0; idx -= 1) {
      const record = auditEvents[idx];
      const payload = (record.payload ?? {}) as Record<string, unknown>;
      const action = payload.action;
      const outcome = payload.outcome;
      if (outcome !== 'success') continue;
      if (action !== 'DRAFT_SAVE' && action !== 'ORCA_SEND' && action !== 'ENCOUNTER_CLOSE') continue;
      const details = (payload.details ?? {}) as Record<string, unknown>;
      const actor = typeof details.actor === 'string' ? details.actor : undefined;
      const stamp = typeof record.timestamp === 'string' ? record.timestamp : undefined;
      if (!stamp) continue;
      const date = new Date(stamp);
      if (Number.isNaN(date.getTime())) continue;
      const hhmm = date.toISOString().slice(11, 16);
      return { action: String(action), actor, hhmm };
    }
    return null;
  }, [auditEvents]);
  const editStatusValue = tabLock.isReadOnly
    ? `閲覧専用${tabLock.ownerRunId ? `（ownerRunId=${tabLock.ownerRunId}）` : ''}`
    : tabLock.storageKey
      ? '編集中'
      : '—';
  const editStateMeta = tabLock.isReadOnly
    ? { value: editStatusValue, tone: 'warning' as const }
    : approvalLocked
      ? { value: approvalReason ?? '承認ロック中', tone: 'warning' as const }
      : null;
  const lastUpdatedSummary = useMemo(
    () => ({
      message: formattedLastUpdated
        ? `最終更新: ${formattedLastUpdated.hhmm} by ${formattedLastUpdated.actor ?? 'unknown'} (${formattedLastUpdated.action})`
        : '最終更新: —',
    }),
    [formattedLastUpdated],
  );
  const appointmentRecordsReturned = useMemo(
    () =>
      appointmentPages.reduce(
        (acc, page) => acc + (page.recordsReturned ?? page.entries?.length ?? 0),
        0,
      ),
    [appointmentPages],
  );
  const hasNextAppointments =
    appointmentQuery.hasNextPage ?? appointmentPages.some((page) => page.hasNextPage === true);

  const appointmentBanner = useMemo(
    () =>
      getAppointmentDataBanner({
        entries: patientEntries,
        isLoading: appointmentQuery.isLoading,
        isError: appointmentQuery.isError,
        error: appointmentQuery.error,
        date: today,
      }),
    [appointmentQuery.error, appointmentQuery.isError, appointmentQuery.isLoading, patientEntries, today],
  );
  const switchLocked = lockState.locked || tabLock.isReadOnly;
  const switchLockedReason = lockState.reason ?? (tabLock.isReadOnly ? tabLock.readOnlyReason : undefined);
  useEffect(() => {
    if (patientEntries.length === 0) return;
    if (draftState.dirty || lockState.locked || tabLock.isReadOnly) return;
    if (!hasEncounterHandoffKey) {
      if (hasEncounterContext(encounterContext)) {
        setContextAlert({
          tone: 'warning',
          message: 'scheduleKey / encounterKey が未設定のためカルテを開けません。',
        });
      }
      return;
    }
    const chosen = selectedEntry;
    if (!chosen) {
      setContextAlert({
        tone: 'warning',
        message: `指定された scheduleKey / encounterKey が見つかりません（scheduleKey=${encounterContext.scheduleKey ?? '―'} encounterKey=${encounterContext.encounterKey ?? '―'}）。`,
      });
      return;
    }
    const nextContext = normalizeEncounterContext({
      patientId: resolveEncounterPatientIdFromEntry(chosen) ?? encounterContext.patientId,
      appointmentId: chosen.appointmentId,
      receptionId: chosen.receptionId,
      scheduleKey: chosen.scheduleKey ?? encounterContext.scheduleKey,
      encounterKey: chosen.encounterKey ?? encounterContext.encounterKey,
      visitDate: normalizeVisitDate(chosen.visitDate) ?? encounterContext.visitDate ?? today,
    });
    if (!sameEncounterContext(nextContext, encounterContext)) {
      suppressUrlContextSyncRef.current = true;
      setEncounterContext(nextContext);
      setContextAlert(null);
    }
  }, [
    draftState.dirty,
    encounterContext,
    hasEncounterHandoffKey,
    lockState.locked,
    patientEntries,
    sameEncounterContext,
    selectedEntry,
    tabLock.isReadOnly,
    today,
  ]);

  const latestAuditEvent = useMemo(() => {
    const auditMeta = {
      runId: resolvedRunId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      dataSourceTransition: resolvedTransition,
      fallbackUsed: resolvedFallbackUsed,
    };
    if (auditEvents.length > 0) {
      return normalizeAuditEventLog(auditEvents[auditEvents.length - 1], auditMeta);
    }
    return mergedFlags.auditEvent;
  }, [auditEvents, mergedFlags.auditEvent, resolvedCacheHit, resolvedFallbackUsed, resolvedMissingMaster, resolvedRunId, resolvedTransition]);

  const handleRefreshSummary = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      const refreshes: Promise<unknown>[] = [claimQuery.refetch(), appointmentQuery.refetch()];
      if (hasMedicalSummaryEncounterKey) {
        refreshes.push(medicalSummaryQuery.refetch());
      }
      await Promise.all(refreshes);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [appointmentQuery, claimQuery, hasMedicalSummaryEncounterKey, medicalSummaryQuery]);

  const handleRefreshWithoutSummary = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([claimQuery.refetch(), appointmentQuery.refetch()]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [appointmentQuery, claimQuery]);

  const requestEncounterExitChoice = useCallback(
    (action: EncounterExitAction) =>
      new Promise<EncounterExitChoice>((resolve) => {
        encounterExitResolverRef.current = resolve;
        setEncounterExitGuard({
          action,
          patientName: patientDisplay.name?.trim() || selectedEntry?.name?.trim() || '患者未選択',
          patientId: patientId ?? selectedEntry?.patientId ?? encounterContext.patientId,
          visitDate: actionVisitDate,
          receptionId: receptionId ?? selectedEntry?.receptionId ?? encounterContext.receptionId,
          appointmentId: appointmentId ?? selectedEntry?.appointmentId ?? encounterContext.appointmentId,
          dirtySources: draftState.dirtySources ?? [],
        });
      }),
    [
      actionVisitDate,
      appointmentId,
      draftState.dirtySources,
      encounterContext.appointmentId,
      encounterContext.patientId,
      encounterContext.receptionId,
      patientDisplay.name,
      patientId,
      receptionId,
      selectedEntry?.appointmentId,
      selectedEntry?.name,
      selectedEntry?.patientId,
      selectedEntry?.receptionId,
    ],
  );

  const handleEncounterExitChoice = useCallback((choice: EncounterExitChoice) => {
    setEncounterExitGuard(null);
    encounterExitResolverRef.current?.(choice);
    encounterExitResolverRef.current = null;
  }, []);

  const requestSoapSaveForEncounterAction = useCallback(
    (reason: 'pause' | 'finish' | 'tab-transition') =>
      new Promise<SoapSaveRequestResult>((resolve) => {
        if (soapSyncState.isSaving) {
          resolve({
            token: 'saving',
            ok: false,
            message: 'SOAPを保存中のため完了待ちです。保存完了後に再実行してください。',
            serverSynced: false,
            localSaved: false,
            error: 'saving_in_progress',
          });
          return;
        }
        const token = `charts-soap-save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        pendingSoapSaveTokenRef.current = token;
        soapSaveResolverRef.current = resolve;
        setSoapSaveRequest({ token, reason });
      }),
    [soapSyncState.isSaving],
  );

  const handleSoapSaveRequestResult = useCallback((result: SoapSaveRequestResult) => {
    if (!pendingSoapSaveTokenRef.current || result.token !== pendingSoapSaveTokenRef.current) return;
    pendingSoapSaveTokenRef.current = null;
    setSoapSaveRequest(null);
    soapSaveResolverRef.current?.(result);
    soapSaveResolverRef.current = null;
  }, []);

  const handleTabGuardChoice = useCallback(
    async (choice: TabGuardChoice) => {
      if (!tabGuard) return;
      if (choice === 'cancel') {
        setTabGuard(null);
        return;
      }
      if (choice === 'discard') {
        setTabGuard(null);
        setDraftState((prev) => ({ ...prev, dirty: false, dirtySources: [] }));
        continueTabGuardTransition(tabGuard);
        return;
      }
      if (!tabGuard.canSave) {
        setTabGuard((prev) =>
          prev
            ? {
                ...prev,
                saveError: 'この未保存内容は患者タブ切替前に自動保存できません。保存完了後に再実行してください。',
              }
            : prev,
        );
        return;
      }

      setTabGuard((prev) => (prev ? { ...prev, saveError: null } : prev));
      const saveResult = await requestSoapSaveForEncounterAction('tab-transition');
      if (!saveResult.ok || !saveResult.serverSynced) {
        const label = tabGuard.action === 'switch' ? '患者切替' : '患者タブ終了';
        const message = `${label}を中止しました。SOAP保存に失敗: ${saveResult.message}`;
        setContextAlert({
          tone: 'warning',
          message,
        });
        setTabGuard((prev) => (prev ? { ...prev, saveError: saveResult.message } : prev));
        return;
      }

      setTabGuard(null);
      setDraftState((prev) => ({ ...prev, dirty: false, dirtySources: [] }));
      continueTabGuardTransition(tabGuard);
    },
    [continueTabGuardTransition, requestSoapSaveForEncounterAction, tabGuard],
  );

  const handleBeforeChartsAction = useCallback(
    async (action: 'start' | 'pause' | 'finish' | 'send' | 'draft' | 'cancel' | 'print') => {
      if (action !== 'pause' && action !== 'finish') return true;
      const needsGuard = draftState.dirty || !soapSyncState.serverSynced || soapSyncState.isSaving;
      if (!needsGuard) return true;
      const choice = await requestEncounterExitChoice(action);
      if (choice === 'cancel') return false;
      if (choice === 'discard') return true;
      const saveResult = await requestSoapSaveForEncounterAction(action);
      if (!saveResult.ok || !saveResult.serverSynced) {
        const label = action === 'finish' ? '診察終了' : '診察中断';
        setContextAlert({
          tone: 'warning',
          message: `${label}を中止しました。SOAP保存に失敗: ${saveResult.message}`,
        });
        return false;
      }
      return true;
    },
    [
      draftState.dirty,
      requestEncounterExitChoice,
      requestSoapSaveForEncounterAction,
      soapSyncState.isSaving,
      soapSyncState.serverSynced,
    ],
  );

  const handleAfterStart = useCallback(async () => {
    const transition = await openChartEncounter({
      encounterKey: encounterContext.encounterKey,
      patientId,
      karteId,
    });
    if (patientId && actionVisitDate) {
      upsertReceptionStatusOverride({
        date: actionVisitDate,
        patientId,
        status: '診療中',
        source: 'charts_start',
        runId: resolvedRunId ?? flags.runId,
        scope: storageScope,
        fallbackEntry: selectedEntry
          ? {
              ...selectedEntry,
              patientId,
              visitDate: actionVisitDate,
            }
          : undefined,
      });
    }
    await handleRefreshSummary();
    return {
      requestId: transition.requestId,
      traceId: transition.traceId,
      encounterKey: transition.encounterKey,
      idempotencyKey: transition.idempotencyKey,
      detail: `checked_in -> ${transition.businessState} / encounterKey=${transition.encounterKey} / requestId=${transition.requestId} / traceId=${transition.traceId ?? 'unknown'} / idempotencyKey=${transition.idempotencyKey}`,
    };
  }, [
    actionVisitDate,
    encounterContext.encounterKey,
    flags.runId,
    handleRefreshSummary,
    karteId,
    patientId,
    resolvedRunId,
    selectedEntry,
    storageScope,
  ]);

  const handleAfterPause = useCallback(async () => {
    if (patientId && actionVisitDate) {
      upsertReceptionStatusOverride({
        date: actionVisitDate,
        patientId,
        status: '診療中',
        source: 'charts_pause',
        runId: resolvedRunId ?? flags.runId,
        scope: storageScope,
        fallbackEntry: selectedEntry
          ? {
              ...selectedEntry,
              patientId,
              visitDate: actionVisitDate,
            }
          : undefined,
      });
    }
    await handleRefreshWithoutSummary();
    setDraftState((prev) => ({ ...prev, dirty: false, dirtySources: [] }));
    const activeKey = activePatientTabKey;
    if (!activeKey) return;
    forceClosePatientTab(activeKey);
  }, [
    actionVisitDate,
    activePatientTabKey,
    flags.runId,
    forceClosePatientTab,
    handleRefreshWithoutSummary,
    patientId,
    resolvedRunId,
    selectedEntry,
    storageScope,
  ]);

  const handleAfterFinish = useCallback(async () => {
    if (patientId && actionVisitDate) {
      upsertReceptionStatusOverride({
        date: actionVisitDate,
        patientId,
        status: '会計待ち',
        source: 'charts_finish',
        runId: resolvedRunId ?? flags.runId,
        scope: storageScope,
        fallbackEntry: selectedEntry
          ? {
              ...selectedEntry,
              patientId,
              visitDate: actionVisitDate,
            }
          : undefined,
      });
    }
    await handleRefreshWithoutSummary();
    const activeKey = activePatientTabKey;
    if (!activeKey) return;
    setDraftState((prev) => ({ ...prev, dirty: false, dirtySources: [] }));
    forceClosePatientTab(activeKey);
  }, [
    actionVisitDate,
    activePatientTabKey,
    flags.runId,
    forceClosePatientTab,
    handleRefreshWithoutSummary,
    patientId,
    resolvedRunId,
    selectedEntry,
    storageScope,
  ]);

  const saveOrderSetMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) {
        throw new Error('患者未選択のためオーダーセットを保存できません。');
      }
      const resolvedName = orderSetName.trim() || `${actionVisitDate} セット`;
      const diseaseResult = await fetchDiseases({
        patientId,
        from: actionVisitDate,
        to: actionVisitDate,
      });
      const snapshot: ChartOrderSetTemplateSnapshot = {
        diagnoses: diseaseResult.diseases ?? [],
        orderBundles: todayOrderBundlesForSet,
      };
      const hasPayload = snapshot.diagnoses.length > 0 || snapshot.orderBundles.length > 0;
      if (!hasPayload) {
        throw new Error('本日の病名・オーダーに保存対象がありません。');
      }

      const saved = saveChartOrderSet({
        facilityId: session.facilityId,
        userId: session.userId,
        name: resolvedName,
        snapshot,
      });

      return {
        saved,
        diseaseOk: diseaseResult.ok !== false && (diseaseResult.apiResult ? /^0+$/.test(diseaseResult.apiResult) : true),
      };
    },
    onSuccess: (result) => {
      refreshOrderSetEntries();
      setSelectedOrderSetId(result.saved.id);
      const snapshot = result.saved.snapshot;
      const warning = !result.diseaseOk ? '（病名取得で一部失敗あり）' : '';
      setOrderSetNotice({
        tone: 'success',
        message: `オーダーセットを保存しました${warning}。病名${snapshot.diagnoses.length}件 / オーダー${snapshot.orderBundles.length}件`,
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setOrderSetNotice({ tone: 'error', message: `オーダーセットの保存に失敗しました: ${message}` });
    },
  });

  const applyOrderSetMutation = useMutation({
    mutationFn: async (entry: ChartOrderSetEntry) => {
      if (!patientId) {
        throw new Error('患者未選択のためオーダーセットを適用できません。');
      }
      if (sidePanelMeta.readOnly) {
        throw new Error(sidePanelMeta.readOnlyReason ?? '読み取り専用のためオーダーセットを適用できません。');
      }

      const snapshot = entry.snapshot;
      const orderOperations = snapshot.orderBundles
        .filter((bundle) => bundle.entity && (bundle.items ?? []).some((item) => item.name?.trim()))
        .map((bundle) => ({
          operation: 'create' as const,
          entity: bundle.entity,
          bundleName: bundle.bundleName,
          classCode: bundle.classCode,
          className: bundle.className,
          startDate: actionVisitDate,
          items: (bundle.items ?? []).filter((item) => item.name?.trim()),
        }));

      const prescriptionOrderOperations = orderOperations.filter(
        (operation) => resolveOrderGroupKeyByEntity(operation.entity?.trim() ?? '') === 'prescription',
      );
      const nonPrescriptionOrderOperations = orderOperations.filter(
        (operation) => resolveOrderGroupKeyByEntity(operation.entity?.trim() ?? '') !== 'prescription',
      );

      if (prescriptionOrderOperations.length > 0) {
        const prescriptionResult = await mutatePrescriptionOrderBundles({
          patientId,
          operations: prescriptionOrderOperations,
        });
        if (!prescriptionResult.ok) {
          throw new Error(prescriptionResult.message ?? '処方登録に失敗しました。');
        }
      }

      if (nonPrescriptionOrderOperations.length > 0) {
        const orderResult = await mutateOrderBundles({
          patientId,
          operations: nonPrescriptionOrderOperations,
        });
        if (!orderResult.ok) {
          throw new Error(orderResult.message ?? 'オーダー登録に失敗しました。');
        }
      }

      const diseaseOperations = snapshot.diagnoses
        .filter((disease) => disease.diagnosisName?.trim())
        .map((disease) => ({
          operation: 'create' as const,
          diagnosisName: disease.diagnosisName,
          diagnosisCode: disease.diagnosisCode,
        }));

      if (diseaseOperations.length > 0) {
        const diseaseResult = await mutateDiseases({
          patientId,
          karteId: karteId!,
          operations: diseaseOperations,
        });
        if (!diseaseResult.ok) {
          throw new Error(diseaseResult.message ?? '病名登録に失敗しました。');
        }
      }

      return {
        orderCount: orderOperations.length,
        diseaseCount: diseaseOperations.length,
      };
    },
    onSuccess: ({ orderCount, diseaseCount }) => {
      queryClient.invalidateQueries({ queryKey: ['charts-order-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['charts-prescription-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['charts-diagnosis'] });
      setOrderSetNotice({
        tone: 'success',
        message: `オーダーセットを適用しました。病名${diseaseCount}件 / オーダー${orderCount}件`,
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setOrderSetNotice({ tone: 'error', message: `オーダーセットの適用に失敗しました: ${message}` });
    },
  });

  const utilityPanelTitles: Record<DockedUtilityAction, string> = {
    'order-set': 'セット / スタンプ',
    document: '文書',
    imaging: '画像',
  };
  const utilityItems = useMemo<
    Array<{ id: DockedUtilityAction; label: string; shortLabel: string; requiresEdit: boolean; shortcut: string }>
  >(
    () => {
      const base: Array<{ id: DockedUtilityAction; label: string; shortLabel: string; requiresEdit: boolean }> = [
        { id: 'order-set', label: 'セット/スタンプ', shortLabel: '★', requiresEdit: false },
        { id: 'document', label: '文書', shortLabel: '文', requiresEdit: true },
      ];
      if (isPatientImagesMvpEnabled) {
        base.push({ id: 'imaging', label: '画像', shortLabel: '画', requiresEdit: false });
      }
      return base.map((item, index) => ({
        ...item,
        shortcut: `Ctrl+Shift+${index + 1}`,
      }));
    },
    [isPatientImagesMvpEnabled],
  );
  const utilityShortcutItems = useMemo(
    () => utilityItems.map((item) => ({ keys: item.shortcut, label: item.label })),
    [utilityItems],
  );
  const shortcutGroups = useMemo(() => {
    const groups = [
      {
        title: '患者検索',
        items: [{ keys: 'Alt+P / Ctrl+F', label: '患者検索フィールドへフォーカス' }],
      },
      {
        title: '診療操作',
        items: [
          { keys: 'Alt+S', label: 'ORCA送信' },
          { keys: 'Alt+E', label: '診療終了' },
          { keys: 'Alt+I', label: '印刷' },
          { keys: 'Shift+Enter', label: 'ドラフト保存' },
        ],
      },
      {
        title: 'フォーカス移動',
        items: [
          {
            keys: 'Ctrl+Shift+← / →',
            label: 'セクションを順に巡回（フォーカスが次の位置へ移動）',
          },
        ],
        note: '移動順: Topbar → 患者概要 → ActionBar → 病名 → Past Hub → SOAP → オーダー → ORCA Summary → Telemetry',
      },
    ];
    if (showBottomUtilityDock) {
      groups.splice(2, 0, {
        title: 'ユーティリティ',
        items: [
          { keys: 'Ctrl+Shift+U', label: 'ユーティリティ開閉' },
          ...utilityShortcutItems,
          { keys: 'Esc', label: 'ユーティリティを閉じる' },
        ],
      });
    }
    return groups;
  }, [showBottomUtilityDock, utilityShortcutItems]);
  const utilityEditActions = useMemo(() => new Set(utilityItems.filter((item) => item.requiresEdit).map((item) => item.id)), [utilityItems]);
  const patientSelected = Boolean(encounterContext.patientId);
  const persistUtilityPanelLayout = useCallback(
    (layout: UtilityPanelLayout) => {
      writeUtilityPanelLayoutStorage(layout, storageScope);
    },
    [storageScope],
  );
  const updateUtilityPanelLayout = useCallback(
    (
      updater: UtilityPanelLayout | ((prev: UtilityPanelLayout) => UtilityPanelLayout),
      options?: { persist?: boolean },
    ) => {
      if (typeof window === 'undefined') return;
      const nextLayout = clampUtilityPanelLayout(
        typeof updater === 'function' ? updater(utilityPanelLayoutRef.current) : updater,
        window.innerWidth,
        window.innerHeight,
      );
      utilityPanelLayoutRef.current = nextLayout;
      setUtilityPanelLayout(nextLayout);
      if (options?.persist ?? true) {
        persistUtilityPanelLayout(nextLayout);
      }
    },
    [persistUtilityPanelLayout],
  );
  const beginUtilityPanelResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !utilityPanelAction) return;
      event.preventDefault();
      event.stopPropagation();
      setIsUtilityPanelResizing(true);
      utilityPanelResizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: utilityPanelLayoutRef.current,
      };
    },
    [utilityPanelAction],
  );

  const beginUtilityPanelMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !utilityPanelAction) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea, a, [role="tab"]')) return;
      event.preventDefault();
      setIsUtilityPanelDragging(true);
      utilityPanelMoveRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: utilityPanelLayoutRef.current,
      };
    },
    [utilityPanelAction],
  );

  const resolveUtilityTrigger = useCallback((action: DockedUtilityAction) => {
    if (typeof document === 'undefined') return null;
    return document.querySelector<HTMLButtonElement>(`[data-utility-action="${action}"]`);
  }, []);

  const canOpenUtilityAction = useCallback(
    (action: DockedUtilityAction) => {
      if (!utilityEditActions.has(action)) return true;
      if (!patientSelected) return false;
      if (sidePanelMeta.readOnly) return false;
      return true;
    },
    [patientSelected, sidePanelMeta.readOnly, utilityEditActions],
  );

  const resolveUtilityLeaveReason = useCallback(
    (action: DockedUtilityAction | null) => {
      if (!action) return null;
      if (action === 'document' && documentUtilityState.dirty) {
        return '文書に未保存の入力があります。閉じると破棄されます。';
      }
      if (action === 'imaging' && (imageUtilityState.uploadingCount > 0 || imageUtilityState.queueCount > 0)) {
        return '画像のアップロード処理中です。閉じると進捗確認ができなくなります。';
      }
      return null;
    },
    [documentUtilityState.dirty, imageUtilityState.queueCount, imageUtilityState.uploadingCount],
  );

  const discardUtilityDraftIfNeeded = useCallback(
    (action: DockedUtilityAction | null) => {
      if (action !== 'document') return;
      clearDocumentAttachments();
      setDocumentUtilityState({
        dirty: false,
        attachmentCount: 0,
        isSaving: false,
        hasError: false,
      });
    },
    [clearDocumentAttachments],
  );

  const openUtilityPanel = useCallback(
    (action: DockedUtilityAction, trigger?: HTMLButtonElement | null) => {
      if (!canOpenUtilityAction(action)) return;
      const currentAction = utilityPanelActionRef.current;
      if (currentAction && currentAction !== action) {
        const reason = resolveUtilityLeaveReason(currentAction);
        if (reason) {
          setUtilityCloseGuard({
            open: true,
            trigger: 'switch',
            reason,
            nextAction: action,
          });
          return;
        }
      }
      utilityLastActionRef.current = action;
      utilityTriggerRef.current = trigger ?? resolveUtilityTrigger(action) ?? utilityTriggerRef.current;
      setUtilityPanelAction(action);
    },
    [canOpenUtilityAction, resolveUtilityLeaveReason, resolveUtilityTrigger],
  );

  const createCopyRequestId = useCallback(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const canDoFromPast = useMemo(() => {
    if (!patientSelected) return { ok: false, reason: '患者が未選択のためDoできません。' };
    if (sidePanelMeta.readOnly) {
      return { ok: false, reason: sidePanelMeta.readOnlyReason ?? '閲覧専用のためDoできません。' };
    }
    if (sidePanelMeta.missingMaster) return { ok: false, reason: 'マスター未同期のためDoできません。' };
    if (sidePanelMeta.fallbackUsed) return { ok: false, reason: 'フォールバックデータのためDoできません。' };
    return { ok: true, reason: undefined };
  }, [
    patientSelected,
    sidePanelMeta.fallbackUsed,
    sidePanelMeta.missingMaster,
    sidePanelMeta.readOnly,
    sidePanelMeta.readOnlyReason,
  ]);

  const openOrderEditor = useCallback(
    (entity: PastOrderEntity) => {
      if (!canDoFromPast.ok) return;
      const requestId = createCopyRequestId();
      setOrderDockOpenRequest({ requestId, entity });
      // Close the utility panel if it was used as an entry point (legacy flow).
      setUtilityPanelAction(null);
      if (typeof document === 'undefined') return;
      requestAnimationFrame(() => {
        const el = document.getElementById('charts-order-pane');
        if (el && typeof (el as any).focus === 'function') (el as HTMLElement).focus();
      });
    },
    [canDoFromPast.ok, createCopyRequestId],
  );

  const closeUtilityPanel = useCallback(
    (restoreFocus: boolean) => {
      const currentAction = utilityPanelActionRef.current;
      const reason = resolveUtilityLeaveReason(currentAction);
      if (reason) {
        setUtilityCloseGuard({
          open: true,
          trigger: 'close',
          reason,
        });
        return;
      }
      if (restoreFocus) {
        utilityFocusRestoreRef.current = true;
      }
      setUtilityPanelAction(null);
    },
    [resolveUtilityLeaveReason],
  );

  const handleConfirmUtilityCloseGuard = useCallback(() => {
    const guard = utilityCloseGuard;
    if (!guard) return;
    const currentAction = utilityPanelActionRef.current;
    discardUtilityDraftIfNeeded(currentAction);
    setUtilityCloseGuard(null);
    if (guard.trigger === 'switch' && guard.nextAction) {
      utilityLastActionRef.current = guard.nextAction;
      setUtilityPanelAction(guard.nextAction);
      return;
    }
    utilityFocusRestoreRef.current = true;
    setUtilityPanelAction(null);
  }, [discardUtilityDraftIfNeeded, utilityCloseGuard]);

  const handleCancelUtilityCloseGuard = useCallback(() => {
    setUtilityCloseGuard(null);
    const target = utilityTriggerRef.current;
    if (target && target.isConnected) {
      requestAnimationFrame(() => target.focus());
    }
  }, []);

  const handlePastOrderDo = useCallback(
    (payload: { entity: PastOrderEntity; bundle: OrderBundle }) => {
      if (!canDoFromPast.ok) return;
      const requestId = createCopyRequestId();
      setOrderHistoryCopyRequest({ requestId, entity: payload.entity, bundle: payload.bundle });
      openOrderEditor(payload.entity);
    },
    [canDoFromPast.ok, createCopyRequestId, openOrderEditor],
  );

  const handlePastDocumentDo = useCallback(
    (payload: { letter: LetterModulePayload }) => {
      if (!canDoFromPast.ok) return;
      const letterId = payload.letter.id;
      if (!letterId) return;
      const requestId = createCopyRequestId();
      setDocumentDockOpenRequest({ requestId, source: 'past-hub' });
      setDocumentHistoryCopyRequest({ requestId, letterId });
      setUtilityPanelAction(null);
      if (typeof document !== 'undefined') {
        requestAnimationFrame(() => {
          const target = document.getElementById('charts-soap-note');
          if (target && typeof (target as any).focus === 'function') {
            (target as HTMLElement).focus();
          }
        });
      }
    },
    [canDoFromPast.ok, createCopyRequestId],
  );

  const handleOrderHistoryCopyConsumed = useCallback((requestId: string) => {
    setOrderHistoryCopyRequest((prev) => (prev?.requestId === requestId ? null : prev));
  }, []);

  const handleOrderDockOpenConsumed = useCallback((requestId: string) => {
    setOrderDockOpenRequest((prev) => (prev?.requestId === requestId ? null : prev));
  }, []);

  const handleDocumentDockOpenConsumed = useCallback((requestId: string) => {
    setDocumentDockOpenRequest((prev) => (prev?.requestId === requestId ? null : prev));
  }, []);

  const handleDocumentHistoryCopyConsumed = useCallback((requestId: string) => {
    setDocumentHistoryCopyRequest((prev) => (prev?.requestId === requestId ? null : prev));
  }, []);

  const resetDocumentPanelState = useCallback(() => {
    clearDocumentAttachments();
    setDocumentUtilityState({
      dirty: false,
      attachmentCount: 0,
      isSaving: false,
      hasError: false,
    });
  }, [clearDocumentAttachments]);

  const handleDocumentPanelClose = useCallback(() => {
    resetDocumentPanelState();
    setDocumentDockOpenRequest(null);
    setDocumentHistoryCopyRequest(null);
  }, [resetDocumentPanelState]);

  const documentPanel = useMemo<ReactNode>(
    () => (
      <DocumentCreatePanel
        patientId={encounterContext.patientId}
        meta={sidePanelMeta}
        imageAttachments={documentImageAttachments}
        onImageAttachmentsChange={setDocumentImageAttachments}
        onImageAttachmentsClear={clearDocumentAttachments}
        historyCopyRequest={documentHistoryCopyRequest}
        onHistoryCopyConsumed={handleDocumentHistoryCopyConsumed}
        onStateChange={setDocumentUtilityState}
        onClose={handleDocumentPanelClose}
      />
    ),
    [
      clearDocumentAttachments,
      documentHistoryCopyRequest,
      documentImageAttachments,
      encounterContext.patientId,
      handleDocumentHistoryCopyConsumed,
      handleDocumentPanelClose,
      sidePanelMeta,
    ],
  );

  const handleLockChange = useCallback((locked: boolean, reason?: string) => {
    setLockState({ locked, reason });
  }, []);

  const handleUtilityButtonClick = useCallback(
    (action: DockedUtilityAction, trigger: HTMLButtonElement) => {
      utilityTriggerRef.current = trigger;
      if (utilityPanelActionRef.current === action) {
        closeUtilityPanel(true);
        return;
      }
      openUtilityPanel(action, trigger);
    },
    [closeUtilityPanel, openUtilityPanel],
  );

  useEffect(() => {
    utilityPanelActionRef.current = utilityPanelAction;
  }, [utilityPanelAction]);

  useEffect(() => {
    utilityPanelLayoutRef.current = utilityPanelLayout;
  }, [utilityPanelLayout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLayout = readUtilityPanelLayoutStorage(storageScope);
    if (storedLayout) {
      updateUtilityPanelLayout(storedLayout, { persist: false });
      return;
    }
    updateUtilityPanelLayout(buildDefaultUtilityPanelLayout(window.innerWidth, window.innerHeight), { persist: false });
  }, [storageScope, updateUtilityPanelLayout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      updateUtilityPanelLayout((prev) => clampUtilityPanelLayout(prev, window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateUtilityPanelLayout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = utilityPanelResizeRef.current;
      if (resizeState && event.pointerId === resizeState.pointerId) {
        const deltaX = event.clientX - resizeState.startX;
        const deltaY = event.clientY - resizeState.startY;
        const nextLayout = {
          ...resizeState.startLayout,
          width: resizeState.startLayout.width + deltaX,
          height: resizeState.startLayout.height + deltaY,
        };
        updateUtilityPanelLayout(nextLayout, { persist: false });
        return;
      }

      const moveState = utilityPanelMoveRef.current;
      if (!moveState || event.pointerId !== moveState.pointerId) return;
      const deltaX = event.clientX - moveState.startX;
      const deltaY = event.clientY - moveState.startY;
      const nextLayout = {
        ...moveState.startLayout,
        left: moveState.startLayout.left + deltaX,
        top: moveState.startLayout.top + deltaY,
      };
      updateUtilityPanelLayout(nextLayout, { persist: false });
    };
    const handlePointerEnd = (event: PointerEvent) => {
      const resizeState = utilityPanelResizeRef.current;
      if (resizeState && event.pointerId === resizeState.pointerId) {
        utilityPanelResizeRef.current = null;
        setIsUtilityPanelResizing(false);
        persistUtilityPanelLayout(utilityPanelLayoutRef.current);
        return;
      }
      const moveState = utilityPanelMoveRef.current;
      if (!moveState || event.pointerId !== moveState.pointerId) return;
      utilityPanelMoveRef.current = null;
      setIsUtilityPanelDragging(false);
      persistUtilityPanelLayout(utilityPanelLayoutRef.current);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [persistUtilityPanelLayout, updateUtilityPanelLayout]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (utilityPanelAction) {
      requestAnimationFrame(() => {
        const content = document.querySelector('[data-docked-panel-content="true"]');
        const focusable =
          content?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ) ?? utilityHeadingRef.current;
        focusable?.focus();
      });
      return;
    }
    if (utilityFocusRestoreRef.current) {
      requestAnimationFrame(() => {
        utilityTriggerRef.current?.focus();
      });
    }
    utilityFocusRestoreRef.current = false;
  }, [utilityPanelAction]);

  useEffect(() => {
    if (utilityPanelAction) return;
    setIsUtilityPanelDragging(false);
    setIsUtilityPanelResizing(false);
  }, [utilityPanelAction]);

  const prevPatientIdRef = useRef<string | undefined>(encounterContext.patientId);
  useEffect(() => {
    if (prevPatientIdRef.current === encounterContext.patientId) return;
    prevPatientIdRef.current = encounterContext.patientId;
    setUtilityPanelAction(null);
    setUtilityCloseGuard(null);
    setOrderSetSubtab('set');
    setOrderHistoryCopyRequest(null);
    setDocumentDockOpenRequest(null);
    setDocumentHistoryCopyRequest(null);
    setDocumentUtilityState({
      dirty: false,
      attachmentCount: 0,
      isSaving: false,
      hasError: false,
    });
    setImageUtilityState({
      queueCount: 0,
      uploadingCount: 0,
      hasError: false,
    });
    utilityFocusRestoreRef.current = false;
    utilityLastActionRef.current = 'order-set';
    if (showBottomUtilityDock) {
      requestAnimationFrame(() => {
        resolveUtilityTrigger('order-set')?.focus();
      });
    }
  }, [encounterContext.patientId, resolveUtilityTrigger, showBottomUtilityDock]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shouldIgnore = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };
    const focusById = (id: string) => {
      const el = document.getElementById(id) as HTMLElement | null;
      if (!el) return false;
      el.focus();
      return true;
    };
    const clickById = (id: string) => {
      const el = document.getElementById(id) as HTMLButtonElement | null;
      if (!el) return false;
      el.click();
      return true;
    };
    const dockedShortcutActions = utilityItems.map((item) => item.id);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey) return;

      const key = event.key.toLowerCase();

      if (key === 'escape' && utilityPanelActionRef.current) {
        event.preventDefault();
        closeUtilityPanel(true);
        return;
      }

      // Patient search: Alt+P / Ctrl+F
      if (!shouldIgnore(event.target) && event.altKey && !event.ctrlKey && key === 'p') {
        event.preventDefault();
        focusRestoreRef.current = document.activeElement as HTMLElement | null;
        if (!focusById('charts-patient-search')) {
          setIsPatientPanelOpen(true);
          requestAnimationFrame(() => requestAnimationFrame(() => focusById('charts-patient-search')));
        }
        return;
      }
      if (!shouldIgnore(event.target) && event.ctrlKey && !event.altKey && key === 'f') {
        event.preventDefault();
        focusRestoreRef.current = document.activeElement as HTMLElement | null;
        if (!focusById('charts-patient-search')) {
          setIsPatientPanelOpen(true);
          requestAnimationFrame(() => requestAnimationFrame(() => focusById('charts-patient-search')));
        }
        return;
      }

      // Action shortcuts
      if (!shouldIgnore(event.target) && event.altKey && !event.ctrlKey && key === 's') {
        event.preventDefault();
        clickById('charts-action-send');
        return;
      }
      if (!shouldIgnore(event.target) && event.altKey && !event.ctrlKey && key === 'i') {
        event.preventDefault();
        clickById('charts-action-print');
        return;
      }
      if (!shouldIgnore(event.target) && event.altKey && !event.ctrlKey && key === 'e') {
        event.preventDefault();
        clickById('charts-action-finish');
        return;
      }
      if (!shouldIgnore(event.target) && event.shiftKey && !event.altKey && !event.ctrlKey && key === 'enter') {
        event.preventDefault();
        clickById('charts-action-draft');
        return;
      }

      if (showBottomUtilityDock && !shouldIgnore(event.target) && event.ctrlKey && event.shiftKey && key === 'u') {
        event.preventDefault();
        if (utilityPanelActionRef.current) {
          closeUtilityPanel(true);
          return;
        }
        openUtilityPanel(utilityLastActionRef.current ?? 'order-set');
        return;
      }

      if (showBottomUtilityDock && !shouldIgnore(event.target) && event.ctrlKey && event.shiftKey && /^[1-9]$/.test(key)) {
        event.preventDefault();
        const action = dockedShortcutActions[Number(key) - 1];
        if (action) {
          openUtilityPanel(action);
        }
        return;
      }

      // Section navigation: Ctrl+Shift+Left/Right
      if (!shouldIgnore(event.target) && event.ctrlKey && event.shiftKey && (key === 'arrowright' || key === 'arrowleft')) {
        event.preventDefault();
        const anchors = [
          'charts-topbar',
          'charts-patient-summary',
          'charts-actionbar',
          'charts-diagnosis',
          'charts-past-hub',
          'charts-soap-note',
          'charts-order-pane',
          'charts-orca-summary',
          'charts-telemetry',
        ];
        const active = document.activeElement as HTMLElement | null;
        const current = active?.closest?.('[data-focus-anchor="true"]') as HTMLElement | null;
        const currentId = current?.id ?? active?.id ?? '';
        const currentIdx = Math.max(0, anchors.indexOf(currentId));
        const delta = key === 'arrowright' ? 1 : -1;
        const nextIdx = (currentIdx + delta + anchors.length) % anchors.length;
        focusById(anchors[nextIdx]);
        return;
      }
    };
	    window.addEventListener('keydown', handleKeyDown);
	    return () => window.removeEventListener('keydown', handleKeyDown);
	  }, [closeUtilityPanel, openUtilityPanel, showBottomUtilityDock, utilityItems]);

	  const activeUtilityKind = useMemo(() => resolveUtilityVisualKind(utilityPanelAction), [utilityPanelAction]);
	  const utilityPanelInlineStyle = useMemo(() => {
	    return {
      '--charts-utility-expanded-width': `${utilityPanelLayout.width}px`,
      '--charts-utility-expanded-height': `${utilityPanelLayout.height}px`,
      '--charts-utility-left': `${utilityPanelLayout.left}px`,
      '--charts-utility-top': `${utilityPanelLayout.top}px`,
    } as CSSProperties;
  }, [utilityPanelLayout.height, utilityPanelLayout.left, utilityPanelLayout.top, utilityPanelLayout.width]);

  return (
    <>
      <a className="skip-link" href="#charts-main" data-test-id="charts-skip-main">
        本文へスキップ
      </a>
      <DoCopyDialog
        state={doCopyDialog}
        onApply={handleDoCopyApply}
        onUndo={handleDoCopyUndo}
        onClose={closeDoCopyDialog}
      />
      {showBottomUtilityDock ? (
        <FocusTrapDialog
          open={Boolean(utilityCloseGuard?.open)}
          title="作業中の内容があります"
          description="未完了の作業を破棄して続行するか、キャンセルするかを選択してください。"
          onClose={handleCancelUtilityCloseGuard}
          testId="charts-utility-close-guard-dialog"
        >
          <section className="charts-tab-guard" aria-label="ユーティリティ操作確認">
            <p className="charts-tab-guard__message">{utilityCloseGuard?.reason ?? '未保存の作業があります。'}</p>
            <div className="charts-tab-guard__actions" role="group" aria-label="ユーティリティ操作選択">
              <button type="button" onClick={handleConfirmUtilityCloseGuard}>
                {utilityCloseGuard?.trigger === 'switch' ? '破棄して切替' : '破棄して閉じる'}
              </button>
              <button type="button" className="charts-side-panel__ghost" onClick={handleCancelUtilityCloseGuard}>
                キャンセル
              </button>
            </div>
          </section>
        </FocusTrapDialog>
      ) : null}
      <FocusTrapDialog
        open={isPatientPanelOpen}
        title="患者・受付"
        description="患者選択/受付履歴/監査/Patients連携をまとめて確認します。"
        onClose={() => setIsPatientPanelOpen(false)}
        testId="charts-patient-panel-dialog"
      >
        <div className="charts-patient-panel">
          <div className="charts-patient-panel__actions" role="group" aria-label="患者パネル操作">
            <button type="button" onClick={() => setIsPatientPanelOpen(false)}>
              閉じる
            </button>
            <button type="button" onClick={handleOpenReception}>
              Receptionへ
            </button>
          </div>
          <PatientsTab
            entries={patientEntries}
            listFetchedAt={appointmentMeta?.fetchedAt}
            onRefetchList={() => appointmentQuery.refetch()}
            isRefetchingList={appointmentQuery.isFetching && !appointmentQuery.isLoading && !appointmentQuery.isFetchingNextPage}
            hasNextPage={hasNextAppointments}
            onLoadMore={() => appointmentQuery.fetchNextPage()}
            isLoadingMore={appointmentQuery.isFetchingNextPage}
            appointmentBanner={appointmentBanner}
            auditEvent={latestAuditEvent as Record<string, unknown> | undefined}
            selectedContext={encounterContext}
            receptionCarryover={receptionCarryover}
            draftDirty={draftState.dirty}
            draftDirtySources={draftState.dirtySources ?? []}
            switchLocked={switchLocked}
            switchLockedReason={switchLockedReason}
            onRequestRestoreFocus={() => {
              const el = focusRestoreRef.current;
              if (el && typeof el.focus === 'function') el.focus();
            }}
            onDraftDirtyChange={(next) => setDraftState(next)}
            onSelectEncounter={(next) => {
              if (!next) return;
              suppressUrlContextSyncRef.current = true;
              setEncounterContext((prev) => {
                const merged = normalizeEncounterContext({
                  ...prev,
                  ...next,
                  visitDate: normalizeVisitDate(next.visitDate) ?? normalizeVisitDate(prev.visitDate) ?? today,
                });
                return sameEncounterContext(prev, merged) ? prev : merged;
              });
              setContextAlert(null);
            }}
          />
        </div>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={isShortcutsDialogOpen}
        title="ショートカット一覧"
        description="主要ショートカットとフォーカス移動を一覧できます。"
        onClose={() => setIsShortcutsDialogOpen(false)}
        testId="charts-shortcuts-dialog"
      >
        <section className="charts-shortcuts charts-shortcuts--dialog" aria-label="キーボードショートカット一覧">
          <div className="charts-shortcuts__groups" role="list">
            {shortcutGroups.map((group) => (
              <div key={group.title} className="charts-shortcuts__group" role="listitem">
                <span className="charts-shortcuts__group-title">{group.title}</span>
                <ul className="charts-shortcuts__items">
                  {group.items.map((item) => (
                    <li key={`${group.title}-${item.keys}`}>
                      <span className="charts-shortcuts__keys">{item.keys}</span>
                      <span className="charts-shortcuts__label">{item.label}</span>
                    </li>
                  ))}
                </ul>
                {group.note ? <p className="charts-shortcuts__note">{group.note}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={reloadGuardOpen}
        title="未保存の変更があります"
        description="更新すると未保存の内容は破棄されます。"
        onClose={handleCancelReloadGuard}
        testId="charts-reload-guard-dialog"
      >
        <section className="charts-tab-guard" aria-label="カルテ更新の未保存確認">
          <div className="charts-tab-guard__actions" role="group" aria-label="カルテ更新操作">
            <button type="button" onClick={handleCancelReloadGuard}>
              キャンセル
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={handleConfirmReloadGuard}>
              破棄して更新
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={Boolean(tabGuard)}
        title="未保存の入力があります"
        description="患者切替・タブ操作の前に、保存して続行するか、破棄して続行するか、キャンセルするかを選択してください。"
        onClose={handleTabGuardCancel}
        testId="charts-tab-guard-dialog"
      >
        <section className="charts-tab-guard" aria-label="未保存ドラフト確認">
          <p className="charts-tab-guard__message">
            未保存の入力があります。続行方法を選択してください。
          </p>
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>現在の患者</dt>
              <dd>{tabGuard?.patientName ?? '—'}</dd>
            </div>
            <div>
              <dt>患者ID</dt>
              <dd>{tabGuard?.patientId ?? '—'}</dd>
            </div>
            <div>
              <dt>診療日</dt>
              <dd>{tabGuard?.visitDate ?? '—'}</dd>
            </div>
            {tabGuard?.targetLabel ? (
              <div>
                <dt>{tabGuard.action === 'switch' ? '切替先' : '対象タブ'}</dt>
                <dd>{tabGuard.targetLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>未保存要因</dt>
              <dd>
                {tabGuard && tabGuard.dirtySources.length > 0
                  ? tabGuard.dirtySources.join(' / ')
                  : !soapSyncState.serverSynced
                    ? 'SOAPサーバ未反映'
                    : soapSyncState.isSaving
                      ? 'SOAP保存中'
                      : 'SOAP未保存'}
              </dd>
            </div>
          </dl>
          {tabGuard?.saveError ? <p className="charts-tab-guard__message">{tabGuard.saveError}</p> : null}
          <div className="charts-tab-guard__actions" role="group" aria-label="未保存ドラフト操作">
            <button type="button" onClick={() => void handleTabGuardChoice('cancel')}>
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => void handleTabGuardChoice('save')}
              disabled={!tabGuard?.canSave || soapSyncState.isSaving}
            >
              保存して{tabGuard?.action === 'switch' ? '切替' : '閉じる'}
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={() => void handleTabGuardChoice('discard')}>
              破棄して{tabGuard?.action === 'switch' ? '切替' : '閉じる'}
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={Boolean(encounterExitGuard)}
        role="alertdialog"
        title={encounterExitGuard?.action === 'finish' ? '診察終了の確認' : '診察中断の確認'}
        description="未保存入力があります。保存して続行するか、破棄して続行するかを選択してください。"
        onClose={() => handleEncounterExitChoice('cancel')}
        testId="charts-encounter-exit-guard-dialog"
      >
        <section className="charts-tab-guard" aria-label="診察終了/中断の未保存確認">
          <p className="charts-tab-guard__message">SOAP等の未保存入力があります。続行方法を選択してください。</p>
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>患者名</dt>
              <dd>{encounterExitGuard?.patientName ?? '—'}</dd>
            </div>
            <div>
              <dt>患者ID</dt>
              <dd>{encounterExitGuard?.patientId ?? '—'}</dd>
            </div>
            <div>
              <dt>診療日</dt>
              <dd>{encounterExitGuard?.visitDate ?? '—'}</dd>
            </div>
            <div>
              <dt>受付ID / 予約ID</dt>
              <dd>{encounterExitGuard?.receptionId ?? '—'} / {encounterExitGuard?.appointmentId ?? '—'}</dd>
            </div>
            <div>
              <dt>未保存要因</dt>
              <dd>
                {encounterExitGuard && encounterExitGuard.dirtySources.length > 0
                  ? encounterExitGuard.dirtySources.join(' / ')
                  : !soapSyncState.serverSynced
                    ? 'SOAPサーバ未反映'
                    : soapSyncState.isSaving
                      ? 'SOAP保存中'
                      : 'SOAP未保存'}
              </dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="診察終了/中断の選択">
            <button type="button" onClick={() => handleEncounterExitChoice('cancel')}>
              キャンセル
            </button>
            <button type="button" onClick={() => handleEncounterExitChoice('save')}>
              保存して{encounterExitGuard?.action === 'finish' ? '終了' : '中断'}
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={() => handleEncounterExitChoice('discard')}>
              保存せず{encounterExitGuard?.action === 'finish' ? '終了' : '中断'}
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <main
        id="charts-main"
        tabIndex={-1}
        className="charts-page"
        data-run-id={resolvedRunId}
        data-trace-id={resolvedTraceId ?? undefined}
        data-charts-ui-opt-b={isChartsUiOptB ? '1' : '0'}
        data-charts-compact-header={isChartsCompactHeader ? '1' : '0'}
        data-charts-topbar-collapsed={isTopbarCollapsed ? '1' : '0'}
        data-patient-tabs-visible={showPatientTabs ? '1' : '0'}
        aria-busy={lockState.locked}
      >
      {showOperationalMeta ? (
        <header
          className="charts-page__header"
          id="charts-topbar"
          tabIndex={-1}
          data-focus-anchor="true"
          data-topbar-collapsed={isTopbarCollapsed ? '1' : '0'}
        >
          <div className="charts-page__header-toprow">
            <h1>診療記録デバッグ情報</h1>
            <button
              type="button"
              className="charts-topbar__toggle"
              aria-controls="charts-topbar-details"
              aria-expanded={!isTopbarCollapsed}
              onClick={() => setIsTopbarCollapsed((prev) => !prev)}
            >
              {isTopbarCollapsed ? '概要を開く' : '概要を閉じる'}
            </button>
          </div>
          <div id="charts-topbar-details" hidden={isTopbarCollapsed}>
            <div
              className="charts-page__meta-grid"
              role="status"
              aria-live="off"
              data-test-id="charts-topbar-meta"
              data-run-id={resolvedRunId}
              data-trace-id={resolvedTraceId ?? undefined}
              data-source-transition={resolvedTransition}
              data-missing-master={String(resolvedMissingMaster)}
              data-cache-hit={String(resolvedCacheHit)}
              data-fallback-used={String(resolvedFallbackUsed)}
            >
              <section className="charts-page__meta-group" aria-label="RUN_ID と flags">
                <span className="charts-page__meta-title">
                  RUN_ID / dataSourceTransition / missingMaster / cacheHit / fallbackUsed
                </span>
                <div className="charts-page__meta-row">
                  <RunIdBadge runId={resolvedRunId} className="charts-page__pill" />
                  <StatusPill
                    className="charts-page__pill"
                    label="dataSourceTransition"
                    value={resolvedTransition}
                    tone={resolveTransitionTone()}
                  />
                  <StatusPill
                    className="charts-page__pill"
                    label="missingMaster"
                    value={String(resolvedMissingMaster)}
                    tone={resolveMetaFlagTone(resolvedMissingMaster)}
                  />
                  <StatusPill
                    className="charts-page__pill"
                    label="cacheHit"
                    value={String(resolvedCacheHit)}
                    tone={resolveCacheHitTone(resolvedCacheHit)}
                  />
                  <StatusPill
                    className="charts-page__pill"
                    label="fallbackUsed"
                    value={String(resolvedFallbackUsed)}
                    tone={resolveMetaFlagTone(resolvedFallbackUsed)}
                  />
                </div>
              </section>
              <section className="charts-page__meta-group" aria-label="監査サマリ">
                <span className="charts-page__meta-title">監査サマリ</span>
                <div className="charts-page__meta-row">
                  {editStateMeta ? (
                    <StatusPill
                      className="charts-page__pill"
                      label="編集状態"
                      value={editStateMeta.value}
                      tone={editStateMeta.tone}
                    />
                  ) : null}
                  <AuditSummaryInline
                    summary={lastUpdatedSummary}
                    className="charts-page__pill"
                    variant="inline"
                    label="監査サマリ"
                    runId={resolvedRunId}
                  />
                </div>
              </section>
              <section className="charts-page__meta-group" aria-label="配信ステータス">
                <span className="charts-page__meta-title">配信ステータス</span>
                <div className="charts-page__meta-row">
                  <StatusPill
                    className="charts-page__pill"
                    label="Charts master（配信設定）"
                    value={chartsMasterSourcePolicy}
                    tone="info"
                  />
                  <StatusPill
                    className="charts-page__pill"
                    label="Charts送信（配信ポリシー）"
                    value={sendAllowedByDelivery ? 'enabled' : 'disabled'}
                    tone={sendAllowedByDelivery ? 'success' : 'warning'}
                  />
                  <StatusPill
                    className="charts-page__pill"
                    label="ETag"
                    value={
                      adminConfigQuery.data?.deliveryEtag ??
                      adminConfigQuery.data?.deliveryVersion ??
                      adminConfigQuery.data?.deliveryId ??
                      '―'
                    }
                    tone="neutral"
                  />
                  <StatusPill className="charts-page__pill" label="適用先" value={`${session.facilityId}:${session.userId}`} tone="info" />
                </div>
              </section>
            </div>
          </div>
        </header>
      ) : (
        <div
          className="charts-focus-anchor"
          id="charts-topbar"
          tabIndex={-1}
          data-focus-anchor="true"
          aria-hidden="true"
        />
      )}
      <AdminBroadcastBanner broadcast={broadcast} surface="charts" runId={resolvedRunId ?? flags.runId} />
      {contextAlert ? (
        <ToneBanner
          tone={contextAlert.tone}
          message={contextAlert.message}
          destination="Charts"
          nextAction="必要なら Reception で再選択"
          runId={flags.runId}
        />
      ) : null}
      {orcaRecoveryAlert ? (
        <ToneBanner
          tone={orcaRecoveryAlert.tone}
          message={orcaRecoveryAlert.message}
          destination="ORCA連携"
          nextAction="患者情報または ORCA 認証 / プロキシ設定を確認"
          runId={resolvedRunId ?? flags.runId}
          ariaLive={resolveAriaLive(orcaRecoveryAlert.tone, 'assertive')}
        />
      ) : null}
      {editLockAlert ? (
        <ToneBanner
          tone={editLockAlert.tone}
          message={editLockAlert.message}
          destination="Charts"
          nextAction="別タブを閉じる / 最新を再読込 / 強制引き継ぎ"
          runId={resolvedRunId ?? flags.runId}
          ariaLive={resolveAriaLive(editLockAlert.tone, editLockAlert.ariaLive)}
        />
      ) : null}
      {deliveryImpactBanner ? (
        <ToneBanner
          tone={deliveryImpactBanner.tone}
          message={deliveryImpactBanner.message}
          destination="Charts"
          nextAction="再取得/リロードで反映"
          runId={adminConfigQuery.data?.runId ?? broadcast?.runId ?? flags.runId}
          ariaLive="assertive"
        />
      ) : null}

      {!chartsDisplayEnabled ? (
        <ToneBanner
          tone="warning"
          message="Charts の表示が管理配信で disabled です。Administration で再度 enabled にして配信してください。"
          destination="Charts"
          nextAction="Administration で再配信"
          runId={adminConfigQuery.data?.runId ?? broadcast?.runId ?? flags.runId}
        />
      ) : null}

      {showOperationalMeta && deliveryAppliedMeta && (!isChartsCompactHeader || !isTopbarCollapsed) ? (
        <section className="charts-card" aria-label="管理配信の適用メタ">
          <h2>管理配信（適用メタ）</h2>
          <div className="charts-page__meta" aria-live={infoLive}>
            <StatusPill className="charts-page__pill" label="適用時刻" value={deliveryAppliedMeta.appliedAt} tone="info" />
            <StatusPill className="charts-page__pill" label="適用ユーザー" value={deliveryAppliedMeta.appliedTo} tone="info" />
            <StatusPill className="charts-page__pill" label="role" value={deliveryAppliedMeta.role} tone="info" />
            <StatusPill className="charts-page__pill" label="配信runId" value={deliveryAppliedMeta.runId ?? '―'} tone="info" />
            <StatusPill className="charts-page__pill" label="deliveredAt" value={deliveryAppliedMeta.deliveredAt ?? '―'} tone="info" />
            <StatusPill className="charts-page__pill" label="deliveryId" value={deliveryAppliedMeta.deliveryId ?? '―'} tone="info" />
            <StatusPill className="charts-page__pill" label="deliveryVersion" value={deliveryAppliedMeta.deliveryVersion ?? '―'} tone="info" />
            <StatusPill
              className="charts-page__pill"
              label="ETag"
              value={deliveryAppliedMeta.deliveryEtag ?? deliveryAppliedMeta.deliveryVersion ?? '―'}
              tone="info"
            />
            <StatusPill
              className="charts-page__pill"
              label="config"
              value="single-source"
              tone="info"
            />
          </div>
        </section>
      ) : null}

      {!chartsDisplayEnabled ? null : (
        <>
          <section
            className="charts-workbench"
            aria-label="外来カルテ作業台"
            data-run-id={resolvedRunId ?? flags.runId}
            data-utility-state={showBottomUtilityDock && utilityPanelAction ? 'expanded' : 'compact'}
            data-charts-compact-ui={isChartsCompactUi ? '1' : '0'}
            style={utilityPanelInlineStyle}
          >
            <div className="charts-workbench__sticky">
                <div className="charts-workbench__sticky-grid">
                <div className="charts-encounter-header" aria-label="患者情報と診療操作">
                  <div
                    className="charts-card charts-card--summary charts-card--summary-with-actions"
                    id="charts-patient-summary"
                    tabIndex={-1}
                    data-focus-anchor="true"
                  >
                    <ChartsPatientSummaryBar
                      patientDisplay={patientDisplay}
                      patientId={patientId}
                      runId={resolvedRunId ?? flags.runId}
                      missingMaster={resolvedMissingMaster}
                      fallbackUsed={resolvedFallbackUsed}
                      cacheHit={resolvedCacheHit}
                      dataSourceTransition={resolvedTransition}
                      onStartEncounter={() => {
                        void chartsActionBarRef.current?.start();
                      }}
                      onFinishEncounter={() => {
                        void chartsActionBarRef.current?.finish();
                      }}
                      onPauseEncounter={() => {
                        void chartsActionBarRef.current?.pause();
                      }}
                      onCloseChart={() => {
                        if (!activePatientTabKey) return;
                        requestClosePatientTab(activePatientTabKey);
                      }}
                      onReloadChart={requestReload}
                      encounterActionDisabled={!activePatientTabKey || lockState.locked || tabLock.isReadOnly || approvalLocked}
                      inlineActionBar={
                        <ChartsActionBar
                          ref={chartsActionBarRef}
                          runId={resolvedRunId ?? flags.runId}
                          cacheHit={resolvedCacheHit ?? false}
                          missingMaster={resolvedMissingMaster ?? false}
                          dataSourceTransition={resolvedTransition ?? 'snapshot'}
                          fallbackUsed={resolvedFallbackUsed}
                          selectedEntry={selectedEntry}
                          sendEnabled={sendAllowedByDelivery}
                          compactHeader
                          defaultCollapsed
                          embedded
                          sendDisabledReason={sendDisabledReason}
                          patientId={patientId}
                          visitDate={actionVisitDate}
                          queueEntry={actionBarQueueEntry}
                          hasUnsavedDraft={draftState.dirty}
                          hasPermission={hasPermission}
                          requireServerRouteForSend
                          requirePatientForSend
                          networkDegradedReason={networkDegradedReason}
                          approvalLock={{
                            locked: approvalLocked,
                            approvedAt: approvalState.record?.approvedAt,
                            runId: approvalState.record?.runId,
                            action: approvalState.record?.action,
                          }}
                          editLock={{
                            readOnly: tabLock.isReadOnly,
                            reason: tabLock.readOnlyReason,
                            ownerRunId: tabLock.ownerRunId,
                            expiresAt: tabLock.expiresAt,
                            lockStatus: tabLock.status,
                          }}
                          onReloadLatest={handleRefreshSummary}
                          onDiscardChanges={() => {
                            setDraftState((prev) => ({ ...prev, dirty: false, dirtySources: [] }));
                            recordChartsAuditEvent({
                              action: 'CHARTS_CONFLICT',
                              outcome: 'discarded',
                              subject: 'charts-tab-lock',
                              patientId: lockTarget.patientId,
                              appointmentId: lockTarget.appointmentId,
                              runId: resolvedRunId ?? flags.runId,
                              cacheHit: resolvedCacheHit,
                              missingMaster: resolvedMissingMaster,
                              fallbackUsed: resolvedFallbackUsed,
                              dataSourceTransition: resolvedTransition,
                              details: {
                                operationPhase: 'lock',
                                trigger: 'tab',
                                resolution: 'discard',
                                lockStatus: tabLock.status,
                                tabSessionId: tabLock.tabSessionId,
                                lockOwnerRunId: tabLock.ownerRunId,
                                lockExpiresAt: tabLock.expiresAt,
                                receptionId: lockTarget.receptionId,
                                facilityId: session.facilityId,
                                userId: session.userId,
                              },
                            });
                          }}
                          onForceTakeover={() => {
                            const wasReadOnly = tabLock.isReadOnly;
                            tabLock.forceTakeover();
                            recordChartsAuditEvent({
                              action: 'CHARTS_EDIT_LOCK',
                              outcome: wasReadOnly ? 'stolen' : 'acquired',
                              subject: 'charts-tab-lock',
                              patientId: lockTarget.patientId,
                              appointmentId: lockTarget.appointmentId,
                              runId: resolvedRunId ?? flags.runId,
                              cacheHit: resolvedCacheHit,
                              missingMaster: resolvedMissingMaster,
                              fallbackUsed: resolvedFallbackUsed,
                              dataSourceTransition: resolvedTransition,
                              details: {
                                operationPhase: 'lock',
                                trigger: 'tab',
                                resolution: 'force_takeover',
                                lockStatus: tabLock.status,
                                tabSessionId: tabLock.tabSessionId,
                                lockOwnerRunId: tabLock.ownerRunId,
                                lockExpiresAt: tabLock.expiresAt,
                                receptionId: lockTarget.receptionId,
                                facilityId: session.facilityId,
                                userId: session.userId,
                              },
                            });
                          }}
                          onApprovalConfirmed={handleApprovalConfirmed}
                          onApprovalUnlock={handleApprovalUnlock}
                          onBeforeAction={handleBeforeChartsAction}
                          showOperationalMeta={false}
                          onAfterSend={handleRefreshSummary}
                          onAfterStart={handleAfterStart}
                          onAfterPause={handleAfterPause}
                          onAfterFinish={handleAfterFinish}
                          sendConfirmSummary={sendConfirmSummary}
                          onDraftSaved={() => setDraftState((prev) => ({ ...prev, dirty: false, dirtySources: [] }))}
                          onLockChange={handleLockChange}
                        />
                      }
                    />
                  </div>
                </div>
                <div className="charts-workbench__sticky-side" aria-hidden="true" />
              </div>
            </div>
            <div className="charts-workbench__layout">
              <div className="charts-workbench__body">
                <div className="charts-workbench__column charts-workbench__column--left">
                  <div className="charts-column-header">
                    <span className="charts-column-header__label">病名・過去カルテ</span>
                    <span className="charts-column-header__meta">保険病名 / Past Hub / Do</span>
                  </div>
                  <div className="charts-card" id="charts-diagnosis" tabIndex={-1} data-focus-anchor="true">
                    <DiagnosisEditPanel patientId={encounterContext.patientId} meta={sidePanelMeta} />
                  </div>
                  <PatientSummaryPanel
                    patientId={encounterContext.patientId}
                    readOnly={tabLock.isReadOnly || approvalLocked}
                    readOnlyReason={approvalLocked ? approvalReason : tabLock.readOnlyReason}
                  />
                  <div className="charts-card" id="charts-past-hub" tabIndex={-1} data-focus-anchor="true">
                    <PastHubPanel
                      patientId={encounterContext.patientId}
                      entries={patientEntries}
                      soapHistory={soapHistory}
                      doCopyEnabled={isChartsDoCopyEnabled}
                      onRequestDoCopy={openDoCopyDialog}
                      onRequestDoCopyBatch={openDoCopyBatchDialog}
                      doOrderEnabled={canDoFromPast.ok}
                      doOrderDisabledReason={canDoFromPast.reason}
                      onRequestOrderDo={handlePastOrderDo}
                      doDocumentEnabled={canDoFromPast.ok}
                      doDocumentDisabledReason={canDoFromPast.reason}
                      onRequestDocumentDo={handlePastDocumentDo}
                      selectedContext={encounterContext}
                      switchLocked={switchLocked}
                      switchLockedReason={switchLockedReason}
                      todayIso={today}
                      onSelectEncounter={(next) => {
                        if (!next) return;
                        suppressUrlContextSyncRef.current = true;
                        setEncounterContext((prev) => {
                          const merged = normalizeEncounterContext({
                            ...prev,
                            ...next,
                            visitDate: normalizeVisitDate(next.visitDate) ?? normalizeVisitDate(prev.visitDate) ?? today,
                          });
                          return sameEncounterContext(prev, merged) ? prev : merged;
                        });
                        setContextAlert(null);
                      }}
                    />
                  </div>
                  {showDebugUi ? (
                    <div className="charts-card">
                      <AuthServiceControls />
                    </div>
                  ) : null}
                </div>
                <div className="charts-workbench__column charts-workbench__column--center">
                  <div className="charts-column-header">
                    <span className="charts-column-header__label">カルテ記載</span>
                    <span className="charts-column-header__meta">SOAP / 履歴 / オーダー</span>
                  </div>
                  <div className="charts-card" id="charts-soap-note" tabIndex={-1} data-focus-anchor="true">
			                    <SoapNotePanel
			                      history={soapHistory}
			                      meta={soapNoteMeta}
			                      author={soapNoteAuthor}
			                      readOnly={sidePanelMeta.readOnly}
			                      readOnlyReason={sidePanelMeta.readOnlyReason}
			                      rpHistory={rpEntries}
			                      rpHistoryLoading={rpHistoryQuery.isFetching}
			                      rpHistoryError={rpError}
			                      orderBundles={orderBundles}
			                      orderBundlesLoading={orderBundleSummaryQuery.isFetching || prescriptionBundleSummaryQuery.isFetching}
			                      orderBundlesError={orderBundlesError}
			                      prescriptionBundles={prescriptionBundles}
			                      prescriptionBundlesLoading={prescriptionBundleSummaryQuery.isFetching}
			                      prescriptionBundlesError={prescriptionBundlesError}
			                      orderDockOpenRequest={orderDockOpenRequest}
			                      onOrderDockOpenConsumed={handleOrderDockOpenConsumed}
			                      orderHistoryCopyRequest={orderHistoryCopyRequest}
			                      onOrderHistoryCopyConsumed={handleOrderHistoryCopyConsumed}
                      documentDockOpenRequest={documentDockOpenRequest}
                      onDocumentDockOpenConsumed={handleDocumentDockOpenConsumed}
                      documentHistoryCopyRequest={documentHistoryCopyRequest}
                      onDocumentHistoryCopyConsumed={handleDocumentHistoryCopyConsumed}
                      documentPanel={documentPanel}
                      orcaPanel={
                          <OrcaSummary
                          summary={medicalSummaryPanelSummary}
                          claim={claimQuery.data as ClaimOutpatientPayload | undefined}
                          appointments={patientEntries}
                          appointmentMeta={appointmentMeta}
                          patientId={encounterContext.patientId}
                          visitDate={encounterContext.visitDate}
                          onRefresh={handleRefreshSummary}
                          isRefreshing={isManualRefreshing}
                          showOperationalMeta={false}
                        />
                      }
                      bottomOrderHubIntegrationEnabled={isBottomOrderHubIntegrationEnabled}
                      onOrderDockStateChange={handleOrderDockStateChange}
			                      onDraftSnapshot={setSoapDraftSnapshot}
			                      replaceDraftRequest={replaceSoapDraftRequest}
                        saveRequest={soapSaveRequest}
                        onSaveRequestResult={handleSoapSaveRequestResult}
		                      attachmentInsert={pendingSoapAttachment}
		                      onAttachmentInserted={() => setPendingSoapAttachment(null)}
		                      onAppendHistory={appendSoapHistory}
                      onDraftDirtyChange={setDraftState}
                      onSyncStateChange={setSoapSyncState}
                      onClearHistory={clearSoapHistory}
                      onAuditLogged={() => setAuditEvents(getAuditEventLog())}
                    />
                  </div>
                  {showDebugUi ? (
                    <details className="charts-card charts-fold" id="charts-document-timeline" tabIndex={-1} data-focus-anchor="true">
                      <summary className="charts-fold__summary">Document Timeline（デバッグ）</summary>
                      <div className="charts-fold__content">
                        <DocumentTimeline
                          entries={patientEntries}
                          appointmentBanner={appointmentBanner}
                          appointmentMeta={appointmentMeta}
                          auditEvent={latestAuditEvent as Record<string, unknown> | undefined}
                          soapHistory={soapHistory}
                          selectedPatientId={encounterContext.patientId}
                          selectedAppointmentId={encounterContext.appointmentId}
                          selectedReceptionId={encounterContext.receptionId}
                          claimData={claimQuery.data as ClaimOutpatientPayload | undefined}
                          claimError={claimErrorForTimeline}
                          isClaimLoading={claimQuery.isFetching}
                          orcaQueue={orcaQueueQuery.data}
                          orcaQueueUpdatedAt={orcaQueueQuery.dataUpdatedAt}
                          isOrcaQueueLoading={orcaQueueQuery.isFetching}
                          orcaQueueError={
                            orcaQueueQuery.isError
                              ? (orcaQueueQuery.error instanceof Error ? orcaQueueQuery.error : new Error(String(orcaQueueQuery.error)))
                              : undefined
                          }
                          orcaPushEvents={orcaPushEventQuery.data}
                          orcaPushEventsUpdatedAt={orcaPushEventQuery.dataUpdatedAt}
                          isOrcaPushEventsLoading={orcaPushEventQuery.isFetching}
                          orcaPushEventsError={
                            orcaPushEventQuery.isError
                              ? (orcaPushEventQuery.error instanceof Error ? orcaPushEventQuery.error : new Error(String(orcaPushEventQuery.error)))
                              : undefined
                          }
                          onRetryClaim={handleRetryClaim}
                          recordsReturned={appointmentRecordsReturned}
                          hasNextPage={hasNextAppointments}
                          onLoadMore={() => appointmentQuery.fetchNextPage()}
                          isLoadingMore={appointmentQuery.isFetchingNextPage}
                          isInitialLoading={appointmentQuery.isLoading}
                          pageSize={appointmentQuery.data?.pages?.[0]?.size ?? 50}
                          isRefetchingList={appointmentQuery.isFetching && !appointmentQuery.isLoading}
                          onOpenReception={handleOpenReception}
                        />
                      </div>
                    </details>
                  ) : (
                    <div
                      className="charts-focus-anchor"
                      id="charts-document-timeline"
                      tabIndex={-1}
                      data-focus-anchor="true"
                      aria-hidden="true"
                    />
                  )}

                  <div
                    className="charts-focus-anchor"
                    id="charts-orca-summary"
                    tabIndex={-1}
                    data-focus-anchor="true"
                    aria-hidden="true"
                  />

                  {showDebugUi ? (
                    <>
                      <details className="charts-card charts-fold">
                        <summary className="charts-fold__summary">ORCA 記録（要約）</summary>
                        <div className="charts-fold__content">
                          <MedicalOutpatientRecordPanel summary={medicalSummaryPanelSummary} selectedPatientId={encounterContext.patientId} />
                        </div>
                      </details>
                    </>
                  ) : null}

                  {showDebugUi ? (
                    <div className="charts-card" id="charts-telemetry" tabIndex={-1} data-focus-anchor="true">
                      <TelemetryFunnelPanel />
                    </div>
                  ) : (
                    <div
                      className="charts-focus-anchor"
                      id="charts-telemetry"
                      tabIndex={-1}
                      data-focus-anchor="true"
                      aria-hidden="true"
                    />
                  )}
                </div>

              </div>
              {showBottomUtilityDock ? (
	              <aside
	                className="charts-workbench__side"
	                id="charts-utility-pane"
	                tabIndex={-1}
	                data-focus-anchor="true"
	                aria-label="ユーティリティ"
	                data-panel-open={utilityPanelAction ? 'true' : 'false'}
	              >
                <div className="charts-docked-panel">
                  <div className="charts-docked-panel__footer">
                    <div className="charts-docked-panel__tabs" role="tablist" aria-label="ユーティリティ">
                      {utilityItems.map((item, index) => {
                        const isActive = utilityPanelAction === item.id;
                        const utilityKind = resolveUtilityVisualKind(item.id);
                        const isDisabled = item.requiresEdit && (!patientSelected || sidePanelMeta.readOnly);
                        const tabDirty =
                          item.id === 'order-set'
                            ? orderDockState.hasEditing
                            : item.id === 'document'
                            ? documentUtilityState.dirty
                            : item.id === 'imaging'
                              ? imageUtilityState.queueCount > 0 || imageUtilityState.uploadingCount > 0
                              : false;
                        const tabMeta =
                          item.id === 'order-set'
                            ? resolveOrderDockTabMeta(orderDockState)
                            : item.id === 'document'
                              ? documentImageAttachments.length > 0
                              ? `📎${documentImageAttachments.length}`
                              : null
                            : item.id === 'imaging'
                              ? imageUtilityState.uploadingCount > 0
                                ? `送信${imageUtilityState.uploadingCount}`
                                : imageUtilityState.queueCount > 0
                                  ? `待機${imageUtilityState.queueCount}`
                              : null
                              : null;
                        const orderDockRequiredIssue = item.id === 'order-set' ? hasOrderDockRequiredIssue(orderDockState) : false;
                        const disabledReason = !patientSelected
                          ? UTILITY_PATIENT_UNSELECTED_MESSAGE
                          : sidePanelMeta.readOnlyReason ?? '読み取り専用のため編集はできません。';
                        return (
                          <button
                            key={item.id}
                            id={`charts-docked-tab-${item.id}`}
                            type="button"
                            role="tab"
                            className="charts-docked-panel__tab"
                            data-utility-action={item.id}
                            data-utility-kind={utilityKind}
                            data-active={isActive ? 'true' : 'false'}
                            data-utility-order={index === 0 ? 'first' : undefined}
                            data-order-dock-editing={item.id === 'order-set' ? (orderDockState.hasEditing ? 'true' : 'false') : undefined}
                            data-order-dock-target-category={item.id === 'order-set' ? (orderDockState.targetCategory ?? '') : undefined}
                            data-order-dock-rp-required={item.id === 'order-set' ? (orderDockRequiredIssue ? 'true' : 'false') : undefined}
                            aria-controls="charts-docked-panel"
                            aria-selected={isActive}
                            aria-expanded={isActive}
                            aria-label={tabMeta ? `${item.label}（${tabMeta}）` : item.label}
                            disabled={isDisabled}
                            title={isDisabled ? disabledReason : item.shortcut}
                            onClick={(event) => handleUtilityButtonClick(item.id, event.currentTarget)}
                          >
                            <span className="charts-docked-panel__tab-icon" aria-hidden="true">
                              {item.shortLabel}
                            </span>
                            <span className="charts-docked-panel__tab-text">
                              <span className="charts-docked-panel__tab-label">
                                {item.label}
                                {tabDirty ? <span className="charts-docked-panel__tab-dirty" aria-hidden="true">●</span> : null}
                                {tabMeta ? <span className="charts-docked-panel__tab-meta">{tabMeta}</span> : null}
                              </span>
                              <span className="charts-docked-panel__tab-shortcut">{item.shortcut}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="charts-docked-panel__mini" role="group" aria-label="補助メニュー">
                      <button
                        type="button"
                        className="charts-docked-panel__mini-button"
                        onClick={() => setIsShortcutsDialogOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={isShortcutsDialogOpen}
                        title="ショートカット一覧"
                      >
                        ?
                        <span className="charts-docked-panel__mini-label">ショートカット</span>
                      </button>
                    </div>
                  </div>
	                  <div
	                    id="charts-docked-panel"
	                    className="charts-docked-panel__drawer"
	                    role="tabpanel"
	                    aria-live={infoLive}
	                    aria-hidden={!utilityPanelAction}
                    aria-labelledby={utilityPanelAction ? `charts-docked-tab-${utilityPanelAction}` : undefined}
                    data-open={utilityPanelAction ? 'true' : 'false'}
                    data-utility-kind={activeUtilityKind}
                    data-docked-panel-content="true"
                  >
                    <div
                      className={`charts-docked-panel__header${utilityPanelAction ? ' charts-docked-panel__header--draggable' : ''}${
                        isUtilityPanelDragging ? ' is-dragging' : ''
                      }`}
                      onPointerDown={beginUtilityPanelMove}
                    >
                      <span className="charts-docked-panel__drag-handle" aria-hidden="true" title="ドラッグで移動">
                        ⋮⋮
                      </span>
                      <div>
                        <p className="charts-docked-panel__eyebrow">ユーティリティ</p>
                        <h2 id="charts-docked-panel-title" ref={utilityHeadingRef} tabIndex={-1}>
                          {utilityPanelAction ? utilityPanelTitles[utilityPanelAction] : 'ユーティリティ'}
	                        </h2>
	                        <p id="charts-docked-panel-desc" className="charts-docked-panel__desc">
	                          セット/スタンプ・文書・画像入力をまとめて呼び出します。
	                        </p>
                        <p className="charts-docked-panel__shortcut">
                          Ctrl+Shift+U: 開閉 / Ctrl+Shift+1〜{utilityItems.length}: タブ切替 / Esc: 閉じる
                        </p>
                      </div>
                      <button type="button" className="charts-docked-panel__close" onClick={() => closeUtilityPanel(true)}>
                        閉じる
                      </button>
                    </div>
                    {utilityPanelAction === 'order-set' && (
                      <div className="charts-side-panel__content">
                        <div className="charts-docked-panel__subtabs" role="tablist" aria-label="セット/スタンプ切替">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={orderSetSubtab === 'set'}
                            className="charts-docked-panel__subtab"
                            data-active={orderSetSubtab === 'set' ? 'true' : 'false'}
                            onClick={() => setOrderSetSubtab('set')}
                          >
                            セット
                          </button>
                          {stampboxMvpEnabled ? (
                            <button
                              type="button"
                              role="tab"
                              aria-selected={orderSetSubtab === 'stamp'}
                              className="charts-docked-panel__subtab"
                              data-active={orderSetSubtab === 'stamp' ? 'true' : 'false'}
                              onClick={() => setOrderSetSubtab('stamp')}
                            >
                              スタンプ
                            </button>
                          ) : null}
                        </div>

                        {orderSetSubtab === 'set' ? (
                          <>
                            {orderSetNotice ? (
                              <div className={`charts-side-panel__notice charts-side-panel__notice--${orderSetNotice.tone}`}>
                                {orderSetNotice.message}
                              </div>
                            ) : null}
                            <div className="charts-side-panel__subsection">
                              <div className="charts-side-panel__subheader">
                                <strong>当日データをセット保存</strong>
                              </div>
                              <div className="charts-side-panel__field">
                                <label htmlFor="charts-order-set-name">セット名称</label>
                                <input
                                  id="charts-order-set-name"
                                  value={orderSetName}
                                  onChange={(event) => setOrderSetName(event.target.value)}
                                  placeholder="例: 定期フォローセット"
                                />
                              </div>
                              <p className="charts-side-panel__help">
                                対象: 病名 / オーダー（{actionVisitDate}）
                              </p>
                              <div className="charts-side-panel__actions">
                                <button
                                  type="button"
                                  onClick={() => saveOrderSetMutation.mutate()}
                                  disabled={!patientId || saveOrderSetMutation.isPending || sidePanelMeta.readOnly}
                                >
                                  {saveOrderSetMutation.isPending ? '保存中...' : '本日データをセット保存'}
                                </button>
                              </div>
                            </div>

                            <div className="charts-side-panel__subsection">
                              <div className="charts-side-panel__subheader">
                                <strong>登録済みセット</strong>
                                <span className="charts-side-panel__search-count">{orderSetEntries.length}件</span>
                              </div>
                              <div className="charts-side-panel__field">
                                <label htmlFor="charts-order-set-select">セット選択</label>
                                <select
                                  id="charts-order-set-select"
                                  value={selectedOrderSetId}
                                  onChange={(event) => setSelectedOrderSetId(event.target.value)}
                                >
                                  <option value="">選択してください</option>
                                  {orderSetEntries.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                      {entry.name} / 病名{entry.snapshot.diagnoses.length}件 / オーダー{entry.snapshot.orderBundles.length}件
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {selectedOrderSet ? (
                                <p className="charts-side-panel__help">
                                  内容: 病名{selectedOrderSet.snapshot.diagnoses.length}件 / オーダー{selectedOrderSet.snapshot.orderBundles.length}件
                                </p>
                              ) : null}
                              <div className="charts-side-panel__actions">
                                <button
                                  type="button"
                                  onClick={() => selectedOrderSet && applyOrderSetMutation.mutate(selectedOrderSet)}
                                  disabled={!selectedOrderSet || applyOrderSetMutation.isPending || !patientId || sidePanelMeta.readOnly}
                                >
                                  {applyOrderSetMutation.isPending ? '適用中...' : 'セット適用（現在患者へ反映）'}
                                </button>
                                <button type="button" onClick={() => appNav.openOrderSets()}>
                                  セット編集画面を開く
                                </button>
                              </div>
                            </div>
                          </>
                        ) : null}

                        {orderSetSubtab === 'stamp' && stampboxMvpEnabled ? (
                          <div className="charts-side-panel__subsection">
                            <div className="charts-side-panel__subheader">
                              <strong>スタンプ</strong>
                            </div>
                            <p className="charts-side-panel__help">
                              スタンプは独立管理画面で閲覧・編集・登録できます。必要時のみローカルへ保存して運用してください。
                            </p>
                            <StampLibraryPanel phase={stampboxMvpPhase === 2 ? 2 : 1} />
                          </div>
                        ) : null}
                      </div>
                    )}
                    {utilityPanelAction === 'document' && (
                      <div className="charts-side-panel__content">
                        <DocumentCreatePanel
                          patientId={encounterContext.patientId}
                          meta={sidePanelMeta}
                          imageAttachments={documentImageAttachments}
                          onImageAttachmentsChange={setDocumentImageAttachments}
                          onImageAttachmentsClear={clearDocumentAttachments}
                          historyCopyRequest={documentHistoryCopyRequest}
                          onHistoryCopyConsumed={handleDocumentHistoryCopyConsumed}
                          onStateChange={setDocumentUtilityState}
                          onClose={() => {
                            handleDocumentPanelClose();
                            utilityFocusRestoreRef.current = true;
                            setUtilityPanelAction(null);
                          }}
                        />
                      </div>
                    )}
                    {utilityPanelAction === 'imaging' && (
                      <div className="charts-side-panel__content">
                        <ImageDockedPanel
                          patientId={encounterContext.patientId}
                          appointmentId={encounterContext.appointmentId}
                          runId={resolvedRunId ?? flags.runId}
                          selectedAttachmentIds={documentImageAttachments.map((attachment) => attachment.id)}
                          onToggleDocumentAttachment={toggleDocumentAttachment}
                          onInsertSoapAttachment={insertSoapAttachment}
                          soapTargetOptions={soapAttachmentOptions}
                          soapTargetSection={soapAttachmentTarget}
                          onSoapTargetChange={(next) => setSoapAttachmentTarget(next as SoapSectionKey)}
                          onStateChange={setImageUtilityState}
                        />
                      </div>
                    )}
                    {!utilityPanelAction && <p className="charts-docked-panel__empty">ユーティリティを選択してください。</p>}
                  </div>
                  {utilityPanelAction ? (
                    <button
                      type="button"
                      className={`charts-docked-panel__resize-handle${isUtilityPanelResizing ? ' is-resizing' : ''}`}
                      onPointerDown={beginUtilityPanelResize}
                      aria-label="ユーティリティパネルのサイズを変更"
                    />
                  ) : null}
                </div>
              </aside>
              ) : null}
            </div>
          </section>
        </>
      )}
      <div id="charts-portal-root" />
    </main>
    </>
  );
}
