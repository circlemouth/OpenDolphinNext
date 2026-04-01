import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PatientSummaryPanel } from '../PatientSummaryPanel';
import { fetchPatientFreeDocument } from '../patientFreeDocumentApi';

vi.mock('../patientFreeDocumentApi', () => ({
  fetchPatientFreeDocument: vi.fn(),
  savePatientFreeDocument: vi.fn(),
}));

const mockedFetchPatientFreeDocument = vi.mocked(fetchPatientFreeDocument);

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
});
