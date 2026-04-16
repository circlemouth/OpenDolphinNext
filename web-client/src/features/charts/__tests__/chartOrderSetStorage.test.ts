import { afterEach, describe, expect, it } from 'vitest';
import { buildScopedStorageKey } from '../../../libs/session/storageScope';

import {
  CHART_ORDER_SET_STORAGE_BASE,
  CHART_ORDER_SET_STORAGE_VERSION,
  clearChartOrderSetStorage,
  deleteChartOrderSet,
  getChartOrderSet,
  listChartOrderSets,
  saveChartOrderSet,
  type ChartOrderSetTemplateSnapshot,
} from '../chartOrderSetStorage';

afterEach(() => {
  clearChartOrderSetStorage();
});

describe('chartOrderSetStorage', () => {
  it('オーダーセットを保存して一覧/詳細取得できる', () => {
    const saved = saveChartOrderSet({
      facilityId: 'facility-A',
      userId: 'doctor-1',
      name: '定期フォローセット',
      snapshot: {
        diagnoses: [{ diagnosisName: '高血圧症', diagnosisCode: 'I10' }],
        orderBundles: [
          {
            entity: 'medOrder',
            bundleName: '降圧薬',
            classCode: '212',
            className: '内服',
            items: [{ code: 'A100', name: 'アムロジピン', quantity: '1', unit: '錠' }],
          },
        ],
      },
    });

    const list = listChartOrderSets('facility-A', 'doctor-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(saved.id);
    expect(list[0].name).toBe('定期フォローセット');

    const detail = getChartOrderSet({ facilityId: 'facility-A', userId: 'doctor-1', id: saved.id });
    expect(detail).not.toBeNull();
    expect(detail?.snapshot.diagnoses[0]).toEqual({
      diagnosisName: '高血圧症',
      diagnosisCode: 'I10',
      layer: 'candidate',
      readOnly: true,
      candidateOnly: true,
      note: '候補です。オーダーセット適用時も保険病名へ自動登録しません。',
    });
    expect(detail?.snapshot.orderBundles[0]).toEqual(
      expect.objectContaining({
        entity: 'medOrder',
        bundleName: '降圧薬',
        classCode: '212',
        className: '内服',
      }),
    );
  });

  it('オーダーセットを削除できる', () => {
    const saved = saveChartOrderSet({
      facilityId: 'facility-A',
      userId: 'doctor-1',
      name: '削除テスト',
      snapshot: {
        diagnoses: [],
        orderBundles: [{ entity: 'testOrder', bundleName: '採血', items: [{ name: 'CBC' }] }],
      },
    });

    expect(deleteChartOrderSet({ facilityId: 'facility-A', userId: 'doctor-1', id: saved.id })).toBe(true);
    expect(listChartOrderSets('facility-A', 'doctor-1')).toHaveLength(0);
  });

  it('save後のlocalStorage JSONに禁止フィールドを保存しない', () => {
    const snapshotWithForbiddenFields = {
      sourcePatientId: 'P-SECRET',
      sourceVisitDate: '2026-02-11',
      capturedAt: '2026-02-11T11:00:00.000Z',
      diagnoses: [
        {
          diagnosisId: 1,
          diagnosisName: '高血圧症',
          diagnosisCode: 'I10',
          departmentCode: '01',
          insuranceCombinationNumber: '0001',
          startDate: '2026-02-01',
        },
      ],
      soapDraft: {
        free: '自由記載',
        subjective: '主訴',
        objective: '所見',
        assessment: '評価',
        plan: '計画',
      },
      soapHistory: [
        {
          id: 'soap-1',
          section: 'subjective',
          body: '本文',
          authoredAt: '2026-02-11T10:00:00.000Z',
          authorRole: 'doctor',
          action: 'add',
          patientId: 'P-SECRET',
        },
      ],
      orderBundles: [
        {
          documentId: 100,
          moduleId: 200,
          entity: 'medOrder',
          bundleName: '降圧薬',
          bundleNumber: '14',
          classCode: '212',
          className: '内服',
          admin: '1日1回 朝',
          memo: 'メモ',
          started: '2026-02-11',
          items: [{ code: 'A100', name: 'アムロジピン', quantity: '1', unit: '錠' }],
        },
      ],
      imageAttachments: [{ id: 10, title: '胸部X線', fileName: 'cxr.png' }],
    };

    saveChartOrderSet({
      facilityId: 'facility-A',
      userId: 'doctor-1',
      name: 'PHI除外確認',
      snapshot: snapshotWithForbiddenFields as unknown as ChartOrderSetTemplateSnapshot,
    });

    const scopedKey = buildScopedStorageKey(CHART_ORDER_SET_STORAGE_BASE, CHART_ORDER_SET_STORAGE_VERSION, {
      facilityId: 'facility-A',
      userId: 'doctor-1',
    });
    expect(scopedKey).toBeTruthy();

    const raw = localStorage.getItem(scopedKey!);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    const items = Array.isArray(parsed.items) ? (parsed.items as Array<Record<string, unknown>>) : [];
    expect(items).toHaveLength(1);
    const snapshot = (items[0]?.snapshot ?? {}) as Record<string, unknown>;

    expect(snapshot).not.toHaveProperty('sourcePatientId');
    expect(snapshot).not.toHaveProperty('sourceVisitDate');
    expect(snapshot).not.toHaveProperty('capturedAt');
    expect(snapshot).not.toHaveProperty('soapDraft');
    expect(snapshot).not.toHaveProperty('soapHistory');
    expect(snapshot).not.toHaveProperty('imageAttachments');

    const diagnoses = Array.isArray(snapshot.diagnoses) ? (snapshot.diagnoses as Array<Record<string, unknown>>) : [];
    expect(diagnoses[0]).toEqual({
      diagnosisName: '高血圧症',
      diagnosisCode: 'I10',
      layer: 'candidate',
      readOnly: true,
      candidateOnly: true,
      note: '候補です。オーダーセット適用時も保険病名へ自動登録しません。',
    });
    expect(diagnoses[0]).not.toHaveProperty('departmentCode');
    expect(diagnoses[0]).not.toHaveProperty('diagnosisId');

    const bundles = Array.isArray(snapshot.orderBundles) ? (snapshot.orderBundles as Array<Record<string, unknown>>) : [];
    expect(bundles[0]).toEqual(
      expect.objectContaining({
        entity: 'medOrder',
        bundleName: '降圧薬',
        classCode: '212',
        className: '内服',
      }),
    );
    expect(bundles[0]).not.toHaveProperty('documentId');
    expect(bundles[0]).not.toHaveProperty('moduleId');
    expect(bundles[0]).not.toHaveProperty('bundleNumber');
    expect(bundles[0]).not.toHaveProperty('admin');
    expect(bundles[0]).not.toHaveProperty('memo');
    expect(bundles[0]).not.toHaveProperty('started');
  });

  it('v1キーはlist呼び出し時にv2へ移行後、必ず削除される', () => {
    const legacyKey = 'opendolphin:web-client:charts:order-sets:v1';
    localStorage.setItem(
      legacyKey,
      JSON.stringify({
        version: 1,
        updatedAt: '2026-02-11T11:00:00.000Z',
        items: [
          {
            id: 'legacy-1',
            facilityId: 'facility-A',
            createdBy: 'doctor-1',
            name: '旧セット',
            createdAt: '2026-02-11T11:00:00.000Z',
            updatedAt: '2026-02-11T11:00:00.000Z',
            snapshot: {
              sourcePatientId: 'P-1',
              sourceVisitDate: '2026-02-11',
              capturedAt: '2026-02-11T11:00:00.000Z',
              diagnoses: [{ diagnosisName: '高血圧症', diagnosisCode: 'I10', departmentCode: '01' }],
              soapDraft: { free: '旧SOAP', subjective: '', objective: '', assessment: '', plan: '' },
              soapHistory: [{ id: 's1', section: 'subjective', body: '履歴', authoredAt: '', authorRole: '', action: 'add' }],
              imageAttachments: [{ id: 1, title: '画像' }],
              orderBundles: [
                {
                  documentId: 999,
                  moduleId: 555,
                  entity: 'medOrder',
                  bundleName: '旧処方',
                  bundleNumber: '1',
                  classCode: '212',
                  className: '内服',
                  items: [{ code: 'A100', name: 'アムロジピン' }],
                },
              ],
            },
          },
        ],
      }),
    );

    const migrated = listChartOrderSets('facility-A', 'doctor-1');
    expect(migrated).toHaveLength(1);
    expect(migrated[0].snapshot.diagnoses).toEqual([
      {
        diagnosisName: '高血圧症',
        diagnosisCode: 'I10',
        layer: 'candidate',
        readOnly: true,
        candidateOnly: true,
        note: '候補です。オーダーセット適用時も保険病名へ自動登録しません。',
      },
    ]);
    expect(migrated[0].snapshot.orderBundles).toHaveLength(1);
    expect(migrated[0].snapshot.orderBundles[0]).not.toHaveProperty('documentId');
    const migratedSnapshotTyped = migrated[0].snapshot as unknown as Record<string, unknown>;
    expect(migratedSnapshotTyped).not.toHaveProperty('soapDraft');
    expect(migratedSnapshotTyped).not.toHaveProperty('imageAttachments');
    expect(localStorage.getItem(legacyKey)).toBeNull();

    const scopedKey = buildScopedStorageKey(CHART_ORDER_SET_STORAGE_BASE, CHART_ORDER_SET_STORAGE_VERSION, {
      facilityId: 'facility-A',
      userId: 'doctor-1',
    });
    expect(scopedKey).toBeTruthy();
    const migratedRaw = localStorage.getItem(scopedKey!);
    expect(migratedRaw).toBeTruthy();
    const migratedJson = JSON.parse(migratedRaw ?? '{}') as Record<string, unknown>;
    const migratedItems = Array.isArray(migratedJson.items) ? (migratedJson.items as Array<Record<string, unknown>>) : [];
    const migratedSnapshot = (migratedItems[0]?.snapshot ?? {}) as Record<string, unknown>;
    expect(migratedSnapshot).not.toHaveProperty('sourcePatientId');
    expect(migratedSnapshot).not.toHaveProperty('soapDraft');
  });
});
