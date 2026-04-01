import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import { AuthServiceProvider } from '../authService';
import { clearChartsEncounterContext, storeChartsEncounterContext } from '../encounterContext';
import { ChartsPage } from '../pages/ChartsPage';
import { NavigationGuardProvider } from '../../../routes/NavigationGuardProvider';

const shared = vi.hoisted(() => ({
  fetchOrderBundlesWithPatientImportRecovery: vi.fn(),
  fetchDiseasesWithPatientImportRecovery: vi.fn(),
}));

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
    deliveredAt: '2026-02-16T10:00:00.000Z',
    runId: 'RUN-ADMIN',
  })),
}));

vi.mock('../../reception/api', () => ({
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
    fetchedAt: '2026-02-16T10:00:00.000Z',
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
    fetchedAt: '2026-02-16T10:00:00.000Z',
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
    fetchedAt: '2026-02-16T10:00:00.000Z',
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
    recordsReturned: 0,
    fetchedAt: '2026-02-16T10:00:00.000Z',
  })),
}));

vi.mock('../letterApi', () => ({
  fetchKarteIdByPatientId: vi.fn(async () => ({ ok: true, karteId: 123 })),
}));

vi.mock('../../patients/api', () => ({
  fetchPatients: vi.fn(async () => ({ patients: [] })),
}));

vi.mock('../karteExtrasApi', () => ({
  fetchSafetySummary: vi.fn(async () => ({ ok: true, payload: { allergies: [] } })),
  fetchRpHistory: vi.fn(async () => ({ ok: true, entries: [] })),
}));

vi.mock('../orderBundleApi', () => ({
  fetchOrderBundlesWithPatientImportRecovery: shared.fetchOrderBundlesWithPatientImportRecovery,
  mutateOrderBundles: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../diseaseApi', () => ({
  fetchDiseasesWithPatientImportRecovery: shared.fetchDiseasesWithPatientImportRecovery,
  fetchDiseases: vi.fn(async () => ({ ok: true, diseases: [] })),
  mutateDiseases: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../outpatient/orcaQueueApi', () => ({
  fetchOrcaQueue: vi.fn(async () => ({
    runId: 'RUN-QUEUE',
    queue: [],
    source: 'mock',
    fetchedAt: '2026-02-16T10:00:00.000Z',
  })),
  fetchOrcaPushEvents: vi.fn(async () => ({
    runId: 'RUN-PUSH',
    events: [],
    fetchedAt: '2026-02-16T10:00:00.000Z',
  })),
}));

vi.mock('../../outpatient/orcaQueueStatus', () => ({
  resolveOrcaSendStatus: () => undefined,
  toClaimQueueEntryFromOrcaQueueEntry: (entry: any) => entry,
}));

vi.mock('../../../libs/http/httpClient', () => ({
  hasStoredAuth: () => true,
}));

vi.mock('../AuthServiceControls', () => ({ AuthServiceControls: () => null }));
vi.mock('../DocumentTimeline', () => ({ DocumentTimeline: () => null }));
vi.mock('../OrcaSummary', () => ({ OrcaSummary: () => null }));
vi.mock('../MedicalOutpatientRecordPanel', () => ({ MedicalOutpatientRecordPanel: () => null }));
vi.mock('../OrcaOriginalPanel', () => ({ OrcaOriginalPanel: () => null }));
vi.mock('../PatientsTab', () => ({ PatientsTab: () => null }));
vi.mock('../TelemetryFunnelPanel', () => ({ TelemetryFunnelPanel: () => null }));
vi.mock('../ChartsActionBar', () => ({ ChartsActionBar: () => null }));
vi.mock('../ChartsPatientSummaryBar', () => ({ ChartsPatientSummaryBar: () => null }));
vi.mock('../DiagnosisEditPanel', () => ({ DiagnosisEditPanel: () => null }));
vi.mock('../DocumentCreatePanel', () => ({ DocumentCreatePanel: () => null }));
vi.mock('../PastHubPanel', () => ({ PastHubPanel: () => null }));
vi.mock('../PatientSummaryPanel', () => ({ PatientSummaryPanel: () => null }));
vi.mock('../StampLibraryPanel', () => ({ StampLibraryPanel: () => null }));
vi.mock('../SoapNotePanel', () => ({ SoapNotePanel: () => null }));
vi.mock('../../images/components', () => ({ ImageDockedPanel: () => null }));
vi.mock('../../images/api', () => ({ fetchKarteImageList: vi.fn(async () => ({ ok: true, list: [] })) }));
vi.mock('../../shared/AdminBroadcastBanner', () => ({ AdminBroadcastBanner: () => null }));
vi.mock('../../shared/RunIdBadge', () => ({ RunIdBadge: () => null }));
vi.mock('../../shared/StatusPill', () => ({ StatusPill: () => null }));
vi.mock('../../shared/AuditSummaryInline', () => ({ AuditSummaryInline: () => null }));
vi.mock('../../reception/components/ToneBanner', () => ({
  ToneBanner: ({ tone, message }: { tone: string; message: string }) => (
    <div data-testid={`tone-banner-${tone}`}>{message}</div>
  ),
}));
vi.mock('../styles', () => ({ chartsStyles: '' }));
vi.mock('../../reception/styles', () => ({ receptionStyles: '' }));
vi.mock('../../outpatient/appointmentDataBanner', () => ({ getAppointmentDataBanner: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  clearChartsEncounterContext();
  shared.fetchOrderBundlesWithPatientImportRecovery.mockResolvedValue({
    ok: false,
    bundles: [],
    message:
      'オーダー情報 の再取得前に患者取込が認証エラーで失敗しました（reason=authentication_failed）。ORCA認証情報を確認してください。',
    errorKind: 'auth',
    patientImportAttempted: true,
  });
  shared.fetchDiseasesWithPatientImportRecovery.mockResolvedValue({
    ok: true,
    diseases: [],
  });
});

describe('ChartsPage ORCA recovery alert', () => {
  it('shows auth cause in UI and avoids repeated retry loops', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    storeChartsEncounterContext({
      patientId: '000001',
      encounterKey: 'F001:E100',
      visitDate: '2026-02-22',
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

    await waitFor(() => expect(shared.fetchOrderBundlesWithPatientImportRecovery).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('tone-banner-error')).toHaveTextContent('オーダー情報を取得できませんでした。再ログインしてからやり直してください。');
    expect(screen.queryByText(/reason=authentication_failed/)).not.toBeInTheDocument();
    await waitFor(() => expect(shared.fetchOrderBundlesWithPatientImportRecovery).toHaveBeenCalledTimes(1));
  });
});
