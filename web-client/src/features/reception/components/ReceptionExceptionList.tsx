import { resolveAriaLive } from '../../../libs/observability/observability';
import { StatusPill } from '../../shared/StatusPill';
import type { ReceptionEntry } from '../api';
import type { ClaimBundle, ClaimQueueEntry } from '../../outpatient/types';
import type { ExceptionDecision } from '../exceptionLogic';
import {
  formatDelayedDetail,
  formatSendErrorDetail,
  formatUnapprovedDetail,
  priorityLabel,
} from '../exceptionPresentation';

export type ReceptionExceptionKind = 'unapproved' | 'send_error' | 'delayed';

export type ReceptionExceptionItem = {
  id: string;
  kind: ReceptionExceptionKind;
  detail: string;
  nextAction: string;
  entry: ReceptionEntry;
  bundle?: ClaimBundle;
  queue?: ClaimQueueEntry;
  queueLabel?: string;
  queueDetail?: string;
  queueTone?: 'info' | 'warning' | 'error' | 'success';
  orcaQueueLabel?: string;
  orcaQueueDetail?: string;
  orcaQueueTone?: 'info' | 'warning' | 'error' | 'success';
  orcaQueueSource?: 'mock' | 'live';
  paymentLabel?: string;
  chartsUrl?: string;
  reasons?: ExceptionDecision['reasons'];
};

export type ReceptionExceptionCounts = {
  total: number;
  unapproved: number;
  sendError: number;
  delayed: number;
};

export type ReceptionExceptionListProps = {
  items: ReceptionExceptionItem[];
  counts: ReceptionExceptionCounts;
  runId?: string;
  variant?: 'panel' | 'modal';
  onSelectEntry?: (entry: ReceptionEntry) => void;
  onOpenCharts?: (entry: ReceptionEntry, url?: string) => void;
  onRetryQueue?: (entry: ReceptionEntry) => void;
  retryingPatientId?: string | null;
  claimEnabled?: boolean;
};

const kindLabel: Record<ReceptionExceptionKind, string> = {
  unapproved: '未承認',
  send_error: '送信エラー',
  delayed: '遅延',
};

