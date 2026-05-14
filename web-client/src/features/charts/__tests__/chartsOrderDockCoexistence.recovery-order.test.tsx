import React, { forwardRef, useImperativeHandle } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthServiceProvider } from '../authService';
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
    deliveredAt: '2026-02-16T10:00:00.000Z',
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
    recordsReturned: 1,
    hasNextPage: false,
    fetchedAt: '2026-02-16T10:00:00.000Z',
  })),
  fetchAppointmentOutpatients: vi.fn(async () => ({
    runId: 'RUN-APPOINT',
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    entries: [
      {
        id: 'entry-1',
        patientId: 'P-001',
        name: '患者A',
        status: '診療中',
        source: 'visits',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        visitDate: '2026-02-16',
        department: '内科',
      },
    ],
    page: 1,
    size: 50,
    hasNextPage: false,
    recordsReturned: 1,
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
    recordsReturned: 1,
    fetchedAt: '2026-02-16T10:00:00.000Z',
  })),
}));

vi.mock('../../patients/api', () => ({
  searchLocalPatients: vi.fn(async () => ({ patients: [] })),
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
vi.mock('../DiagnosisEditPanel', () => ({ DiagnosisEditPanel: () => null }));
vi.mock('../DocumentCreatePanel', () => ({ DocumentCreatePanel: () => null }));
vi.mock('../OrderBundleEditPanel', () => ({ OrderBundleEditPanel: () => null }));
vi.mock('../PastHubPanel', () => ({ PastHubPanel: () => null }));
vi.mock('../PatientSummaryPanel', () => ({ PatientSummaryPanel: () => null }));
vi.mock('../../images/components', () => ({ ImageDockedPanel: () => null }));
vi.mock('../../shared/AdminBroadcastBanner', () => ({ AdminBroadcastBanner: () => null }));
vi.mock('../../shared/RunIdBadge', () => ({ RunIdBadge: () => null }));
vi.mock('../../shared/StatusPill', () => ({ StatusPill: () => null }));
vi.mock('../../shared/AuditSummaryInline', () => ({ AuditSummaryInline: () => null }));
vi.mock('../../reception/components/ToneBanner', () => ({ ToneBanner: () => null }));
vi.mock('../styles', () => ({ chartsStyles: '' }));
vi.mock('../../reception/styles', () => ({ receptionStyles: '' }));
vi.mock('../../outpatient/appointmentDataBanner', () => ({ getAppointmentDataBanner: () => null }));

vi.mock('../ChartsActionBar', () => ({
  ChartsActionBar: forwardRef(({ onBeforeAction, onAfterFinish }: any, ref) => {
    const runFinish = async () => {
      const allow = (await onBeforeAction?.('finish')) ?? true;
      if (allow) await onAfterFinish?.();
    };
    useImperativeHandle(
      ref,
      () => ({
        finish: runFinish,
        pause: async () => {
          const allow = (await onBeforeAction?.('pause')) ?? true;
          return allow;
        },
        start: async () => {
          const allow = (await onBeforeAction?.('start')) ?? true;
          return allow;
        },
      }),
      [onAfterFinish, onBeforeAction],
    );
    return React.createElement(
      'button',
      {
        type: 'button',
        onClick: runFinish,
      },
      '診察終了（モック）',
    );
  }),
}));

vi.mock('../ChartsPatientSummaryBar', () => ({
  ChartsPatientSummaryBar: ({ onFinishEncounter, inlineActionBar }: any) =>
    React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => {
            void onFinishEncounter?.();
          },
        },
        '診察終了（上部モック）',
      ),
      inlineActionBar ?? null,
    ),
}));

