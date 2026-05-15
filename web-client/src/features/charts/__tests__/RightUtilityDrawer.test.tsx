import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RightUtilityDrawer } from '../RightUtilityDrawer';

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('RightUtilityDrawer', () => {
  it('runtime drawer は chooser-only で document/orca/editor form を描画しない', () => {
    renderWithClient(
      <RightUtilityDrawer
        open
        activeTool="prescription"
        meta={{ patientId: 'P-001', appointmentId: 'APT-001', receptionId: 'RCP-001', visitDate: '2026-04-17' }}
        onClose={vi.fn()}
        onToolSelect={vi.fn()}
        onOrderRequest={vi.fn()}
        patientId="P-001"
        orderBundles={[]}
        prescriptionBundles={[]}
      />,
    );

    expect(screen.getByRole('tab', { name: '処方候補タブへ切替' })).toBeInTheDocument();
    expect(document.querySelector('.soap-note__right-drawer')?.getAttribute('data-tool')).toBe('prescription');
    expect(document.querySelector('.soap-note__right-drawer-header strong')).toHaveTextContent('処方候補');
    expect(screen.getByText('既存オーダー')).toBeInTheDocument();
    expect(screen.getAllByText('患者候補').length).toBeGreaterThan(0);
    expect(screen.getAllByText('施設頻用').length).toBeGreaterThan(0);
    expect(screen.getByText('ORCA入力セット')).toBeInTheDocument();
    expect(screen.getByText('検索して追加')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '候補ソースの概要' })).toHaveTextContent('既存オーダー');
    expect(screen.getByLabelText('ORCA候補キーワード')).toBeInTheDocument();
    expect(screen.getByText('候補を反映しても、この操作だけでは処方確定・ORCA送信・会計済みにはなりません。')).toBeInTheDocument();
    expect(screen.queryByText('文書')).not.toBeInTheDocument();
    expect(screen.queryByText('ORCA')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();
  });

  it('患者未選択では候補取得とORCA検索を開始せず理由だけを表示する', () => {
    renderWithClient(
      <RightUtilityDrawer
        open
        activeTool="prescription"
        meta={{ appointmentId: 'APT-001', receptionId: 'RCP-001', visitDate: '2026-04-17' }}
        onClose={vi.fn()}
        onToolSelect={vi.fn()}
        onOrderRequest={vi.fn()}
        orderBundles={[]}
        prescriptionBundles={[]}
      />,
    );

    expect(document.querySelector('.soap-note__right-drawer')?.getAttribute('data-chooser-state')).toBe('blocked');
    expect(screen.getByText('オーダー候補を開始できません')).toBeInTheDocument();
    expect(screen.getByText('患者が選択されていません。候補表示、ORCA候補検索、新規作成は開始できません。')).toBeInTheDocument();
    expect(screen.queryByText('既存オーダー')).not.toBeInTheDocument();
    expect(screen.queryByText('ORCA入力セット')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新規作成を開く' })).not.toBeInTheDocument();
  });

  it('来院文脈不足では候補取得と新規作成を fail closed にする', () => {
    renderWithClient(
      <RightUtilityDrawer
        open
        activeTool="prescription"
        meta={{ patientId: 'P-001', visitDate: '2026-04-17' }}
        patientId="P-001"
        onClose={vi.fn()}
        onToolSelect={vi.fn()}
        onOrderRequest={vi.fn()}
        orderBundles={[]}
        prescriptionBundles={[]}
      />,
    );

    expect(document.querySelector('.soap-note__right-drawer')?.getAttribute('data-chooser-state')).toBe('blocked');
    expect(screen.getByText('来院文脈が不足しています。候補表示、ORCA候補検索、新規作成は開始できません。')).toBeInTheDocument();
    expect(screen.queryByText('患者候補')).not.toBeInTheDocument();
    expect(screen.queryByText('検索して追加')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新規作成を開く' })).not.toBeInTheDocument();
  });

  it('read-only では候補取得と候補反映を fail closed にする', () => {
    renderWithClient(
      <RightUtilityDrawer
        open
        activeTool="injection"
        meta={{
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-04-17',
          readOnly: true,
          readOnlyReason: '署名済みのため編集できません。',
        }}
        patientId="P-001"
        onClose={vi.fn()}
        onToolSelect={vi.fn()}
        onOrderRequest={vi.fn()}
        orderBundles={[]}
        prescriptionBundles={[]}
      />,
    );

    expect(document.querySelector('.soap-note__right-drawer')?.getAttribute('data-chooser-state')).toBe('blocked');
    expect(screen.getByText('署名済みのため編集できません。')).toBeInTheDocument();
    expect(screen.queryByText('既存オーダー')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '反映' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新規作成を開く' })).not.toBeInTheDocument();
  });
});
