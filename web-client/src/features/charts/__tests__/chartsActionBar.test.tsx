import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChartsActionBar } from '../ChartsActionBar';
import { postOrcaMedicalModV2Xml } from '../orcaClaimApi';
import { fetchOrderBundles } from '../orderBundleApi';
import { httpFetch } from '../../../libs/http/httpClient';
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

vi.mock('../orcaMedicalModApi', () => ({
  buildMedicalModV23RequestXml: vi.fn().mockReturnValue('<data></data>'),
  postOrcaMedicalModV23Xml: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    apiResult: '00',
    rawXml: '<xml></xml>',
    missingTags: [],
  }),
}));

vi.mock('../orderBundleApi', () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({ ok: true, bundles: [] }),
}));

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
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
    vi.mocked(fetchOrderBundles).mockResolvedValue({ ok: true, bundles: [] } as any);
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
          patientId="P-100"
          visitDate="2026-01-03"
          selectedEntry={{ patientId: 'P-100', department: '01 内科', physician: '10001 主治医' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    expect(screen.getByText('ORCA送信を完了')).toBeInTheDocument();
    expect(recordChartsAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORCA_SEND',
        outcome: 'success',
        details: expect.objectContaining({
          endpoint: '/api/orca/chart-support/medical-mod-v2',
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
          patientId="P-777"
          visitDate="2026-01-08"
          selectedEntry={{ patientId: 'P-777', department: '01 内科' } as any}
          sendConfirmSummary={{
            patientName: '山田太郎',
            patientId: 'P-777',
            birthDate: '1980-05-20',
            age: '45歳',
            visitDate: '2026-01-08',
            receptionId: 'R-777',
            appointmentId: 'A-777',
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
    expect(screen.getByRole('heading', { name: '患者確認' })).toBeInTheDocument();
    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('P-777')).toBeInTheDocument();
    expect(screen.getByText('1980-05-20 / 45歳')).toBeInTheDocument();
    expect(screen.getByText('R-777')).toBeInTheDocument();
    expect(screen.getByText('A-777')).toBeInTheDocument();
    expect(screen.getByText('3件')).toBeInTheDocument();
    expect(screen.getByText('5件')).toBeInTheDocument();
    expect(screen.getByText('S:あり / O:あり / A:なし / P:あり')).toBeInTheDocument();
    expect(screen.getByText('2件')).toBeInTheDocument();
  });

  it('診察終了の失敗を明示し監査ログにapiResultを残す', async () => {
    const user = userEvent.setup();
    vi.mocked(httpFetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        runId: 'RUN-NG',
        traceId: 'TRACE-NG',
        outcome: 'FAILURE',
        apiResult: 'ERR',
        apiResultMessage: 'server error',
      }),
    } as unknown as Response);

    render(
      <MemoryRouter>
        <ChartsActionBar {...baseProps} patientId="P-200" visitDate="2026-01-04" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '診察終了' }));

    await waitFor(() => expect(httpFetch).toHaveBeenCalled());
    expect(screen.getByText('診察終了に失敗')).toBeInTheDocument();
    expect(recordChartsAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'error',
        details: expect.objectContaining({
          endpoint: '/api/orca/medical/outpatient',
          httpStatus: 500,
          apiResult: 'ERR',
          apiResultMessage: 'server error',
          outcome: 'FAILURE',
          visitDate: '2026-01-04',
        }),
      }),
    );
  });

  it('承認ロック中は印刷がガードされる', () => {
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="P-300"
          visitDate="2026-01-05"
          selectedEntry={{ patientId: 'P-300', appointmentId: 'APT-1', visitDate: '2026-01-05' } as any}
          approvalLock={{ locked: true, runId: 'RUN-LOCK', action: 'send' }}
        />
      </MemoryRouter>,
    );

    const printButton = screen.getByRole('button', { name: '印刷/エクスポート' });
    expect(printButton).toBeDisabled();
    expect(screen.getAllByText(/承認済み（署名確定）/).length).toBeGreaterThan(0);
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

  it('selectedEntry.id は patientId として扱わず送信/終了をブロックする', () => {
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          visitDate="2026-01-09"
          selectedEntry={{ id: 'row-100', appointmentId: 'APT-ROW', visitDate: '2026-01-09' } as any}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '診察終了' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ORCA 送信' })).toBeDisabled();
  });
});
