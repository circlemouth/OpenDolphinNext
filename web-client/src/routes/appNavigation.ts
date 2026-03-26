import { buildFacilityPath, isFacilityMatch, parseFacilityPath } from './facilityRoutes';
import type { ReceptionCarryoverParams } from '../features/charts/encounterContext';
import { scrubPathWithQuery } from './scrubSensitiveUrl';

export type ExternalParams = Record<string, string>;

const EXTERNAL_PARAM_ALLOWLIST = ['msw', 'debug', 'scenario'] as const;

const isNonEmptyString = (value: string | null | undefined): value is string => {
  if (typeof value !== 'string') return false;
  return value.trim().length > 0;
};

export const pickExternalParams = (searchParams: URLSearchParams): ExternalParams => {
  const external: ExternalParams = {};
  EXTERNAL_PARAM_ALLOWLIST.forEach((key) => {
    const value = searchParams.get(key);
    if (isNonEmptyString(value)) {
      external[key] = value.trim();
    }
  });
  return external;
};

export const applyExternalParams = (params: URLSearchParams, external?: ExternalParams) => {
  if (!external) return;
  Object.entries(external).forEach(([key, value]) => {
    if (!isNonEmptyString(value)) return;
    params.set(key, value.trim());
  });
};

export const parseCarryover = (searchParams: URLSearchParams): ReceptionCarryoverParams => ({
  kw: searchParams.get('kw') ?? undefined,
  dept: searchParams.get('dept') ?? undefined,
  phys: searchParams.get('phys') ?? undefined,
  pay: searchParams.get('pay') ?? undefined,
  sort: searchParams.get('sort') ?? undefined,
  date: searchParams.get('date') ?? undefined,
});

export const applyCarryover = (params: URLSearchParams, carryover?: ReceptionCarryoverParams) => {
  if (!carryover) return;
  const setOrDelete = (key: string, value?: string) => {
    if (isNonEmptyString(value)) params.set(key, value.trim());
    else params.delete(key);
  };
  // `kw` は患者名/自由入力が混在し得るため URL には保持しない。
  params.delete('kw');
  setOrDelete('dept', carryover.dept);
  setOrDelete('phys', carryover.phys);
  setOrDelete('pay', carryover.pay);
  setOrDelete('sort', carryover.sort);
  setOrDelete('date', carryover.date);
};

const SAFE_RETURN_TO_ROUTES: RegExp[] = [
  /^\/f\/[^/]+\/(reception|charts|patients)(\?.*)?$/,
  /^\/f\/[^/]+\/charts\/(print\/(document|outpatient)|order-sets)(\?.*)?$/,
  /^\/f\/[^/]+\/m\/images(\?.*)?$/,
  /^\/m\/images(\?.*)?$/,
  /^\/f\/[^/]+\/administration(\?.*)?$/,
  /^\/f\/[^/]+\/debug(\/.*)?(\?.*)?$/,
];

const DISALLOWED_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export const isSafeReturnTo = (value: string | null | undefined, facilityId: string | undefined): boolean => {
  if (!isNonEmptyString(value)) return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (DISALLOWED_SCHEME_RE.test(trimmed)) return false;

  const withoutHash = trimmed.split('#')[0] ?? '';
  if (!withoutHash) return false;
  if (!SAFE_RETURN_TO_ROUTES.some((re) => re.test(withoutHash))) return false;

  if (withoutHash.startsWith('/f/')) {
    if (!facilityId) return false;
    const [pathname] = withoutHash.split('?');
    const parsed = pathname ? parseFacilityPath(pathname) : null;
    if (!parsed) return false;
    return isFacilityMatch(parsed.facilityId, facilityId);
  }

  return true;
};

const setOptionalParam = (params: URLSearchParams, key: string, value?: string | null) => {
  if (isNonEmptyString(value)) params.set(key, value.trim());
  else params.delete(key);
};

const sanitizeReturnTo = (returnTo: string | null | undefined): string | undefined => {
  if (!isNonEmptyString(returnTo)) return undefined;
  const scrubbed = scrubPathWithQuery(returnTo);
  return isNonEmptyString(scrubbed) ? scrubbed : undefined;
};

