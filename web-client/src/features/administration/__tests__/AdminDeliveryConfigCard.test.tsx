import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdminDeliveryConfigCard } from '../delivery/AdminDeliveryConfigCard';

const baseForm = {
  orcaEndpoint: 'https://example.invalid/openDolphin/resources',
  verifyAdminDelivery: true,
  chartsDisplayEnabled: true,
  chartsSendEnabled: true,
  chartsMasterSource: 'auto' as const,
};

const renderCard = (overrides?: Partial<ComponentProps<typeof AdminDeliveryConfigCard>>) =>
  render(
    <AdminDeliveryConfigCard
      form={baseForm}
      isSystemAdmin
      showAdminDebugToggles
      dirty={false}
      saving={false}
      refetching={false}
      onFieldChange={vi.fn()}
      onChartsMasterSourceChange={vi.fn()}
      onSaveRequest={vi.fn()}
      onRefetch={vi.fn()}
      {...overrides}
    />,
  );

describe('AdminDeliveryConfigCard', () => {
  it('診断用の開発トグルは既定で閉じる', async () => {
    renderCard();

    const summary = screen.getByText('診断用の開発トグル（既定では閉じています）');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');

    const user = userEvent.setup();
    await user.click(summary);

    expect(details).toHaveAttribute('open');
  });

  it('showAdminDebugToggles=false では診断用トグルを出さず、非表示メッセージだけを出す', () => {
    renderCard({ showAdminDebugToggles: false });

    expect(screen.getByText('この環境では診断用トグルを非表示にしています（必要時は診断/デバッグセクションを使用します）。')).toBeInTheDocument();
    expect(document.getElementById('admin-verify-delivery')).toBeNull();
  });

  it('showAdminDebugToggles=true では診断用トグルを表示する', () => {
    renderCard({ showAdminDebugToggles: true });

    expect(screen.getByText('診断用の開発トグル（既定では閉じています）')).toBeInTheDocument();
    expect(document.getElementById('admin-verify-delivery')).not.toBeNull();
  });

  it('非システム管理者では read-only / disabled / guard 結線が有効になり、再取得は引き続き使える', async () => {
    const onRefetch = vi.fn();
    const user = userEvent.setup();

    renderCard({
      isSystemAdmin: false,
      guardDetailsId: 'admin-guard-details',
      showAdminDebugToggles: true,
      onRefetch,
    });

    const orcaEndpoint = screen.getByLabelText('orcaEndpoint（配信先 URL）');
    expect(orcaEndpoint).toHaveAttribute('readonly');
    expect(orcaEndpoint).toHaveAttribute('aria-readonly', 'true');
    expect(orcaEndpoint).toHaveAttribute('aria-describedby', 'admin-guard-details');

    const displayEnabled = document.getElementById('admin-charts-display-enabled');
    const sendEnabled = document.getElementById('admin-charts-send-enabled');
    const verifyDelivery = document.getElementById('admin-verify-delivery');

    expect(displayEnabled).not.toBeNull();
    expect(sendEnabled).not.toBeNull();
    expect(verifyDelivery).not.toBeNull();
    expect(displayEnabled).toBeDisabled();
    expect(sendEnabled).toBeDisabled();
    expect(verifyDelivery).toBeDisabled();
    expect(displayEnabled).toHaveAttribute('aria-describedby', 'admin-guard-details');
    expect(sendEnabled).toHaveAttribute('aria-describedby', 'admin-guard-details');
    expect(verifyDelivery).toHaveAttribute('aria-describedby', 'admin-guard-details');

    expect(screen.getByRole('button', { name: '保存して配信' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '再取得' }));
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });
});
