import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChartsActionBar } from '../ChartsActionBar';
import { postOrcaMedicalModV2Xml } from '../orcaClaimApi';
import { recordChartsAuditEvent } from '../audit';

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/F-1/charts',
    currentScreen: 'charts',
    fromCandidate: undefined,
    returnToCandidate: undefined,
    safeReturnToCandidate: undefined,
    carryover: {},
    external: {},
    encounter: {},
    openReception: vi.fn(),
    openPatients: vi.fn(),
    openCharts: vi.fn(),
    openOrderSets: vi.fn(),
    openPrintOutpatient: vi.fn(),
    openPrintDocument: vi.fn(),
    openMobileImages: vi.fn(),
  }),
}));

vi.mock('../orcaClaimApi', () => ({
  postOrcaMedicalModV2Xml: vi.fn(),
  buildMedicalModV2RequestXml: vi.fn().mockReturnValue('<data></data>'),
}));

vi.mock('../orderRpNormalization', () => ({
  buildMedicalModV2BlockNotice: vi.fn().mockReturnValue(null),
  fetchMedicalModV2OrderBundles: vi.fn().mockResolvedValue({ bundles: [], errors: [] }),
  prepareMedicalModV2SendData: vi.fn().mockReturnValue({
    requiredIssues: [],
    bundleIssues: [],
    codeIssues: [],
    medicalInformationWithSource: [],
    medicalInformationSources: [],
    medicalInformation: [],
    totalGroups: 0,
    groupLimitExceeded: false,
    rowLimitExceeded: false,
    limitReasons: [],
    invalidCodes: [],
  }),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../audit', () => ({
  recordChartsAuditEvent: vi.fn(),
}));

vi.mock('../../../libs/auth/storedAuth', () => ({
  resolveAuditActor: () => ({ actor: 'tester', facilityId: 'F-1', userId: 'U-1' }),
}));

const baseProps = {
  runId: 'RUN-ACTION',
  cacheHit: false,
  missingMaster: false,
  dataSourceTransition: 'server' as const,
  fallbackUsed: false,
};

