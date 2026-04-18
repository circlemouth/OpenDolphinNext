import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { DocumentTimeline } from '../DocumentTimeline';
import { AppToastProvider } from '../../../libs/ui/appToast';

const { getOrcaClaimSendEntryForRowMock } = vi.hoisted(() => ({
  getOrcaClaimSendEntryForRowMock: vi.fn(),
}));

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

const defaultFlags = {
  runId: 'RUN-DOC',
  missingMaster: true,
  cacheHit: false,
  dataSourceTransition: 'server',
  fallbackUsed: false,
};
let mockFlags = { ...defaultFlags };
let mockSession: { role?: string } | null = { role: 'system_admin' };

vi.mock('../authService', () => ({
  useAuthService: () => ({
    flags: mockFlags,
  }),
}));

vi.mock('../../../AppRouter', () => ({
  useOptionalSession: () => mockSession,
}));

vi.mock('../../../libs/ui/appToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../libs/ui/appToast')>();
  return {
    ...actual,
    useAppToast: () => ({ enqueue: vi.fn(), dismiss: vi.fn() }),
  };
});

vi.mock('../orcaClaimSendCache', async () => {
  const actual = await vi.importActual<typeof import('../orcaClaimSendCache')>('../orcaClaimSendCache');
  return {
    ...actual,
    getOrcaClaimSendEntryForRow: getOrcaClaimSendEntryForRowMock,
  };
});

