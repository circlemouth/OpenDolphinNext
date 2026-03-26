import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AccessManagementPanel } from '../AccessManagementPanel';
import type { AccessManagedUser, AccessUsersResponse } from '../accessManagementApi';

const {
  mockFetchAccessUsers,
  mockCreateAccessUser,
  mockUpdateAccessUser,
  mockResetAccessUserPassword,
} = vi.hoisted(() => ({
  mockFetchAccessUsers: vi.fn<() => Promise<AccessUsersResponse>>(),
  mockCreateAccessUser: vi.fn(),
  mockUpdateAccessUser: vi.fn(),
  mockResetAccessUserPassword: vi.fn(),
}));

vi.mock('../accessManagementApi', () => ({
  ACCESS_PASSWORD_RESET_PUBLIC_ROUTE_AVAILABLE: false,
  fetchAccessUsers: mockFetchAccessUsers,
  createAccessUser: mockCreateAccessUser,
  updateAccessUser: mockUpdateAccessUser,
  resetAccessUserPassword: mockResetAccessUserPassword,
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => ({ facilityId: 'FAC-TEST', userId: 'system-admin', role: 'system_admin' }),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));

const LINKED_USER: AccessManagedUser = {
  userPk: 101,
  userId: 'FAC-TEST:linked01',
  loginId: 'linked01',
  displayName: '連携ユーザー',
  roles: ['doctor', 'user'],
  factor2Auth: 'totp',
  orcaLink: {
    linked: true,
    orcaUserId: 'orca_01',
    updatedAt: '2026-02-12T20:00:00Z',
  },
};

const UNLINKED_USER: AccessManagedUser = {
  userPk: 102,
  userId: 'FAC-TEST:solo01',
  loginId: 'solo01',
  displayName: '未連携ユーザー',
  roles: ['user'],
  factor2Auth: 'none',
  orcaLink: {
    linked: false,
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
      <AccessManagementPanel runId="RUN-LINKED-ONLY" role="system_admin" mode="linked-only" />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AccessManagementPanel linked-only mode', () => {
  it('ORCA連携済みユーザーのみ表示し、作成/パスワードリセット導線を出さない', async () => {
    mockFetchAccessUsers.mockResolvedValue({
      runId: 'RUN-LIST',
      facilityId: 'FAC-TEST',
      users: [LINKED_USER, UNLINKED_USER],
    });

    renderPanel();

    expect(await screen.findByText('linked01')).toBeInTheDocument();
    expect(screen.queryByText('solo01')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新規作成' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'パスワードリセット' })).not.toBeInTheDocument();
    expect(mockFetchAccessUsers).toHaveBeenCalledTimes(1);
  });

  it('権限編集は roles のみを更新する', async () => {
    mockFetchAccessUsers.mockResolvedValue({
      runId: 'RUN-LIST',
      facilityId: 'FAC-TEST',
      users: [LINKED_USER],
    });
    mockUpdateAccessUser.mockResolvedValue(LINKED_USER);

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: '権限編集' }));
    fireEvent.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => expect(mockUpdateAccessUser).toHaveBeenCalledTimes(1));

    const [userPk, payload] = mockUpdateAccessUser.mock.calls[0] as [number, Record<string, unknown>];
    expect(userPk).toBe(101);
    expect(Object.keys(payload)).toEqual(['roles']);
    expect(payload.roles).toEqual(expect.arrayContaining(['doctor', 'user']));
  });
});
