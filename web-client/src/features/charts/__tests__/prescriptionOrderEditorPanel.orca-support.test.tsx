// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PrescriptionOrderEditorPanel } from '../PrescriptionOrderEditorPanel';
import { fetchOrcaGenericPrice } from '../orcaGenericPriceApi';
import { fetchOrcaOrderInputSetDetail, fetchOrcaOrderInputSets } from '../orcaOrderInputSetApi';
import { checkOrcaMasterStaticOrderInteractions } from '../orcaOrderInteractionApi';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';
import { fetchPrescriptionOrder, savePrescriptionOrder } from '../prescriptionOrderApi';

vi.mock('../orderMasterSearchApi', async () => {
  const actual = await vi.importActual<typeof import('../orderMasterSearchApi')>('../orderMasterSearchApi');
  return {
    ...actual,
    fetchOrderMasterSearch: vi.fn(),
  };
});

vi.mock('../orcaGenericPriceApi', () => ({
  fetchOrcaGenericPrice: vi.fn(),
}));

vi.mock('../orcaOrderInputSetApi', () => ({
  fetchOrcaOrderInputSets: vi.fn(),
  fetchOrcaOrderInputSetDetail: vi.fn(),
}));

vi.mock('../orcaOrderInteractionApi', () => ({
  checkOrcaMasterStaticOrderInteractions: vi.fn(),
}));

vi.mock('../prescriptionOrderApi', async () => {
  const actual = await vi.importActual<typeof import('../prescriptionOrderApi')>('../prescriptionOrderApi');
  return {
    ...actual,
    fetchPrescriptionOrder: vi.fn().mockResolvedValue({ ok: true, sourceBundles: [] }),
    savePrescriptionOrder: vi.fn().mockResolvedValue({ ok: true }),
  };
});

const baseMeta = {
  runId: 'RUN-RX-ORCA-TEST',
  cacheHit: true,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server' as const,
  encounterId: 'F001:E100',
  visitDate: '2026-03-09',
};

const defaultBundlesOverride = [
  {
    entity: 'medOrder',
    bundleName: '既存RP',
    bundleNumber: '7',
    admin: '1日1回 朝食後',
    adminCode: '001000',
    classCode: '212',
    started: '2026-03-09',
    items: [{ code: 'A100', name: '既存薬', quantity: '1', unit: '錠', memo: '' }],
  },
];

