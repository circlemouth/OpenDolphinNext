import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildChartsEncounterSearch,
  clearChartsEncounterContext,
  hasEncounterContext,
  normalizeEncounterContext,
  normalizeVisitDate,
  parseChartsEncounterContext,
  type OutpatientEncounterContext,
} from '../encounterContext';

const RUN_ID = '20260302T132338Z';

const sameEncounterContext = (left: OutpatientEncounterContext, right: OutpatientEncounterContext) =>
  (left.scheduleKey ?? '') === (right.scheduleKey ?? '') &&
  (left.encounterKey ?? '') === (right.encounterKey ?? '') &&
  (left.patientId ?? '') === (right.patientId ?? '') &&
  (left.appointmentId ?? '') === (right.appointmentId ?? '') &&
  (left.receptionId ?? '') === (right.receptionId ?? '') &&
  (normalizeVisitDate(left.visitDate) ?? '') === (normalizeVisitDate(right.visitDate) ?? '');

function EncounterUrlSyncGuardHarness() {
  const location = useLocation();
  const navigate = useNavigate();
  const [encounterContext, setEncounterContext] = useState<OutpatientEncounterContext>(() =>
    parseChartsEncounterContext(location.search),
  );
  const urlContext = useMemo(() => parseChartsEncounterContext(location.search), [location.search]);
  const suppressUrlContextSyncRef = useRef(false);

  const switchEncounterInternally = useCallback((next: OutpatientEncounterContext) => {
    suppressUrlContextSyncRef.current = true;
    setEncounterContext(normalizeEncounterContext(next));
  }, []);

  useEffect(() => {
    if (suppressUrlContextSyncRef.current) {
      const urlHasContext = hasEncounterContext(urlContext);
      const encounterHasContext = hasEncounterContext(encounterContext);
      if (urlHasContext !== encounterHasContext) return;
      if (urlHasContext && !sameEncounterContext(urlContext, encounterContext)) return;
      suppressUrlContextSyncRef.current = false;
    }
    if (!hasEncounterContext(urlContext)) return;
    if (sameEncounterContext(urlContext, encounterContext)) return;
    setEncounterContext(normalizeEncounterContext(urlContext));
  }, [encounterContext, urlContext]);

  useEffect(() => {
    if (!hasEncounterContext(encounterContext)) {
      if (!hasEncounterContext(urlContext)) {
        suppressUrlContextSyncRef.current = false;
      }
      return;
    }
    const nextSearch = buildChartsEncounterSearch(encounterContext, {}, { runId: RUN_ID });
    if (location.search === nextSearch) {
      suppressUrlContextSyncRef.current = false;
      return;
    }
    navigate({ pathname: '/charts', search: nextSearch }, { replace: true });
  }, [encounterContext, location.search, navigate, urlContext]);

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          switchEncounterInternally({
            patientId: 'PX-2',
            appointmentId: 'A-2',
            receptionId: 'R-2',
            scheduleKey: 'F001:S200',
            encounterKey: 'F001:E200',
            visitDate: '2026-03-02',
          })
        }
      >
        active-close
      </button>
      <button
        type="button"
        onClick={() =>
          switchEncounterInternally({
            patientId: 'PX-3',
            appointmentId: 'A-3',
            receptionId: 'R-3',
            scheduleKey: 'F001:S300',
            encounterKey: 'F001:E300',
            visitDate: '2026-03-02',
          })
        }
      >
        patients-switch
      </button>
      <button
        type="button"
        onClick={() =>
          switchEncounterInternally({
            patientId: 'PX-4',
            appointmentId: 'A-4',
            receptionId: 'R-4',
            scheduleKey: 'F001:S400',
            encounterKey: 'F001:E400',
            visitDate: '2026-03-02',
          })
        }
      >
        past-hub-switch
      </button>
      <div data-testid="location-search">{location.search}</div>
      <div data-testid="encounter-patient">{encounterContext.patientId ?? ''}</div>
    </div>
  );
}

afterEach(cleanup);
afterEach(() => {
  clearChartsEncounterContext();
});

describe('encounter context URL sync guard', () => {
  it('active tab close 相当の内部切替で古いURLへ巻き戻らない', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: '/charts',
          element: <EncounterUrlSyncGuardHarness />,
        },
      ],
      { initialEntries: [`/charts?patientId=PX-1&appointmentId=A-1&receptionId=R-1&visitDate=2026-03-02&runId=${RUN_ID}`] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId('encounter-patient')).toHaveTextContent('PX-1');
    await user.click(screen.getByRole('button', { name: 'active-close' }));

    await waitFor(() => {
      const search = screen.getByTestId('location-search');
      expect(screen.getByTestId('encounter-patient')).toHaveTextContent('PX-2');
      expect(search).toHaveTextContent(`runId=${RUN_ID}`);
      expect(search).not.toHaveTextContent('patientId=');
    });
  });

  it('PatientsTab/PastHub 相当の内部切替でも古いURLへ巻き戻らない', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: '/charts',
          element: <EncounterUrlSyncGuardHarness />,
        },
      ],
      { initialEntries: [`/charts?patientId=PX-1&appointmentId=A-1&receptionId=R-1&visitDate=2026-03-02&runId=${RUN_ID}`] },
    );

    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole('button', { name: 'patients-switch' }));
    await waitFor(() => {
      const search = screen.getByTestId('location-search');
      expect(screen.getByTestId('encounter-patient')).toHaveTextContent('PX-3');
      expect(search).toHaveTextContent(`runId=${RUN_ID}`);
      expect(search).not.toHaveTextContent('patientId=');
    });

    await user.click(screen.getByRole('button', { name: 'past-hub-switch' }));
    await waitFor(() => {
      const search = screen.getByTestId('location-search');
      expect(screen.getByTestId('encounter-patient')).toHaveTextContent('PX-4');
      expect(search).toHaveTextContent(`runId=${RUN_ID}`);
      expect(search).not.toHaveTextContent('patientId=');
    });
  });
});
