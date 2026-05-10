import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ToneBanner } from '../reception/components/ToneBanner';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { StatusPill, type StatusPillTone } from '../shared/StatusPill';
import { logUiState, getAuditEventLog, type AuditEventRecord } from '../../libs/audit/auditLogger';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { resolveAriaLive, resolveRunId } from '../../libs/observability/observability';
import { useAuthService } from './authService';
import { recordChartsAuditEvent, type ChartsOperationPhase } from './audit';
import { draftSourceLabels, type DraftDirtySource } from './draftSources';
import { getChartToneDetails, type ChartTonePayload } from '../../ux/charts/tones';
import type { ReceptionEntry, ReceptionStatus } from '../reception/api';
import type { AppointmentDataBanner } from '../outpatient/appointmentDataBanner';
import {
  normalizeVisitDate,
  type OutpatientEncounterContext,
  type ReceptionCarryoverParams,
} from './encounterContext';
import { useSession } from '../../AppRouter';
import { useAppNavigation } from '../../routes/useAppNavigation';
import { searchLocalPatients, type PatientRecord } from '../patients/api';
import { OrcaHokenjaReferenceDialog } from './OrcaHokenjaReferenceDialog';
import { PatientInfoEditDialog } from './PatientInfoEditDialog';

const resolveEntryPatientId = (
  entry?: Pick<ReceptionEntry, 'patientId'>,
): string | undefined => entry?.patientId?.trim() || undefined;

const resolveEncounterSelectionKey = (
  value?: Partial<Pick<OutpatientEncounterContext, 'encounterKey' | 'scheduleKey' | 'receptionId' | 'appointmentId' | 'patientId'>>,
): string | undefined =>
  value?.encounterKey ?? value?.scheduleKey ?? value?.receptionId ?? value?.appointmentId ?? value?.patientId;

const resolveEntrySelectionKey = (entry?: ReceptionEntry): string | undefined =>
  entry?.encounterKey ?? entry?.scheduleKey ?? entry?.receptionId ?? entry?.appointmentId ?? resolveEntryPatientId(entry) ?? entry?.id;

type PatientListSortKey = 'time' | 'status' | 'name' | 'id';

const STATUS_SORT_RANK: Record<ReceptionStatus, number> = {
  予約: 0,
  受付中: 1,
  診療中: 2,
  会計待ち: 3,
  再計待: 4,
  会計済み: 5,
};

