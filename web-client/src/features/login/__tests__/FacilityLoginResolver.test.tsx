import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { FacilityLoginResolver } from '../FacilityLoginResolver';

const buildRouter = (
  initialEntries?: Array<string | { pathname: string; state?: unknown }>,
  initialIndex?: number,
) =>
  createMemoryRouter(
    [
      { path: '/login', element: <FacilityLoginResolver /> },
      { path: '/f/:facilityId/login', element: <div>facility login</div> },
      { path: '/before', element: <div>before</div> },
    ],
    { initialEntries: initialEntries ?? [{ pathname: '/login' }], initialIndex },
  );

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe('FacilityLoginResolver', () => {
  it('recentFacilities が1件なら facility ログインへ自動遷移する', async () => {
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001']));
    const router = buildRouter();

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/0001/login');
    });
  });

  it('from state に施設ID付きパスがある場合は最優先で自動補完する', async () => {
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001', '0002']));
    const router = buildRouter([{ pathname: '/login', state: { from: '/f/ABC-01/reception' } }]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/ABC-01/login');
    });
  });

  it('from state を forwardState として維持する', async () => {
    const fromState = { pathname: '/f/XYZ-02/charts', search: '?mode=print' };
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001', '0002']));
    const router = buildRouter([{ pathname: '/login', state: { from: fromState } }]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/XYZ-02/login');
    });
    expect(router.state.location.state).toEqual({ from: fromState });
  });

  it('recentFacilities が複数なら施設選択を表示する', async () => {
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001', '0002']));
    const router = buildRouter();

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('OpenDolphin Web 施設選択')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('single facility login では複数の recentFacilities より VITE_DEFAULT_FACILITY_ID を優先する', async () => {
    vi.stubEnv('VITE_SINGLE_FACILITY_LOGIN', '1');
    vi.stubEnv('VITE_DEFAULT_FACILITY_ID', 'F001');
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001', '0002']));
    const router = buildRouter();

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/F001/login');
    });
  });

  it('補完候補が無い場合は施設選択を表示する', async () => {
    const router = buildRouter();

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('OpenDolphin Web 施設選択')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('switchContext がある場合は自動補完せず施設選択を表示する', async () => {
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001']));
    const switchContext = { mode: 'switch', reason: 'manual', actor: { facilityId: '0001', userId: 'user-1' } };
    const router = buildRouter([{ pathname: '/login', state: { switchContext } }]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('OpenDolphin Web 施設選択')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('auto-resolve は replace 遷移で login history を増やさない', async () => {
    localStorage.setItem('opendolphin:web-client:recentFacilities', JSON.stringify(['0001']));
    const router = buildRouter(['/before', { pathname: '/login' }], 1);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/0001/login');
    });

    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/before');
    });
  });
});
