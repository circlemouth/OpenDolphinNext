import { useMemo, useState } from 'react';

import type { OrcaQueueEntry } from '../api';

import { AdminCard } from '../components/AdminCard';
import { AdminStatusPill } from '../components/AdminStatusPill';

type QueueFilter = 'all' | 'pending' | 'failed' | 'delivered';

type OrcaQueueCardProps = {
  entries: OrcaQueueEntry[];
  isSystemAdmin: boolean;
  guardDetailsId?: string;
  pending: boolean;
  warningThresholdMs: number;
  onRetry: (patientId: string) => void;
  onDiscardRequest: (entry: OrcaQueueEntry) => void;
};

const formatAbsolute = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

const formatRelative = (iso?: string) => {
  if (!iso) return '―';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return '1分以内';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
};

const isDelayed = (entry: OrcaQueueEntry, thresholdMs: number) => {
  if (entry.status !== 'pending' || !entry.lastDispatchAt) return false;
  const delta = Date.now() - new Date(entry.lastDispatchAt).getTime();
  return delta > thresholdMs;
};

const toStatusTone = (status: string) => {
  if (status === 'failed') return 'error' as const;
  if (status === 'delivered') return 'ok' as const;
  if (status === 'pending') return 'pending' as const;
  return 'idle' as const;
};

const resolveRetryDisabledReason = (params: { pending: boolean; readOnly: boolean; entry: OrcaQueueEntry }) => {
  if (params.readOnly) return '管理者権限が必要です。';
  if (params.pending) return '処理中のため再送できません。';
  if (!params.entry.retryable) return 'このエントリは再送不可として記録されています。';
  return undefined;
};

export function OrcaQueueCard({
  entries,
  isSystemAdmin,
  guardDetailsId,
  pending,
  warningThresholdMs,
  onRetry,
  onDiscardRequest,
}: OrcaQueueCardProps) {
  const readOnly = !isSystemAdmin;
  const [filter, setFilter] = useState<QueueFilter>('all');

  const summary = useMemo(() => {
    let pendingCount = 0;
    let failedCount = 0;
    let deliveredCount = 0;
    let delayedCount = 0;
    for (const entry of entries) {
      if (entry.status === 'pending') pendingCount += 1;
      if (entry.status === 'failed') failedCount += 1;
      if (entry.status === 'delivered') deliveredCount += 1;
      if (isDelayed(entry, warningThresholdMs)) delayedCount += 1;
    }
    return { pendingCount, failedCount, deliveredCount, delayedCount };
  }, [entries, warningThresholdMs]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((entry) => entry.status === filter);
  }, [entries, filter]);

  return (
    <AdminCard
      title="配信キュー"
      description="statusフィルタ・集計・エラー可視化・遅延判定で事故を防止します。"
      status={<AdminStatusPill status={summary.failedCount > 0 ? 'error' : summary.pendingCount > 0 ? 'warn' : 'ok'} value={`pending:${summary.pendingCount} / failed:${summary.failedCount}`} />}
    >
      <div className="admin-inline-meta admin-inline-meta--wrap">
        <AdminStatusPill status="pending" value={`pending ${summary.pendingCount}件`} />
        <AdminStatusPill status={summary.failedCount > 0 ? 'error' : 'idle'} value={`failed ${summary.failedCount}件`} />
        <AdminStatusPill status={summary.delayedCount > 0 ? 'warn' : 'ok'} value={`遅延 ${summary.delayedCount}件`} />
        <AdminStatusPill status="ok" value={`delivered ${summary.deliveredCount}件`} />
      </div>

      <div className="admin-queue-tools">
        <label htmlFor="admin-queue-filter">statusフィルタ</label>
        <select id="admin-queue-filter" value={filter} onChange={(event) => setFilter(event.target.value as QueueFilter)}>
          <option value="all">すべて</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
          <option value="delivered">delivered</option>
        </select>
      </div>

      <table className="admin-queue" aria-label="ORCA queue">
        <thead>
          <tr>
            <th>patientId</th>
            <th>status</th>
            <th>lastDispatch</th>
            <th>headers</th>
            <th>error</th>
            <th aria-label="actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.length === 0 ? (
            <tr>
              <td colSpan={6}>該当キューはありません。</td>
            </tr>
          ) : (
            filteredEntries.map((entry) => {
              const delayed = isDelayed(entry, warningThresholdMs);
              const retryDisabledReason = resolveRetryDisabledReason({ pending, readOnly, entry });
              const retryReasonId = retryDisabledReason ? `orca-queue-retry-reason-${entry.patientId}` : undefined;
              const retryDescribedBy = [retryReasonId, readOnly ? guardDetailsId : undefined].filter(Boolean).join(' ') || undefined;
              return (
                <tr key={entry.patientId} className={delayed ? 'admin-queue__row--delayed' : undefined}>
                  <td>{entry.patientId}</td>
                  <td>
                    <div className="admin-inline-meta">
                      <AdminStatusPill status={toStatusTone(entry.status)} value={entry.status} />
                      {delayed ? <AdminStatusPill status="warn" value="遅延" /> : null}
                    </div>
                  </td>
                  <td>
                    <div>{formatAbsolute(entry.lastDispatchAt)}</div>
                    <div className="admin-quiet">{formatRelative(entry.lastDispatchAt)}</div>
                  </td>
                  <td>{entry.headers?.join(' / ') ?? '―'}</td>
                  <td>{entry.error ?? '―'}</td>
                  <td>
                    <div className="admin-queue__actions">
                      {retryDisabledReason ? (
                        <p id={retryReasonId} className="admin-queue__reason admin-quiet">
                          {retryDisabledReason}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="admin-button admin-button--secondary"
                        onClick={() => onRetry(entry.patientId)}
                        disabled={pending || readOnly || !entry.retryable}
                        aria-describedby={retryDescribedBy}
                      >
                        再送
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-button--danger"
                        onClick={() => onDiscardRequest(entry)}
                        disabled={pending || readOnly}
                        aria-describedby={readOnly ? guardDetailsId : undefined}
                      >
                        破棄
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </AdminCard>
  );
}
