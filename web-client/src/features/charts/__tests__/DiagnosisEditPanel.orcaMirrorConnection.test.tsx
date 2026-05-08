import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DiagnosisEditPanel } from '../DiagnosisEditPanel';
import { fetchDiseases, mutateOrcaDisease, searchDiseaseMasterCandidates } from '../diseaseApi';

vi.mock('../diseaseApi', async () => {
  const actual = await vi.importActual<typeof import('../diseaseApi')>('../diseaseApi');
  return {
    ...actual,
    fetchDiseases: vi.fn(),
    mutateOrcaDisease: vi.fn(),
    resolveDiseaseCodeFromOrcaMaster: vi.fn(async () => undefined),
    searchDiseaseMasterCandidates: vi.fn(),
  };
});

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

const renderPanel = (visitDate?: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DiagnosisEditPanel
        patientId="P-TEST-001"
        meta={{
          runId: 'RUN-DIAGNOSIS-ORCA-MIRROR',
          cacheHit: true,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          visitDate,
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
        }}
      />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mutateOrcaDisease).mockResolvedValue({ ok: true });
  vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('DiagnosisEditPanel ORCA mirror connection', () => {
  it('shows ORCA registered diagnoses from the connected mirror without auto-authoring local diseases', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [
        {
          diagnosisId: 10,
          diagnosisName: 'ローカル病名',
          diagnosisCode: 'L001',
          startDate: '2026-05-01',
          layer: 'insurance-local',
        },
        {
          diagnosisName: 'ORCA登録済み病名',
          diagnosisCode: 'I10',
          startDate: '2026-05-01',
          layer: 'orca-mirror',
          readOnly: true,
          syncState: 'conflict',
          note: 'ORCA側と差分があります',
        },
      ],
    });

    renderPanel('2026-05-08');

    const mirrorList = await screen.findByRole('list', { name: 'ORCA登録病名（活動中）' });
    expect(within(mirrorList).getByText('ORCA登録済み病名')).toBeInTheDocument();
    expect(within(mirrorList).queryByText('ローカル病名')).not.toBeInTheDocument();
    expect(screen.getByText('ORCA側と差分があります')).toBeInTheDocument();
    expect(screen.queryByText(/まだ接続されていない/)).not.toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
    expect(fetchDiseases).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'P-TEST-001', to: '2026-05-08' }));
  });

  it('shows a connected empty mirror as no ORCA registered diagnoses', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [],
    });

    renderPanel('2026-05-08');

    expect(await screen.findByText('ORCAに登録済みの病名はありません。')).toBeInTheDocument();
    expect(screen.queryByText(/まだ接続されていない/)).not.toBeInTheDocument();
  });

  it('shows only safe copy and disables ORCA mutation when ORCA mirror retrieval is unavailable', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'unavailable',
      message: 'https://orca.internal.example/raw',
      diseases: [],
    });

    renderPanel();

    expect(
      await screen.findByText('ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/orca\.internal\.example/)).not.toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: 'ORCAへ病名登録' })) {
      expect(button).toBeDisabled();
    }
  });

  it('sends ORCA disease create only after explicit confirmation and does not call local diagnosis mutation', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDiseases).mockResolvedValue({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [],
    });

    renderPanel('2026-05-08');

    const authoring = await screen.findByRole('region', { name: 'ORCAへ病名登録' });
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'HTN' } });
    fireEvent.change(within(authoring).getByLabelText('コード ※任意'), { target: { value: 'I10' } });
    await user.click(within(authoring).getByRole('button', { name: 'ORCAへ病名登録' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'ORCAへ病名登録' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'ORCAへ病名登録' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create',
          patientId: 'P-TEST-001',
          performDate: '2026-05-08',
          departmentCode: '01',
          diseaseInformation: [
            expect.objectContaining({
              diseaseName: 'HTN',
              diseaseCode: 'I10',
              diseaseStartDate: expect.any(String),
            }),
          ],
        }),
      );
    });
    expect(mutateOrcaDisease).not.toHaveBeenCalledWith(expect.objectContaining({ requestNumber: expect.anything() }));
  });
});
