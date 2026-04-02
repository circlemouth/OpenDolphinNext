import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrcaHokenjaReferenceDialog } from '../OrcaHokenjaReferenceDialog';

const mockFetchOrcaHokenja = vi.fn();

vi.mock('../../patients/orcaHokenjaApi', () => ({
  fetchOrcaHokenja: (...args: unknown[]) => mockFetchOrcaHokenja(...args),
}));

describe('OrcaHokenjaReferenceDialog', () => {
  beforeEach(() => {
    mockFetchOrcaHokenja.mockReset();
  });

  it('keyword 検索で read-only の結果を表示する', async () => {
    mockFetchOrcaHokenja.mockResolvedValue({
      ok: true,
      status: 200,
      items: [
        {
          payerCode: '06123456',
          payerName: '東京保険者',
          payerType: '協会けんぽ',
          payerRatio: 7,
          addressLine: '東京都千代田区丸の内1-1-1',
          phone: '03-0000-0000',
          validFrom: '2026-04-01',
          validTo: '2027-03-31',
        },
      ],
    });
    const user = userEvent.setup();

    render(
      <OrcaHokenjaReferenceDialog
        open
        onClose={vi.fn()}
        patientId="P-001"
        patientName="山田 花子"
        insuranceLabel="社保12"
        visitDate="2026-04-02"
      />,
    );

    await user.type(screen.getByRole('textbox', { name: '保険者番号または名称' }), '東京');
    await user.click(screen.getByRole('button', { name: '検索' }));

    expect(mockFetchOrcaHokenja).toHaveBeenCalledWith({ keyword: '東京' });
    expect(await screen.findByText('東京保険者')).toBeInTheDocument();
    expect(screen.getByText('06123456')).toBeInTheDocument();
    expect(screen.getByText(/協会けんぽ.*7(\.0)?%/)).toBeInTheDocument();
    expect(screen.getByText('東京都千代田区丸の内1-1-1')).toBeInTheDocument();
    expect(screen.getByText('03-0000-0000')).toBeInTheDocument();
    expect(screen.getByText('2026-04-01 - 2027-03-31')).toBeInTheDocument();
    expect(screen.getByText('ORCA 保険者マスタを参照します。患者情報は更新しません。')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: '保険者参照' });
    expect(within(dialog).getByText('患者ID')).toBeInTheDocument();
    expect(within(dialog).getByText('P-001')).toBeInTheDocument();
    expect(within(dialog).getByText('山田 花子')).toBeInTheDocument();
    expect(within(dialog).getByText('社保12')).toBeInTheDocument();
    expect(within(dialog).getByText('2026-04-02')).toBeInTheDocument();
  });

  it('0 件では空状態を出す', async () => {
    mockFetchOrcaHokenja.mockResolvedValue({
      ok: true,
      status: 200,
      items: [],
    });
    const user = userEvent.setup();

    render(<OrcaHokenjaReferenceDialog open onClose={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: '保険者番号または名称' }), '存在しない保険者');
    await user.click(screen.getByRole('button', { name: '検索' }));

    expect(await screen.findByText('該当する保険者が見つかりませんでした。')).toBeInTheDocument();
  });

  it('canonical error copy を表示し raw detail を出さない', async () => {
    mockFetchOrcaHokenja.mockResolvedValue({
      ok: false,
      status: 500,
      message: 'backend stacktrace: connection refused',
    });
    const user = userEvent.setup();

    render(<OrcaHokenjaReferenceDialog open onClose={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: '保険者番号または名称' }), '東京');
    await user.click(screen.getByRole('button', { name: '検索' }));

    expect(await screen.findByText('保険者候補の取得に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/stacktrace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connection refused/i)).not.toBeInTheDocument();
  });
});
