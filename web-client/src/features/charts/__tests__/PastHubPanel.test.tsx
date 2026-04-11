import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PastHubPanel } from '../PastHubPanel';
import { fetchOrderBundles } from '../orderBundleApi';

vi.mock('../orderBundleApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../orderBundleApi')>();
  return {
    ...actual,
    fetchOrderBundles: vi.fn(),
  };
});

const mockedFetchOrderBundles = vi.mocked(fetchOrderBundles);

const renderWithQueryClient = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('PastHubPanel', () => {
  beforeEach(() => {
    mockedFetchOrderBundles.mockReset();
    mockedFetchOrderBundles.mockResolvedValue({
      ok: true,
      bundles: [],
    });
  });

  it('初期表示で日付 details は自動展開されない', async () => {
    const { container } = renderWithQueryClient(
      <PastHubPanel
        patientId="P-001"
        entries={[
          {
            id: 'row-001',
            patientId: 'P-001',
            appointmentId: 'A-001',
            receptionId: 'R-001',
            visitDate: '2026-03-04',
            department: '内科',
            physician: '田中医師',
            status: '診療中',
            source: 'visits',
          },
          {
            id: 'row-002',
            patientId: 'P-001',
            appointmentId: 'A-002',
            receptionId: 'R-002',
            visitDate: '2026-03-03',
            department: '内科',
            physician: '田中医師',
            status: '会計待ち',
            source: 'visits',
          },
        ]}
        soapHistory={[]}
        selectedContext={{
          patientId: 'P-001',
          appointmentId: 'A-001',
          receptionId: 'R-001',
          visitDate: '2026-03-04',
        }}
        switchLocked={false}
        todayIso="2026-03-05"
        onSelectEncounter={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('details.charts-past-hub__day').length).toBeGreaterThan(0);
    });

    const dayDetails = Array.from(container.querySelectorAll('details.charts-past-hub__day')) as HTMLDetailsElement[];
    dayDetails.forEach((detail) => {
      expect(detail.open).toBe(false);
    });
  });

  it('オーダー取得失敗時は canonical copy を表示し raw detail を出さない', async () => {
    mockedFetchOrderBundles.mockResolvedValueOnce({
      ok: false,
      bundles: [],
      message: 'backend order route missing /api/local/order/bundles stacktrace',
    } as any);

    renderWithQueryClient(
      <PastHubPanel
        patientId="P-001"
        entries={[
          {
            id: 'row-001',
            patientId: 'P-001',
            appointmentId: 'A-001',
            receptionId: 'R-001',
            visitDate: '2026-03-04',
            department: '内科',
            physician: '田中医師',
            status: '診療中',
            source: 'visits',
          },
        ]}
        soapHistory={[]}
        selectedContext={{
          patientId: 'P-001',
          appointmentId: 'A-001',
          receptionId: 'R-001',
          visitDate: '2026-03-04',
        }}
        switchLocked={false}
        todayIso="2026-03-05"
        onSelectEncounter={vi.fn()}
      />,
    );

    expect(await screen.findByText('オーダー情報の取得に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/backend order route missing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stacktrace/i)).not.toBeInTheDocument();
  });
});
