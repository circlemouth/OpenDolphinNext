import React, { forwardRef, useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthServiceProvider } from '../authService';
import { fetchChartsMedicalSummary } from '../api';
import { clearChartsEncounterContext, storeChartsEncounterContext } from '../encounterContext';
import { fetchDiseasesWithPatientImportRecovery } from '../diseaseApi';
import { fetchKarteIdByPatientId } from '../letterApi';
import { fetchOrderBundlesWithPatientImportRecovery } from '../orderBundleApi';
import { ChartsPage } from '../pages/ChartsPage';
import { fetchPrescriptionOrderBundlesWithPatientImportRecovery } from '../prescriptionOrderApi';
import { buildPatientTabKey, clearChartsPatientTabsStorage, writeChartsPatientTabsStorage } from '../patientTabsStorage';
import { NavigationGuardProvider } from '../../../routes/NavigationGuardProvider';
import { WORKSPACE_CHARTS_TAB_REQUEST_EVENT } from '../../workspaceTabs/workspaceTabEvents';

const session = {
  facilityId: 'facility',
  userId: 'doctor',
  role: 'system_admin',
  displayName: 'Doctor',
  commonName: 'Doctor',
};

const fetchCounters = {
  summary: 0,
  claim: 0,
  appointment: 0,
  karteId: 0,
  orderBundles: 0,
  prescriptionBundles: 0,
  diagnosisSummary: 0,
};

const soapMockState = {
  dirty: true,
  dirtySources: ['soap'] as string[],
  serverSynced: false,
  isSaving: false,
  saveResult: {
    ok: true,
    message: 'SOAP保存完了（モック）',
    serverSynced: true,
    localSaved: true,
    error: undefined as string | undefined,
  },
};

const resetSoapMockState = () => {
  soapMockState.dirty = true;
  soapMockState.dirtySources = ['soap'];
  soapMockState.serverSynced = false;
  soapMockState.isSaving = false;
  soapMockState.saveResult = {
    ok: true,
    message: 'SOAP保存完了（モック）',
    serverSynced: true,
    localSaved: true,
    error: undefined,
  };
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
  fetchClaimFlags: vi.fn(async () => {
    fetchCounters.claim += 1;
    return {
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
    };
  }),
  fetchAppointmentOutpatients: vi.fn(async () => {
    fetchCounters.appointment += 1;
    return {
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
    };
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
    fetchedAt: '2026-02-16T10:00:00.000Z',
    recordsReturned: 0,
    outcome: 'MISSING',
    sourcePath: 'key_unavailable',
    payload: { outpatientList: [] },
  })),
  fetchChartsMedicalSummary: vi.fn(async () => {
    fetchCounters.summary += 1;
    return {
      runId: 'RUN-SUMMARY',
      cacheHit: true,
      missingMaster: false,
      fallbackUsed: false,
      dataSourceTransition: 'server',
      outcome: 'SUCCESS',
      payload: {},
      recordsReturned: 1,
      fetchedAt: '2026-02-16T10:00:00.000Z',
    };
  }),
}));

vi.mock('../encounterTransitionApi', () => ({
  openChartEncounter: vi.fn(async () => ({
    requestId: 'req-start-1',
    traceId: 'trace-start-1',
    encounterKey: 'F001:E100',
    idempotencyKey: 'idem-start-1',
    businessState: 'chart_opened',
  })),
}));

vi.mock('../../patients/api', () => ({
  searchLocalPatients: vi.fn(async () => ({ patients: [] })),
}));

vi.mock('../letterApi', () => ({
  fetchKarteIdByPatientId: vi.fn(async () => {
    fetchCounters.karteId += 1;
    return { ok: true, karteId: 101, error: undefined };
  }),
}));

vi.mock('../orderBundleApi', () => ({
  fetchOrderBundlesWithPatientImportRecovery: vi.fn(async () => {
    fetchCounters.orderBundles += 1;
    return { ok: true, bundles: [] };
  }),
  mutateOrderBundles: vi.fn(),
}));

vi.mock('../prescriptionOrderApi', () => ({
  fetchPrescriptionOrderBundlesWithPatientImportRecovery: vi.fn(async () => {
    fetchCounters.prescriptionBundles += 1;
    return { ok: true, bundles: [] };
  }),
  mutatePrescriptionOrderBundles: vi.fn(),
}));

