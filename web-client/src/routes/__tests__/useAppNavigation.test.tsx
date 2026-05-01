import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { clearChartsEncounterContext, loadChartsEncounterContext } from '../../features/charts/encounterContext';
import { clearDeepLinkContext, loadDeepLinkContext } from '../deepLinkContextStorage';
import { useAppNavigation } from '../useAppNavigation';

const guardedNavigateMock = vi.hoisted(() => vi.fn());

vi.mock('../../features/charts/authService', () => ({
  useAuthService: () => ({
    flags: {
      runId: 'RUN-NAV',
      missingMaster: false,
      cacheHit: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    },
  }),
}));

vi.mock('../NavigationGuardProvider', () => ({
  useNavigationGuard: () => ({
    registerDirty: vi.fn(),
    isDirty: false,
    dirtySources: [],
    guardedNavigate: guardedNavigateMock,
  }),
}));

function NavigationHarness() {
  const appNav = useAppNavigation({ facilityId: '0001', userId: 'user01' });

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          appNav.openPrintOutpatient({
            state: { entryId: 'ENTRY-001' },
            from: 'charts',
            returnTo: '/f/0001/charts?patientId=P-001&kw=山田',
          })
        }
      >
        open-outpatient
      </button>
      <button
        type="button"
        onClick={() =>
          appNav.openPrintDocument({
            state: { documentId: 'DOC-001' },
            from: 'charts',
            returnTo: '/f/0001/charts?patientId=P-001&appointmentId=A-001&kw=山田',
          })
        }
      >
        open-document
      </button>
      <button
        type="button"
        onClick={() =>
          appNav.openPatients({
            from: 'charts',
            returnTo: '/f/0001/charts?patientId=1&kw=山田',
          })
        }
      >
        open-patients
      </button>
      <button
        type="button"
        onClick={() =>
          appNav.openMobileImages({
            from: 'charts',
            patientId: '12345',
            returnTo: '/f/0001/charts?patientId=12345&kw=山田',
          })
        }
      >
        open-mobile-images
      </button>
      <button
        type="button"
        onClick={() =>
          appNav.openCharts({
            encounter: {
              patientId: 'P-001',
              scheduleKey: 'F001:S100',
              encounterKey: 'F001:E100',
              visitDate: '2026-03-26',
              departmentCode: '01',
              physicianCode: '10001',
              insuranceCombinationNumber: '0001',
            },
          })
        }
      >
        open-charts
      </button>
      <button
        type="button"
        onClick={() =>
          appNav.openCharts({
            encounter: {
              patientId: 'P-003',
              scheduleKey: 'F001:S300',
              visitDate: '2026-03-27',
            },
          })
        }
      >
        open-charts-schedule-only
      </button>
      <button
        type="button"
        onClick={() =>
          appNav.openCharts({
            encounter: {
              patientId: 'P-002',
              visitDate: '2026-03-26',
            },
          })
        }
      >
        open-charts-blocked
      </button>
    </div>
  );
}

