const CSRF_PLACEHOLDER = '__CSRF_TOKEN__';

export const readCsrfToken = (): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const content = document.querySelector("meta[name='csrf-token']")?.getAttribute('content');
  if (typeof content !== 'string') return undefined;
  const token = content.trim();
  if (!token || token === CSRF_PLACEHOLDER) return undefined;
  return token;
};

const extractCsrfTokenFromHtml = (html: string): string | undefined => {
  const match = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  const token = match?.[1]?.trim();
  if (!token || token === CSRF_PLACEHOLDER) return undefined;
  return token;
};

const writeCsrfToken = (token: string) => {
  let meta = document.querySelector("meta[name='csrf-token']");
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', token);
};

export const refreshCsrfTokenFromCurrentDocument = async (): Promise<string | undefined> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  const response = await fetch(window.location.href, {
    method: 'GET',
    headers: { Accept: 'text/html' },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) return undefined;
  const token = extractCsrfTokenFromHtml(await response.text());
  if (!token) return undefined;
  writeCsrfToken(token);
  return token;
};
