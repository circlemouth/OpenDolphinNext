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
  buildEmptyPrescriptionOrder,
  fetchPrescriptionOrder,
  importPrescriptionDoInput,
  savePrescriptionOrder,
  type PrescriptionOrder,
} from '../prescriptionOrderApi';

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

const expectAuthorityWriteAndLocalReadOnlyCalls = () => {
  for (const [index, url] of calledUrls().entries()) {
    const method = String((vi.mocked(httpFetch).mock.calls[index]?.[1] as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
    expect(url.startsWith('/api/local/prescription-orders')).toBe(true);
    if (method === 'POST') {
      expect(url).toBe('/api/local/prescription-orders/authority');
    }
    expect(ORCA_MUTATION_ENDPOINTS.some((endpoint) => url.includes(endpoint))).toBe(false);
  }
};

const buildPrescriptionOrder = (): PrescriptionOrder => ({
  patientId: '000001',
  encounterId: 'F001:E500',
  encounterDate: '2026-04-21',
  performDate: '2026-04-21',
  doctorComment: '全体医師コメント',
  deletedDocumentIds: [],
  prescriptionSettings: [{ code: 'setting-1', name: '院外処方', value: 'enabled' }],
  remarks: [{ code: 'remark-1', text: '院内備考' }],
  rps: [
    {
      rpId: 'rp-local-1',
      name: '降圧薬RP',
      location: 'out',
      category: 'regular',
      usage: '1日1回 朝食後',
      usageCode: '001000',
      daysOrTimes: '7',
      remark: '血圧記録を確認',
      refillPattern: 'none',
      doctorComment: 'RP医師コメント',
      started: '2026-04-21',
      claimComments: [{ id: 'rp-claim-1', code: '830000001', name: 'RPレセプトコメント', note: 'RP補足' }],
      drugs: [
        {
          rowId: 'drug-1',
          code: '620000001',
          name: 'アムロジピン',
          quantity: '1',
          unit: '錠',
          genericChangeAllowed: true,
          isGeneralNamePrescription: false,
          drugComment: 'ふらつき注意',
          claimComments: [{ id: 'drug-claim-1', code: '810000001', name: '薬剤レセプトコメント', note: '薬剤補足' }],
          patientRequest: true,
        },
      ],
    },
  ],
});

describe('prescription authority write and ORCA boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(httpFetch).mockReset();
  });

  it('save -> reload -> edit -> copy from previous chart keeps reads on local projection and writes on authority API', async () => {
    const initialOrder = buildPrescriptionOrder();
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(responseJson({ runId: 'RUN-SAVE-1', prescriptionId: 101, revisionId: 201, status: 'DRAFT' }))
      .mockResolvedValueOnce(
        responseJson({
          found: true,
          runId: 'RUN-FETCH-1',
          order: {
            patientId: '000001',
            encounterId: 'F001:E500',
            encounterDate: '2026-04-21',
            performDate: '2026-04-21',
            doctorComments: [{ text: '全体医師コメント' }],
            prescriptionSettings: [{ code: 'setting-1', name: '院外処方', value: 'enabled' }],
            remarks: [{ code: 'remark-1', text: '院内備考' }],
            rps: [
              {
                rpNumber: 'rp-local-1',
                bundleName: '降圧薬RP',
                medicalClass: '212',
                medicalClassNumber: '7',
                usageCode: '001000',
                usageName: '1日1回 朝食後',
                started: '2026-04-21',
                remark: '血圧記録を確認',
                doctorComment: 'RP医師コメント',
                claimComments: [{ code: '830000001', text: 'RPレセプトコメント', note: 'RP補足' }],
                drugs: [
                  {
                    code: '620000001',
                    name: 'アムロジピン',
                    quantity: '1',
                    unit: '錠',
                    genericChangeAllowed: true,
                    generalNamePrescription: false,
                    drugComment: 'ふらつき注意',
                    patientRequested: true,
                    claimComments: [{ code: '810000001', text: '薬剤レセプトコメント', note: '薬剤補足' }],
                  },
                ],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(responseJson({ runId: 'RUN-SAVE-EDIT', prescriptionId: 102, revisionId: 202, status: 'DRAFT' }))
      .mockResolvedValueOnce(responseJson({ runId: 'RUN-SAVE-COPY', prescriptionId: 103, revisionId: 203, status: 'DRAFT' }));

    await savePrescriptionOrder({ patientId: '000001', order: initialOrder });
    const reloaded = await fetchPrescriptionOrder({
      patientId: '000001',
      from: '2026-04-21',
      encounterId: 'F001:E500',
    });
    expect(reloaded.ok).toBe(true);

    const editedOrder: PrescriptionOrder = {
      ...reloaded.order,
      doctorComment: '全体医師コメント edited',
      rps: [
        {
          ...reloaded.order.rps[0],
          usage: '1日2回 朝夕食後',
          usageCode: '002000',
          daysOrTimes: '14',
          doctorComment: 'RP医師コメント edited',
          drugs: [
            {
              ...reloaded.order.rps[0].drugs[0],
              quantity: '2',
              drugComment: '眠気注意',
            },
          ],
        },
      ],
    };
    await savePrescriptionOrder({ patientId: '000001', order: editedOrder });

    const emptyCurrent: PrescriptionOrder = {
      ...buildEmptyPrescriptionOrder('000001', '2026-04-21', 'F001:E501'),
      rps: [],
      encounterId: 'F001:E501',
    };
    const copiedOrder = importPrescriptionDoInput(emptyCurrent, { type: 'order', order: reloaded.order });
    await savePrescriptionOrder({ patientId: '000001', order: copiedOrder });

    expectAuthorityWriteAndLocalReadOnlyCalls();

    const bodies = vi
      .mocked(httpFetch)
      .mock.calls.filter((call) => String(call[0]) === '/api/local/prescription-orders/authority')
      .map((call) => {
        const envelope = JSON.parse(String((call[1] as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;
        return (envelope.order ?? {}) as Record<string, any>;
      });

    expect(bodies[0]?.rps[0]).toEqual(
      expect.objectContaining({
        rpNumber: 'rp-local-1',
        medicalClass: '212',
        medicalClassNumber: '7',
        usageCode: '001000',
        usageName: '1日1回 朝食後',
        doctorComment: 'RP医師コメント',
        claimComments: [expect.objectContaining({ code: '830000001', text: 'RPレセプトコメント', note: 'RP補足' })],
      }),
    );
    expect(bodies[0]?.doctorComments).toEqual([{ text: '全体医師コメント' }]);
    expect(bodies[0]?.rps[0]?.drugs[0]).toEqual(
      expect.objectContaining({
        code: '620000001',
        quantity: '1',
        drugComment: 'ふらつき注意',
        claimComments: [expect.objectContaining({ code: '810000001', text: '薬剤レセプトコメント', note: '薬剤補足' })],
      }),
    );

    expect(bodies[1]?.rps[0]).toEqual(
      expect.objectContaining({
        medicalClassNumber: '14',
        usageCode: '002000',
        usageName: '1日2回 朝夕食後',
        doctorComment: 'RP医師コメント edited',
      }),
    );
    expect(bodies[1]?.doctorComments).toEqual([{ text: '全体医師コメント edited' }]);
    expect(bodies[1]?.rps[0]?.drugs[0]).toEqual(expect.objectContaining({ quantity: '2', drugComment: '眠気注意' }));
    expect(bodies[2]?.encounterId).toBe('F001:E501');
    expect(bodies[2]?.rps[0]).toEqual(
      expect.objectContaining({
        rpNumber: 'rp-local-1',
        usageCode: '001000',
        medicalClassNumber: '7',
      }),
    );
  });

  it('claim comment without code is rejected before local or ORCA transport', async () => {
    const order = buildPrescriptionOrder();
    order.rps[0].drugs[0].claimComments = [{ id: 'bad-claim', name: 'コードなしコメント', note: 'NG' }];

    await expect(savePrescriptionOrder({ patientId: '000001', order })).rejects.toThrow(
      '請求コメントコード未入力のコメントは保存できません',
    );

    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('delete-only save is rejected before any legacy or authority write endpoint is called', async () => {
    const order: PrescriptionOrder = {
      ...buildPrescriptionOrder(),
      rps: [],
      deletedDocumentIds: [10],
    };

    await expect(savePrescriptionOrder({ patientId: '000001', order })).rejects.toThrow(
      '処方オーダーの保存には少なくとも1件の薬剤が必要です。',
    );

    expect(httpFetch).not.toHaveBeenCalled();
  });
});
