import { StatusPill, type StatusPillTone } from '../shared/StatusPill';

type OrcaSourceStatus = 'fresh' | 'cache' | 'stale' | 'unknown';
type OrcaDiffSeverity = 'match' | 'warning' | 'unmatched' | 'unknown';

type OrcaDiffRow = {
  id: string;
  label: string;
  orcaValue?: string | null;
  localValue?: string | null;
  cacheValue?: string | null;
  severity?: OrcaDiffSeverity;
  note?: string;
};

type OrcaOriginalPanelProps = {
  patientId?: string;
  visitDate?: string;
  runId?: string;
  fetchedAt?: string;
  sourceStatus?: OrcaSourceStatus;
  rows?: OrcaDiffRow[];
};

const DEFAULT_ROWS: OrcaDiffRow[] = [
  {
    id: 'patient',
    label: '患者基本',
    severity: 'unknown',
    note: 'ORCA正本の再取得結果が未接続です。院内表示をORCA正本として扱いません。',
  },
  {
    id: 'insurance',
    label: '保険組合せ',
    severity: 'unknown',
    note: '保険・公費・組合せはORCA正本を確認してから送信判断します。',
  },
  {
    id: 'acceptance',
    label: '受付/診療日',
    severity: 'unknown',
    note: '受付IDや診療日は表示確認用です。会計反映状態、診療録確定、処方確定とは別状態です。',
  },
];

const resolveSourceLabel = (status: OrcaSourceStatus) => {
  switch (status) {
    case 'fresh':
      return 'ORCA正本再取得済み';
    case 'cache':
      return 'ORCA由来キャッシュ';
    case 'stale':
      return 'ORCA正本再取得が必要';
    case 'unknown':
    default:
      return 'ORCA正本未確認';
  }
};

const resolveSourceTone = (status: OrcaSourceStatus): StatusPillTone => {
  switch (status) {
    case 'fresh':
      return 'success';
    case 'cache':
      return 'info';
    case 'stale':
    case 'unknown':
    default:
      return 'warning';
  }
};

const resolveDiffLabel = (severity: OrcaDiffSeverity) => {
  switch (severity) {
    case 'match':
      return '一致';
    case 'warning':
      return '警告';
    case 'unmatched':
      return '不一致';
    case 'unknown':
    default:
      return '未確認';
  }
};

const resolveDiffTone = (severity: OrcaDiffSeverity): StatusPillTone => {
  switch (severity) {
    case 'match':
      return 'success';
    case 'warning':
      return 'warning';
    case 'unmatched':
      return 'error';
    case 'unknown':
    default:
      return 'warning';
  }
};

const displayValue = (value?: string | null) => {
  if (!value || value.trim().length === 0) return '—';
  return value;
};

export function OrcaOriginalPanel({
  patientId,
  visitDate,
  runId,
  fetchedAt,
  sourceStatus = 'unknown',
  rows = DEFAULT_ROWS,
}: OrcaOriginalPanelProps) {
  const hasReviewRows = rows.some((row) => row.severity !== 'match');

  return (
    <section className="charts-orca-original" aria-label="ORCA正本差分確認">
      <header className="charts-orca-original__header">
        <p className="charts-orca-original__kicker">M13 / ORCA official diff</p>
        <h3>ORCA正本・院内表示・キャッシュ差分</h3>
        <p className="charts-orca-original__sub">
          ORCA正本、院内表示、表示キャッシュを分けて確認します。ここに表示した差分は会計反映状態の確定、診療録確定、処方確定を意味しません。
        </p>
        <div className="charts-orca-original__defaults" aria-label="ORCA差分確認メタ情報">
          <StatusPill label="ORCA状態" value={resolveSourceLabel(sourceStatus)} tone={resolveSourceTone(sourceStatus)} size="xs" runId={runId} />
          <StatusPill label="患者ID" value={patientId ?? '未選択'} tone={patientId ? 'info' : 'warning'} size="xs" runId={runId} />
          <StatusPill label="診療日" value={visitDate ?? '未確定'} tone={visitDate ? 'info' : 'warning'} size="xs" runId={runId} />
          <StatusPill label="取得時刻" value={fetchedAt ?? '未取得'} tone={fetchedAt ? 'info' : 'warning'} size="xs" runId={runId} />
        </div>
      </header>

      {hasReviewRows ? (
        <p className="charts-orca-original__warning" role="alert">
          ORCA正本の警告・不一致・未確認は成功扱いしません。再取得または照合後に、患者・受付・診療日の一致を確認してください。
        </p>
      ) : null}

      <div className="charts-orca-original__direct" aria-label="差分一覧">
        {rows.length === 0 ? (
          <p className="charts-orca-original__empty">表示できる差分行がありません。ORCA正本を再取得してから確認してください。</p>
        ) : (
          rows.map((row) => {
            const severity = row.severity ?? 'unknown';
            return (
              <section key={row.id} className="charts-orca-original__section" aria-label={`${row.label}の差分`}>
                <div className="charts-orca-original__section-head">
                  <div>
                    <strong>{row.label}</strong>
                    <span>{row.note ?? 'ORCA正本と院内表示を分けて確認してください。'}</span>
                  </div>
                  <div className="charts-orca-original__section-actions" aria-label={`${row.label}の状態`}>
                    <StatusPill tone={resolveDiffTone(severity)} size="xs" runId={runId}>
                      {resolveDiffLabel(severity)}
                    </StatusPill>
                  </div>
                </div>
                <dl className="charts-orca-original__meta">
                  <div>
                    <dt>ORCA正本</dt>
                    <dd>{displayValue(row.orcaValue)}</dd>
                  </div>
                  <div>
                    <dt>院内表示</dt>
                    <dd>{displayValue(row.localValue)}</dd>
                  </div>
                  <div>
                    <dt>キャッシュ/snapshot</dt>
                    <dd>{displayValue(row.cacheValue)}</dd>
                  </div>
                </dl>
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
