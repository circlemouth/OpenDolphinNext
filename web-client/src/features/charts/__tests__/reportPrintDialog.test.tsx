import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReportPrintDialog } from '../print/ReportPrintDialog';
import type { ReportFormState } from '../print/useOrcaReportPrint';

const baseReportForm: ReportFormState = {
  type: 'prescription',
  invoiceNumber: '',
  outsideClass: 'False',
  departmentCode: '01',
  insuranceCombinationNumber: '0001',
  performMonth: '2026-05',
};

afterEach(() => {
  cleanup();
});

describe('ReportPrintDialog', () => {
  it('帳票選択、プレビュー元、出力設定、不可理由を初期表示する', () => {
    render(
      <ReportPrintDialog
        open
        runId="RUN-REPORT"
        isRunning={false}
        onClose={vi.fn()}
        onConfirmOutpatient={vi.fn()}
        onConfirmReport={vi.fn()}
        printDestination="prescription"
        onDestinationChange={vi.fn()}
        reportForm={baseReportForm}
        onReportFieldChange={vi.fn()}
        reportFieldErrors={['伝票番号を入力してください。']}
        reportReady={false}
        reportIncomeStatus="success"
        reportIncomeError={null}
        reportIncomeLatest={{ performDate: '2026-05-14', invoiceNumber: '0002375' }}
        reportInvoiceOptions={['0002375']}
        reportInsuranceOptions={['0001']}
        reportNeedsInvoice
        reportNeedsOutsideClass
        reportNeedsDepartment={false}
        reportNeedsInsurance={false}
        reportNeedsPerformMonth={false}
        resolvedReportType="prescription"
      />,
    );

    expect(screen.getByRole('dialog', { name: '印刷/帳票出力の確認' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '帳票プレビューと出力設定' })).toBeInTheDocument();
    expect(screen.getByText('ORCA帳票API')).toBeInTheDocument();
    expect(screen.getByText('伝票番号、院外処方区分')).toBeInTheDocument();
    expect(screen.getAllByText('伝票番号を入力してください。')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '開く' })).toBeDisabled();
    expect(screen.queryByPlaceholderText('例: 0002375')).toBeNull();
  });
});
