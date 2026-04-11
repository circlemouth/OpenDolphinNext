import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SoapNotePanel } from '../SoapNotePanel';
import { postChartSubjectiveEntry } from '../soap/subjectiveChartApi';

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
    expect(screen.getByText(/SOAPローカルカルテ保存に失敗しました/)).toBeInTheDocument();
    expect(onDraftDirtyChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dirty: true,
        dirtySources: ['soap'],
      }),
    );
  });
});
