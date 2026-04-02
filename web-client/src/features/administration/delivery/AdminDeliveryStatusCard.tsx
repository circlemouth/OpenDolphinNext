import { AdminCard } from '../components/AdminCard';

type AdminDeliveryStatusCardProps = {
  deliveryId?: string;
  deliveryVersion?: string;
  deliveryEtag?: string;
  deliveredAt?: string;
  environmentLabel: string;
  deliveryMode?: string;
  verified?: boolean;
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
  environmentLabel,
  deliveryMode,
  verified,
  onCopy,
}: AdminDeliveryStatusCardProps) {
  return (
    <AdminCard
      id="admin-delivery-status"
      title="配信メタデータ"
      description="単一の config 応答から得た配信メタデータだけを表示します。"
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
        <div>環境: {environmentLabel}</div>
        <div>配信モード: {deliveryMode ?? '―'}</div>
        <div>検証状態: {verified === undefined ? '―' : verified ? '確認済み' : '未確認'}</div>
      </div>
    </AdminCard>
  );
}
