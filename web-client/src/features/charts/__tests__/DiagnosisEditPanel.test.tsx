import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
      <DiagnosisEditPanel
        patientId="P-TEST-001"
        meta={{
          runId: 'RUN-DIAGNOSIS-PANEL-TEST',
          cacheHit: true,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
        }}
      />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDiseases).mockResolvedValue({
    ok: true,
    patientId: 'P-TEST-001',
    karteId: 1001,
    diseases: [
      {
        diagnosisId: 1,
        diagnosisName: '脂質異常症',
        diagnosisCode: 'E78.5',
        startDate: '2026-04-01',
        layer: 'insurance-local',
      },
      {
        diagnosisId: 2,
        diagnosisName: '高血圧症',
        diagnosisCode: 'I10',
        startDate: '2026-04-02',
        layer: 'orca-mirror',
        readOnly: true,
        syncState: 'conflict',
        note: 'ORCA側と差分があります',
      },
    ],
  });
  vi.mocked(mutateDiseases).mockResolvedValue({
    ok: true,
    runId: 'RUN-MUTATION',
    createdDiagnosisIds: [101],
  });
  vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('DiagnosisEditPanel quick add candidates', () => {
  it('候補プルダウン選択で病名とコードを反映して登録できる', async () => {
    const user = userEvent.setup();
    vi.mocked(searchDiseaseMasterCandidates).mockImplementation(async ({ keyword }) => {
      if (keyword.trim() === '高血') {
        return [{ name: '高血圧症', code: '8839001', icdTen: 'I10' }];
      }
      return [];
    });

    renderPanel();

    expect(await screen.findAllByText('保険病名')).not.toHaveLength(0);
    expect(screen.getByText('ORCA mirror')).toBeInTheDocument();
    expect(screen.getByText('候補')).toBeInTheDocument();
    expect(await screen.findByText('保険病名の確認が必要です')).toBeInTheDocument();
    expect(screen.getByText('clinical source が未実装のため、この画面では保険病名だけを扱います。')).toBeInTheDocument();
    expect(await screen.findByText('ORCA側と差分があります')).toBeInTheDocument();
    expect(await screen.findByText('高血圧症')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('病名 *');
    await user.type(nameInput, '高血');

    await waitFor(() => {
      expect(searchDiseaseMasterCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: '高血',
        }),
      );
    });

    const candidateSelect = await screen.findByLabelText('病名候補');
    await waitFor(() => expect(candidateSelect).not.toBeDisabled());
    const option = Array.from((candidateSelect as HTMLSelectElement).options).find((item) => item.text.includes('高血圧症'));
    expect(option?.value).toBeTruthy();

    await user.selectOptions(candidateSelect, option?.value ?? '');

    expect((screen.getByLabelText('病名 *') as HTMLInputElement).value).toBe('高血圧症');
    expect((screen.getByLabelText('コード') as HTMLInputElement).value).toBe('I10');
    expect(screen.getByText('同期候補があります')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保険病名に追加' }));

    await waitFor(() => {
        expect(mutateDiseases).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'P-TEST-001',
          karteId: 1001,
          operations: [
            expect.objectContaining({
              operation: 'create',
              diagnosisName: '高血圧症',
              diagnosisCode: 'I10',
            }),
          ],
        }),
      );
    });
  });
});
