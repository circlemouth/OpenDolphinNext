import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import { AuthServiceProvider } from '../authService';
import { fetchChartsMedicalSummary } from '../api';
import { clearChartsEncounterContext, storeChartsEncounterContext } from '../encounterContext';
import { ChartsPage } from '../pages/ChartsPage';
import { NavigationGuardProvider } from '../../../routes/NavigationGuardProvider';

type MasterPolicy = 'auto' | 'server' | 'mock' | 'snapshot' | 'fallback';

const session = {
  facilityId: 'facility',
  userId: 'doctor',
  role: 'system_admin',
  displayName: 'Doctor',
  commonName: 'Doctor',
};

const buildTransition = (policy: MasterPolicy) => (policy === 'server' ? 'server' : 'mock');

const buildClaimPayload = (policy: MasterPolicy) => ({
  runId: `RUN-CLAIM-${policy}`,
  cacheHit: policy === 'server',
  missingMaster: policy !== 'server',
  fallbackUsed: policy === 'fallback',
  dataSourceTransition: buildTransition(policy),
  bundles: [],
  queueEntries: [],
  recordsReturned: 0,
  hasNextPage: false,
  fetchedAt: '2026-01-25T01:00:00.000Z',
  auditEvent: {
    payload: {
      action: 'mock',
    },
  },
});

const buildAppointmentPayload = (policy: MasterPolicy) => ({
  runId: `RUN-APPOINT-${policy}`,
  cacheHit: policy === 'server',
  missingMaster: policy !== 'server',
  fallbackUsed: policy === 'fallback',
  dataSourceTransition: buildTransition(policy),
  entries: [],
  page: 1,
  size: 50,
  hasNextPage: false,
  recordsReturned: 0,
  fetchedAt: '2026-01-25T01:00:00.000Z',
});

const buildSummaryPayload = (policy: MasterPolicy) => ({
  runId: `RUN-SUMMARY-${policy}`,
  cacheHit: policy === 'server',
  missingMaster: policy !== 'server',
  fallbackUsed: policy === 'fallback',
  dataSourceTransition: buildTransition(policy),
  outcome: 'SUCCESS',
  payload: {},
  recordsReturned: 0,
  fetchedAt: '2026-01-25T01:00:00.000Z',
});

let currentPolicy: MasterPolicy = 'mock';
const summaryQueryKeys: unknown[][] = [];
const fetchCounters = {
  claim: 0,
  appointment: 0,
  summary: 0,
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
    chartsMasterSource: currentPolicy,
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    deliveryId: 'DELIVERY-1',
    deliveryVersion: '1',
    deliveredAt: '2026-01-25T01:00:00.000Z',
    runId: 'RUN-ADMIN',
  })),
}));

vi.mock('../../reception/api', () => ({
  fetchReceptionSelectorOptions: vi.fn(async () => ({ departments: [], physicians: [] })),
  fetchClaimFlags: vi.fn(async (_context: unknown, options?: { preferredSourceOverride?: string }) => {
    fetchCounters.claim += 1;
    return { ...buildClaimPayload(currentPolicy), preferredSourceOverride: options?.preferredSourceOverride };
  }),
  fetchAppointmentOutpatients: vi.fn(async () => {
    fetchCounters.appointment += 1;
    return buildAppointmentPayload(currentPolicy);
  }),
}));

vi.mock('../api', () => ({
  buildUnavailableMedicalSummary: vi.fn(() => ({
    runId: 'RUN-SUMMARY-UNAVAILABLE',
    traceId: 'TRACE-SUMMARY-UNAVAILABLE',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'snapshot',
    fetchedAt: '2026-01-25T01:00:00.000Z',
    recordsReturned: 0,
    outcome: 'MISSING',
    sourcePath: 'key_unavailable',
    payload: { outpatientList: [] },
  })),
  fetchChartsMedicalSummary: vi.fn(async (context?: { queryKey?: unknown[] }) => {
    fetchCounters.summary += 1;
    if (Array.isArray(context?.queryKey)) {
      summaryQueryKeys.push(context.queryKey);
    }
    return buildSummaryPayload(currentPolicy);
  }),
}));

vi.mock('../letterApi', () => ({
  fetchKarteIdByPatientId: vi.fn(async () => ({ ok: true, karteId: 1001 })),
}));

vi.mock('../../patients/api', () => ({
  searchLocalPatients: vi.fn(async () => ({ patients: [] })),
}));

