import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import {
  fetchMasterVisibility,
  isMasterCategoryVisible,
  saveMasterVisibility,
} from './masterVisibilityApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockHttpFetch.mockReset();
});

describe('masterVisibilityApi', () => {
  it('visibility 設定を取得してカテゴリを正規化する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          runId: 'RUN-VIS',
          defaultsVisible: true,
          categories: [
            {
              code: 'prescription',
              label: '処方候補',
              visible: false,
              masterTypes: ['drug', 'youhou'],
              affectedSurfaces: ['処方入力'],
            },
            { code: 'unknown', label: 'unknown', visible: false },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchMasterVisibility();

    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/admin/master-updates/visibility',
      expect.objectContaining({ method: 'GET', notifySessionExpired: false }),
    );
    expect(result.categories).toHaveLength(1);
    expect(isMasterCategoryVisible(result, 'prescription')).toBe(false);
    expect(isMasterCategoryVisible(result, 'injection')).toBe(true);
  });

  it('visibility 設定を PUT で保存する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          runId: 'RUN-SAVE',
          categories: [{ code: 'disease', label: '病名候補', visible: false }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await saveMasterVisibility({ disease: false, prescription: true });

    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/admin/master-updates/visibility',
      expect.objectContaining({
        method: 'PUT',
        notifySessionExpired: false,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ categories: { disease: false, prescription: true } }),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.categories[0]?.visible).toBe(false);
  });

  it('保存失敗時は安全なエラーメッセージを throw する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'visibility_category_unsupported' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(saveMasterVisibility({ prescription: false })).rejects.toThrow('visibility_category_unsupported');
  });
});
