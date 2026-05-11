import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrderRecommendationModal } from '../OrderRecommendationModal';

vi.mock('../orderRecommendationApi', async () => ({
  fetchOrderRecommendations: vi.fn().mockResolvedValue({
    recommendations: [],
    patientId: 'P-1',
  }),
}));

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OrderRecommendationModal disabled reasons', () => {
  it('カテゴリ未選択時のカテゴリ scope は native disabled を維持し近傍理由を示す', () => {
    renderWithClient(
      <OrderRecommendationModal
        open
        patientId="P-1"
        defaultEntity=""
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByText('このカテゴリはカテゴリ未選択のため利用できません。横断を使用してください。')).toBeInTheDocument();
    const categoryScopeButton = screen.getByRole('button', { name: 'このカテゴリ' });
    expect(categoryScopeButton).toBeDisabled();
    expect(categoryScopeButton).toHaveAttribute('aria-describedby', 'order-recommend-category-scope-reason');
  });
});
