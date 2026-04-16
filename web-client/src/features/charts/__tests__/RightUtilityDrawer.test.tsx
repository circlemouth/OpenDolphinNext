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
        meta={{ patientId: 'P-001', visitDate: '2026-04-17' }}
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
    expect(screen.getByText('患者候補')).toBeInTheDocument();
    expect(screen.getByText('施設頻用')).toBeInTheDocument();
    expect(screen.getByText('ORCA入力セット')).toBeInTheDocument();
    expect(screen.getByText('検索して追加')).toBeInTheDocument();
    expect(screen.queryByText('文書')).not.toBeInTheDocument();
    expect(screen.queryByText('ORCA')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();
  });
});
