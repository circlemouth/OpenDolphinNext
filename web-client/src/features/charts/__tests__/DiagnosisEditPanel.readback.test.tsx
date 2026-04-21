import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DiagnosisEditPanel
        patientId="P-DIAG-READBACK"
        meta={{
          runId: 'RUN-DIAG-READBACK',
          cacheHit: false,
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
    patientId: 'P-DIAG-READBACK',
    karteId: 2001,
    diseases: [
      {
        diagnosisId: 11,
        diagnosisName: '糖尿病',
        diagnosisCode: 'E11',
        startDate: '2026-04-10',
        endDate: '2026-04-20',
        outcome: '治癒',
        category: '主病名',
        suspectedFlag: '疑い',
        layer: 'insurance-local',
      },
      {
        diagnosisId: 12,
        diagnosisName: 'ORCA参照病名',
        diagnosisCode: 'I10',
        startDate: '2026-04-12',
        outcome: '継続',
        layer: 'orca-mirror',
        readOnly: true,
        syncState: 'manual-resolution',
      },
    ],
  });
  vi.mocked(mutateDiseases).mockResolvedValue({
    ok: true,
    runId: 'RUN-DIAG-MUTATION',
    updatedDiagnosisIds: [11],
  });
  vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('DiagnosisEditPanel readback contract', () => {
  it('principal and suspected fields roundtrip from readback into badge, edit dialog, and update payload', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByText('転帰あり（1件）'));
    const insuranceList = screen.getByLabelText('保険病名（転帰あり）');
    expect(within(insuranceList).getByText('糖尿病')).toBeInTheDocument();
    expect(within(insuranceList).getByText('開始:2026-04-10')).toBeInTheDocument();
    expect(within(insuranceList).getByText('終了:2026-04-20')).toBeInTheDocument();
    expect(within(insuranceList).getByText('転帰:治癒')).toBeInTheDocument();
    expect(within(insuranceList).getByText('主')).toBeInTheDocument();
    expect(within(insuranceList).getByText('疑い')).toBeInTheDocument();

    await user.click(within(insuranceList).getByRole('button', { name: '編集' }));

    const dialog = await screen.findByRole('dialog', { name: '病名の編集' });
    expect(within(dialog).getByLabelText('病名 *')).toHaveValue('糖尿病');
    expect(within(dialog).getByLabelText('主病名')).toBeChecked();
    expect(within(dialog).getByLabelText('疑い')).toBeChecked();

    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    expect(within(dialog).getByLabelText('開始日')).toHaveValue('2026-04-10');
    expect(within(dialog).getByLabelText('転帰日')).toHaveValue('2026-04-20');
    expect(within(dialog).getByLabelText('転帰')).toHaveValue('治癒');

    await user.clear(within(dialog).getByLabelText('転帰'));
    await user.type(within(dialog).getByLabelText('転帰'), '継続');
    await user.click(within(dialog).getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(mutateDiseases).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'P-DIAG-READBACK',
          karteId: 2001,
          operations: [
            expect.objectContaining({
              operation: 'update',
              diagnosisId: 11,
              diagnosisName: '糖尿病',
              diagnosisCode: 'E11',
              startDate: '2026-04-10',
              endDate: '2026-04-20',
              outcome: '継続',
              category: '主病名',
              suspectedFlag: '疑い',
            }),
          ],
        }),
      );
    });
  });

  it('keeps ORCA mirror read-only and does not auto-persist master candidates before explicit confirm', async () => {
    const user = userEvent.setup();
    vi.mocked(searchDiseaseMasterCandidates).mockResolvedValueOnce([
      { name: '高血圧症', code: '8839001', icdTen: 'I10' },
    ]);
    renderPanel();

    expect(await screen.findByText('ORCA参照病名')).toBeInTheDocument();
    const mirrorList = screen.getAllByLabelText('ORCA mirror').find((element) => element.tagName.toLowerCase() === 'ul');
    if (!mirrorList) {
      throw new Error('ORCA mirror list was not rendered');
    }
    expect(within(mirrorList).getByText('ORCA参照病名')).toBeInTheDocument();
    expect(within(mirrorList).queryByRole('button', { name: '編集' })).not.toBeInTheDocument();
    expect(within(mirrorList).queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/急性/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('病名 *'), '高血');
    await waitFor(() => {
      expect(searchDiseaseMasterCandidates).toHaveBeenCalledWith(expect.objectContaining({ keyword: '高血' }));
    });
    const candidateSelect = await screen.findByLabelText('病名候補');
    await waitFor(() => expect(candidateSelect).not.toBeDisabled());
    const selected = Array.from((candidateSelect as HTMLSelectElement).options).find((option) => option.text.includes('高血圧症'));
    expect(selected?.value).toBeTruthy();

    await user.selectOptions(candidateSelect, selected?.value ?? '');

    expect(screen.getByLabelText('病名 *')).toHaveValue('高血圧症');
    expect(screen.getByLabelText('コード')).toHaveValue('I10');
    expect(mutateDiseases).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '保険病名に追加' }));

    await waitFor(() => {
      expect(mutateDiseases).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: [
            expect.objectContaining({
              operation: 'create',
              diagnosisName: '高血圧症',
              diagnosisCode: 'I10',
              category: '副病名',
              suspectedFlag: undefined,
            }),
          ],
        }),
      );
    });
  });
});
