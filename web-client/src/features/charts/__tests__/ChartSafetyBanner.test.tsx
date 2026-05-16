import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChartSafetyBanner } from '../ui/ChartSafetyBanner';

describe('ChartSafetyBanner', () => {
  it('通常時の説明カードを自動追加しない', () => {
    const { container } = render(<ChartSafetyBanner items={[]} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('患者安全')).toBeNull();
  });

  it('警告や停止理由があるときだけ表示する', () => {
    render(
      <ChartSafetyBanner
        items={[
          {
            id: 'orca-send-status',
            label: 'ORCA UNKNOWN',
            tone: 'warning',
            detail: 'ORCA送信状態の確認が必要です。',
            nextAction: '受付のORCA連携一覧で照合',
          },
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: '患者安全・作業状態' })).toHaveTextContent('ORCA UNKNOWN');
    expect(screen.getByText('ORCA送信状態の確認が必要です。')).toBeInTheDocument();
    expect(screen.getByText('次: 受付のORCA連携一覧で照合')).toBeInTheDocument();
  });
});
