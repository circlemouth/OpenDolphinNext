import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';

import { DiagnosisEditPanel } from '../DiagnosisEditPanel';
import { fetchDiseases, mutateDiseases, searchDiseaseMasterCandidates } from '../diseaseApi';

vi.mock('../diseaseApi', async () => {
  const actual = await vi.importActual<typeof import('../diseaseApi')>('../diseaseApi');
  return {
    ...actual,
    fetchDiseases: vi.fn(),
    mutateDiseases: vi.fn(),
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
        }}
      />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mutateDiseases).mockResolvedValue({ ok: true });
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

    expect(await screen.findByText('ORCA登録済み病名')).toBeInTheDocument();
    expect(screen.getByText('ORCA側と差分があります')).toBeInTheDocument();
    expect(screen.queryByText(/まだ接続されていない/)).not.toBeInTheDocument();
    expect(mutateDiseases).not.toHaveBeenCalled();
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

  it('shows only safe copy when ORCA mirror retrieval is unavailable', async () => {
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
      await screen.findByText('ORCA病名を取得できませんでした。同期状態は未確認です。保険病名はこの画面で登録・編集できます。'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/orca\.internal\.example/)).not.toBeInTheDocument();
  });
});