vi.mock('../SoapNotePanel', () => ({
  SoapNotePanel: ({ onDraftDirtyChange, onSyncStateChange, onOrderDockStateChange, saveRequest, onSaveRequestResult }: any) => {
    React.useEffect(() => {
      onDraftDirtyChange?.({
        dirty: true,
        patientId: 'P-001',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        visitDate: '2026-02-16',
        dirtySources: ['soap'],
      });
      onSyncStateChange?.({
        localSaved: false,
        serverSynced: false,
        isSaving: false,
      });
      onOrderDockStateChange?.({
        hasEditing: false,
        targetCategory: null,
        count: 2,
        source: null,
      });
    }, [onDraftDirtyChange, onOrderDockStateChange, onSyncStateChange]);

    React.useEffect(() => {
      if (!saveRequest?.token) return;
      onSaveRequestResult?.({
        token: saveRequest.token,
        ok: true,
        message: 'SOAP保存完了（モック）',
        serverSynced: true,
        localSaved: true,
      });
      onDraftDirtyChange?.({
        dirty: false,
        patientId: 'P-001',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        visitDate: '2026-02-16',
        dirtySources: [],
      });
      onSyncStateChange?.({
        localSaved: true,
        serverSynced: true,
        isSaving: false,
      });
      onOrderDockStateChange?.({
        hasEditing: false,
        targetCategory: null,
        count: 2,
        source: null,
      });
    }, [onDraftDirtyChange, onOrderDockStateChange, onSaveRequestResult, onSyncStateChange, saveRequest]);

    return React.createElement(
      'div',
      { 'data-test-id': 'soap-note-mock' },
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            onOrderDockStateChange?.({
              hasEditing: true,
              targetCategory: 'prescription',
              count: 2,
              editingLabel: '処方',
              source: 'right-panel',
            }),
        },
        '右欄編集開始',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            onOrderDockStateChange?.({
              hasEditing: false,
              targetCategory: null,
              count: 2,
              source: null,
            }),
        },
        '右欄編集終了',
      ),
    );
  },
}));

const buildQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('ChartsPage order dock coexistence recovery', () => {
  it('右欄編集中でも下部ユーティリティを維持し、未保存離脱ガード後に復帰できる', async () => {
    const user = userEvent.setup();
    const patientTabKey = 'P-001::2026-02-16';
    const storageKey = 'opendolphin:web-client:charts:patient-tabs:v1:facility:doctor';
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        updatedAt: '2026-02-16T10:00:00.000Z',
        activeKey: patientTabKey,
        tabs: [
          {
            key: patientTabKey,
            patientId: 'P-001',
            visitDate: '2026-02-16',
            appointmentId: 'A-001',
            receptionId: 'R-001',
            name: '患者A',
            openedAt: '2026-02-16T10:00:00.000Z',
          },
        ],
      }),
    );

    render(
      <QueryClientProvider client={buildQueryClient()}>
        <AuthServiceProvider initialFlags={{ runId: 'RUN-AUTH', cacheHit: true, missingMaster: false, dataSourceTransition: 'server' }}>
          <MemoryRouter initialEntries={['/f/facility/charts']}>
            <NavigationGuardProvider>
              <ChartsPage />
            </NavigationGuardProvider>
          </MemoryRouter>
        </AuthServiceProvider>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '右欄編集開始' })).toBeInTheDocument(),
    );
    expect(document.querySelector('[data-utility-action="order-set"]')).not.toBeNull();
    expect(document.querySelector('[data-utility-action="document"]')).not.toBeNull();
    expect(document.querySelector('#charts-utility-pane')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '右欄編集開始' }));
    expect(document.querySelector('[data-test-id="charts-order-dock-coexist-guard-dialog"]')).toBeNull();

    await user.click(screen.getByRole('button', { name: '診察終了（モック）' }));
    await waitFor(() =>
      expect(document.querySelector('[data-test-id="charts-encounter-exit-guard-dialog"]')).not.toBeNull(),
    );

    const guardDialog = document.querySelector('[data-test-id="charts-encounter-exit-guard-dialog"]') as HTMLElement;
    expect(within(guardDialog).getByText('SOAP等の未保存入力があります。続行方法を選択してください。')).toBeInTheDocument();
    await user.click(within(guardDialog).getByRole('button', { name: 'キャンセル' }));
    await waitFor(() =>
      expect(document.querySelector('[data-test-id="charts-encounter-exit-guard-dialog"]')).toBeNull(),
    );
    expect(document.querySelector('[data-utility-action="order-set"]')).not.toBeNull();
    expect(document.querySelector('[data-utility-action="document"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="charts-order-dock-coexist-guard-dialog"]')).toBeNull();
  });
});