describe('ChartsActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ORCA送信の成功をトーストと監査ログに反映する', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      invoiceNumber: 'INV-123',
      dataId: 'DATA-123',
      runId: 'RUN-OK',
      traceId: 'TRACE-OK',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          showLegacyOrcaSend
          patientId="P-100"
          visitDate="2026-01-03"
          orcaEncounterContext={{
            patientId: 'P-100',
            visitDate: '2026-01-03',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-100',
            visitDate: '2026-01-03',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: 'ORCAへ送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    expect(screen.getByText('ORCA送信を完了')).toBeInTheDocument();
    expect(recordChartsAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORCA_SEND',
        outcome: 'success',
        details: expect.objectContaining({
          endpoint: '/api/orca/official/chart-support/medical-mod-v2',
          httpStatus: 200,
          apiResult: '00',
          apiResultMessage: 'OK',
          invoiceNumber: 'INV-123',
          dataId: 'DATA-123',
        }),
      }),
    );
  });

  it('ORCA送信確認ダイアログに患者情報と送信対象サマリを表示する', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          showLegacyOrcaSend
          patientId="P-777"
          visitDate="2026-01-08"
          orcaEncounterContext={{
            patientId: 'P-777',
            visitDate: '2026-01-08',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-777',
            visitDate: '2026-01-08',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
          sendConfirmSummary={{
            patientName: '山田太郎',
            patientId: 'P-777',
            birthDate: '1980-05-20',
            sex: '男性',
            age: '45歳',
            visitDate: '2026-01-08',
            receptionId: 'R-777',
            appointmentId: 'A-777',
            department: '内科',
            physician: '医師A',
            insuranceCombination: '0001',
            diagnosisCount: 3,
            orderCount: 5,
            soap: {
              subjective: true,
              objective: true,
              assessment: false,
              plan: true,
            },
            imageAttachmentCount: 2,
          }}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    expect(screen.getByRole('alertdialog', { name: '診療行為ORCA送信の確認' })).toBeInTheDocument();
    expect(screen.getByText('実行操作:')).toBeInTheDocument();
    expect(screen.getByText('診療行為ORCA送信')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ORCAへ送信する' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '送信する' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '患者確認' })).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog', { name: '診療行為ORCA送信の確認' });
    for (const label of ['患者番号', '氏名', '生年月日', '性別', '年齢', '受付日', '診療科', '担当医', '保険組合せ', 'ORCA受付ID']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('山田太郎').length).toBeGreaterThan(0);
    expect(screen.getByText('P-777')).toBeInTheDocument();
    expect(screen.getByText('1980-05-20')).toBeInTheDocument();
    expect(screen.getByText('男性')).toBeInTheDocument();
    expect(screen.getByText('45歳')).toBeInTheDocument();
    expect(screen.getByText('内科')).toBeInTheDocument();
    expect(screen.getByText('医師A')).toBeInTheDocument();
    expect(screen.getByText('R-777')).toBeInTheDocument();
    expect(screen.getByText('A-777')).toBeInTheDocument();
    expect(screen.getByText('3件')).toBeInTheDocument();
    expect(screen.getByText('5件')).toBeInTheDocument();
    expect(screen.getByText('S:あり / O:あり / A:なし / P:あり')).toBeInTheDocument();
    expect(screen.getByText('2件')).toBeInTheDocument();
  });

  it('ORCA送信の不足条件は disabled だけにせず押下時に理由を表示する', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          showLegacyOrcaSend
          missingMaster
          patientId="P-300"
          visitDate="2026-01-09"
          orcaEncounterContext={{
            patientId: 'P-300',
            visitDate: '2026-01-09',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-300',
            visitDate: '2026-01-09',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
        />
      </MemoryRouter>,
    );

    const sendButton = screen.getByRole('button', { name: 'ORCA 送信' });
    expect(sendButton).not.toBeDisabled();
    expect(sendButton).toHaveAttribute('aria-disabled', 'true');
    expect(sendButton).toHaveAttribute('aria-describedby', 'charts-actions-send-guard');
    expect(document.getElementById('charts-actions-send-guard')).toHaveTextContent('ORCA 参照不足: 送信不可');

    await user.click(sendButton);

    expect(screen.getByText(/ORCA送信を停止:/)).toBeInTheDocument();
    expect(screen.getAllByText(/マスタ欠損を検知したため、送信は実施できません。/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('alertdialog', { name: '診療行為ORCA送信の確認' })).not.toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('診察終了は ORCA 追加送信を行わず local after-finish フローを完了する', async () => {
    const user = userEvent.setup();
    const onAfterFinish = vi.fn();

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-200"
          visitDate="2026-01-04"
          orcaEncounterContext={{
            patientId: 'P-200',
            visitDate: '2026-01-04',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-200',
            department: '01 内科',
            visitDate: '2026-01-04',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
          onAfterFinish={onAfterFinish}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '診察終了して会計へ送信' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '診察終了して会計へ送信の確認' });
    expect(within(confirmDialog).getByText('実行操作:')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('P-200')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('2026-01-04')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('会計済み確定ではありません')).toBeInTheDocument();
    expect(onAfterFinish).not.toHaveBeenCalled();
    await user.click(within(confirmDialog).getByRole('button', { name: '診察終了して会計へ送信' }));

    await waitFor(() => expect(onAfterFinish).toHaveBeenCalledTimes(1));
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
    expect(screen.getByText('診察終了して会計へ送信を完了')).toBeInTheDocument();
    expect(recordChartsAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ENCOUNTER_CLOSE',
        outcome: 'success',
        details: expect.objectContaining({
          completionMode: 'close_and_send_to_billing',
        }),
      }),
    );
  });

  it('診療録取消は共通重大操作確認で患者識別情報を再掲してから実行する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-240"
          visitDate="2026-01-06"
          selectedEntry={{ patientId: 'P-240', appointmentId: 'APT-240', receptionId: 'REC-240', visitDate: '2026-01-06' } as any}
          sendConfirmSummary={{
            patientName: '確認 花子',
            patientId: 'P-240',
            birthDate: '1975-02-10',
            sex: '女性',
            age: '50歳',
            visitDate: '2026-01-06',
            receptionId: 'REC-240',
            appointmentId: 'APT-240',
            department: '小児科',
            physician: '医師B',
            insuranceCombination: '0002',
            diagnosisCount: 1,
            orderCount: 2,
            soap: {
              subjective: true,
              objective: false,
              assessment: true,
              plan: false,
            },
            imageAttachmentCount: 0,
          }}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByText('その他'));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    const confirmDialog = await screen.findByRole('alertdialog', { name: '診療録取消の確認' });
    expect(within(confirmDialog).getByText('実行操作:')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('診療録取消')).toBeInTheDocument();
    for (const label of ['患者番号', '氏名', '生年月日', '性別', '年齢', '受付日', '診療科', '担当医', '保険組合せ', 'ORCA受付ID']) {
      expect(within(confirmDialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(confirmDialog).getAllByText('確認 花子').length).toBeGreaterThan(0);
    expect(within(confirmDialog).getByText('P-240')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('1975-02-10')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('女性')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('50歳')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('小児科')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('医師B')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('0002')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('REC-240')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('APT-240')).toBeInTheDocument();
    expect(within(confirmDialog).getByText('診療録取消の確定ではありません')).toBeInTheDocument();
    expect(screen.queryByText('キャンセルを完了')).not.toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole('button', { name: '診療録取消を実行する' }));

    expect(await screen.findByText('キャンセルを完了')).toBeInTheDocument();
    expect(recordChartsAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DRAFT_CANCEL',
        outcome: 'success',
        patientId: 'P-240',
        appointmentId: 'APT-240',
      }),
    );
  });

  it('診察終了・会計送信の不足条件は disabled だけにせず押下時に理由を表示する', async () => {
    const user = userEvent.setup();
    const onAfterFinish = vi.fn();
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          missingMaster
          patientId="P-301"
          visitDate="2026-01-09"
          orcaEncounterContext={{
            patientId: 'P-301',
            visitDate: '2026-01-09',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-301',
            visitDate: '2026-01-09',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
          onAfterFinish={onAfterFinish}
        />
      </MemoryRouter>,
    );

    const finishButton = screen.getByRole('button', { name: '診察終了して会計へ送信' });
    expect(finishButton).not.toBeDisabled();
    expect(finishButton).toHaveAttribute('aria-disabled', 'true');
    expect(finishButton).toHaveAttribute('aria-describedby', 'charts-actions-finish-guard');
    expect(document.getElementById('charts-actions-finish-guard')).toHaveTextContent('ORCA 参照不足: 会計送信不可');

    await user.click(finishButton);

    expect(screen.getByText(/診察終了して会計へ送信を停止:/)).toBeInTheDocument();
    expect(screen.getAllByText(/マスタ欠損を検知したため、送信は実施できません。/).length).toBeGreaterThan(0);
    expect(onAfterFinish).not.toHaveBeenCalled();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('encounter context が不足している場合は ORCA 送信を押下時に停止し不足理由を表示する', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          showLegacyOrcaSend
          patientId="P-201"
          visitDate="2026-01-04"
          selectedEntry={{ patientId: 'P-201', visitDate: '2026-01-04', departmentCode: '01' } as any}
        />
      </MemoryRouter>,
    );

    const sendButton = screen.getByRole('button', { name: 'ORCA 送信' });
    expect(sendButton).not.toBeDisabled();
    expect(sendButton).toHaveAttribute('aria-disabled', 'true');
    expect(sendButton).toHaveAttribute('data-disabled-reason', expect.stringContaining('missing_encounter_context'));
    expect(screen.getAllByText(/Physician_Code/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Insurance_Combination_Number/).length).toBeGreaterThan(0);
    await user.click(sendButton);
    expect(screen.getByText(/ORCA送信を停止:/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: '診療行為ORCA送信の確認' })).not.toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('official visit row 実値が不足している場合は Voucher/Sequential を補完せず push-time で fail-close する', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          showLegacyOrcaSend
          patientId="P-202"
          visitDate="2026-01-04"
          orcaEncounterContext={{
            patientId: 'P-202',
            visitDate: '2026-01-04',
            departmentCode: '01',
            physicianCode: '10001',
          }}
          selectedEntry={{
            patientId: 'P-202',
            visitDate: '2026-01-04',
            scheduleKey: 'F001:S202',
            encounterKey: 'F001:E202',
            departmentCode: '01',
            physicianCode: '10001',
            status: '受付中',
            source: 'visits',
          } as any}
        />
      </MemoryRouter>,
    );

    const sendButton = screen.getByRole('button', { name: 'ORCA 送信' });
    expect(sendButton).not.toBeDisabled();
    expect(sendButton).toHaveAttribute('aria-disabled', 'true');
    expect(sendButton).toHaveAttribute('data-disabled-reason', expect.stringContaining('missing_encounter_context'));
    expect(screen.getAllByText(/Insurance_Combination_Number/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Voucher_Number/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sequential_Number/).length).toBeGreaterThan(0);
    await user.click(sendButton);
    expect(screen.getByText(/ORCA送信を停止:/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: '診療行為ORCA送信の確認' })).not.toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('送信/印刷ガードは折りたたまず visible note で表示する', () => {
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-202"
          visitDate="2026-01-04"
          selectedEntry={{ patientId: 'P-202', visitDate: '2026-01-04', departmentCode: '01' } as any}
        />
      </MemoryRouter>,
    );

    const sendGuard = document.getElementById('charts-actions-send-guard');
    const printGuard = document.getElementById('charts-actions-print-guard');
    expect(sendGuard).not.toBeNull();
    expect(printGuard).not.toBeNull();
    expect(sendGuard?.querySelector('details')).toBeNull();
    expect(printGuard?.querySelector('details')).toBeNull();
    expect(sendGuard).toHaveTextContent('送信不可');
    expect(printGuard).toHaveTextContent('印刷不可');
  });

  it('compact header の fallbackUsed 警告を詳細 disclosure 外に表示する', () => {
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          compactHeader
          defaultCollapsed
          fallbackUsed
          patientId="P-203"
          visitDate="2026-01-04"
          selectedEntry={{ patientId: 'P-203', visitDate: '2026-01-04', departmentCode: '01' } as any}
        />
      </MemoryRouter>,
    );

    const alert = screen.getByTestId('charts-actions-fallback-alert');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('暫定データ表示中');
    expect(alert).toHaveTextContent('ORCA送信・会計送信・印刷前に最新データを再取得してください。');
    expect(alert.closest('details')).toBeNull();
  });

  it('診察開始は afterStart 成功後のみ success toast を出す', async () => {
    const user = userEvent.setup();
    const onAfterStart = vi.fn().mockResolvedValue({
      requestId: 'req-start-1',
      traceId: 'trace-start-1',
      encounterKey: 'F001:E100',
      idempotencyKey: 'idem-start-1',
      detail: 'checked_in -> chart_opened / encounterKey=F001:E100 / requestId=req-start-1',
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-101"
          visitDate="2026-01-03"
          selectedEntry={{ patientId: 'P-101', status: '受付済み', visitDate: '2026-01-03' } as any}
          onAfterStart={onAfterStart}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '診察開始' }));

    await waitFor(() => expect(onAfterStart).toHaveBeenCalledTimes(1));
    expect(screen.getByText('診察開始を完了')).toBeInTheDocument();
    expect(screen.getByText('画面上の状態更新を確認してください。')).toBeInTheDocument();
    expect(screen.queryByText(/checked_in -> chart_opened/)).not.toBeInTheDocument();
  });

  it('埋め込みCTAは診察開始成功後に診察終了・会計送信へ切り替わる', async () => {
    const user = userEvent.setup();
    const onAfterStart = vi.fn().mockResolvedValue({
      requestId: 'req-start-embedded',
      traceId: 'trace-start-embedded',
      encounterKey: 'F001:E200',
      idempotencyKey: 'idem-start-embedded',
      detail: 'checked_in -> chart_opened',
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          embedded
          compactHeader
          patientId="P-102"
          visitDate="2026-01-03"
          selectedEntry={{ patientId: 'P-102', status: '受付中', visitDate: '2026-01-03' } as any}
          onAfterStart={onAfterStart}
        />
      </MemoryRouter>,
    );

    const patientInlineGroup = screen.getByRole('group', { name: '患者情報帯の補助操作' });
    await user.click(within(patientInlineGroup).getByRole('button', { name: '診察開始' }));

    await waitFor(() => expect(onAfterStart).toHaveBeenCalledTimes(1));
    expect(within(patientInlineGroup).getByRole('button', { name: '診察終了して会計へ送信' })).toBeInTheDocument();
  });

  it('診察開始の afterStart が失敗した場合は success toast を出さず raw detail も表示しない', async () => {
    const user = userEvent.setup();
    const onAfterStart = vi.fn().mockRejectedValue(new Error('encounterKey がないため診察開始を実行できません。'));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-102"
          visitDate="2026-01-03"
          selectedEntry={{ patientId: 'P-102', status: '受付済み', visitDate: '2026-01-03' } as any}
          onAfterStart={onAfterStart}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '診察開始' }));

    await waitFor(() => expect(onAfterStart).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('診察開始を完了')).not.toBeInTheDocument();
    expect(screen.getByText(/診察開始は完了確認できませんでした。状態を確認してからやり直してください。/)).toBeInTheDocument();
    expect(screen.queryByText(/encounterKey がないため診察開始を実行できません。/)).not.toBeInTheDocument();
  });

  it('診察中断では start hook を呼ばない', async () => {
    const user = userEvent.setup();
    const onAfterStart = vi.fn();
    const onAfterPause = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-103"
          visitDate="2026-01-03"
          selectedEntry={{ patientId: 'P-103', status: '診療中', visitDate: '2026-01-03' } as any}
          onAfterStart={onAfterStart}
          onAfterPause={onAfterPause}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '診察中断' }));

    await waitFor(() => expect(onAfterPause).toHaveBeenCalledTimes(1));
    expect(onAfterStart).not.toHaveBeenCalled();
  });

  it('診察終了では start hook を呼ばない', async () => {
    const user = userEvent.setup();
    const onAfterStart = vi.fn();
    const onAfterFinish = vi.fn();

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-104"
          visitDate="2026-01-04"
          orcaEncounterContext={{
            patientId: 'P-104',
            visitDate: '2026-01-04',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-104',
            status: '診療中',
            visitDate: '2026-01-04',
            department: '01 内科',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
          onAfterStart={onAfterStart}
          onAfterFinish={onAfterFinish}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '診察終了して会計へ送信' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '診察終了して会計へ送信の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: '診察終了して会計へ送信' }));

    await waitFor(() => expect(onAfterFinish).toHaveBeenCalledTimes(1));
    expect(onAfterStart).not.toHaveBeenCalled();
  });

  it('署名確定中でも履歴追記前提で印刷操作はガードしない', () => {
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-300"
          visitDate="2026-01-05"
          orcaEncounterContext={{
            patientId: 'P-300',
            visitDate: '2026-01-05',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-300',
            appointmentId: 'APT-1',
            visitDate: '2026-01-05',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
          approvalLock={{ locked: true, runId: 'RUN-LOCK', action: 'send' }}
        />
      </MemoryRouter>,
    );

    const printButton = screen.getByRole('button', { name: '印刷/エクスポート' });
    expect(printButton).not.toBeDisabled();
    expect(screen.getAllByText(/承認済み（署名確定）/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/編集内容は履歴として追記/).length).toBeGreaterThan(0);
  });

  it('署名確定解除は共通重大操作確認で患者と影響範囲を再掲してから実行する', async () => {
    const user = userEvent.setup();
    const onApprovalUnlock = vi.fn();
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-310"
          visitDate="2026-01-05"
          orcaEncounterContext={{
            patientId: 'P-310',
            visitDate: '2026-01-05',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          }}
          selectedEntry={{
            patientId: 'P-310',
            name: '署名患者',
            appointmentId: 'APT-310',
            receptionId: 'REC-310',
            visitDate: '2026-01-05',
            departmentCode: '01',
            physicianCode: '10001',
            insuranceCombinationNumber: '0001',
            voucherNumber: '1234',
            sequentialNumber: '1',
          } as any}
          approvalLock={{ locked: true, runId: 'RUN-LOCK', action: 'send' }}
          onApprovalUnlock={onApprovalUnlock}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '署名確定解除' }));

    const firstDialog = await screen.findByRole('alertdialog', { name: '署名確定解除' });
    expect(within(firstDialog).getByText('実行操作:')).toBeInTheDocument();
    expect(within(firstDialog).getAllByText('署名患者').length).toBeGreaterThan(0);
    expect(within(firstDialog).getByText('P-310')).toBeInTheDocument();
    expect(within(firstDialog).getByText('REC-310')).toBeInTheDocument();
    expect(within(firstDialog).getByText('APT-310')).toBeInTheDocument();
    expect(within(firstDialog).getByText('診療録確定や会計済み確定ではありません')).toBeInTheDocument();
    expect(onApprovalUnlock).not.toHaveBeenCalled();

    await user.click(within(firstDialog).getByRole('button', { name: '最終確認へ' }));
    const finalDialog = await screen.findByRole('alertdialog', { name: '署名確定解除: 最終確認' });
    expect(within(finalDialog).getByText('最終確認')).toBeInTheDocument();

    await user.click(within(finalDialog).getByRole('button', { name: '解除を実行' }));

    expect(onApprovalUnlock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/署名確定を解除しました。/)).toBeInTheDocument();
  });

  it('閲覧専用時は印刷がガードされる', () => {
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-400"
          visitDate="2026-01-06"
          selectedEntry={{ patientId: 'P-400', appointmentId: 'APT-2', visitDate: '2026-01-06' } as any}
          editLock={{ readOnly: true, reason: '別タブが編集中です', lockStatus: 'other-tab' }}
        />
      </MemoryRouter>,
    );

    const printButton = screen.getByRole('button', { name: '印刷/エクスポート' });
    expect(printButton).toBeDisabled();
    expect(screen.getAllByText(/並行編集: 閲覧専用で印刷不可/).length).toBeGreaterThan(0);
  });

  it('UIロック中は印刷がガードされる', () => {
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-500"
          visitDate="2026-01-07"
          selectedEntry={{ patientId: 'P-500', appointmentId: 'APT-3', visitDate: '2026-01-07' } as any}
          uiLockReason="別アクション実行中"
        />
      </MemoryRouter>,
    );

    const printButton = screen.getByRole('button', { name: '印刷/エクスポート' });
    expect(printButton).toBeDisabled();
    expect(screen.getAllByText(/ロック中: 操作中で印刷不可/).length).toBeGreaterThan(0);
  });

  it('親から渡されたUIロック理由をonLockChangeへ折り返さない', async () => {
    const onLockChange = vi.fn();

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-501"
          visitDate="2026-01-07"
          uiLockReason="対象来院を再解決できません。"
          onLockChange={onLockChange}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(onLockChange).toHaveBeenCalled());
    expect(onLockChange).toHaveBeenLastCalledWith(false, undefined);
    expect(onLockChange).not.toHaveBeenCalledWith(true, '対象来院を再解決できません。');
  });

  it('selectedEntry.id は patientId として扱わず送信/終了を押下時にブロックする', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          visitDate="2026-01-09"
          selectedEntry={{ id: 'row-100', appointmentId: 'APT-ROW', visitDate: '2026-01-09' } as any}
        />
      </MemoryRouter>,
    );

    const finishButton = screen.getByRole('button', { name: '診察終了して会計へ送信' });
    expect(finishButton).not.toBeDisabled();
    expect(finishButton).toHaveAttribute('aria-disabled', 'true');
    await user.click(finishButton);
    expect(screen.getByText(/会計送信を停止:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ORCA 送信' })).not.toBeInTheDocument();
  });

  it('埋め込み時も診察終了・会計送信CTAとガード理由を患者情報帯に表示する', () => {
    const onReturnToReception = vi.fn();
    const onCloseChartTab = vi.fn();

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          embedded
          compactHeader
          patientId="P-600"
          visitDate="2026-01-10"
          selectedEntry={{ patientId: 'P-600', appointmentId: 'APT-6', visitDate: '2026-01-10', status: '診療中' } as any}
          onReturnToReception={onReturnToReception}
          onCloseChartTab={onCloseChartTab}
        />
      </MemoryRouter>,
    );

    const patientInlineGroup = screen.getByRole('group', { name: '患者情報帯の補助操作' });
    expect(within(patientInlineGroup).queryByRole('button', { name: '受付へ戻る' })).not.toBeInTheDocument();
    const draftButton = within(patientInlineGroup).getByRole('button', { name: '下書き保存' });
    const finishButton = within(patientInlineGroup).getByRole('button', { name: '診察終了して会計へ送信' });
    expect(draftButton).toBeInTheDocument();
    expect(finishButton).toBeInTheDocument();
    expect(Boolean(finishButton.compareDocumentPosition(draftButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(within(patientInlineGroup).getByRole('button', { name: '印刷/エクスポート' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'ORCA送信・会計連携状態' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '診療行為送信候補の確認' })).not.toBeInTheDocument();
    expect(screen.queryByText('送信前候補確認')).not.toBeInTheDocument();
    expect(screen.queryByText('その他')).not.toBeInTheDocument();
    expect(screen.queryByText('補助操作', { selector: 'summary' })).toBeNull();
  });
});
