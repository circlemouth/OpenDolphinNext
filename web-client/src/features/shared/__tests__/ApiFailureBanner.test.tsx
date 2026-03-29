import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppToastProvider, type AppToastController } from '../../../libs/ui/appToast';
import { ApiFailureBanner } from '../ApiFailureBanner';

const renderWithToast = (ui: ReactNode) => {
  const toast: AppToastController = {
    enqueue: vi.fn(),
    dismiss: vi.fn(),
  };
  return render(<AppToastProvider value={toast}>{ui}</AppToastProvider>);
};

describe('ApiFailureBanner', () => {
  it('runId/traceId 未取得時は共有ボタンを既定で表示しない', () => {
    renderWithToast(<ApiFailureBanner subject="患者情報" error={new Error('network failed')} />);

    expect(screen.queryByRole('button', { name: /問い合わせ用IDをコピー/ })).not.toBeInTheDocument();
  });

  it('runId がある場合は既定ラベルで共有ボタンを表示する', () => {
    renderWithToast(<ApiFailureBanner subject="患者情報" runId="RUN-123" error={new Error('network failed')} />);

    const button = screen.getByRole('button', { name: '患者情報の問い合わせ用IDをコピー' });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('問い合わせ用IDをコピー');
  });

  it('showLogShare=true かつID未取得時は disabled 理由を表示する', () => {
    renderWithToast(<ApiFailureBanner subject="患者情報" showLogShare error={new Error('network failed')} />);

    const button = screen.getByRole('button', { name: /利用できません/ });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('問い合わせ用IDがまだ発行されていないため、コピーできません。再試行後に確認してください。'),
    ).toBeInTheDocument();
  });

  it('raw backend message ではなく canonical copy を表示する', () => {
    renderWithToast(
      <ApiFailureBanner
        subject="患者情報"
        operation="取得"
        httpStatus={500}
        apiResult="E90"
        apiResultMessage="org.springframework.jdbc.BadSqlGrammarException"
      />,
    );

    expect(screen.getByText(/患者情報の取得に失敗しました。サーバー側で障害が発生しています。/)).toBeInTheDocument();
    expect(screen.queryByText(/BadSqlGrammarException/)).not.toBeInTheDocument();
  });
});
