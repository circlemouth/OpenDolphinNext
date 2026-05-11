import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DiagnosisEditPanel } from '../DiagnosisEditPanel';
import { fetchDiseases, mutateOrcaDisease, resolveDiseaseCodeFromOrcaMaster, searchDiseaseMasterCandidates } from '../diseaseApi';

vi.mock('../diseaseApi', async () => {
  const actual = await vi.importActual<typeof import('../diseaseApi')>('../diseaseApi');
  return {
    ...actual,
    fetchDiseases: vi.fn(),
    mutateOrcaDisease: vi.fn(),
    resolveDiseaseCodeFromOrcaMaster: vi.fn(async () => undefined),
    searchDiseaseMasterCandidates: vi.fn(),
  };
});

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

const renderPanel = (visitDate?: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DiagnosisEditPanel
        patientId="P-TEST-001"
        meta={{
          runId: 'RUN-DIAGNOSIS-ORCA-MIRROR',
          cacheHit: true,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          visitDate,
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
        }}
      />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mutateOrcaDisease).mockResolvedValue({ ok: true });
  vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValue(undefined);
  vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('DiagnosisEditPanel ORCA mirror connection', () => {
  it('shows neutral loading copy instead of unavailable copy while ORCA mirror retrieval is pending', async () => {
    vi.mocked(fetchDiseases).mockReturnValueOnce(new Promise(() => undefined));

    renderPanel('2026-05-08');

    expect(screen.getByText('ORCA登録病名を確認中です。確認完了まで病名操作は待機します。')).toBeInTheDocument();
    expect(screen.queryByText(/ORCA病名操作はブロックされています/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。'),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    expect(screen.getByRole('button', { name: '主病名として登録' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '副病名として登録' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '疑い病名として登録' })).toBeDisabled();
  });

  it('passes visit-date baseMonth explicitly to the ORCA mirror read model', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [],
    });

    renderPanel('2026-05-08');

    await waitFor(() => {
      expect(fetchDiseases).toHaveBeenCalledWith({
        patientId: 'P-TEST-001',
        to: '2026-05-08',
        baseMonth: '202605',
      });
    });
  });

  it('shows ORCA registered diagnoses from the connected mirror without auto-authoring local diseases', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [
        {
          diagnosisId: 10,
          diagnosisName: 'ローカル病名',
          diagnosisCode: 'L001',
          startDate: '2026-05-01',
          layer: 'insurance-local',
        },
        {
          diagnosisName: 'ORCA登録済み病名',
          diagnosisCode: '8839001',
          startDate: '2026-05-01',
          layer: 'orca-mirror',
          readOnly: true,
          syncState: 'conflict',
          note: 'ORCA側と差分があります',
          components: [
            {
              seq: 1,
              componentType: 'BODY',
              code: '8839001',
              name: 'ORCA登録済み病名',
            },
          ],
        },
      ],
    });

    renderPanel('2026-05-08');

    const mirrorList = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    expect(within(mirrorList).getByText('ORCA登録済み病名')).toBeInTheDocument();
    expect(within(mirrorList).queryByText('ローカル病名')).not.toBeInTheDocument();
    expect(screen.getByText('ORCA側と差分があります')).toBeInTheDocument();
    expect(screen.queryByText(/まだ接続されていない/)).not.toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
    expect(fetchDiseases).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'P-TEST-001', to: '2026-05-08' }));
  });

  it('shows a connected empty mirror as no ORCA registered diagnoses', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [],
    });

    renderPanel('2026-05-08');

    expect(await screen.findByText('ORCAに登録済みの病名はありません。')).toBeInTheDocument();
    expect(screen.queryByText(/まだ接続されていない/)).not.toBeInTheDocument();
  });

  it('shows only safe copy and disables ORCA mutation when ORCA mirror retrieval is unavailable', async () => {
    vi.mocked(fetchDiseases).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'unavailable',
      message: 'https://orca.internal.example/raw',
      diseases: [],
    });

    renderPanel();

    expect(
      await screen.findByText('ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/orca\.internal\.example/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const mainButton = screen.getByRole('button', { name: '主病名として登録' });
    expect(mainButton).not.toBeDisabled();
    expect(mainButton).toHaveAttribute('aria-disabled', 'true');
    expect(mainButton).toHaveAttribute('aria-describedby', 'diagnosis-mutation-block-reason');
    await userEvent.click(mainButton);
    expect(screen.getByText(/ORCA病名操作を停止: ORCA病名を取得できません。/)).toBeInTheDocument();
    expect(mutateOrcaDisease).not.toHaveBeenCalled();
  });

  it('sends ORCA disease create only after explicit confirmation and does not call local diagnosis mutation', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDiseases).mockResolvedValue({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [],
    });

    renderPanel('2026-05-08');

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: 'HTN' } });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839001');
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '副病名として登録の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: '副病名として登録' }));

    await waitFor(() => {
      expect(mutateOrcaDisease).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create',
          patientId: 'P-TEST-001',
          performDate: '2026-05-08',
          departmentCode: '01',
          diseaseInformation: [
            expect.objectContaining({
              diseaseName: 'HTN',
              diseaseCode: '8839001',
              diseaseStartDate: expect.any(String),
              components: [
                expect.objectContaining({
                  seq: 1,
                  componentType: 'BODY',
                  code: '8839001',
                  name: 'HTN',
                }),
              ],
            }),
          ],
        }),
      );
    });
    expect(mutateOrcaDisease).not.toHaveBeenCalledWith(expect.objectContaining({ requestNumber: expect.anything() }));
  });

  it('updates the ORCA registered list from the post-mutation mirror instead of optimistic input state', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDiseases).mockResolvedValue({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [],
    });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839001');
    vi.mocked(mutateOrcaDisease).mockResolvedValueOnce({
      ok: true,
      businessAccepted: true,
      runId: 'RUN-POST-MUTATION-MIRROR',
      postMutationMirrorStatus: 'connected',
      postMutationMirror: {
        ok: true,
        patientId: 'P-TEST-001',
        karteId: 1001,
        orcaMirrorStatus: 'connected',
        diseases: [
          {
            diagnosisId: 77,
            diagnosisName: 'ORCA再取得病名',
            diagnosisCode: '8839001',
            startDate: '2026-05-08',
            layer: 'orca-mirror',
            readOnly: true,
            components: [{ seq: 1, componentType: 'BODY', code: '8839001', name: 'ORCA再取得病名' }],
          },
        ],
      },
    });

    renderPanel('2026-05-08');

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: '入力病名' } });
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '副病名として登録の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: '副病名として登録' }));

    const mirrorList = await screen.findByRole('table', { name: 'ORCA登録病名（活動中）' });
    expect(within(mirrorList).getByText('ORCA再取得病名')).toBeInTheDocument();
    expect(within(mirrorList).queryByText('入力病名')).not.toBeInTheDocument();
    expect(screen.getByText('ORCA病名を処理しました。ORCA再取得結果で同期確認しました。')).toBeInTheDocument();
    expect(fetchDiseases).toHaveBeenCalledTimes(1);
  });

  it('keeps the old mirror and shows review copy when post-mutation mirror retrieval is unavailable', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDiseases).mockResolvedValue({
      ok: true,
      patientId: 'P-TEST-001',
      karteId: 1001,
      orcaMirrorStatus: 'connected',
      diseases: [],
    });
    vi.mocked(resolveDiseaseCodeFromOrcaMaster).mockResolvedValueOnce('8839001');
    vi.mocked(mutateOrcaDisease).mockResolvedValueOnce({
      ok: false,
      businessAccepted: true,
      needsUserReview: true,
      operationStatus: 'NEEDS_REVIEW',
      runId: 'RUN-POST-MUTATION-MIRROR-UNAVAILABLE',
      postMutationMirrorStatus: 'unavailable',
      message: 'ORCA病名の送信は受け付けられましたが、ORCA病名の再取得が完了していません。ORCA正本を再取得して確認してください。',
    });

    renderPanel('2026-05-08');

    await user.click(screen.getByText('ORCAへ病名登録', { selector: 'summary span' }));
    const authoring = screen.getByLabelText('ORCAへ病名登録');
    fireEvent.change(within(authoring).getByLabelText('病名 *'), { target: { value: '再取得未確認病名' } });
    await user.click(within(authoring).getByRole('button', { name: '副病名として登録' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: '副病名として登録の確認' });
    await user.click(within(confirmDialog).getByRole('button', { name: '副病名として登録' }));

    expect(
      await screen.findByText('ORCA病名の送信は受け付けられましたが、ORCA病名の再取得が完了していません。ORCA正本を再取得して確認してください。'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'ORCA登録病名（活動中）' })).not.toBeInTheDocument();
    expect(screen.queryByText('再取得未確認病名')).not.toBeInTheDocument();
    expect(fetchDiseases).toHaveBeenCalledTimes(1);
  });
});