export const buildReceptionUrl = (opts: {
  facilityId: string | undefined;
  from?: string;
  returnTo?: string;
  runId?: string;
  carryover?: ReceptionCarryoverParams;
  // Encounter visitDate must stay in router state / volatile memory, not URL.
  visitDate?: string;
  section?: string;
  intent?: string;
  create?: boolean;
  external?: ExternalParams;
}): string => {
  const pathname = buildFacilityPath(opts.facilityId, '/reception');
  const params = new URLSearchParams();
  const returnTo = sanitizeReturnTo(opts.returnTo);
  setOptionalParam(params, 'from', opts.from);
  if (isSafeReturnTo(returnTo, opts.facilityId)) {
    setOptionalParam(params, 'returnTo', returnTo);
  }
  setOptionalParam(params, 'runId', opts.runId);
  applyCarryover(params, opts.carryover);
  setOptionalParam(params, 'section', opts.section);
  setOptionalParam(params, 'intent', opts.intent);
  if (opts.create) params.set('create', '1');
  applyExternalParams(params, opts.external);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
};

export const buildPatientsUrl = (opts: {
  facilityId: string | undefined;
  from?: string;
  returnTo?: string;
  runId?: string;
  carryover?: ReceptionCarryoverParams;
  // NOTE: 患者文脈は URL へ載せず router state / volatile memory で引き継ぐ。
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  scheduleKey?: string;
  encounterKey?: string;
  visitDate?: string;
  intent?: string;
  external?: ExternalParams;
}): string => {
  const pathname = buildFacilityPath(opts.facilityId, '/patients');
  const params = new URLSearchParams();
  const returnTo = sanitizeReturnTo(opts.returnTo);
  setOptionalParam(params, 'from', opts.from);
  if (isSafeReturnTo(returnTo, opts.facilityId)) {
    setOptionalParam(params, 'returnTo', returnTo);
  }
  setOptionalParam(params, 'runId', opts.runId);
  applyCarryover(params, opts.carryover);
  setOptionalParam(params, 'intent', opts.intent);
  applyExternalParams(params, opts.external);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
};

export const buildOrderSetUrl = (opts: {
  facilityId: string | undefined;
  from?: string;
  returnTo?: string;
  external?: ExternalParams;
}): string => {
  const pathname = buildFacilityPath(opts.facilityId, '/charts/order-sets');
  const params = new URLSearchParams();
  const returnTo = sanitizeReturnTo(opts.returnTo);
  setOptionalParam(params, 'from', opts.from);
  if (isSafeReturnTo(returnTo, opts.facilityId)) {
    setOptionalParam(params, 'returnTo', returnTo);
  }
  applyExternalParams(params, opts.external);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
};

export const buildPrintUrl = (opts: {
  facilityId: string | undefined;
  kind: 'outpatient' | 'document';
  from?: string;
  returnTo?: string;
  external?: ExternalParams;
}): string => {
  const pathname = buildFacilityPath(opts.facilityId, `/charts/print/${opts.kind}`);
  const params = new URLSearchParams();
  const returnTo = sanitizeReturnTo(opts.returnTo);
  setOptionalParam(params, 'from', opts.from);
  if (isSafeReturnTo(returnTo, opts.facilityId)) {
    setOptionalParam(params, 'returnTo', returnTo);
  }
  applyExternalParams(params, opts.external);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
};

export const buildMobileImagesUrl = (opts: {
  facilityId: string | undefined;
  from?: string;
  returnTo?: string;
  // NOTE: 患者文脈は URL へ載せず router state / volatile memory で引き継ぐ。
  patientId?: string;
  external?: ExternalParams;
}): string => {
  const pathname = buildFacilityPath(opts.facilityId, '/m/images');
  const params = new URLSearchParams();
  const returnTo = sanitizeReturnTo(opts.returnTo);
  setOptionalParam(params, 'from', opts.from);
  if (isSafeReturnTo(returnTo, opts.facilityId)) {
    setOptionalParam(params, 'returnTo', returnTo);
  }
  applyExternalParams(params, opts.external);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
};
