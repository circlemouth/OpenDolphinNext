import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DiagnosisEditPanel } from '../DiagnosisEditPanel';
import { fetchDiseases, mutateDiseases, searchDiseaseMasterCandidates } from '../diseaseApi';

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

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DiagnosisEditPanel
        patientId="P-TEST-001"
        meta={{
          runId: 'RUN-DIAGNOSIS-PANEL-TEST',
          cacheHit: true,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
        }}
      />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDiseases).mockResolvedValue({
    ok: true,
    patientId: 'P-TEST-001',
    karteId: 1001,
    diseases: [
      {
        diagnosisId: 1,
        diagnosisName: '脂質異常症',
        diagnosisCode: 'E78.5',
        startDate: '2026-04-01',
        layer: 'insurance-local',
      },
      {
        diagnosisId: 2,
        diagnosisName: '高血圧症',
        diagnosisCode: 'I10',
        startDate: '2026-04-02',
        layer: 'orca-mirror',
        readOnly: true,
        syncState: 'conflict',
        note: 'ORCA側と差分があります',
      },
    ],
  });
  vi.mocked(mutateDiseases).mockResolvedValue({
    ok: true,
    runId: 'RUN-MUTATION',
    createdDiagnosisIds: [101],
  });
  vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('DiagnosisEditPanel quick add candidates', () => {
  it('候補プルダウン選択で病名とコードを反映して登録できる', async () => {
    const user = userEvent.setup();
    vi.mocked(searchDiseaseMasterCandidates).mockImplementation(async ({ keyword }) => {
      if (keyword.trim() === '高血') {
        return [{ name: '高血圧症', code: '8839001', icdTen: 'I10' }];
      }
      return [];
    });

    renderPanel();

    expect(await screen.findAllByText('保険病名')).not.toHaveLength(0);
    expect(screen.getByText('ORCA mirror')).toBeInTheDocument();
    expect(screen.getByText('候補')).toBeInTheDocument();
    expect(await screen.findByText('保険病名の確認が必要です')).toBeInTheDocument();
    expect(screen.getByText('clinical source が未実装のため、この画面では保険病名だけを扱います。')).toBeInTheDocument();
    expect(await screen.findByText('ORCA側と差分があります')).toBeInTheDocument();
    expect(await screen.findByText('高血圧症')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('病名 *');
    await user.type(nameInput, '高血');

    await waitFor(() => {
      expect(searchDiseaseMasterCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: '高血',
        }),
      );
    });

    const candidateSelect = await screen.findByLabelText('病名候補');
    await waitFor(() => expect(candidateSelect).not.toBeDisabled());
    const option = Array.from((candidateSelect as HTMLSelectElement).options).find((item) => item.text.includes('高血圧症'));
    expect(option?.value).toBeTruthy();

    await user.selectOptions(candidateSelect, option?.value ?? '');

    expect((screen.getByLabelText('病名 *') as HTMLInputElement).value).toBe('高血圧症');
    expect((screen.getByLabelText(/コード/) as HTMLInputElement).value).toBe('I10');
    expect(screen.getByText('同期候補があります')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保険病名に追加' }));

    await waitFor(() => {
        expect(mutateDiseases).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'P-TEST-001',
          karteId: 1001,
          operations: [
            expect.objectContaining({
              operation: 'create',
              diagnosisName: '高血圧症',
              diagnosisCode: 'I10',
            }),
          ],
        }),
      );
    });
  });

  it('追加成功後にサーバー再取得結果の日付・転帰・主病名・疑いを一覧と編集ダイアログへ反映する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDiseases)
      .mockResolvedValueOnce({
        ok: true,
        patientId: 'P-TEST-001',
        karteId: 1001,
        diseases: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        patientId: 'P-TEST-001',
        karteId: 1001,
        diseases: [
          {
            diagnosisId: 101,
            diagnosisName: '主病名テスト',
            diagnosisCode: 'I10',
            startDate: '2026-04-10',
            endDate: '2026-04-20',
            outcome: '治癒',
            category: '主病名',
            suspectedFlag: '疑い',
            layer: 'insurance-local',
          },
        ],
      });

    renderPanel();

    await screen.findByText('保険病名が未登録です。');
    await user.click(screen.getByRole('button', { name: '詳細入力' }));
    const createDialog = await screen.findByRole('dialog', { name: '病名の追加' });
    await user.type(within(createDialog).getByLabelText('病名 *'), '主病名テスト');
    await user.click(within(createDialog).getByLabelText('主病名'));
    await user.click(within(createDialog).getByLabelText('疑い'));
    await user.click(within(createDialog).getByText('詳細（コード/開始/転帰）'));
    await user.clear(within(createDialog).getByLabelText(/開始日/));
    await user.type(within(createDialog).getByLabelText(/開始日/), '2026-04-10');
    await user.type(within(createDialog).getByLabelText(/転帰日/), '2026-04-20');
    await user.type(within(createDialog).getByLabelText(/転帰 ※任意/), '治癒');
    await user.click(within(createDialog).getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(mutateDiseases).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: [
            expect.objectContaining({
              operation: 'create',
              diagnosisName: '主病名テスト',
              startDate: '2026-04-10',
              endDate: '2026-04-20',
              outcome: '治癒',
              category: '主病名',
              suspectedFlag: '疑い',
            }),
          ],
        }),
      );
    });
    await waitFor(() => expect(fetchDiseases).toHaveBeenCalledTimes(2));

    const rowName = await screen.findByText('主病名テスト');
    const row = rowName.closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('開始:2026-04-10')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('転帰:治癒')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('終了:2026-04-20')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('主')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('疑い')).toBeInTheDocument();

    await user.click(within(createDialog).getByRole('button', { name: '閉じる' }));
    await user.click(within(row as HTMLElement).getByRole('button', { name: '編集' }));
    const editDialog = await screen.findByRole('dialog', { name: '病名の編集' });
    expect(within(editDialog).getByLabelText('主病名')).toBeChecked();
    expect(within(editDialog).getByLabelText('疑い')).toBeChecked();
    await user.click(within(editDialog).getByText('詳細（コード/開始/転帰）'));
    expect(within(editDialog).getByLabelText(/開始日/)).toHaveValue('2026-04-10');
    expect(within(editDialog).getByLabelText(/転帰日/)).toHaveValue('2026-04-20');
    expect(within(editDialog).getByLabelText(/転帰 ※任意/)).toHaveValue('治癒');
  });

  it('削除成功後にサーバー再取得結果で一覧から消える', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDiseases)
      .mockResolvedValueOnce({
        ok: true,
        patientId: 'P-TEST-001',
        karteId: 1001,
        diseases: [
          {
            diagnosisId: 10,
            diagnosisName: '削除対象病名',
            startDate: '2026-04-10',
            layer: 'insurance-local',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        patientId: 'P-TEST-001',
        karteId: 1001,
        diseases: [],
      });

    renderPanel();

    const rowName = await screen.findByText('削除対象病名');
    const row = rowName.closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(mutateDiseases).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: [
            expect.objectContaining({
              operation: 'delete',
              diagnosisId: 10,
            }),
          ],
        }),
      );
    });
    await screen.findByText('保険病名が未登録です。');
    expect(screen.queryByText('削除対象病名')).not.toBeInTheDocument();
  });

  it('ORCA mirror は編集・削除ボタンを表示せず参照専用に留める', async () => {
    renderPanel();

    await screen.findByText('高血圧症');
    const mirrorList = screen.getByRole('list', { name: 'ORCA mirror' });
    expect(within(mirrorList).getByText('高血圧症')).toBeInTheDocument();
    expect(within(mirrorList).queryByRole('button', { name: '編集' })).not.toBeInTheDocument();
    expect(within(mirrorList).queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
  });

  it('候補は選択だけでは保存せず明示追加でのみ local mutation する', async () => {
    const user = userEvent.setup();
    vi.mocked(searchDiseaseMasterCandidates).mockResolvedValue([{ name: '候補病名', code: '8830001', icdTen: 'I10' }]);

    renderPanel();

    await user.type(screen.getByLabelText('病名 *'), '候補');
    const candidateSelect = await screen.findByLabelText('病名候補');
    await waitFor(() => expect(candidateSelect).not.toBeDisabled());
    const option = Array.from((candidateSelect as HTMLSelectElement).options).find((item) => item.text.includes('候補病名'));
    await user.selectOptions(candidateSelect, option?.value ?? '');

    expect(mutateDiseases).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '保険病名に追加' }));
    await waitFor(() => expect(mutateDiseases).toHaveBeenCalledTimes(1));
  });

  it('転帰日が開始日前の場合は通信前に具体エラーを表示する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await screen.findAllByText('保険病名');
    await user.click(screen.getByRole('button', { name: '詳細入力' }));
    const dialog = await screen.findByRole('dialog', { name: '病名の追加' });
    await user.type(within(dialog).getByLabelText('病名 *'), '逆転日付');
    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    await user.clear(within(dialog).getByLabelText(/開始日/));
    await user.type(within(dialog).getByLabelText(/開始日/), '2026-04-20');
    await user.type(within(dialog).getByLabelText(/転帰日/), '2026-04-10');
    await user.click(within(dialog).getByRole('button', { name: '追加' }));

    expect(await within(dialog).findByText('転帰日は開始日以降の日付を入力してください。')).toBeInTheDocument();
    expect(mutateDiseases).not.toHaveBeenCalled();
  });

  it('未知の転帰は通信前に具体エラーを表示する', async () => {
    const user = userEvent.setup();

    renderPanel();

    await screen.findAllByText('保険病名');
    await user.click(screen.getByRole('button', { name: '詳細入力' }));
    const dialog = await screen.findByRole('dialog', { name: '病名の追加' });
    await user.type(within(dialog).getByLabelText('病名 *'), '未知転帰');
    await user.click(within(dialog).getByText('詳細（コード/開始/転帰）'));
    await user.type(within(dialog).getByLabelText(/転帰 ※任意/), '想定外の転帰');
    await user.click(within(dialog).getByRole('button', { name: '追加' }));

    expect(await within(dialog).findByText('転帰は 継続、治癒、中止、再発、死亡、転院、不明 のいずれかを入力してください。')).toBeInTheDocument();
    expect(mutateDiseases).not.toHaveBeenCalled();
  });
});