vi.mock('../karteExtrasApi', () => ({
  fetchSafetySummary: vi.fn(async () => ({ ok: true, payload: { allergies: [] } })),
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
    fetchedAt: '2026-01-25T01:00:00.000Z',
  })),
  fetchOrcaPushEvents: vi.fn(async () => ({
    runId: 'RUN-PUSH',
    events: [],
    fetchedAt: '2026-01-25T01:00:00.000Z',
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
vi.mock('../OrderBundleEditPanel', () => ({ OrderBundleEditPanel: () => null }));
vi.mock('../SoapNotePanel', () => ({ SoapNotePanel: () => null }));
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
  currentPolicy = 'mock';
  fetchCounters.claim = 0;
  fetchCounters.appointment = 0;
  fetchCounters.summary = 0;
  summaryQueryKeys.length = 0;
  clearChartsEncounterContext();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Charts masterSource cache refresh', () => {
  it('masterSource 切替で invalidate と再取得が走り、フラグ表示が更新される', async () => {
    vi.stubEnv('VITE_ENABLE_DEBUG_UI', '1');
    storeChartsEncounterContext({
      patientId: '000001',
      encounterKey: 'F001:E100',
      visitDate: '2026-01-25',
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    queryClient.setQueryData(['admin-config'], {
      chartsMasterSource: 'mock',
      chartsDisplayEnabled: true,
      chartsSendEnabled: true,
      deliveryId: 'DELIVERY-1',
      deliveryVersion: '1',
      deliveredAt: '2026-01-25T01:00:00.000Z',
      runId: 'RUN-ADMIN',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthServiceProvider initialFlags={{ runId: 'RUN-AUTH', cacheHit: false, missingMaster: true, dataSourceTransition: 'snapshot' }}>
          <MemoryRouter initialEntries={['/f/facility/charts']}>
            <NavigationGuardProvider>
              <ChartsPage />
            </NavigationGuardProvider>
          </MemoryRouter>
        </AuthServiceProvider>
      </QueryClientProvider>,
    );

    await screen.findByLabelText('外来カルテ作業台');
    expect(screen.queryByText('病名・過去カルテ')).not.toBeInTheDocument();
    expect(screen.queryByText('カルテ記載')).not.toBeInTheDocument();
    const meta = document.querySelector('[data-test-id="charts-topbar-meta"]') as HTMLElement;
    await waitFor(() => expect(meta).toHaveAttribute('data-source-transition', 'mock'));
    await waitFor(() => expect(meta).toHaveAttribute('data-cache-hit', 'false'));
    await waitFor(() => expect(meta).toHaveAttribute('data-missing-master', 'true'));
    await waitFor(() => expect(fetchCounters.claim).toBeGreaterThan(0));

    currentPolicy = 'server';
    queryClient.setQueryData(['admin-config'], {
      chartsMasterSource: 'server',
      chartsDisplayEnabled: true,
      chartsSendEnabled: true,
      deliveryId: 'DELIVERY-2',
      deliveryVersion: '2',
      deliveredAt: '2026-01-25T01:05:00.000Z',
      runId: 'RUN-ADMIN-2',
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['charts-claim-flags'] })),
    );
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['charts-appointments'] })),
    );
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['charts-medical-summary'] })),
    );

    await waitFor(() => expect(fetchCounters.claim).toBeGreaterThan(1));
    await waitFor(() => expect(fetchCounters.appointment).toBeGreaterThan(1));
    await waitFor(() => expect(fetchCounters.summary).toBeGreaterThan(1));

    await waitFor(() => expect(meta).toHaveAttribute('data-source-transition', 'server'));
    await waitFor(() => expect(meta).toHaveAttribute('data-cache-hit', 'true'));
    await waitFor(() => expect(meta).toHaveAttribute('data-missing-master', 'false'));
  });

  it('medical summary query key は encounterKey 主体で構築する', async () => {
    storeChartsEncounterContext({
      patientId: '000001',
      encounterKey: 'F001:E100',
      scheduleKey: 'F001:S100',
      visitDate: '2026-01-25',
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthServiceProvider initialFlags={{ runId: 'RUN-AUTH', cacheHit: false, missingMaster: true, dataSourceTransition: 'snapshot' }}>
          <MemoryRouter initialEntries={['/f/facility/charts']}>
            <NavigationGuardProvider>
              <ChartsPage />
            </NavigationGuardProvider>
          </MemoryRouter>
        </AuthServiceProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(fetchCounters.summary).toBeGreaterThan(0));
    expect(summaryQueryKeys).toContainEqual(['charts-medical-summary', 'F001:E100', 'auto']);
    expect(vi.mocked(fetchChartsMedicalSummary)).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['charts-medical-summary', 'F001:E100', 'auto'],
      }),
      expect.objectContaining({
        encounterKey: 'F001:E100',
      }),
    );
  });
});
