import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import { AuthServiceProvider } from '../authService';
import { clearChartsEncounterContext, storeChartsEncounterContext } from '../encounterContext';
import { ChartsPage } from '../pages/ChartsPage';
import { NavigationGuardProvider } from '../../../routes/NavigationGuardProvider';

const session = {
  facilityId: 'facility',
  userId: 'doctor',
  role: 'system_admin',
  displayName: 'Doctor',
  commonName: 'Doctor',
};

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => session,
}));

vi.mock('../useChartsTabLock', () => ({
  useChartsTabLock: () => ({
    status: 'none',
    tabSessionId: 'tab-1',
    storageKey: null,
    isReadOnly: false,
    readOnlyReason: undefined,
    ownerRunId: undefined,
    ownerTabSessionId: undefined,
    expiresAt: undefined,
    forceTakeover: vi.fn(),
  }),
}));

vi.mock('../../../libs/admin/useAdminBroadcast', () => ({
  useAdminBroadcast: () => ({ broadcast: null }),
}));

vi.mock('../../administration/api', () => ({
  fetchAdminConfig: vi.fn(async () => ({
    chartsMasterSource: 'server',
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    deliveryId: 'DELIVERY-1',
    deliveryVersion: '1',
    deliveredAt: '2026-04-13T05:10:03.000Z',
    runId: 'RUN-ADMIN',
  })),
}));

vi.mock('../../reception/api', () => ({
  fetchReceptionSelectorOptions: vi.fn(async () => ({ departments: [], physicians: [] })),
  fetchClaimFlags: vi.fn(async () => ({
    runId: 'RUN-CLAIM',
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    bundles: [],
    queueEntries: [],
    recordsReturned: 0,
    hasNextPage: false,
    fetchedAt: '2026-04-13T05:10:03.000Z',
  })),
  fetchAppointmentOutpatients: vi.fn(async () => ({
    runId: 'RUN-APPOINT',
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    entries: [],
    page: 1,
    size: 50,
    hasNextPage: false,
    recordsReturned: 0,
    fetchedAt: '2026-04-13T05:10:03.000Z',
  })),
}));

vi.mock('../api', () => ({
  buildUnavailableMedicalSummary: vi.fn(() => ({
    runId: 'RUN-SUMMARY-UNAVAILABLE',
    traceId: 'TRACE-SUMMARY-UNAVAILABLE',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'snapshot',
    fetchedAt: '2026-04-13T05:10:03.000Z',
    recordsReturned: 0,
    outcome: 'MISSING',
    sourcePath: 'key_unavailable',
    payload: { outpatientList: [] },
  })),
  fetchChartsMedicalSummary: vi.fn(async () => ({
    runId: 'RUN-SUMMARY',
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    outcome: 'SUCCESS',
    payload: {},
    recordsReturned: 1,
    fetchedAt: '2026-04-13T05:10:03.000Z',
  })),
}));

vi.mock('../letterApi', () => ({
  fetchKarteIdByPatientId: vi.fn(async () => ({ ok: true, karteId: 1001 })),
}));

vi.mock('../../patients/api', () => ({
  searchLocalPatients: vi.fn(async () => ({ patients: [] })),
}));

vi.mock('../karteExtrasApi', () => ({
  fetchRpHistory: vi.fn(async () => ({ ok: true, entries: [] })),
}));

vi.mock('../orderBundleApi', () => ({
  fetchOrderBundlesWithPatientImportRecovery: vi.fn(async () => ({ ok: true, bundles: [] })),
  mutateOrderBundles: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../prescriptionOrderApi', () => ({
  fetchPrescriptionOrderBundlesWithPatientImportRecovery: vi.fn(async () => ({ ok: true, bundles: [] })),
  mutatePrescriptionOrderBundles: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../diseaseApi', () => ({
  fetchDiseasesWithPatientImportRecovery: vi.fn(async () => ({ ok: true, diseases: [] })),
  fetchDiseases: vi.fn(async () => ({ ok: true, diseases: [] })),
  mutateDiseases: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../outpatient/orcaQueueApi', () => ({
  fetchOrcaQueue: vi.fn(async () => ({
    runId: 'RUN-QUEUE',
    queue: [],
    source: 'mock',
    fetchedAt: '2026-04-13T05:10:03.000Z',
  })),
  fetchOrcaPushEvents: vi.fn(async () => ({
    runId: 'RUN-PUSH',
    events: [],
    fetchedAt: '2026-04-13T05:10:03.000Z',
  })),
}));

