import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChartsActionBar } from '../ChartsActionBar';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from '../orcaClaimApi';
import { fetchOrderBundles } from '../orderBundleApi';

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/F-1/charts',
    currentScreen: 'charts',
    fromCandidate: undefined,
    returnToCandidate: undefined,
    safeReturnToCandidate: undefined,
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

vi.mock('../orcaClaimApi', () => ({
  postOrcaMedicalModV2Xml: vi.fn(),
  buildMedicalModV2RequestXml: vi.fn().mockReturnValue('<data></data>'),
}));

vi.mock('../orcaMedicalModApi', () => ({
  buildMedicalModV23RequestXml: vi.fn().mockReturnValue('<data></data>'),
  postOrcaMedicalModV23Xml: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    apiResult: '00',
    rawXml: '<xml></xml>',
    missingTags: [],
  }),
}));

vi.mock('../orderBundleApi', () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({ ok: true, bundles: [] }),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../audit', () => ({
  recordChartsAuditEvent: vi.fn(),
}));

const baseProps = {
  runId: 'RUN-CLAIM',
  cacheHit: false,
  missingMaster: false,
  dataSourceTransition: 'server' as const,
  fallbackUsed: false,
};

describe('ChartsActionBar ORCA送信 (medicalmodv2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOrderBundles).mockResolvedValue({ ok: true, bundles: [] } as any);
  });

  it('公式経路でも通常 runtime には内部 ID ではなく canonical copy を表示する', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      invoiceNumber: 'INV-999',
      dataId: 'DATA-999',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    expect(screen.getByText(/ORCA送信を完了/)).toBeInTheDocument();
    expect(screen.getByText('ORCA 送信結果を確認し、必要なら一覧を再取得してください。')).toBeInTheDocument();
    expect(screen.queryByText(/Invoice_Number=INV-999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Data_Id=DATA-999/)).not.toBeInTheDocument();
  });

  it('Physician_Code が不足している場合は送信前に停止する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/Physician_Code/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('コメントコードのみの束は送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: 'コメント送信',
                bundleNumber: '1',
                items: [{ code: '0082', name: 'コメント' }],
              },
            ]
          : [],
    }));
    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/非送信データを検出/)).toBeInTheDocument());
    expect(screen.getByText(/本体となるコード行を1件以上追加してください/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('9桁以外かつコメントコード系でないコードは送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '不正コード',
                bundleNumber: '1',
                items: [{ code: '12345', name: '未正規化コード' }],
              },
            ]
          : [],
    }));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/9桁コード/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('コードあり/なし混在の束は送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '混在束',
                bundleNumber: '1',
                items: [
                  { code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回' },
                  { name: '未コード行', quantity: '1', unit: '回' },
                ],
              },
            ]
          : [],
    }));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/非送信データ/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('放射線の bodyPart と本体は unit を保ったまま送信ペイロードに残る', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'radiologyOrder'
          ? [
              {
                entity: 'radiologyOrder',
                bundleName: '胸部CT',
                bundleNumber: '1',
                classCode: '700',
                bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
                items: [
                  { code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '' },
                  { code: '700000001', name: '造影剤', quantity: '1', unit: '本', memo: '' },
                ],
              },
            ]
          : [],
    }));
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const radiologyInfo = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation[0] : null;
    const radiologyCodes = Array.isArray(radiologyInfo?.medications) ? radiologyInfo.medications.map((item: any) => item.code) : [];

    expect(radiologyCodes).toEqual(expect.arrayContaining(['002001', '170017510', '700000001']));
    expect(radiologyInfo.medications).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: '002001', unit: '部位' })]),
    );
    expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1);
  });

  it('放射線の bodyPart だけの束は送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'radiologyOrder'
          ? [
              {
                entity: 'radiologyOrder',
                bundleName: '胸部CT',
                bundleNumber: '1',
                classCode: '700',
                bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
                items: [],
              },
            ]
          : [],
    }));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/非送信データ/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('処方RPで Medical_Class_Number が欠落している場合は送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'medOrder'
          ? [
              {
                entity: 'medOrder',
                bundleName: '降圧薬RP',
                bundleNumber: '',
                classCode: '212',
                items: [{ code: '620001402', name: 'アムロジピン', quantity: '1' }],
              },
            ]
          : [],
    }));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/RP必須項目不足/)).toBeInTheDocument());
    expect(screen.getByText(/Medical_Class_Number/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('注射RPで Medication_info が空の場合は送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: '注射RP',
                bundleNumber: '1',
                classCode: '310',
                items: [{ name: 'ビタミン注射', quantity: '1' }],
              },
            ]
          : [],
    }));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/RP必須項目不足/)).toBeInTheDocument());
    expect(screen.getByText(/Medication_info/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('注射RPでコードなし行がある場合は送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: '注射RP',
                bundleNumber: '1',
                classCode: '310',
                admin: '静注',
                adminCode: '4101',
                items: [
                  { code: '830000001', name: '注射手技', quantity: '1', unit: '回' },
                  { name: 'ビタミン注射', quantity: '1', unit: '回' },
                ],
              },
            ]
          : [],
    }));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/非送信データ/)).toBeInTheDocument());
    expect(screen.getByText(/コードあり行とコードなし行が混在しています/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('単独の処方RPは必須項目がそろっていれば送信できる', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'medOrder'
          ? [
              {
                entity: 'medOrder',
                bundleName: '降圧薬RP',
                bundleNumber: '7',
                classCode: '212',
                admin: '1日1回 朝食後',
                items: [{ code: '620001402', name: 'アムロジピン', quantity: '1', unit: '錠' }],
              },
            ]
          : [],
    }));
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/RP必須項目不足/)).not.toBeInTheDocument();
  });

  it('複数の処方RPを連続送信対象にした場合も medicalInformation に全件展開する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'medOrder'
          ? [
              {
                entity: 'medOrder',
                bundleName: '降圧薬RP-A',
                bundleNumber: '7',
                classCode: '212',
                admin: '1日1回 朝食後',
                items: [{ code: '620001402', name: 'アムロジピン', quantity: '1', unit: '錠' }],
              },
              {
                entity: 'medOrder',
                bundleName: '降圧薬RP-B',
                bundleNumber: '14',
                classCode: '212',
                admin: '1日1回 夕食後',
                items: [{ code: '620009876', name: 'テルミサルタン', quantity: '1', unit: '錠' }],
              },
            ]
          : [],
    }));
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1));

    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const medInfoRows = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation : [];
    const prescriptionRows = medInfoRows.filter((row: any) => row?.medicalClass === '212');
    expect(prescriptionRows).toHaveLength(2);
    expect(screen.queryByText(/RP必須項目不足/)).not.toBeInTheDocument();
  });

  it('treatmentOrder canonical を 400 送信する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '一般オーダー',
                bundleNumber: '1',
                items: [{ code: '110000010', name: '手技' }],
              },
            ]
          : [],
    }));
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    expect(buildMedicalModV2RequestXml).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalInformation: expect.arrayContaining([expect.objectContaining({ medicalClass: '400' })]),
      }),
    );
  });

  it('mixed coded/uncoded row を含む treatmentOrder は送信前に停止する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '混在オーダー',
                bundleNumber: '1',
                classCode: '400',
                items: [
                  { code: '110000010', name: '手技' },
                  { name: '自由入力だけの行', quantity: '1' },
                ],
              },
            ]
          : [],
    }));

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 内科', physician: '10001 主治医', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/非送信データを検出/)).toBeInTheDocument());
    expect(screen.getByText(/コードあり行とコードなし行が混在/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });
});
