import { AdminCard } from '../components/AdminCard';

type AdminDeliveryStatusCardProps = {
  deliveryId?: string;
  deliveryVersion?: string;
  deliveryEtag?: string;
  deliveredAt?: string;
  scopeLabel: string;
  onCopy: (value: string, label: string) => void;
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

export function AdminDeliveryStatusCard({
  deliveryId,
  deliveryVersion,
  deliveryEtag,
  deliveredAt,
  scopeLabel,
  onCopy,
}: AdminDeliveryStatusCardProps) {
  return (
    <AdminCard
      id="admin-delivery-status"
      title="配信メタデータ"
      description="単一の config 応答から得た charts delivery の配信メタデータだけを表示します。"
    >
      <div className="admin-result admin-result--stack">
        <div className="admin-inline-meta">
          <span>配信ID: {deliveryId ?? '―'}</span>
          <span>配信バージョン: {deliveryVersion ?? '―'}</span>
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
        <div>最終配信時刻: {formatTimestamp(deliveredAt)}</div>
        <div>正本スコープ: {scopeLabel}</div>
        <div>未証明 setting: UI 非表示 / feature-off</div>
      </div>
    </AdminCard>
  );
}
