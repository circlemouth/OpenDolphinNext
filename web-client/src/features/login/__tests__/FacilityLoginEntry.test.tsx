import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { FacilityLoginEntry } from '../FacilityLoginEntry';

const buildRouter = (initialEntry?: { pathname: string; state?: unknown }) =>
  createMemoryRouter(
    [
      { path: '/login', element: <FacilityLoginEntry /> },
      { path: '/f/:facilityId/login', element: <div>facility login</div> },
    ],
    { initialEntries: [initialEntry ?? { pathname: '/login' }] },
  );

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('FacilityLoginEntry', () => {
  it('最近利用施設のボタン選択で facility ログインへ遷移する', async () => {
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001', '0002']));
    const router = buildRouter();
    const user = userEvent.setup();

    render(<RouterProvider router={router} />);
    await user.click(screen.getByRole('button', { name: '0001' }));

    expect(router.state.location.pathname).toBe('/f/0001/login');
  });

  it('手入力した施設IDで facility ログインへ遷移し、from を引き継ぐ', async () => {
    const from = { pathname: '/f/0002/charts', search: '?from=login' };
    const router = buildRouter({ pathname: '/login', state: { from } });
    const user = userEvent.setup();

    render(<RouterProvider router={router} />);
    expect(screen.queryByText(/旧URLからアクセスされています/)).toBeNull();
    await user.type(screen.getByLabelText('施設ID'), 'FAC-9');
    await user.click(screen.getByRole('button', { name: 'ログインへ進む' }));

    expect(router.state.location.pathname).toBe('/f/FAC-9/login');
    expect(router.state.location.state).toEqual({ from });
  });

  it('facility 付き URL からの遷移では旧URL案内を表示しない', () => {
    const from = { pathname: '/f/0001/reception', search: '' };
    const router = buildRouter({ pathname: '/login', state: { from } });

    render(<RouterProvider router={router} />);

    expect(screen.queryByText(/旧URLからアクセスされています/)).toBeNull();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('switchContext を引き継いで施設ログインへ遷移する', async () => {
    const from = { pathname: '/f/0002/reception', search: '' };
    const switchContext = {
      mode: 'switch',
      reason: 'manual',
      actor: { facilityId: '0001', userId: 'user-1', role: 'admin', runId: 'RUN-0001' },
    };
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001']));
    const router = buildRouter({ pathname: '/login', state: { from, switchContext } });
    const user = userEvent.setup();

    render(<RouterProvider router={router} />);

    expect(screen.getByText(/施設\/ユーザー切替を開始しました/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '0001' }));

    expect(router.state.location.pathname).toBe('/f/0001/login');
    expect(router.state.location.state).toEqual({ from, switchContext });
  });
});