const renderPanel = (options?: { bundlesOverride?: any[]; request?: any }) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <PrescriptionOrderEditorPanel
        patientId="P-RX-001"
        meta={baseMeta}
        active
        variant="utility"
        bundlesOverride={options?.bundlesOverride ?? defaultBundlesOverride}
        request={options?.request}
      />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PrescriptionOrderEditorPanel ORCA support', () => {
  it('最低薬価を候補一覧と選択中 helper line に表示する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockImplementation(async ({ type, keyword }) => {
      if (type === 'youhou') return { ok: true, items: [], totalCount: 0 };
      if (type === 'drug' && keyword === 'アムロ') {
        return {
          ok: true,
          items: [{ type: 'drug', code: '620000001', name: 'アムロジピン', unit: '錠' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });
    vi.mocked(fetchOrcaGenericPrice).mockResolvedValue({
      ok: true,
      status: 200,
      item: { code: '620000001', minPrice: 12.34, unit: '錠' },
    });

    renderPanel();

    await user.type(screen.getByLabelText('キーワード'), 'アムロ');

    const candidateRow = await screen.findByRole('button', { name: /620000001/ });
    await waitFor(() => {
      expect(fetchOrcaGenericPrice).toHaveBeenCalledWith({ srycd: '620000001', effective: '2026-03-09' });
    });
    expect(within(candidateRow).getByText('12.34')).toBeInTheDocument();

    await user.click(candidateRow);

    expect(await screen.findByText('最低薬価: 12.34')).toBeInTheDocument();
  });

  it('ORCA入力セットを末尾 RP に追加し既存 RP を保持する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P01001', name: '降圧セット', entity: 'medOrder', itemCount: 2 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P01001',
      bundle: {
        entity: 'medOrder',
        bundleName: '降圧セット',
        bundleNumber: '14',
        admin: '1日1回 朝食後',
        started: '2026-03-09',
        items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      },
    });

    renderPanel();

    expect(screen.queryByText('setCode は展開専用です。保存・ORCA送信 payload には保持しません。')).not.toBeInTheDocument();
    await user.click(screen.getByText('ORCA入力セット'));
    expect(screen.getByText('ORCA入力セットは下書きフォームへ反映するだけです。処方確定・ORCA送信・会計済み確定は行いません。')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('入力セット名またはコード'), '降圧');
    await user.click(screen.getByRole('button', { name: '入力セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P01001.*降圧セット.*反映/ }));

    const rpPane = screen.getByLabelText('RP一覧');
    expect(within(rpPane).getByText('2件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RP1: 既存RP/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RP2: 降圧セット/ })).toBeInTheDocument();
  });

  it('ORCA入力セットは 221 系の class semantics と local-only usage/請求コメントを保存 payload に引き継ぐ', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P02221', name: '頓服セット', entity: 'medOrder', itemCount: 2 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P02221',
      bundle: {
        entity: 'medOrder',
        bundleName: '頓服セット',
        bundleNumber: '3',
        classCode: '221',
        admin: '頓服',
        adminCode: '200',
        memo: '入力セット備考',
        started: '2026-03-09',
        items: [
          { code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '食後' },
          { code: '810000001', name: '患者希望', quantity: '', unit: '', memo: '入力セット由来' },
        ],
      },
    });

    renderPanel();

    await user.click(screen.getByText('ORCA入力セット'));
    await user.type(screen.getByPlaceholderText('入力セット名またはコード'), '頓服');
    await user.click(screen.getByRole('button', { name: '入力セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P02221.*頓服セット.*反映/ }));
    await user.click(await screen.findByRole('button', { name: /RP2: 頓服セット/ }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(savePrescriptionOrder).mock.calls[0]?.[0];
    const appendedRp = payload?.order?.rps?.[1];
    expect(appendedRp).toEqual(
      expect.objectContaining({
        name: '頓服セット',
        category: 'tonyo',
        location: 'in',
        usage: '頓服',
        usageCode: '200',
        daysOrTimes: '3',
        remark: '入力セット備考',
      }),
    );
    expect(appendedRp?.drugs).toHaveLength(1);
    expect(appendedRp?.drugs[0]).toEqual(
      expect.objectContaining({
        code: '620000001',
        drugComment: '食後',
      }),
    );
    expect(appendedRp?.claimComments?.[0]).toEqual(
      expect.objectContaining({
        code: '810000001',
        name: '患者希望',
        note: '入力セット由来',
      }),
    );
    expect(appendedRp?.drugs[0]?.claimComments).toEqual([]);
  });

  it('一般名指定トグルを独立に保存 payload へ反映する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel({
      bundlesOverride: [
        {
          entity: 'medOrder',
          bundleName: '既存RP',
          bundleNumber: '7',
          admin: '毎食後',
          adminCode: '001000',
          classCode: '212',
          started: '2026-03-09',
          items: [{ code: '620000001', name: '既存薬', quantity: '1', unit: '錠', memo: '' }],
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: '銘柄指定' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(savePrescriptionOrder).mock.calls[0]?.[0];
    expect(payload?.order?.rps[0]?.drugs[0]).toEqual(
      expect.objectContaining({
        genericChangeAllowed: true,
        isGeneralNamePrescription: true,
      }),
    );
  });

  it('edit request は fetched first-class order を編集 source of truth にし no-op save でも意味を落とさない', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchPrescriptionOrder).mockResolvedValue({
      ok: true,
      patientId: 'P-RX-001',
      sourceBundles: [
        {
          entity: 'medOrder',
          documentId: 710,
          moduleId: 820,
          bundleName: '既存RP',
          bundleNumber: '7',
          admin: '毎食後',
          adminCode: '001000',
          classCode: '212',
          started: '2026-03-09',
          items: [{ code: '620000001', name: '既存薬', quantity: '1', unit: '錠', memo: '' }],
        },
      ],
      order: {
        patientId: 'P-RX-001',
        encounterId: 'F001:E500',
        encounterDate: '2026-03-09',
        performDate: '2026-03-09',
        doctorComment: '全体コメント',
        prescriptionSettings: [{ code: 'setting-1', name: '院内設定', value: 'enabled' }],
        remarks: [{ code: 'remark-1', text: '院内備考' }],
        deletedDocumentIds: [],
        rps: [
          {
            rpId: 'rp-enc-1',
            documentId: 710,
            moduleId: 820,
            name: '既存RP',
            location: 'out',
            category: 'regular',
            usage: '毎食後',
            usageCode: '001000',
            daysOrTimes: '7',
            remark: 'local note',
            refillPattern: 'alternate',
            doctorComment: 'RPコメント',
            started: '2026-03-09',
            claimComments: [{ id: 'rp-claim-1', code: '820100001', name: 'RP患者希望', note: 'rp-note' }],
            drugs: [
              {
                rowId: 'drug-1',
                code: '620000001',
                name: '既存薬',
                quantity: '1',
                unit: '錠',
                genericChangeAllowed: false,
                isGeneralNamePrescription: true,
                drugComment: '食後',
                claimComments: [{ id: 'claim-1', code: '810000001', name: '患者希望', note: 'note' }],
                patientRequest: false,
              },
            ],
          },
        ],
      },
    } as any);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <PrescriptionOrderEditorPanel
          patientId="P-RX-001"
          meta={{ ...baseMeta, encounterId: 'F001:E500' }}
          active
          request={{
            requestId: 'edit-rx-1',
            kind: 'edit',
            bundle: {
              entity: 'medOrder',
              documentId: 710,
              moduleId: 820,
              bundleName: '既存RP',
              bundleNumber: '7',
              admin: '毎食後',
              adminCode: '001000',
              classCode: '212',
              started: '2026-03-09',
              items: [{ code: '620000001', name: '既存薬', quantity: '1', unit: '錠', memo: '' }],
            },
          }}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchPrescriptionOrder).toHaveBeenCalledWith({
        patientId: 'P-RX-001',
        from: '2026-03-09',
        encounterId: 'F001:E500',
      });
    });
    expect(await screen.findByDisplayValue('全体コメント')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(savePrescriptionOrder).mock.calls[0]?.[0];
    expect(payload?.order).toEqual(
      expect.objectContaining({
        encounterId: 'F001:E500',
        doctorComment: '全体コメント',
        prescriptionSettings: [{ code: 'setting-1', name: '院内設定', value: 'enabled' }],
        remarks: [{ code: 'remark-1', text: '院内備考' }],
      }),
    );
    expect(payload?.order?.rps[0]).toEqual(
      expect.objectContaining({
        documentId: 710,
        moduleId: 820,
        doctorComment: 'RPコメント',
        claimComments: [{ id: 'rp-claim-1', code: '820100001', name: 'RP患者希望', note: 'rp-note' }],
      }),
    );
    expect(payload?.order?.rps[0]?.drugs[0]).toEqual(
      expect.objectContaining({
        genericChangeAllowed: false,
        isGeneralNamePrescription: true,
        claimComments: [{ id: 'claim-1', code: '810000001', name: '患者希望', note: 'note' }],
        patientRequest: false,
      }),
    );
  });

  it('usageCode の無い自由用法は local-only usage として保存できる', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel({
      bundlesOverride: [
        {
          entity: 'medOrder',
          bundleName: '既存RP',
          bundleNumber: '7',
          admin: '自由用法だけ',
          adminCode: '',
          classCode: '212',
          started: '2026-03-09',
          items: [{ code: '620000001', name: '既存薬', quantity: '1', unit: '錠', memo: '' }],
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('処方オーダーを保存しました。')).toBeInTheDocument();
    const payload = vi.mocked(savePrescriptionOrder).mock.calls[0]?.[0];
    expect(payload?.order?.rps[0]).toEqual(
      expect.objectContaining({
        usage: '自由用法だけ',
        usageCode: undefined,
      }),
    );
  });

  it('structured claim comment note を editor で表示し no-op save でも保持する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel({
      bundlesOverride: [
        {
          entity: 'medOrder',
          bundleName: '構造化コメントRP',
          bundleNumber: '7',
          admin: '毎食後',
          adminCode: '001000',
          classCode: '212',
          started: '2026-03-09',
          items: [
            {
              code: '830000001',
              name: '自由記載',
              quantity: '',
              unit: '',
              memo: '__rx_claim_target__:__rp__',
              structuredCommentValue: '補足メモ',
            },
            {
              code: '620000001',
              name: '既存薬',
              quantity: '1',
              unit: '錠',
              memo: '',
            },
            {
              code: '850100001',
              name: '日付',
              quantity: '',
              unit: '',
              memo: '__rx_claim_target__:0',
              structuredCommentValue: '2026-04-09',
            },
          ],
        },
      ],
    });

    expect(await screen.findByDisplayValue('補足メモ')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('2026-04-09')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(savePrescriptionOrder).mock.calls[0]?.[0];
    expect(payload?.order?.rps[0]?.claimComments).toEqual([
      expect.objectContaining({ code: '830000001', note: '補足メモ' }),
    ]);
    expect(payload?.order?.rps[0]?.drugs[0]?.claimComments).toEqual([
      expect.objectContaining({ code: '850100001', note: '2026-04-09' }),
    ]);
  });

  it('マスタ相互作用ありでは確認 dialog を出し、続行時だけ保存する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(checkOrcaMasterStaticOrderInteractions).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      pairs: [{ code1: '620000001', code2: '620000003', interactionName: '併用注意', message: '相互作用が検出されました' }],
    });

    renderPanel({
      bundlesOverride: [
        {
          entity: 'medOrder',
          bundleName: '既存RP',
          bundleNumber: '7',
          admin: '1日1回 朝食後',
          adminCode: '001000',
          classCode: '212',
          started: '2026-03-09',
          items: [
            { code: '620000001', name: '薬A', quantity: '1', unit: '錠', memo: '' },
            { code: '620000001', name: '薬A重複', quantity: '1', unit: '錠', memo: '' },
            { code: '620000003', name: '薬B', quantity: '1', unit: '錠', memo: '' },
          ],
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(checkOrcaMasterStaticOrderInteractions).toHaveBeenCalledWith({
        codes: ['620000001', '620000003'],
        effective: '2026-03-09',
      });
    });
    expect(await screen.findByRole('heading', { name: '処方安全チェック' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '処方安全チェック結果' })).toHaveTextContent('警告');
    expect(screen.getByLabelText('確認理由')).toBeInTheDocument();
    expect(savePrescriptionOrder).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '処方を修正' }));
    expect(savePrescriptionOrder).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '保存' }));
    const confirmSave = await screen.findByRole('button', { name: '確認済みとして保存' });
    expect(confirmSave).toHaveAttribute('aria-disabled', 'true');
    await user.click(confirmSave);
    expect(savePrescriptionOrder).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('確認理由'), '患者状態と処方意図を確認済み');
    expect(confirmSave).toHaveAttribute('aria-disabled', 'false');
    await user.click(confirmSave);

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });
  });

  it('マスタ相互作用 API エラー時は warning 後に保存を継続する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(checkOrcaMasterStaticOrderInteractions).mockRejectedValue(new Error('interaction failed'));

    renderPanel({
      bundlesOverride: [
        {
          entity: 'medOrder',
          bundleName: '既存RP',
          bundleNumber: '7',
          admin: '1日1回 朝食後',
          adminCode: '001000',
          classCode: '212',
          started: '2026-03-09',
          items: [
            { code: '620000001', name: '薬A', quantity: '1', unit: '錠', memo: '' },
            { code: '620000003', name: '薬B', quantity: '1', unit: '錠', memo: '' },
          ],
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });
    expect(checkOrcaMasterStaticOrderInteractions).toHaveBeenCalledWith(
      expect.objectContaining({ codes: ['620000001', '620000003'] }),
    );
  });
});
