import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdminDeliveryConfigCard } from '../delivery/AdminDeliveryConfigCard';

describe('AdminDeliveryConfigCard', () => {
  it('診断用の開発トグルは既定で閉じる', async () => {
    render(
      <AdminDeliveryConfigCard
        form={{
          orcaEndpoint: 'https://example.invalid/openDolphin/resources',
          verifyAdminDelivery: true,
          chartsDisplayEnabled: true,
          chartsSendEnabled: true,
          chartsMasterSource: 'auto',
        }}
        isSystemAdmin
        showAdminDebugToggles
        dirty={false}
        saving={false}
        refetching={false}
        onFieldChange={vi.fn()}
        onChartsMasterSourceChange={vi.fn()}
        onSaveRequest={vi.fn()}
        onRefetch={vi.fn()}
      />,
    );

    const summary = screen.getByText('診断用の開発トグル（既定では閉じています）');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');

    const user = userEvent.setup();
    await user.click(summary);

    expect(details).toHaveAttribute('open');
  });
});
