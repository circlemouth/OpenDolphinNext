import type { AdminConfigPayload } from '../api';

import { AdminCard } from '../components/AdminCard';
import { AdminField } from '../components/AdminField';
import { DirtyStateBar } from '../components/DirtyStateBar';

type Feedback = { tone: 'success' | 'warning' | 'error' | 'info'; message: string } | null;

type AdminDeliveryConfigCardProps = {
  form: AdminConfigPayload;
  isSystemAdmin: boolean;
  showAdminDebugToggles: boolean;
  dirty: boolean;
  updatedAt?: string;
  feedback: Feedback;
  note?: string;
  guardDetailsId?: string;
  saving: boolean;
  refetching: boolean;
  onFieldChange: (key: keyof AdminConfigPayload, value: string | boolean) => void;
  onChartsMasterSourceChange: (value: string) => void;
  onSaveRequest: () => void;
  onRefetch: () => void;
};

export function AdminDeliveryConfigCard({
  form,
  isSystemAdmin,
  showAdminDebugToggles,
  dirty,
  updatedAt,
  feedback,
  note,
  guardDetailsId,
  saving,
  refetching,
  onFieldChange,
  onChartsMasterSourceChange,
  onSaveRequest,
  onRefetch,
}: AdminDeliveryConfigCardProps) {
  const readOnly = !isSystemAdmin;

  return (
    <AdminCard
      id="admin-delivery-config"
      title="配信設定"
      description="運用トグルと開発トグルを分離し、保存前に差分確認してから配信します。"
    >
      <DirtyStateBar dirty={dirty} updatedAt={updatedAt} />
      <AdminField
        label="orcaEndpoint（配信先 URL）"
        htmlFor="orca-endpoint"
        hint="WebORCA接続設定は接続試験・認証管理、orcaEndpoint は配信時のクライアント利用先です。用途が異なります。"
      >
        <input
          id="orca-endpoint"
          type="text"
          value={form.orcaEndpoint}
          onChange={(event) => onFieldChange('orcaEndpoint', event.target.value)}
          readOnly={readOnly}
          aria-readonly={readOnly}
          aria-describedby={readOnly ? guardDetailsId : undefined}
        />
      </AdminField>

      <div className="admin-group">
        <h3 className="admin-group__title">運用トグル</h3>
        <div className="admin-form__toggles">
          <div className="admin-toggle">
            <div className="admin-toggle__label">
              <span>Charts 表示フラグ</span>
              <span className="admin-toggle__hint">表示カード一式を切替</span>
            </div>
            <input
              id="admin-charts-display-enabled"
              type="checkbox"
              checked={form.chartsDisplayEnabled}
              onChange={(event) => onFieldChange('chartsDisplayEnabled', event.target.checked)}
              disabled={readOnly}
              aria-describedby={readOnly ? guardDetailsId : undefined}
            />
          </div>
          <div className="admin-toggle">
            <div className="admin-toggle__label">
              <span>Charts 送信フラグ</span>
              <span className="admin-toggle__hint">ORCA送信を切替</span>
            </div>
            <input
              id="admin-charts-send-enabled"
              type="checkbox"
              checked={form.chartsSendEnabled}
              onChange={(event) => onFieldChange('chartsSendEnabled', event.target.checked)}
              disabled={readOnly}
              aria-describedby={readOnly ? guardDetailsId : undefined}
            />
          </div>
        </div>
        <AdminField label="chartsMasterSource" htmlFor="charts-master-source">
          <select
            id="charts-master-source"
            value={form.chartsMasterSource}
            onChange={(event) => onChartsMasterSourceChange(event.target.value)}
            disabled={readOnly}
            aria-describedby={readOnly ? guardDetailsId : undefined}
          >
            <option value="auto">auto（環境変数に従う）</option>
            <option value="server">server（実 API 優先）</option>
            <option value="mock">mock（MSW/fixture 優先）</option>
            <option value="fallback">fallback（送信停止）</option>
            <option value="snapshot">snapshot（将来拡張）</option>
          </select>
        </AdminField>
      </div>

      <details className="admin-dev-flags" open>
        <summary>開発トグル（診断/デバッグ用途）</summary>
        {showAdminDebugToggles ? (
          <div className="admin-form__toggles">
            <div className="admin-toggle">
              <div className="admin-toggle__label">
                <span>配信検証フラグ</span>
                <span className="admin-toggle__hint">x-admin-delivery-verification</span>
              </div>
              <input
                id="admin-verify-delivery"
                type="checkbox"
                checked={form.verifyAdminDelivery}
                onChange={(event) => onFieldChange('verifyAdminDelivery', event.target.checked)}
                disabled={readOnly}
                aria-describedby={readOnly ? guardDetailsId : undefined}
              />
            </div>
          </div>
        ) : (
          <p className="admin-quiet">この環境では開発トグルを非表示にしています（診断/デバッグセクションから操作）。</p>
        )}
      </details>

      <div className="admin-actions">
        <button type="button" className="admin-button admin-button--primary" onClick={onSaveRequest} disabled={saving || readOnly}>
          保存して配信
        </button>
        <button type="button" className="admin-button admin-button--secondary" onClick={onRefetch} disabled={refetching}>
          再取得
        </button>
      </div>
      {feedback ? <p className="status-message">{feedback.message}</p> : null}
      {note ? <p className="admin-note">{note}</p> : null}
    </AdminCard>
  );
}
