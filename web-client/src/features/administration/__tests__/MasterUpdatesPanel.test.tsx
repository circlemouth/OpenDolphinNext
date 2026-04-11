import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MasterUpdatesPanel } from '../MasterUpdatesPanel';

const {
  mockFetchMasterUpdateDatasetDetail,
  mockFetchMasterUpdateDatasets,
  mockFetchMasterUpdateSchedule,
  mockRunMasterUpdateDataset,
  mockRollbackMasterUpdateDataset,
  mockSaveMasterUpdateSchedule,
  mockUploadMasterUpdateDataset,
} = vi.hoisted(() => ({
  mockFetchMasterUpdateDatasetDetail: vi.fn(),
  mockFetchMasterUpdateDatasets: vi.fn(),
  mockFetchMasterUpdateSchedule: vi.fn(),
  mockRunMasterUpdateDataset: vi.fn(),
  mockRollbackMasterUpdateDataset: vi.fn(),
  mockSaveMasterUpdateSchedule: vi.fn(),
  mockUploadMasterUpdateDataset: vi.fn(),
}));

vi.mock('../../../libs/auth/roles', () => ({
  isSystemAdminRole: vi.fn(() => true),
}));

vi.mock('../../../libs/ui/appToast', () => ({
  useAppToast: () => ({ enqueue: vi.fn() }),
}));

vi.mock('../masterUpdateApi', () => ({
  fetchMasterUpdateDatasetDetail: mockFetchMasterUpdateDatasetDetail,
  fetchMasterUpdateDatasets: mockFetchMasterUpdateDatasets,
  fetchMasterUpdateSchedule: mockFetchMasterUpdateSchedule,
  rollbackMasterUpdateDataset: mockRollbackMasterUpdateDataset,
  runMasterUpdateDataset: mockRunMasterUpdateDataset,
  saveMasterUpdateSchedule: mockSaveMasterUpdateSchedule,
  uploadMasterUpdateDataset: mockUploadMasterUpdateDataset,
}));

const dataset = {
  code: 'orca_master_core',
  name: 'ORCA core master',
  status: 'update_detected',
  currentRecordCount: 12,
  updateDetected: true,
  manualUploadAllowed: false,
  officialSource: {
    kind: 'masterlastupdatev3',
    lastCheckedAt: '2026-04-11T00:00:00Z',
    sourceUrl: 'orca:masterlastupdatev3',
    updateFrequency: '15分',
    format: 'XML',
    usageNotes: 'read only',
  },
  localArtifacts: {
    manualUploadAllowed: false,
    versions: [
      {
        versionId: '20260411-aaaa1111',
        sourceKind: 'official_fetch',
        capturedAt: '2026-04-11T00:10:00Z',
        recordCount: 12,
        addedCount: 1,
        removedCount: 0,
        changedCount: 0,
        current: true,
      },
    ],
  },
  versions: [
    {
      versionId: '20260411-aaaa1111',
      sourceKind: 'official_fetch',
      capturedAt: '2026-04-11T00:10:00Z',
      recordCount: 12,
      addedCount: 1,
      removedCount: 0,
      changedCount: 0,
      current: true,
    },
  ],
};

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MasterUpdatesPanel runId="RUN-MASTER" role="system_admin" />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  mockFetchMasterUpdateDatasets.mockResolvedValue({ datasets: [dataset] });
  mockFetchMasterUpdateDatasetDetail.mockResolvedValue({ dataset });
  mockFetchMasterUpdateSchedule.mockResolvedValue({
    schedule: {
      autoUpdateTime: '03:00',
      retryCount: 2,
      timeoutSeconds: 300,
      maxConcurrency: 2,
      orcaPollIntervalMinutes: 15,
      datasetAutoEnabledOverrides: {},
    },
  });
  mockRunMasterUpdateDataset.mockResolvedValue({ ok: true, dataset, message: 'done' });
  mockRollbackMasterUpdateDataset.mockResolvedValue({ ok: true, dataset, message: 'done' });
  mockSaveMasterUpdateSchedule.mockResolvedValue({
    schedule: {
      autoUpdateTime: '03:00',
      retryCount: 2,
      timeoutSeconds: 300,
      maxConcurrency: 2,
      orcaPollIntervalMinutes: 15,
      datasetAutoEnabledOverrides: {},
    },
  });
  mockUploadMasterUpdateDataset.mockResolvedValue({ ok: true, dataset, message: 'done' });
});

describe('MasterUpdatesPanel', () => {
  it('official source と local artifact を分離して表示する', async () => {
    renderPanel();

    expect(await screen.findByText('official masterlastupdatev3')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'official再取得' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'local artifact をアップロード' })).toBeInTheDocument();
    expect(screen.getByText('official fetch')).toBeInTheDocument();
  });

  it('official再取得ボタンが run request を呼ぶ', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click((await screen.findAllByRole('button', { name: 'official再取得' }))[0]);

    await waitFor(() => {
      expect(mockRunMasterUpdateDataset).toHaveBeenCalledWith('orca_master_core', false);
    });
  });
});
