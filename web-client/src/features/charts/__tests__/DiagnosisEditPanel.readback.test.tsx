import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DiagnosisEditPanel } from '../DiagnosisEditPanel';
import { fetchDiseasesWithPatientImportRecovery, mutateOrcaDisease, searchDiseaseMasterCandidates } from '../diseaseApi';

vi.mock('../diseaseApi', async () => {
  const actual = await vi.importActual<typeof import('../diseaseApi')>('../diseaseApi');
  return {
    ...actual,
    fetchDiseasesWithPatientImportRecovery: vi.fn(),
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
          visitDate: '2026-05-08',
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
        }}
      />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDiseasesWithPatientImportRecovery).mockResolvedValue({
    ok: true,
    patientId: 'P-DIAG-READBACK',
    karteId: 2001,
    orcaMirrorStatus: 'connected',
    diseases: [
      {
        diagnosisId: 11,
        diagnosisName: '糖尿病',
        diagnosisCode: '8839101',
        startDate: '2026-04-10',
        endDate: '2026-04-20',
        outcome: '治癒',
        category: '主病名',
        suspectedFlag: '疑い',
        layer: 'orca-mirror',
        readOnly: true,
        components: [
          {
            seq: 1,
            componentType: 'BODY',
            code: '8839101',
            name: '糖尿病',
          },
        ],
      },
      {
        diagnosisId: 12,
        diagnosisName: 'ORCA参照病名',
        diagnosisCode: '8839002',
        startDate: '2026-04-12',
        outcome: '継続',
        layer: 'orca-mirror',
        readOnly: true,
        syncState: 'manual-resolution',
        components: [
          {
            seq: 1,
            componentType: 'BODY',
            code: '8839002',
            name: 'ORCA参照病名',
          },
        ],
      },
    ],
  });
  vi.mocked(mutateOrcaDisease).mockResolvedValue({ ok: true, runId: 'RUN-DIAG-MUTATION' });
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
    expect(screen.getByText('保険病名の確認が必要です')).toBeInTheDocument();
    const insuranceList = screen.getByLabelText('ORCA登録病名（転帰あり）');
    expect(within(insuranceList).getByText('糖尿病')).toBeInTheDocument();
    expect(within(insuranceList).getByText('2026-04-10')).toBeInTheDocument();
    expect(within(insuranceList).getByText('終了 2026-04-20')).toBeInTheDocument();
    expect(within(insuranceList).getByText('治癒')).toBeInTheDocument();
    expect(within(insuranceList).getByText('主')).toBeInTheDocument();
    expect(within(insuranceList).getByText('疑い')).toBeInTheDocument();

    await user.click(within(insuranceList).getByRole('button', { name: '編集' }));

    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の更新' });
    expect(within(dialog).getByLabelText('病名 *')).toHaveValue('糖尿病');
    expect(within(dialog).getByLabelText('主病名')).toBeChecked();
    expect(within(dialog).getByLabelText('疑い')).toBeChecked();

    await user.click(within(dialog).getByText('詳細（開始/転帰/保険病名）'));
    expect(within(dialog).getByLabelText(/開始日/)).toHaveValue('2026-04-10');
    expect(within(dialog).getByLabelText(/転帰日/)).toHaveValue('2026-04-20');
    expect(within(dialog).getByLabelText(/転帰 ※任意/)).toHaveValue('治癒');

    await user.selectOptions(within(dialog).getByLabelText(/転帰 ※任意/), '');
    await user.click(within(dialog).getByRole('button', { name: '送信内容を確認' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'ORCA病名を更新の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'ORCA病名を更新' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update',
          patientId: 'P-DIAG-READBACK',
          performDate: '2026-05-08',
          departmentCode: '01',
          diseaseInformation: [
            expect.objectContaining({
              diseaseName: '糖尿病',
              diseaseCode: '8839101',
              outcome: 'ACTIVE',
              orcaOutcomeSendCode: undefined,
              components: [
                expect.objectContaining({
                  seq: 1,
                  componentType: 'BODY',
                  code: '8839101',
                  name: '糖尿病',
                }),
              ],
            }),
          ],
          targetDisease: expect.objectContaining({
            diseaseName: '糖尿病',
            diseaseCode: '8839101',
            diseaseStartDate: '2026-04-10',
          }),
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
    const mirrorList = screen.getAllByLabelText('ORCA登録病名（活動中）').find((element) => element.tagName.toLowerCase() === 'table');
    if (!mirrorList) {
      throw new Error('ORCA mirror table was not rendered');
    }
    expect(within(mirrorList).getByText('ORCA参照病名')).toBeInTheDocument();
    expect(screen.queryByLabelText(/急性/)).not.toBeInTheDocument();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    await user.type(screen.getByLabelText('病名 *'), '高血');
    await waitFor(() => {
      expect(searchDiseaseMasterCandidates).toHaveBeenCalledWith(expect.objectContaining({ keyword: '高血' }));
    });
    const candidateList = await screen.findByRole('listbox', { name: '病名 *候補' });
    await user.click(within(candidateList).getByRole('option', { name: /高血圧症/ }));

    expect(screen.getByLabelText('病名 *')).toHaveValue('高血圧症');
    expect(screen.getByText(/コードに紐づく病名です。/)).toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();

    const authoring = screen.getByLabelText('ORCAへ病名登録');
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '副病名として登録の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: '副病名として登録' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create',
          patientId: 'P-DIAG-READBACK',
          performDate: '2026-05-08',
          departmentCode: '01',
          diseaseInformation: [
            expect.objectContaining({
              diseaseName: '高血圧症',
              diseaseCode: '8839001',
              components: [
                expect.objectContaining({
                  seq: 1,
                  componentType: 'BODY',
                  code: '8839001',
                  name: '高血圧症',
                }),
              ],
            }),
          ],
        }),
      );
    });
  });
});