const resolveStatusTone = (status?: ReceptionStatus): StatusPillTone => {
  switch (status) {
    case '診療中':
      return 'success';
    case '会計待ち':
    case '再計待':
      return 'warning';
    case '受付中':
      return 'info';
    case '予約':
      return 'neutral';
    case '会計済み':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const parseDisplayTimeToMinutes = (value?: string): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const resolveEntrySortMinutes = (entry: ReceptionEntry): number => {
  const candidate =
    entry.acceptanceTime?.trim() ||
    entry.appointmentTime?.trim() ||
    entry.reservationTime?.trim() ||
    '';
  const parsed = parseDisplayTimeToMinutes(candidate);
  return parsed ?? Number.POSITIVE_INFINITY;
};

const resolveEntryTimeBadge = (entry: ReceptionEntry): { label: string; time: string } | null => {
  const acceptance = entry.acceptanceTime?.trim();
  if (acceptance) return { label: '受付', time: acceptance };
  const appointment = entry.appointmentTime?.trim();
  if (appointment) return { label: '予約', time: appointment };
  const reservation = entry.reservationTime?.trim();
  if (reservation) return { label: '予', time: reservation };
  return null;
};

const formatFetchedAt = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
};

export interface PatientsTabProps {
  entries?: ReceptionEntry[];
  listFetchedAt?: string;
  onRefetchList?: () => void;
  isRefetchingList?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  appointmentBanner?: AppointmentDataBanner | null;
  auditEvent?: Record<string, unknown>;
  selectedContext?: OutpatientEncounterContext;
  receptionCarryover?: ReceptionCarryoverParams;
  draftDirty?: boolean;
  switchLocked?: boolean;
  switchLockedReason?: string;
  onDraftBlocked?: (message: string) => void;
  onDraftDirtyChange?: (params: {
    dirty: boolean;
    patientId?: string;
    appointmentId?: string;
    receptionId?: string;
    scheduleKey?: string;
    encounterKey?: string;
    visitDate?: string;
    dirtySources?: DraftDirtySource[];
  }) => void;
  draftDirtySources?: DraftDirtySource[];
  onRequestRestoreFocus?: () => void;
  onSelectEncounter?: (context?: OutpatientEncounterContext) => void;
}

export function PatientsTab({
  entries = [],
  listFetchedAt,
  onRefetchList,
  isRefetchingList = false,
  hasNextPage,
  onLoadMore,
  isLoadingMore = false,
  appointmentBanner,
  auditEvent,
  selectedContext,
  receptionCarryover,
  draftDirty = false,
  draftDirtySources = [],
  switchLocked = false,
  switchLockedReason,
  onDraftDirtyChange,
  onRequestRestoreFocus,
  onSelectEncounter,
}: PatientsTabProps) {
  const { flags } = useAuthService();
  const resolvedRunId = resolveRunId(flags.runId);
  const infoLive = resolveAriaLive('info');
  const session = useSession();
  const appNav = useAppNavigation({ facilityId: session.facilityId, userId: session.userId });
  const isLocalHistoryDebugEnabled = import.meta.env.DEV;
  const tonePayload: ChartTonePayload = {
    missingMaster: flags.missingMaster,
    cacheHit: flags.cacheHit,
    dataSourceTransition: flags.dataSourceTransition,
  };
  const { tone, message: toneMessage, transitionMeta } = getChartToneDetails(tonePayload);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReceptionStatus[]>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [physFilter, setPhysFilter] = useState('');
  const [sortKey, setSortKey] = useState<PatientListSortKey>('time');
  const [localSelectedKey, setLocalSelectedKey] = useState<string | undefined>(
    resolveEncounterSelectionKey(selectedContext),
  );
  const [memoDraft, setMemoDraft] = useState('');
  const [memoEditing, setMemoEditing] = useState(false);
  const [historyTab, setHistoryTab] = useState<'recent' | 'past90' | 'all'>('recent');
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditSnapshot, setAuditSnapshot] = useState<AuditEventRecord[]>([]);
  const [diffHighlightKeys, setDiffHighlightKeys] = useState<string[]>([]);
  const [draftSwitchDialog, setDraftSwitchDialog] = useState<{
    open: boolean;
    entry?: ReceptionEntry;
    currentPatientId?: string;
    currentName?: string;
    controlId?: string;
    trigger?: string;
    note?: string;
  }>({ open: false });
  const [confirmSwitchDialog, setConfirmSwitchDialog] = useState<{
    open: boolean;
    entry?: ReceptionEntry;
    current?: ReceptionEntry;
    currentPatientId?: string;
    controlId?: string;
    trigger?: string;
    note?: string;
  }>({ open: false });
  const [patientEditDialogOpen, setPatientEditDialogOpen] = useState(false);
  const [hokenjaDialogOpen, setHokenjaDialogOpen] = useState(false);
  const lastAuditPatientId = useRef<string | undefined>(undefined);
  const lastAutoSelectSignature = useRef<string | null>(null);
  const lastEditGuardSignature = useRef<string | null>(null);
  const memoPatientIdRef = useRef<string | undefined>(undefined);
  const pendingSwitchRef = useRef<{
    entry: ReceptionEntry;
    controlId: string;
    trigger: string;
    note?: string;
    currentPatientId?: string;
  } | null>(null);
  const basicRef = useRef<HTMLDivElement | null>(null);
  const insuranceRef = useRef<HTMLDivElement | null>(null);
  const diffRef = useRef<HTMLDivElement | null>(null);

  const logPatientSwitch = useCallback((params: {
    phase: ChartsOperationPhase;
    outcome: 'success' | 'blocked' | 'warning';
    patientId?: string;
    appointmentId?: string;
    note?: string;
    controlId: string;
    details?: Record<string, unknown>;
  }) => {
    recordChartsAuditEvent({
      action: 'CHARTS_PATIENT_SWITCH',
      outcome: params.outcome,
      subject: 'sidepane',
      patientId: params.patientId,
      appointmentId: params.appointmentId,
      note: params.note,
      dataSourceTransition: flags.dataSourceTransition,
      cacheHit: flags.cacheHit,
      missingMaster: flags.missingMaster,
      fallbackUsed: flags.fallbackUsed,
      runId: flags.runId,
      details: {
        operationPhase: params.phase,
        ...params.details,
      },
    });
    logUiState({
      action: 'history_jump',
      screen: 'charts/patients-tab',
      controlId: params.controlId,
      runId: flags.runId,
      cacheHit: flags.cacheHit,
      missingMaster: flags.missingMaster,
      dataSourceTransition: flags.dataSourceTransition,
      fallbackUsed: flags.fallbackUsed,
      details: {
        operationPhase: params.phase,
        outcome: params.outcome,
        note: params.note,
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        ...params.details,
      },
    });
  }, [
    flags.cacheHit,
    flags.dataSourceTransition,
    flags.fallbackUsed,
    flags.missingMaster,
    flags.runId,
  ]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      const value = (entry.department ?? '').trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const physicianOptions = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      const value = (entry.physician ?? '').trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const baseCandidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const dept = deptFilter.trim();
    const phys = physFilter.trim();
    return entries.filter((entry) => {
      if (dept && (entry.department ?? '') !== dept) return false;
      if (phys && (entry.physician ?? '') !== phys) return false;
      if (!kw) return true;
      const values = [
        resolveEntryPatientId(entry),
        entry.patientId,
        entry.id,
        entry.name,
        entry.kana,
        entry.appointmentId,
        entry.receptionId,
      ]
        .filter(Boolean)
        .map((field) => String(field).toLowerCase());
      return values.some((field) => field.includes(kw));
    });
  }, [deptFilter, entries, keyword, physFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<ReceptionStatus, number> = {
      予約: 0,
      受付中: 0,
      診療中: 0,
      会計待ち: 0,
      再計待: 0,
      会計済み: 0,
    };
    for (const entry of baseCandidates) {
      counts[entry.status] += 1;
    }
    return counts;
  }, [baseCandidates]);

  const candidateEntries = useMemo(() => {
    const activeStatuses = statusFilter.length > 0 ? new Set(statusFilter) : null;
    const filtered = activeStatuses ? baseCandidates.filter((entry) => activeStatuses.has(entry.status)) : baseCandidates;
    const sorted = [...filtered];
    const resolveName = (entry: ReceptionEntry) => (entry.kana ?? entry.name ?? '').trim();
    const resolveId = (entry: ReceptionEntry) => (resolveEntryPatientId(entry) ?? '').trim();
    const compareByName = (a: ReceptionEntry, b: ReceptionEntry) => {
      const left = resolveName(a);
      const right = resolveName(b);
      const diff = left.localeCompare(right);
      if (diff !== 0) return diff;
      return resolveId(a).localeCompare(resolveId(b));
    };
    const compareById = (a: ReceptionEntry, b: ReceptionEntry) => {
      const left = resolveId(a);
      const right = resolveId(b);
      const leftNum = /^\d+$/.test(left) ? Number(left) : Number.NaN;
      const rightNum = /^\d+$/.test(right) ? Number(right) : Number.NaN;
      const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);
      if (bothNumeric && leftNum !== rightNum) return leftNum - rightNum;
      const diff = left.localeCompare(right);
      if (diff !== 0) return diff;
      return compareByName(a, b);
    };

    sorted.sort((a, b) => {
      if (sortKey === 'status') {
        const rankDiff = (STATUS_SORT_RANK[a.status] ?? 999) - (STATUS_SORT_RANK[b.status] ?? 999);
        if (rankDiff !== 0) return rankDiff;
        const timeDiff = resolveEntrySortMinutes(a) - resolveEntrySortMinutes(b);
        if (timeDiff !== 0) return timeDiff;
        return compareByName(a, b);
      }
      if (sortKey === 'name') {
        const nameDiff = compareByName(a, b);
        if (nameDiff !== 0) return nameDiff;
        const timeDiff = resolveEntrySortMinutes(a) - resolveEntrySortMinutes(b);
        if (timeDiff !== 0) return timeDiff;
        return (STATUS_SORT_RANK[a.status] ?? 999) - (STATUS_SORT_RANK[b.status] ?? 999);
      }
      if (sortKey === 'id') {
        const idDiff = compareById(a, b);
        if (idDiff !== 0) return idDiff;
        const timeDiff = resolveEntrySortMinutes(a) - resolveEntrySortMinutes(b);
        if (timeDiff !== 0) return timeDiff;
        return (STATUS_SORT_RANK[a.status] ?? 999) - (STATUS_SORT_RANK[b.status] ?? 999);
      }
      const timeDiff = resolveEntrySortMinutes(a) - resolveEntrySortMinutes(b);
      if (timeDiff !== 0) return timeDiff;
      const rankDiff = (STATUS_SORT_RANK[a.status] ?? 999) - (STATUS_SORT_RANK[b.status] ?? 999);
      if (rankDiff !== 0) return rankDiff;
      return compareByName(a, b);
    });
    return sorted;
  }, [baseCandidates, sortKey, statusFilter]);

  const selected = useMemo(() => {
    if (selectedContext?.encounterKey) {
      return entries.find((entry) => entry.encounterKey === selectedContext.encounterKey);
    }
    if (selectedContext?.scheduleKey) {
      return entries.find((entry) => entry.scheduleKey === selectedContext.scheduleKey);
    }
    if (selectedContext?.receptionId) {
      return entries.find((entry) => entry.receptionId === selectedContext.receptionId);
    }
    if (selectedContext?.appointmentId) {
      return entries.find((entry) => entry.appointmentId === selectedContext.appointmentId);
    }
    if (selectedContext?.patientId) {
      return entries.find((entry) => resolveEntryPatientId(entry) === selectedContext.patientId);
    }
    if (localSelectedKey) {
      return entries.find((entry) => {
        const entryPid = resolveEntryPatientId(entry);
        return (
          entry.encounterKey === localSelectedKey ||
          entry.scheduleKey === localSelectedKey ||
          entry.receptionId === localSelectedKey ||
          entry.appointmentId === localSelectedKey ||
          entry.patientId === localSelectedKey ||
          entryPid === localSelectedKey ||
          entry.id === localSelectedKey
        );
      });
    }
    return entries[0];
  }, [
    entries,
    localSelectedKey,
    selectedContext?.appointmentId,
    selectedContext?.encounterKey,
    selectedContext?.patientId,
    selectedContext?.receptionId,
    selectedContext?.scheduleKey,
  ]);

  const selectedPatientId = resolveEntryPatientId(selected) ?? selectedContext?.patientId ?? undefined;

  const patientBaselineQuery = useQuery({
    queryKey: ['charts-patient-sidepane-baseline', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return null;
      const result = await searchLocalPatients({ keyword: selectedPatientId });
      const exact = result.patients.find((p) => p.patientId === selectedPatientId);
      return exact ?? result.patients[0] ?? null;
    },
    enabled: Boolean(selectedPatientId),
    staleTime: 60_000,
  });

  const patientBaseline: PatientRecord | null = patientBaselineQuery.data ?? null;

  const editBlockedByMaster = flags.missingMaster || flags.fallbackUsed || flags.dataSourceTransition !== 'server';
  const editBlockedReason = editBlockedByMaster
    ? `missingMaster=${String(flags.missingMaster)} / fallbackUsed=${String(flags.fallbackUsed)} / dataSourceTransition=${flags.dataSourceTransition}`
    : undefined;

  const canEditMemoByRole = useMemo(() => {
    const role = session.role?.toLowerCase?.() ?? '';
    return role === 'doctor' || role === 'nurse';
  }, [session.role]);

  // Patient master edits are allowed for all authenticated users (no role restriction).
  const canEditPatientInfoByRole = true;

  const canEditByStatus = useMemo(() => {
    if (!selected) return false;
    return selected.status === '受付中' || selected.status === '診療中' || selected.status === '予約';
  }, [selected]);

  const canEditMemo = canEditMemoByRole && !editBlockedByMaster;
  const canEditPatientInfoNow =
    Boolean(selectedPatientId) && canEditPatientInfoByRole && canEditByStatus && !editBlockedByMaster && !switchLocked && !draftDirty;
  const canDeepLinkPatientsBasic = Boolean(selectedPatientId);

  const patientEditBlockedReason = useMemo(() => {
    if (!selectedPatientId) return 'patientId が未確定のため編集できません。';
    if (switchLocked) return `他の処理が進行中のためロック中${switchLockedReason ? `: ${switchLockedReason}` : ''}`;
    if (draftDirty) return '未保存下書きあり（下書きを保存/破棄してから患者更新してください）。';
    if (editBlockedByMaster) return `編集不可（master/tone ガード）: ${editBlockedReason}`;
    if (!canEditByStatus) return `編集不可（受付ステータス=${selected?.status ?? '不明'}）`;
    return undefined;
  }, [
    canEditByStatus,
    draftDirty,
    editBlockedByMaster,
    editBlockedReason,
    selected?.status,
    selectedPatientId,
    switchLocked,
    switchLockedReason,
  ]);
  const patientEditBlockedReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!selectedPatientId) reasons.push('missing_patient_id');
    if (switchLocked) reasons.push('switch_locked');
    if (draftDirty) reasons.push('draft_dirty');
    if (editBlockedByMaster) reasons.push('master_guard');
    if (!canEditByStatus) reasons.push('status_blocked');
    return reasons;
  }, [
    canEditByStatus,
    draftDirty,
    editBlockedByMaster,
    selectedPatientId,
    switchLocked,
  ]);

  const guardMessage = useMemo(() => {
    if (switchLocked) {
      return `他の処理が進行中のため患者切替をロック中${switchLockedReason ? `: ${switchLockedReason}` : ''}`;
    }
    if (editBlockedByMaster) {
      return `編集不可（master/tone ガード）: ${editBlockedReason}`;
    }
    if (!canEditByStatus) {
      return `編集不可（受付ステータス=${selected?.status ?? '不明'}）: 会計待ち以降は編集できません。`;
    }
    if (draftDirty) {
      return '未保存下書きあり（ORCA送信前に下書き保存してください）';
    }
    return '閲覧モード（ガード条件を満たす場合のみ編集可）';
  }, [
    canEditByStatus,
    canEditMemoByRole,
    draftDirty,
    editBlockedByMaster,
    editBlockedReason,
    selected?.status,
    switchLocked,
    switchLockedReason,
  ]);

  useEffect(() => {
    if (!patientEditBlockedReason || patientEditBlockedReasons.length === 0) {
      lastEditGuardSignature.current = null;
      return;
    }
    const signature = `${resolvedRunId ?? 'runId'}:${selectedPatientId ?? 'unknown'}:${patientEditBlockedReason}`;
    if (lastEditGuardSignature.current === signature) return;
    lastEditGuardSignature.current = signature;
    recordChartsAuditEvent({
      action: 'CHARTS_PATIENT_EDIT_GUARD',
      outcome: 'blocked',
      subject: 'sidepane',
      patientId: selectedPatientId,
      appointmentId: selected?.appointmentId ?? selectedContext?.appointmentId,
      note: patientEditBlockedReason,
      runId: resolvedRunId,
      dataSourceTransition: flags.dataSourceTransition,
      cacheHit: flags.cacheHit,
      missingMaster: flags.missingMaster,
      fallbackUsed: flags.fallbackUsed,
      details: {
        operationPhase: 'lock',
        trigger: 'edit_guard',
        blockedReasons: patientEditBlockedReasons,
      },
    });
  }, [
    flags.cacheHit,
    flags.dataSourceTransition,
    flags.fallbackUsed,
    flags.missingMaster,
    patientEditBlockedReason,
    patientEditBlockedReasons,
    resolvedRunId,
    selected?.appointmentId,
    selectedContext?.appointmentId,
    selectedPatientId,
  ]);

  const scrollTo = (target: 'basic' | 'insurance' | 'diff' | 'timeline') => {
    const map: Record<typeof target, HTMLElement | null> = {
      basic: basicRef.current,
      insurance: insuranceRef.current,
      diff: diffRef.current,
      timeline: typeof document !== 'undefined' ? (document.getElementById('document-timeline') as HTMLElement | null) : null,
    };
    const el = map[target];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (target === 'timeline') {
      try {
        el.focus({ preventScroll: true });
      } catch {
        // focus できない環境ではスキップ
      }
    }
  };

  const fallbackPatientRecord: PatientRecord | null = useMemo(() => {
    if (!selected) return null;
    return {
      patientId: resolveEntryPatientId(selected) ?? selectedContext?.patientId,
      name: selected.name,
      kana: selected.kana,
      birthDate: selected.birthDate,
      sex: selected.sex,
      phone: undefined,
      zip: undefined,
      address: undefined,
      insurance: selected.insurance,
      memo: selected.note,
      lastVisit: selected.visitDate,
    };
  }, [selected, selectedContext?.patientId]);

  useEffect(() => {
    const hasSelection =
      Boolean(resolveEncounterSelectionKey(selectedContext)) || Boolean(localSelectedKey);
    if (hasSelection || entries.length === 0) {
      lastAutoSelectSignature.current = null;
      return;
    }
    const head = entries[0];
    const fallbackId = resolveEntryPatientId(head);
    if (!fallbackId) return;
    const nextKey = resolveEntrySelectionKey(head);
    if (!nextKey) return;
    const signature = `${fallbackId}:${nextKey}:${head.encounterKey ?? ''}:${head.scheduleKey ?? ''}:${head.receptionId ?? ''}:${head.appointmentId ?? ''}:${head.visitDate ?? ''}`;
    if (lastAutoSelectSignature.current === signature) return;
    lastAutoSelectSignature.current = signature;
    setLocalSelectedKey(nextKey);
    onSelectEncounter?.({
      patientId: fallbackId,
      appointmentId: head.appointmentId,
      receptionId: head.receptionId,
      scheduleKey: head.scheduleKey,
      encounterKey: head.encounterKey,
      visitDate: head.visitDate,
    });
    onDraftDirtyChange?.({
      dirty: false,
      patientId: fallbackId,
      appointmentId: head.appointmentId,
      receptionId: head.receptionId,
      scheduleKey: head.scheduleKey,
      encounterKey: head.encounterKey,
      visitDate: head.visitDate,
      dirtySources: [],
    });
    logPatientSwitch({
      phase: 'do',
      outcome: 'success',
      patientId: fallbackId,
      appointmentId: head.appointmentId,
      note: 'auto-select first patient',
      controlId: 'patient-switch-auto',
      details: {
        trigger: 'auto_select',
      },
    });
    lastAuditPatientId.current = fallbackId;
  }, [
    entries,
    localSelectedKey,
    logPatientSwitch,
    onDraftDirtyChange,
    onSelectEncounter,
    selectedContext?.appointmentId,
    selectedContext?.patientId,
    selectedContext?.receptionId,
  ]);

  const handleSelect = (entry: ReceptionEntry) =>
    requestPatientSwitch(entry, {
      controlId: 'patient-switch',
      trigger: 'manual',
      note: 'manual switch',
    });

  const commitPatientSwitch = useCallback(
    (
      entry: ReceptionEntry,
      options: {
        controlId: string;
        trigger: string;
        currentPatientId?: string;
        note?: string;
      },
    ) => {
      if (switchLocked) {
        const entryId = resolveEntryPatientId(entry);
        logPatientSwitch({
          phase: 'lock',
          outcome: 'blocked',
          patientId: entryId,
          appointmentId: entry.appointmentId,
          note: 'switch locked',
          controlId: options.controlId,
          details: {
            trigger: 'lock',
            blockedReasons: ['switch_locked'],
            currentPatientId: options.currentPatientId,
          },
        });
        return false;
      }
      const nextId = resolveEntryPatientId(entry);
      if (!nextId) return false;
      const nextKey = resolveEntrySelectionKey(entry) ?? nextId;
      setLocalSelectedKey(nextKey);
      onSelectEncounter?.({
        patientId: nextId,
        appointmentId: entry.appointmentId,
        receptionId: entry.receptionId,
        scheduleKey: entry.scheduleKey,
        encounterKey: entry.encounterKey,
        visitDate: entry.visitDate,
      });
      onDraftDirtyChange?.({
        dirty: false,
        patientId: nextId,
        appointmentId: entry.appointmentId,
        receptionId: entry.receptionId,
        scheduleKey: entry.scheduleKey,
        encounterKey: entry.encounterKey,
        visitDate: entry.visitDate,
        dirtySources: [],
      });
      if (lastAuditPatientId.current !== nextId) {
        logPatientSwitch({
          phase: 'do',
          outcome: 'success',
          patientId: nextId,
          appointmentId: entry.appointmentId,
          note: options.note ?? 'manual switch',
          controlId: options.controlId,
          details: {
            trigger: options.trigger,
            currentPatientId: options.currentPatientId,
          },
        });
        lastAuditPatientId.current = nextId;
      }
      return true;
    },
    [logPatientSwitch, onDraftDirtyChange, onSelectEncounter, switchLocked],
  );

  const requestPatientSwitch = useCallback(
    (
      entry: ReceptionEntry,
      options: {
        controlId: string;
        trigger: string;
        note?: string;
      },
      requestOptions?: { ignoreDraft?: boolean },
    ) => {
      if (switchLocked) {
        const reason = switchLockedReason ?? 'chart switch locked';
        const entryId = resolveEntryPatientId(entry);
        logPatientSwitch({
          phase: 'lock',
          outcome: 'blocked',
          patientId: entryId,
          appointmentId: entry.appointmentId,
          note: reason,
          controlId: `${options.controlId}-blocked`,
          details: {
            trigger: 'lock',
            blockedReasons: ['switch_locked'],
          },
        });
        return false;
      }
      const nextId = resolveEntryPatientId(entry);
      if (!nextId) return false;
      const nextKey = resolveEntrySelectionKey(entry) ?? nextId;
      const currentKey = resolveEncounterSelectionKey(selectedContext) ?? localSelectedKey;
      const isSwitchingKey = Boolean(currentKey && nextKey && currentKey !== nextKey);
      const currentPatientId = resolveEntryPatientId(selected) ?? selectedContext?.patientId ?? undefined;
      const isSwitchingPatient = Boolean(currentPatientId && nextId && currentPatientId !== nextId);
      if (!requestOptions?.ignoreDraft && draftDirty && isSwitchingKey) {
        const message = '未保存下書きがあるため患者切替を保留しています。保存または破棄を選択してください。';
        setDraftSwitchDialog({
          open: true,
          entry,
          currentPatientId,
          currentName: selected?.name ?? selectedContext?.patientId,
          controlId: options.controlId,
          trigger: options.trigger,
          note: options.note,
        });
        logPatientSwitch({
          phase: 'approval',
          outcome: 'warning',
          patientId: nextId,
          appointmentId: entry.appointmentId,
          note: message,
          controlId: `${options.controlId}-draft-warning`,
          details: {
            trigger: 'draft_dirty',
            currentPatientId,
            blockedReasons: ['draft_dirty'],
          },
        });
        return false;
      }
      if (isSwitchingPatient && isSwitchingKey) {
        setConfirmSwitchDialog({
          open: true,
          entry,
          current: selected,
          currentPatientId,
          controlId: options.controlId,
          trigger: options.trigger,
          note: options.note,
        });
        return false;
      }
      return commitPatientSwitch(entry, {
        controlId: options.controlId,
        trigger: options.trigger,
        currentPatientId,
        note: options.note ?? 'manual switch',
      });
    },
    [
      commitPatientSwitch,
      draftDirty,
      localSelectedKey,
      logPatientSwitch,
      selected?.name,
      selected,
      selectedContext?.appointmentId,
      selectedContext?.patientId,
      selectedContext?.receptionId,
      switchLocked,
      switchLockedReason,
    ],
  );

  useEffect(() => {
    if (!pendingSwitchRef.current) return;
    if (draftDirty) return;
    const pending = pendingSwitchRef.current;
    pendingSwitchRef.current = null;
    requestPatientSwitch(
      pending.entry,
      {
        controlId: pending.controlId,
        trigger: pending.trigger,
        note: pending.note ?? 'draft_saved_switch',
      },
      { ignoreDraft: true },
    );
  }, [draftDirty, requestPatientSwitch]);

  useEffect(() => {
    const currentPatientId = resolveEntryPatientId(selected) ?? selectedContext?.patientId ?? undefined;
    const baselineMemo = patientBaseline?.memo;
    const initialMemo = baselineMemo ?? selected?.note ?? '';
    const patientChanged = memoPatientIdRef.current !== currentPatientId;
    if (patientChanged) {
      memoPatientIdRef.current = currentPatientId;
      setMemoEditing(false);
      setMemoDraft(initialMemo);
      onDraftDirtyChange?.({
        dirty: false,
        patientId: resolveEntryPatientId(selected),
        appointmentId: selected?.appointmentId,
        receptionId: selected?.receptionId,
        visitDate: selected?.visitDate,
        dirtySources: [],
      });
      return;
    }

    setMemoDraft((prev) => {
      if (memoEditing) return prev;
      if (draftDirty) return prev;
      return initialMemo;
    });
  }, [
    draftDirty,
    memoEditing,
    onDraftDirtyChange,
    patientBaseline?.memo,
    selected?.appointmentId,
    selected?.note,
    selected?.receptionId,
    selected?.visitDate,
    selectedContext?.patientId,
  ]);

  useEffect(() => {
    const nextKey = resolveEncounterSelectionKey(selectedContext);
    if (!nextKey) return;
    setLocalSelectedKey((prev) => (prev === nextKey ? prev : nextKey));
  }, [
    selectedContext?.appointmentId,
    selectedContext?.encounterKey,
    selectedContext?.patientId,
    selectedContext?.receptionId,
    selectedContext?.scheduleKey,
  ]);

  useEffect(() => {
    if (!auditOpen) return;
    setAuditSnapshot(getAuditEventLog());
  }, [auditOpen]);

  const navigateToReception = (intent: 'appointment_change' | 'appointment_cancel') => {
    const keywordValue = selected?.appointmentId ?? selected?.patientId ?? selected?.receptionId ?? '';
    const receptionDate =
      normalizeVisitDate(selected?.visitDate) ?? normalizeVisitDate(selectedContext?.visitDate) ?? undefined;
    const carryover: ReceptionCarryoverParams = { ...(receptionCarryover ?? {}) };
    if (keywordValue) carryover.kw = keywordValue;
    if (receptionDate) carryover.date = receptionDate;
    appNav.openReception({
      intent,
      section: 'appointment',
      carryover,
      visitDate: receptionDate,
    });
    recordChartsAuditEvent({
      action: 'CHARTS_NAVIGATE_RECEPTION',
      outcome: 'success',
      patientId: resolveEntryPatientId(selected) ?? selectedContext?.patientId ?? localSelectedKey,
      appointmentId: selected?.appointmentId,
      note: `navigate to reception intent=${intent}`,
      dataSourceTransition: flags.dataSourceTransition,
      cacheHit: flags.cacheHit,
      missingMaster: flags.missingMaster,
      fallbackUsed: flags.fallbackUsed,
      runId: flags.runId,
    });
  };

  const navigateToPatientsBasic = () => {
    const kwCandidate = receptionCarryover?.kw ?? selectedPatientId ?? selectedContext?.patientId;
    const carryover: ReceptionCarryoverParams = { ...(receptionCarryover ?? {}) };
    if (kwCandidate) carryover.kw = kwCandidate;
    appNav.openPatients({
      intent: 'basic',
      runId: flags.runId,
      patientId: selectedPatientId ?? selectedContext?.patientId,
      encounter: selectedContext ?? undefined,
      carryover,
    });

    recordOutpatientFunnel('charts_patient_sidepane', {
      runId: flags.runId,
      cacheHit: flags.cacheHit ?? false,
      missingMaster: flags.missingMaster ?? false,
      dataSourceTransition: flags.dataSourceTransition ?? 'snapshot',
      fallbackUsed: flags.fallbackUsed ?? false,
      action: 'deeplink',
      outcome: 'started',
      note: 'intent=basic',
    });

    logUiState({
      action: 'patient_fetch',
      screen: 'charts',
      controlId: 'patients-deeplink-basic',
      runId: flags.runId,
      cacheHit: flags.cacheHit,
      missingMaster: flags.missingMaster,
      dataSourceTransition: flags.dataSourceTransition,
      fallbackUsed: flags.fallbackUsed,
      details: {
        patientId: selectedPatientId,
        intent: 'basic',
      },
    });
  };

  const formatVisit = (entry: ReceptionEntry) => {
    const date = entry.visitDate ?? '日付不明';
    const time = entry.appointmentTime ? ` ${entry.appointmentTime}` : '';
    return `${date}${time}`;
  };

  const historyEntriesForSelected = useMemo(() => {
    if (!selectedPatientId) return [];
    const list = entries.filter((entry) => resolveEntryPatientId(entry) === selectedPatientId);
    const sorted = [...list].sort((a, b) => (b.visitDate ?? '').localeCompare(a.visitDate ?? ''));

    const now = new Date();
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const within90 = sorted.filter((entry) => {
      if (!entry.visitDate) return false;
      const parsed = new Date(entry.visitDate);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed >= cutoff;
    });

    const keywordLower = historyKeyword.trim().toLowerCase();
    const keywordFiltered = keywordLower
      ? sorted.filter((entry) =>
          [entry.department, entry.physician, entry.insurance, entry.status, entry.receptionId, entry.appointmentId]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(keywordLower)),
        )
      : sorted;

    const fromFiltered = historyFrom
      ? keywordFiltered.filter((entry) => (entry.visitDate ?? '') >= historyFrom)
      : keywordFiltered;
    const toFiltered = historyTo
      ? fromFiltered.filter((entry) => (entry.visitDate ?? '') <= historyTo)
      : fromFiltered;

    if (historyTab === 'recent') return sorted.slice(0, 3);
    if (historyTab === 'past90') return within90;
    return toFiltered;
  }, [entries, historyFrom, historyKeyword, historyTab, historyTo, selectedPatientId]);

  const isCurrentEncounterRow = (entry: ReceptionEntry) => {
    if (!selectedContext) return false;
    if (selectedContext.receptionId && entry.receptionId) return selectedContext.receptionId === entry.receptionId;
    if (selectedContext.appointmentId && entry.appointmentId) return selectedContext.appointmentId === entry.appointmentId;
    const entryPatientId = resolveEntryPatientId(entry);
    return selectedContext.patientId === entryPatientId && !selectedContext.receptionId && !selectedContext.appointmentId;
  };

  const jumpToEncounter = (entry: ReceptionEntry) => {
    const switched = requestPatientSwitch(entry, {
      controlId: 'patient-switch-history',
      trigger: 'history_jump',
      note: 'history jump',
    });
    if (!switched) return;
    recordOutpatientFunnel('charts_patient_sidepane', {
      runId: flags.runId,
      cacheHit: flags.cacheHit ?? false,
      missingMaster: flags.missingMaster ?? false,
      dataSourceTransition: flags.dataSourceTransition ?? 'snapshot',
      fallbackUsed: flags.fallbackUsed ?? false,
      action: 'history_jump',
      outcome: 'started',
      note: `receptionId=${entry.receptionId ?? '—'} appointmentId=${entry.appointmentId ?? '—'}`,
    });
    scrollTo('timeline');
  };

  const importantLabel = useMemo(() => {
    if (!selected) return '患者未選択';
    const id = resolveEntryPatientId(selected) ?? selected.id;
    const receptionId = selected.receptionId ? `受付ID:${selected.receptionId}` : undefined;
    const insurance = selected.insurance ? `保険:${selected.insurance}` : undefined;
    const status = `状態:${selected.status}`;
    return [selected.name ?? '氏名未登録', `患者ID:${id}`, receptionId, insurance, status].filter(Boolean).join(' ｜ ');
  }, [selected]);

  type DiffRow = {
    key: string;
    label: string;
    before: string;
    after: string;
  };

  const diffRows: DiffRow[] = useMemo(() => {
    const before = {
      name: patientBaseline?.name ?? selected?.name ?? '',
      kana: patientBaseline?.kana ?? selected?.kana ?? '',
      birthDate: patientBaseline?.birthDate ?? selected?.birthDate ?? '',
      sex: patientBaseline?.sex ?? selected?.sex ?? '',
      phone: patientBaseline?.phone ?? '',
      zip: patientBaseline?.zip ?? '',
      address: patientBaseline?.address ?? '',
      insurance: patientBaseline?.insurance ?? selected?.insurance ?? '',
      memo: patientBaseline?.memo ?? selected?.note ?? '',
    };
    const after = {
      ...before,
      memo: memoDraft,
    };
    const safe = (value: string) => (value?.trim?.() ? value : '—');
    return [
      { key: 'name', label: '氏名', before: safe(before.name), after: safe(after.name) },
      { key: 'kana', label: 'カナ', before: safe(before.kana), after: safe(after.kana) },
      { key: 'birthDate', label: '生年月日', before: safe(before.birthDate), after: safe(after.birthDate) },
      { key: 'sex', label: '性別', before: safe(before.sex), after: safe(after.sex) },
      { key: 'address', label: '住所', before: safe(before.address), after: safe(after.address) },
      { key: 'phone', label: '電話', before: safe(before.phone), after: safe(after.phone) },
      { key: 'insurance', label: '保険/自費', before: safe(before.insurance), after: safe(after.insurance) },
      { key: 'memo', label: 'メモ', before: safe(before.memo), after: safe(after.memo) },
    ];
  }, [memoDraft, patientBaseline?.address, patientBaseline?.birthDate, patientBaseline?.insurance, patientBaseline?.kana, patientBaseline?.memo, patientBaseline?.name, patientBaseline?.phone, patientBaseline?.sex, selected?.birthDate, selected?.insurance, selected?.kana, selected?.name, selected?.note, selected?.sex]);

  const changedKeys = useMemo(() => {
    return diffRows.filter((row) => row.before !== row.after).map((row) => row.key);
  }, [diffRows]);

  const focusDraftSaveButton = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const button = document.getElementById('charts-action-draft') as HTMLButtonElement | null;
    if (!button) return false;
    try {
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      button.focus({ preventScroll: true });
    } catch {
      // focus が使えない環境はスキップ
    }
    return true;
  }, []);

  const draftSwitchCurrentLabel = useMemo(() => {
    const id = resolveEntryPatientId(selected) ?? selectedContext?.patientId ?? '不明';
    const name = selected?.name ?? draftSwitchDialog.currentName ?? '患者未選択';
    return `${name}（患者ID:${id}）`;
  }, [draftSwitchDialog.currentName, selected?.name, selected?.patientId, selectedContext?.patientId]);

  const draftSwitchNextLabel = useMemo(() => {
    if (!draftSwitchDialog.entry) return '不明';
    const id = resolveEntryPatientId(draftSwitchDialog.entry) ?? '不明';
    const name = draftSwitchDialog.entry.name ?? '患者未登録';
    const receptionId = draftSwitchDialog.entry.receptionId ? ` / 受付ID:${draftSwitchDialog.entry.receptionId}` : '';
    return `${name}（患者ID:${id}${receptionId}）`;
  }, [draftSwitchDialog.entry]);

  const handleDraftDialogClose = () => {
    setDraftSwitchDialog({ open: false });
  };

  const handleDraftSaveAndSwitch = () => {
    if (!draftSwitchDialog.entry) {
      handleDraftDialogClose();
      return;
    }
    pendingSwitchRef.current = {
      entry: draftSwitchDialog.entry,
      controlId: `${draftSwitchDialog.controlId ?? 'patient-switch'}-after-save`,
      trigger: 'draft_saved',
      note: 'draft_saved_switch',
      currentPatientId: draftSwitchDialog.currentPatientId,
    };
    setDraftSwitchDialog({ open: false });
    focusDraftSaveButton();
  };

  const handleDraftDiscardAndSwitch = () => {
    if (!draftSwitchDialog.entry) {
      handleDraftDialogClose();
      return;
    }
    const entry = draftSwitchDialog.entry;
    setDraftSwitchDialog({ open: false });
    requestPatientSwitch(
      entry,
      {
        controlId: `${draftSwitchDialog.controlId ?? 'patient-switch'}-discard`,
        trigger: 'draft_discard',
        note: 'draft_discarded_switch',
      },
      { ignoreDraft: true },
    );
  };

  const draftReasonLines = useMemo(() => {
    const unique = Array.from(new Set(draftDirtySources)).filter(Boolean) as DraftDirtySource[];
    const labels = unique.map((source) => draftSourceLabels[source]).filter(Boolean);
    if (labels.length === 0 && draftDirty) {
      labels.push('未保存下書きがあります（詳細は未判定）');
    }
    return labels.slice(0, 2);
  }, [draftDirty, draftDirtySources]);

  const confirmSwitchCurrentInfo = useMemo(() => {
    const entry = confirmSwitchDialog.current;
    const id =
      resolveEntryPatientId(entry) ??
      confirmSwitchDialog.currentPatientId ??
      resolveEntryPatientId(selected) ??
      selectedContext?.patientId ??
      '不明';
    const name = entry?.name ?? selected?.name ?? '患者未選択';
    const time = entry ? resolveEntryTimeBadge(entry) : null;
    return {
      name,
      id,
      birthDate: entry?.birthDate ?? '—',
      sex: entry?.sex ?? '—',
      status: entry?.status ?? '—',
      receptionId: entry?.receptionId ?? '—',
      department: entry?.department ?? '—',
      physician: entry?.physician ?? '—',
      timeLabel: time ? `${time.label}${time.time}` : '—',
    };
  }, [confirmSwitchDialog.current, confirmSwitchDialog.currentPatientId, selected, selectedContext?.patientId]);

  const confirmSwitchNextInfo = useMemo(() => {
    const entry = confirmSwitchDialog.entry;
    const id = resolveEntryPatientId(entry) ?? '不明';
    const time = entry ? resolveEntryTimeBadge(entry) : null;
    return {
      name: entry?.name ?? '患者未登録',
      id,
      birthDate: entry?.birthDate ?? '—',
      sex: entry?.sex ?? '—',
      status: entry?.status ?? '—',
      receptionId: entry?.receptionId ?? '—',
      department: entry?.department ?? '—',
      physician: entry?.physician ?? '—',
      timeLabel: time ? `${time.label}${time.time}` : '—',
    };
  }, [confirmSwitchDialog.entry]);

  const handleConfirmSwitchDialogClose = () => {
    const entry = confirmSwitchDialog.entry;
    const nextId = entry ? resolveEntryPatientId(entry) : undefined;
    if (entry && nextId) {
      logPatientSwitch({
        phase: 'approval',
        outcome: 'blocked',
        patientId: nextId,
        appointmentId: entry.appointmentId,
        note: 'user_cancelled',
        controlId: `${confirmSwitchDialog.controlId ?? 'patient-switch'}-cancelled`,
        details: {
          trigger: 'confirm',
          currentPatientId: confirmSwitchDialog.currentPatientId,
          blockedReasons: ['user_cancelled'],
        },
      });
    }
    setConfirmSwitchDialog({ open: false });
  };

  const handleConfirmSwitchCommit = () => {
    const entry = confirmSwitchDialog.entry;
    if (!entry) {
      setConfirmSwitchDialog({ open: false });
      return;
    }
    setConfirmSwitchDialog({ open: false });
    commitPatientSwitch(entry, {
      controlId: confirmSwitchDialog.controlId ?? 'patient-switch',
      trigger: confirmSwitchDialog.trigger ?? 'confirm',
      currentPatientId: confirmSwitchDialog.currentPatientId,
      note: confirmSwitchDialog.note ?? 'manual switch',
    });
  };

  const openAudit = () => {
    if (!isLocalHistoryDebugEnabled) return;
    setAuditSnapshot(getAuditEventLog());
    setAuditOpen(true);
    recordOutpatientFunnel('charts_patient_sidepane', {
      runId: flags.runId,
      cacheHit: flags.cacheHit ?? false,
      missingMaster: flags.missingMaster ?? false,
      dataSourceTransition: flags.dataSourceTransition ?? 'snapshot',
      fallbackUsed: flags.fallbackUsed ?? false,
      action: 'audit_open',
      outcome: 'started',
      note: `patientId=${selectedPatientId ?? '—'}`,
    });
  };

  const closeAudit = () => setAuditOpen(false);

  const relevantAuditEvents = useMemo(() => {
    const list = [...auditSnapshot].reverse();
    const filtered = list.filter((record) => {
      const payload = (record.payload ?? {}) as Record<string, unknown>;
      const details = (payload.details ?? {}) as Record<string, unknown>;
      const payloadPatientId =
        (payload.patientId as string | undefined) ??
        (details.patientId as string | undefined) ??
        ((payload.auditEvent as Record<string, unknown> | undefined)?.patientId as string | undefined);
      if (!selectedPatientId) return true;
      if (!payloadPatientId) return false;
      return payloadPatientId === selectedPatientId;
    });
    return filtered.slice(0, 5);
  }, [auditSnapshot, selectedPatientId]);

  const describeAudit = (record: AuditEventRecord) => {
    const payload = (record.payload ?? {}) as Record<string, unknown>;
    const details = (payload.details ?? {}) as Record<string, unknown>;
    const action = (payload.action as string | undefined) ?? ((payload.auditEvent as any)?.action as string | undefined) ?? 'unknown';
    const outcome = (payload.outcome as string | undefined) ?? ((payload.auditEvent as any)?.outcome as string | undefined) ?? '—';
    const runId = (payload.runId as string | undefined) ?? (details.runId as string | undefined) ?? record.runId ?? '—';
    const traceId = (details.traceId as string | undefined) ?? (payload.traceId as string | undefined) ?? '—';
    const changed =
      (payload.changedKeys as unknown) ??
      (details.changedKeys as unknown) ??
      ((payload.auditEvent as any)?.changedKeys as unknown);
    const changedText = Array.isArray(changed) ? changed.join(', ') : typeof changed === 'string' ? changed : undefined;
    return { action, outcome, runId, traceId, changedText };
  };

  const statusOptions: ReceptionStatus[] = ['予約', '受付中', '診療中', '会計待ち', '会計済み'];

  const toggleStatusFilter = useCallback((status: ReceptionStatus) => {
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]));
  }, []);

  const hasCandidateFilters = Boolean(
    keyword.trim() || statusFilter.length > 0 || deptFilter.trim() || physFilter.trim(),
  );
  const isCurrentInCandidates = Boolean(selected && candidateEntries.some((entry) => entry.id === selected.id));
  const showCurrentHiddenNotice = Boolean(selected && hasCandidateFilters && !isCurrentInCandidates);

  const clearCandidateFilters = useCallback(() => {
    setKeyword('');
    setStatusFilter([]);
    setDeptFilter('');
    setPhysFilter('');
  }, []);

  return (
    <section
      className="patients-tab"
      aria-live={resolveAriaLive(tone)}
      aria-atomic="false"
      data-run-id={resolvedRunId}
    >
      <ToneBanner
        tone={tone}
        message={toneMessage}
        runId={flags.runId}
        ariaLive={flags.missingMaster || flags.fallbackUsed ? 'assertive' : 'polite'}
      />
      {appointmentBanner && (
        <ToneBanner
          tone={appointmentBanner.tone}
          message={appointmentBanner.message}
          runId={flags.runId}
          destination="予約/来院リスト"
          nextAction="必要に応じて再取得"
          ariaLive={appointmentBanner.tone === 'info' ? 'polite' : 'assertive'}
        />
      )}
      <div className="patients-tab__important">
        <button
          type="button"
        className="patients-tab__important-main"
          onClick={() => scrollTo('basic')}
          aria-label="患者基本情報へ移動"
        >
          <strong className="patients-tab__important-title">{patientBaseline?.name ?? selected?.name ?? '患者未選択'}</strong>
          <span className="patients-tab__important-sub">{importantLabel}</span>
        </button>
        <div className="patients-tab__important-actions" role="group" aria-label="患者サイドペイン操作">
          <button type="button" className="patients-tab__ghost" onClick={() => scrollTo('insurance')}>
            基本/保険へ
          </button>
          <button type="button" className="patients-tab__ghost" onClick={() => scrollTo('diff')}>
            差分へ{changedKeys.length > 0 ? `（${changedKeys.length}件）` : ''}
          </button>
          {isLocalHistoryDebugEnabled ? (
            <button type="button" className="patients-tab__ghost" onClick={openAudit}>
              操作履歴（ローカル）
            </button>
          ) : null}
        </div>
      </div>

      <details className="patients-tab__meta" data-run-id={resolvedRunId}>
        <summary className="patients-tab__meta-summary">運用メタ（dataSourceTransition / master / cache）</summary>
        <div className="patients-tab__meta-body">
          <div className="patients-tab__meta-transition">
            <p className="patients-tab__meta-label">dataSourceTransition</p>
            <strong>{transitionMeta.label}</strong>
            <p className="patients-tab__meta-desc">{transitionMeta.description}</p>
          </div>
          <div className="patients-tab__badges">
            <StatusPill
              className="patients-tab__badge"
              label="missingMaster"
              value={flags.missingMaster ? 'true' : 'false'}
              tone={flags.missingMaster ? 'warning' : 'success'}
              ariaLive={flags.missingMaster ? 'assertive' : 'polite'}
              runId={flags.runId}
            />
            <StatusPill
              className="patients-tab__badge"
              label="cacheHit"
              value={flags.cacheHit ? 'true' : 'false'}
              tone={flags.cacheHit ? 'success' : 'warning'}
              runId={flags.runId}
            />
            <StatusPill
              className="patients-tab__badge"
              label="fallbackUsed"
              value={flags.fallbackUsed ? 'true' : 'false'}
              tone={flags.fallbackUsed ? 'warning' : 'info'}
              ariaLive={flags.fallbackUsed ? 'assertive' : 'polite'}
              runId={flags.runId}
            />
            <StatusPill className="patients-tab__badge" label="role" value={session.role} tone="info" runId={flags.runId} />
          </div>
          {auditEvent ? (
            <div className="patients-tab__meta-audit" aria-label="監査イベント要約">
              <p className="patients-tab__meta-label">auditEvent</p>
              <p className="patients-tab__meta-desc">
                {Object.entries(auditEvent)
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(' ｜ ')}
              </p>
            </div>
          ) : null}
        </div>
      </details>

      <div className="patients-tab__list-controls">
        <div className="patients-tab__list-head">
          <div className="patients-tab__list-meta" aria-label="外来一覧の更新時刻と件数">
            <span className="patients-tab__list-fetched">
              最終更新: <strong>{formatFetchedAt(listFetchedAt)}</strong>
            </span>
            <span className="patients-tab__list-count">
              表示: <strong>{candidateEntries.length}</strong>件 / 取得: <strong>{entries.length}</strong>件
            </span>
          </div>
          <div className="patients-tab__list-actions" role="group" aria-label="外来一覧操作">
            <button
              type="button"
              className="patients-tab__ghost"
              onClick={() => onRefetchList?.()}
              disabled={!onRefetchList || isRefetchingList}
            >
              {isRefetchingList ? '更新中…' : '更新'}
            </button>
            <button
              type="button"
              className="patients-tab__ghost"
              onClick={() => onLoadMore?.()}
              disabled={!onLoadMore || !hasNextPage || isLoadingMore}
            >
              {isLoadingMore ? '読み込み中…' : 'さらに読み込む'}
            </button>
          </div>
        </div>

        <div className="patients-tab__filters" aria-label="外来一覧フィルタ">
          <label className="patients-tab__search">
            <span>検索（氏名/カナ/ID）</span>
            <input
              id="charts-patient-search"
              type="search"
              placeholder="氏名 / カナ / ID"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              aria-label="患者検索キーワード"
            />
          </label>

          <div className="patients-tab__filter-row">
            <div className="patients-tab__chips" role="group" aria-label="ステータスフィルタ">
              <button
                type="button"
                className={`patients-tab__chip${statusFilter.length === 0 ? ' is-active' : ''}`}
                onClick={() => setStatusFilter([])}
              >
                すべて
                <span className="patients-tab__chip-count">{baseCandidates.length}</span>
              </button>
              {statusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`patients-tab__chip${statusFilter.includes(status) ? ' is-active' : ''}`}
                  onClick={() => toggleStatusFilter(status)}
                >
                  {status}
                  <span className="patients-tab__chip-count">{statusCounts[status]}</span>
                </button>
              ))}
            </div>

            <label className="patients-tab__select">
              <span>診療科</span>
              <select value={deptFilter} onChange={(event) => setDeptFilter(event.target.value)}>
                <option value="">すべて</option>
                {departmentOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="patients-tab__select">
              <span>担当</span>
              <select value={physFilter} onChange={(event) => setPhysFilter(event.target.value)}>
                <option value="">すべて</option>
                {physicianOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="patients-tab__select">
              <span>並び替え</span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as PatientListSortKey)}
              >
                <option value="time">時刻順</option>
                <option value="status">ステータス順</option>
                <option value="name">氏名</option>
                <option value="id">ID</option>
              </select>
            </label>

            <button
              type="button"
              className="patients-tab__ghost patients-tab__clear"
              onClick={clearCandidateFilters}
              disabled={!hasCandidateFilters}
            >
              クリア
            </button>
          </div>

          <div className="patients-tab__edit-guard" aria-live={infoLive}>
            {guardMessage}
          </div>
        </div>
      </div>

      <div className="patients-tab__body">
        <div className="patients-tab__table" aria-label="外来一覧（患者切替）">
          {showCurrentHiddenNotice ? (
            <div className="patients-tab__filter-notice" role="status" aria-live={infoLive}>
              <span>現在の患者は検索結果に含まれていません（フィルタ中）</span>
              <button type="button" className="patients-tab__ghost" onClick={clearCandidateFilters}>
                検索をクリア
              </button>
            </div>
          ) : null}

          {entries.length === 0 && (
            <article className="patients-tab__row" data-run-id={resolvedRunId}>
              <div className="patients-tab__row-meta">
                <span className="patients-tab__row-id">患者データなし</span>
                <strong>外来 API 応答を待機</strong>
              </div>
              <p className="patients-tab__row-detail">受付からの取得結果がまだ届いていません。</p>
              <span className="patients-tab__row-status">tone={tone}</span>
            </article>
          )}
          {entries.length > 0 && candidateEntries.length === 0 ? (
            <article className="patients-tab__row" data-run-id={resolvedRunId}>
              <div className="patients-tab__row-meta">
                <span className="patients-tab__row-id">該当なし</span>
                <strong>条件に一致する患者がいません</strong>
              </div>
              <p className="patients-tab__row-detail">
                検索/フィルタ条件を見直してください。
              </p>
              <span className="patients-tab__row-status">
                <button type="button" className="patients-tab__ghost" onClick={clearCandidateFilters}>
                  条件をクリア
                </button>
              </span>
            </article>
          ) : null}

          {candidateEntries.map((patient) => {
            const isSelected = Boolean(selected && patient.id === selected.id);
            const rowPatientId = resolveEntryPatientId(patient) ?? '不明';
            const time = resolveEntryTimeBadge(patient);
            const memo = (patient.note ?? '').trim();
            const insurance = (patient.insurance ?? '').trim();
            return (
              <button
                key={patient.id}
                type="button"
                className={`patients-tab__row${isSelected ? ' patients-tab__row--selected' : ''}`}
                data-run-id={resolvedRunId}
                disabled={switchLocked}
                onClick={() => handleSelect(patient)}
              >
                <div className="patients-tab__row-top">
                  <div className="patients-tab__row-time" aria-label="時刻">
                    {time ? (
                      <>
                        <span className="patients-tab__row-time-label">{time.label}</span>
                        <strong className="patients-tab__row-time-value">{time.time}</strong>
                      </>
                    ) : (
                      <span className="patients-tab__row-time-missing">—</span>
                    )}
                  </div>
                  <div className="patients-tab__row-pills" aria-label="状態">
                    <StatusPill tone={resolveStatusTone(patient.status)} size="xs" className="patients-tab__row-pill">
                      {patient.status}
                    </StatusPill>
                    {isSelected ? (
                      <StatusPill tone="info" size="xs" className="patients-tab__row-pill patients-tab__row-pill--current">
                        現在
                      </StatusPill>
                    ) : null}
                  </div>
                </div>
                <div className="patients-tab__row-main">
                  <strong className="patients-tab__row-name">{patient.name ?? '患者未登録'}</strong>
                  <span className="patients-tab__row-patientid">ID:{rowPatientId}</span>
                </div>
                <div className="patients-tab__row-sub">
                  <span className="patients-tab__row-subitem">{patient.department ?? '診療科不明'}</span>
                  <span className="patients-tab__row-subitem">{patient.physician ?? '医師不明'}</span>
                  {insurance ? <span className="patients-tab__row-subitem">保険:{insurance}</span> : null}
                  <span className={`patients-tab__row-memo${memo ? '' : ' is-empty'}`}>{memo || 'メモなし'}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="patients-tab__detail" role="group" aria-label="患者サイドペイン（基本/保険/履歴/差分）">
          {!selected && <p className="patients-tab__detail-empty">患者を選択すると詳細が表示されます。</p>}
          {selected && (
            <>
              <div className="patients-tab__card" ref={basicRef}>
                <div className="patients-tab__card-header">
                  <h3>基本情報（閲覧）</h3>
                  <div className="patients-tab__card-actions" role="group" aria-label="基本情報操作">
                    <button
                      type="button"
                      onClick={() => setPatientEditDialogOpen(true)}
                      disabled={!canEditPatientInfoNow}
                      title={
                        canEditPatientInfoNow
                          ? 'Charts から安全に更新（差分確認/監査/再試行）'
                          : patientEditBlockedReason ?? '編集不可'
                      }
                      className="patients-tab__primary"
                    >
                      基本を編集（Charts）
                    </button>
                    <button
                      type="button"
                      onClick={navigateToPatientsBasic}
                      disabled={!canDeepLinkPatientsBasic}
                      className="patients-tab__ghost"
                      title={canDeepLinkPatientsBasic ? 'Patients 画面で編集（代替導線）' : '編集不可'}
                    >
                      Patients で開く
                    </button>
                    <button
                      type="button"
                      onClick={() => patientBaselineQuery.refetch()}
                      disabled={!selectedPatientId}
                      className="patients-tab__ghost"
                    >
                      再取得
                    </button>
                  </div>
                </div>
                <div className="patients-tab__grid">
                  <div className="patients-tab__kv">
                    <span>患者ID</span>
                    <strong>{selected.patientId ?? 'ID不明'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>受付ID</span>
                    <strong>{selected.receptionId ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>氏名</span>
                    <strong>{patientBaseline?.name ?? selected.name ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>カナ</span>
                    <strong>{patientBaseline?.kana ?? selected.kana ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>生年月日</span>
                    <strong>{patientBaseline?.birthDate ?? selected.birthDate ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>性別</span>
                    <strong>{patientBaseline?.sex ?? selected.sex ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>住所</span>
                    <strong>{patientBaseline?.address ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>電話</span>
                    <strong>{patientBaseline?.phone ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>診療科</span>
                    <strong>{selected.department ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>担当医</span>
                    <strong>{selected.physician ?? '—'}</strong>
                  </div>
                </div>
                <div className="patients-tab__memo">
                  <div className="patients-tab__memo-header">
                    <h4>患者メモ</h4>
                    <div className="patients-tab__memo-actions">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canEditMemo) return;
                          setMemoEditing((prev) => !prev);
                          recordOutpatientFunnel('charts_patient_sidepane', {
                            runId: flags.runId,
                            cacheHit: flags.cacheHit ?? false,
                            missingMaster: flags.missingMaster ?? false,
                            dataSourceTransition: flags.dataSourceTransition ?? 'snapshot',
                            fallbackUsed: flags.fallbackUsed ?? false,
                            action: 'memo_edit_toggle',
                            outcome: 'started',
                            note: `next=${String(!memoEditing)}`,
                          });
                        }}
                        disabled={!canEditMemo}
                        title={canEditMemo ? 'メモ編集を開始/終了' : editBlockedByMaster ? `ガード中: ${editBlockedReason}` : `role=${session.role} のため編集不可`}
                        className="patients-tab__ghost"
                      >
                        {memoEditing ? 'メモ編集を終了' : 'メモ編集'}
                      </button>
                      {memoEditing ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMemoDraft(patientBaseline?.memo ?? selected?.note ?? '');
                            setMemoEditing(false);
                            setDiffHighlightKeys([]);
                          }}
                          className="patients-tab__ghost"
                        >
                          変更を破棄
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <textarea
                    id="patients-memo"
                    name="patientsMemo"
                    value={memoDraft || 'メモなし'}
                    onChange={(event) => {
                      const next = event.target.value;
                      setMemoDraft(next);
                      if (memoEditing && canEditMemo) {
                        onDraftDirtyChange?.({
                          dirty: true,
                          patientId: selected.patientId,
                          appointmentId: selected.appointmentId,
                          receptionId: selected.receptionId,
                          visitDate: selected.visitDate,
                          dirtySources: ['patient_memo'],
                        });
                      }
                    }}
                    readOnly={!memoEditing || !canEditMemo}
                    aria-readonly={!memoEditing || !canEditMemo}
                    rows={3}
                  />
                  {!canEditMemo && <small className="patients-tab__detail-guard">医師/看護師のみメモ編集可（ガード条件により無効化されます）。</small>}
                </div>
              </div>

              <div className="patients-tab__card" ref={insuranceRef}>
                <div className="patients-tab__card-header">
                  <h3>保険・公費（閲覧）</h3>
                  <div className="patients-tab__card-actions" role="group" aria-label="保険操作">
                    <button
                      type="button"
                      onClick={() => setHokenjaDialogOpen(true)}
                      disabled={!selectedPatientId}
                      title="ORCA 保険者マスタを参照（患者情報は更新しません）"
                      className="patients-tab__primary"
                    >
                      保険者を参照
                    </button>
                    <button type="button" className="patients-tab__ghost" onClick={() => scrollTo('diff')}>
                      差分へ
                    </button>
                  </div>
                </div>
                <div className="patients-tab__grid">
                  <div className="patients-tab__kv">
                    <span>保険/自費</span>
                    <strong>{patientBaseline?.insurance ?? selected.insurance ?? '—'}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>受付ステータス</span>
                    <strong>{selected.status}</strong>
                  </div>
                  <div className="patients-tab__kv">
                    <span>予約時刻</span>
                    <strong>{selected.appointmentTime ?? '—'}</strong>
                  </div>
                </div>
                <small className="patients-tab__detail-guard">
                  保険/公費の更新はこの画面では行いません。必要な場合は ORCA 側で更新してください。
                </small>
              </div>

              <PatientInfoEditDialog
                open={patientEditDialogOpen}
                baseline={patientBaseline}
                fallback={fallbackPatientRecord}
                editAllowed={canEditPatientInfoNow}
                editBlockedReason={patientEditBlockedReason}
                meta={{
                  runId: flags.runId,
                  cacheHit: flags.cacheHit,
                  missingMaster: flags.missingMaster,
                  fallbackUsed: flags.fallbackUsed,
                  dataSourceTransition: flags.dataSourceTransition,
                  patientId: selectedPatientId,
                  appointmentId: selected?.appointmentId,
                  receptionId: selected?.receptionId,
                  visitDate: selected?.visitDate,
                  actorRole: session.role,
                }}
                onClose={() => {
                  setPatientEditDialogOpen(false);
                  onRequestRestoreFocus?.();
                }}
                onSaved={(result) => {
                  setAuditSnapshot(getAuditEventLog());
                  const details = (result.auditEvent as any)?.details as Record<string, unknown> | undefined;
                  const keys = Array.isArray(details?.changedKeys) ? (details?.changedKeys as string[]) : [];
                  if (keys.length > 0) {
                    setDiffHighlightKeys(keys);
                  }
                }}
                onRefetchBaseline={() => patientBaselineQuery.refetch()}
              />

              <div className="patients-tab__card">
                <div className="patients-tab__card-header">
                  <h3>履歴（過去受診/直近受診）</h3>
                  <div className="patients-tab__card-actions" role="group" aria-label="履歴タブ操作">
                    <button
                      type="button"
                      className={`patients-tab__tab${historyTab === 'recent' ? ' is-active' : ''}`}
                      onClick={() => setHistoryTab('recent')}
                    >
                      直近3回
                    </button>
                    <button
                      type="button"
                      className={`patients-tab__tab${historyTab === 'past90' ? ' is-active' : ''}`}
                      onClick={() => setHistoryTab('past90')}
                    >
                      過去90日
                    </button>
                    <button
                      type="button"
                      className={`patients-tab__tab${historyTab === 'all' ? ' is-active' : ''}`}
                      onClick={() => setHistoryTab('all')}
                    >
                      全期間検索
                    </button>
                  </div>
                </div>
                {historyTab === 'all' ? (
                  <div className="patients-tab__history-filters" aria-label="履歴検索フィルタ">
                    <label>
                      <span>キーワード</span>
                      <input
                        id="patients-history-keyword"
                        name="patientsHistoryKeyword"
                        type="search"
                        value={historyKeyword}
                        onChange={(event) => setHistoryKeyword(event.target.value)}
                        placeholder="診療科/医師/保険/受付ID"
                      />
                    </label>
                    <label>
                      <span>開始日</span>
                      <input
                        id="patients-history-from"
                        name="patientsHistoryFrom"
                        type="date"
                        value={historyFrom}
                        onChange={(event) => setHistoryFrom(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>終了日</span>
                      <input
                        id="patients-history-to"
                        name="patientsHistoryTo"
                        type="date"
                        value={historyTo}
                        onChange={(event) => setHistoryTo(event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
                <div className="patients-tab__history" aria-label="受診履歴一覧">
                  {historyEntriesForSelected.length === 0 ? (
                    <p className="patients-tab__detail-empty" role="status" aria-live={infoLive}>
                      該当する履歴がありません。必要なら「全期間検索」へ切り替え、期間やキーワードを見直してください。
                    </p>
                  ) : (
                    historyEntriesForSelected.map((entry) => {
                      const active = isCurrentEncounterRow(entry);
                      return (
                        <button
                          key={`${entry.id}-${entry.receptionId ?? entry.appointmentId ?? 'x'}`}
                          type="button"
                          className={`patients-tab__history-row${active ? ' is-active' : ''}`}
                          onClick={() => jumpToEncounter(entry)}
                          disabled={switchLocked}
                          aria-current={active ? 'true' : undefined}
                        >
                          <div className="patients-tab__history-main">
                            <strong>{formatVisit(entry)}</strong>
                            <span className="patients-tab__history-badge">{entry.status}</span>
                          </div>
                          <div className="patients-tab__history-sub">
                            <span>{entry.department ?? '診療科不明'}</span>
                            <span>{entry.physician ?? '医師不明'}</span>
                            <span>{entry.insurance ?? '保険不明'}</span>
                            {entry.receptionId ? <span>受付ID:{entry.receptionId}</span> : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="patients-tab__detail-actions" role="group" aria-label="関連導線">
                  <button type="button" onClick={() => navigateToReception('appointment_change')} className="patients-tab__ghost">
                    予約変更へ（受付）
                  </button>
                  <button type="button" onClick={() => navigateToReception('appointment_cancel')} className="patients-tab__ghost">
                    予約キャンセルへ（受付）
                  </button>
                  <button type="button" onClick={() => scrollTo('timeline')} className="patients-tab__ghost">
                    DocumentTimeline へ
                  </button>
                </div>
                <small className="patients-tab__detail-guard">Charts は導線のみ。予約操作は受付側で実行します。</small>
              </div>

              <div className="patients-tab__card" ref={diffRef}>
                <div className="patients-tab__card-header">
                  <h3>差分（変更前/変更後）</h3>
                  <div className="patients-tab__card-actions" role="group" aria-label="差分操作">
                    <button
                      type="button"
                      className="patients-tab__ghost"
                      onClick={() => {
                        setDiffHighlightKeys(changedKeys);
                        recordOutpatientFunnel('charts_patient_sidepane', {
                          runId: flags.runId,
                          cacheHit: flags.cacheHit ?? false,
                          missingMaster: flags.missingMaster ?? false,
                          dataSourceTransition: flags.dataSourceTransition ?? 'snapshot',
                          fallbackUsed: flags.fallbackUsed ?? false,
                          action: 'diff',
                          outcome: 'started',
                          note: `changed=${changedKeys.join(',') || 'none'}`,
                        });
                      }}
                    >
                      差分を強調
                    </button>
                    <button type="button" className="patients-tab__ghost" onClick={() => setDiffHighlightKeys([])}>
                      強調解除
                    </button>
                  </div>
                </div>
                <div className="patients-tab__diff">
                  <div className="patients-tab__diff-head">
                    <span>項目</span>
                    <span>変更前</span>
                    <span>変更後</span>
                  </div>
                  {diffRows.map((row) => {
                    const changed = row.before !== row.after;
                    const highlighted = diffHighlightKeys.includes(row.key);
                    return (
                      <div
                        key={row.key}
                        className={`patients-tab__diff-row${changed ? ' is-changed' : ''}${highlighted ? ' is-highlighted' : ''}`}
                        data-key={row.key}
                      >
                        <span className="patients-tab__diff-label">{row.label}</span>
                        <span className="patients-tab__diff-before">{row.before}</span>
                        <span className="patients-tab__diff-after">{row.after}</span>
                      </div>
                    );
                  })}
                </div>
                <small className="patients-tab__detail-guard">
                  変更前は直近取得値、変更後は現在の表示です。院内メモはローカル編集のみで、患者基本情報の保存は Charts の差分確認から official ORCA 更新を実行します。
                </small>
              </div>
            </>
          )}
        </div>
      </div>

      <FocusTrapDialog
        open={confirmSwitchDialog.open}
        role="alertdialog"
        title="患者切替の確認"
        description="現在の患者から別の患者へ切り替わります。誤患者防止のため内容を確認してください。"
        onClose={handleConfirmSwitchDialogClose}
        testId="charts-patient-switch-confirm-dialog"
      >
        <div className="patients-tab__switch-dialog" role="group" aria-label="患者切替の確認">
          <div className="patients-tab__switch-summary">
            <div className="patients-tab__switch-block">
              <span className="patients-tab__draft-label">現在の患者</span>
              <strong className="patients-tab__switch-title">
                {confirmSwitchCurrentInfo.name}（患者ID:{confirmSwitchCurrentInfo.id}）
              </strong>
              <div className="patients-tab__switch-lines" aria-label="現在の患者情報">
                <span>生年月日:{confirmSwitchCurrentInfo.birthDate}</span>
                <span>性別:{confirmSwitchCurrentInfo.sex}</span>
                <span>時刻:{confirmSwitchCurrentInfo.timeLabel}</span>
                <span>状態:{confirmSwitchCurrentInfo.status}</span>
                <span>診療科:{confirmSwitchCurrentInfo.department}</span>
                <span>担当:{confirmSwitchCurrentInfo.physician}</span>
                <span>受付ID:{confirmSwitchCurrentInfo.receptionId}</span>
              </div>
            </div>
            <div className="patients-tab__switch-block">
              <span className="patients-tab__draft-label">切替先</span>
              <strong className="patients-tab__switch-title">
                {confirmSwitchNextInfo.name}（患者ID:{confirmSwitchNextInfo.id}）
              </strong>
              <div className="patients-tab__switch-lines" aria-label="切替先の患者情報">
                <span>生年月日:{confirmSwitchNextInfo.birthDate}</span>
                <span>性別:{confirmSwitchNextInfo.sex}</span>
                <span>時刻:{confirmSwitchNextInfo.timeLabel}</span>
                <span>状態:{confirmSwitchNextInfo.status}</span>
                <span>診療科:{confirmSwitchNextInfo.department}</span>
                <span>担当:{confirmSwitchNextInfo.physician}</span>
                <span>受付ID:{confirmSwitchNextInfo.receptionId}</span>
              </div>
            </div>
          </div>

          <div className="patients-tab__switch-actions" role="group" aria-label="患者切替の操作">
            <button type="button" className="patients-tab__ghost" onClick={handleConfirmSwitchDialogClose}>
              キャンセル
            </button>
            <button type="button" className="patients-tab__primary" onClick={handleConfirmSwitchCommit}>
              切り替える
            </button>
          </div>
        </div>
      </FocusTrapDialog>

      <FocusTrapDialog
        open={draftSwitchDialog.open}
        role="alertdialog"
        title="未保存下書きがあります"
        description="患者を切り替える前に、下書きの扱いを選択してください。保存して切替を選ぶと、保存完了後に自動で切替します。"
        onClose={() => {
          logPatientSwitch({
            phase: 'approval',
            outcome: 'blocked',
            patientId: resolveEntryPatientId(draftSwitchDialog.entry),
            appointmentId: draftSwitchDialog.entry?.appointmentId,
            note: 'draft_dialog_cancelled',
            controlId: `${draftSwitchDialog.controlId ?? 'patient-switch'}-draft-cancel`,
            details: {
              trigger: 'draft_dialog_cancel',
              currentPatientId: resolveEntryPatientId(selected) ?? selectedContext?.patientId,
              blockedReasons: ['draft_dirty'],
            },
          });
          handleDraftDialogClose();
        }}
        testId="charts-draft-switch-dialog"
      >
        <div className="patients-tab__draft-dialog" role="group" aria-label="下書き未保存の患者切替">
          <div className="patients-tab__draft-summary">
            <div>
              <span className="patients-tab__draft-label">現在の患者</span>
              <strong>{draftSwitchCurrentLabel}</strong>
            </div>
            <div>
              <span className="patients-tab__draft-label">切替先</span>
              <strong>{draftSwitchNextLabel}</strong>
            </div>
          </div>
          {draftReasonLines.length > 0 ? (
            <ul className="patients-tab__draft-reasons" aria-label="未保存下書きの内容">
              {draftReasonLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="patients-tab__draft-reason">
            未保存下書きがあるため切替を保留しています。保存または破棄を選択してください（Shift+Enter で下書き保存）。
          </p>
          <div className="patients-tab__draft-actions">
            <button type="button" onClick={handleDraftDialogClose}>
              キャンセル
            </button>
            <button type="button" onClick={handleDraftSaveAndSwitch}>
              保存して切替
            </button>
            <button type="button" onClick={handleDraftDiscardAndSwitch}>
              破棄して切替
            </button>
          </div>
        </div>
      </FocusTrapDialog>

      {isLocalHistoryDebugEnabled ? (
        <FocusTrapDialog
          open={auditOpen}
          role="dialog"
          title="操作履歴（ローカル）"
          description="この一覧は開発用のローカル表示です。監査要件の正式な監査ログではありません。"
          onClose={closeAudit}
          testId="charts-local-history-dialog"
        >
          <div className="patients-tab__modal-card">
            <div className="patients-tab__modal-header">
              <h3>操作履歴（ローカル、最新5件）</h3>
            </div>
            <p className="patients-tab__modal-sub">
              runId={flags.runId} ／ patientId={selectedPatientId ?? '—'} ／ traceId={(auditEvent as any)?.details?.traceId ?? '—'}
            </p>
            <div className="patients-tab__modal-list">
              {relevantAuditEvents.length === 0 ? (
                <p className="patients-tab__detail-empty" role="status" aria-live={infoLive}>
                  まだ操作履歴がありません（Charts/Patients で保存するとここに反映されます）。
                </p>
              ) : (
                relevantAuditEvents.map((record, index) => {
                  const desc = describeAudit(record);
                  return (
                    <button
                      key={`${record.timestamp}-${index}`}
                      type="button"
                      className="patients-tab__modal-row"
                      onClick={() => {
                        const changedText = desc.changedText;
                        const keys = changedText ? changedText.split(',').map((s) => s.trim()).filter(Boolean) : [];
                        setDiffHighlightKeys(keys.length > 0 ? keys : changedKeys);
                        closeAudit();
                        scrollTo('diff');
                      }}
                    >
                      <div className="patients-tab__modal-row-main">
                        <strong>{desc.action}</strong>
                        <span className="patients-tab__modal-pill">outcome: {desc.outcome}</span>
                      </div>
                      <div className="patients-tab__modal-row-sub">
                        <span>{record.timestamp}</span>
                        <span>runId: {desc.runId}</span>
                        <span>traceId: {desc.traceId}</span>
                        {desc.changedText ? <span>changedKeys: {desc.changedText}</span> : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="patients-tab__modal-actions" role="group" aria-label="操作履歴（ローカル）の補助操作">
              <button
                type="button"
                className="patients-tab__primary"
                onClick={() => {
                  closeAudit();
                  navigateToPatientsBasic();
                }}
                disabled={!selectedPatientId}
              >
                Patients で編集/保存（代替）
              </button>
              <button
                type="button"
                className="patients-tab__ghost"
                onClick={() => {
                  setAuditSnapshot(getAuditEventLog());
                }}
              >
                履歴を更新
              </button>
            </div>
          </div>
        </FocusTrapDialog>
      ) : null}
      <OrcaHokenjaReferenceDialog
        open={hokenjaDialogOpen}
        onClose={() => {
          setHokenjaDialogOpen(false);
          onRequestRestoreFocus?.();
        }}
        patientId={selectedPatientId}
        patientName={patientBaseline?.name ?? selected?.name}
        insuranceLabel={patientBaseline?.insurance ?? selected?.insurance}
        visitDate={selected?.visitDate}
      />
    </section>
  );
}
