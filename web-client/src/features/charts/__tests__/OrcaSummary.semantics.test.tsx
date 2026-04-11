import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OrcaSummary } from '../OrcaSummary';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
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

describe('OrcaSummary semantics', () => {
  it('ORCA収納情報とローカル診療サマリの責務を分離し official ラベルを表示する', () => {
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

    expect(screen.getByText('ローカル診療サマリ')).toBeInTheDocument();
    expect(screen.getByText('ORCA収納情報')).toBeInTheDocument();
    expect(screen.getByText('対象日: 2026-03-09')).toBeInTheDocument();
    expect(screen.getByText(/保険組合せ: 0001/)).toBeInTheDocument();
    expect(screen.getByText('未収金合計')).toBeInTheDocument();
    expect(screen.getByText('保険適用金額')).toBeInTheDocument();
    expect(screen.getByText('自費金額')).toBeInTheDocument();
    expect(screen.getByText('食事・生活療養負担金')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-09 ｜ 内科 ｜ 請求金額: 1,200 円 ｜ 入金額:/)).toBeInTheDocument();
    expect(screen.getByText(/未収金情報: 2026-03-09 ｜ 伝票 INV-1 ｜ 500 円/)).toBeInTheDocument();
    expect(screen.queryByText('請求サマリ')).not.toBeInTheDocument();
  });
});
