import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuthService } from '../features/charts/authService';
import {
  buildChartsUrl,
  hasEncounterContext,
  hasHandoffEncounterKey,
  loadChartsEncounterContext,
  normalizeEncounterContext,
  normalizeRunId,
  normalizeVisitDate,
  parseChartsEncounterContext,
  storeChartsEncounterContext,
  type OutpatientEncounterContext,
  type ReceptionCarryoverParams,
} from '../features/charts/encounterContext';
import { useNavigationGuard } from './NavigationGuardProvider';
import {
  applyExternalParams,
  buildMobileImagesUrl,
  buildOrderSetUrl,
  buildPatientsUrl,
  buildPrintUrl,
  buildReceptionUrl,
  isSafeReturnTo,
  parseCarryover,
  pickExternalParams,
  type ExternalParams,
} from './appNavigation';
import { buildFacilityPath } from './facilityRoutes';
import { saveDeepLinkContext } from './deepLinkContextStorage';
import { scrubPathWithQuery } from './scrubSensitiveUrl';

type AppNavigationScope = {
  facilityId: string | undefined;
  userId?: string;
};

type NavigateExtras = {
  replace?: boolean;
  state?: unknown;
};

type NavigationLocationState = {
  carryover?: ReceptionCarryoverParams;
  encounter?: OutpatientEncounterContext;
  kw?: string;
  keyword?: string;
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  scheduleKey?: string;
  encounterKey?: string;
  visitDate?: string;
  chartsScreenId?: string;
  returnTo?: string;
  from?: string;
};

const hasAnyCarryover = (carryover: ReceptionCarryoverParams) =>
  Boolean(carryover.kw || carryover.dept || carryover.phys || carryover.pay || carryover.sort || carryover.date);

const mergeCarryover = (base: ReceptionCarryoverParams, override?: ReceptionCarryoverParams) => {
  if (!override) return base;
  const next: ReceptionCarryoverParams = { ...base };
  (Object.keys(override) as Array<keyof ReceptionCarryoverParams>).forEach((key) => {
    if (override[key] !== undefined) {
      next[key] = override[key];
    }
  });
  return next;
};

const mergeExternal = (base: ExternalParams, override?: ExternalParams) => {
  if (!override) return base;
  return { ...base, ...override };
};

const mergeEncounter = (base: OutpatientEncounterContext, override?: OutpatientEncounterContext) => {
  if (!override) return base;
  return {
    patientId: override.patientId ?? base.patientId,
    appointmentId: override.appointmentId ?? base.appointmentId,
    receptionId: override.receptionId ?? base.receptionId,
    scheduleKey: override.scheduleKey ?? base.scheduleKey,
    encounterKey: override.encounterKey ?? base.encounterKey,
    visitDate: override.visitDate ?? base.visitDate,
  };
};

