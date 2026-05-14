import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { StampLibraryPanel } from '../StampLibraryPanel';
import { fetchStampDetail, fetchStampTree } from '../stampApi';
import { loadLocalStamps, loadStampClipboard, saveLocalStamp } from '../stampStorage';
import { AUTH_SESSION_STORAGE_KEY } from '../../../libs/session/authStorage';

const FACILITY_ID = '0001';
const USER_ID = 'user01';
const USER_NAME = `${FACILITY_ID}:${USER_ID}`;

vi.mock('../stampApi', async () => ({
  fetchStampTree: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    trees: [
      {
        treeName: '個人',
        entity: 'medOrder',
        stampList: [
          {
            name: '降圧セット',
            entity: 'medOrder',
            stampId: 'STAMP-1',
          },
        ],
      },
      {
        treeName: '共通',
        entity: 'treatmentOrder',
        stampList: [
          {
            name: '創傷処置セット',
            entity: 'treatmentOrder',
            stampId: 'STAMP-2',
          },
        ],
      },
    ],
  }),
  fetchStampDetail: vi.fn().mockImplementation(async (stampId: string) => {
    if (stampId === 'STAMP-1') {
      return {
        ok: true,
        status: 200,
        stampId,
        stamp: {
          orderName: '降圧セット',
          admin: '1日1回 朝',
          bundleNumber: '1',
          memo: '注意事項',
          claimItem: [{ name: 'アムロジピン', number: '1', unit: '錠' }],
        },
      };
    }
    return {
      ok: true,
      status: 200,
      stampId,
      stamp: {
        orderName: '創傷処置セット',
        admin: '',
        bundleNumber: '1',
        memo: '',
        claimItem: [{ name: 'ガーゼ', number: '1', unit: '枚' }],
      },
    };
  }),
}));

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  localStorage.setItem('devFacilityId', FACILITY_ID);
  localStorage.setItem('devUserId', USER_ID);
  sessionStorage.clear();
  sessionStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      facilityId: FACILITY_ID,
      userId: USER_ID,
      userPk: 101,
      role: 'doctor',
      runId: 'RUN-STAMP',
      clientUuid: 'client-stamp',
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('StampLibraryPanel (STAMP-001 MVP)', () => {
  it('treeName 分類で閲覧でき、選択でプレビューが出る', async () => {
    const user = userEvent.setup();
    renderWithClient(<StampLibraryPanel phase={1} />);

    // server stamps appear after queries resolve
    await screen.findByText('サーバースタンプ');
    await waitFor(() => expect(vi.mocked(fetchStampTree)).toHaveBeenCalledWith(101));

    const stampButton = await screen.findByRole('button', { name: /降圧セット/ });
    await user.click(stampButton);
    await waitFor(() => expect(vi.mocked(fetchStampDetail)).toHaveBeenCalledWith('STAMP-1'));

    await screen.findByText('memo: 注意事項');
    expect(await screen.findAllByText(/アムロジピン/)).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'セット/スタンプ適用前の差分プレビュー' })).toBeInTheDocument();
    expect(screen.getByText(/スタンプ選択だけでは処方確定、ORCA送信、会計送信は行いません/)).toBeInTheDocument();
  });

  it('検索で絞り込める', async () => {
    const user = userEvent.setup();
    renderWithClient(<StampLibraryPanel phase={1} />);

    await waitFor(() => expect(vi.mocked(fetchStampTree)).toHaveBeenCalled());

    await screen.findByRole('button', { name: /降圧セット/ });
    await screen.findByRole('button', { name: /創傷処置セット/ });

    await user.type(screen.getByLabelText('スタンプ検索'), '降圧');

    expect(screen.getByRole('button', { name: /降圧セット/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /創傷処置セット/ })).toBeNull();
  });

  it('Phase2 ではクリップボードへコピーできる', async () => {
    const user = userEvent.setup();
    renderWithClient(<StampLibraryPanel phase={2} />);

    await waitFor(() => expect(vi.mocked(fetchStampTree)).toHaveBeenCalled());
    const stampButton = await screen.findByRole('button', { name: /降圧セット/ });
    await user.click(stampButton);

    await screen.findByText('memo: 注意事項');
    await user.click(screen.getByRole('button', { name: 'クリップボードへコピー（Phase2）' }));

    await screen.findByText(/コピーしました（サーバー）/);

    const saved = loadStampClipboard(USER_NAME);
    expect(saved?.name).toBe('降圧セット');
    expect(saved?.source).toBe('server');
    expect(saved?.bundle?.items?.[0]?.name).toBe('アムロジピン');
  });

  it('編集フォームへ読み込んだ内容をローカル新規登録できる', async () => {
    const user = userEvent.setup();
    renderWithClient(<StampLibraryPanel phase={2} />);

    await waitFor(() => expect(vi.mocked(fetchStampTree)).toHaveBeenCalled());
    const stampButton = await screen.findByRole('button', { name: /降圧セット/ });
    await user.click(stampButton);
    await user.click(screen.getByRole('button', { name: '編集フォームへ読み込む' }));
    await waitFor(() => expect(vi.mocked(fetchStampDetail)).toHaveBeenCalledWith('STAMP-1'));

    const nameInput = screen.getByLabelText('編集スタンプ名称');
    await user.clear(nameInput);
    await user.type(nameInput, '降圧セット（ローカル）');
    await user.click(screen.getByRole('button', { name: 'ローカル新規登録' }));

    expect(screen.getByText('ローカルスタンプを登録しました。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /降圧セット（ローカル）/ })).toBeInTheDocument();
  });

  it('既存ローカルスタンプを編集フォームから更新できる', async () => {
    const user = userEvent.setup();
    saveLocalStamp(USER_NAME, {
      name: '既存ローカル',
      category: '院内',
      target: 'medOrder',
      entity: 'medOrder',
      bundle: {
        bundleName: '既存ローカル',
        admin: '1日1回',
        bundleNumber: '1',
        adminMemo: '',
        memo: '',
        startDate: '2026-01-01',
        items: [{ name: 'アムロジピン', quantity: '1', unit: '錠' }],
      },
    });

    renderWithClient(<StampLibraryPanel phase={2} />);

    const localButton = await screen.findByRole('button', { name: /既存ローカル/ });
    await user.click(localButton);
    await user.click(screen.getByRole('button', { name: '編集フォームへ読み込む' }));

    const nameInput = screen.getByLabelText('編集スタンプ名称');
    await user.clear(nameInput);
    await user.type(nameInput, '既存ローカル更新');
    await user.click(screen.getByRole('button', { name: 'ローカル既存更新' }));

    expect(screen.getByText('ローカルスタンプを更新しました。')).toBeInTheDocument();
    expect(loadLocalStamps(USER_NAME)[0]?.name).toBe('既存ローカル更新');
  });
});
