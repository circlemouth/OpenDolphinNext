import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppRouter } from '../AppRouter';
import {
  buildPatientTabKey,
  clearChartsPatientTabsStorage,
  type ChartsPatientTabsStorage,
  writeChartsPatientTabsStorage,
} from '../features/charts/patientTabsStorage';
import { httpFetch } from '../libs/http/httpClient';

vi.mock('../libs/http/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../libs/http/httpClient')>();
  return {
    ...actual,
    httpFetch: vi.fn(),
  };
});
vi.mock('../features/shared/ChartEventStreamBridge', () => ({
  ChartEventStreamBridge: () => null,
}));

const AUTH_STORAGE_KEY = 'opendolphin:web-client:auth';

const FACILITY_ID = '0001';
const USER_ID = 'user01';
const RUN_ID = '20260301T041112Z';

beforeEach(() => {
  vi.mocked(httpFetch).mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/session/me')) {
      return new Response(
        JSON.stringify({
          facilityId: FACILITY_ID,
          userId: USER_ID,
          role: 'doctor',
          roles: ['doctor'],
          runId: RUN_ID,
          clientUuid: 'client-001',
          displayName: USER_ID,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    return new Response(null, { status: 404 });
  });
});

const setAuthSession = () => {
  sessionStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      facilityId: FACILITY_ID,
      userId: USER_ID,
      role: 'doctor',
      runId: RUN_ID,
      displayName: USER_ID,
    }),
  );
};

const setPatientTabsStorage = () => {
  const now = new Date().toISOString();
  const tabKey = buildPatientTabKey('00000001', '2026-03-01', {
    scheduleKey: '0001:AP-20260301-001',
    encounterKey: '0001:AC-20260301-001',
  });
  if (!tabKey) throw new Error('tabKey must exist');
  const state: ChartsPatientTabsStorage = {
    version: 1,
    updatedAt: now,
    savedAt: now,
    activeKey: tabKey,
    tabs: [
      {
        key: tabKey,
        patientId: '00000001',
        visitDate: '2026-03-01',
        scheduleKey: '0001:AP-20260301-001',
        encounterKey: '0001:AC-20260301-001',
        appointmentId: '1001',
        receptionId: '2001',
        openedAt: now,
        lastActivatedAt: now,
        name: '山田 太郎',
        department: '内科',
      },
    ],
  };
  writeChartsPatientTabsStorage(state, {
    facilityId: FACILITY_ID,
    userId: USER_ID,
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  clearChartsPatientTabsStorage();
  window.history.pushState({}, '', '/');
});

describe('WorkspaceTabBar navigation', () => {
  it('患者カルテタブが患者管理の右側に表示され、クリックで charts へ遷移する', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();

    localStorage.clear();
    sessionStorage.clear();
    setAuthSession();
    setPatientTabsStorage();

    window.history.pushState({}, '', '/f/0001/reception');

    render(
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>,
    );

    expect(window.location.pathname).toBe('/f/0001/reception');

    const patientTab = await screen.findByRole('tab', { name: /山田 太郎 ID:00000001 \/ 内科/i });
    expect(patientTab).toBeInTheDocument();
    expect(within(patientTab).getByText('山田 太郎')).toBeInTheDocument();
    expect(within(patientTab).getByText(/ID:00000001 \/ 内科/)).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.some((tab) => tab.textContent?.includes('受付'))).toBe(true);
    expect(tabs.some((tab) => tab.textContent?.includes('患者管理'))).toBe(true);
    expect(tabs.some((tab) => tab.textContent?.includes('山田 太郎'))).toBe(true);

    await user.click(patientTab);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/f/0001/charts');
    });
  }, 10_000);

  it('受付画面で患者タブの✗を押しても charts へ遷移せずタブだけ閉じる', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();

    localStorage.clear();
    sessionStorage.clear();
    setAuthSession();
    setPatientTabsStorage();

    window.history.pushState({}, '', '/f/0001/reception');

    render(
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>,
    );

    const closeButton = await screen.findByRole('button', { name: /山田 太郎 ID:00000001 \/ 内科/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/f/0001/reception');
    });
    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /山田 太郎 ID:00000001 \/ 内科/i })).toBeNull();
    });
  });

  it('reload 相当の再 mount では patient tab を storage 復元しない', async () => {
    const queryClient = new QueryClient();

    setAuthSession();
    setPatientTabsStorage();
    window.history.pushState({}, '', '/f/0001/reception');

    const firstRender = render(
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('tab', { name: /山田 太郎 ID:00000001 \/ 内科/i })).toBeInTheDocument();

    firstRender.unmount();
    clearChartsPatientTabsStorage();
    window.history.pushState({}, '', '/f/0001/reception');

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AppRouter />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /山田 太郎 ID:00000001 \/ 内科/i })).toBeNull();
    });
  });
});
