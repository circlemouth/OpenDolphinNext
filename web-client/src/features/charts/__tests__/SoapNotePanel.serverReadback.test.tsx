import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SoapNotePanel } from '../SoapNotePanel';
import { postChartSubjectiveEntry } from '../soap/subjectiveChartApi';
import type { SoapEntry } from '../soapNote';

vi.mock('../soap/subjectiveChartApi', () => ({
  postChartSubjectiveEntry: vi.fn(),
}));

const renderWithQueryClient = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(postChartSubjectiveEntry).mockResolvedValue({
    ok: true,
    status: 200,
    apiResult: '00',
    apiResultMessage: '処理終了',
    runId: 'RUN-SOAP-LOCAL',
  });
});

afterEach(() => {
  cleanup();
});

describe('SoapNotePanel local readback contract', () => {
  it('maps Free to local S category, appends canonical local history, and reloads from that history', async () => {
    const user = userEvent.setup();
    const captured: SoapEntry[] = [];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP-READBACK',
          patientId: 'P-SOAP-001',
          appointmentId: 'APT-SOAP-001',
          receptionId: 'RCP-SOAP-001',
          visitDate: '2026-04-10',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Soap', userId: 'doctor01' }}
        onAppendHistory={(entries) => captured.push(...entries)}
      />,
    );

    await user.type(screen.getByPlaceholderText('Free を記載してください。'), '自由記載の主観情報');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(postChartSubjectiveEntry).toHaveBeenCalledWith({
        patientId: 'P-SOAP-001',
        performDate: '2026-04-10',
        soapCategory: 'S',
        body: '自由記載の主観情報',
      });
    });
    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0]).toEqual(
      expect.objectContaining({
        section: 'free',
        body: '自由記載の主観情報',
        patientId: 'P-SOAP-001',
        visitDate: '2026-04-10',
      }),
    );
    expect(screen.getByText('SOAP保存完了（ローカル下書き + ローカルカルテ 1 件）')).toBeInTheDocument();

    cleanup();

    renderWithQueryClient(
      <SoapNotePanel
        history={captured}
        meta={{
          runId: 'RUN-SOAP-READBACK-RELOAD',
          patientId: 'P-SOAP-001',
          appointmentId: 'APT-SOAP-001',
          receptionId: 'RCP-SOAP-001',
          visitDate: '2026-04-10',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Soap', userId: 'doctor01' }}
      />,
    );

    expect(screen.getByPlaceholderText('Free を記載してください。')).toHaveValue('自由記載の主観情報');
    expect(screen.getAllByText(/最終更新:/).length).toBeGreaterThan(0);
  });
});