describe('useAppNavigation print routing', () => {
  beforeEach(() => {
    guardedNavigateMock.mockReset();
    sessionStorage.clear();
    clearChartsEncounterContext();
    clearDeepLinkContext();
  });

  it('openPrintOutpatient は returnTo を URL と state に保持する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/f/0001/charts?patientId=P-001']}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open-outpatient' }));

    expect(guardedNavigateMock).toHaveBeenCalledTimes(1);
    const [to, options] = guardedNavigateMock.mock.calls[0] as [string, { state?: Record<string, unknown> }];
    const parsed = new URL(to, 'https://app.invalid');

    expect(parsed.pathname).toBe('/f/0001/charts/print/outpatient');
    expect(parsed.searchParams.get('from')).toBe('charts');
    expect(parsed.searchParams.get('returnTo')).toBe('/f/0001/charts');
    expect(options.state?.from).toBe('charts');
    expect(options.state?.returnTo).toBe('/f/0001/charts');
  });

  it('openPrintDocument は returnTo を URL と state に保持する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/f/0001/charts?patientId=P-001']}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open-document' }));

    expect(guardedNavigateMock).toHaveBeenCalledTimes(1);
    const [to, options] = guardedNavigateMock.mock.calls[0] as [string, { state?: Record<string, unknown> }];
    const parsed = new URL(to, 'https://app.invalid');

    expect(parsed.pathname).toBe('/f/0001/charts/print/document');
    expect(parsed.searchParams.get('from')).toBe('charts');
    expect(parsed.searchParams.get('returnTo')).toBe('/f/0001/charts');
    expect(options.state?.from).toBe('charts');
    expect(options.state?.returnTo).toBe('/f/0001/charts');
  });

  it('openPatients は returnTo を scrub して URL/state/volatile memory へ保存する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/f/0001/charts?patientId=P-001']}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open-patients' }));

    expect(guardedNavigateMock).toHaveBeenCalledTimes(1);
    const [to, options] = guardedNavigateMock.mock.calls[0] as [string, { state?: Record<string, unknown> }];
    const parsed = new URL(to, 'https://app.invalid');
    expect(parsed.pathname).toBe('/f/0001/patients');
    expect(parsed.searchParams.get('returnTo')).toBe('/f/0001/charts');
    expect(options.state).toEqual(
      expect.objectContaining({
        returnTo: '/f/0001/charts',
        patientId: 'P-001',
      }),
    );
    expect(loadChartsEncounterContext({ facilityId: '0001', userId: 'user01' })).toEqual({
      patientId: 'P-001',
      appointmentId: undefined,
      receptionId: undefined,
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: undefined,
    });
  });

  it('openMobileImages は patientId を deeplink context と state に保存して URL へ残さない', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/f/0001/charts?patientId=P-001']}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open-mobile-images' }));

    expect(guardedNavigateMock).toHaveBeenCalledTimes(1);
    const [to, options] = guardedNavigateMock.mock.calls[0] as [string, { state?: Record<string, unknown> }];
    const parsed = new URL(to, 'https://app.invalid');
    expect(parsed.pathname).toBe('/f/0001/m/images');
    expect(parsed.searchParams.get('patientId')).toBeNull();
    expect(options.state).toEqual(
      expect.objectContaining({
        patientId: '12345',
        returnTo: '/f/0001/charts',
      }),
    );
    expect(loadDeepLinkContext()?.values).toEqual(
      expect.objectContaining({
        patientId: '12345',
      }),
    );
  });

  it('openCharts は scheduleKey / encounterKey を state と volatile context に pass-through する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/f/0001/reception']}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open-charts' }));

    expect(guardedNavigateMock).toHaveBeenCalledTimes(1);
    const [to, options] = guardedNavigateMock.mock.calls[0] as [string, { state?: Record<string, unknown> }];
    const parsed = new URL(to, 'https://app.invalid');
    expect(parsed.pathname).toBe('/f/0001/charts');
    expect(options.state).toEqual(
      expect.objectContaining({
        patientId: 'P-001',
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        visitDate: '2026-03-26',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
      }),
    );
    expect(parsed.searchParams.has('departmentCode')).toBe(false);
    expect(parsed.searchParams.has('physicianCode')).toBe(false);
    expect(parsed.searchParams.has('insuranceCombinationNumber')).toBe(false);
    expect(loadChartsEncounterContext({ facilityId: '0001', userId: 'user01' })).toEqual(
      expect.objectContaining({
        patientId: 'P-001',
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        visitDate: '2026-03-26',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
      }),
    );
  });

  it('openCharts は scheduleKey だけでも canonical handoff として遷移する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/f/0001/reception']}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open-charts-schedule-only' }));

    expect(guardedNavigateMock).toHaveBeenCalledTimes(1);
    const [to, options] = guardedNavigateMock.mock.calls[0] as [string, { state?: Record<string, unknown> }];
    const parsed = new URL(to, 'https://app.invalid');
    expect(parsed.pathname).toBe('/f/0001/charts');
    expect(options.state).toEqual(
      expect.objectContaining({
        patientId: 'P-003',
        scheduleKey: 'F001:S300',
        encounterKey: undefined,
        visitDate: '2026-03-27',
      }),
    );
    expect(loadChartsEncounterContext({ facilityId: '0001', userId: 'user01' })).toEqual(
      expect.objectContaining({
        patientId: 'P-003',
        scheduleKey: 'F001:S300',
        encounterKey: undefined,
        visitDate: '2026-03-27',
      }),
    );
  });

  it('openCharts は canonical key がないと遷移しない', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/f/0001/reception']}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'open-charts-blocked' }));

    expect(guardedNavigateMock).not.toHaveBeenCalled();
    expect(loadChartsEncounterContext({ facilityId: '0001', userId: 'user01' })).toBeNull();
  });
});
