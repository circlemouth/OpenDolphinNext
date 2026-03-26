import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AccessManagementPanel } from '../AccessManagementPanel';
import type { AccessManagedUser, AccessUsersResponse } from '../accessManagementApi';

const {
  mockFetchAccessUsers,
  mockResetAccessUserPassword,
} = vi.hoisted(() => ({
  mockFetchAccessUsers: vi.fn<() => Promise<AccessUsersResponse>>(),
  mockResetAccessUserPassword: vi.fn(),
}));

vi.mock('../accessManagementApi', () => ({
  ACCESS_PASSWORD_RESET_PUBLIC_ROUTE_AVAILABLE: false,
  fetchAccessUsers: mockFetchAccessUsers,
  createAccessUser: vi.fn(),
  updateAccessUser: vi.fn(),
  resetAccessUserPassword: mockResetAccessUserPassword,
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => ({ facilityId: 'FAC-TEST', userId: 'system-admin', role: 'system_admin' }),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({ logAuditEvent: vi.fn() }));

const TARGET_USER: AccessManagedUser = {
  userPk: 101,
  userId: 'FAC-TEST:doctor01',
  loginId: 'doctor01',
  displayName: '山田 太郎',
  roles: ['doctor', 'user'],
  factor2Auth: 'totp',
  orcaLink: {
    linked: true,
    orcaUserId: 'ORCA001',
    updatedAt: '2026-02-12T20:00:00Z',
  },
};

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccessManagementPanel runId="RUN-PASSWORD-RESET" role="system_admin" mode="full" />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AccessManagementPanel password reset', () => {
  it('password reset public route が無効な間は導線を表示しない', async () => {
    mockFetchAccessUsers.mockResolvedValue({
      runId: 'RUN-LIST',
      facilityId: 'FAC-TEST',
      users: [TARGET_USER],
    });

    renderPanel();

    expect(await screen.findByText(/パスワードリセット route は現行 public contract では未公開/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'パスワードリセット' })).not.toBeInTheDocument();
    expect(mockResetAccessUserPassword).not.toHaveBeenCalled();
  });
});
