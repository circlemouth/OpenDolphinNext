import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { updateObservabilityMeta } from '../../libs/observability/observability';

import { fetchPatientFreeDocument, savePatientFreeDocument } from './patientFreeDocumentApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockHttpFetch.mockReset();
  updateObservabilityMeta({ runId: 'RUN-FREE-DOC' });
});

describe('patientFreeDocumentApi', () => {
  it('fetch は FreeDocument の contentHash を保存時の楽観ロック情報として返す', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 1,
          facilityPatId: 'P-001',
          confirmed: 1770000000000,
          comment: 'free document body',
          contentHash: 'hash-free-doc-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchPatientFreeDocument({ patientId: 'P-001' });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual(
      expect.objectContaining({
        id: 1,
        facilityPatId: 'P-001',
        comment: 'free document body',
        contentHash: 'hash-free-doc-1',
      }),
    );
  });

  it('fetch は 404 を unsupported として扱い、raw body を返さない', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response('route missing /internal/path', { status: 404, statusText: 'Not Found' }),
    );

    const result = await fetchPatientFreeDocument({ patientId: 'P-001' });

    expect(mockHttpFetch).toHaveBeenCalledWith('/api/karte/freedocument/P-001');
    expect(result).toMatchObject({
      ok: false,
      supported: false,
      status: 404,
      payload: null,
      error: 'NOT_SUPPORTED',
    });
  });

  it('save は 404 を unsupported として扱い、再読込側で回復可能にする', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'not found' }), { status: 404, statusText: 'Not Found' }),
    );

    const result = await savePatientFreeDocument({
      patientId: 'P-001',
      id: 1,
      confirmed: 1770000000000,
      comment: 'free document body',
    });

    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/karte/freedocument',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          facilityPatId: 'P-001',
          confirmed: 1770000000000,
          comment: 'free document body',
        }),
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      supported: false,
      status: 404,
      error: 'NOT_SUPPORTED',
    });
  });

  it('save は expectedContentHash を送って旧単一行更新の last-write-wins を避ける', async () => {
    mockHttpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await savePatientFreeDocument({
      patientId: 'P-001',
      id: 1,
      confirmed: 1770000000000,
      comment: 'free document body',
      expectedContentHash: 'hash-free-doc-1',
    });

    expect(result.ok).toBe(true);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/karte/freedocument',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          facilityPatId: 'P-001',
          confirmed: 1770000000000,
          comment: 'free document body',
          expectedContentHash: 'hash-free-doc-1',
        }),
      }),
    );
  });
});
