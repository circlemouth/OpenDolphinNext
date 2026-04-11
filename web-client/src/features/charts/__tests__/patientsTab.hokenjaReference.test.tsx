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

const renderTab = (entries: ReceptionEntry[]) => {
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
          />
        </NavigationGuardProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PatientsTab hokenja reference', () => {
  it('insurance card から保険者参照 dialog を開ける', async () => {
    renderTab([buildEntry()]);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保険者を参照' }));

    expect(screen.getByRole('dialog', { name: '保険者参照' })).toBeInTheDocument();
  });

  it('insurance card から Patients deeplink を消し basic card には残す', () => {
    renderTab([buildEntry()]);

    expect(screen.queryByRole('button', { name: '保険を編集（Charts）' })).not.toBeInTheDocument();

    const basicHeading = screen.getByRole('heading', { name: '基本情報（閲覧）' });
    const basicCard = basicHeading.closest('.patients-tab__card');
    expect(basicCard).not.toBeNull();
    expect(within(basicCard as HTMLElement).getByRole('button', { name: 'Patients で開く' })).toBeInTheDocument();

    const insuranceHeading = screen.getByRole('heading', { name: '保険・公費（閲覧）' });
    const insuranceCard = insuranceHeading.closest('.patients-tab__card');
    expect(insuranceCard).not.toBeNull();
    expect(within(insuranceCard as HTMLElement).queryByRole('button', { name: 'Patients で開く' })).toBeNull();
  });
});
