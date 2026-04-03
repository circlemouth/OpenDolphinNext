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
  buildPrescriptionMutationOperations,
  fetchPrescriptionOrder,
  savePrescriptionOrder,
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
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '全体コメント',
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
        drugs: [
          {
            rowId: `drug-${index + 1}`,
            code: '620000001',
            name: 'アムロジピン',
            quantity: '1',
            unit: '錠',
            genericChangeAllowed: index % 2 === 0,
            isGeneralNamePrescription: index % 2 === 1,
            drugComment: '食後',
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
    expect(operations[0]?.items?.[0]).toEqual(
      expect.objectContaining({
        genericFlg: 'yes',
        userComment: '食後',
      }),
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
      }),
    );
    expect(body.rps[0].drugs[0]).toEqual(
      expect.objectContaining({
        code: '620000001',
        unit: '錠',
        genericChangeAllowed: true,
        generalNamePrescription: false,
        drugComment: '食後',
        patientRequested: true,
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
            encounterDate: '2026-03-09',
            performDate: '2026-03-09',
            doctorComments: [{ text: '全体コメント' }],
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
                drugs: [
                  {
                    code: '620000001',
                    name: 'アムロジピン',
                    quantity: '1',
                    unit: '錠',
                    genericChangeAllowed: false,
                    generalNamePrescription: true,
                    drugComment: '食後',
                    patientRequested: false,
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

    const result = await fetchPrescriptionOrder({ patientId: '000001', from: '2026-03-09' });

    expect(result.ok).toBe(true);
    expect(result.order.doctorComment).toBe('全体コメント');
    expect(result.sourceBundles[0]?.items[0]).toEqual(
      expect.objectContaining({
        genericFlg: 'no',
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

  it('save -> fetch -> no-op save で first-class order の generic / claim / usage 情報が落ちない', async () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '全体コメント',
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
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
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
              encounterDate: '2026-03-09',
              performDate: '2026-03-09',
              doctorComments: [{ text: '全体コメント' }],
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
                  drugs: [
                    {
                      code: '620000001',
                      name: 'アムロジピン',
                      quantity: '1',
                      unit: '錠',
                      genericChangeAllowed: false,
                      generalNamePrescription: true,
                      drugComment: '食後',
                      patientRequested: false,
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
    const fetched = await fetchPrescriptionOrder({ patientId: '000001', from: '2026-03-09' });
    await savePrescriptionOrder({ patientId: '000001', order: fetched.order });

    const secondRequest = vi.mocked(httpFetch).mock.calls[2]?.[1];
    const secondBody = JSON.parse(String((secondRequest as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

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
      }),
    );
    expect(secondBody.rps[0].drugs[0]).toEqual(
      expect.objectContaining({
        code: '620000001',
        genericChangeAllowed: false,
        generalNamePrescription: true,
        drugComment: '食後',
        patientRequested: false,
      }),
    );
    expect(secondBody.rps[0].drugs[0].claimComments[0]).toEqual(
      expect.objectContaining({
        code: '810000001',
        text: '患者希望',
        note: 'note',
      }),
    );
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
});
