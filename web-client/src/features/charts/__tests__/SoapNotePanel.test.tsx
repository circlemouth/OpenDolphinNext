import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SoapNotePanel } from '../SoapNotePanel';
import type { SoapEntry } from '../soapNote';
import { postChartSubjectiveEntry } from '../soap/subjectiveChartApi';

vi.mock('../soap/subjectiveChartApi', () => ({
  postChartSubjectiveEntry: vi.fn(),
}));

const renderWithQueryClient = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('SoapNotePanel UI regression', () => {
  it('保存状態・テンプレ表示・Free履歴・右ドック表示が仕様どおり', () => {
    const history: SoapEntry[] = [
      {
        id: 'soap-entry-free-1',
        section: 'free',
        body: '前回自由記載',
        templateId: 'TEMP-FREE-01',
        authoredAt: '2026-03-01T09:00:00+09:00',
        authorRole: 'doctor',
        authorName: 'Dr. Test',
        action: 'save',
        patientId: 'P-001',
        appointmentId: 'APT-001',
        receptionId: 'RCP-001',
        visitDate: '2026-03-01',
      },
      {
        id: 'soap-entry-subjective-1',
        section: 'subjective',
        body: '主訴あり',
        templateId: 'TEMP-GENERAL-01',
        authoredAt: '2026-03-01T09:05:00+09:00',
        authorRole: 'doctor',
        authorName: 'Dr. Test',
        action: 'update',
        patientId: 'P-001',
        appointmentId: 'APT-001',
        receptionId: 'RCP-001',
        visitDate: '2026-03-01',
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={history}
        meta={{
          runId: 'RUN-SOAP-PANEL-TEST',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-03-01',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Test', userId: 'doctor01' }}
        orderBundles={[]}
      />,
    );

    expect(screen.getByText('保存済')).toBeInTheDocument();
    expect(screen.queryByText(/保存時刻:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/template=/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Free履歴/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('右ドック')).toBeInTheDocument();
  });

  it('SOAP保存失敗はSOAPのみ未保存として安全文言で表示する', async () => {
    const user = userEvent.setup();
    vi.mocked(postChartSubjectiveEntry).mockResolvedValue({
      ok: false,
      status: 500,
      apiResultMessage: 'java.lang.IllegalStateException: jdbc://internal-host failed',
    });

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP-SAFE-ERROR',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-03-01',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Test', userId: 'doctor01' }}
        orderBundles={[]}
      />,
    );

    await user.type(screen.getByPlaceholderText('Subjective を記載してください。'), '頭痛あり');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/SOAPのみ未保存/)).toBeInTheDocument();
    expect(screen.getByText(/病名・オーダー・文書など他領域の保存状態とは別です/)).toBeInTheDocument();
    expect(screen.queryByText(/java\.lang|jdbc:\/\/internal-host/)).not.toBeInTheDocument();
  });
});
