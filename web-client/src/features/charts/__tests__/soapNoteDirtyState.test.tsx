import type { ReactNode } from 'react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

describe('SoapNotePanel dirty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SOAPローカルカルテ保存失敗時は dirty が残る', async () => {
    vi.mocked(postChartSubjectiveEntry).mockResolvedValue({
      ok: false,
      status: 500,
      apiResult: '99',
      apiResultMessage: 'save failed',
    });
    const onDraftDirtyChange = vi.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP-DIRTY',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-16',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dirty', userId: 'doctor01' }}
        onDraftDirtyChange={onDraftDirtyChange}
      />,
    );

    await user.type(screen.getByPlaceholderText('Subjective を記載してください。'), 'dirty test');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(postChartSubjectiveEntry).toHaveBeenCalled());
    expect(screen.getByText(/SOAPのみ未保存: SOAPのみの保存に失敗しました/)).toBeInTheDocument();
    expect(onDraftDirtyChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dirty: true,
        dirtySources: ['soap'],
      }),
    );
  });

  it('一部 section の POST 失敗時は成功 section を再投稿せず未保存 dirty を残す', async () => {
    vi.mocked(postChartSubjectiveEntry).mockImplementation(async (payload) => {
      if (payload.displaySection === 'objective') {
        return {
          ok: false,
          status: 500,
          apiResult: '99',
          apiResultMessage: 'objective failed',
        };
      }
      return {
        ok: true,
        status: 200,
        apiResult: '00',
        apiResultMessage: 'SUCCESS',
        recordedAt: '2026-04-10T00:00:00Z',
        entry: {
          documentId: 9101,
          patientId: payload.patientId,
          performDate: payload.performDate,
          soapCategory: payload.soapCategory,
          displaySection: payload.displaySection,
          body: payload.body,
          recordedAt: '2026-04-10T00:00:00Z',
          authorName: 'Server Doctor',
        },
      };
    });
    const onDraftDirtyChange = vi.fn();
    const user = userEvent.setup();

    function Harness() {
      const [history, setHistory] = useState<SoapEntry[]>([]);
      return (
        <SoapNotePanel
          history={history}
          meta={{
            runId: 'RUN-SOAP-PARTIAL',
            patientId: 'P-001',
            appointmentId: 'APT-001',
            receptionId: 'RCP-001',
            visitDate: '2026-04-10',
          }}
          author={{ role: 'doctor', displayName: 'Dr. Partial', userId: 'doctor01' }}
          onDraftDirtyChange={onDraftDirtyChange}
          onAppendHistory={(entries) => setHistory((prev) => [...prev, ...entries])}
        />
      );
    }

    renderWithQueryClient(<Harness />);

    await user.type(screen.getByPlaceholderText('Subjective を記載してください。'), '主訴あり');
    await user.type(screen.getByPlaceholderText('Objective を記載してください。'), '所見あり');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(postChartSubjectiveEntry).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/SOAPのみ未保存: 成功 1 件 \/ 未保存 1 件/)).toBeInTheDocument();
    expect(onDraftDirtyChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dirty: true,
        dirtySources: ['soap'],
      }),
    );

    vi.mocked(postChartSubjectiveEntry).mockClear();
    vi.mocked(postChartSubjectiveEntry).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'SUCCESS',
      recordedAt: '2026-04-10T00:01:00Z',
      entry: {
        documentId: 9102,
        patientId: 'P-001',
        performDate: '2026-04-10',
        soapCategory: 'O',
        displaySection: 'objective',
        body: '所見あり',
        recordedAt: '2026-04-10T00:01:00Z',
        authorName: 'Server Doctor',
      },
    });

    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => expect(postChartSubjectiveEntry).toHaveBeenCalledTimes(1));
    expect(postChartSubjectiveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        displaySection: 'objective',
        soapCategory: 'O',
        body: '所見あり',
      }),
    );
    expect(postChartSubjectiveEntry).not.toHaveBeenCalledWith(
      expect.objectContaining({
        displaySection: 'subjective',
      }),
    );
    await waitFor(() =>
      expect(onDraftDirtyChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          dirty: false,
          dirtySources: [],
        }),
      ),
    );
  });
});
