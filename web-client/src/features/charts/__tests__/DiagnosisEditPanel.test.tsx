import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DiagnosisEditPanel, type DiagnosisEditPanelMeta } from '../DiagnosisEditPanel';
import { fetchDiseases, mutateOrcaDisease, resolveDiseaseCodeFromOrcaMaster, searchDiseaseMasterCandidates } from '../diseaseApi';

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

const renderPanel = (metaOverride: Partial<DiagnosisEditPanelMeta> = {}) => {
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
          runId: 'RUN-DIAGNOSIS-PANEL-TEST',
          cacheHit: true,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          visitDate: '2026-05-08',
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
          ...metaOverride,
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
    orcaMirrorStatus: 'connected',
    diseases: [
      {
        diagnosisId: 1,
        diagnosisName: '院内未送信病名',
        diagnosisCode: 'E78.5',
        startDate: '2026-04-01',
        layer: 'insurance-local',
      },
      {
        diagnosisId: 2,
        diagnosisName: 'ORCA登録済み病名',
        diagnosisCode: 'I10',
        startDate: '2026-04-02',
        layer: 'orca-mirror',
        readOnly: true,
        syncState: 'conflict',
        note: 'ORCA側と差分があります',
      },
    ],
  });
  vi.mocked(mutateOrcaDisease).mockResolvedValue({
    ok: true,
    runId: 'RUN-ORCA-DISEASE-MUTATION',
  });
  vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValue(undefined);
  vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('DiagnosisEditPanel ORCA source-of-truth contract', () => {
  it('displays ORCA registered diagnoses as the main source and keeps local-only entries out of the ORCA mirror list', async () => {
    renderPanel();

    const mirrorList = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    expect(within(mirrorList).getByText('ORCA登録済み病名')).toBeInTheDocument();
    expect(within(mirrorList).queryByText('院内未送信病名')).not.toBeInTheDocument();
    expect(within(mirrorList).queryByText('I10')).not.toBeInTheDocument();
    expect(within(mirrorList).queryByText('副')).not.toBeInTheDocument();
    expect(screen.getByText('ORCA再取得結果を正本として表示')).toBeInTheDocument();
    expect(screen.queryByText('保険病名の確認が必要です')).not.toBeInTheDocument();
  });

  it('病名コードは通常表示せず、コードがない行だけ警告を表示する', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [
        {
          diagnosisId: 10,
          diagnosisName: 'コードなし病名',
          startDate: '2026-04-03',
          layer: 'orca-mirror',
          readOnly: true,
        },
      ],
    });

    renderPanel();

    const mirrorList = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const row = within(mirrorList).getByText('コードなし病名').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('コード未設定')).toBeVisible();
    expect(within(mirrorList).queryByText('未設定')).not.toBeInTheDocument();
  });

  it('入力後も確認するまで送信せず、確認後だけ official disease-mod-v3 mutation を呼ぶ', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'HTN' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('I10');
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('dialog', { name: '副病名として登録' });
    expect(within(confirmDialog).getByText('HTN')).toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
    await user.click(within(confirmDialog).getByRole('button', { name: '副病名として登録' }));

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
              insuranceCombinationNumber: '0001',
            }),
          ],
        }),
      );
    });
    expect(mutateOrcaDisease).not.toHaveBeenCalledWith(expect.objectContaining({ requestNumber: expect.anything() }));
  });

  it('確認をキャンセルした場合は official mutation を送らない', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'DM' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('E11');
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('dialog', { name: '副病名として登録' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'キャンセル' }));

    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('転帰日が開始日前の場合は official mutation 前に具体エラーを表示する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(await screen.findByRole('button', { name: '詳細入力で追加' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の追加' });
    fireEvent.change(within(dialog).getByLabelText('病名 *'), { target: { value: 'ReverseDate' } });
    fireEvent.change(within(dialog).getByLabelText('病名コード ※任意'), { target: { value: 'I10' } });
    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    fireEvent.change(within(dialog).getByLabelText(/開始日/), { target: { value: '2026-04-20' } });
    fireEvent.change(within(dialog).getByLabelText(/転帰日/), { target: { value: '2026-04-10' } });
    await user.click(within(dialog).getByRole('button', { name: 'ORCAへ病名登録' }));

    expect((await screen.findAllByText('転帰日は開始日以降の日付を入力してください。')).length).toBeGreaterThan(0);
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('未知の転帰は official mutation 前に具体エラーを表示する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(await screen.findByRole('button', { name: '詳細入力で追加' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の追加' });
    fireEvent.change(within(dialog).getByLabelText('病名 *'), { target: { value: 'UnknownOutcome' } });
    fireEvent.change(within(dialog).getByLabelText('病名コード ※任意'), { target: { value: 'I10' } });
    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    fireEvent.change(within(dialog).getByLabelText(/転帰 ※任意/), { target: { value: '想定外の転帰' } });
    await user.click(within(dialog).getByRole('button', { name: 'ORCAへ病名登録' }));

    expect(
      (await screen.findAllByText('転帰は 継続、治癒、中止、再発、死亡、転院、不明 のいずれかを入力してください。')).length,
    ).toBeGreaterThan(0);
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('行の削除ボタンは確認ダイアログを経由し、即時 mutation しない', async () => {
    const user = userEvent.setup();

    renderPanel();

    const mirrorTable = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const diseaseRow = within(mirrorTable).getByText('ORCA登録済み病名').closest('tr');
    expect(diseaseRow).not.toBeNull();
    await user.click(within(diseaseRow as HTMLElement).getByRole('button', { name: '削除' }));

    expect(mutateOrcaDisease).not.toHaveBeenCalled();
    const confirmDialog = await screen.findByRole('dialog', { name: 'ORCA病名を削除' });
    expect(within(confirmDialog).getByText('ORCA登録済み病名')).toBeInTheDocument();
  });

  it('ORCA更新が業務エラーで完了した場合も確認モーダルを閉じる', async () => {
    const user = userEvent.setup();
    vi.mocked(mutateOrcaDisease).mockResolvedValueOnce({
      ok: false,
      message: 'target disease changed not found',
      runId: 'RUN-ORCA-DISEASE-BUSINESS-ERROR',
    });

    renderPanel();

    const mirrorTable = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const diseaseRow = within(mirrorTable).getByText('ORCA登録済み病名').closest('tr');
    expect(diseaseRow).not.toBeNull();
    await user.click(within(diseaseRow as HTMLElement).getByRole('button', { name: '編集' }));
    const editDialog = await screen.findByRole('dialog', { name: 'ORCA病名の更新' });
    await user.click(within(editDialog).getByRole('button', { name: 'ORCA病名を更新' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'ORCA病名を更新' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'ORCA病名を更新' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'ORCA病名を更新' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('target disease changed not found')).toBeInTheDocument();
  });
});
