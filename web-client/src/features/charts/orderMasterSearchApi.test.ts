import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchOrderMasterSearch } from './orderMasterSearchApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST' })),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST' })),
}));

const toRequestUrlString = (requestInput: RequestInfo | URL | undefined): string => {
  if (!requestInput) return '';
  if (typeof requestInput === 'string') return requestInput;
  if (requestInput instanceof URL) return requestInput.toString();
  return requestInput.url;
};

describe('fetchOrderMasterSearch auth routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('devFacilityId', 'f001');
    localStorage.setItem('devUserId', 'user01');
  });

  it('routes drug search to /api/orca/master/drug and suppresses session-expiry notice', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'drug', keyword: 'アム' });

    expect(result.ok).toBe(true);
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain('/api/orca/master/drug?');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('propagates drug method and normalizes effective/asOf format without unsupported scope', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({
      type: 'drug',
      keyword: 'アムロ',
      method: 'prefix',
      effective: '2026-02-19',
    });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/drug?');
    expect(requestUrl).toContain('method=prefix');
    expect(requestUrl).not.toContain('scope=');
    expect(requestUrl).toContain('effective=20260219');
    expect(requestUrl).toContain('asOf=20260219');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('does not send category as a drug scope fallback', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({
      type: 'drug',
      keyword: 'アムロ',
      category: 'facility',
    });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/drug?');
    expect(requestUrl).not.toContain('scope=');
    expect(requestUrl).not.toContain('category=');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('routes bodypart search to /api/orca/master/bodypart', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'bodypart', keyword: '腹' });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/bodypart?');
    expect(requestUrl).not.toContain('category=2');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('routes comment search to /api/orca/master/comment', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'comment', keyword: '別途' });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/comment?');
    expect(requestUrl).not.toContain('category=8');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('routes material search to /api/orca/master/material', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'material', keyword: 'カテーテル' });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/material?');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('routes kensa-sort search to /api/orca/master/kensa-sort', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'kensa-sort', keyword: '血液' });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/kensa-sort?');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('does not force default category for plain etensu search', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'etensu', keyword: 'カテーテル' });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/etensu?');
    expect(requestUrl).not.toContain('category=1');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('etensu 検索で page/size を明示した場合はクエリへ反映する', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'etensu', keyword: 'カテーテル', page: 2, size: 500 });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/etensu?');
    expect(requestUrl).toContain('page=2');
    expect(requestUrl).toContain('size=500');
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1];
    expect(init?.notifySessionExpired).toBe(false);
  });

  it('etensu 検索で pointsMin/pointsMax を query に載せる', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({
      type: 'etensu',
      keyword: '処置',
      pointsMin: 20,
      pointsMax: 40,
    });

    expect(result.ok).toBe(true);
    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/etensu?');
    expect(requestUrl).toContain('pointsMin=20');
    expect(requestUrl).toContain('pointsMax=40');
  });

  it('treats TENSU_NOT_FOUND as empty result for etensu family searches', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'TENSU_NOT_FOUND',
          message: 'no etensu entries matched',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderMasterSearch({ type: 'etensu', keyword: 'zz' });

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('treats ETENSU_UNAVAILABLE as empty result for etensu search', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'ETENSU_UNAVAILABLE',
          message: 'etensu master unavailable',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderMasterSearch({ type: 'etensu', keyword: 'zz' });

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.missingMaster).toBe(true);
    expect(result.fallbackUsed).toBe(true);
  });

  it('forces missingMaster/fallbackUsed=true on unavailable even when observability meta is stale false', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    const { getObservabilityMeta } = await import('../../libs/observability/observability');
    vi.mocked(getObservabilityMeta).mockReturnValueOnce({
      runId: 'RUN-TEST',
      missingMaster: false,
      fallbackUsed: false,
    });
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'ETENSU_UNAVAILABLE',
          message: 'etensu master unavailable',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderMasterSearch({ type: 'etensu', keyword: 'zz' });

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.missingMaster).toBe(true);
    expect(result.fallbackUsed).toBe(true);
  });

  it('treats MASTER_*_UNAVAILABLE as empty result for non-etensu searches', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'MASTER_MATERIAL_UNAVAILABLE',
          message: '特定器材マスタを取得できませんでした',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderMasterSearch({ type: 'material', keyword: 'カテーテル' });

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.missingMaster).toBe(true);
    expect(result.fallbackUsed).toBe(true);
  });

  it('drug 検索で MASTER_DRUG_UNAVAILABLE は空結果かつ missingMaster/fallbackUsed=true を返す', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'MASTER_DRUG_UNAVAILABLE',
          message: '薬剤マスタを取得できませんでした',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderMasterSearch({ type: 'drug', keyword: 'アムロジピン' });

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.missingMaster).toBe(true);
    expect(result.fallbackUsed).toBe(true);
  });

  it('treats uppercase statusText unavailable as unavailable for non-etensu searches', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response('{}', {
        status: 503,
        statusText: 'SERVICE UNAVAILABLE',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({ type: 'material', keyword: 'カテーテル' });

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.missingMaster).toBe(true);
    expect(result.fallbackUsed).toBe(true);
  });

  it('youhou 検索で effective を付与し、拡張項目をマッピングする', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          totalCount: 1,
          items: [
            {
              code: '0010001',
              name: '1日3回 毎食後',
              timingCode: '05',
              routeCode: 'PO',
              daysLimit: 14,
              dosePerDay: 3,
              youhouCode: '0101',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderMasterSearch({
      type: 'youhou',
      keyword: '毎食後',
      effective: '2026-02-19',
    });

    const requestUrl = vi.mocked(httpFetch).mock.calls[0]?.[0] ?? '';
    expect(requestUrl).toContain('/api/orca/master/youhou?');
    expect(requestUrl).toContain('effective=20260219');
    expect(requestUrl).toContain('asOf=20260219');
    expect(result.ok).toBe(true);
    expect(result.items[0]).toMatchObject({
      type: 'youhou',
      code: '0010001',
      name: '1日3回 毎食後',
      timingCode: '05',
      routeCode: 'PO',
      daysLimit: 14,
      dosePerDay: 3,
      youhouCode: '0101',
    });
  });

  it('drug 検索で method だけをクエリに付与し、unsupported scope は付与しない', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockImplementation(async () =>
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({
      type: 'drug',
      keyword: '薬剤',
      method: 'partial',
    });

    expect(result.ok).toBe(true);
    const requestUrl = toRequestUrlString(vi.mocked(httpFetch).mock.calls[0]?.[0]);
    const query = new URL(requestUrl, 'http://localhost').searchParams;
    expect(query.get('method')).toBe('partial');
    expect(query.has('scope')).toBe(false);
  });

  it('drug 検索の effective/asOf は日時付き入力でも YYYYMMDD へ正規化する', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({
      type: 'drug',
      keyword: 'アムロジピン',
      effective: '2026-02-19T12:34:56+09:00',
    });

    expect(result.ok).toBe(true);
    const requestUrl = toRequestUrlString(vi.mocked(httpFetch).mock.calls[0]?.[0]);
    const query = new URL(requestUrl, 'http://localhost').searchParams;
    expect(query.get('effective')).toBe('20260219');
    expect(query.get('asOf')).toBe('20260219');
  });

  it('drug 検索で asOf と effective を同時指定した場合は asOf を優先し YYYYMMDD へ正規化する', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrderMasterSearch({
      type: 'drug',
      keyword: 'アムロジピン',
      effective: '2026-02-19T12:34:56+09:00',
      asOf: '2026/03/01',
    });

    expect(result.ok).toBe(true);
    const requestUrl = toRequestUrlString(vi.mocked(httpFetch).mock.calls[0]?.[0]);
    const query = new URL(requestUrl, 'http://localhost').searchParams;
    expect(query.get('effective')).toBe('20260301');
    expect(query.get('asOf')).toBe('20260301');
  });
});