vi.mock('../../outpatient/orcaQueueStatus', () => ({
  resolveOrcaSendStatus: () => undefined,
  toClaimQueueEntryFromOrcaQueueEntry: (entry: unknown) => entry,
}));

vi.mock('../../../libs/http/httpClient', () => ({
  hasStoredAuth: () => true,
}));

vi.mock('../AuthServiceControls', () => ({ AuthServiceControls: () => null }));
vi.mock('../DocumentTimeline', () => ({ DocumentTimeline: () => null }));
vi.mock('../OrcaSummary', () => ({
  OrcaSummary: () => (
    <section>
      <strong>ORCA収納情報</strong>
    </section>
  ),
}));
vi.mock('../MedicalOutpatientRecordPanel', () => ({
  MedicalOutpatientRecordPanel: () => (
    <section>
      <strong>院内ローカル診療サマリ</strong>
    </section>
  ),
}));
vi.mock('../PatientsTab', () => ({ PatientsTab: () => null }));
vi.mock('../TelemetryFunnelPanel', () => ({ TelemetryFunnelPanel: () => null }));
vi.mock('../ChartsActionBar', () => ({ ChartsActionBar: () => null }));
vi.mock('../ChartsPatientSummaryBar', () => ({ ChartsPatientSummaryBar: () => null }));
vi.mock('../DiagnosisEditPanel', () => ({ DiagnosisEditPanel: () => null }));
vi.mock('../DocumentCreatePanel', () => ({ DocumentCreatePanel: () => null }));
vi.mock('../OrderBundleEditPanel', () => ({ OrderBundleEditPanel: () => null }));
vi.mock('../SoapNotePanel', () => ({
  SoapNotePanel: ({ orcaPanel }: { orcaPanel?: unknown }) => <>{orcaPanel}</>,
}));
vi.mock('../../images/components', () => ({ ImageDockedPanel: () => null }));
vi.mock('../../shared/AdminBroadcastBanner', () => ({ AdminBroadcastBanner: () => null }));
vi.mock('../../shared/RunIdBadge', () => ({ RunIdBadge: () => null }));
vi.mock('../../shared/StatusPill', () => ({ StatusPill: () => null }));
vi.mock('../../shared/AuditSummaryInline', () => ({ AuditSummaryInline: () => null }));
vi.mock('../../reception/components/ToneBanner', () => ({ ToneBanner: () => null }));
vi.mock('../styles', () => ({ chartsStyles: '' }));
vi.mock('../../reception/styles', () => ({ receptionStyles: '' }));
vi.mock('../../outpatient/appointmentDataBanner', () => ({ getAppointmentDataBanner: () => null }));

afterEach(() => {
  clearChartsEncounterContext();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('ChartsPage local summary semantics', () => {
  it('debug local summary を visible card で表示し ORCA収納情報と混同しない', async () => {
    vi.stubEnv('VITE_ENABLE_DEBUG_UI', '1');
    storeChartsEncounterContext({
      patientId: '000001',
      encounterKey: 'F001:E100',
      visitDate: '2026-04-13',
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthServiceProvider initialFlags={{ runId: 'RUN-AUTH', cacheHit: true, missingMaster: false, dataSourceTransition: 'server' }}>
          <MemoryRouter initialEntries={['/f/facility/charts']}>
            <NavigationGuardProvider>
              <ChartsPage />
            </NavigationGuardProvider>
          </MemoryRouter>
        </AuthServiceProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('ORCA収納情報')).toBeInTheDocument();
    expect(await screen.findByText('院内ローカル診療サマリ')).toBeInTheDocument();
    expect(screen.queryByText('ORCA 記録（要約）')).not.toBeInTheDocument();

    await waitFor(() => {
      const localSummaryCard = document.getElementById('charts-local-summary');
      expect(localSummaryCard).not.toBeNull();
      expect(localSummaryCard?.tagName).toBe('DIV');
      expect(localSummaryCard?.querySelector('details')).toBeNull();
    });
  });
});
