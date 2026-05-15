import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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

const DocumentPanelStub = () => <section aria-label="文書作成メニュー">文書作成メニュー</section>;

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
    expect(screen.queryByLabelText('右ドック')).not.toBeInTheDocument();
    expect(document.querySelector('.soap-note')).toHaveAttribute('data-right-rail-visible', 'false');
  });

  it('ショートカットをテンプレ左へ移し、セット/スタンプと文書は当日オーダー欄へ集約する', async () => {
    const user = userEvent.setup();
    const onShortcutDialogOpen = vi.fn();
    const onUtilityRailActionSelect = vi.fn();

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP-UTILITY-MOVE',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-03-01',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Test', userId: 'doctor01' }}
        orderBundles={[]}
        utilityRailItems={[
          {
            id: 'order-set',
            label: 'セット/スタンプ',
            shortLabel: '★',
            shortcut: 'Ctrl+Shift+1',
            dirty: true,
            meta: '右欄編集中:処方（必須不足）',
            kind: 'stamp',
          },
          { id: 'document', label: '文書', shortLabel: '文', shortcut: 'Ctrl+Shift+2', meta: '添付1', kind: 'document' },
        ]}
        onUtilityRailActionSelect={onUtilityRailActionSelect}
        onShortcutDialogOpen={onShortcutDialogOpen}
        shortcutsOpen={false}
        documentPanel={<DocumentPanelStub />}
      />,
    );

    const soapActions = document.querySelector('.soap-note__actions');
    expect(soapActions).not.toBeNull();
    const actionButtons = within(soapActions as HTMLElement).getAllByRole('button');
    const shortcutIndex = actionButtons.findIndex((button) => button.textContent === 'ショートカット');
    const templateIndex = actionButtons.findIndex((button) => button.textContent === 'テンプレ');
    expect(shortcutIndex).toBeGreaterThanOrEqual(0);
    expect(templateIndex).toBeGreaterThan(shortcutIndex);

    await user.click(within(soapActions as HTMLElement).getByRole('button', { name: 'ショートカット' }));
    expect(onShortcutDialogOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('右ドック')).not.toBeInTheDocument();

    const orderPane = screen.getByLabelText('オーダー概要');
    await user.click(within(orderPane).getByRole('button', { name: /セット\/スタンプ/ }));
    expect(onUtilityRailActionSelect).toHaveBeenCalledWith('order-set', expect.any(HTMLButtonElement));

    await user.click(within(orderPane).getByRole('button', { name: /文書（添付1）/ }));
    expect(onUtilityRailActionSelect).not.toHaveBeenCalledWith('document', expect.any(HTMLButtonElement));
    expect(screen.getByLabelText('文書作成メニュー')).toBeInTheDocument();
  });

  it('画像など独立右レールがある場合だけworkspaceに右レール予約状態を付与する', () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP-RIGHT-RAIL-VISIBLE',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-03-01',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Test', userId: 'doctor01' }}
        orderBundles={[]}
        utilityRailItems={[{ id: 'imaging', label: '画像', shortLabel: '画', shortcut: 'Ctrl+Shift+3', kind: 'imaging' }]}
      />,
    );

    expect(document.querySelector('.soap-note')).toHaveAttribute('data-right-rail-visible', 'true');
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
    const soapActions = document.querySelector('.soap-note__actions');
    expect(soapActions).not.toBeNull();
    await user.click(within(soapActions as HTMLElement).getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/SOAPのみ未保存/)).toBeInTheDocument();
    expect(screen.getByText(/病名・オーダー・文書など他領域の保存状態とは別です/)).toBeInTheDocument();
    expect(screen.queryByText(/java\.lang|jdbc:\/\/internal-host/)).not.toBeInTheDocument();
  });

  it('read-only時の保存ボタンはnative disabledを維持し近傍理由を関連付ける', () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP-SAVE-BLOCKED',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-03-01',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Test', userId: 'doctor01' }}
        orderBundles={[]}
        readOnly
        readOnlyReason="確定済み診療録のため保存できません。"
      />,
    );

    const soapActions = document.querySelector('.soap-note__actions');
    expect(soapActions).not.toBeNull();
    const saveButton = within(soapActions as HTMLElement).getByRole('button', { name: '保存' });
    const reason = screen.getByText('保存はブロックされています: 確定済み診療録のため保存できません。');

    expect(saveButton).toBeDisabled();
    expect(reason).toHaveAttribute('id', 'soap-note-save-block-reason');
    expect(saveButton).toHaveAttribute('aria-describedby', 'soap-note-save-block-reason');
    expect(saveButton).toHaveAttribute('title', '確定済み診療録のため保存できません。');
  });
});
