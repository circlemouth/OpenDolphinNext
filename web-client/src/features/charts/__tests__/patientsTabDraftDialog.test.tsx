import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';

import { PatientsTab } from '../PatientsTab';
import type { ReceptionEntry } from '../../reception/api';
import { NavigationGuardProvider } from '../../../routes/NavigationGuardProvider';

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
  ...overrides,
});

const renderTab = (entries: ReceptionEntry[]) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <NavigationGuardProvider>
            <PatientsTab
              entries={entries}
              selectedContext={{
                patientId: entries[0]?.patientId,
                appointmentId: entries[0]?.appointmentId,
                receptionId: entries[0]?.receptionId,
                visitDate: entries[0]?.visitDate,
              }}
              draftDirty
              draftDirtySources={['soap']}
            />
          </NavigationGuardProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe('PatientsTab draft dialog', () => {
  it('shows draft dialog and reason when switching patient with dirty draft', async () => {
    const entries = [
      buildEntry(),
      buildEntry({ id: 'entry-2', patientId: 'P-2', name: '患者B', appointmentId: 'A-2', receptionId: 'R-2' }),
    ];
    renderTab(entries);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /患者B/ }));

    expect(screen.getByRole('alertdialog', { name: '未保存下書きがあります' })).toBeInTheDocument();
    expect(screen.getByText('SOAPドラフトが未保存')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存して切替' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '破棄して切替' })).toBeInTheDocument();
  });
});
