import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OrcaSummary } from '../OrcaSummary';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

const { getOrcaClaimSendEntryForRowMock } = vi.hoisted(() => ({
  getOrcaClaimSendEntryForRowMock: vi.fn(),
}));

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('../orcaClaimSendCache', () => ({
  getOrcaClaimSendEntryForRow: getOrcaClaimSendEntryForRowMock,
}));

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/FAC-TEST/charts',
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

vi.mock('../authService', () => ({
  useAuthService: () => ({
    flags: {
      runId: 'RUN-ORCA',
      missingMaster: false,
      cacheHit: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    },
  }),
}));

vi.mock('../../../AppRouter', () => ({
  useOptionalSession: () => ({ facilityId: 'FAC-TEST', userId: 'user01' }),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: () => undefined,
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: () => ({ timestamp: new Date().toISOString() }),
  logUiState: () => ({ timestamp: new Date().toISOString() }),
}));

const renderIncomeActionSummary = (
  props: Partial<Parameters<typeof OrcaSummary>[0]> = {},
  queryState: Partial<ReturnType<typeof useQueryMock>> = {},
) => {
  getOrcaClaimSendEntryForRowMock.mockReturnValue(null);
  useQueryMock.mockReturnValue({
    data: undefined,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...queryState,
  });

  return render(
    <OrcaSummary
      summary={{ missingMaster: false } as any}
      claim={{
        claimStatus: '会計待ち',
        claimStatusText: 'ローカル未送信',
        recordsReturned: 1,
        bundles: [{ totalClaimAmount: 1200, items: [] }],
      } as any}
      {...props}
    />,
  );
};

