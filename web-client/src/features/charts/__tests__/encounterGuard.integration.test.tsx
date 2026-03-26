import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import {
  buildChartsEncounterSearch,
  hasEncounterContext,
  normalizeVisitDate,
  parseChartsEncounterContext,
  type OutpatientEncounterContext,
} from '../encounterContext';

afterEach(cleanup);

const RUN_ID = '20251227T133020Z';

const sameEncounterContext = (left: OutpatientEncounterContext, right: OutpatientEncounterContext) =>
  (left.scheduleKey ?? '') === (right.scheduleKey ?? '') &&
  (left.encounterKey ?? '') === (right.encounterKey ?? '') &&
  (left.patientId ?? '') === (right.patientId ?? '') &&
  (left.appointmentId ?? '') === (right.appointmentId ?? '') &&
  (left.receptionId ?? '') === (right.receptionId ?? '') &&
  (normalizeVisitDate(left.visitDate) ?? '') === (normalizeVisitDate(right.visitDate) ?? '');

const EncounterGuardHarness = ({ blocked }: { blocked: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [encounterContext, setEncounterContext] = useState<OutpatientEncounterContext>(() =>
    parseChartsEncounterContext(location.search),
  );
  const urlContext = useMemo(() => parseChartsEncounterContext(location.search), [location.search]);

  useEffect(() => {
    if (!hasEncounterContext(urlContext)) return;
    if (sameEncounterContext(urlContext, encounterContext)) return;
    if (blocked) {
      const currentSearch = buildChartsEncounterSearch(encounterContext, {}, { runId: RUN_ID });
      if (location.search !== currentSearch) {
        navigate({ pathname: '/charts', search: currentSearch }, { replace: true });
      }
      return;
    }
    setEncounterContext(urlContext);
  }, [blocked, encounterContext, location.search, navigate, urlContext]);

  useEffect(() => {
    if (!hasEncounterContext(encounterContext)) return;
    const nextSearch = buildChartsEncounterSearch(encounterContext, {}, { runId: RUN_ID });
    if (location.search === nextSearch) return;
    navigate({ pathname: '/charts', search: nextSearch }, { replace: true });
  }, [encounterContext, location.search, navigate]);

  return (
    <div>
      <div data-testid="location-search">{location.search}</div>
      <div data-testid="encounter-patient">{encounterContext.patientId ?? ''}</div>
    </div>
  );
};

describe('Charts navigation guard (integration)', () => {
  it('read-only 時は URL の legacy encounter query を scrub しつつ外来コンテキスト切替をブロックする', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/charts',
          element: <EncounterGuardHarness blocked />,
        },
      ],
      { initialEntries: [`/charts?patientId=PX-1&receptionId=R-1&runId=${RUN_ID}`] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent(`runId=${RUN_ID}`);
      expect(screen.getByTestId('location-search')).not.toHaveTextContent('patientId=');
      expect(screen.getByTestId('encounter-patient')).toHaveTextContent('PX-1');
    });

    await act(async () => {
      await router.navigate(`/charts?patientId=PX-2&receptionId=R-2&runId=${RUN_ID}`);
    });

    await waitFor(() => {
      const search = screen.getByTestId('location-search');
      expect(search).toHaveTextContent(`runId=${RUN_ID}`);
      expect(search).not.toHaveTextContent('patientId=');
      expect(search).not.toHaveTextContent('receptionId=');
      expect(search).not.toHaveTextContent('patientId=PX-2');
      expect(screen.getByTestId('encounter-patient')).toHaveTextContent('PX-1');
    });
  });
});
