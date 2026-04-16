import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { OrderSetEditorPage } from '../pages/OrderSetEditorPage';
import {
  clearChartOrderSetStorage,
  listChartOrderSets,
  saveChartOrderSet,
  type ChartOrderSetTemplateSnapshot,
} from '../chartOrderSetStorage';

vi.mock('../../../AppRouter', () => ({
  useSession: () => ({ facilityId: 'FAC-1', userId: 'U-1', role: 'doctor' }),
}));

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    returnToCandidate: null,
    fromCandidate: null,
  }),
}));

vi.mock('../../../routes/NavigationGuardProvider', () => ({
  useNavigationGuard: () => ({ registerDirty: vi.fn() }),
}));

vi.mock('../../shared/ReturnToBar', () => ({
  ReturnToBar: () => null,
}));

const makeSnapshot = (): ChartOrderSetTemplateSnapshot => ({
  diagnoses: [],
  orderBundles: [],
});

describe('OrderSetEditorPage', () => {
  beforeEach(() => {
    clearChartOrderSetStorage();
  });

  it('未保存変更がある状態の切替で保存/破棄/キャンセルを選べる', async () => {
    const setB = saveChartOrderSet({
      facilityId: 'FAC-1',
      userId: 'U-1',
      name: 'セットB',
      snapshot: makeSnapshot(),
    });
    const setA = saveChartOrderSet({
      facilityId: 'FAC-1',
      userId: 'U-1',
      name: 'セットA',
      snapshot: makeSnapshot(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrderSetEditorPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('候補病名 (0件)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /セットA/ }));
    await user.type(screen.getByLabelText('セット名称'), ' 変更');

    await user.click(screen.getByRole('button', { name: /セットB/ }));

    expect(screen.getByRole('alertdialog', { name: '未保存の変更があります' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存して切替' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '破棄して切替' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('alertdialog', { name: '未保存の変更があります' })).toBeNull();
    expect(screen.getByRole('button', { name: /セットA/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /セットB/ }));
    await user.click(screen.getByRole('button', { name: '破棄して切替' }));

    expect(screen.getByRole('button', { name: /セットB/ })).toHaveAttribute('aria-pressed', 'true');

    const stored = listChartOrderSets('FAC-1', 'U-1');
    expect(stored.find((entry) => entry.id === setA.id)?.name).toBe('セットA');
    expect(stored.find((entry) => entry.id === setB.id)?.name).toBe('セットB');
  });

  it('保存して切替を選ぶと保存成功時のみ切替える', async () => {
    const setB = saveChartOrderSet({
      facilityId: 'FAC-1',
      userId: 'U-1',
      name: 'セットB',
      snapshot: makeSnapshot(),
    });
    const setA = saveChartOrderSet({
      facilityId: 'FAC-1',
      userId: 'U-1',
      name: 'セットA',
      snapshot: makeSnapshot(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrderSetEditorPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /セットA/ }));
    const nameInput = screen.getByLabelText('セット名称');
    await user.clear(nameInput);
    await user.type(nameInput, 'セットA-更新');

    await user.click(screen.getByRole('button', { name: /セットB/ }));
    await user.click(screen.getByRole('button', { name: '保存して切替' }));

    expect(screen.getByRole('button', { name: /セットB/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/保存して「セットB」へ切替えました/)).toBeInTheDocument();

    const stored = listChartOrderSets('FAC-1', 'U-1');
    expect(stored.find((entry) => entry.id === setA.id)?.name).toBe('セットA-更新');
    expect(stored.find((entry) => entry.id === setB.id)?.name).toBe('セットB');
  });
});
