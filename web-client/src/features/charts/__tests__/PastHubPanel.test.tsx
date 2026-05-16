import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.queryByText('日付ごとに折りたたみ、左に過去カルテ、右にオーダー情報をまとめます（初期表示は全て閉じる）。')).toBeNull();
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

  it('Do転記入口は転記可能SOAPなしの native disabled に近傍理由を示す', async () => {
    const user = userEvent.setup();
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
        doCopyEnabled
        onRequestDoCopy={vi.fn()}
        onRequestDoCopyBatch={vi.fn()}
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

    await user.click(screen.getByText('2026-03-04'));

    expect(screen.getByText('まとめDoはブロックされています: 転記可能なSOAPがありません。')).toBeInTheDocument();
    const batchButton = screen.getByRole('button', { name: 'この日のSOAPをまとめてDo' });
    expect(batchButton).toBeDisabled();
    expect(batchButton).toHaveAttribute('aria-describedby', 'past-hub-do-copy-batch-reason-2026-03-04');

    expect(screen.getAllByText('Do転記はブロックされています: 記載がありません。').length).toBeGreaterThan(0);
    const sectionButtons = screen.getAllByRole('button', { name: 'Do転記' });
    expect(sectionButtons[0]).toBeDisabled();
    expect(sectionButtons[0]).toHaveAttribute('aria-describedby', 'past-hub-do-copy-reason-subjective');
  });
});
