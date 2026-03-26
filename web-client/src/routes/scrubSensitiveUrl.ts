export const SENSITIVE_QUERY_KEYS = [
  'patientId',
  'appointmentId',
  'receptionId',
  'scheduleKey',
  'encounterKey',
  'visitDate',
  'invoiceNumber',
  'kw',
  'keyword',
] as const;

export const scrubSearch = (search: string): { scrubbedSearch: string; removed: Record<string, string> } => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const removed: Record<string, string> = {};
  SENSITIVE_QUERY_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value === null) return;
    removed[key] = value;
    params.delete(key);
  });
  const query = params.toString();
  return {
    scrubbedSearch: query ? `?${query}` : '',
    removed,
  };
};

export const scrubPathWithQuery = (path: string): string => {
  if (!path) return '/';
  const trimmed = path.trim();
  if (!trimmed) return '/';
  const withoutHash = trimmed.split('#')[0] ?? '';
  if (!withoutHash) return '/';
  try {
    const parsed = new URL(withoutHash, 'https://app.invalid');
    const { scrubbedSearch } = scrubSearch(parsed.search);
    return `${parsed.pathname}${scrubbedSearch}`;
  } catch {
    const queryIndex = withoutHash.indexOf('?');
    if (queryIndex < 0) return withoutHash;
    const pathname = withoutHash.slice(0, queryIndex);
    const search = withoutHash.slice(queryIndex);
    const { scrubbedSearch } = scrubSearch(search);
    return `${pathname}${scrubbedSearch}`;
  }
};
