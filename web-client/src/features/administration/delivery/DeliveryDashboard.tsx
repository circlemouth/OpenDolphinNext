import { AdminAlert } from '../components/AdminAlert';
import { AdminCard } from '../components/AdminCard';
import { AdminStatusPill } from '../components/AdminStatusPill';
import type { DeliverySection } from './types';

type DeliveryDashboardProps = {
  deliverySummary: string;
  deliveryMode?: string;
  lastDeliveredAt: string;
  webOrcaConnection: string;
  queueSummary: {
    pending: number;
    failed: number;
    delivered: number;
    delayed: number;
  };
  environmentLabel: string;
  warningThresholdMinutes: number;
  onNavigate: (section: DeliverySection) => void;
};

const queueTone = (summary: DeliveryDashboardProps['queueSummary']) => {
  if (summary.failed > 0) return 'error' as const;
  if (summary.delayed > 0 || summary.pending > 0) return 'warn' as const;
  if (summary.delivered > 0) return 'ok' as const;
  return 'idle' as const;
};

const connectionTone = (label: string) => {
  if (label.includes('OK')) return 'ok' as const;
  if (label.includes('確認')) return 'warn' as const;
  if (label.includes('NG')) return 'error' as const;
  return 'idle' as const;
};

export function DeliveryDashboard({
  deliverySummary,
  deliveryMode,
  lastDeliveredAt,
  webOrcaConnection,
  queueSummary,
  environmentLabel,
  warningThresholdMinutes,
  onNavigate,
}: DeliveryDashboardProps) {
  return (
    <div className="administration-grid">
      <AdminCard
        title="運用KPI"
        description="配信・接続・キューの現況を即時に確認します。"
        actions={
          <button type="button" className="admin-button admin-button--secondary" onClick={() => onNavigate('queue')}>
            キュー詳細へ
          </button>
        }
      >
        <div className="admin-kpi-grid">
          <div className="admin-kpi-grid__item">
            <span className="admin-kpi-grid__label">配信状態</span>
            <AdminStatusPill status={deliverySummary === '即時反映' ? 'ok' : 'warn'} value={deliverySummary} />
          </div>
          <div className="admin-kpi-grid__item">
            <span className="admin-kpi-grid__label">最終配信</span>
            <span>{lastDeliveredAt}</span>
          </div>
          <div className="admin-kpi-grid__item">
            <span className="admin-kpi-grid__label">WebORCA接続</span>
            <AdminStatusPill status={connectionTone(webOrcaConnection)} value={webOrcaConnection} />
          </div>
          <div className="admin-kpi-grid__item">
            <span className="admin-kpi-grid__label">Queue警告</span>
            <AdminStatusPill
              status={queueTone(queueSummary)}
              value={`pending:${queueSummary.pending} / failed:${queueSummary.failed} / 遅延:${queueSummary.delayed}`}
            />
          </div>
          <div className="admin-kpi-grid__item">
            <span className="admin-kpi-grid__label">環境</span>
            <span>{environmentLabel}</span>
          </div>
          <div className="admin-kpi-grid__item">
            <span className="admin-kpi-grid__label">配信モード</span>
            <span>{deliveryMode ?? '―'}</span>
          </div>
        </div>
        <p className="admin-quiet">遅延判定は {warningThresholdMinutes} 分超の pending を対象とします。</p>
      </AdminCard>

      <AdminCard title="次アクション" description="異常の解消導線を明示します。">
        <AdminAlert tone="ok" message="config は単一正本として扱われます。" />
        <div className="admin-actions">
          <button type="button" className="admin-button admin-button--secondary" onClick={() => onNavigate('connection')}>
            接続設定を確認
          </button>
          <button type="button" className="admin-button admin-button--secondary" onClick={() => onNavigate('config')}>
            配信設定を確認
          </button>
          <button type="button" className="admin-button admin-button--secondary" onClick={() => onNavigate('operations')}>
            運用監視へ
          </button>
        </div>
      </AdminCard>
    </div>
  );
}
