import type { AdminConfigPayload } from '../api';
import { AdminCard } from '../components/AdminCard';
import { AdminField } from '../components/AdminField';
import { DirtyStateBar } from '../components/DirtyStateBar';

type AdminDeliveryConfigCardProps = {
  form: AdminConfigPayload;
  isSystemAdmin: boolean;
  dirty: boolean;
  updatedAt?: string;
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
  dirty,
  updatedAt,
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
      description="この section が正本なのは charts delivery のみです。接続設定・runtime-owned・未証明 setting はここへ混ぜません。"
    >
      <DirtyStateBar dirty={dirty} updatedAt={updatedAt} />
      <p className="admin-note">未証明の facility setting や optional module visibility は UI に toggle を出さず、feature-off / fail-close を維持します。</p>

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
      <p className="admin-quiet">診断や connection/testedScope の確認は、config ではなく connection / debug セクションで扱います。</p>

      <div className="admin-actions">
        <button type="button" className="admin-button admin-button--primary" onClick={onSaveRequest} disabled={saving || readOnly}>
          保存して配信
        </button>
        <button type="button" className="admin-button admin-button--secondary" onClick={onRefetch} disabled={refetching}>
          再取得
        </button>
      </div>
    </AdminCard>
  );
}
