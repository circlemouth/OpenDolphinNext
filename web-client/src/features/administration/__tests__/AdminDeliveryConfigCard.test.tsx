import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdminDeliveryConfigCard } from '../delivery/AdminDeliveryConfigCard';

const baseForm = {
  chartsDisplayEnabled: true,
  chartsSendEnabled: true,
  chartsMasterSource: 'auto' as const,
};

const renderCard = (overrides?: Partial<ComponentProps<typeof AdminDeliveryConfigCard>>) =>
  render(
    <AdminDeliveryConfigCard
      form={baseForm}
      isSystemAdmin
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
  it('config section の正本スコープと feature-off note を表示する', async () => {
    renderCard();

    expect(screen.getByText('この section が正本なのは charts delivery のみです。接続設定・runtime-owned・未証明 setting はここへ混ぜません。')).toBeInTheDocument();
    expect(screen.getByText('未証明の facility setting や optional module visibility は UI に toggle を出さず、feature-off / fail-close を維持します。')).toBeInTheDocument();
    expect(screen.queryByLabelText('orcaEndpoint（配信先 URL）')).not.toBeInTheDocument();
    expect(document.getElementById('admin-verify-delivery')).toBeNull();
  });

  it('非システム管理者では read-only / disabled / guard 結線が有効になり、再取得は引き続き使える', async () => {
    const onRefetch = vi.fn();
    const user = userEvent.setup();

    renderCard({
      isSystemAdmin: false,
      guardDetailsId: 'admin-guard-details',
      onRefetch,
    });

    const displayEnabled = document.getElementById('admin-charts-display-enabled');
    const sendEnabled = document.getElementById('admin-charts-send-enabled');

    expect(displayEnabled).not.toBeNull();
    expect(sendEnabled).not.toBeNull();
    expect(displayEnabled).toBeDisabled();
    expect(sendEnabled).toBeDisabled();
    expect(displayEnabled).toHaveAttribute('aria-describedby', 'admin-guard-details');
    expect(sendEnabled).toHaveAttribute('aria-describedby', 'admin-guard-details');

    expect(screen.getByRole('button', { name: '保存して配信' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '再取得' }));
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });
});
