import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MasterVisibilityPanel } from '../MasterVisibilityPanel';

const {
  mockEnqueue,
  mockFetchMasterVisibility,
  mockSaveMasterVisibility,
} = vi.hoisted(() => ({
  mockEnqueue: vi.fn(),
  mockFetchMasterVisibility: vi.fn(),
  mockSaveMasterVisibility: vi.fn(),
}));

vi.mock('../../../libs/auth/roles', () => ({
  isSystemAdminRole: vi.fn((role?: string) => role === 'system_admin'),
}));

vi.mock('../../../libs/ui/appToast', () => ({
  useAppToast: () => ({ enqueue: mockEnqueue }),
}));

vi.mock('../masterVisibilityApi', async () => {
  const actual = await vi.importActual<typeof import('../masterVisibilityApi')>('../masterVisibilityApi');
  return {
    ...actual,
    fetchMasterVisibility: mockFetchMasterVisibility,
    saveMasterVisibility: mockSaveMasterVisibility,
  };
});

const visibilityResponse = {
  runId: 'RUN-VIS',
  generatedAt: '2026-05-17T20:40:56Z',
  updatedAt: '2026-05-17T20:40:56Z',
  updatedBy: 'admin-user',
  defaultsVisible: true,
  prescriptionDrugSearchMethodDefault: 'prefix',
  categories: [
    {
      code: 'prescription',
      label: '処方候補',
      visible: true,
      masterTypes: ['drug', 'youhou'],
      affectedSurfaces: ['処方入力'],
    },
    {
      code: 'disease',
      label: '病名候補',
      visible: true,
      masterTypes: ['disease-candidate'],
      affectedSurfaces: ['病名入力'],
    },
  ],
} as const;

const renderPanel = (role = 'system_admin') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MasterVisibilityPanel runId="RUN-PANEL" role={role} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  mockEnqueue.mockReset();
  mockFetchMasterVisibility.mockReset();
  mockSaveMasterVisibility.mockReset();
  mockFetchMasterVisibility.mockResolvedValue(visibilityResponse);
  mockSaveMasterVisibility.mockResolvedValue({
    ...visibilityResponse,
    categories: visibilityResponse.categories.map((category) =>
      category.code === 'disease' ? { ...category, visible: false } : category,
    ),
  });
});

describe('MasterVisibilityPanel', () => {
  it('カテゴリを表示し、トグル結果を保存する', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText('処方候補')).toBeInTheDocument();
    expect(screen.getByText('病名候補')).toBeInTheDocument();
    expect(screen.getByText('drug, youhou')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('処方薬剤検索の既定値'), 'partial');
    const diseaseToggle = screen.getAllByRole('checkbox')[1];
    await user.click(diseaseToggle);
    await user.click(screen.getByRole('button', { name: '表示設定を保存' }));

    await waitFor(() => {
      expect(mockSaveMasterVisibility).toHaveBeenCalledWith(
        {
          prescription: true,
          disease: false,
        },
        { prescriptionDrugSearchMethodDefault: 'partial' },
      );
    });
    expect(mockEnqueue).toHaveBeenCalledWith({ tone: 'success', message: 'マスタ表示設定を更新しました。' });
  });

  it('非管理者は参照のみで保存できない', async () => {
    renderPanel('clinician');

    expect(await screen.findByText('処方候補')).toBeInTheDocument();
    expect(screen.getByText('更新にはシステム管理者権限と step-up が必要です。現在のセッションでは参照のみ可能です。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '表示設定を保存' })).toBeDisabled();
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
  });
});
