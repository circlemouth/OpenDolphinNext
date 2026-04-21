import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META' })),
  updateObservabilityMeta: vi.fn(),
}));

vi.mock('../../outpatient/orcaPatientImportApi', () => ({
  importPatientsFromOrca: vi.fn(),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import {
  fetchOrderBundles,
  mutateOrderBundles,
  type OrderBundle,
  type OrderBundleOperation,
} from '../orderBundleApi';

const ORCA_MUTATION_ENDPOINTS = [
  '/api/orca/official/chart-support/medical-mod-v2',
  '/api21/medicalmodv2',
  '/orca21/medicalmodv2',
  '/orca22/diseasev3',
  '/orca25/subjectivesv2',
];

const responseJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const calledUrls = () => vi.mocked(httpFetch).mock.calls.map((call) => String(call[0]));

const expectNoOrcaMutationCalls = () => {
  for (const url of calledUrls()) {
    expect(ORCA_MUTATION_ENDPOINTS.some((endpoint) => url.includes(endpoint))).toBe(false);
  }
};

const localBundleCases: Array<{
  label: string;
  fetchEntity: string;
  operation: OrderBundleOperation;
  serverBundle: OrderBundle;
  expectedOperation: Record<string, unknown>;
  expectedBundle: Record<string, unknown>;
}> = [
  {
    label: 'injection keeps drug, dependent material, comment, and admin fields',
    fetchEntity: 'injectionOrder',
    operation: {
      operation: 'create',
      entity: 'injectionOrder',
      bundleName: '点滴セット',
      bundleNumber: '1',
      classCode: '310',
      classCodeSystem: 'Claim007',
      admin: '点滴静注',
      adminCode: '4103',
      adminMemo: '20ml/h',
      items: [{ code: '620000012', name: '注射薬A', quantity: '1', unit: 'A', rowRole: 'main' }],
      materialItems: [{ code: '700000031', name: 'ドリップセット', quantity: '1', unit: '式', rowRole: 'material' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: 'slow', rowRole: 'comment' }],
    },
    serverBundle: {
      entity: 'injectionOrder',
      bundleName: '点滴セット',
      bundleNumber: '1',
      classCode: '310',
      classCodeSystem: 'Claim007',
      className: '注射',
      admin: '点滴静注',
      adminCode: '4103',
      adminMemo: '20ml/h',
      items: [{ code: '620000012', name: '注射薬A', quantity: '1', unit: 'A', rowRole: 'main' }],
      materialItems: [{ code: '700000031', name: 'ドリップセット', quantity: '1', unit: '式', rowRole: 'material' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: 'slow', rowRole: 'comment' }],
    },
    expectedOperation: {
      entity: 'injectionOrder',
      classCode: '310',
      admin: '点滴静注',
      adminCode: '4103',
      adminMemo: '20ml/h',
    },
    expectedBundle: {
      entity: 'injectionOrder',
      admin: '点滴静注',
      adminCode: '4103',
    },
  },
  {
    label: 'testOrder keeps specimen subtype and comment row locally',
    fetchEntity: 'testOrder',
    operation: {
      operation: 'create',
      entity: 'testOrder',
      bundleName: '検体検査',
      bundleNumber: '1',
      subtype: 'specimen',
      classCode: '600',
      classCodeSystem: 'Claim007',
      admin: '空腹',
      items: [{ code: '160000010', name: 'CBC', quantity: '1', unit: '回', rowRole: 'main' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '採血注意', rowRole: 'comment' }],
    },
    serverBundle: {
      entity: 'testOrder',
      bundleName: '検体検査',
      bundleNumber: '1',
      subtype: 'specimen',
      classCode: '600',
      classCodeSystem: 'Claim007',
      className: '検査',
      admin: '空腹',
      items: [{ code: '160000010', name: 'CBC', quantity: '1', unit: '回', rowRole: 'main' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '採血注意', rowRole: 'comment' }],
    },
    expectedOperation: { entity: 'testOrder', subtype: 'specimen', classCode: '600', admin: '空腹' },
    expectedBundle: { entity: 'testOrder', subtype: 'specimen', admin: '空腹' },
  },
  {
    label: 'physiology keeps subtype locally without proving ORCA sendability',
    fetchEntity: 'physiologyOrder',
    operation: {
      operation: 'create',
      entity: 'physiologyOrder',
      bundleName: '心電図',
      bundleNumber: '1',
      subtype: 'physiology',
      classCode: '600',
      items: [{ code: '160000020', name: '心電図', quantity: '1', unit: '回', rowRole: 'main' }],
    },
    serverBundle: {
      entity: 'physiologyOrder',
      bundleName: '心電図',
      bundleNumber: '1',
      subtype: 'physiology',
      classCode: '600',
      className: '検査',
      items: [{ code: '160000020', name: '心電図', quantity: '1', unit: '回', rowRole: 'main' }],
    },
    expectedOperation: { entity: 'physiologyOrder', subtype: 'physiology', classCode: '600' },
    expectedBundle: { entity: 'physiologyOrder', subtype: 'physiology', classCode: '600' },
  },
  {
    label: 'bacteria keeps culture subtype and bacteria metadata locally',
    fetchEntity: 'bacteriaOrder',
    operation: {
      operation: 'create',
      entity: 'bacteriaOrder',
      bundleName: '細菌培養',
      bundleNumber: '1',
      subtype: 'culture',
      bacteria: {
        specimen: { role: 'specimen', code: '830000001', name: '検体', inputValue: '喀痰' },
      },
      classCode: '600',
      items: [{ code: '160000030', name: '培養検査', quantity: '1', unit: '回', rowRole: 'main' }],
    },
    serverBundle: {
      entity: 'bacteriaOrder',
      bundleName: '細菌培養',
      bundleNumber: '1',
      subtype: 'culture',
      bacteria: {
        specimen: { role: 'specimen', code: '830000001', name: '検体', inputValue: '喀痰' },
      },
      classCode: '600',
      className: '検査',
      items: [{ code: '160000030', name: '培養検査', quantity: '1', unit: '回', rowRole: 'main' }],
    },
    expectedOperation: { entity: 'bacteriaOrder', subtype: 'culture', classCode: '600' },
    expectedBundle: { entity: 'bacteriaOrder', subtype: 'culture', classCode: '600' },
  },
  {
    label: 'radiology requires and reads back bodyPart as a first-class local field',
    fetchEntity: 'radiologyOrder',
    operation: {
      operation: 'create',
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '1',
      classCode: '700',
      classCodeSystem: 'Claim007',
      items: [{ code: '170017510', name: 'CT撮影', quantity: '1', unit: '回', rowRole: 'main' }],
      bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '正面', rowRole: 'bodyPart' },
    },
    serverBundle: {
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '1',
      classCode: '700',
      classCodeSystem: 'Claim007',
      className: '画像診断',
      items: [{ code: '170017510', name: 'CT撮影', quantity: '1', unit: '回', rowRole: 'main' }],
      bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '正面', rowRole: 'bodyPart' },
    },
    expectedOperation: { entity: 'radiologyOrder', classCode: '700' },
    expectedBundle: { entity: 'radiologyOrder', classCode: '700' },
  },
  {
    label: 'treatment keeps dependent material and comment rows locally',
    fetchEntity: 'treatmentOrder',
    operation: {
      operation: 'create',
      entity: 'treatmentOrder',
      bundleName: '創傷処置',
      bundleNumber: '1',
      classCode: '400',
      items: [{ code: '140000610', name: '創傷処置', quantity: '1', unit: '回', rowRole: 'main' }],
      materialItems: [{ code: '700000031', name: '処置材料', quantity: '1', unit: '個', rowRole: 'material' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '洗浄後', rowRole: 'comment' }],
    },
    serverBundle: {
      entity: 'treatmentOrder',
      bundleName: '創傷処置',
      bundleNumber: '1',
      classCode: '400',
      className: '処置',
      items: [{ code: '140000610', name: '創傷処置', quantity: '1', unit: '回', rowRole: 'main' }],
      materialItems: [{ code: '700000031', name: '処置材料', quantity: '1', unit: '個', rowRole: 'material' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '洗浄後', rowRole: 'comment' }],
    },
    expectedOperation: { entity: 'treatmentOrder', classCode: '400' },
    expectedBundle: { entity: 'treatmentOrder', classCode: '400' },
  },
  {
    label: 'surgery keeps dependent material and comment rows locally',
    fetchEntity: 'surgeryOrder',
    operation: {
      operation: 'create',
      entity: 'surgeryOrder',
      bundleName: '縫合',
      bundleNumber: '1',
      classCode: '500',
      items: [{ code: '150000001', name: '縫合術', quantity: '1', unit: '回', rowRole: 'main' }],
      materialItems: [{ code: '700000031', name: '縫合糸', quantity: '1', unit: '本', rowRole: 'material' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '局麻下', rowRole: 'comment' }],
    },
    serverBundle: {
      entity: 'surgeryOrder',
      bundleName: '縫合',
      bundleNumber: '1',
      classCode: '500',
      className: '手術',
      items: [{ code: '150000001', name: '縫合術', quantity: '1', unit: '回', rowRole: 'main' }],
      materialItems: [{ code: '700000031', name: '縫合糸', quantity: '1', unit: '本', rowRole: 'material' }],
      commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '局麻下', rowRole: 'comment' }],
    },
    expectedOperation: { entity: 'surgeryOrder', classCode: '500' },
    expectedBundle: { entity: 'surgeryOrder', classCode: '500' },
  },
  {
    label: 'other keeps explicit local-only code and does not carry class meta',
    fetchEntity: 'otherOrder',
    operation: {
      operation: 'create',
      entity: 'otherOrder',
      bundleName: '文書料',
      bundleNumber: '1',
      admin: '院内メモ',
      items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '文書料', quantity: '1', unit: '回', rowRole: 'main' }],
      commentItems: [{ code: 'LOCAL_OTHER:COMMENT', name: '院内コメント', quantity: '', unit: '', memo: 'local', rowRole: 'comment' }],
    },
    serverBundle: {
      entity: 'otherOrder',
      bundleName: '文書料',
      bundleNumber: '1',
      admin: '院内メモ',
      items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '文書料', quantity: '1', unit: '回', rowRole: 'main' }],
      commentItems: [{ code: 'LOCAL_OTHER:COMMENT', name: '院内コメント', quantity: '', unit: '', memo: 'local', rowRole: 'comment' }],
    },
    expectedOperation: { entity: 'otherOrder', admin: '院内メモ' },
    expectedBundle: { entity: 'otherOrder', admin: '院内メモ' },
  },
];

