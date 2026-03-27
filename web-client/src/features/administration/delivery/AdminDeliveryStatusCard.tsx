import type { AdminDeliveryFlagState } from '../../../libs/admin/broadcast';

import { AdminCard } from '../components/AdminCard';
import { AdminStatusPill } from '../components/AdminStatusPill';

type DeliveryStatusRow = {
  key: string;
  label: string;
  configValue: boolean | string | undefined;
  deliveryValue: boolean | string | undefined;
  state: AdminDeliveryFlagState;
};

type AdminDeliveryStatusCardProps = {
  deliveryId?: string;
  deliveryVersion?: string;
  deliveryEtag?: string;
  deliveredAt?: string;
  environmentLabel: string;
  deliveryMode?: string;
  verified?: boolean;
  rows: DeliveryStatusRow[];
  onCopy: (value: string, label: string) => void;
};

const formatValue = (value: boolean | string | undefined) => (value === undefined ? '―' : String(value));

const formatTimestamp = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

const toAdminStatus = (state: AdminDeliveryFlagState) => {
  if (state === 'applied') return 'ok' as const;
  if (state === 'pending') return 'pending' as const;
  return 'idle' as const;
};

const recommendation = (state: AdminDeliveryFlagState) => {
  if (state === 'pending') return '再取得または保存して配信';
  if (state === 'unknown') return 'delivery API応答を確認';
  return '対応不要';
};

export function AdminDeliveryStatusCard({
  deliveryId,
  deliveryVersion,
  deliveryEtag,
  deliveredAt,
  environmentLabel,
  deliveryMode,
  verified,
  rows,
  onCopy,
}: AdminDeliveryStatusCardProps) {
  return (
    <AdminCard
      id="admin-delivery-status"
      title="配信ステータス"
      description="単一の config 応答から配信状態を確認し、未反映時の対処を示します。"
    >
      <div className="admin-result admin-result--stack">
        <div className="admin-inline-meta">
          <span>deliveryId: {deliveryId ?? '―'}</span>
          <span>deliveryVersion: {deliveryVersion ?? '―'}</span>
          {deliveryVersion ? (
            <button type="button" className="admin-link admin-link--button" onClick={() => onCopy(deliveryVersion, 'deliveryVersion')}>
              コピー
            </button>
          ) : null}
        </div>
        <div className="admin-inline-meta">
          <span>ETag: {deliveryEtag ?? '―'}</span>
          {deliveryEtag ? (
            <button type="button" className="admin-link admin-link--button" onClick={() => onCopy(deliveryEtag, 'ETag')}>
              コピー
            </button>
          ) : null}
        </div>
        <div>deliveredAt: {formatTimestamp(deliveredAt)}</div>
        <div>environment: {environmentLabel}</div>
        <div>deliveryMode: {deliveryMode ?? '―'}</div>
        <div>verified: {verified ? 'true' : 'false'}</div>
      </div>

      <div className="admin-scroll">
        <table className="admin-table admin-table--diff" aria-label="配信差分テーブル">
          <thead>
            <tr>
              <th>項目</th>
              <th>config値</th>
              <th>delivery値</th>
              <th>状態</th>
              <th>推奨アクション</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.state === 'pending' ? 'admin-row--pending' : undefined}>
                <td>{row.label}</td>
                <td>{formatValue(row.configValue)}</td>
                <td>{formatValue(row.deliveryValue)}</td>
                <td>
                  <AdminStatusPill
                    status={toAdminStatus(row.state)}
                    value={row.state === 'applied' ? '配信済み' : row.state === 'pending' ? '未反映' : '不明'}
                  />
                </td>
                <td>{recommendation(row.state)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
