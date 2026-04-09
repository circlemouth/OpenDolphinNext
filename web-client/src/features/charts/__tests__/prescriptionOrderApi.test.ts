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
  buildPrescriptionOrderSendBundles,
  buildPrescriptionMutationOperations,
  fetchPrescriptionOrder,
  savePrescriptionOrder,
  toPrescriptionOrder,
  type PrescriptionOrder,
} from '../prescriptionOrderApi';

describe('prescriptionOrderApi first-class contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save と send は 211/212/221/222/231/232 の class semantics を揃える', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ runId: 'RUN-SAVE' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const classMatrix = [
      { rpId: 'rp-1', name: '内服院内', location: 'in', category: 'regular', medicalClass: '211', medicalClassNumber: '1' },
      { rpId: 'rp-2', name: '内服院外', location: 'out', category: 'regular', medicalClass: '212', medicalClassNumber: '2' },
      { rpId: 'rp-3', name: '頓服院内', location: 'in', category: 'tonyo', medicalClass: '221', medicalClassNumber: '3' },
      { rpId: 'rp-4', name: '頓服院外', location: 'out', category: 'tonyo', medicalClass: '222', medicalClassNumber: '4' },
      { rpId: 'rp-5', name: '外用院内', location: 'in', category: 'gaiyo', medicalClass: '231', medicalClassNumber: '5' },
      { rpId: 'rp-6', name: '外用院外', location: 'out', category: 'gaiyo', medicalClass: '232', medicalClassNumber: '6' },
    ] as const;

    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterId: 'F001:E100',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '全体コメント',
      prescriptionSettings: [{ code: 'setting-1', name: '院内設定', value: 'enabled' }],
      remarks: [{ code: 'remark-1', text: '院内備考' }],
      deletedDocumentIds: [1, 1, 0, -1],
      rps: classMatrix.map((entry, index) => ({
        rpId: entry.rpId,
        name: entry.name,
        location: entry.location,
        category: entry.category,
        usage: `1日${index + 1}回`,
        usageCode: `${100 + index}`,
        daysOrTimes: entry.medicalClassNumber,
        remark: `remark-${index + 1}`,
        refillCount: index < 3 ? (index + 1) as 1 | 2 | 3 : undefined,
        refillPattern: index % 2 === 0 ? 'standard' : 'alternate',
        doctorComment: `RPコメント${index + 1}`,
        started: '2026-03-09',
        lowerDrugCode: index === 0 ? 'lower-drug' : undefined,
        claimComments:
          index === 0
            ? [{ id: 'rp-claim-1', code: '820100001', name: 'RP患者希望', note: 'rp-note' }]
            : [],
        drugs: [
          {
            rowId: `drug-${index + 1}`,
            code: '620000001',
            name: 'アムロジピン',
            quantity: '1',
            unit: '錠',
            numberCode: index === 0 ? '001' : undefined,
            numberCodeSystem: index === 0 ? 'urn:orca:number' : undefined,
            numberCodeName: index === 0 ? 'number-name' : undefined,
            genericChangeAllowed: index % 2 === 0,
            isGeneralNamePrescription: index % 2 === 1,
            drugComment: '食後',
            lowerUsageCode: index === 0 ? 'lower-usage' : undefined,
            claimComments: [
              { id: `claim-${index + 1}`, code: '810000001', name: '患者希望', note: 'note' },
            ],
            patientRequest: index % 2 === 0,
          },
        ],
        })),
    };

    const operations = buildPrescriptionMutationOperations(order);
    expect(operations.filter((operation) => operation.operation !== 'delete').map((operation) => operation.classCode)).toEqual(
      classMatrix.map((entry) => entry.medicalClass),
    );
    expect(operations[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: '820100001',
          name: 'RP患者希望',
          memo: '__rx_claim_target__:__rp__',
        }),
        expect.objectContaining({
          genericFlg: 'no',
          userComment: '食後',
        }),
      ]),
    );
    expect(operations[0]?.items?.[0]?.memo?.startsWith('__orca_meta__:')).toBe(false);
    expect(operations.filter((operation) => operation.operation === 'delete')).toEqual([
      expect.objectContaining({
        operation: 'delete',
        documentId: 1,
        entity: 'medOrder',
      }),
    ]);

    await savePrescriptionOrder({ patientId: '000001', order });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.encounterId).toBe('F001:E100');
    expect(body.rps.map((rp: Record<string, any>) => rp.rpNumber)).toEqual(classMatrix.map((entry) => entry.rpId));
    expect(body.rps.map((rp: Record<string, any>) => rp.medicalClass)).toEqual(
      classMatrix.map((entry) => entry.medicalClass),
    );
    expect(body.rps.map((rp: Record<string, any>) => rp.medicalClassNumber)).toEqual(
      classMatrix.map((entry) => entry.medicalClassNumber),
    );
    expect(body.rps[0]).toEqual(
      expect.objectContaining({
        bundleName: '内服院内',
        usageCode: '100',
        usageName: '1日1回',
        remark: 'remark-1',
        refillCount: 1,
        refillPattern: 'standard',
        doctorComment: 'RPコメント1',
        started: '2026-03-09',
        claimComments: expect.arrayContaining([
          expect.objectContaining({ code: '820100001', text: 'RP患者希望', note: 'rp-note' }),
        ]),
        lowerFields: { lowerDrugCode: 'lower-drug' },
      }),
    );
    expect(body.rps[0].drugs[0]).toEqual(
      expect.objectContaining({
        code: '620000001',
        unit: '錠',
        numberCode: '001',
        numberCodeSystem: 'urn:orca:number',
        numberCodeName: 'number-name',
        genericChangeAllowed: true,
        generalNamePrescription: false,
        drugComment: '食後',
        patientRequested: true,
        lowerFields: { lowerUsageCode: 'lower-usage' },
      }),
    );
    expect(body.rps[1].drugs[0]).toEqual(
      expect.objectContaining({
        genericChangeAllowed: false,
        generalNamePrescription: true,
        patientRequested: false,
      }),
    );
    expect(body.rps[0].drugs[0].claimComments[0]).toEqual(
      expect.objectContaining({
        code: '810000001',
        text: '患者希望',
        note: 'note',
      }),
    );
    expect(body.prescriptionSettings).toEqual([{ code: 'setting-1', name: '院内設定', value: 'enabled' }]);
    expect(body.remarks).toEqual([{ code: 'remark-1', text: '院内備考' }]);
    expect(body.doctorComments).toEqual([{ text: '全体コメント' }]);
    expect(body.deletedDocumentIds ?? undefined).toBeUndefined();
  });

  it('fetch は first-class DTO から 221/232 の location/category と generic 関連を復元する', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          found: true,
          runId: 'RUN-FETCH',
          order: {
            patientId: '000001',
            encounterId: 'F001:E200',
            encounterDate: '2026-03-09',
            performDate: '2026-03-09',
            doctorComments: [{ text: '全体コメント' }],
            prescriptionSettings: [{ code: 'setting-1', name: '院内設定', value: 'enabled' }],
            remarks: [{ code: 'remark-1', text: '院内備考' }],
            rps: [
              {
                rpNumber: 'rp-stable-001',
                bundleName: '頓服RP',
                medicalClass: '221',
                medicalClassNumber: '3',
                usageCode: '200',
                usageName: '頓服',
                started: '2026-03-09',
                remark: 'local only',
                refillCount: 2,
                refillPattern: 'alternate',
                doctorComment: 'RPコメント',
                claimComments: [{ code: '820100001', text: 'RP患者希望', note: 'rp-note' }],
                lowerFields: { lowerDrugCode: 'lower-drug' },
                drugs: [
                  {
                    code: '620000001',
                    name: 'アムロジピン',
                    quantity: '1',
                    unit: '錠',
                    numberCode: '001',
                    numberCodeSystem: 'urn:orca:number',
                    numberCodeName: 'number-name',
                    genericChangeAllowed: false,
                    generalNamePrescription: true,
                    drugComment: '食後',
                    patientRequested: false,
                    lowerFields: { lowerUsageCode: 'lower-usage' },
                    claimComments: [{ code: '810000001', text: '患者希望', note: 'note' }],
                  },
                ],
              },
              {
                rpNumber: 'rp-stable-002',
                bundleName: '外用RP',
                medicalClass: '232',
                medicalClassNumber: '4',
                usageCode: '300',
                usageName: '外用',
                started: '2026-03-09',
                remark: 'other',
                doctorComment: '外用コメント',
                drugs: [
                  {
                    code: '620000002',
                    name: 'ロサルタン',
                    quantity: '1',
                    unit: '錠',
                    genericChangeAllowed: true,
                    generalNamePrescription: false,
                    drugComment: '就寝前',
                    patientRequested: true,
                  },
                ],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchPrescriptionOrder({ patientId: '000001', from: '2026-03-09', encounterId: 'F001:E200' } as any);

    expect(result.ok).toBe(true);
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain('encounterId=F001%3AE200');
    expect(result.order).toMatchObject({ encounterId: 'F001:E200' });
    expect(result.order.prescriptionSettings).toEqual([{ code: 'setting-1', name: '院内設定', value: 'enabled' }]);
    expect(result.order.remarks).toEqual([{ code: 'remark-1', text: '院内備考' }]);
    expect(result.sourceBundles[0]?.items[0]).toEqual(
      expect.objectContaining({
        code: '820100001',
        name: 'RP患者希望',
      }),
    );
    expect(result.sourceBundles[0]?.adminCode).toBe('200');
    expect(result.sourceBundles[0]?.adminMemo).toBe('');
    expect(result.sourceBundles[0]?.items[1]).toEqual(
      expect.objectContaining({
        genericFlg: 'yes',
        userComment: '食後',
      }),
    );
    expect(result.sourceBundles[0]?.items[0]?.memo?.startsWith('__orca_meta__:')).toBe(false);
    expect(result.order.rps[0]).toEqual(
      expect.objectContaining({
        rpId: 'rp-stable-001',
        name: '頓服RP',
        location: 'in',
        category: 'tonyo',
        daysOrTimes: '3',
        usageCode: '200',
        usage: '頓服',
        remark: 'local only',
        refillCount: 2,
        refillPattern: 'alternate',
        doctorComment: 'RPコメント',
        claimComments: expect.arrayContaining([
          expect.objectContaining({ code: '820100001', name: 'RP患者希望', note: 'rp-note' }),
        ]),
        lowerDrugCode: 'lower-drug',
      }),
    );
    expect(result.order.rps[0].drugs[0]).toEqual(
      expect.objectContaining({
        code: '620000001',
        unit: '錠',
        genericChangeAllowed: false,
        isGeneralNamePrescription: true,
        drugComment: '食後',
        patientRequest: false,
        lowerUsageCode: 'lower-usage',
      }),
    );
    expect(result.order.rps[1]).toEqual(
      expect.objectContaining({
        rpId: 'rp-stable-002',
        location: 'out',
        category: 'gaiyo',
        daysOrTimes: '4',
        usageCode: '300',
        usage: '外用',
        doctorComment: '外用コメント',
      }),
    );
    expect(result.order.rps[1].drugs[0]).toEqual(
      expect.objectContaining({
        genericChangeAllowed: true,
        isGeneralNamePrescription: false,
        patientRequest: true,
      }),
    );
    expect(result.order.rps[0].drugs[0].claimComments[0]).toEqual(
      expect.objectContaining({
        code: '810000001',
        name: '患者希望',
        note: 'note',
      }),
    );
  });

  it('source bundle 経由でも RP-level claim comment note を round-trip する', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          found: true,
          runId: 'RUN-FETCH-RP-CLAIM',
          order: {
            patientId: '000001',
            encounterId: 'F001:E210',
            encounterDate: '2026-03-09',
            performDate: '2026-03-09',
            rps: [
              {
                rpNumber: 'rp-claim-roundtrip',
                bundleName: '請求コメントRP',
                medicalClass: '212',
                medicalClassNumber: '5',
                usageName: '毎食後',
                claimComments: [{ code: '850100001', text: '特記事項', note: '補足メモ' }],
                drugs: [
                  {
                    code: '620000001',
                    name: 'アムロジピン',
                    quantity: '1',
                    unit: '錠',
                    genericChangeAllowed: true,
                    generalNamePrescription: false,
                    patientRequested: true,
                    claimComments: [],
                  },
                ],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchPrescriptionOrder({ patientId: '000001', from: '2026-03-09', encounterId: 'F001:E210' } as any);
    const reconstructed = toPrescriptionOrder(result.sourceBundles, '000001', 'F001:E210');

    expect(result.ok).toBe(true);
    expect(reconstructed.rps[0]?.claimComments).toEqual([
      expect.objectContaining({
        code: '850100001',
        name: '特記事項',
        note: '補足メモ',
      }),
    ]);
  });

  it('save -> fetch -> no-op save で first-class order の generic / claim / usage 情報が落ちない', async () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterId: 'F001:E300',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '全体コメント',
      prescriptionSettings: [{ code: 'setting-1', name: '院内設定', value: 'enabled' }],
      remarks: [{ code: 'remark-1', text: '院内備考' }],
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-stable-001',
          name: '頓服RP',
          location: 'in',
          category: 'tonyo',
          usage: '頓服',
          usageCode: '200',
          daysOrTimes: '3',
          remark: 'local only',
          refillCount: 2,
          refillPattern: 'alternate',
          doctorComment: 'RPコメント',
          started: '2026-03-09',
          claimComments: [{ id: 'rp-claim-1', code: '820100001', name: 'RP患者希望', note: 'rp-note' }],
          lowerDrugCode: 'lower-drug',
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              numberCode: '001',
              numberCodeSystem: 'urn:orca:number',
              numberCodeName: 'number-name',
              genericChangeAllowed: false,
              isGeneralNamePrescription: true,
              drugComment: '食後',
              lowerUsageCode: 'lower-usage',
              claimComments: [{ id: 'claim-1', code: '810000001', name: '患者希望', note: 'note' }],
              patientRequest: false,
            },
          ],
        },
      ],
    };

    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-SAVE-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            found: true,
            runId: 'RUN-FETCH-1',
            order: {
                patientId: '000001',
                encounterId: 'F001:E300',
                encounterDate: '2026-03-09',
                performDate: '2026-03-09',
              doctorComments: [{ text: '全体コメント' }],
              prescriptionSettings: [{ code: 'setting-1', name: '院内設定', value: 'enabled' }],
              remarks: [{ code: 'remark-1', text: '院内備考' }],
              rps: [
                {
                  rpNumber: 'rp-stable-001',
                  bundleName: '頓服RP',
                  medicalClass: '221',
                  medicalClassNumber: '3',
                  usageCode: '200',
                  usageName: '頓服',
                  started: '2026-03-09',
                  remark: 'local only',
                  refillCount: 2,
                  refillPattern: 'alternate',
                  doctorComment: 'RPコメント',
                  claimComments: [{ code: '820100001', text: 'RP患者希望', note: 'rp-note' }],
                  lowerFields: { lowerDrugCode: 'lower-drug' },
                  drugs: [
                    {
                      code: '620000001',
                      name: 'アムロジピン',
                      quantity: '1',
                      unit: '錠',
                      numberCode: '001',
                      numberCodeSystem: 'urn:orca:number',
                      numberCodeName: 'number-name',
                      genericChangeAllowed: false,
                      generalNamePrescription: true,
                      drugComment: '食後',
                      patientRequested: false,
                      lowerFields: { lowerUsageCode: 'lower-usage' },
                      claimComments: [{ code: '810000001', text: '患者希望', note: 'note' }],
                    },
                  ],
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-SAVE-2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await savePrescriptionOrder({ patientId: '000001', order });
    const fetchedOrder: PrescriptionOrder = {
      ...order,
      doctorComment: '全体コメント',
      rps: [
        {
          ...order.rps[0],
          remark: 'local only',
          refillCount: 2,
          refillPattern: 'alternate',
          doctorComment: 'RPコメント',
          started: '2026-03-09',
          claimComments: [{ id: 'rp-claim-1', code: '820100001', name: 'RP患者希望', note: 'rp-note' }],
          lowerDrugCode: 'lower-drug',
          drugs: [
            {
              ...order.rps[0].drugs[0],
              genericChangeAllowed: false,
              isGeneralNamePrescription: true,
              drugComment: '食後',
              lowerUsageCode: 'lower-usage',
              claimComments: [{ id: 'claim-1', code: '810000001', name: '患者希望', note: 'note' }],
              patientRequest: false,
            },
          ],
        },
      ],
    };
    await savePrescriptionOrder({ patientId: '000001', order: fetchedOrder });

    const secondRequest = vi.mocked(httpFetch).mock.calls[1]?.[1];
    const secondBody = JSON.parse(String((secondRequest as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(secondBody.encounterId).toBe('F001:E300');
    expect(secondBody.rps[0]).toEqual(
      expect.objectContaining({
        rpNumber: 'rp-stable-001',
        medicalClass: '221',
        medicalClassNumber: '3',
        usageCode: '200',
        usageName: '頓服',
        remark: 'local only',
        refillCount: 2,
        refillPattern: 'alternate',
        doctorComment: 'RPコメント',
        claimComments: expect.arrayContaining([
          expect.objectContaining({ code: '820100001', text: 'RP患者希望', note: 'rp-note' }),
        ]),
        lowerFields: { lowerDrugCode: 'lower-drug' },
      }),
    );
    expect(secondBody.rps[0].drugs[0]).toEqual(
      expect.objectContaining({
        code: '620000001',
        numberCode: '001',
        numberCodeSystem: 'urn:orca:number',
        numberCodeName: 'number-name',
        genericChangeAllowed: false,
        generalNamePrescription: true,
        drugComment: '食後',
        patientRequested: false,
        lowerFields: { lowerUsageCode: 'lower-usage' },
      }),
    );
    expect(secondBody.rps[0].drugs[0].claimComments[0]).toEqual(
      expect.objectContaining({
        code: '810000001',
        text: '患者希望',
        note: 'note',
      }),
    );
    expect(secondBody.prescriptionSettings).toEqual([{ code: 'setting-1', name: '院内設定', value: 'enabled' }]);
    expect(secondBody.remarks).toEqual([{ code: 'remark-1', text: '院内備考' }]);
  });

  it('save は code なし請求コメントを送信前に fail-closed で拒否する', async () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '',
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-1',
          name: '処方RP',
          location: 'out',
          category: 'regular',
          usage: '1日1回',
          daysOrTimes: '1',
          remark: '',
          refillPattern: 'none',
          doctorComment: '',
          started: '2026-03-09',
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [{ id: 'claim-1', name: 'コードなしコメント' }],
              patientRequest: true,
            },
          ],
        },
      ],
    };

    await expect(savePrescriptionOrder({ patientId: '000001', order })).rejects.toThrow(
      'RP1 薬剤1: 請求コメントコード未入力のコメントは保存できません。',
    );
    expect(vi.mocked(httpFetch)).not.toHaveBeenCalled();
  });

  it('save は usageCode が無くても local-only usage として保存できる', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ runId: 'RUN-SAVE-NO-USAGE-CODE' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '',
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-1',
          name: '自由用法RP',
          location: 'out',
          category: 'regular',
          usage: '食後すぐ',
          usageCode: undefined,
          daysOrTimes: '1',
          remark: '',
          refillPattern: 'none',
          doctorComment: '',
          started: '2026-03-09',
          claimComments: [],
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [],
              patientRequest: true,
            },
          ],
        },
      ],
    };

    await expect(savePrescriptionOrder({ patientId: '000001', order })).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.rps[0]).toEqual(
      expect.objectContaining({
        usageName: '食後すぐ',
      }),
    );
    expect(body.rps[0]?.usageCode).toBeUndefined();
  });

  it('send bundle は usage/admin/adminCode/adminMemo を ORCA send path へ出さない', () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '',
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-1',
          name: '送信RP',
          location: 'out',
          category: 'regular',
          usage: '毎食後',
          usageCode: '001000',
          daysOrTimes: '7',
          remark: 'local note',
          refillPattern: 'none',
          doctorComment: '',
          started: '2026-03-09',
          claimComments: [{ id: 'rp-claim-1', code: '820100001', name: 'RP患者希望', note: 'rp-note' }],
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [],
              patientRequest: true,
            },
          ],
        },
      ],
    };

    const bundles = buildPrescriptionOrderSendBundles(order);

    expect(bundles[0]).toEqual(
      expect.objectContaining({
        admin: '',
        adminMemo: '',
      }),
    );
    expect(bundles[0]?.adminCode).toBeUndefined();
    expect(bundles[0]?.memo).not.toContain('"usageCode"');
    expect(bundles[0]?.memo).toContain('"claimComments"');
  });


  it('save は RP-level code なし請求コメントも送信前に fail-closed で拒否する', async () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '',
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-1',
          name: '処方RP',
          location: 'out',
          category: 'regular',
          usage: '1日1回',
          daysOrTimes: '1',
          remark: '',
          refillPattern: 'none',
          doctorComment: '',
          started: '2026-03-09',
          claimComments: [{ id: 'rp-claim-1', name: 'コードなしRPコメント' }],
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [],
              patientRequest: true,
            },
          ],
        },
      ],
    };

    await expect(savePrescriptionOrder({ patientId: '000001', order })).rejects.toThrow(
      'RP1 RPコメント: 請求コメントコード未入力のコメントは保存できません。',
    );
    expect(vi.mocked(httpFetch)).not.toHaveBeenCalled();
  });

  it('save は 85/831 系 claim comment の note 欠落を fail-closed にする', async () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '',
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-1',
          name: '処方RP',
          location: 'out',
          category: 'regular',
          usage: '1日1回',
          usageCode: '001000',
          daysOrTimes: '1',
          remark: '',
          refillPattern: 'none',
          doctorComment: '',
          started: '2026-03-09',
          claimComments: [{ id: 'rp-claim-1', code: '850100001', name: '特記事項', note: '' }],
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [],
              patientRequest: true,
            },
          ],
        },
      ],
    };

    await expect(savePrescriptionOrder({ patientId: '000001', order })).rejects.toThrow('RP1 RPコメント: 850100001 系コメントは補足値が必須です。');
    expect(vi.mocked(httpFetch)).not.toHaveBeenCalled();
  });

  it('save は unknown structured family を引き続き fail-closed にする', async () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '',
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-1',
          name: '処方RP',
          location: 'out',
          category: 'regular',
          usage: '1日1回',
          daysOrTimes: '1',
          remark: '',
          refillPattern: 'none',
          doctorComment: '',
          started: '2026-03-09',
          claimComments: [{ id: 'rp-claim-1', code: '850000001', name: '未対応構造化コメント', note: 'x' }],
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [],
              patientRequest: true,
            },
          ],
        },
      ],
    };

    await expect(savePrescriptionOrder({ patientId: '000001', order })).rejects.toThrow(
      'RP1 RPコメント: 850000001 系コメント family は未対応のため保存できません。',
    );
    expect(vi.mocked(httpFetch)).not.toHaveBeenCalled();
  });
});
