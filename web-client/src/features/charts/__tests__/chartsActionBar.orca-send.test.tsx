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

vi.mock('../orcaClaimApi', async () => {
  const actual = await vi.importActual<typeof import('../orcaClaimApi')>('../orcaClaimApi');
  return {
    ...actual,
    postOrcaMedicalModV2Xml: vi.fn(),
    buildMedicalModV2RequestXml: vi.fn(actual.buildMedicalModV2RequestXml),
  };
});

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

describe('ChartsActionBar ORCA鬨ｾ竏ｽ・ｿ・｡ (medicalmodv2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOrderBundles).mockResolvedValue({ ok: true, bundles: [] } as any);
  });

  it('陷茨ｽｬ陟大・・ｵ迹夲ｽｷ・ｯ邵ｺ・ｧ郢ｧ繧仰螢ｼ・ｸ・ｸ runtime 邵ｺ・ｫ邵ｺ・ｯ陷繝ｻﾎ・ID 邵ｺ・ｧ邵ｺ・ｯ邵ｺ・ｪ邵ｺ繝ｻcanonical copy 郢ｧ螳夲ｽ｡・ｨ驕会ｽｺ邵ｺ蜷ｶ・・, async () => {
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    expect(screen.getByText(/ORCA鬨ｾ竏ｽ・ｿ・｡郢ｧ雋橸ｽｮ蠕｡・ｺ繝ｻ)).toBeInTheDocument();
    expect(screen.getByText('ORCA 鬨ｾ竏ｽ・ｿ・｡驍ｨ蜈域｣｡郢ｧ蝣､・｢・ｺ髫ｱ髦ｪ・邵ｲ竏晢ｽｿ繝ｻ・ｦ竏壺・郢ｧ謌托ｽｸﾂ髫包ｽｧ郢ｧ雋槭・陷ｿ髢・ｾ蜉ｱ・邵ｺ・ｦ邵ｺ荳岩味邵ｺ霈費ｼ樒ｸｲ繝ｻ)).toBeInTheDocument();
    expect(screen.queryByText(/Invoice_Number=INV-999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Data_Id=DATA-999/)).not.toBeInTheDocument();
  });

  it('Physician_Code 邵ｺ蠕｡・ｸ蟠趣ｽｶ・ｳ邵ｺ蜉ｱ窶ｻ邵ｺ繝ｻ・玖撻・ｴ陷ｷ蛹ｻ繝ｻ鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseProps}
          patientId="000001"
          visitDate="2026-01-20"
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/Physician_Code/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('郢ｧ・ｳ郢晢ｽ｡郢晢ｽｳ郢晏現縺慕ｹ晢ｽｼ郢晏ｳｨ繝ｻ邵ｺ・ｿ邵ｺ・ｮ隴壽ｺ倥・鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '郢ｧ・ｳ郢晢ｽ｡郢晢ｽｳ郢晉｣ｯﾂ竏ｽ・ｿ・｡',
                bundleNumber: '1',
                items: [{ code: '0082', name: '郢ｧ・ｳ郢晢ｽ｡郢晢ｽｳ郢昴・ }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/鬮ｱ讓｣ﾂ竏ｽ・ｿ・｡郢昴・繝ｻ郢ｧ・ｿ郢ｧ蜻茨ｽ､諛ｷ繝ｻ/)).toBeInTheDocument());
    expect(screen.getByText(/隴幢ｽｬ闖ｴ阮吮・邵ｺ・ｪ郢ｧ荵昴＆郢晢ｽｼ郢晁歓・｡蠕鯉ｽ・闔会ｽｶ闔会ｽ･闕ｳ鬘假ｽｿ・ｽ陷会｣ｰ邵ｺ蜉ｱ窶ｻ邵ｺ荳岩味邵ｺ霈費ｼ・)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('9隴ｯ竏ｽ・ｻ・･陞滓じﾂｰ邵ｺ・､郢ｧ・ｳ郢晢ｽ｡郢晢ｽｳ郢晏現縺慕ｹ晢ｽｼ郢晁・・ｳ・ｻ邵ｺ・ｧ邵ｺ・ｪ邵ｺ繝ｻ縺慕ｹ晢ｽｼ郢晏ｳｨ繝ｻ鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '闕ｳ閧ｴ・ｭ・｣郢ｧ・ｳ郢晢ｽｼ郢昴・,
                bundleNumber: '1',
                items: [{ code: '12345', name: '隴幢ｽｪ雎・ｽ｣髫穂ｸ槫密郢ｧ・ｳ郢晢ｽｼ郢昴・ }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/9隴ｯ竏壹＆郢晢ｽｼ郢昴・)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('郢ｧ・ｳ郢晢ｽｼ郢晏ｳｨ竕郢ｧ繝ｻ邵ｺ・ｪ邵ｺ邇ｲ・ｷ・ｷ陜ｨ・ｨ邵ｺ・ｮ隴壽ｺ倥・鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '雎ｺ・ｷ陜ｨ・ｨ隴壹・,
                bundleNumber: '1',
                items: [
                  { code: '140000610', name: '陷托ｽｵ陋ｯ・ｷ陷・ｽｦ驗ゑｽｮ繝ｻ闌ｨ・ｼ謇假ｽｼ謦ｰ・ｼ謦ｰ・ｽ繝ｻ・ｽ謳ｾ・ｼ蜻域ざ雋・繝ｻ繝ｻ, quantity: '1', unit: '陜励・ },
                  { name: '隴幢ｽｪ郢ｧ・ｳ郢晢ｽｼ郢晁歓・｡繝ｻ, quantity: '1', unit: '陜励・ },
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/鬮ｱ讓｣ﾂ竏ｽ・ｿ・｡郢昴・繝ｻ郢ｧ・ｿ/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('隰ｾ・ｾ陝・・・ｷ螢ｹ繝ｻ bodyPart 邵ｺ・ｨ隴幢ｽｬ闖ｴ阮吶・ unit 郢ｧ蜑・ｽｿ譏ｴ笆ｲ邵ｺ貅倪穐邵ｺ・ｾ鬨ｾ竏ｽ・ｿ・｡郢晏｣ｹ縺・ｹ晢ｽｭ郢晢ｽｼ郢晏ｳｨ竊楢ｰｿ荵晢ｽ・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'radiologyOrder'
          ? [
              {
                entity: 'radiologyOrder',
                bundleName: '髢ｭ・ｸ鬩幢ｽｨCT',
                bundleNumber: '1',
                classCode: '700',
                bodyPart: { code: '002001', name: '髢ｭ・ｸ鬩幢ｽｨ', quantity: '1', unit: '鬩幢ｽｨ闖ｴ繝ｻ, memo: '' },
                items: [
                  { code: '170017510', name: '繝ｻ・｣繝ｻ・ｴ隰ｦ・ｮ陟厄ｽｱ', quantity: '1', unit: '陜励・, memo: '' },
                  { code: '700000001', name: '鬨ｾ・ｰ陟厄ｽｱ陷托ｽ､', quantity: '1', unit: '隴幢ｽｬ', memo: '' },
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const radiologyInfo = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation[0] : null;
    const radiologyCodes = Array.isArray(radiologyInfo?.medications) ? radiologyInfo.medications.map((item: any) => item.code) : [];

    expect(radiologyCodes).toEqual(expect.arrayContaining(['002001', '170017510', '700000001']));
    expect(radiologyInfo.medications).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: '002001', unit: '鬩幢ｽｨ闖ｴ繝ｻ })]),
    );
    expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1);
  });

  it('隰ｾ・ｾ陝・・・ｷ螢ｹ繝ｻ bodyPart 邵ｺ・ｰ邵ｺ莉｣繝ｻ隴壽ｺ倥・鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'radiologyOrder'
          ? [
              {
                entity: 'radiologyOrder',
                bundleName: '髢ｭ・ｸ鬩幢ｽｨCT',
                bundleNumber: '1',
                classCode: '700',
                bodyPart: { code: '002001', name: '髢ｭ・ｸ鬩幢ｽｨ', quantity: '1', unit: '鬩幢ｽｨ闖ｴ繝ｻ, memo: '' },
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/鬮ｱ讓｣ﾂ竏ｽ・ｿ・｡郢昴・繝ｻ郢ｧ・ｿ/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('basic / instruction charge 邵ｺ・ｯ explicit class meta 郢ｧ蜑・ｽｿ譏ｴ笆ｲ邵ｺ貅倪穐邵ｺ・ｾ鬨ｾ竏ｽ・ｿ・｡ payload 邵ｺ・ｫ隹ｿ荵晢ｽ・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'baseChargeOrder'
          ? [
              {
                entity: 'baseChargeOrder',
                bundleName: '陋ｻ譎・ｽｨ・ｺ隴√・,
                bundleNumber: '1',
                classCode: '110',
                classCodeSystem: 'Claim007',
                className: '陜難ｽｺ隴幢ｽｬ髫ｪ・ｺ騾九ｈ萓ｭ',
                items: [{ code: '110000110', name: '陋ｻ譎・ｽｨ・ｺ隴√・, quantity: '1', unit: '陜励・ }],
              },
            ]
          : entity === 'instractionChargeOrder'
            ? [
                {
                  entity: 'instractionChargeOrder',
                  bundleName: '陜ｨ・ｨ陞ｳ繝ｻ谺陝・・,
                  bundleNumber: '2',
                  classCode: '130',
                  classCodeSystem: 'Claim007',
                  className: '隰悶・・ｰ蠑ｱ繝ｻ陜ｨ・ｨ陞ｳ繝ｻ,
                  items: [{ code: '112007410', name: '陜ｨ・ｨ陞ｳ繝ｻ繝ｻ陝ｾ・ｱ雎包ｽｨ陝・・谺陝・ｮ茨ｽｮ・｡騾・・萓ｭ', quantity: '1', unit: '陜励・ }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const medicalInformation = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation : [];

    expect(medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '110',
          medicalClassName: '陜難ｽｺ隴幢ｽｬ髫ｪ・ｺ騾九ｈ萓ｭ',
          medicalClassNumber: '1',
          medications: expect.arrayContaining([expect.objectContaining({ code: '110000110', unit: '陜励・ })]),
        }),
        expect.objectContaining({
          medicalClass: '130',
          medicalClassName: '隰悶・・ｰ蠑ｱ繝ｻ陜ｨ・ｨ陞ｳ繝ｻ,
          medicalClassNumber: '2',
          medications: expect.arrayContaining([expect.objectContaining({ code: '112007410', unit: '陜励・ })]),
        }),
      ]),
    );
    expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1);
  });

  it('雎包ｽｨ陝・・繝ｻ隰・玄讖ｿ+髦ｮ・ｬ陷托ｽ､+admin/adminCode 邵ｺ・ｯ happy path 邵ｺ・ｧ鬨ｾ竏ｽ・ｿ・｡ payload 邵ｺ・ｫ隹ｿ荵晢ｽ・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: '霓､・ｹ雋奇ｽｴ郢ｧ・ｻ郢昴・繝ｨ',
                bundleNumber: '2',
                classCode: '310',
                classCodeSystem: 'Claim007',
                className: '雎包ｽｨ陝・・,
                admin: '鬮ｱ蜻趣ｽｳ・ｨ',
                adminCode: '4101',
                adminCodeSystem: 'Claim007',
                items: [
                  { code: '830000001', name: '雎包ｽｨ陝・・辟碑ｬ堋', quantity: '1', unit: '陜励・ },
                  { code: '620000010', name: '雎包ｽｨ陝・・閼・', quantity: '1', unit: '驍ゑｽ｡' },
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const medicalInformation = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation : [];

    expect(medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '310',
          medicalClassName: '雎包ｽｨ陝・・,
          medicalClassNumber: '2',
          medications: expect.arrayContaining([
            expect.objectContaining({ code: '4101', name: '鬮ｱ蜻趣ｽｳ・ｨ' }),
            expect.objectContaining({ code: '830000001', unit: '陜励・ }),
            expect.objectContaining({ code: '620000010', unit: '驍ゑｽ｡' }),
          ]),
        }),
      ]),
    );
    expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1);
  });

  it('600驍会ｽｻ隶諛域ｸ顔ｸｺ・ｯ happy path 邵ｺ・ｧ canonical entity 邵ｺ・ｮ邵ｺ・ｾ邵ｺ・ｾ鬨ｾ竏ｽ・ｿ・｡ payload 邵ｺ・ｫ隹ｿ荵晢ｽ・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'testOrder'
          ? [
              {
                entity: 'testOrder',
                bundleName: '髯ｦﾂ雎ｸ・ｲ闕ｳﾂ髣奇ｽｬ',
                bundleNumber: '1',
                classCode: '600',
                classCodeSystem: 'Claim007',
                className: '隶諛域ｸ・,
                items: [{ code: '160000010', name: '髯ｦﾂ雎ｸ・ｲ闕ｳﾂ髣奇ｽｬ', quantity: '1', unit: '陜励・ }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const medicalInformation = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation : [];

    expect(medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '600',
          medicalClassName: '隶諛域ｸ・,
          medicalClassNumber: '1',
          medications: expect.arrayContaining([expect.objectContaining({ code: '160000010', unit: '陜励・ })]),
        }),
      ]),
    );
    expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1);
  });

  it('陷・ｽｦ隴・ｽｹRP邵ｺ・ｧ Medical_Class_Number 邵ｺ譴ｧ・ｬ・ｰ髣懶ｽｽ邵ｺ蜉ｱ窶ｻ邵ｺ繝ｻ・玖撻・ｴ陷ｷ蛹ｻ繝ｻ鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'medOrder'
          ? [
              {
                entity: 'medOrder',
                bundleName: '鬮ｯ讎頑ず髦ｮ・ｬRP',
                bundleNumber: '',
                classCode: '212',
                items: [{ code: '620001402', name: '郢ｧ・｢郢晢｣ｰ郢晢ｽｭ郢ｧ・ｸ郢晄鱒ﾎｦ', quantity: '1' }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/RP陟｢繝ｻ・ｰ逎ｯ・ｰ繝ｻ蟯ｼ闕ｳ蟠趣ｽｶ・ｳ/)).toBeInTheDocument());
    expect(screen.getByText(/Medical_Class_Number/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('雎包ｽｨ陝・｡P邵ｺ・ｧ Medication_info 邵ｺ讙趣ｽｩ・ｺ邵ｺ・ｮ陜｣・ｴ陷ｷ蛹ｻ繝ｻ鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: '雎包ｽｨ陝・｡P',
                bundleNumber: '1',
                classCode: '310',
                items: [{ name: '郢晁侭縺｡郢晄ｺ佩ｦ雎包ｽｨ陝・・, quantity: '1' }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/RP陟｢繝ｻ・ｰ逎ｯ・ｰ繝ｻ蟯ｼ闕ｳ蟠趣ｽｶ・ｳ/)).toBeInTheDocument());
    expect(screen.getByText(/Medication_info/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('雎包ｽｨ陝・｡P邵ｺ・ｧ郢ｧ・ｳ郢晢ｽｼ郢晏ｳｨ竊醍ｸｺ闍難ｽ｡蠕娯ｲ邵ｺ繧・ｽ玖撻・ｴ陷ｷ蛹ｻ繝ｻ鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: '雎包ｽｨ陝・｡P',
                bundleNumber: '1',
                classCode: '310',
                admin: '鬮ｱ蜻趣ｽｳ・ｨ',
                adminCode: '4101',
                items: [
                  { code: '830000001', name: '雎包ｽｨ陝・・辟碑ｬ堋', quantity: '1', unit: '陜励・ },
                  { name: '郢晁侭縺｡郢晄ｺ佩ｦ雎包ｽｨ陝・・, quantity: '1', unit: '陜励・ },
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/鬮ｱ讓｣ﾂ竏ｽ・ｿ・｡郢昴・繝ｻ郢ｧ・ｿ/)).toBeInTheDocument());
    expect(screen.getByText(/郢ｧ・ｳ郢晢ｽｼ郢晏ｳｨ竕郢ｧ鬘假ｽ｡蠕娯・郢ｧ・ｳ郢晢ｽｼ郢晏ｳｨ竊醍ｸｺ闍難ｽ｡蠕娯ｲ雎ｺ・ｷ陜ｨ・ｨ邵ｺ蜉ｱ窶ｻ邵ｺ繝ｻ竏ｪ邵ｺ繝ｻ)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('陷雁｡蟲｡邵ｺ・ｮ陷・ｽｦ隴・ｽｹRP邵ｺ・ｯ陟｢繝ｻ・ｰ逎ｯ・ｰ繝ｻ蟯ｼ邵ｺ蠕娯落郢ｧ髦ｪ笆ｲ邵ｺ・ｦ邵ｺ繝ｻ・檎ｸｺ・ｰ鬨ｾ竏ｽ・ｿ・｡邵ｺ・ｧ邵ｺ髦ｪ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'medOrder'
          ? [
              {
                entity: 'medOrder',
                bundleName: '鬮ｯ讎頑ず髦ｮ・ｬRP',
                bundleNumber: '7',
                classCode: '212',
                admin: '1隴鯉ｽ･1陜励・隴帶辨・｣貅ｷ・ｾ繝ｻ,
                items: [{ code: '620001402', name: '郢ｧ・｢郢晢｣ｰ郢晢ｽｭ郢ｧ・ｸ郢晄鱒ﾎｦ', quantity: '1', unit: '鬪ｭ・ｰ' }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/RP陟｢繝ｻ・ｰ逎ｯ・ｰ繝ｻ蟯ｼ闕ｳ蟠趣ｽｶ・ｳ/)).not.toBeInTheDocument();
  });

  it('陷・ｽｦ隴・ｽｹ 1RP 2髦ｮ・ｬ陷托ｽ､ + 郢ｧ・ｳ郢晢ｽ｡郢晢ｽｳ郢昴・+ generic flag 郢ｧ蟶敖竏ｽ・ｿ・｡ payload 邵ｺ・ｫ隹ｿ荵昶・', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'medOrder'
          ? [
              {
                entity: 'medOrder',
                bundleName: '鬮ｯ讎頑ず髦ｮ・ｬRP',
                bundleNumber: '7',
                classCode: '212',
                admin: '1隴鯉ｽ･1陜励・隴帶辨・｣貅ｷ・ｾ繝ｻ,
                items: [
                  {
                    code: '620000001',
                    name: '郢ｧ・｢郢晢｣ｰ郢晢ｽｭ郢ｧ・ｸ郢晄鱒ﾎｦ鬪ｭ・ｰ5mg',
                    quantity: '1',
                    unit: '鬪ｭ・ｰ',
                    memo: '__orca_meta__:{"genericFlg":"no"}',
                  },
                  { code: '620000002', name: '郢晢ｽｭ郢ｧ・ｵ郢晢ｽｫ郢ｧ・ｿ郢晢ｽｳ鬪ｭ・ｰ50mg', quantity: '1', unit: '鬪ｭ・ｰ', memo: '' },
                  { code: '008200001', name: '鬯滓ｺｷ・ｾ蠕後＆郢晢ｽ｡郢晢ｽｳ郢昴・, quantity: '', unit: '', memo: '' },
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1));

    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const medInfoRows = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation : [];
    const prescriptionRow = medInfoRows.find((row: any) => row?.medicalClass === '212');
    const medications = Array.isArray(prescriptionRow?.medications) ? prescriptionRow.medications : [];

    expect(prescriptionRow).toEqual(
      expect.objectContaining({
        medicalClass: '212',
        medicalClassNumber: '7',
      }),
    );
    expect(medications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '620000001', unit: '鬪ｭ・ｰ', genericFlg: 'no' }),
        expect.objectContaining({ code: '620000002', unit: '鬪ｭ・ｰ' }),
        expect.objectContaining({ code: '008200001', name: '鬯滓ｺｷ・ｾ蠕後＆郢晢ｽ｡郢晢ｽｳ郢昴・ }),
      ]),
    );
  });

  it('髫阪・辟夂ｸｺ・ｮ陷・ｽｦ隴・ｽｹRP郢ｧ蟶敖・｣驍ｯ螟青竏ｽ・ｿ・｡陝・ｽｾ髮趣ｽ｡邵ｺ・ｫ邵ｺ蜉ｱ笳・撻・ｴ陷ｷ蛹ｻ・・medicalInformation 邵ｺ・ｫ陷茨ｽｨ闔会ｽｶ陞ｻ證ｮ蟷慕ｸｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'medOrder'
          ? [
              {
                entity: 'medOrder',
                bundleName: '鬮ｯ讎頑ず髦ｮ・ｬRP-A',
                bundleNumber: '7',
                classCode: '212',
                admin: '1隴鯉ｽ･1陜励・隴帶辨・｣貅ｷ・ｾ繝ｻ,
                items: [{ code: '620001402', name: '郢ｧ・｢郢晢｣ｰ郢晢ｽｭ郢ｧ・ｸ郢晄鱒ﾎｦ', quantity: '1', unit: '鬪ｭ・ｰ' }],
              },
              {
                entity: 'medOrder',
                bundleName: '鬮ｯ讎頑ず髦ｮ・ｬRP-B',
                bundleNumber: '14',
                classCode: '212',
                admin: '1隴鯉ｽ･1陜励・陞滓坩・｣貅ｷ・ｾ繝ｻ,
                items: [{ code: '620009876', name: '郢昴・ﾎ晉ｹ晄ｺ倥＠郢晢ｽｫ郢ｧ・ｿ郢晢ｽｳ', quantity: '1', unit: '鬪ｭ・ｰ' }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalledTimes(1));

    const lastCall = vi.mocked(buildMedicalModV2RequestXml).mock.calls.at(-1)?.[0] as any;
    const medInfoRows = Array.isArray(lastCall?.medicalInformation) ? lastCall.medicalInformation : [];
    const prescriptionRows = medInfoRows.filter((row: any) => row?.medicalClass === '212');
    expect(prescriptionRows).toHaveLength(2);
    expect(screen.queryByText(/RP陟｢繝ｻ・ｰ逎ｯ・ｰ繝ｻ蟯ｼ闕ｳ蟠趣ｽｶ・ｳ/)).not.toBeInTheDocument();
  });

  it('treatmentOrder canonical 郢ｧ繝ｻ400 鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '闕ｳﾂ髣奇ｽｬ郢ｧ・ｪ郢晢ｽｼ郢敖郢晢ｽｼ',
                bundleNumber: '1',
                items: [{ code: '110000010', name: '隰・玄讖ｿ' }],
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(buildMedicalModV2RequestXml).toHaveBeenCalled());
    expect(buildMedicalModV2RequestXml).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalInformation: expect.arrayContaining([expect.objectContaining({ medicalClass: '400' })]),
      }),
    );
  });

  it('mixed coded/uncoded row 郢ｧ雋樊ｧ郢ｧﾂ treatmentOrder 邵ｺ・ｯ鬨ｾ竏ｽ・ｿ・｡陷鷹亂竊楢屁諛茨ｽｭ・｢邵ｺ蜷ｶ・・, async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '雎ｺ・ｷ陜ｨ・ｨ郢ｧ・ｪ郢晢ｽｼ郢敖郢晢ｽｼ',
                bundleNumber: '1',
                classCode: '400',
                items: [
                  { code: '110000010', name: '隰・玄讖ｿ' },
                  { name: '髢ｾ・ｪ騾包ｽｱ陷茨ｽ･陷牙ｸ吮味邵ｺ莉｣繝ｻ髯ｦ繝ｻ, quantity: '1' },
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
          selectedEntry={{ department: '01 陷繝ｻ・ｧ繝ｻ, physician: '10001 闕ｳ・ｻ雎撰ｽｻ陋ｹ・ｻ', patientId: '000001' } as any}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'ORCA 鬨ｾ竏ｽ・ｿ・｡' }));
    await user.click(screen.getByRole('button', { name: '鬨ｾ竏ｽ・ｿ・｡邵ｺ蜷ｶ・・ }));

    await waitFor(() => expect(screen.getByText(/鬮ｱ讓｣ﾂ竏ｽ・ｿ・｡郢昴・繝ｻ郢ｧ・ｿ郢ｧ蜻茨ｽ､諛ｷ繝ｻ/)).toBeInTheDocument());
    expect(screen.getByText(/郢ｧ・ｳ郢晢ｽｼ郢晏ｳｨ竕郢ｧ鬘假ｽ｡蠕娯・郢ｧ・ｳ郢晢ｽｼ郢晏ｳｨ竊醍ｸｺ闍難ｽ｡蠕娯ｲ雎ｺ・ｷ陜ｨ・ｨ/)).toBeInTheDocument();
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });
});
