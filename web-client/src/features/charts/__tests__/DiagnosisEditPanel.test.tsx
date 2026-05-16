import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DiagnosisEditPanel, type ChartTextDiseaseMention, type DiagnosisEditPanelMeta } from '../DiagnosisEditPanel';
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

const renderPanel = (metaOverride: Partial<DiagnosisEditPanelMeta> = {}, chartTextDiseaseMentions?: ChartTextDiseaseMention[]) => {
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
        chartTextDiseaseMentions={chartTextDiseaseMentions}
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
        diagnosisId: 2,
        diagnosisName: 'ORCA登録済み病名',
        diagnosisCode: '8839001',
        startDate: '2026-04-02',
        layer: 'orca-mirror',
        readOnly: true,
        syncState: 'conflict',
        note: 'ORCA側と差分があります',
        components: [
          {
            seq: 1,
            componentType: 'BODY',
            code: '8839001',
            name: 'ORCA登録済み病名',
          },
        ],
      },
    ],
    pendingLocalDiseases: [
      {
        diagnosisId: 1,
        diagnosisName: '送信候補病名',
        diagnosisCode: 'E78.5',
        startDate: '2026-04-01',
        layer: 'candidate',
        candidateKind: 'draftCandidate',
        sourceOfTruth: 'local-candidate',
        readOnly: true,
        candidateOnly: true,
        syncState: 'candidate',
        note: 'ORCA未登録の送信候補です。ORCA登録済み病名ではありません。',
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
    expect(within(mirrorList).queryByText('送信候補病名')).not.toBeInTheDocument();
    expect(within(mirrorList).queryByText('副')).not.toBeInTheDocument();
    const mirrorRow = within(mirrorList).getByText('ORCA登録済み病名').closest('tr');
    expect(mirrorRow).not.toBeNull();
    expect(within(mirrorRow as HTMLElement).queryByText('8839001')).not.toBeInTheDocument();
    const editButton = within(mirrorRow as HTMLElement).getByRole('button', { name: '編集' });
    const deleteButton = within(mirrorRow as HTMLElement).getByRole('button', { name: '削除' });
    expect(editButton.querySelector('img.clinical-icon')).not.toBeNull();
    expect(deleteButton.querySelector('img.clinical-icon')).not.toBeNull();
    expect(editButton).not.toHaveTextContent('編集');
    expect(deleteButton).not.toHaveTextContent('削除');
    const panel = screen.getByTestId('diagnosis-edit-panel');
    expect(within(panel).queryByText('ORCA再取得結果を正本として表示')).not.toBeInTheDocument();
    expect(within(panel).getByText('1件', { selector: '.charts-diagnosis__count-badge' })).toBeVisible();
    expect(within(panel).getByText('活動中の病名')).toBeVisible();
    const candidateSection = screen.getByRole('region', { name: 'ORCA未登録の送信候補' });
    expect(within(candidateSection).getByText('送信候補')).toBeInTheDocument();
    expect(within(candidateSection).getByText('1件 / ORCA登録済みではありません')).toBeInTheDocument();
    expect(within(candidateSection).getByText('送信候補病名')).toBeInTheDocument();
    expect(within(candidateSection).getByText('ORCA未登録の送信候補')).toBeInTheDocument();
    expect(within(candidateSection).getByText('候補')).toBeInTheDocument();
    expect(within(candidateSection).getByText(/local候補はORCA未登録です/)).toBeInTheDocument();
    const candidateRow = within(candidateSection).getByText('送信候補病名').closest('tr');
    expect(candidateRow).not.toBeNull();
    const registerButton = within(candidateRow as HTMLElement).getByRole('button', { name: 'ORCAへ登録' });
    expect(registerButton.querySelector('img.clinical-icon')).not.toBeNull();
    expect(registerButton).not.toHaveTextContent('ORCAへ登録');
    expect(screen.queryByText('保険病名の確認が必要です')).not.toBeInTheDocument();
  });

  it('separates chart text disease mentions from ORCA registered diagnoses without adding mutation actions', async () => {
    renderPanel({}, [{ sectionLabel: 'Assessment', text: '診断名: 高血圧症疑い', source: 'draft' }]);

    const chartTextSection = await screen.findByRole('region', { name: '診療録本文中の病名記載' });
    expect(within(chartTextSection).getByText('診療録本文中の病名記載')).toBeInTheDocument();
    expect(within(chartTextSection).getByText('診断名: 高血圧症疑い')).toBeInTheDocument();
    expect(within(chartTextSection).getByText('編集中')).toBeInTheDocument();
    expect(within(chartTextSection).getByText('診療録本文中の病名記載はカルテ本文の正本です。ORCA登録病名へは明示確認後に登録してください。')).toBeInTheDocument();
    expect(within(chartTextSection).queryByRole('button')).not.toBeInTheDocument();

    const mirrorList = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    expect(within(mirrorList).queryByText('診断名: 高血圧症疑い')).not.toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('削除病名整理は閲覧専用時に native disabled へ依存せず、押下時も送信せず理由を表示する', async () => {
    const user = userEvent.setup();

    renderPanel({ readOnly: true, readOnlyReason: '別タブが編集中です' });

    const organizeButton = screen.getByRole('button', { name: '削除病名を整理' });
    await waitFor(() => expect(organizeButton).not.toBeDisabled());
    expect(organizeButton).toHaveAttribute('aria-disabled', 'true');
    expect(organizeButton).toHaveAttribute('aria-describedby', 'diagnosis-mutation-block-reason');
    await user.click(organizeButton);

    expect(screen.getByText('ORCA病名操作を停止: 別タブが編集中です')).toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
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
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839001');
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '副病名として登録の確認' });
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
              diseaseCode: '8839001',
              components: [
                expect.objectContaining({
                  code: '8839001',
                  componentType: 'BODY',
                }),
              ],
              insuranceCombinationNumber: '0001',
            }),
          ],
        }),
      );
    });
    expect(mutateOrcaDisease).not.toHaveBeenCalledWith(expect.objectContaining({ requestNumber: expect.anything() }));
  });

  it('病名送信確認で患者文脈を表示し、主病名コードを送信する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'MainDisease' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839001');
    await user.click(within(authoring).getByRole('button', { name: '主病名として登録' }));

    const confirmDialog = await screen.findByRole('alertdialog', { name: '主病名として登録の確認' });
    expect(within(confirmDialog).getAllByText('P-TEST-001').length).toBeGreaterThan(0);
    expect(within(confirmDialog).getByText('2026-05-08')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('01')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('0001')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('主病名')).toBeInTheDocument();
    expect(within(confirmDialog).queryByText('ORCA送信コード')).not.toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();

    await user.click(within(confirmDialog).getByRole('button', { name: '主病名として登録' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          diseaseInformation: [
            expect.objectContaining({
              diseaseName: 'MainDisease',
              diseaseCode: '8839001',
              mainDiseaseClass: '01',
              diseaseSuspectedFlag: undefined,
              diseaseReceiptPrint: '1',
            }),
          ],
        }),
      );
    });
  });

  it('登録済み病名の編集で必要な病名属性を確認し送信する', async () => {
    const user = userEvent.setup();

    renderPanel();

    const mirrorTable = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const diseaseRow = within(mirrorTable).getByText('ORCA登録済み病名').closest('tr');
    expect(diseaseRow).not.toBeNull();
    await user.click(within(diseaseRow as HTMLElement).getByRole('button', { name: '編集' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の更新' });
    await user.click(within(dialog).getByText('詳細（開始/転帰/保険病名）'));
    await user.click(within(dialog).getByLabelText('保険病名'));
    fireEvent.change(within(dialog).getByLabelText('副病名区分 ※任意'), { target: { value: '02' } });
    fireEvent.change(within(dialog).getByLabelText('病名保険区分 ※任意'), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText('病名カテゴリ ※任意'), { target: { value: 'PD' } });
    await user.click(within(dialog).getByRole('button', { name: '送信内容を確認' }));

    const confirmDialog = await screen.findByRole('alertdialog', { name: 'ORCA病名を更新の確認' });
    expect(within(confirmDialog).getByText('レセプト表示')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('表示する')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('保険病名')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('指定する')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('合併症')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('病名保険区分')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('保険適用')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('病名カテゴリ')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('難病等')).toBeInTheDocument();
    expect(within(confirmDialog).queryByText('病名区分')).not.toBeInTheDocument();
    expect(within(confirmDialog).queryByText('レセプト表示期間')).not.toBeInTheDocument();
    expect(within(confirmDialog).queryByText('退院証明')).not.toBeInTheDocument();
    expect(within(confirmDialog).queryByText('ORCA送信コード')).not.toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole('button', { name: 'ORCA病名を更新' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update',
          diseaseInformation: [
            expect.objectContaining({
              diseaseName: 'ORCA登録済み病名',
              diseaseInsuranceClass: '1',
              diseaseCategory: 'PD',
              diseaseReceiptPrint: '1',
              insuranceDisease: '1',
              subDiseaseClass: '02',
            }),
          ],
        }),
      );
    });
  });

  it('ORCAへ病名登録の入力欄に接頭・病名・接尾を表示し、病名候補を反映する', async () => {
    const user = userEvent.setup();
    vi.mocked(searchDiseaseMasterCandidates).mockResolvedValueOnce([
      { name: '高血圧症', code: '8839001' },
    ]);

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    expect(within(authoring).getByLabelText('接頭')).toBeVisible();
    expect(within(authoring).getByLabelText('病名 *')).toBeVisible();
    expect(within(authoring).getByLabelText('接尾')).toBeVisible();
    expect(screen.queryByRole('button', { name: '詳細入力で追加' })).not.toBeInTheDocument();

    await user.type(within(authoring).getByLabelText('病名 *'), '高血');
    const option = await screen.findByRole('option', { name: /高血圧症/ });
    await user.click(option);

    expect(within(authoring).getByLabelText('病名 *')).toHaveValue('高血圧症');
  });

  it('詳細編集では内部コード系の入力欄を表示しない', async () => {
    const user = userEvent.setup();

    renderPanel();

    const mirrorTable = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const diseaseRow = within(mirrorTable).getByText('ORCA登録済み病名').closest('tr');
    expect(diseaseRow).not.toBeNull();
    await user.click(within(diseaseRow as HTMLElement).getByRole('button', { name: '編集' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の更新' });
    await user.click(within(dialog).getByText('詳細（開始/転帰/保険病名）'));

    expect(within(dialog).queryByLabelText('病名区分 ※任意')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('退院証明 ※任意')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('レセプト表示期間 ※任意')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('病名構成コード ※必須')).not.toBeInTheDocument();
  });

  it('確認をキャンセルした場合は official mutation を送らない', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'DM' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839002');
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '副病名として登録の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'キャンセル' }));

    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('転帰日が開始日前の場合は official mutation 前に具体エラーを表示する', async () => {
    const user = userEvent.setup();

    renderPanel();

    const mirrorTable = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const diseaseRow = within(mirrorTable).getByText('ORCA登録済み病名').closest('tr');
    expect(diseaseRow).not.toBeNull();
    await user.click(within(diseaseRow as HTMLElement).getByRole('button', { name: '編集' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の更新' });
    await user.click(within(dialog).getByText('詳細（開始/転帰/保険病名）'));
    fireEvent.change(within(dialog).getByLabelText(/開始日/), { target: { value: '2026-04-20' } });
    fireEvent.change(within(dialog).getByLabelText(/転帰日/), { target: { value: '2026-04-10' } });
    await user.click(within(dialog).getByRole('button', { name: '送信内容を確認' }));

    expect((await screen.findAllByText('転帰日は開始日以降の日付を入力してください。')).length).toBeGreaterThan(0);
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('転帰はORCA向け選択肢から選び、選択した転帰コードを送信する', async () => {
    const user = userEvent.setup();

    renderPanel();

    const mirrorTable = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const diseaseRow = within(mirrorTable).getByText('ORCA登録済み病名').closest('tr');
    expect(diseaseRow).not.toBeNull();
    await user.click(within(diseaseRow as HTMLElement).getByRole('button', { name: '編集' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の更新' });
    await user.click(within(dialog).getByText('詳細（開始/転帰/保険病名）'));
    fireEvent.change(within(dialog).getByLabelText(/転帰 ※任意/), { target: { value: '治癒' } });
    await user.click(within(dialog).getByRole('button', { name: '送信内容を確認' }));

    const confirmDialog = await screen.findByRole('alertdialog', { name: 'ORCA病名を更新の確認' });
    expect(within(confirmDialog).getByText('治癒')).toBeInTheDocument();
    await user.click(within(confirmDialog).getByRole('button', { name: 'ORCA病名を更新' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          diseaseInformation: [
            expect.objectContaining({
              outcome: 'CURED',
              diseaseOutCome: 'F',
            }),
          ],
        }),
      );
    });
  });

  it('行の削除ボタンは確認ダイアログを経由し、即時 mutation しない', async () => {
    const user = userEvent.setup();

    renderPanel();

    const mirrorTable = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    const diseaseRow = within(mirrorTable).getByText('ORCA登録済み病名').closest('tr');
    expect(diseaseRow).not.toBeNull();
    await user.click(within(diseaseRow as HTMLElement).getByRole('button', { name: '削除' }));

    expect(mutateOrcaDisease).not.toHaveBeenCalled();
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'ORCA病名を削除の確認' });
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
    await user.click(within(editDialog).getByRole('button', { name: '送信内容を確認' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'ORCA病名を更新の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: 'ORCA病名を更新' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: 'ORCA病名を更新の確認' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('target disease changed not found')).toBeInTheDocument();
  });

  it('ORCA警告と不一致病名を折りたたまず初期表示する', async () => {
    const user = userEvent.setup();
    vi.mocked(mutateOrcaDisease).mockResolvedValueOnce({
      ok: false,
      businessAccepted: true,
      needsUserReview: true,
      operationStatus: 'ORCA_UNMATCHED',
      apiResult: '000',
      responseClassification: 'accepted_with_unmatched',
      warnings: [{ code: 'W001', messageCategory: 'warning_like', position: 1 }],
      unmatchInformation: [
        {
          code: 'U001',
          name: '要確認病名',
          supplementName: '右片側',
          inOut: 'O',
          category: 'PD',
          suspectedFlag: 'S',
          startDate: '2026-04-01',
          endDate: '2026-04-10',
          outcome: '1',
          messageCategory: 'unmatched_like',
        },
      ],
    });

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'ReviewDisease' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839001');
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '副病名として登録の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: '副病名として登録' }));

    const reviewPanel = await screen.findByRole('region', { name: 'ORCA病名送信の要確認' });
    expect(within(reviewPanel).getByText('ORCA病名送信の要確認')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('ORCAから警告または不一致が返りました。ORCA再取得結果と未照合病名を確認し、必要なら病名を修正して再送してください。')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('ORCA_UNMATCHED')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('000')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('accepted_with_unmatched')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('ORCA警告')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('code=W001 / 分類=warning_like / 位置=1')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('ORCA側のみ存在する未照合病名')).toBeInTheDocument();
    expect(
      within(reviewPanel).getByText(
        'code=U001 / 病名=要確認病名 / 補足=右片側 / 入外=O / 区分=PD / 疑い=S / 開始=2026-04-01 / 転帰日=2026-04-10 / 転帰=1 / 分類=unmatched_like',
      ),
    ).toBeInTheDocument();
  });
});
