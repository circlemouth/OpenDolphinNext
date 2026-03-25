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
  fetchEffectiveAdminConfig: vi.fn(async () => ({
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
  fetchPatients: vi.fn(async () => ({ patients: [] })),
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
vi.mock('../ChartsActionBar', () => ({
  ChartsActionBar: forwardRef(({ onBeforeAction, onAfterFinish, onDraftSaved }: any, ref) => {
    const runFinish = async () => {
      const allow = (await onBeforeAction?.('finish')) ?? true;
      if (allow) await onAfterFinish?.();
    };
    const runDraftSave = async () => {
      const allow = (await onBeforeAction?.('draft')) ?? true;
      if (allow) onDraftSaved?.();
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
      'div',
      null,
      React.createElement(
        'button',
        {
          type: 'button',
          id: 'charts-action-draft',
          onClick: runDraftSave,
        },
        'ドラフト保存（モック）',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: runFinish,
        },
        '診察終了（モック）',
      ),
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

vi.mock('../SoapNotePanel', () => ({
  SoapNotePanel: ({ onDraftDirtyChange, onSyncStateChange, saveRequest, onSaveRequestResult }: any) => {
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
    }, [onDraftDirtyChange, onSyncStateChange]);
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
    }, [onDraftDirtyChange, onSaveRequestResult, onSyncStateChange, saveRequest]);
    return React.createElement('div', { 'data-test-id': 'soap-note-mock' });
  },
}));

const seedPatientTabStorage = () => {
  const patientTabKey = 'P-001::2026-02-16';
  const storageKey = 'opendolphin:web-client:charts:patient-tabs:v1:facility:doctor';
  const now = new Date().toISOString();
  sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      version: 1,
      updatedAt: now,
      savedAt: now,
      activeKey: patientTabKey,
      tabs: [
        {
          key: patientTabKey,
          patientId: 'P-001',
          visitDate: '2026-02-16',
          appointmentId: 'A-001',
          receptionId: 'R-001',
          openedAt: now,
        },
      ],
    }),
  );
};

describe('ChartsPage patient tab dirty indicator', () => {
  it('WorkspaceTabBar 統合後は Charts 内の患者タブUIを描画しない', async () => {
    seedPatientTabStorage();

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

    await screen.findByRole('button', { name: '診察終了（上部モック）' });
    expect(document.querySelector('[data-test-id="charts-patient-tabs"]')).toBeNull();
    expect(document.querySelector('.charts-patient-tabs__dirty-dot')).toBeNull();
  });

  it('未保存状態で診察終了すると保存/破棄/キャンセルの3択ダイアログを表示する', async () => {
    seedPatientTabStorage();

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

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '診察終了（上部モック）' }));

    const dialog = screen.getByRole('alertdialog', { name: '診察終了の確認' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('SOAP等の未保存入力があります。続行方法を選択してください。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存して終了' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存せず終了' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存して終了' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: '診察終了の確認' })).toBeNull();
    });
  });

  it('Shift+Enter でドラフト保存ショートカット後は終了ガードを表示しない', async () => {
    seedPatientTabStorage();

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

    const user = userEvent.setup();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.click(await screen.findByRole('button', { name: '診察終了（上部モック）' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: '診察終了の確認' })).toBeNull();
    });
  });
});
