import { useEffect, useMemo, useState } from 'react';

import { formatSoapAuthoredAt, type SoapEntry } from '../soapNote';
import { FocusTrapDialog } from '../../../components/modals/FocusTrapDialog';

import { fetchRevisionHistory } from './revisionHistoryApi';
import { createKarteRevision } from './revisionWriteApi';
import { buildSoapRevisionHistory } from './soapRevisionHistory';
import type { RevisionHistoryEntry, RevisionHistoryResult } from './types';

type RevisionHistoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  meta: {
    patientId?: string;
    appointmentId?: string;
    receptionId?: string;
    visitDate?: string;
  };
  soapHistory: SoapEntry[];
};

const formatMetaLine = (entry: RevisionHistoryEntry) => {
  const who = entry.authorName || entry.authorRole || '不明';
  const when = formatSoapAuthoredAt(entry.authoredAt);
  const op = entry.operation ?? 'unknown';
  return `${when} / ${who} / op=${op}`;
};

const formatDelta = (entry: RevisionHistoryEntry) => {
  const delta = entry.charDeltaBySection ?? {};
  const parts = Object.entries(delta)
    .map(([key, value]) => `${key}${value >= 0 ? `+${value}` : String(value)}`)
    .slice(0, 6);
  return parts.length > 0 ? parts.join(' / ') : '';
};