describe('DocumentTimeline recovery order', () => {
  beforeEach(() => {
    mockFlags = { ...defaultFlags };
    mockSession = { role: 'system_admin' };
    getOrcaClaimSendEntryForRowMock.mockReset();
    getOrcaClaimSendEntryForRowMock.mockReturnValue(null);
  });

  it('renders alert -> banner -> details in order', () => {
    mockFlags = { ...defaultFlags, missingMaster: true };
    const { container } = render(
      <AppToastProvider value={{ enqueue: vi.fn(), dismiss: vi.fn() }}>
        <DocumentTimeline claimData={{ missingMaster: true } as any} />
      </AppToastProvider>,
    );

    const alert = container.querySelector('.document-timeline__alert');
    const banner = container.querySelector('.tone-banner');
    const details = container.querySelector('.document-timeline__controls');

    expect(alert).toBeTruthy();
    expect(banner).toBeTruthy();
    expect(details).toBeTruthy();
    if (!alert || !banner || !details) return;

    expect(alert.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('admin かつ retrySupported=true のときだけ再送 CTA を表示する', () => {
    mockFlags = { ...defaultFlags, missingMaster: false, cacheHit: true, fallbackUsed: false };
    render(
      <AppToastProvider value={{ enqueue: vi.fn(), dismiss: vi.fn() }}>
        <DocumentTimeline
          entries={[
            {
              id: 'entry-1',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentTime: '09:00',
              status: '診療中',
              source: 'visits',
            },
          ]}
          selectedPatientId="P-1"
          orcaQueue={{
            retrySupported: true,
            ok: true,
            status: 200,
            queue: [
              {
                patientId: 'P-1',
                status: 'failed',
                error: 'send failed',
                lastDispatchAt: '2026-01-29T00:00:00Z',
              },
            ],
          }}
        />
      </AppToastProvider>,
    );

    const buttons = screen.getAllByRole('button', { name: 'ORCA再送を試行' });
    expect(buttons).toHaveLength(1);
  });

  it('非 admin では再送 CTA を表示しない', () => {
    mockFlags = { ...defaultFlags, missingMaster: false, cacheHit: true, fallbackUsed: false };
    mockSession = { role: 'doctor' };
    render(
      <AppToastProvider value={{ enqueue: vi.fn(), dismiss: vi.fn() }}>
        <DocumentTimeline
          entries={[
            {
              id: 'entry-1',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentTime: '09:00',
              status: '診療中',
              source: 'visits',
            },
          ]}
          selectedPatientId="P-1"
          orcaQueue={{
            retrySupported: true,
            ok: true,
            status: 200,
            queue: [{ patientId: 'P-1', status: 'failed', error: 'send failed', lastDispatchAt: '2026-01-29T00:00:00Z' }],
          }}
        />
      </AppToastProvider>,
    );

    expect(screen.queryByRole('button', { name: 'ORCA再送を試行' })).toBeNull();
  });

  it('retrySupported=false では再送 CTA を表示しない', () => {
    mockFlags = { ...defaultFlags, missingMaster: false, cacheHit: true, fallbackUsed: false };
    render(
      <AppToastProvider value={{ enqueue: vi.fn(), dismiss: vi.fn() }}>
        <DocumentTimeline
          entries={[
            {
              id: 'entry-1',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentTime: '09:00',
              status: '診療中',
              source: 'visits',
            },
          ]}
          selectedPatientId="P-1"
          orcaQueue={{
            retrySupported: false,
            ok: true,
            status: 200,
            queue: [{ patientId: 'P-1', status: 'failed', error: 'send failed', lastDispatchAt: '2026-01-29T00:00:00Z' }],
          }}
        />
      </AppToastProvider>,
    );

    expect(screen.queryByRole('button', { name: 'ORCA再送を試行' })).toBeNull();
  });

  it('same-day 別 reception 選択時は row-local key が無い限り送信IDを current entry に貼らない', () => {
    render(
      <AppToastProvider value={{ enqueue: vi.fn(), dismiss: vi.fn() }}>
        <DocumentTimeline
          entries={[
            {
              id: 'entry-1',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentId: 'A-1',
              receptionId: 'R-1',
              scheduleKey: 'SCH-1',
              encounterKey: 'ENC-1',
              appointmentTime: '09:00',
              status: '診療中',
              source: 'visits',
            },
            {
              id: 'entry-2',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentId: 'A-2',
              receptionId: 'R-2',
              scheduleKey: 'SCH-2',
              encounterKey: 'ENC-2',
              appointmentTime: '09:30',
              status: '診療中',
              source: 'visits',
            },
          ]}
          selectedAppointmentId="A-2"
          selectedReceptionId="R-2"
        />
      </AppToastProvider>,
    );

    expect(getOrcaClaimSendEntryForRowMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        patientId: 'P-1',
        appointmentId: 'A-2',
        receptionId: 'R-2',
        scheduleKey: 'SCH-2',
        encounterKey: 'ENC-2',
      }),
    );
    expect(screen.queryByText(/送信ID:/)).not.toBeInTheDocument();
  });

  it('same-day 別 encounter の claim bundle は patientId fallback で current row に貼らない', () => {
    const { container } = render(
      <AppToastProvider value={{ enqueue: vi.fn(), dismiss: vi.fn() }}>
        <DocumentTimeline
          entries={[
            {
              id: 'entry-1',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentId: 'A-1',
              receptionId: 'R-1',
              appointmentTime: '09:00',
              status: '診療中',
              source: 'visits',
            },
            {
              id: 'entry-2',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentId: 'A-2',
              receptionId: 'R-2',
              appointmentTime: '09:30',
              status: '診療中',
              source: 'visits',
            },
          ]}
          selectedAppointmentId="A-2"
          selectedReceptionId="R-2"
          claimData={{
            bundles: [
              {
                patientId: 'P-1',
                appointmentId: 'A-1',
                invoiceNumber: 'INV-OTHER',
                claimStatus: '会計待ち',
                claimStatusText: '別 encounter',
              },
            ],
          } as any}
        />
      </AppToastProvider>,
    );

    const currentRow = Array.from(container.querySelectorAll('article')).find((article) =>
      article.textContent?.includes('受付ID: R-2'),
    );
    expect(currentRow).toBeTruthy();
    if (!currentRow) return;
    expect(within(currentRow).queryByText(/Invoice_Number: INV-OTHER/)).not.toBeInTheDocument();
  });

  it('same-day 複数 row の patient-level queue status は positive send badge に使わない', () => {
    render(
      <AppToastProvider value={{ enqueue: vi.fn(), dismiss: vi.fn() }}>
        <DocumentTimeline
          entries={[
            {
              id: 'entry-1',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentId: 'A-1',
              receptionId: 'R-1',
              appointmentTime: '09:00',
              status: '診療中',
              source: 'visits',
            },
            {
              id: 'entry-2',
              patientId: 'P-1',
              name: 'テスト患者',
              appointmentId: 'A-2',
              receptionId: 'R-2',
              appointmentTime: '09:30',
              status: '診療中',
              source: 'visits',
            },
          ]}
          selectedAppointmentId="A-2"
          selectedReceptionId="R-2"
          orcaQueue={{
            retrySupported: true,
            ok: true,
            status: 200,
            queue: [{ patientId: 'P-1', status: 'delivered', lastDispatchAt: '2026-01-29T00:00:00Z' }],
          }}
        />
      </AppToastProvider>,
    );

    expect(screen.queryByText('送信:成功')).not.toBeInTheDocument();
  });
});
