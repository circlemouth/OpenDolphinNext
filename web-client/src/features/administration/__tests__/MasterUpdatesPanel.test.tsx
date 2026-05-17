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
  mockPreviewMasterUpdateDatasetUpload,
} = vi.hoisted(() => ({
  mockFetchMasterUpdateDatasetDetail: vi.fn(),
  mockFetchMasterUpdateDatasets: vi.fn(),
  mockFetchMasterUpdateSchedule: vi.fn(),
  mockRunMasterUpdateDataset: vi.fn(),
  mockRollbackMasterUpdateDataset: vi.fn(),
  mockSaveMasterUpdateSchedule: vi.fn(),
  mockUploadMasterUpdateDataset: vi.fn(),
  mockPreviewMasterUpdateDatasetUpload: vi.fn(),
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
  previewMasterUpdateDatasetUpload: mockPreviewMasterUpdateDatasetUpload,
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
    officialLastUpdateDate: '2026-04-11',
    officialCapturedAt: '2026-04-11T00:10:00Z',
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
  return render(
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
  mockPreviewMasterUpdateDatasetUpload.mockResolvedValue({
    ok: true,
    preview: {
      importable: true,
      uploadedSha256: 'a'.repeat(64),
      importedRows: 17,
      masterVersion: 'orca-db-container-20260517',
      sourceKind: 'orca-db-container-artifact',
      sourceId: 'orca-db-container:jma-receipt-docker-db-1',
      masterTypeCounts: { drug: 1, 'order-inputsets': 4 },
      warnings: [],
    },
  });
});

describe('MasterUpdatesPanel', () => {
  it('official source と local artifact を分離して表示する', async () => {
    renderPanel();

    expect(await screen.findByText('official masterlastupdatev3')).toBeInTheDocument();
    expect(
      screen.getByText('official 最終更新情報の確認と、取り込んだ local artifact の管理を分けて表示します。official 取得を実行すると、結果は local artifact 履歴へ追加されます。'),
    ).toBeInTheDocument();
    expect(screen.getByText('official最終更新日')).toBeInTheDocument();
    expect(screen.getByText('official 最終更新情報')).toBeInTheDocument();
    expect(screen.getByText('local artifact 履歴 / rollback')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'official取得を実行' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '確定アップロード' })).toBeInTheDocument();
    expect(screen.getByText('official fetch')).toBeInTheDocument();
  });

  it('official取得ボタンが run request を呼ぶ', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click((await screen.findAllByRole('button', { name: 'official取得を実行' }))[0]);

    await waitFor(() => {
      expect(mockRunMasterUpdateDataset).toHaveBeenCalledWith('orca_master_core', false);
    });
  });

  it('local master cache は preview 後の hash で確定アップロードする', async () => {
    const user = userEvent.setup();
    const localDataset = {
      ...dataset,
      code: 'local_orca_master_cache',
      name: 'OpenDolphin local ORCA master cache',
      manualUploadAllowed: true,
      localArtifacts: {
        manualUploadAllowed: true,
        versions: [],
      },
      versions: [],
    };
    mockFetchMasterUpdateDatasets.mockResolvedValue({ datasets: [localDataset] });
    mockFetchMasterUpdateDatasetDetail.mockResolvedValue({ dataset: localDataset });
    const { container } = renderPanel();

    const file = new File(['zip'], 'opendolphin-local-orca-master-cache.zip', { type: 'application/zip' });
    await screen.findAllByText('OpenDolphin local ORCA master cache');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    await user.upload(input, file);
    await user.click(screen.getByRole('button', { name: 'artifact を検証' }));

    expect(await screen.findByText('masterVersion: orca-db-container-20260517')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '確定アップロード' }));

    await waitFor(() => {
      expect(mockUploadMasterUpdateDataset).toHaveBeenCalledWith(
        'local_orca_master_cache',
        file,
        'a'.repeat(64),
      );
    });
  });
});
