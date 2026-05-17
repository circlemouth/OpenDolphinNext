import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { clearAuditEventLog, getAuditEventLog } from '../../../libs/audit/auditLogger';
import { updateObservabilityMeta } from '../../../libs/observability/observability';
import { AuthServiceProvider } from '../authService';
import { DocumentTimeline } from '../DocumentTimeline';
import { postChartSubjectiveEntry } from '../soap/subjectiveChartApi';
import { SoapNotePanel } from '../SoapNotePanel';
import type { SoapEntry } from '../soapNote';

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

const getSoapSaveButton = () => {
  const button = screen
    .getAllByRole('button', { name: '保存' })
    .find((candidate) => candidate.classList.contains('soap-note__primary'));
  if (!button) {
    throw new Error('SOAP save button not found');
  }
  return button;
};

afterEach(() => {
  cleanup();
  clearAuditEventLog();
});

beforeEach(() => {
  vi.mocked(postChartSubjectiveEntry).mockResolvedValue({
    ok: true,
    status: 200,
    apiResult: '00',
    apiResultMessage: 'SUCCESS',
  });
});

describe('SOAP note audit', () => {
  it('テンプレ挿入と保存で監査イベントが必要メタを含む', async () => {
    updateObservabilityMeta({ runId: 'RUN-SOAP', traceId: 'TRACE-SOAP' });

    const user = userEvent.setup();
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP',
          cacheHit: false,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          patientId: 'P-001',
          appointmentId: 'APT-01',
          receptionId: 'RCPT-01',
          visitDate: '2025-12-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Soap', userId: 'doctor01' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'テンプレ' }));
    await user.selectOptions(screen.getByLabelText('対象セクション'), 'subjective');
    await user.selectOptions(screen.getByLabelText('テンプレ'), 'TEMP-GENERAL-01');
    await user.click(screen.getByRole('button', { name: '挿入' }));

    const subjectiveArea = screen.getByPlaceholderText('Subjective を記載してください。');
    await user.type(subjectiveArea, '追加記載');

    await user.click(getSoapSaveButton());

    const events = getAuditEventLog();
    const templateEvent = events.find((event) => (event.payload as any)?.action === 'SOAP_TEMPLATE_APPLY');
    const saveEvent = events.find((event) => (event.payload as any)?.action === 'SOAP_NOTE_SAVE');

    expect(templateEvent).toBeTruthy();
    const templateDetails = (templateEvent?.payload as any)?.details ?? {};
    expect(templateDetails.templateId).toBe('TEMP-GENERAL-01');
    expect(templateDetails.authorRole).toBe('doctor');
    expect(templateDetails.authorName).toBe('Dr. Soap');
    expect(templateDetails.authoredAt).toBeTruthy();
    expect(templateDetails.soapLength).toBeGreaterThan(0);

    expect(saveEvent).toBeTruthy();
    const saveDetails = (saveEvent?.payload as any)?.details ?? {};
    expect(saveDetails.templateId).toBe('TEMP-GENERAL-01');
    expect(saveDetails.authorRole).toBe('doctor');
    expect(saveDetails.authorName).toBe('Dr. Soap');
    expect(saveDetails.authoredAt).toBeTruthy();
    expect(saveDetails.soapLength).toBeGreaterThan(0);
    expect(saveDetails.runId ?? (saveEvent as any)?.runId).toBe('RUN-SOAP');
    expect(saveDetails.traceId).toBe('TRACE-SOAP');
  });

  it('テンプレ挿入→保存でタイムラインに履歴が反映される', async () => {
    const user = userEvent.setup();
    const captured: SoapEntry[] = [];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP',
          cacheHit: false,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          patientId: 'P-001',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Soap', userId: 'doctor01' }}
        onAppendHistory={(entries) => captured.push(...entries)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'テンプレ' }));
    await user.selectOptions(screen.getByLabelText('対象セクション'), 'subjective');
    await user.selectOptions(screen.getByLabelText('テンプレ'), 'TEMP-GENERAL-01');
    await user.click(screen.getByRole('button', { name: '挿入' }));

    const subjectiveArea = screen.getByPlaceholderText('Subjective を記載してください。');
    await user.type(subjectiveArea, 'SOAPテスト');

    await user.click(getSoapSaveButton());
    await waitFor(() => {
      expect(captured.length).toBeGreaterThan(0);
    });

    cleanup();

    render(
      <AuthServiceProvider initialFlags={{ runId: 'RUN-SOAP', missingMaster: false, cacheHit: false, fallbackUsed: false }}>
        <DocumentTimeline entries={[]} soapHistory={captured} />
      </AuthServiceProvider>,
    );

    expect(screen.getByText('SOAP記載履歴')).toBeTruthy();
    expect(screen.getAllByText('Subjective').length).toBeGreaterThan(0);
    expect(screen.getByText(/template:\s*TEMP-GENERAL-01/)).toBeTruthy();
  });

  it('画像貼付は指定した SOAP セクションへ挿入される', () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP',
          cacheHit: false,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          patientId: 'P-001',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Soap', userId: 'doctor01' }}
        attachmentInsert={{
          attachment: {
            id: 901,
            title: '胸部X線',
            fileName: 'xray.png',
            contentType: 'image/png',
            contentSize: 1024,
          },
          section: 'objective',
          token: 'token-1',
        }}
      />,
    );

    const objectiveArea = screen.getByPlaceholderText('Objective を記載してください。') as HTMLTextAreaElement;
    expect(objectiveArea.value).toContain('attachment:901');
  });
});
