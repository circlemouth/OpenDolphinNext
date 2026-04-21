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
  vi.mocked(postChartSubjectiveEntry).mockImplementation(async (payload) => ({
    ok: true,
    status: 200,
    apiResult: '00',
    apiResultMessage: '処理終了',
    runId: 'RUN-SOAP-LOCAL',
    recordedAt: `2026-04-10T00:00:0${vi.mocked(postChartSubjectiveEntry).mock.calls.length}Z`,
    entry: {
      documentId: 9000 + vi.mocked(postChartSubjectiveEntry).mock.calls.length,
      patientId: payload.patientId,
      performDate: payload.performDate,
      soapCategory: payload.soapCategory,
      displaySection: payload.displaySection,
      body: payload.body,
      recordedAt: `2026-04-10T00:00:0${vi.mocked(postChartSubjectiveEntry).mock.calls.length}Z`,
      authorName: 'Server Doctor',
    },
  }));
});

const sectionCases = [
  ['Free を記載してください。', '自由記載の主観情報', 'free', 'S'],
  ['Subjective を記載してください。', '主訴あり', 'subjective', 'S'],
  ['Objective を記載してください。', '咽頭発赤あり', 'objective', 'O'],
  ['Assessment を記載してください。', '急性咽頭炎疑い', 'assessment', 'A'],
  ['Plan を記載してください。', '内服と再診案内', 'plan', 'P'],
] as const;

describe('SoapNotePanel local readback contract', () => {
  it('saves S/O/A/P/free from SOAP server response and remounts from canonical readback history', async () => {
    const user = userEvent.setup();
    let history: SoapEntry[] = [];
    const appendHistory = (entries: SoapEntry[]) => {
      history = [...history, ...entries];
    };

    renderWithQueryClient(
      <SoapNotePanel
        history={history}
        meta={{
          runId: 'RUN-SOAP-READBACK',
          patientId: 'P-SOAP-001',
          appointmentId: 'APT-SOAP-001',
          receptionId: 'RCP-SOAP-001',
          visitDate: '2026-04-10',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Soap', userId: 'doctor01' }}
        onAppendHistory={appendHistory}
      />,
    );

    for (const [placeholder, body] of sectionCases) {
      await user.type(screen.getByPlaceholderText(placeholder), body);
    }
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(postChartSubjectiveEntry).toHaveBeenCalledTimes(sectionCases.length));
    sectionCases.forEach(([, body, displaySection, soapCategory], index) => {
      expect(postChartSubjectiveEntry).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          patientId: 'P-SOAP-001',
          performDate: '2026-04-10',
          soapCategory,
          displaySection,
          body,
        }),
      );
    });
    await waitFor(() => expect(history).toHaveLength(sectionCases.length));
    expect(history).toEqual(
      expect.arrayContaining(
        sectionCases.map(([, body, displaySection]) =>
          expect.objectContaining({
            section: displaySection,
            body,
            authorName: 'Server Doctor',
            patientId: 'P-SOAP-001',
            visitDate: '2026-04-10',
          }),
        ),
      ),
    );
    expect(screen.getByText('SOAP保存完了（ローカル下書き + ローカルカルテ 5 件）')).toBeInTheDocument();

    cleanup();

    renderWithQueryClient(
      <SoapNotePanel
        history={history}
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

    sectionCases.forEach(([placeholder, body]) => {
      expect(screen.getByPlaceholderText(placeholder)).toHaveValue(body);
    });
    expect(screen.getByText('Free は院内ローカル保存時に S として記録し、保存応答から再読込した場合も Free 欄へ戻します。')).toBeInTheDocument();
    expect(screen.getAllByText(/最終更新:/).length).toBeGreaterThan(0);
  });
});

afterEach(() => {
  cleanup();
});
