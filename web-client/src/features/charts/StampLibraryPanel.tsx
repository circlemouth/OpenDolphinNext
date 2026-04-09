import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { readStoredAuth } from '../../libs/auth/storedAuth';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { useOptionalSession } from '../../AppRouter';
import { readStoredSession } from '../../libs/session/storedSession';
import type { OrderBundleItem } from './orderBundleApi';
import { resolveCanonicalOrderEntity } from './orderCategoryRegistry';
import { fetchStampDetail, fetchStampTree, type StampBundleJson, type StampTree } from './stampApi';
import {
  deleteLocalStamp,
  loadLocalStamps,
  loadStampClipboard,
  saveLocalStamp,
  saveStampClipboard,
  updateLocalStamp,
  type LocalStampEntry,
  type StampClipboardEntry,
} from './stampStorage';

type StampLibraryPanelProps = {
  phase: 1 | 2;
};

type EntityFilter = 'all' | string;

type ServerStampListItem = {
  source: 'server';
  treeName: string;
  entity: string;
  stampId: string;
  name: string;
  memo?: string;
};

type LocalStampListItem = {
  source: 'local';
  category: string;
  target: string;
  entity: string;
  id: string;
  name: string;
  stamp: LocalStampEntry;
};

type StampListItem = ServerStampListItem | LocalStampListItem;

type StampNotice = { tone: 'info' | 'success' | 'error'; message: string };

type StampEditorState = {
  localStampId?: string;
  name: string;
  category: string;
  target: string;
  bundle: LocalStampEntry['bundle'];
};

const DEFAULT_STAMP_TARGET = 'medOrder';

const STAMP_TARGET_OPTIONS = [
  { value: 'medOrder', label: '処方' },
  { value: 'injectionOrder', label: '注射' },
  { value: 'treatmentOrder', label: '処置' },
  { value: 'surgeryOrder', label: '手術' },
  { value: 'testOrder', label: '検査' },
  { value: 'physiologyOrder', label: '生理検査' },
  { value: 'bacteriaOrder', label: '細菌検査' },
  { value: 'radiologyOrder', label: '画像診断' },
  { value: 'otherOrder', label: 'その他' },
] as const;

const buildEmptyItem = (): OrderBundleItem => ({ name: '', quantity: '', unit: '', memo: '' });

const buildEmptyBundle = (today: string): LocalStampEntry['bundle'] => ({
  bundleName: '',
  admin: '',
  bundleNumber: '1',
  adminMemo: '',
  memo: '',
  startDate: today,
  items: [buildEmptyItem()],
});

const buildInitialEditor = (today: string): StampEditorState => ({
  name: '',
  category: '',
  target: DEFAULT_STAMP_TARGET,
  bundle: buildEmptyBundle(today),
});

const cloneBundle = (bundle: LocalStampEntry['bundle']): LocalStampEntry['bundle'] => ({
  ...bundle,
  items: (bundle.items ?? []).map((item) => ({ ...item })),
});

const normalizeStampEntity = (value?: string | null) => {
  const normalized = value?.trim();
  if (!normalized) return '';
  return resolveCanonicalOrderEntity(normalized) ?? normalized;
};

const toLocalBundleFromStamp = (stamp: StampBundleJson, today: string): LocalStampEntry['bundle'] => ({
  bundleName: stamp.orderName ?? stamp.className ?? '',
  admin: stamp.admin ?? '',
  bundleNumber: stamp.bundleNumber ?? '1',
  classCode: stamp.classCode,
  classCodeSystem: stamp.classCodeSystem,
  className: stamp.className,
  adminMemo: stamp.adminMemo ?? '',
  memo: stamp.memo ?? '',
  startDate: today,
  items:
    stamp.claimItem && stamp.claimItem.length > 0
      ? stamp.claimItem.map((item): OrderBundleItem => ({
          name: item.name ?? '',
          quantity: item.number ?? '',
          unit: item.unit ?? '',
          memo: item.memo ?? '',
        }))
      : [buildEmptyItem()],
});

