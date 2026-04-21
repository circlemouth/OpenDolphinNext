import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { SoapNotePanel } from '../SoapNotePanel';
import type { SoapEntry } from '../soapNote';
import { DiagnosisEditPanel } from '../DiagnosisEditPanel';
import type { DiagnosisEditPanelMeta } from '../DiagnosisEditPanel';
import { fetchDiseases, mutateDiseases, searchDiseaseMasterCandidates } from '../diseaseApi';
import { DocumentCreatePanel } from '../DocumentCreatePanel';
import { fetchKarteIdByPatientId, fetchLetterDetail, fetchLetterList, saveLetterModule, deleteLetter } from '../letterApi';
import { AUTH_SESSION_STORAGE_KEY } from '../../../libs/session/authStorage';

vi.mock('../diseaseApi', async () => {
  const actual = await vi.importActual<typeof import('../diseaseApi')>('../diseaseApi');
  return {
    ...actual,
    fetchDiseases: vi.fn(),
    mutateDiseases: vi.fn(),
    resolveDiseaseCodeFromOrcaMaster: vi.fn(async () => undefined),
    searchDiseaseMasterCandidates: vi.fn(),
  };
});

vi.mock('../letterApi', () => ({
  fetchKarteIdByPatientId: vi.fn(),
  fetchLetterList: vi.fn(),
  fetchLetterDetail: vi.fn(),
  saveLetterModule: vi.fn(),
  deleteLetter: vi.fn(),
}));

vi.mock('../audit', () => ({
  recordChartsAuditEvent: vi.fn(),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/0001/charts',
    currentScreen: 'charts',
    fromCandidate: null,
    returnToCandidate: null,
    safeReturnToCandidate: null,
    carryover: {},
    external: {},
    encounter: {},
    openReception: vi.fn(),
    openPatients: vi.fn(),
    openCharts: vi.fn(),
    openOrderSets: vi.fn(),
    openPrintOutpatient: vi.fn(),
    openPrintDocument: vi.fn(),
    openMobileImages: vi.fn(),
  }),
}));

vi.mock('../../images/api', async () => {
  const actual = await vi.importActual<typeof import('../../images/api')>('../../images/api');
  return {
    ...actual,
    sendKarteDocumentWithAttachments: vi.fn(),
  };
});

const renderWithQueryClient = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const baseSoapHistory: SoapEntry[] = [
  {
    id: 'soap-subjective',
    section: 'subjective',
    body: '主訴あり',
    authoredAt: '2026-04-21T09:00:00+09:00',
    authorRole: 'doctor',
    authorName: 'Dr. DADS',
    action: 'save',
    patientId: 'P-DADS-001',
    appointmentId: 'APT-DADS-001',
    receptionId: 'RCP-DADS-001',
    visitDate: '2026-04-21',
  },
];

const baseDiagnosisMeta: DiagnosisEditPanelMeta = {
  runId: '20260421T044925Z',
  cacheHit: true,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server' as const,
  patientId: 'P-DADS-001',
  visitDate: '2026-04-21',
};

const renderDiagnosisPanel = (meta: DiagnosisEditPanelMeta = baseDiagnosisMeta) =>
  renderWithQueryClient(<DiagnosisEditPanel patientId="P-DADS-001" meta={meta} />);