export function RevisionHistoryDrawer({ open, onClose, meta, soapHistory }: RevisionHistoryDrawerProps) {
  const isRevisionEditEnabled = import.meta.env.VITE_CHARTS_REVISION_EDIT !== '0';
  const isRevisionConflictTestEnabled = import.meta.env.VITE_CHARTS_REVISION_CONFLICT === '1';
  const localResult = useMemo(() => buildSoapRevisionHistory(soapHistory), [soapHistory]);
  const [remote, setRemote] = useState<RevisionHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ tone: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [conflictBaseRevisionId, setConflictBaseRevisionId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    operation: 'revise' | 'restore';
    entry: RevisionHistoryEntry;
    options?: { baseRevisionIdOverride?: number; label?: string };
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setActionFeedback(null);
    void (async () => {
      const result = await fetchRevisionHistory(meta);
      if (cancelled) return;
      setRemote(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.appointmentId, meta.patientId, meta.receptionId, meta.visitDate, open]);

  const effective = useMemo(() => {
    if (remote?.ok && remote.revisions.length > 0) return remote;
    return localResult;
  }, [localResult, remote]);

  useEffect(() => {
    if (!open) {
      setConflictBaseRevisionId(null);
      return;
    }
    if (!isRevisionConflictTestEnabled) return;
    if (effective.source !== 'server') return;
    if (conflictBaseRevisionId !== null) return;
    const max = effective.revisions
      .map((entry) => {
        const parsed = Number(String(entry.revisionId ?? '').trim());
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((v): v is number => v !== null)
      .reduce<number | null>((acc, v) => (acc === null ? v : Math.max(acc, v)), null);
    if (max !== null) setConflictBaseRevisionId(max);
  }, [conflictBaseRevisionId, effective.revisions, effective.source, isRevisionConflictTestEnabled, open]);

  const remoteHint = useMemo(() => {
    if (!remote) return '';
    if (remote.ok) return `server: ${remote.revisions.length}件`;
    return `server unavailable: ${remote.error ?? 'unknown error'}`;
  }, [remote]);

  const parseRevisionId = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const refreshRemote = async () => {
    setLoading(true);
    const result = await fetchRevisionHistory(meta);
    setRemote(result);
    setLoading(false);
  };

  const executeAction = async (
    operation: 'revise' | 'restore',
    entry: RevisionHistoryEntry,
    options?: { baseRevisionIdOverride?: number; label?: string },
  ) => {
    const revisionId = parseRevisionId(entry.revisionId);
    if (!revisionId || !meta.patientId || !meta.visitDate) return;
    const label = options?.label ?? (operation === 'revise' ? '改訂版追加' : 'restore');
    setActionLoading(true);
    setActionFeedback({ tone: 'info', message: `${label} を送信中…` });

    const result = await createKarteRevision({
      operation,
      revisionId,
      patientId: meta.patientId,
      visitDate: meta.visitDate,
      baseRevisionIdOverride: options?.baseRevisionIdOverride,
    });

    if (!result.ok) {
      if (result.conflict) {
        const code = result.errorCode ?? 'REVISION_CONFLICT';
        const latest = result.latestRevisionId ? ` latestRevisionId=${result.latestRevisionId}` : '';
        setActionFeedback({ tone: 'warning', message: `${code} (409): 履歴の更新が必要です。${latest}` });
      } else {
        setActionFeedback({ tone: 'error', message: `失敗: ${result.error ?? `HTTP ${result.status}`}` });
      }
      setActionLoading(false);
      return;
    }

    setActionFeedback({
      tone: 'success',
      message: `${label} 成功: createdRevisionId=${result.createdRevisionId ?? 'unknown'}（履歴を更新します）`,
    });
    await refreshRemote();
    setActionLoading(false);
  };

  const handleAction = async (
    operation: 'revise' | 'restore',
    entry: RevisionHistoryEntry,
    options?: { baseRevisionIdOverride?: number; label?: string },
  ) => {
    const revisionId = parseRevisionId(entry.revisionId);
    if (!revisionId) {
      setActionFeedback({ tone: 'warning', message: 'この版は server revisionId が不明のため操作できません。' });
      return;
    }
    if (!meta.patientId || !meta.visitDate) {
      setActionFeedback({ tone: 'warning', message: 'patientId/visitDate が不足しているため操作できません。' });
      return;
    }

    const label = options?.label ?? (operation === 'revise' ? '改訂版追加' : 'restore');
    setConfirmAction({ operation, entry, options, label });
  };

  return (
    <aside className="revision-drawer" data-open={String(open)} aria-label={isRevisionEditEnabled ? '版履歴（履歴追記）' : '版履歴（閲覧のみ）'}>
      <div className="revision-drawer__header">
        <div>
          <p className="revision-drawer__eyebrow">{isRevisionEditEnabled ? '履歴追記' : '閲覧のみ'}</p>
          <h3 className="revision-drawer__title">版履歴</h3>
          <p className="revision-drawer__desc">
            {isRevisionEditEnabled
              ? '改訂/restore 導線は feature flag で有効化されています（試験運用）。'
              : '履歴/差分の表示のみ対応しています。'}
          </p>
        </div>
        <button type="button" className="revision-drawer__close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      <div className="revision-drawer__meta" role="status" aria-live="polite">
        <span>source: {effective.source}</span>
        {loading ? <span>loading…</span> : null}
        {actionLoading ? <span>action…</span> : null}
        {remoteHint ? <span>{remoteHint}</span> : null}
      </div>

      <FocusTrapDialog
        open={Boolean(confirmAction)}
        role="alertdialog"
        title={`${confirmAction?.label ?? '操作'}を実行しますか？`}
        description="版履歴操作を実行します。対象と影響範囲を確認してください。"
        onClose={() => setConfirmAction(null)}
        testId="revision-action-confirm-dialog"
      >
        <section className="charts-tab-guard" aria-label="版履歴操作確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>対象患者ID</dt>
              <dd>{meta.patientId ?? '—'}</dd>
            </div>
            <div>
              <dt>診療日</dt>
              <dd>{meta.visitDate ?? '—'}</dd>
            </div>
            <div>
              <dt>対象revision</dt>
              <dd>{confirmAction?.entry.revisionId ?? '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>選択版を基準に新規改訂または復元を実行します。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="版履歴操作選択">
            <button type="button" onClick={() => setConfirmAction(null)}>
              キャンセル
            </button>
            <button
              type="button"
              className="charts-tab-guard__danger"
              onClick={() => {
                if (!confirmAction) return;
                const payload = confirmAction;
                setConfirmAction(null);
                void executeAction(payload.operation, payload.entry, payload.options);
              }}
            >
              実行する
            </button>
          </div>
        </section>
      </FocusTrapDialog>

      {actionFeedback ? (
        <p className={`revision-drawer__status revision-drawer__status--${actionFeedback.tone}`} role="status">
          {actionFeedback.message}
          {actionFeedback.tone === 'warning' && actionFeedback.message.includes('409') ? (
            <>
              {' '}
              <button type="button" className="revision-drawer__refresh" onClick={() => void refreshRemote()} disabled={loading || actionLoading}>
                履歴を更新
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {effective.revisions.length === 0 ? (
        <p className="revision-drawer__empty" role="status">
          履歴がありません（または未取得）。
        </p>
      ) : (
        <ol className="revision-drawer__list" aria-label="版一覧（新しい順）">
          {effective.revisions.map((entry) => (
            <li key={entry.revisionId} className="revision-drawer__item">
              <div className="revision-drawer__item-head">
                <strong className="revision-drawer__rev">rev: {entry.revisionId}</strong>
                <span className="revision-drawer__parent">
                  parent: {entry.parentRevisionId ?? '—'}
                </span>
              </div>
              <div className="revision-drawer__item-meta">{formatMetaLine(entry)}</div>
              {entry.summary ? <div className="revision-drawer__item-summary">{entry.summary}</div> : null}
              {entry.changedSections && entry.changedSections.length > 0 ? (
                <div className="revision-drawer__item-changes">
                  changed: {entry.changedSections.join(', ')}
                </div>
              ) : null}
              {formatDelta(entry) ? <div className="revision-drawer__item-delta">delta: {formatDelta(entry)}</div> : null}
              <div className="revision-drawer__actions" aria-label="版操作">
                {isRevisionEditEnabled ? (
                  <>
                    <button
                      type="button"
                      className="revision-drawer__action revision-drawer__action--revise"
                      onClick={() => void handleAction('revise', entry)}
                      disabled={actionLoading || loading || effective.source !== 'server'}
                      title={effective.source !== 'server' ? 'server 由来履歴のみ操作可能' : undefined}
                    >
                      この版を編集（改訂版追加）
                    </button>
                    <button
                      type="button"
                      className="revision-drawer__action revision-drawer__action--restore"
                      onClick={() => void handleAction('restore', entry)}
                      disabled={actionLoading || loading || effective.source !== 'server'}
                      title={effective.source !== 'server' ? 'server 由来履歴のみ操作可能' : undefined}
                    >
                      この版を現在として採用（restore）
                    </button>
                    {isRevisionConflictTestEnabled ? (
                      <button
                        type="button"
                        className="revision-drawer__action revision-drawer__action--conflict"
                        onClick={() =>
                          void handleAction('revise', entry, {
                            baseRevisionIdOverride: conflictBaseRevisionId ?? undefined,
                            label: '409テスト（改訂）',
                          })
                        }
                        disabled={actionLoading || loading || effective.source !== 'server' || conflictBaseRevisionId === null}
                        title={
                          conflictBaseRevisionId === null
                            ? 'conflict 用 baseRevisionId を確定できません'
                            : `baseRevisionId(stale)=${conflictBaseRevisionId}`
                        }
                      >
                        409テスト（改訂）
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="revision-drawer__action-hint">操作は無効（履歴閲覧のみ）</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