const toClipboardEntryFromLocalStamp = (stamp: LocalStampEntry): StampClipboardEntry => ({
  savedAt: new Date().toISOString(),
  source: 'local',
  stampId: stamp.id,
  name: stamp.name,
  category: stamp.category,
  target: stamp.target,
  entity: stamp.entity,
  bundle: stamp.bundle,
});

const toClipboardEntryFromStamp = (
  stamp: StampBundleJson,
  today: string,
  meta: { name?: string; category?: string; target: string; entity: string; stampId?: string },
): StampClipboardEntry => ({
  savedAt: new Date().toISOString(),
  source: 'server',
  stampId: meta.stampId,
  name: meta.name ?? stamp.orderName ?? stamp.className ?? '',
  category: meta.category ?? '',
  target: meta.target,
  entity: meta.entity,
  bundle: toLocalBundleFromStamp(stamp, today),
});

const matchesQuery = (candidate: string, query: string) => {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return candidate.toLowerCase().includes(needle);
};

const normalizeTreeName = (treeName?: string | null) => (treeName && treeName.trim() ? treeName.trim() : '（未分類）');

const collectStampTreeEntities = (trees: StampTree[]) =>
  Array.from(new Set(trees.map((tree) => tree.entity).filter((value) => value && value.trim()))).sort();

const groupByKey = <T,>(items: T[], keyOf: (item: T) => string) => {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyOf(item) || '（未分類）';
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  });
  return map;
};

const toStampKey = (item: StampListItem) => (item.source === 'local' ? `local::${item.id}` : `server::${item.stampId}`);

