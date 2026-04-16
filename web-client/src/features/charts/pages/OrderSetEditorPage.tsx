import { useEffect, useMemo, useState } from 'react';
import { ReturnToBar } from '../../shared/ReturnToBar';
import { FocusTrapDialog } from '../../../components/modals/FocusTrapDialog';

import { useSession } from '../../../AppRouter';
import { buildFacilityPath } from '../../../routes/facilityRoutes';
import { useNavigationGuard } from '../../../routes/NavigationGuardProvider';
import { useAppNavigation } from '../../../routes/useAppNavigation';
import {
  deleteChartOrderSet,
  listChartOrderSets,
  saveChartOrderSet,
  type ChartOrderSetEntry,
  type ChartOrderSetTemplateSnapshot,
} from '../chartOrderSetStorage';

const cloneSnapshot = (snapshot: ChartOrderSetTemplateSnapshot): ChartOrderSetTemplateSnapshot => {
  return {
    ...snapshot,
    diagnoses: snapshot.diagnoses.map((item) => ({ ...item })),
    orderBundles: snapshot.orderBundles.map((bundle) => ({
      ...bundle,
      items: (bundle.items ?? []).map((item) => ({ ...item })),
    })),
  };
};

export function OrderSetEditorPage() {
  const session = useSession();
  const appNav = useAppNavigation({ facilityId: session.facilityId, userId: session.userId });
  const { registerDirty } = useNavigationGuard();
  const fallbackUrl = useMemo(() => buildFacilityPath(session.facilityId, '/charts'), [session.facilityId]);
  const [sets, setSets] = useState<ChartOrderSetEntry[]>(() => listChartOrderSets(session.facilityId, session.userId));
  const [selectedId, setSelectedId] = useState<string>(() => listChartOrderSets(session.facilityId, session.userId)[0]?.id ?? '');
  const [name, setName] = useState('');
  const [snapshot, setSnapshot] = useState<ChartOrderSetTemplateSnapshot | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const selectedSet = useMemo(
    () => sets.find((item) => item.id === selectedId) ?? null,
    [selectedId, sets],
  );
  const pendingSet = useMemo(
    () => (pendingSetId ? sets.find((item) => item.id === pendingSetId) ?? null : null),
    [pendingSetId, sets],
  );

  const isDirty = useMemo(() => {
    if (!selectedSet || !snapshot) return false;
    if (name !== selectedSet.name) return true;
    try {
      return JSON.stringify(snapshot) !== JSON.stringify(selectedSet.snapshot);
    } catch {
      return true;
    }
  }, [name, selectedSet, snapshot]);

  useEffect(() => {
    if (!selectedSet) {
      setName('');
      setSnapshot(null);
      return;
    }
    setName(selectedSet.name);
    setSnapshot(cloneSnapshot(selectedSet.snapshot));
  }, [selectedSet]);

  useEffect(() => {
    registerDirty('orderSets', isDirty, 'オーダーセットの未保存変更');
  }, [isDirty, registerDirty]);

  useEffect(() => {
    return () => registerDirty('orderSets', false);
  }, [registerDirty]);

  const refreshSets = (preferredId?: string) => {
    const next = listChartOrderSets(session.facilityId, session.userId);
    setSets(next);
    if (next.length === 0) {
      setSelectedId('');
      return;
    }
    const targetId = preferredId ?? selectedId;
    if (targetId && next.some((item) => item.id === targetId)) {
      setSelectedId(targetId);
      return;
    }
    setSelectedId(next[0].id);
  };

  const handleSave = () => {
    if (!selectedSet || !snapshot) return;
    const saved = saveChartOrderSet({
      facilityId: session.facilityId,
      userId: session.userId,
      id: selectedSet.id,
      name,
      snapshot,
    });
    refreshSets(saved.id);
    setNotice({ tone: 'success', message: 'オーダーセットを更新しました。' });
  };

  const requestSelectSet = (nextId: string) => {
    if (nextId === selectedId) return;
    if (!isDirty) {
      setSelectedId(nextId);
      return;
    }
    setPendingSetId(nextId);
    setSwitchDialogOpen(true);
  };

  const closeSwitchDialog = () => {
    setSwitchDialogOpen(false);
    setPendingSetId(null);
  };

  const handleSaveAndSwitch = () => {
    if (!pendingSetId) {
      setSwitchDialogOpen(false);
      return;
    }
    if (!selectedSet || !snapshot) {
      setSelectedId(pendingSetId);
      closeSwitchDialog();
      return;
    }
    try {
      const saved = saveChartOrderSet({
        facilityId: session.facilityId,
        userId: session.userId,
        id: selectedSet.id,
        name,
        snapshot,
      });
      refreshSets(pendingSetId);
      setNotice({
        tone: 'success',
        message: `保存して「${pendingSet?.name ?? pendingSetId}」へ切替えました。`,
      });
      if (saved.id !== selectedSet.id) {
        setNotice({
          tone: 'info',
          message: '保存対象が変更されたため、内容を再確認してください。',
        });
      }
      closeSwitchDialog();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `保存に失敗したため切替を中止しました: ${detail}` });
    }
  };

  const handleDiscardAndSwitch = () => {
    if (!pendingSetId) {
      closeSwitchDialog();
      return;
    }
    setSelectedId(pendingSetId);
    setNotice({ tone: 'info', message: `変更を破棄して「${pendingSet?.name ?? pendingSetId}」へ切替えました。` });
    closeSwitchDialog();
  };

  const handleDelete = () => {
    if (!selectedSet) return;
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedSet) return;
    setDeleteDialogOpen(false);
    const deleted = deleteChartOrderSet({ facilityId: session.facilityId, userId: session.userId, id: selectedSet.id });
    if (!deleted) {
      setNotice({ tone: 'error', message: '削除対象のオーダーセットが見つかりませんでした。' });
      return;
    }
    refreshSets();
    setNotice({ tone: 'success', message: 'オーダーセットを削除しました。' });
  };

  return (
    <main className="page-shell" style={{ maxWidth: 1120, margin: '0 auto', padding: '1rem' }}>
      <ReturnToBar
        scope={{ facilityId: session.facilityId, userId: session.userId }}
        returnTo={appNav.returnToCandidate}
        from={appNav.fromCandidate}
        fallbackUrl={fallbackUrl}
      />
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>オーダーセット編集</h1>
          <p style={{ margin: 0, color: '#555' }}>
            セットの名称と内訳（病名/オーダー）を編集します。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => refreshSets()}>
            再読込
          </button>
        </div>
      </header>

      {notice ? (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            borderRadius: 8,
            border: '1px solid #d0d7de',
            background: notice.tone === 'error' ? '#fff1f0' : notice.tone === 'success' ? '#ecfdf3' : '#f6f8fa',
          }}
        >
          {notice.message}
        </div>
      ) : null}

      <FocusTrapDialog
        open={switchDialogOpen}
        role="alertdialog"
        title="未保存の変更があります"
        description="保存して切替えるか、破棄して切替えるか、キャンセルするかを選択してください。"
        onClose={closeSwitchDialog}
        testId="order-set-switch-dialog"
      >
        <section className="charts-tab-guard" aria-label="オーダーセット切替確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>現在のセット</dt>
              <dd>{selectedSet?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>切替先セット</dt>
              <dd>{pendingSet?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>未保存対象</dt>
              <dd>名称 / 候補病名 / オーダー</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>保存しない場合、現在セットの未保存変更が失われます。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="オーダーセット切替操作">
            <button type="button" onClick={closeSwitchDialog}>
              キャンセル
            </button>
            <button type="button" onClick={handleSaveAndSwitch}>
              保存して切替
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={handleDiscardAndSwitch}>
              破棄して切替
            </button>
          </div>
        </section>
      </FocusTrapDialog>

      <FocusTrapDialog
        open={deleteDialogOpen}
        role="alertdialog"
        title="オーダーセットを削除しますか？"
        description="削除対象と影響範囲を確認して実行してください。"
        onClose={() => setDeleteDialogOpen(false)}
        testId="order-set-delete-dialog"
      >
        <section className="charts-tab-guard" aria-label="オーダーセット削除確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>削除対象</dt>
              <dd>{selectedSet?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>内容</dt>
              <dd>候補病名 {selectedSet?.snapshot.diagnoses.length ?? 0}件 / オーダー {selectedSet?.snapshot.orderBundles.length ?? 0}件</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>オーダーセット定義が削除され、元に戻せません。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="オーダーセット削除操作">
            <button type="button" onClick={() => setDeleteDialogOpen(false)}>
              キャンセル
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={handleConfirmDelete}>
              削除する
            </button>
          </div>
        </section>
      </FocusTrapDialog>

      <section style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem' }}>
        <aside style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>登録済みセット</h2>
          {sets.length === 0 ? <p>登録済みセットがありません。</p> : null}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {sets.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => requestSelectSet(item.id)}
                aria-pressed={selectedId === item.id}
                style={{
                  textAlign: 'left',
                  border: selectedId === item.id ? '2px solid #0969da' : '1px solid #d0d7de',
                  borderRadius: 8,
                  padding: '0.5rem',
                  background: selectedId === item.id ? '#eaf3ff' : '#fff',
                }}
              >
                <strong style={{ display: 'block' }}>{item.name}</strong>
                <small>候補病名 {item.snapshot.diagnoses.length}件 / オーダー {item.snapshot.orderBundles.length}件</small>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: '0.75rem' }}>
          {!selectedSet || !snapshot ? (
            <p>左の一覧からオーダーセットを選択してください。</p>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span>セット名称</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例: 定期フォローセット" />
                </label>
              </div>

              <details open style={{ marginTop: '1rem' }}>
                <summary>候補病名 ({snapshot.diagnoses.length}件)</summary>
                {snapshot.diagnoses.length === 0 ? <p>候補病名データはありません。</p> : null}
                <ul>
                  {snapshot.diagnoses.map((item, index) => (
                    <li key={`${item.diagnosisCode ?? 'd'}-${index}`}>
                      {item.diagnosisName ?? '名称未設定'}
                      {item.diagnosisCode ? ` (${item.diagnosisCode})` : ''}
                      <small style={{ marginLeft: '0.5rem', color: '#555' }}>候補のみ。保険病名へ自動登録しません。</small>
                      <button
                        type="button"
                        onClick={() =>
                          setSnapshot((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  diagnoses: prev.diagnoses.filter((_, idx) => idx !== index),
                                }
                              : prev,
                          )
                        }
                        style={{ marginLeft: '0.5rem' }}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              </details>

              <details open style={{ marginTop: '0.75rem' }}>
                <summary>オーダー ({snapshot.orderBundles.length}件)</summary>
                {snapshot.orderBundles.length === 0 ? <p>オーダーはありません。</p> : null}
                <ul>
                  {snapshot.orderBundles.map((bundle, index) => (
                    <li key={`${bundle.entity ?? 'order'}-${bundle.bundleName ?? index}-${index}`}>
                      {bundle.entity ?? 'entity未設定'} / {bundle.bundleName ?? '名称未設定'} / 項目 {bundle.items.length}件
                      <button
                        type="button"
                        onClick={() =>
                          setSnapshot((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  orderBundles: prev.orderBundles.filter((_, idx) => idx !== index),
                                }
                              : prev,
                          )
                        }
                        style={{ marginLeft: '0.5rem' }}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              </details>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleSave}>更新</button>
                <button type="button" onClick={handleDelete}>削除</button>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
