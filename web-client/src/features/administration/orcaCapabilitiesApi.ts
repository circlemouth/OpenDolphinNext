import { httpFetch } from '../../libs/http/httpClient';

export type OrcaInternalWrapperCapability = {
  id: 'medical-sets' | 'birth-delivery' | 'medical-records' | 'patient-mutation' | 'chart-subjectives';
  label?: string;
  routeNamespace?: 'official' | 'master' | 'local';
  behavior?: string;
  available: boolean;
  hint?: string;
};

export type OrcaConnectionCapability = {
  available: boolean;
  testedScope?: string;
  hint?: string;
};

export type OrcaCapabilitiesResponse = {
  ok: boolean;
  runId?: string;
  connection?: OrcaConnectionCapability;
  internalWrappers: OrcaInternalWrapperCapability[];
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const getBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const normalizeConnectionCapability = (value: unknown): OrcaConnectionCapability | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    available: getBoolean(record.available) ?? false,
    testedScope: getString(record.testedScope),
    hint: getString(record.hint),
  };
};

const normalizeInternalWrapperCapability = (value: unknown): OrcaInternalWrapperCapability | null => {
  const record = asRecord(value);
  if (!record) return null;
  const id = getString(record.id) as OrcaInternalWrapperCapability['id'] | undefined;
  if (!id) return null;
  return {
    id,
    label: getString(record.label),
    routeNamespace: getString(record.routeNamespace) as OrcaInternalWrapperCapability['routeNamespace'] | undefined,
    behavior: getString(record.behavior),
    available: getBoolean(record.available) ?? false,
    hint: getString(record.hint),
  };
};

export async function fetchOrcaCapabilities(): Promise<OrcaCapabilitiesResponse> {
  const response = await httpFetch('/api/admin/orca/capabilities', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  const body = asRecord(json) ?? {};
  const internalWrappers = Array.isArray(body.internalWrappers)
    ? body.internalWrappers.reduce<OrcaInternalWrapperCapability[]>((accumulator, item) => {
        const capability = normalizeInternalWrapperCapability(item);
        if (capability) accumulator.push(capability);
        return accumulator;
      }, [])
    : [];

  return {
    ok: response.ok && (getBoolean(body.ok) ?? true),
    runId: getString(body.runId),
    connection: normalizeConnectionCapability(body.connection),
    internalWrappers,
  };
}