const baseDocumentProps = {
  patientId: 'P-DADS-001',
  meta: {
    runId: '20260421T044925Z',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
    patientId: 'P-DADS-001',
    visitDate: '2026-04-21',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('devFacilityId', '0001');
  localStorage.setItem('devUserId', 'doctor01');
  sessionStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      facilityId: '0001',
      userId: 'doctor01',
      userPk: 101,
      role: 'doctor',
      runId: '20260421T044925Z',
      clientUuid: 'client-dads',
    }),
  );
  vi.mocked(fetchDiseases).mockResolvedValue({
    ok: true,
    patientId: 'P-DADS-001',
    karteId: 2201,
    diseases: [
      {
        diagnosisId: 1,
        diagnosisName: '糖尿病',
        diagnosisCode: 'E11.9',
        startDate: '2026-04-01',
        outcome: '継続',
        layer: 'insurance-local',
        category: '主病名',
      },
      {
        diagnosisId: 2,
        diagnosisName: '胃炎',
        diagnosisCode: 'K29.7',
        startDate: '2026-03-01',
        endDate: '2026-04-01',
        outcome: '治癒',
        layer: 'insurance-local',
        category: '副病名',
      },
      {
        diagnosisId: 3,
        diagnosisName: '高血圧症',
        diagnosisCode: 'I10',
        startDate: '2026-04-02',
        layer: 'orca-mirror',
        readOnly: true,
      },
    ],
  });
  vi.mocked(mutateDiseases).mockResolvedValue({ ok: true, runId: 'RUN-DADS-DISEASE' });
  vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([]);
  vi.mocked(fetchKarteIdByPatientId).mockResolvedValue({ ok: true, karteId: 3201 });
  vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [] });
  vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true });
  vi.mocked(saveLetterModule).mockResolvedValue({ ok: true, letterId: 1 });
  vi.mocked(deleteLetter).mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe('DADS clinical input contract - SOAP', () => {
  it('read-only SOAP controls expose a visible disabling reason instead of title-only guidance', () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={baseSoapHistory}
        meta={{
          runId: '20260421T044925Z',
          patientId: 'P-DADS-001',
          appointmentId: 'APT-DADS-001',
          receptionId: 'RCP-DADS-001',
          visitDate: '2026-04-21',
        }}
        author={{ role: 'doctor', displayName: 'Dr. DADS', userId: 'doctor01' }}
        readOnly
        readOnlyReason="別端末で編集中のため編集できません。"
        orderBundles={[]}
      />,
    );

    const panel = screen.getByLabelText('SOAP 記載');
    expect(within(panel).getByText('読み取り専用: 別端末で編集中のため編集できません。')).toBeVisible();
    expect(within(panel).getByText('保存済')).toBeVisible();
    for (const label of ['Free', 'Subjective', 'Objective', 'Assessment', 'Plan']) {
      expect(within(panel).getByText(label)).toBeVisible();
    }
    expect(within(panel).getByRole('button', { name: 'テンプレ' })).toBeDisabled();
    expect(within(panel).getByRole('button', { name: '更新' })).toBeDisabled();
  });
});

describe('DADS clinical input contract - disease', () => {
  it('keeps clinically important diagnosis state visible in active disease rows', async () => {
    renderDiagnosisPanel();

    const activeList = await screen.findByRole('list', { name: '保険病名（活動中）' });
    expect(within(activeList).getByText('糖尿病')).toBeVisible();
    expect(within(activeList).getByText('主')).toBeVisible();
    expect(within(activeList).getByText('開始:2026-04-01')).toBeVisible();
    expect(within(activeList).getByText('転帰:継続')).toBeVisible();
    expect(within(activeList).getByText('終了:—')).toBeVisible();
    expect(within(activeList).getByText('コードあり')).toBeVisible();
    expect(screen.getByText('参照専用。保険病名へ自動反映しません。')).toBeVisible();

    const quickStartDate = screen.getByLabelText('開始日');
    expect(quickStartDate).toHaveAttribute('type', 'date');
    expect(quickStartDate).not.toHaveAttribute('placeholder');
  });

  it('shows a visible reason and enabling direction when disease editing is blocked', async () => {
    renderDiagnosisPanel({
      ...baseDiagnosisMeta,
      readOnly: true,
      readOnlyReason: 'DADS contract test: 権限がないため編集できません。',
    });

    expect(await screen.findByText(/編集はブロックされています: DADS contract test: 権限がないため編集できません。/)).toBeVisible();
    expect(screen.getByText('閲覧専用を解除するには、タブロック解除または権限設定を確認してください。')).toBeVisible();
    expect(screen.getByRole('button', { name: '詳細入力' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '保険病名に追加' })).toBeDisabled();
  });
});

describe('DADS clinical input contract - document', () => {
  it('exposes document labels and concrete ordinary validation text for the current referral form', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseDocumentProps} />
      </MemoryRouter>,
    );

    expect(screen.getByText('文書作成メニュー')).toBeVisible();
    expect(screen.getByText('宛先・目的・診断名を入力して保存します。')).toBeVisible();
    expect(screen.getByLabelText('テンプレート *')).toBeVisible();
    expect(screen.getByLabelText('宛先医療機関 *')).toBeVisible();
    expect(screen.getByLabelText('宛先医師 *')).toBeVisible();
    expect(screen.getByLabelText('紹介目的 *')).toBeVisible();
    expect(screen.getByLabelText('主病名 *')).toBeVisible();
    expect(screen.getByLabelText('紹介内容 *')).toBeVisible();

    const issuedAt = screen.getByLabelText('発行日 *');
    expect(issuedAt).toHaveAttribute('type', 'date');
    expect(issuedAt).not.toHaveAttribute('placeholder');

    await user.click(screen.getByRole('button', { name: '保存' }));

    const error = screen.getByText(/必須項目が未入力です: テンプレート、宛先医療機関、宛先医師、紹介目的、主病名、紹介内容/);
    expect(error).toBeVisible();
  });
});