const createChartsScreenId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `charts-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const parseSearchFromReturnTo = (returnTo: string): URLSearchParams => {
  try {
    const url = new URL(returnTo, 'https://app.invalid');
    return url.searchParams;
  } catch {
    return new URLSearchParams();
  }
};

const resolveCurrentScreen = (pathname: string): string => {
  if (pathname.includes('/charts/print/')) return 'print';
  if (pathname.endsWith('/charts/order-sets')) return 'orderSets';
  if (pathname.endsWith('/charts')) return 'charts';
  if (pathname.endsWith('/reception')) return 'reception';
  if (pathname.endsWith('/patients')) return 'patients';
  if (pathname.endsWith('/administration')) return 'admin';
  if (pathname.includes('/debug')) return 'debug';
  if (pathname.endsWith('/m/images') || pathname === '/m/images') return 'mobileImages';
  return 'unknown';
};

const readQueryParam = (search: string, key: string): string | undefined => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const value = params.get(key);
  return value ?? undefined;
};

const readReturnToFromState = (state: unknown): string | undefined => {
  if (!state || typeof state !== 'object') return undefined;
  const obj = state as Record<string, unknown>;
  return typeof obj.returnTo === 'string' ? obj.returnTo : undefined;
};

const readFromFromState = (state: unknown): string | undefined => {
  if (!state || typeof state !== 'object') return undefined;
  const obj = state as Record<string, unknown>;
  return typeof obj.from === 'string' ? obj.from : undefined;
};

const sanitizeReturnTo = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const scrubbed = scrubPathWithQuery(trimmed);
  return scrubbed.trim() ? scrubbed : undefined;
};

const asStateRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

const asNavigationLocationState = (value: unknown): NavigationLocationState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as NavigationLocationState;
};

const readStateCarryover = (state: unknown): ReceptionCarryoverParams => {
  const locationState = asNavigationLocationState(state);
  if (locationState.carryover) {
    return locationState.carryover;
  }
  const kw = typeof locationState.kw === 'string' ? locationState.kw : typeof locationState.keyword === 'string' ? locationState.keyword : undefined;
  return kw ? { kw } : {};
};

const readStateEncounter = (state: unknown): OutpatientEncounterContext => {
  const locationState = asNavigationLocationState(state);
  const encounter = locationState.encounter ?? {};
  return normalizeEncounterContext({
    patientId: encounter.patientId ?? locationState.patientId,
    appointmentId: encounter.appointmentId ?? locationState.appointmentId,
    receptionId: encounter.receptionId ?? locationState.receptionId,
    scheduleKey: encounter.scheduleKey ?? locationState.scheduleKey,
    encounterKey: encounter.encounterKey ?? locationState.encounterKey,
    visitDate: encounter.visitDate ?? locationState.visitDate,
  });
};

const readStateChartsScreenId = (state: unknown): string | undefined => {
  const screenId = asNavigationLocationState(state).chartsScreenId;
  if (typeof screenId !== 'string') {
    return undefined;
  }
  const trimmed = screenId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function useAppNavigation(scope: AppNavigationScope) {
  const location = useLocation();
  const { flags } = useAuthService();
  const { guardedNavigate } = useNavigationGuard();

  const facilityId = scope.facilityId;
  const userId = scope.userId;

  const currentUrl = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const currentScreen = useMemo(() => resolveCurrentScreen(location.pathname), [location.pathname]);

  const currentSearchParams = useMemo(
    () => new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search),
    [location.search],
  );
  const locationState = useMemo(() => asNavigationLocationState(location.state), [location.state]);

  const returnToInQuery = useMemo(() => readQueryParam(location.search, 'returnTo'), [location.search]);
  const returnToInState = useMemo(() => readReturnToFromState(location.state), [location.state]);
  const returnToCandidate = useMemo(
    () => sanitizeReturnTo(returnToInQuery ?? returnToInState),
    [returnToInQuery, returnToInState],
  );
  const safeReturnToCandidate = useMemo(
    () => (isSafeReturnTo(returnToCandidate, facilityId) ? returnToCandidate : undefined),
    [facilityId, returnToCandidate],
  );

  const carryoverFromUrl = useMemo(() => parseCarryover(currentSearchParams), [currentSearchParams]);
  const carryoverFromState = useMemo(() => readStateCarryover(location.state), [location.state]);
  const carryoverFromReturnTo = useMemo(
    () => (safeReturnToCandidate ? parseCarryover(parseSearchFromReturnTo(safeReturnToCandidate)) : {}),
    [safeReturnToCandidate],
  );
  const baseCarryover = useMemo(
    () =>
      hasAnyCarryover(carryoverFromState)
        ? carryoverFromState
        : hasAnyCarryover(carryoverFromUrl)
          ? carryoverFromUrl
          : carryoverFromReturnTo,
    [carryoverFromReturnTo, carryoverFromState, carryoverFromUrl],
  );

  const externalFromUrl = useMemo(() => pickExternalParams(currentSearchParams), [currentSearchParams]);
  const externalFromReturnTo = useMemo(
    () => (safeReturnToCandidate ? pickExternalParams(parseSearchFromReturnTo(safeReturnToCandidate)) : {}),
    [safeReturnToCandidate],
  );
  const baseExternal = useMemo(
    () => (Object.keys(externalFromUrl).length > 0 ? externalFromUrl : externalFromReturnTo),
    [externalFromReturnTo, externalFromUrl],
  );

  const encounterFromUrl = useMemo(() => parseChartsEncounterContext(location.search), [location.search]);
  const encounterFromState = useMemo(() => readStateEncounter(location.state), [location.state]);
  const encounterFromReturnTo = useMemo(
    () => (safeReturnToCandidate ? parseChartsEncounterContext(new URL(safeReturnToCandidate, 'https://app.invalid').search) : {}),
    [safeReturnToCandidate],
  );
  const encounterFromStorage = useMemo(
    () => loadChartsEncounterContext({ facilityId, userId }) ?? {},
    [facilityId, userId],
  );
  const baseEncounter = useMemo(
    () =>
      hasEncounterContext(encounterFromState)
        ? encounterFromState
        : hasEncounterContext(encounterFromUrl)
          ? encounterFromUrl
          : hasEncounterContext(encounterFromReturnTo)
            ? encounterFromReturnTo
            : encounterFromStorage,
    [encounterFromReturnTo, encounterFromState, encounterFromStorage, encounterFromUrl],
  );

  const resolvedRunId = useMemo(() => {
    const fromUrl = readQueryParam(location.search, 'runId');
    return normalizeRunId(fromUrl ?? undefined) ?? normalizeRunId(flags.runId) ?? undefined;
  }, [flags.runId, location.search]);

  const openReception = useCallback(
    (opts?: {
      from?: string;
      returnTo?: string;
      runId?: string;
      carryover?: ReceptionCarryoverParams;
      visitDate?: string;
      section?: string;
      intent?: string;
      create?: boolean;
      external?: ExternalParams;
      navigate?: NavigateExtras;
    }) => {
      const from = opts?.from ?? currentScreen;
      const returnTo = sanitizeReturnTo(opts?.returnTo ?? currentUrl);
      const encounter = mergeEncounter(baseEncounter, opts?.visitDate ? { visitDate: opts.visitDate } : undefined);
      const carryover = mergeCarryover(baseCarryover, opts?.carryover);
      const normalizedEncounterDate = normalizeVisitDate(opts?.visitDate ?? encounter.visitDate);
      const effectiveCarryover =
        normalizedEncounterDate && !carryover.date
          ? { ...carryover, date: normalizedEncounterDate }
          : carryover;
      const url = buildReceptionUrl({
        facilityId,
        from,
        returnTo,
        runId: opts?.runId ?? resolvedRunId,
        carryover: effectiveCarryover,
        section: opts?.section,
        intent: opts?.intent,
        create: opts?.create,
        external: mergeExternal(baseExternal, opts?.external),
      });
      guardedNavigate(url, {
        replace: opts?.navigate?.replace,
        state: {
          ...asStateRecord(opts?.navigate?.state),
          from,
          returnTo,
          carryover: effectiveCarryover,
          encounter,
          patientId: encounter.patientId,
          appointmentId: encounter.appointmentId,
          receptionId: encounter.receptionId,
          scheduleKey: encounter.scheduleKey,
          encounterKey: encounter.encounterKey,
          visitDate: normalizedEncounterDate,
        },
      });
    },
    [baseCarryover, baseEncounter, baseExternal, currentScreen, currentUrl, facilityId, guardedNavigate, resolvedRunId],
  );

  const openPatients = useCallback(
    (opts?: {
      from?: string;
      returnTo?: string;
      runId?: string;
      carryover?: ReceptionCarryoverParams;
      encounter?: OutpatientEncounterContext;
      patientId?: string;
      intent?: string;
      external?: ExternalParams;
      navigate?: NavigateExtras;
    }) => {
      const from = opts?.from ?? currentScreen;
      const returnTo = sanitizeReturnTo(opts?.returnTo ?? currentUrl);
      const safeReturnTo = isSafeReturnTo(returnTo, facilityId) ? returnTo : undefined;
      const encounter = mergeEncounter(baseEncounter, opts?.encounter);
      if (hasEncounterContext(encounter)) {
        storeChartsEncounterContext(encounter, { facilityId, userId });
      }
      const url = buildPatientsUrl({
        facilityId,
        from,
        returnTo: safeReturnTo,
        runId: opts?.runId ?? resolvedRunId ?? flags.runId,
        carryover: mergeCarryover(baseCarryover, opts?.carryover),
        patientId: opts?.patientId ?? encounter.patientId,
        appointmentId: encounter.appointmentId,
        receptionId: encounter.receptionId,
        scheduleKey: encounter.scheduleKey,
        encounterKey: encounter.encounterKey,
        visitDate: normalizeVisitDate(encounter.visitDate),
        intent: opts?.intent,
        external: mergeExternal(baseExternal, opts?.external),
      });

      guardedNavigate(url, {
        replace: opts?.navigate?.replace,
        state: {
          ...asStateRecord(opts?.navigate?.state),
          from,
          returnTo: safeReturnTo,
          carryover: mergeCarryover(baseCarryover, opts?.carryover),
          encounter,
          patientId: encounter.patientId,
          appointmentId: encounter.appointmentId,
          receptionId: encounter.receptionId,
          scheduleKey: encounter.scheduleKey,
          encounterKey: encounter.encounterKey,
          visitDate: normalizeVisitDate(encounter.visitDate),
        },
      });
    },
    [baseCarryover, baseEncounter, baseExternal, currentScreen, currentUrl, facilityId, flags.runId, guardedNavigate, resolvedRunId, userId],
  );

  const openCharts = useCallback(
    (opts?: {
      encounter?: OutpatientEncounterContext;
      carryover?: ReceptionCarryoverParams;
      runId?: string;
      external?: ExternalParams;
      navigate?: NavigateExtras;
    }) => {
      const encounter = mergeEncounter(baseEncounter, opts?.encounter);
      if (!hasHandoffEncounterKey(encounter)) {
        return;
      }
      if (hasEncounterContext(encounter)) {
        storeChartsEncounterContext(encounter, { facilityId, userId });
      }
      const chartsBasePath = buildFacilityPath(facilityId, '/charts');
      const runId = opts?.runId ?? resolvedRunId ?? flags.runId;
      const baseUrl = buildChartsUrl(encounter, mergeCarryover(baseCarryover, opts?.carryover), { runId }, chartsBasePath);
      const url = (() => {
        try {
          const parsed = new URL(baseUrl, 'https://app.invalid');
          applyExternalParams(parsed.searchParams, mergeExternal(baseExternal, opts?.external));
          const search = parsed.searchParams.toString();
          return `${parsed.pathname}${search ? `?${search}` : ''}`;
        } catch {
          return baseUrl;
        }
      })();
      guardedNavigate(url, {
        replace: opts?.navigate?.replace,
        state: {
          ...asStateRecord(opts?.navigate?.state),
          runId,
          carryover: mergeCarryover(baseCarryover, opts?.carryover),
          encounter,
          chartsScreenId: readStateChartsScreenId(opts?.navigate?.state) ?? createChartsScreenId(),
          patientId: encounter.patientId,
          appointmentId: encounter.appointmentId,
          receptionId: encounter.receptionId,
          scheduleKey: encounter.scheduleKey,
          encounterKey: encounter.encounterKey,
          visitDate: normalizeVisitDate(encounter.visitDate),
        },
      });
    },
    [baseCarryover, baseEncounter, baseExternal, facilityId, flags.runId, guardedNavigate, resolvedRunId, userId],
  );

  const openOrderSets = useCallback(
    (opts?: { from?: string; returnTo?: string; external?: ExternalParams; navigate?: NavigateExtras }) => {
      const from = opts?.from ?? currentScreen;
      const returnTo = sanitizeReturnTo(opts?.returnTo ?? currentUrl);
      const url = buildOrderSetUrl({
        facilityId,
        from,
        returnTo,
        external: mergeExternal(baseExternal, opts?.external),
      });
      guardedNavigate(url, { replace: opts?.navigate?.replace, state: opts?.navigate?.state });
    },
    [baseExternal, currentScreen, currentUrl, facilityId, guardedNavigate],
  );

  const openPrintOutpatient = useCallback(
    (opts: { state: Record<string, unknown>; from?: string; returnTo?: string; external?: ExternalParams; navigate?: NavigateExtras }) => {
      const from = opts.from ?? currentScreen;
      const returnTo = sanitizeReturnTo(opts.returnTo ?? currentUrl);
      const safeReturnTo = isSafeReturnTo(returnTo, facilityId) ? returnTo : undefined;
      const url = buildPrintUrl({
        facilityId,
        kind: 'outpatient',
        from,
        returnTo: safeReturnTo,
        external: mergeExternal(baseExternal, opts.external),
      });
      guardedNavigate(url, {
        replace: opts.navigate?.replace,
        state: { ...opts.state, from, returnTo: safeReturnTo },
      });
    },
    [baseExternal, currentScreen, currentUrl, facilityId, guardedNavigate],
  );

  const openPrintDocument = useCallback(
    (opts: { state: Record<string, unknown>; from?: string; returnTo?: string; external?: ExternalParams; navigate?: NavigateExtras }) => {
      const from = opts.from ?? currentScreen;
      const returnTo = sanitizeReturnTo(opts.returnTo ?? currentUrl);
      const safeReturnTo = isSafeReturnTo(returnTo, facilityId) ? returnTo : undefined;
      const url = buildPrintUrl({
        facilityId,
        kind: 'document',
        from,
        returnTo: safeReturnTo,
        external: mergeExternal(baseExternal, opts.external),
      });
      guardedNavigate(url, {
        replace: opts.navigate?.replace,
        state: { ...opts.state, from, returnTo: safeReturnTo },
      });
    },
    [baseExternal, currentScreen, currentUrl, facilityId, guardedNavigate],
  );

  const openMobileImages = useCallback(
    (opts?: { from?: string; returnTo?: string; patientId?: string; external?: ExternalParams; navigate?: NavigateExtras }) => {
      const from = opts?.from ?? currentScreen;
      const returnTo = sanitizeReturnTo(opts?.returnTo ?? currentUrl);
      const safeReturnTo = isSafeReturnTo(returnTo, facilityId) ? returnTo : undefined;
      const patientId = opts?.patientId ?? baseEncounter.patientId;
      if (patientId) {
        storeChartsEncounterContext({ ...baseEncounter, patientId }, { facilityId, userId });
        saveDeepLinkContext({ patientId });
      }
      const url = buildMobileImagesUrl({
        facilityId,
        from,
        returnTo: safeReturnTo,
        patientId,
        external: mergeExternal(baseExternal, opts?.external),
      });
      guardedNavigate(url, {
        replace: opts?.navigate?.replace,
        state: {
          ...asStateRecord(opts?.navigate?.state),
          from,
          returnTo: safeReturnTo,
          encounter: patientId ? { ...baseEncounter, patientId } : baseEncounter,
          patientId,
        },
      });
    },
    [baseEncounter, baseExternal, currentScreen, currentUrl, facilityId, guardedNavigate, userId],
  );

  const returnFromInState = useMemo(() => readFromFromState(location.state), [location.state]);
  const fromInQuery = useMemo(() => readQueryParam(location.search, 'from'), [location.search]);
  const fromCandidate = fromInQuery ?? returnFromInState;

  return {
    currentUrl,
    currentScreen,
    fromCandidate,
    returnToCandidate,
    safeReturnToCandidate,
    locationState,
    carryover: baseCarryover,
    external: baseExternal,
    encounter: baseEncounter,
    openReception,
    openPatients,
    openCharts,
    openOrderSets,
    openPrintOutpatient,
    openPrintDocument,
    openMobileImages,
  };
}
