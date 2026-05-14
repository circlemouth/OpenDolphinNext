import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { NavigationGuardProvider } from '../../../routes/NavigationGuardProvider';
import { PatientsTab } from '../PatientsTab';
import type { ReceptionEntry } from '../../reception/api';

const session = {
  facilityId: 'FAC-1',
  userId: 'user-1',
  role: 'doctor',
};

const flags = {
  runId: 'RUN-TEST',
  missingMaster: false,
  cacheHit: false,
  dataSourceTransition: 'server',
  fallbackUsed: false,
};

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

vi.mock('../authService', () => ({
  useAuthService: () => ({ flags }),
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => session,
}));

vi.mock('../../patients/api', () => ({
  searchLocalPatients: vi.fn(async () => ({ patients: [] })),
}));

vi.mock('../audit', () => ({
  recordChartsAuditEvent: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logUiState: vi.fn(),
  getAuditEventLog: () => [],
  logAuditEvent: vi.fn(),
}));

const buildEntry = (overrides: Partial<ReceptionEntry> = {}): ReceptionEntry => ({
  id: 'entry-1',
  patientId: 'P-1',
  name: '患者A',
  status: '診療中',
  source: 'visits',
  appointmentId: 'A-1',
  receptionId: 'R-1',
  visitDate: '2026-01-30',
  appointmentTime: '09:00',
  ...overrides,
});

const renderTab = (entries: ReceptionEntry[], options: { draftDirty?: boolean; onSelectEncounter?: (context?: any) => void } = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const current = entries[0];
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NavigationGuardProvider>
          <PatientsTab
            entries={entries}
            selectedContext={{
              patientId: current?.patientId,
              appointmentId: current?.appointmentId,
              receptionId: current?.receptionId,
              visitDate: current?.visitDate,
            }}
            draftDirty={options.draftDirty ?? false}
            onSelectEncounter={options.onSelectEncounter}
          />
        </NavigationGuardProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PatientsTab filtering and confirm', () => {
  it('keeps current patient fixed when filtering candidates', async () => {
    const entries = [
      buildEntry(),
      buildEntry({ id: 'entry-2', patientId: 'P-2', name: '患者B', appointmentId: 'A-2', receptionId: 'R-2', appointmentTime: '10:00' }),
    ];
    renderTab(entries);

    const user = userEvent.setup();
    const important = screen.getByRole('button', { name: '患者基本情報へ移動' });
    expect(within(important).getByText('患者A')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: '患者検索キーワード' }), '患者B');

    expect(screen.getByText('現在の患者は検索結果に含まれていません（フィルタ中）')).toBeInTheDocument();
    expect(within(important).getByText('患者A')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '検索をクリア' }));
    expect(screen.queryByText('現在の患者は検索結果に含まれていません（フィルタ中）')).not.toBeInTheDocument();
  });

  it('shows FocusTrapDialog confirm when switching to another patient (no window.confirm)', async () => {
    const entries = [
      buildEntry(),
      buildEntry({ id: 'entry-2', patientId: 'P-2', name: '患者B', appointmentId: 'A-2', receptionId: 'R-2', appointmentTime: '10:00' }),
    ];
    const onSelectEncounter = vi.fn();
    renderTab(entries, { onSelectEncounter });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /患者B/ }));

    const dialog = screen.getByRole('alertdialog', { name: '患者切替の確認' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: '患者切替の未保存影響' })).toHaveTextContent(
      '未保存下書きがある場合はこの確認へ進まず',
    );
    expect(within(dialog).getByText('現在の患者')).toBeInTheDocument();
    expect(within(dialog).getByText('切替先')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '切り替える' }));

    expect(onSelectEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'P-2',
        appointmentId: 'A-2',
        receptionId: 'R-2',
      }),
    );
  });
});
