import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrcaUserManagementPanel } from '../OrcaUserManagementPanel';

const {
  mockFetchOrcaUsers,
  mockFetchAccessUsers,
} = vi.hoisted(() => ({
  mockFetchOrcaUsers: vi.fn(),
  mockFetchAccessUsers: vi.fn(),
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => ({ facilityId: 'FAC-TEST', userId: 'admin-user', role: 'system_admin' }),
}));

vi.mock('../../../libs/auth/roles', () => ({
  isSystemAdminRole: vi.fn(() => true),
}));

vi.mock('../../../libs/observability/observability', () => ({
  resolveAriaLive: vi.fn(() => 'polite'),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('../accessManagementApi', () => ({
  fetchAccessUsers: mockFetchAccessUsers,
}));

vi.mock('../orcaUserAdminApi', () => ({
  fetchOrcaUsers: mockFetchOrcaUsers,
  createOrcaUser: vi.fn(),
  deleteOrcaUser: vi.fn(),
  isValidOrcaUserId: vi.fn((value: string) => /^[A-Za-z0-9_]+$/.test(value.trim())),
  linkEhrUserToOrca: vi.fn(),
  syncOrcaUsers: vi.fn(),
  unlinkEhrUserFromOrca: vi.fn(),
  updateOrcaUser: vi.fn(),
}));

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <OrcaUserManagementPanel runId="RUN-ORCA-USERS" role="system_admin" />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  mockFetchOrcaUsers.mockResolvedValue({
    ok: true,
    status: 200,
    users: [
      {
        userId: 'doctor_01',
        fullName: '山田 太郎',
        fullNameKana: 'ヤマダ タロウ',
        staffClass: '01',
        staffNumber: '10001',
        isAdmin: true,
        link: { linked: false },
      },
    ],
    syncStatus: {
      running: false,
      lastSyncedAt: '2026-04-11T00:00:00Z',
      syncedCount: 1,
    },
  });
  mockFetchAccessUsers.mockResolvedValue({
    users: [
      {
        userPk: 1,
        userId: 'ehr-user-1',
        loginId: 'doctor-login',
        displayName: '電子カルテ 医師',
      },
    ],
  });
});

describe('OrcaUserManagementPanel', () => {
  it('更新フォームの immutable fields を readOnly にし、再取得文言を表示する', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByRole('button', { name: 'ORCAユーザ再取得' })).toBeInTheDocument();
    expect(await screen.findByText('山田 太郎')).toBeInTheDocument();
    expect(screen.getByText('最終再取得日時')).toBeInTheDocument();
    expect(screen.getByText('最終再取得件数')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(screen.getByLabelText('ORCA User_Id（更新不可）')).toHaveValue('doctor_01');
    });
    expect(screen.getByLabelText('ORCA User_Id（更新不可）')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('職員区分（更新不可）')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('職員番号（更新不可）')).toHaveAttribute('readonly');
    expect(
      screen.getByText('更新できるのは氏名 / カナ / パスワードのみです。ORCA User_Id / 職員区分 / 職員番号 / 管理者権限は official update request で変更しません。'),
    ).toBeInTheDocument();
    expect(screen.getByText('official update request では User_Id を固定し、New_User_Number や New_User_Id を送信しません。')).toBeInTheDocument();
    expect(screen.getByLabelText('管理者権限（更新不可）')).toHaveValue('あり');
    expect(
      screen.getByText('create 時の設定値を表示しています。official update request では New_Administrator_Privilege を送信しません。'),
    ).toBeInTheDocument();
  });

  it('作成フォームで職員番号を表示専用にし、official create wording を表示する', async () => {
    renderPanel();

    expect(await screen.findByText('official create request では ORCA User_Id / 初期パスワード / 職員区分 / 氏名 / カナ / 管理者権限のみ送信し、職員番号は送信しません。')).toBeInTheDocument();
    expect(screen.getByLabelText('職員番号（ORCA採番）')).toHaveAttribute('readonly');
    expect(screen.getByText('official create request では指定せず、作成後の再取得で採番済み値を反映します。')).toBeInTheDocument();
  });
});
