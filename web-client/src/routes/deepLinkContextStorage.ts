export const DEEPLINK_CTX_KEY = 'opendolphin:web-client:deeplink-context';

const DEEPLINK_VALUE_KEYS = [
  'patientId',
  'appointmentId',
  'receptionId',
  'scheduleKey',
  'encounterKey',
  'visitDate',
] as const;

type DeepLinkValueKey = (typeof DEEPLINK_VALUE_KEYS)[number];

export type DeepLinkContext = {
  savedAt: string;
  values: Partial<Record<DeepLinkValueKey, string>>;
};

let volatileDeepLinkContext: DeepLinkContext | null = null;

const parseSavedAtMs = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeValues = (source: unknown): DeepLinkContext['values'] => {
  if (!source || typeof source !== 'object') return {};
  const record = source as Record<string, unknown>;
  const values: DeepLinkContext['values'] = {};
  DEEPLINK_VALUE_KEYS.forEach((key) => {
    const normalized = normalizeValue(record[key]);
    if (normalized) {
      values[key] = normalized;
    }
  });
  return values;
};

const cloneContext = (context: DeepLinkContext): DeepLinkContext => ({
  savedAt: context.savedAt,
  values: { ...context.values },
});

const buildDeepLinkContext = (values: DeepLinkContext['values']): DeepLinkContext | null => {
  const sanitized = sanitizeValues(values);
  if (Object.keys(sanitized).length === 0) return null;
  return {
    savedAt: new Date().toISOString(),
    values: sanitized,
  };
};

export function clearDeepLinkContext(): void {
  volatileDeepLinkContext = null;
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(DEEPLINK_CTX_KEY);
  } catch {
    // ignore storage errors
  }
}

export function loadDeepLinkContext(): DeepLinkContext | null {
  if (volatileDeepLinkContext) {
    const context = cloneContext(volatileDeepLinkContext);
    clearDeepLinkContext();
    return context;
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(DEEPLINK_CTX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>;
          parseSavedAtMs(record.savedAt);
          sanitizeValues(record.values);
        }
      }
    } catch {
      // ignore legacy cleanup parse failures
    } finally {
      clearDeepLinkContext();
    }
  }
  return null;
}

export function saveDeepLinkContext(values: DeepLinkContext['values']): void {
  const nextContext = buildDeepLinkContext(values);
  if (!nextContext) {
    clearDeepLinkContext();
    return;
  }

  volatileDeepLinkContext = cloneContext(nextContext);
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(DEEPLINK_CTX_KEY);
  } catch {
    // ignore storage errors
  }
}