describe('OrcaSummary semantics', () => {
  it('correction note と setting note を details 外の must-visible 領域に出す', () => {
    getOrcaClaimSendEntryForRowMock.mockReturnValue({
      patientId: 'P-1',
      appointmentId: 'A-1',
      receptionId: 'R-1',
      scheduleKey: 'SCH-1',
      encounterKey: 'ENC-1',
      performDate: '2026-03-09',
      invoiceNumber: 'INV-1',
      sendStatus: 'success',
      medicalWarnings: [{ message: '補正候補があります', code: 'W01', groupPosition: 1, itemPosition: 1 }],
      savedAt: '2026-03-09T09:30:00Z',
    });
    useQueryMock.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(
      <OrcaSummary
        summary={{ missingMaster: false } as any}
        claim={{
          claimStatus: '会計待ち',
          claimStatusText: 'ローカル未送信',
          recordsReturned: 1,
          bundles: [{ totalClaimAmount: 1200, items: [] }],
        } as any}
        patientId="P-1"
        visitDate="2026-03-09"
        appointmentId="A-1"
        receptionId="R-1"
        scheduleKey="SCH-1"
        encounterKey="ENC-1"
        orcaEncounterContext={{
          patientId: 'P-1',
          visitDate: '2026-03-09',
          departmentCode: '01',
          physicianCode: '10001',
          insuranceCombinationNumber: '0001',
          voucherNumber: '1234',
          sequentialNumber: '1',
        }}
      />,
    );

    const correctionNote = container.querySelector('[data-test-id="orca-billing-correction-note"]');
    const settingNote = container.querySelector('[data-test-id="orca-billing-setting-note"]');
    expect(correctionNote).toBeVisible();
    expect(settingNote).toBeVisible();
    expect(correctionNote).toHaveTextContent('補正が必要です');
    expect(settingNote).toHaveTextContent('収納情報の確認前です');
    expect(screen.getByText('ORCA送信応答: 送達確認')).toBeVisible();
    expect(screen.queryByText('ORCA送信: 成功')).not.toBeInTheDocument();
    expect(screen.queryByText(/ORCA送信成功|ORCAへ反映|会計へ反映/)).not.toBeInTheDocument();

    const details = container.querySelector('.orca-summary__details-fold');
    expect(details?.querySelector('[data-test-id="orca-billing-correction-note"]')).toBeNull();
    expect(details?.querySelector('[data-test-id="orca-billing-setting-note"]')).toBeNull();
  });

  it('収納情報確認 button が patientId 未確定で disabled のとき直近に理由と条件を表示する', () => {
    const { container } = renderIncomeActionSummary({ visitDate: '2026-03-09' });

    const incomeCard = container.querySelector('[data-test-id="orca-income-summary-card"]') as HTMLElement;
    const button = within(incomeCard).getByRole('button', { name: '収納情報を確認' });
    const helper = incomeCard.querySelector('[data-test-id="orca-income-refresh-disabled-reason"]') as HTMLElement;

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-disabled-reason', 'no-patient');
    expect(button).toHaveAttribute('aria-describedby', helper.id);
    expect(helper).toBeVisible();
    expect(helper).toHaveTextContent('患者IDが確定すると収納情報を確認できます。');

    const details = container.querySelector('.orca-summary__details-fold');
    expect(details?.querySelector('[data-test-id="orca-income-refresh-disabled-reason"]')).toBeNull();
  });

  it('収納情報確認 button が来院日未確定で disabled のとき直近に理由と条件を表示する', () => {
    const { container } = renderIncomeActionSummary({ patientId: 'P-1' });

    const incomeCard = container.querySelector('[data-test-id="orca-income-summary-card"]') as HTMLElement;
    const button = within(incomeCard).getByRole('button', { name: '収納情報を確認' });
    const helper = incomeCard.querySelector('[data-test-id="orca-income-refresh-disabled-reason"]') as HTMLElement;

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-disabled-reason', 'missing-perform-date');
    expect(button).toHaveAttribute('aria-describedby', helper.id);
    expect(helper).toBeVisible();
    expect(helper).toHaveTextContent('来院日が確定すると収納情報を確認できます。');
  });

  it('収納情報確認 button が loading で disabled のとき確認中を表示する', () => {
    const { container } = renderIncomeActionSummary(
      { patientId: 'P-1', visitDate: '2026-03-09' },
      { isFetching: true },
    );

    const incomeCard = container.querySelector('[data-test-id="orca-income-summary-card"]') as HTMLElement;
    const button = within(incomeCard).getByRole('button', { name: '収納情報確認中…' });
    const helper = incomeCard.querySelector('[data-test-id="orca-income-refresh-disabled-reason"]') as HTMLElement;

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-disabled-reason', 'loading');
    expect(button).toHaveAttribute('aria-describedby', helper.id);
    expect(helper).toBeVisible();
    expect(helper).toHaveTextContent('収納情報を確認しています。');
  });

  it('ORCA収納情報と院内ローカル診療サマリの責務を分離し official ラベルを表示する', () => {
    getOrcaClaimSendEntryForRowMock.mockReturnValue(null);
    useQueryMock.mockReturnValue({
      data: {
        ok: true,
        apiOk: true,
        apiResult: '0000',
        apiResultMessage: 'OK',
        informationDate: '20260309',
        informationTime: '093000',
        entries: [
          {
            performDate: '2026-03-09',
            departmentName: '内科',
            insuranceCombinationNumber: '0001',
            claimAmount: 1200,
            paymentAmount: 700,
            insuranceAppliedAmount: 400,
            selfPayAmount: 100,
          },
        ],
        unpaidMoneyTotal: 500,
        unpaidMoneyInformationOverflow: false,
        unpaidMoneyInformation: [
          {
            performDate: '2026-03-09',
            invoiceNumber: 'INV-1',
            unpaidMoney: 500,
          },
        ],
      },
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(
      <OrcaSummary
        summary={{ missingMaster: false } as any}
        claim={{
          claimStatus: '会計待ち',
          claimStatusText: 'ローカル未送信',
          recordsReturned: 1,
          bundles: [{ totalClaimAmount: 1200, items: [] }],
        } as any}
        patientId="P-1"
        visitDate="2026-03-09"
        appointmentId="A-1"
        receptionId="R-1"
        scheduleKey="SCH-1"
        encounterKey="ENC-1"
        orcaEncounterContext={{
          patientId: 'P-1',
          visitDate: '2026-03-09',
          departmentCode: '01',
          physicianCode: '10001',
          insuranceCombinationNumber: '0001',
          voucherNumber: '1234',
          sequentialNumber: '1',
        }}
      />,
    );

    const details = container.querySelector('.orca-summary__details-fold');
    expect(details).not.toBeNull();
    const detailsWithin = within(details as HTMLElement);
    const incomeCard = container.querySelector('[data-test-id="orca-income-summary-card"]');
    expect(incomeCard).not.toBeNull();
    expect(incomeCard).toBeVisible();

    const expectVisibleOutsideDetails = (text: string | RegExp) => {
      expect(screen.getByText(text)).toBeVisible();
      expect(detailsWithin.queryByText(text)).not.toBeInTheDocument();
    };

    expectVisibleOutsideDetails('Workflow / 院内ローカル診療サマリ');
    expectVisibleOutsideDetails('院内編集中のローカル集計です。ORCA の請求・収納記録ではありません。');
    expectVisibleOutsideDetails('Transmission / medical-mod-v2');
    expectVisibleOutsideDetails('medical-mod-v2 の送信結果です。会計済み判定や診療録確定とは別に扱ってください。');
    expect(screen.queryByText(/medical-mod-v2.*診療録確定.*完了/)).not.toBeInTheDocument();
    expectVisibleOutsideDetails('ORCA由来 収納 cache');
    expectVisibleOutsideDetails('ORCA正本由来の official incomeinfv2 cache です。OpenDolphinNext の会計・収納・領収正本ではありません。');
    expectVisibleOutsideDetails('対象日: 2026-03-09');
    expectVisibleOutsideDetails(/ORCA受付ID: 1234-1/);
    expectVisibleOutsideDetails(/保険組合せ: 0001/);
    expectVisibleOutsideDetails('未収金合計 (Unpaid_Money_Total)');
    expectVisibleOutsideDetails('請求金額 (Ac_Money)');
    expectVisibleOutsideDetails('入金額 (Ic_Money)');
    expectVisibleOutsideDetails('保険適用金額 (Ai_Money)');
    expectVisibleOutsideDetails('自費金額 (Oe_Money)');
    expectVisibleOutsideDetails('食事・生活療養負担金 (Ml_Smoney)');
    expectVisibleOutsideDetails(/2026-03-09 ｜ 内科 ｜ 請求金額: 1,200 円 ｜ 入金額:/);
    expectVisibleOutsideDetails(/未収金情報: 2026-03-09 ｜ 伝票 INV-1 ｜ 500 円/);
    expect(screen.queryByText('請求サマリ')).not.toBeInTheDocument();
  });

  it('same-day 別 encounter の cache では positive transmission / invoice / warning を出さない', () => {
    getOrcaClaimSendEntryForRowMock.mockReturnValue(null);
    useQueryMock.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <OrcaSummary
        summary={{ missingMaster: false } as any}
        claim={{
          claimStatus: '会計待ち',
          claimStatusText: 'ローカル未送信',
          recordsReturned: 1,
          bundles: [{ totalClaimAmount: 1200, items: [] }],
        } as any}
        patientId="P-1"
        visitDate="2026-03-09"
        appointmentId="A-2"
        receptionId="R-2"
        scheduleKey="SCH-2"
        encounterKey="ENC-2"
        orcaEncounterContext={{
          patientId: 'P-1',
          visitDate: '2026-03-09',
          departmentCode: '01',
          physicianCode: '10001',
          insuranceCombinationNumber: '0001',
          voucherNumber: '1234',
          sequentialNumber: '1',
        }}
      />,
    );

    expect(screen.getByText('transmission: 未送信')).toBeInTheDocument();
    expect(screen.getByText('警告なし')).toBeInTheDocument();
    expect(screen.queryByText(/INV-/)).not.toBeInTheDocument();
  });
});