vi.mock('../diseaseApi', () => ({
  fetchDiseases: vi.fn(async () => ({ diseases: [] })),
  fetchDiseasesWithPatientImportRecovery: vi.fn(async () => {
    fetchCounters.diagnosisSummary += 1;
    return {
      ok: true,
      diseases: [],
      message: undefined,
      errorKind: undefined,
      routeMismatch: false,
      patientImportAttempted: false,
    };
  }),
  mutateDiseases: vi.fn(),
}));

vi.mock('../karteExtrasApi', () => ({
  fetchRpHistory: vi.fn(async () => ({ ok: true, entries: [] })),
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
  ChartsActionBar: forwardRef(({ onBeforeAction, onAfterFinish, onAfterPause, onAfterStart, onDraftSaved }: any, ref) => {
    const runStart = async () => {
      const allow = (await onBeforeAction?.('start')) ?? true;
      if (allow) await onAfterStart?.();
    };
    const runPause = async () => {
      const allow = (await onBeforeAction?.('pause')) ?? true;
      if (allow) await onAfterPause?.();
    };
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
        pause: runPause,
        start: runStart,
      }),
      [onAfterFinish, onAfterPause, onAfterStart, onBeforeAction],
    );
    return React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: runStart,
        },
        '診察開始（モック）',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: runPause,
        },
        '診察中断（モック）',
      ),
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
  ChartsPatientSummaryBar: ({ onFinishEncounter, inlineActionBar, patientId }: any) =>
    React.createElement(
      'div',
      null,
      React.createElement('div', { 'data-testid': 'active-patient-id' }, patientId ?? 'none'),
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
        dirty: soapMockState.dirty,
        patientId: 'P-001',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        visitDate: '2026-02-16',
        dirtySources: soapMockState.dirtySources,
      });
      onSyncStateChange?.({
        localSaved: false,
        serverSynced: soapMockState.serverSynced,
        isSaving: soapMockState.isSaving,
      });
    }, [onDraftDirtyChange, onSyncStateChange]);
    React.useEffect(() => {
      if (!saveRequest?.token) return;
      onSaveRequestResult?.({
        token: saveRequest.token,
        ok: soapMockState.saveResult.ok,
        message: soapMockState.saveResult.message,
        serverSynced: soapMockState.saveResult.serverSynced,
        localSaved: soapMockState.saveResult.localSaved,
        error: soapMockState.saveResult.error,
      });
      if (soapMockState.saveResult.ok && soapMockState.saveResult.serverSynced) {
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
      }
    }, [onDraftDirtyChange, onSaveRequestResult, onSyncStateChange, saveRequest]);
    return React.createElement('div', { 'data-test-id': 'soap-note-mock' });
  },
}));

const seedChartsContext = () => {
  storeChartsEncounterContext({
    patientId: 'P-001',
    appointmentId: 'A-001',
    receptionId: 'R-001',
    encounterKey: 'F001:E100',
    scheduleKey: 'F001:S100',
    visitDate: '2026-02-16',
  });
};

const buildEncounterTab = (params: {
  patientId: string;
  appointmentId: string;
  receptionId: string;
  encounterKey: string;
  scheduleKey: string;
  name: string;
  department: string;
  openedAt?: string;
  lastActivatedAt?: string;
}) => {
  const now = new Date().toISOString();
  const key = buildPatientTabKey(params.patientId, '2026-02-16', {
    scheduleKey: params.scheduleKey,
    encounterKey: params.encounterKey,
  });
  if (!key) throw new Error('encounter tab key must exist');
  return {
    key,
    patientId: params.patientId,
    visitDate: '2026-02-16',
    appointmentId: params.appointmentId,
    receptionId: params.receptionId,
    encounterKey: params.encounterKey,
    scheduleKey: params.scheduleKey,
    name: params.name,
    department: params.department,
    openedAt: params.openedAt ?? now,
    lastActivatedAt: params.lastActivatedAt ?? now,
  };
};

const seedPatientTabStorage = (
  tabs = [
    buildEncounterTab({
      patientId: 'P-001',
      appointmentId: 'A-001',
      receptionId: 'R-001',
      encounterKey: 'F001:E100',
      scheduleKey: 'F001:S100',
      name: '患者A',
      department: '内科',
      openedAt: '2026-02-16T09:00:00.000Z',
      lastActivatedAt: '2026-02-16T09:30:00.000Z',
    }),
  ],
) => {
  const now = '2026-02-16T10:00:00.000Z';
  writeChartsPatientTabsStorage(
    {
      version: 1,
      updatedAt: now,
      savedAt: now,
      activeKey: tabs[0]?.key,
      tabs,
    },
    { facilityId: session.facilityId, userId: session.userId },
  );
};

const renderChartsPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
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
};