export function ReceptionExceptionList({
  items,
  counts,
  runId,
  variant = 'panel',
  onSelectEntry,
  onOpenCharts,
  onRetryQueue,
  retryingPatientId,
  claimEnabled = true,
}: ReceptionExceptionListProps) {
  return (
    <section className="reception-exceptions" aria-label="例外一覧" data-run-id={runId}>
      <header className="reception-exceptions__header">
        <div className="reception-exceptions__title">
          {variant === 'panel' ? (
            <>
              <h2>例外一覧</h2>
              <p>未承認・送信エラー・遅延の対象を優先順に表示します。</p>
              <p className="reception-exceptions__note">
                判定は ORCA queue 情報を主に使用し、送信キャッシュは補助確認として表示します。
                取得失敗時は再送キューが更新されません。
              </p>
            </>
          ) : (
            <p className="reception-exceptions__modal-lead">未承認・送信エラー・遅延の対象を優先順に表示します。</p>
          )}
        </div>
        <div className="reception-exceptions__counts" aria-label="例外件数">
          <div className="reception-exceptions__count">
            <StatusPill className="reception-pill" label="送信エラー" value={`${counts.sendError}件`} runId={runId} tone="error" />
            <span className="reception-exceptions__count-note">再送・原因確認が最優先</span>
          </div>
          <div className="reception-exceptions__count">
            <StatusPill className="reception-pill" label="遅延" value={`${counts.delayed}件`} runId={runId} tone="warning" />
            <span className="reception-exceptions__count-note">滞留の監視が必要</span>
          </div>
          <div className="reception-exceptions__count">
            <StatusPill className="reception-pill" label="未承認" value={`${counts.unapproved}件`} runId={runId} tone="info" />
            <span className="reception-exceptions__count-note">会計/承認の確認</span>
          </div>
          <div className="reception-exceptions__count reception-exceptions__count--total">
            <StatusPill className="reception-pill" label="合計" value={`${counts.total}件`} runId={runId} />
            <span className="reception-exceptions__count-note">優先度: 送信エラー → 遅延 → 未承認</span>
          </div>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="reception-exceptions__empty" role="status" aria-live={resolveAriaLive('info')}>
          現在の条件では例外は検出されていません。
        </p>
      ) : (
        <div className="reception-exceptions__list" role="list">
          {items.map((item) => {
            const canOpenCharts = Boolean(item.entry.scheduleKey || item.entry.encounterKey);
            const canRetryQueue = Boolean(item.entry.patientId) && item.kind !== 'unapproved';
            const isRetrying = Boolean(retryingPatientId && retryingPatientId === item.entry.patientId);
            const reasonItems = [
              {
                key: 'send_error',
                label: '送信エラー',
                active: Boolean(item.reasons?.sendError?.isSendError),
                detail: formatSendErrorDetail(item.reasons?.sendError),
              },
              {
                key: 'delayed',
                label: '遅延',
                active: Boolean(item.reasons?.delayed?.isDelayed),
                detail: formatDelayedDetail(item.reasons?.delayed),
              },
              {
                key: 'unapproved',
                label: '未承認',
                active: Boolean(item.reasons?.unapproved?.isUnapproved),
                detail: formatUnapprovedDetail(item.reasons?.unapproved),
              },
            ];
            return (
              <article key={item.id} className={`reception-exception reception-exception--${item.kind}`} role="listitem">
                <div className="reception-exception__head">
                  <div className="reception-exception__title">
                    <span className={`reception-exception__badge reception-exception__badge--${item.kind}`}>
                      {kindLabel[item.kind]}
                    </span>
                    <div className="reception-exception__patient">
                      <strong>{item.entry.name ?? '氏名未登録'}</strong>
                      <small>
                        患者ID {item.entry.patientId ?? '未登録'} / 予約ID {item.entry.appointmentId ?? '—'} / 受付ID{' '}
                        {item.entry.receptionId ?? '—'}
                      </small>
                    </div>
                  </div>
                  <div className="reception-exception__priority">
                    <span className="reception-exception__priority-label">優先度</span>
                    <strong className="reception-exception__priority-value">{priorityLabel[item.kind]}</strong>
                  </div>
                </div>
                <div className="reception-exception__meta">
                  <span>状態: {item.entry.status ?? '—'}</span>
                  <span>支払: {item.paymentLabel ?? '不明'}</span>
                  {claimEnabled && (
                    <span>請求: {item.bundle?.claimStatus ?? item.bundle?.claimStatusText ?? '未取得'}</span>
                  )}
                </div>
                <div className="reception-exception__signals" aria-label="例外差分">
                  {reasonItems.map((reason) => (
                    <div
                      key={reason.key}
                      className={`reception-exception__signal${reason.active ? ' is-active' : ''}`}
                      aria-label={`${reason.label} ${reason.active ? '対象' : '対象外'}`}
                    >
                      <span className="reception-exception__signal-label">{reason.label}</span>
                      <span className="reception-exception__signal-detail">{reason.detail}</span>
                    </div>
                  ))}
                </div>
                <div className="reception-exception__queue">
                  {item.queue ? (
                    <div className="reception-exception__queue-row">
                      <span className="reception-exception__queue-title">送信キュー</span>
                      <span className="reception-exception__queue-status" data-tone={item.queueTone ?? 'warning'}>
                        <strong>{item.queueLabel ?? '未取得'}</strong>
                        {item.queueDetail ? <small>{item.queueDetail}</small> : null}
                      </span>
                      <span className="reception-exception__queue-source">送信キュー</span>
                    </div>
                  ) : null}
                  <div className="reception-exception__queue-row">
                    <span className="reception-exception__queue-title">再送キュー</span>
                    <span className="reception-exception__queue-status" data-tone={item.orcaQueueTone ?? 'warning'}>
                      <strong>{item.orcaQueueLabel ?? '未取得'}</strong>
                      {item.orcaQueueDetail ? <small>{item.orcaQueueDetail}</small> : null}
                    </span>
                    <span className="reception-exception__queue-source">
                      ORCA queue{item.orcaQueueSource ? ` (${item.orcaQueueSource})` : ''}
                    </span>
                  </div>
                </div>
                <div className="reception-exception__detail">
                  <strong>理由サマリ</strong>
                  <p title={item.detail}>{item.detail}</p>
                </div>
                <div className="reception-exception__actions" role="group" aria-label="例外対応">
                  <div className="reception-exception__next">
                    <span className="reception-exception__next-label">次アクション</span>
                    <strong>{item.nextAction}</strong>
                  </div>
                  <div className="reception-exception__action-buttons">
                    <button
                      type="button"
                      className="reception-exception__action-button warning"
                      onClick={() => onRetryQueue?.(item.entry)}
                      disabled={!canRetryQueue || isRetrying || !onRetryQueue}
                      title={
                        !item.entry.patientId
                          ? '患者IDが未登録のため再送できません'
                          : item.kind === 'unapproved'
                            ? '未承認は再送対象外です'
                            : 'ORCA再送を要求します'
                      }
                    >
                      {isRetrying ? '再送中...' : '再送'}
                    </button>
                    <button
                      type="button"
                      className="reception-exception__action-button primary"
                      onClick={() => onOpenCharts?.(item.entry, item.chartsUrl)}
                      disabled={!canOpenCharts}
                      title={
                        canOpenCharts
                          ? 'Charts を新規タブで開く'
                          : 'canonical key が未設定のため新規タブを開けません'
                      }
                    >
                      Charts へ
                    </button>
                    <button type="button" className="reception-exception__action-button" onClick={() => onSelectEntry?.(item.entry)}>
                      一覧で選択
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
