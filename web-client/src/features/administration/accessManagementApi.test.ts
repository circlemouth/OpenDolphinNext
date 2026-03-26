import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { resetAccessUserPassword } from './accessManagementApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockHttpFetch.mockReset();
});

describe('accessManagementApi', () => {
  it('パスワードリセットは public route unavailable として fail-closed する', async () => {
    await expect(
      resetAccessUserPassword(101, {
        totpCode: '123456',
        temporaryPassword: 'TempPass#2026',
      }),
    ).rejects.toMatchObject({
      message: '現行 public contract ではパスワードリセット route は公開されていません。',
      status: 410,
      errorCode: 'route_blocked',
    });

    expect(mockHttpFetch).not.toHaveBeenCalled();
  });
});