const requestWorkspaceTab = (action: 'select' | 'close', key: string) => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_CHARTS_TAB_REQUEST_EVENT, {
        detail: { action, key },
      }),
    );
  });
};

describe('ChartsPage patient tab dirty indicator', () => {
  afterEach(() => {
    fetchCounters.summary = 0;
    fetchCounters.claim = 0;
    fetchCounters.appointment = 0;
    fetchCounters.karteId = 0;
    fetchCounters.orderBundles = 0;
    fetchCounters.prescriptionBundles = 0;
    fetchCounters.diagnosisSummary = 0;
    resetSoapMockState();
    clearChartsEncounterContext();
    clearChartsPatientTabsStorage();
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('WorkspaceTabBar 統合後は Charts 内の患者タブUIを描画しない', async () => {
    seedPatientTabStorage();
    seedChartsContext();

    renderChartsPage();

    await screen.findByRole('button', { name: '診察終了（上部モック）' });
    expect(document.querySelector('[data-test-id="charts-patient-tabs"]')).toBeNull();
    expect(document.querySelector('.charts-patient-tabs__dirty-dot')).toBeNull();
  });

  it('未保存状態で診察終了すると保存/破棄/キャンセルの3択ダイアログを表示する', async () => {
    seedPatientTabStorage();
    seedChartsContext();

    renderChartsPage();

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
    seedChartsContext();

    renderChartsPage();

    const user = userEvent.setup();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.click(await screen.findByRole('button', { name: '診察終了（上部モック）' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: '診察終了の確認' })).toBeNull();
    });
  });

  it('診察開始成功後だけ medical summary を再取得する', async () => {
    seedPatientTabStorage();
    seedChartsContext();

    renderChartsPage();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: '診察開始（モック）' });
    const initialSummaryCalls = fetchCounters.summary;
    const initialClaimCalls = fetchCounters.claim;
    const initialAppointmentCalls = fetchCounters.appointment;

    await user.click(screen.getByRole('button', { name: '診察開始（モック）' }));

    await waitFor(() => expect(fetchCounters.summary).toBeGreaterThan(initialSummaryCalls));
    expect(fetchCounters.claim).toBeGreaterThan(initialClaimCalls);
    expect(fetchCounters.appointment).toBeGreaterThan(initialAppointmentCalls);
    expect(vi.mocked(fetchChartsMedicalSummary)).toHaveBeenCalled();
  });

  it('診察中断/終了では medical summary を再取得しない', async () => {
    seedPatientTabStorage();
    seedChartsContext();

    renderChartsPage();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: '診察中断（モック）' });
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    const initialSummaryCalls = fetchCounters.summary;

    await user.click(screen.getByRole('button', { name: '診察中断（モック）' }));
    await waitFor(() => expect(fetchCounters.summary).toBe(initialSummaryCalls));

    await user.click(screen.getByRole('button', { name: '診察終了（モック）' }));
    await waitFor(() => expect(fetchCounters.summary).toBe(initialSummaryCalls));
  });

  it('workspace tab の active switch は保存成功後だけ切り替える', async () => {
    const tabs = [
      buildEncounterTab({
        patientId: 'P-001',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        encounterKey: 'F001:E100',
        scheduleKey: 'F001:S100',
        name: '患者A',
        department: '内科',
        openedAt: '2026-02-16T09:00:00.000Z',
        lastActivatedAt: '2026-02-16T09:30:00.000Z',
      }),
      buildEncounterTab({
        patientId: 'P-002',
        appointmentId: 'A-002',
        receptionId: 'R-002',
        encounterKey: 'F001:E200',
        scheduleKey: 'F001:S200',
        name: '患者B',
        department: '外科',
        openedAt: '2026-02-16T09:10:00.000Z',
        lastActivatedAt: '2026-02-16T09:20:00.000Z',
      }),
    ];
    seedPatientTabStorage(tabs);
    seedChartsContext();

    renderChartsPage();

    expect(await screen.findByTestId('active-patient-id')).toHaveTextContent('P-001');

    requestWorkspaceTab('select', tabs[1].key);

    expect(await screen.findByRole('button', { name: '保存して切替' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存して切替' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-patient-id')).toHaveTextContent('P-002');
    });
    expect(screen.queryByRole('button', { name: '保存して切替' })).toBeNull();
  });

  it('workspace tab の保存失敗時は active switch を継続せず guard を残す', async () => {
    soapMockState.saveResult = {
      ok: false,
      message: 'SOAP保存失敗（モック）',
      serverSynced: false,
      localSaved: false,
      error: 'save_failed',
    };
    const tabs = [
      buildEncounterTab({
        patientId: 'P-001',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        encounterKey: 'F001:E100',
        scheduleKey: 'F001:S100',
        name: '患者A',
        department: '内科',
      }),
      buildEncounterTab({
        patientId: 'P-002',
        appointmentId: 'A-002',
        receptionId: 'R-002',
        encounterKey: 'F001:E200',
        scheduleKey: 'F001:S200',
        name: '患者B',
        department: '外科',
      }),
    ];
    seedPatientTabStorage(tabs);
    seedChartsContext();

    renderChartsPage();

    expect(await screen.findByTestId('active-patient-id')).toHaveTextContent('P-001');
    requestWorkspaceTab('select', tabs[1].key);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '保存して切替' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-patient-id')).toHaveTextContent('P-001');
    });
    expect(screen.getByText('SOAP保存失敗（モック）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存して切替' })).toBeInTheDocument();
  });

  it('workspace tab の active close でも保存/破棄/キャンセルの3択を出し、破棄時だけ次タブへ進む', async () => {
    const tabs = [
      buildEncounterTab({
        patientId: 'P-001',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        encounterKey: 'F001:E100',
        scheduleKey: 'F001:S100',
        name: '患者A',
        department: '内科',
      }),
      buildEncounterTab({
        patientId: 'P-002',
        appointmentId: 'A-002',
        receptionId: 'R-002',
        encounterKey: 'F001:E200',
        scheduleKey: 'F001:S200',
        name: '患者B',
        department: '外科',
      }),
    ];
    seedPatientTabStorage(tabs);
    seedChartsContext();

    renderChartsPage();

    expect(await screen.findByTestId('active-patient-id')).toHaveTextContent('P-001');
    requestWorkspaceTab('close', tabs[0].key);

    expect(await screen.findByRole('button', { name: '保存して閉じる' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '破棄して閉じる' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '破棄して閉じる' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-patient-id')).toHaveTextContent('P-002');
    });
  });

  it('bounded prefetch は active を除く直近2タブまでに制限する', async () => {
    soapMockState.dirty = false;
    soapMockState.dirtySources = [];
    soapMockState.serverSynced = true;
    const tabs = [
      buildEncounterTab({
        patientId: 'P-001',
        appointmentId: 'A-001',
        receptionId: 'R-001',
        encounterKey: 'F001:E100',
        scheduleKey: 'F001:S100',
        name: '患者A',
        department: '内科',
        lastActivatedAt: '2026-02-16T09:50:00.000Z',
      }),
      buildEncounterTab({
        patientId: 'P-002',
        appointmentId: 'A-002',
        receptionId: 'R-002',
        encounterKey: 'F001:E200',
        scheduleKey: 'F001:S200',
        name: '患者B',
        department: '外科',
        lastActivatedAt: '2026-02-16T09:40:00.000Z',
      }),
      buildEncounterTab({
        patientId: 'P-003',
        appointmentId: 'A-003',
        receptionId: 'R-003',
        encounterKey: 'F001:E300',
        scheduleKey: 'F001:S300',
        name: '患者C',
        department: '小児科',
        lastActivatedAt: '2026-02-16T09:30:00.000Z',
      }),
      buildEncounterTab({
        patientId: 'P-004',
        appointmentId: 'A-004',
        receptionId: 'R-004',
        encounterKey: 'F001:E400',
        scheduleKey: 'F001:S400',
        name: '患者D',
        department: '皮膚科',
        lastActivatedAt: '2026-02-16T09:20:00.000Z',
      }),
    ];
    seedPatientTabStorage(tabs);
    seedChartsContext();

    renderChartsPage();

    await waitFor(() => {
      expect(fetchCounters.karteId).toBe(3);
    });
    expect(fetchCounters.orderBundles).toBe(3);
    expect(fetchCounters.prescriptionBundles).toBe(3);
    expect(fetchCounters.diagnosisSummary).toBe(3);

    const summaryEncounterKeys = vi
      .mocked(fetchChartsMedicalSummary)
      .mock.calls.map(([, options]) => options?.encounterKey);
    expect(summaryEncounterKeys).toEqual(expect.arrayContaining(['F001:E100', 'F001:E200', 'F001:E300']));
    expect(summaryEncounterKeys).not.toContain('F001:E400');
    expect(vi.mocked(fetchKarteIdByPatientId)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetchOrderBundlesWithPatientImportRecovery)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetchPrescriptionOrderBundlesWithPatientImportRecovery)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetchDiseasesWithPatientImportRecovery)).toHaveBeenCalledTimes(3);
  });

});