export function StampLibraryPanel({ phase }: StampLibraryPanelProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const session = useOptionalSession();
  const storedAuth = useMemo(() => readStoredAuth(), []);
  const storedSession = useMemo(() => readStoredSession(), []);
  const userName = storedAuth ? `${storedAuth.facilityId}:${storedAuth.userId}` : null;
  const userPk = useMemo(() => {
    if (typeof session?.userPk === 'number' && Number.isFinite(session.userPk) && session.userPk > 0) {
      return session.userPk;
    }
    if (typeof storedSession?.userPk === 'number' && Number.isFinite(storedSession.userPk) && storedSession.userPk > 0) {
      return storedSession.userPk;
    }
    return undefined;
  }, [session?.userPk, storedSession?.userPk]);

  const [query, setQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [selectedKey, setSelectedKey] = useState('');
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<StampNotice | null>(null);
  const [localStamps, setLocalStamps] = useState<LocalStampEntry[]>([]);
  const [clipboard, setClipboard] = useState<StampClipboardEntry | null>(null);
  const [editor, setEditor] = useState<StampEditorState>(() => buildInitialEditor(today));
  const [deleteLocalDialogOpen, setDeleteLocalDialogOpen] = useState(false);

  useEffect(() => {
    if (!userName) {
      setLocalStamps([]);
      return;
    }
    setLocalStamps(loadLocalStamps(userName));
  }, [userName]);

  useEffect(() => {
    if (!userName) {
      setClipboard(null);
      return;
    }
    setClipboard(loadStampClipboard(userName));
  }, [userName]);

  const stampTreeQuery = useQuery({
    queryKey: ['stamp-library-tree', userPk],
    queryFn: () => {
      if (!userPk) throw new Error('userPk is required');
      return fetchStampTree(userPk);
    },
    enabled: typeof userPk === 'number' && userPk > 0,
  });

  const trees = stampTreeQuery.data?.trees ?? [];

  const serverItems = useMemo((): ServerStampListItem[] => {
    const list: ServerStampListItem[] = [];
    trees.forEach((tree) => {
      const treeName = normalizeTreeName(tree.treeName);
      const stamps = Array.isArray(tree.stampList) ? tree.stampList : [];
      stamps.forEach((stamp) => {
        list.push({
          source: 'server',
          treeName,
          entity: tree.entity,
          stampId: stamp.stampId,
          name: stamp.name,
          memo: stamp.memo,
        });
      });
    });
    return list;
  }, [trees]);

  const localItems = useMemo((): LocalStampListItem[] => {
    return localStamps.map((stamp) => ({
      source: 'local',
      category: stamp.category?.trim() ? stamp.category : '（未分類）',
      target: normalizeStampEntity(stamp.target),
      entity: normalizeStampEntity(stamp.entity),
      id: stamp.id,
      name: stamp.name,
      stamp,
    }));
  }, [localStamps]);

  const selected = useMemo<StampListItem | null>(() => {
    if (!selectedKey) return null;
    const [source, id] = selectedKey.split('::');
    if (source === 'local') {
      return localItems.find((item) => item.id === id) ?? null;
    }
    if (source === 'server') {
      return serverItems.find((item) => item.stampId === id) ?? null;
    }
    return null;
  }, [localItems, selectedKey, serverItems]);

  useEffect(() => {
    if (selectedKey && !selected) {
      setSelectedKey('');
    }
  }, [selected, selectedKey]);

  const selectedStampId = selected?.source === 'server' ? selected.stampId : null;
  const stampDetailQuery = useQuery({
    queryKey: ['stamp-library-detail', selectedStampId],
    queryFn: () => {
      if (!selectedStampId) throw new Error('stampId is required');
      return fetchStampDetail(selectedStampId);
    },
    enabled: Boolean(selectedStampId),
  });

  const entities = useMemo(() => {
    const treeEntities = collectStampTreeEntities(trees);
    const localEntities = localStamps
      .flatMap((stamp) => [normalizeStampEntity(stamp.target), normalizeStampEntity(stamp.entity)])
      .filter((value): value is string => Boolean(value && value.trim()));
    return Array.from(new Set([...treeEntities, ...localEntities])).sort();
  }, [localStamps, trees]);

  const filteredServerItems = useMemo(() => {
    return serverItems
      .filter((item) => (entityFilter === 'all' ? true : item.entity === entityFilter))
      .filter((item) => matchesQuery(item.name, query) || matchesQuery(item.memo ?? '', query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entityFilter, query, serverItems]);

  const filteredLocalItems = useMemo(() => {
    return localItems
      .filter((item) => (entityFilter === 'all' ? true : item.target === entityFilter || item.entity === entityFilter))
      .filter((item) => matchesQuery(item.name, query) || matchesQuery(item.stamp.bundle.memo ?? '', query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entityFilter, localItems, query]);

  const groupedServer = useMemo(() => groupByKey(filteredServerItems, (item) => item.treeName), [filteredServerItems]);
  const groupedLocal = useMemo(() => groupByKey(filteredLocalItems, (item) => item.category), [filteredLocalItems]);

  const updateBundle = (patch: Partial<LocalStampEntry['bundle']>) => {
    setEditor((prev) => ({ ...prev, bundle: { ...prev.bundle, ...patch } }));
  };

  const updateBundleItem = (index: number, patch: Partial<OrderBundleItem>) => {
    setEditor((prev) => {
      const items = [...(prev.bundle.items ?? [])];
      const base = items[index] ?? buildEmptyItem();
      items[index] = { ...base, ...patch };
      return {
        ...prev,
        bundle: {
          ...prev.bundle,
          items,
        },
      };
    });
  };

  const addBundleItem = () => {
    setEditor((prev) => ({
      ...prev,
      bundle: {
        ...prev.bundle,
        items: [...(prev.bundle.items ?? []), buildEmptyItem()],
      },
    }));
  };

  const removeBundleItem = (index: number) => {
    setEditor((prev) => {
      const current = prev.bundle.items ?? [];
      const items = current.length > 1 ? current.filter((_, idx) => idx !== index) : [buildEmptyItem()];
      return {
        ...prev,
        bundle: {
          ...prev.bundle,
          items,
        },
      };
    });
  };

  const applyEditorFromLocalStamp = (stamp: LocalStampEntry) => {
    const target = normalizeStampEntity(stamp.target) || normalizeStampEntity(stamp.entity) || DEFAULT_STAMP_TARGET;
    setEditor({
      localStampId: stamp.id,
      name: stamp.name,
      category: stamp.category,
      target,
      bundle: cloneBundle(stamp.bundle),
    });
  };

  const applyEditorFromServerStamp = (item: ServerStampListItem, stamp: StampBundleJson) => {
    setEditor({
      localStampId: undefined,
      name: item.name || stamp.orderName || stamp.className || '',
      category: item.treeName,
      target: normalizeStampEntity(item.entity) || DEFAULT_STAMP_TARGET,
      bundle: toLocalBundleFromStamp(stamp, today),
    });
  };

  const normalizeEditorEntry = (): Omit<LocalStampEntry, 'id' | 'savedAt'> | null => {
    const name = editor.name.trim();
    if (!name) {
      setEditorNotice({ tone: 'error', message: '編集スタンプ名称を入力してください。' });
      return null;
    }
    const target = editor.target.trim();
    if (!target) {
      setEditorNotice({ tone: 'error', message: '編集対象を選択してください。' });
      return null;
    }

    const normalizedItems = (editor.bundle.items ?? [])
      .map((item) => ({
        ...item,
        name: item.name?.trim() ?? '',
        code: item.code?.trim(),
        quantity: item.quantity?.trim() ?? '',
        unit: item.unit?.trim() ?? '',
        memo: item.memo?.trim() ?? '',
      }))
      .filter((item) => Boolean(item.name || item.code || item.quantity || item.unit || item.memo));

    if (normalizedItems.length === 0) {
      setEditorNotice({ tone: 'error', message: 'スタンプ項目を1件以上入力してください。' });
      return null;
    }

    const bundleName = editor.bundle.bundleName.trim() || normalizedItems[0]?.name || name;

    return {
      name,
      category: editor.category.trim(),
      target,
      entity: target,
      bundle: {
        ...editor.bundle,
        bundleName,
        admin: editor.bundle.admin.trim(),
        bundleNumber: editor.bundle.bundleNumber.trim() || '1',
        adminMemo: editor.bundle.adminMemo.trim(),
        memo: editor.bundle.memo.trim(),
        startDate: editor.bundle.startDate || today,
        items: normalizedItems,
      },
    };
  };

  const handleSelect = (item: StampListItem) => {
    setSelectedKey(toStampKey(item));
    setCopyNotice(null);
  };

  const handleCopy = () => {
    if (!userName) {
      setCopyNotice('ログイン情報が取得できないためコピーできません。');
      return;
    }
    if (!selected) {
      setCopyNotice('コピー対象を選択してください。');
      return;
    }
    if (phase < 2) {
      setCopyNotice('Phase2 で有効です（VITE_STAMPBOX_MVP=2）。');
      return;
    }
    if (selected.source === 'local') {
      const next = saveStampClipboard(userName, toClipboardEntryFromLocalStamp(selected.stamp));
      setClipboard(next);
      setCopyNotice(`コピーしました（ローカル）: ${selected.name}`);
      return;
    }
    const detail = stampDetailQuery.data;
    if (!detail?.ok || !detail.stamp) {
      setCopyNotice('スタンプ詳細が未取得のためコピーできません。');
      return;
    }
    const entry = toClipboardEntryFromStamp(detail.stamp, today, {
      stampId: selected.stampId,
      name: selected.name,
      category: selected.treeName,
      target: selected.entity,
      entity: selected.entity,
    });
    const next = saveStampClipboard(userName, entry);
    setClipboard(next);
    setCopyNotice(`コピーしました（サーバー）: ${selected.name}`);
  };

  const handleLoadToEditor = () => {
    if (!selected) {
      setEditorNotice({ tone: 'error', message: '編集対象のスタンプを選択してください。' });
      return;
    }
    if (selected.source === 'local') {
      applyEditorFromLocalStamp(selected.stamp);
      setEditorNotice({ tone: 'info', message: 'ローカルスタンプを編集フォームへ読み込みました。' });
      return;
    }
    const detail = stampDetailQuery.data;
    if (!detail?.ok || !detail.stamp) {
      setEditorNotice({ tone: 'error', message: 'サーバースタンプ詳細が未取得のため読み込めません。' });
      return;
    }
    applyEditorFromServerStamp(selected, detail.stamp);
    setEditorNotice({ tone: 'info', message: 'サーバースタンプを読み込みました。内容を確認してローカル登録できます。' });
  };

  const handleCreateLocalStamp = () => {
    if (!userName) {
      setEditorNotice({ tone: 'error', message: 'ログイン情報が取得できないため登録できません。' });
      return;
    }
    const entry = normalizeEditorEntry();
    if (!entry) return;
    const saved = saveLocalStamp(userName, entry);
    const nextLocal = loadLocalStamps(userName);
    setLocalStamps(nextLocal);
    applyEditorFromLocalStamp(saved);
    setSelectedKey(`local::${saved.id}`);
    setEditorNotice({ tone: 'success', message: 'ローカルスタンプを登録しました。' });
  };

  const handleUpdateLocalStamp = () => {
    if (!userName) {
      setEditorNotice({ tone: 'error', message: 'ログイン情報が取得できないため更新できません。' });
      return;
    }
    if (!editor.localStampId) {
      setEditorNotice({ tone: 'error', message: '更新対象のローカルスタンプを読み込んでください。' });
      return;
    }
    const entry = normalizeEditorEntry();
    if (!entry) return;
    const updated = updateLocalStamp(userName, editor.localStampId, entry);
    if (!updated) {
      setEditorNotice({ tone: 'error', message: '更新対象のローカルスタンプが見つかりません。' });
      return;
    }
    const nextLocal = loadLocalStamps(userName);
    setLocalStamps(nextLocal);
    applyEditorFromLocalStamp(updated);
    setSelectedKey(`local::${updated.id}`);
    setEditorNotice({ tone: 'success', message: 'ローカルスタンプを更新しました。' });
  };

  const handleDeleteLocalStamp = () => {
    if (!userName) {
      setEditorNotice({ tone: 'error', message: 'ログイン情報が取得できないため削除できません。' });
      return;
    }
    if (!editor.localStampId) {
      setEditorNotice({ tone: 'error', message: '削除対象のローカルスタンプを読み込んでください。' });
      return;
    }
    setDeleteLocalDialogOpen(true);
  };

  const confirmDeleteLocalStamp = () => {
    if (!userName || !editor.localStampId) return;
    setDeleteLocalDialogOpen(false);
    const removed = deleteLocalStamp(userName, editor.localStampId);
    if (!removed) {
      setEditorNotice({ tone: 'error', message: '削除対象のローカルスタンプが見つかりません。' });
      return;
    }
    setLocalStamps(loadLocalStamps(userName));
    setSelectedKey('');
    setEditor(buildInitialEditor(today));
    setEditorNotice({ tone: 'success', message: 'ローカルスタンプを削除しました。' });
  };

  const renderPreviewItems = (items?: Array<{ name?: string; number?: string; unit?: string; memo?: string }>) => {
    if (!items || items.length === 0) return <p className="charts-side-panel__message">項目なし</p>;
    return (
      <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.25rem' }}>
        {items.map((item, idx) => {
          const parts = [item.number, item.unit].filter(Boolean).join('');
          const left = [item.name, parts ? `(${parts})` : ''].filter(Boolean).join(' ');
          return (
            <li key={`${item.name ?? 'item'}-${idx}`}>
              <span>{left || '（名称なし）'}</span>
              {item.memo?.trim() ? <small style={{ color: '#64748b', marginLeft: '0.5rem' }}>memo: {item.memo}</small> : null}
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <div className="charts-side-panel__content" data-test-id="stamp-library-panel">
      <FocusTrapDialog
        open={deleteLocalDialogOpen}
        role="alertdialog"
        title="ローカルスタンプを削除しますか？"
        description="削除対象と影響範囲を確認して実行してください。"
        onClose={() => setDeleteLocalDialogOpen(false)}
        testId="stamp-local-delete-dialog"
      >
        <section className="charts-tab-guard" aria-label="ローカルスタンプ削除確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>対象名</dt>
              <dd>{editor.name?.trim() || '名称未設定'}</dd>
            </div>
            <div>
              <dt>対象entity</dt>
              <dd>{editor.target || '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>ローカル保存スタンプを削除し、復元できません。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="ローカルスタンプ削除操作">
            <button type="button" onClick={() => setDeleteLocalDialogOpen(false)}>
              キャンセル
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={confirmDeleteLocalStamp}>
              削除する
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <header>
        <p className="charts-side-panel__message">独立スタンプ管理（Phase{phase}）</p>
        <p className="charts-side-panel__message">
          スタンプの閲覧/検索/編集/登録をこの画面で完結します。Phase2 ではクリップボード連携も利用できます。
        </p>
      </header>

      <section>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontWeight: 700 }}>検索（名称/memo）</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例: 降圧 / アムロジピン"
            aria-label="スタンプ検索"
          />
        </label>
      </section>

      <section>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontWeight: 700 }}>対象（entity）</span>
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value as EntityFilter)}
            aria-label="entityフィルタ"
          >
            <option value="all">すべて</option>
            {entities.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!userName ? (
        <p className="charts-side-panel__message">ログイン情報が取得できないため、サーバースタンプは表示できません。</p>
      ) : !userPk ? (
        <p className="charts-side-panel__message">セッションに userPk が無いため、サーバースタンプは利用できません。</p>
      ) : null}

      <section>
        <div className="charts-side-panel__actions" role="group" aria-label="スタンプ操作">
          <button type="button" onClick={handleCopy} disabled={phase < 2 || !selected}>
            クリップボードへコピー（Phase2）
          </button>
          <button type="button" onClick={handleLoadToEditor} disabled={!selected}>
            編集フォームへ読み込む
          </button>
        </div>
        {copyNotice ? (
          <p className="charts-side-panel__message" role="status">
            {copyNotice}
          </p>
        ) : null}
        {clipboard ? (
          <p className="charts-side-panel__message">
            クリップボード: {clipboard.name}（{clipboard.source} / {clipboard.category || '—'} / savedAt={clipboard.savedAt}）
          </p>
        ) : (
          <p className="charts-side-panel__message">クリップボード: （空）</p>
        )}
      </section>

      <section aria-label="サーバースタンプ（treeName分類）">
        <h3 style={{ margin: 0, fontSize: '1rem' }}>サーバースタンプ</h3>
        {stampTreeQuery.isFetching ? (
          <p className="charts-side-panel__message">読み込み中…</p>
        ) : groupedServer.size === 0 ? (
          <p className="charts-side-panel__message">該当するスタンプがありません。</p>
        ) : (
          Array.from(groupedServer.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([treeName, list]) => (
              <details key={treeName} open>
                <summary>
                  {treeName} <small style={{ color: '#64748b' }}>({list.length})</small>
                </summary>
                <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '0.5rem 0 0', display: 'grid', gap: '0.25rem' }}>
                  {list.map((item) => {
                    const isActive = selected?.source === 'server' && selected.stampId === item.stampId;
                    return (
                      <li key={item.stampId}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          aria-pressed={isActive}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            borderRadius: 10,
                            border: `1px solid ${isActive ? 'rgba(37, 99, 235, 0.55)' : 'rgba(148, 163, 184, 0.35)'}`,
                            background: isActive ? '#eff6ff' : '#ffffff',
                            padding: '0.45rem 0.6rem',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{item.name}</span>{' '}
                          <small style={{ color: '#64748b' }}>{item.entity}</small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))
        )}
      </section>

      <section aria-label="ローカルスタンプ">
        <h3 style={{ margin: 0, fontSize: '1rem' }}>ローカルスタンプ</h3>
        {groupedLocal.size === 0 ? (
          <p className="charts-side-panel__message">該当するスタンプがありません。</p>
        ) : (
          Array.from(groupedLocal.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([category, list]) => (
              <details key={`local-${category}`}>
                <summary>
                  {category} <small style={{ color: '#64748b' }}>({list.length})</small>
                </summary>
                <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '0.5rem 0 0', display: 'grid', gap: '0.25rem' }}>
                  {list.map((item) => {
                    const isActive = selected?.source === 'local' && selected.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          aria-pressed={isActive}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            borderRadius: 10,
                            border: `1px solid ${isActive ? 'rgba(37, 99, 235, 0.55)' : 'rgba(148, 163, 184, 0.35)'}`,
                            background: isActive ? '#eff6ff' : '#ffffff',
                            padding: '0.45rem 0.6rem',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{item.name}</span>{' '}
                          <small style={{ color: '#64748b' }}>{item.target}</small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))
        )}
      </section>

      <section aria-label="選択スタンプのプレビュー">
        <h3 style={{ margin: 0, fontSize: '1rem' }}>プレビュー</h3>
        {!selected ? (
          <p className="charts-side-panel__message">スタンプを選択してください。</p>
        ) : selected.source === 'local' ? (
          <>
            <p className="charts-side-panel__message">
              {selected.name}（local / {selected.target}）
            </p>
            {selected.stamp.bundle.memo?.trim() ? (
              <p className="charts-side-panel__message">memo: {selected.stamp.bundle.memo}</p>
            ) : (
              <p className="charts-side-panel__message">memo: （なし）</p>
            )}
            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.25rem' }}>
              {(selected.stamp.bundle.items ?? []).slice(0, 20).map((item, idx) => {
                const parts = [item.quantity, item.unit].filter(Boolean).join('');
                const left = [item.name, parts ? `(${parts})` : ''].filter(Boolean).join(' ');
                return (
                  <li key={`${item.name ?? 'item'}-${idx}`}>
                    <span>{left || '（名称なし）'}</span>
                    {item.memo?.trim() ? <small style={{ color: '#64748b', marginLeft: '0.5rem' }}>memo: {item.memo}</small> : null}
                  </li>
                );
              })}
            </ol>
            {(selected.stamp.bundle.items?.length ?? 0) > 20 ? (
              <p className="charts-side-panel__message">他 {(selected.stamp.bundle.items?.length ?? 0) - 20} 件</p>
            ) : null}
          </>
        ) : stampDetailQuery.isFetching ? (
          <p className="charts-side-panel__message">詳細を取得中…</p>
        ) : !stampDetailQuery.data?.ok || !stampDetailQuery.data?.stamp ? (
          <p className="charts-side-panel__message">詳細を取得できませんでした。</p>
        ) : (
          <>
            <p className="charts-side-panel__message">
              {selected.name}（server / {selected.entity} / {selected.treeName}）
            </p>
            {stampDetailQuery.data.stamp.memo?.trim() ? (
              <p className="charts-side-panel__message">memo: {stampDetailQuery.data.stamp.memo}</p>
            ) : (
              <p className="charts-side-panel__message">memo: （なし）</p>
            )}
            {renderPreviewItems(stampDetailQuery.data.stamp.claimItem)}
          </>
        )}
      </section>

      <section aria-label="ローカルスタンプ編集">
        <h3 style={{ margin: 0, fontSize: '1rem' }}>ローカルスタンプ編集/登録</h3>
        {editorNotice ? (
          <div className={`charts-side-panel__notice charts-side-panel__notice--${editorNotice.tone}`}>{editorNotice.message}</div>
        ) : null}
        <div className="charts-side-panel__field">
          <label htmlFor="stamp-editor-name">編集スタンプ名称</label>
          <input
            id="stamp-editor-name"
            value={editor.name}
            onChange={(event) => setEditor((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="例: 降圧薬セット"
          />
        </div>
        <div className="charts-side-panel__field-row">
          <div className="charts-side-panel__field">
            <label htmlFor="stamp-editor-category">編集分類</label>
            <input
              id="stamp-editor-category"
              value={editor.category}
              onChange={(event) => setEditor((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="例: 院内セット"
            />
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor="stamp-editor-target">編集対象</label>
            <select
              id="stamp-editor-target"
              value={editor.target}
              onChange={(event) => setEditor((prev) => ({ ...prev, target: event.target.value }))}
            >
              {STAMP_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="charts-side-panel__field-row">
          <div className="charts-side-panel__field">
            <label htmlFor="stamp-editor-bundle-name">セット名</label>
            <input
              id="stamp-editor-bundle-name"
              value={editor.bundle.bundleName}
              onChange={(event) => updateBundle({ bundleName: event.target.value })}
              placeholder="例: 降圧セット"
            />
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor="stamp-editor-admin">指示</label>
            <input
              id="stamp-editor-admin"
              value={editor.bundle.admin}
              onChange={(event) => updateBundle({ admin: event.target.value })}
              placeholder="例: 1日1回 朝"
            />
          </div>
        </div>
        <div className="charts-side-panel__field-row">
          <div className="charts-side-panel__field">
            <label htmlFor="stamp-editor-bundle-number">回数</label>
            <input
              id="stamp-editor-bundle-number"
              value={editor.bundle.bundleNumber}
              onChange={(event) => updateBundle({ bundleNumber: event.target.value })}
              placeholder="例: 1"
            />
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor="stamp-editor-start-date">開始日</label>
            <input
              id="stamp-editor-start-date"
              type="date"
              value={editor.bundle.startDate}
              onChange={(event) => updateBundle({ startDate: event.target.value })}
            />
          </div>
        </div>
        <div className="charts-side-panel__field">
          <label htmlFor="stamp-editor-memo">スタンプメモ</label>
          <textarea
            id="stamp-editor-memo"
            value={editor.bundle.memo}
            onChange={(event) => updateBundle({ memo: event.target.value })}
            placeholder="補足メモ"
          />
        </div>

        <div className="charts-side-panel__subsection">
          <div className="charts-side-panel__subheader">
            <strong>スタンプ項目</strong>
            <button type="button" className="charts-side-panel__ghost" onClick={addBundleItem}>
              項目追加
            </button>
          </div>
          {(editor.bundle.items ?? []).map((item, index) => (
            <div key={`stamp-editor-item-${index}`} className="charts-side-panel__item-row">
              <input
                aria-label={`スタンプ項目名-${index + 1}`}
                value={item.name}
                onChange={(event) => updateBundleItem(index, { name: event.target.value })}
                placeholder="項目名"
              />
              <input
                aria-label={`スタンプ数量-${index + 1}`}
                value={item.quantity ?? ''}
                onChange={(event) => updateBundleItem(index, { quantity: event.target.value })}
                placeholder="数量"
              />
              <input
                aria-label={`スタンプ単位-${index + 1}`}
                value={item.unit ?? ''}
                onChange={(event) => updateBundleItem(index, { unit: event.target.value })}
                placeholder="単位"
              />
              <input
                aria-label={`スタンプ備考-${index + 1}`}
                value={item.memo ?? ''}
                onChange={(event) => updateBundleItem(index, { memo: event.target.value })}
                placeholder="備考"
              />
              <button type="button" className="charts-side-panel__icon" onClick={() => removeBundleItem(index)}>
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="charts-side-panel__actions" role="group" aria-label="ローカルスタンプ編集操作">
          <button type="button" onClick={handleCreateLocalStamp} disabled={!userName}>
            ローカル新規登録
          </button>
          <button type="button" onClick={handleUpdateLocalStamp} disabled={!userName || !editor.localStampId}>
            ローカル既存更新
          </button>
          <button type="button" onClick={handleDeleteLocalStamp} disabled={!userName || !editor.localStampId}>
            ローカル削除
          </button>
          <button
            type="button"
            onClick={() => {
              setEditor(buildInitialEditor(today));
              setEditorNotice({ tone: 'info', message: '編集フォームをクリアしました。' });
            }}
          >
            編集フォームをクリア
          </button>
        </div>
      </section>
    </div>
  );
}
