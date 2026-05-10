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
        diagnosisId: 1,
        diagnosisName: '院内未送信病名',
        diagnosisCode: 'E78.5',
        startDate: '2026-04-01',
        layer: 'insurance-local',
      },
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
    expect(within(mirrorList).getByText('8839001')).toBeInTheDocument();
    expect(within(mirrorList).queryByText('副')).not.toBeInTheDocument();
    expect(screen.getByText('ORCA再取得結果を正本として表示')).toBeInTheDocument();
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

  it('病名送信確認で患者文脈とORCA仕様コードを表示し、主病名コードを送信する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'MainDisease' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839001');
    await user.click(within(authoring).getByRole('button', { name: '主病名として登録' }));

    const confirmDialog = await screen.findByRole('dialog', { name: '主病名として登録' });
    expect(within(confirmDialog).getByText('P-TEST-001')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('2026-05-08')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('01')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('0001')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('主病名')).toBeInTheDocument();
    expect(
      within(confirmDialog).getByText(
        'Disease_Insurance_Class=送信しない / Disease_Category=送信しない / Disease_Class=送信しない / Main_Disease_Class=01 / Disease_SuspectedFlag=送信しない / Disease_Receipt_Print=1 / Disease_Receipt_Print_Period=送信しない / Insurance_Disease=送信しない / Discharge_Certificate=送信しない / Sub_Disease_Class=送信しない',
      ),
    ).toBeInTheDocument();
    expect(within(confirmDialog).queryByText('Main_Disease_Class=主病名')).not.toBeInTheDocument();
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

  it('詳細入力の病名属性を表示語とORCA仕様コードに分けて確認し送信する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(await screen.findByRole('button', { name: '詳細入力で追加' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の追加' });
    fireEvent.change(within(dialog).getByLabelText('病名 *'), { target: { value: 'AttributeDisease' } });
    fireEvent.change(within(dialog).getByLabelText('病名構成コード ※必須'), { target: { value: '8839001' } });
    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    await user.click(within(dialog).getByLabelText('保険病名'));
    fireEvent.change(within(dialog).getByLabelText('副病名区分 ※任意'), { target: { value: '02' } });
    fireEvent.change(within(dialog).getByLabelText('病名保険区分 ※任意'), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText('病名カテゴリ ※任意'), { target: { value: 'PD' } });
    fireEvent.change(within(dialog).getByLabelText('病名区分 ※任意'), { target: { value: '03' } });
    fireEvent.change(within(dialog).getByLabelText('レセプト表示期間 ※任意'), { target: { value: '12' } });
    fireEvent.change(within(dialog).getByLabelText('退院証明 ※任意'), { target: { value: '1' } });
    await user.click(within(dialog).getByRole('button', { name: 'ORCAへ病名登録' }));

    const confirmDialog = await screen.findByRole('dialog', { name: 'ORCAへ病名登録' });
    expect(within(confirmDialog).getByText('レセプト表示')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('表示する')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('保険病名')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('指定する')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('合併症')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('病名保険区分')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('保険適用')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('病名カテゴリ')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('難病等')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('病名区分')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('03')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('レセプト表示期間')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('12')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('退院証明')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('対象')).toBeInTheDocument();
    expect(
      within(confirmDialog).getByText(
        'Disease_Insurance_Class=1 / Disease_Category=PD / Disease_Class=03 / Main_Disease_Class=送信しない / Disease_SuspectedFlag=送信しない / Disease_Receipt_Print=1 / Disease_Receipt_Print_Period=12 / Insurance_Disease=1 / Discharge_Certificate=1 / Sub_Disease_Class=02',
      ),
    ).toBeInTheDocument();
    expect(within(confirmDialog).queryByText('Sub_Disease_Class=合併症')).not.toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole('button', { name: 'ORCAへ病名登録' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          diseaseInformation: [
            expect.objectContaining({
              diseaseName: 'AttributeDisease',
              diseaseInsuranceClass: '1',
              diseaseCategory: 'PD',
              diseaseClass: '03',
              diseaseReceiptPrint: '1',
              diseaseReceiptPrintPeriod: '12',
              insuranceDisease: '1',
              dischargeCertificate: '1',
              subDiseaseClass: '02',
            }),
          ],
        }),
      );
    });
  });

  it('レセプト表示期間の範囲外コードは official mutation 前に具体エラーを表示する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(await screen.findByRole('button', { name: '詳細入力で追加' }));
    const dialog = await screen.findByRole('dialog', { name: 'ORCA病名の追加' });
    fireEvent.change(within(dialog).getByLabelText('病名 *'), { target: { value: 'InvalidPeriodDisease' } });
    fireEvent.change(within(dialog).getByLabelText('病名構成コード ※必須'), { target: { value: '8839001' } });
    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    fireEvent.change(within(dialog).getByLabelText('レセプト表示期間 ※任意'), { target: { value: '100' } });
    await user.click(within(dialog).getByRole('button', { name: 'ORCAへ病名登録' }));

    expect((await screen.findAllByText('レセプト表示期間は 00-99 または None の ORCA 仕様コードで入力してください。')).length).toBeGreaterThan(0);
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('確認をキャンセルした場合は official mutation を送らない', async () => {
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'DM' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839002');
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
    fireEvent.change(within(dialog).getByLabelText('病名構成コード ※必須'), { target: { value: '8839001' } });
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
    fireEvent.change(within(dialog).getByLabelText('病名構成コード ※必須'), { target: { value: '8839001' } });
    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    fireEvent.change(within(dialog).getByLabelText(/転帰 ※任意/), { target: { value: '想定外の転帰' } });
    await user.click(within(dialog).getByRole('button', { name: 'ORCAへ病名登録' }));

    expect(
      (await screen.findAllByText('転帰は 継続中、治癒、中止、死亡、移行(ORCA送信保留) のいずれかを入力してください。')).length,
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
    const confirmDialog = await screen.findByRole('dialog', { name: '副病名として登録' });
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
