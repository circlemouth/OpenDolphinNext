import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PatientSummaryPanel } from '../PatientSummaryPanel';
import { fetchPatientFreeDocument, savePatientFreeDocument } from '../patientFreeDocumentApi';

vi.mock('../patientFreeDocumentApi', () => ({
  fetchPatientFreeDocument: vi.fn(),
  savePatientFreeDocument: vi.fn(),
}));

const mockedFetchPatientFreeDocument = vi.mocked(fetchPatientFreeDocument);
const mockedSavePatientFreeDocument = vi.mocked(savePatientFreeDocument);

const renderWithQueryClient = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('PatientSummaryPanel', () => {
  beforeEach(() => {
    mockedFetchPatientFreeDocument.mockReset();
    mockedSavePatientFreeDocument.mockReset();
    mockedFetchPatientFreeDocument.mockResolvedValue({
      ok: true,
      supported: true,
      runId: 'RUN-PATIENT-SUMMARY',
      status: 200,
      payload: {
        id: 1,
        facilityPatId: 'P-001',
        confirmed: '2026-03-05T00:18:34Z',
        comment: '既存サマリ',
      },
    });
    mockedSavePatientFreeDocument.mockResolvedValue({
      ok: true,
      supported: true,
      runId: 'RUN-PATIENT-SUMMARY',
      status: 200,
    });
  });

  it('初期表示で details は開かない', async () => {
    const { container } = renderWithQueryClient(<PatientSummaryPanel patientId="P-001" />);

    await waitFor(() => {
      expect(mockedFetchPatientFreeDocument).toHaveBeenCalledWith({ patientId: 'P-001' });
    });
    await waitFor(() => {
      expect(container.querySelector('details.charts-fold--free-doc')).not.toBeNull();
    });

    const details = container.querySelector('details.charts-fold--free-doc') as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
  });

  it('取得失敗時は canonical copy を表示し raw detail を出さない', async () => {
    mockedFetchPatientFreeDocument.mockResolvedValueOnce({
      ok: false,
      supported: true,
      runId: 'RUN-PATIENT-SUMMARY',
      status: 500,
      payload: null,
      error: 'backend exploded at /api/karte/freedocument with stacktrace',
    });

    renderWithQueryClient(<PatientSummaryPanel patientId="P-001" />);

    expect(await screen.findByText('患者サマリの取得に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/backend exploded/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stacktrace/i)).not.toBeInTheDocument();
  });

  it('free document を保存し、保存後も同じ患者の readback query を維持する', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<PatientSummaryPanel patientId="P-001" />);

    const textarea = await screen.findByPlaceholderText(/患者サマリ/);
    expect(textarea).toHaveValue('既存サマリ');

    await user.clear(textarea);
    await user.type(textarea, '更新サマリ');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockedSavePatientFreeDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'P-001',
          id: 1,
          comment: '更新サマリ',
        }),
      );
    });
    await waitFor(() => {
      expect(mockedFetchPatientFreeDocument).toHaveBeenCalledWith({ patientId: 'P-001' });
    });
    expect(await screen.findByText('患者サマリを保存しました。')).toBeInTheDocument();
  });

  it('患者切替時は前患者の未保存 free document draft を次患者へ持ち越さない', async () => {
    const user = userEvent.setup();
    mockedFetchPatientFreeDocument.mockImplementation(async ({ patientId }) => ({
      ok: true,
      supported: true,
      runId: 'RUN-PATIENT-SUMMARY',
      status: 200,
      payload: {
        id: patientId === 'P-001' ? 1 : 2,
        facilityPatId: patientId,
        confirmed: '2026-03-05T00:18:34Z',
        comment: patientId === 'P-001' ? 'P001 サマリ' : 'P002 サマリ',
      },
    }));

    const rendered = renderWithQueryClient(<PatientSummaryPanel patientId="P-001" />);
    const textarea = await screen.findByPlaceholderText(/患者サマリ/);
    await waitFor(() => expect(textarea).toHaveValue('P001 サマリ'));

    await user.clear(textarea);
    await user.type(textarea, '未保存 P001 draft');
    expect(textarea).toHaveValue('未保存 P001 draft');

    rendered.rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <PatientSummaryPanel patientId="P-002" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockedFetchPatientFreeDocument).toHaveBeenCalledWith({ patientId: 'P-002' }));
    await waitFor(() => expect(screen.getByPlaceholderText(/患者サマリ/)).toHaveValue('P002 サマリ'));
    expect(screen.queryByText('状態: 未保存（保存が必要です）')).not.toBeInTheDocument();
  });
});