describe('order local persistence matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(httpFetch).mockReset();
  });

  it.each(localBundleCases)('$label', async ({ fetchEntity, operation, serverBundle, expectedOperation, expectedBundle }) => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(responseJson({ runId: 'RUN-SAVE', createdDocumentIds: [101] }))
      .mockResolvedValueOnce(responseJson({ runId: 'RUN-FETCH', patientId: '000001', bundles: [serverBundle] }));

    const saveResult = await mutateOrderBundles({ patientId: '000001', operations: [operation] });
    const fetchResult = await fetchOrderBundles({ patientId: '000001', entity: fetchEntity, from: '2026-04-21' });

    expect(saveResult.ok).toBe(true);
    expect(fetchResult.ok).toBe(true);
    expect(calledUrls()[0]).toBe('/api/local/order/bundles');
    expect(calledUrls()[1]).toContain('/api/local/order/bundles?patientId=000001');
    expect(calledUrls()[1]).toContain(`entity=${encodeURIComponent(fetchEntity)}`);
    expectNoOrcaMutationCalls();

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;
    expect(body.patientId).toBe('000001');
    expect(body.operations[0]).toEqual(expect.objectContaining(expectedOperation));
    expect(fetchResult.bundles[0]).toEqual(expect.objectContaining(expectedBundle));
    expect(fetchResult.bundles[0]?.items).toEqual(
      serverBundle.items.map((item) => expect.objectContaining(item)),
    );
    expect(fetchResult.bundles[0]?.materialItems ?? []).toEqual(
      (serverBundle.materialItems ?? []).map((item) => expect.objectContaining(item)),
    );
    expect(fetchResult.bundles[0]?.commentItems ?? []).toEqual(
      (serverBundle.commentItems ?? []).map((item) => expect.objectContaining(item)),
    );
    if (serverBundle.bodyPart) {
      expect(fetchResult.bundles[0]?.bodyPart).toEqual(expect.objectContaining(serverBundle.bodyPart));
    }
    if (serverBundle.bacteria?.specimen) {
      expect(fetchResult.bundles[0]?.bacteria?.specimen).toEqual(expect.objectContaining(serverBundle.bacteria.specimen));
    }
    if (fetchEntity === 'otherOrder') {
      expect(body.operations[0]).not.toHaveProperty('classCode');
      expect(body.operations[0]).not.toHaveProperty('className');
      expect(fetchResult.bundles[0]?.classCode).toBeUndefined();
      expect(fetchResult.bundles[0]?.className).toBeUndefined();
    }
  });

  it('treats material as dependent rows and does not introduce a standalone material order entity', async () => {
    const materialCase = localBundleCases.find((entry) => entry.fetchEntity === 'treatmentOrder');
    expect(materialCase).toBeTruthy();

    vi.mocked(httpFetch).mockResolvedValueOnce(responseJson({ runId: 'RUN-MATERIAL', createdDocumentIds: [102] }));

    await mutateOrderBundles({
      patientId: '000001',
      operations: [materialCase!.operation],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;
    expect(body.operations[0]?.entity).toBe('treatmentOrder');
    expect(body.operations[0]?.materialItems).toEqual([
      expect.objectContaining({ code: '700000031', rowRole: 'material' }),
    ]);
    expect(body.operations[0]?.entity).not.toBe('materialOrder');
    expectNoOrcaMutationCalls();
  });

  it('keeps treatment and surgery material rows on update while delete remains local-only', async () => {
    const treatmentCase = localBundleCases.find((entry) => entry.fetchEntity === 'treatmentOrder');
    const surgeryCase = localBundleCases.find((entry) => entry.fetchEntity === 'surgeryOrder');
    expect(treatmentCase).toBeTruthy();
    expect(surgeryCase).toBeTruthy();

    vi.mocked(httpFetch).mockResolvedValueOnce(
      responseJson({ runId: 'RUN-UPDATE-DELETE', updatedDocumentIds: [201], deletedDocumentIds: [202] }),
    );

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        { ...treatmentCase!.operation, operation: 'update', documentId: 201 },
        { ...surgeryCase!.operation, operation: 'delete', documentId: 202, items: undefined, materialItems: undefined, commentItems: undefined },
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;
    expect(calledUrls()).toEqual(['/api/local/order/bundles']);
    expect(body.operations[0]).toEqual(
      expect.objectContaining({
        operation: 'update',
        documentId: 201,
        entity: 'treatmentOrder',
        materialItems: [expect.objectContaining({ code: '700000031', rowRole: 'material' })],
      }),
    );
    expect(body.operations[1]).toEqual(
      expect.objectContaining({
        operation: 'delete',
        documentId: 202,
        entity: 'surgeryOrder',
      }),
    );
    expectNoOrcaMutationCalls();
  });
});
