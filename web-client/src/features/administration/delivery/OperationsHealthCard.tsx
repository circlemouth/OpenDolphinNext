import type {
  OperationsCheck,
  OperationsHealthResponse,
  OperationsReadinessResponse,
  PvtWorkerHealthResponse,
} from '../api';
import type { OrcaConnectionTestResponse } from '../orcaConnectionApi';

import { AdminCard } from '../components/AdminCard';
import { AdminStatusPill } from '../components/AdminStatusPill';

type OperationsHealthCardProps = {
  isSystemAdmin: boolean;
  guardDetailsId?: string;
  healthResult: OperationsHealthResponse | null;
  readinessResult: OperationsReadinessResponse | null;
  pvtWorkerResult: PvtWorkerHealthResponse | null;
  healthPending: boolean;
  readinessPending: boolean;
  pvtWorkerPending: boolean;
  orcaConnectionStatusTone: 'ok' | 'warn' | 'error' | 'pending' | 'idle';
  orcaConnectionStatusLabel: string;
  orcaConnectionResult: OrcaConnectionTestResponse | null;
  onRefresh: () => void;
  onRunConnectionTest: () => void;
  refreshPending: boolean;
  connectionTestPending: boolean;
};

const resolveStatusTone = (status?: string) => {
  if (!status) return 'idle' as const;
  if (status === 'UP') return 'ok' as const;
  if (status === 'DISABLED') return 'warn' as const;
  if (status === 'DOWN') return 'error' as const;
  return 'idle' as const;
};

const getCheckDetails = (check?: OperationsCheck) => {
  if (!check) return '―';
  if (typeof check.auditSummary === 'string' && check.auditSummary) return check.auditSummary;
  if (typeof check.mode === 'string' && check.mode) return `mode=${check.mode}`;
  if (typeof check.workerStatus === 'string' && check.workerStatus) return `worker=${check.workerStatus}`;
  if (Array.isArray(check.reasons) && check.reasons.length > 0) return `reasons=${check.reasons.join(', ')}`;
  return 'OK';
};

export function OperationsHealthCard({
  isSystemAdmin,
  guardDetailsId,
  healthResult,
  readinessResult,
  pvtWorkerResult,
  healthPending,
  readinessPending,
  pvtWorkerPending,
  orcaConnectionStatusTone,
  orcaConnectionStatusLabel,
  orcaConnectionResult,
  onRefresh,
  onRunConnectionTest,
  refreshPending,
  connectionTestPending,
}: OperationsHealthCardProps) {
  const readOnly = !isSystemAdmin;
  const checks = readinessResult?.checks ?? {};
  const pending = healthPending || readinessPending || pvtWorkerPending;
  const readinessTone = readinessPending
    ? ('pending' as const)
    : resolveStatusTone(readinessResult?.summaryStatus);
  const livenessTone = healthPending ? ('pending' as const) : resolveStatusTone(healthResult?.summaryStatus);
  const pvtTone = pvtWorkerPending ? ('pending' as const) : resolveStatusTone(pvtWorkerResult?.workerStatus);

  return (
    <AdminCard
      title="運用監視"
      description="health/readiness と ORCA 接続テスト結果を統合して表示します。"
      status={
        <AdminStatusPill
          status={readinessTone}
          value={
            readinessPending
              ? 'readiness: 実行中'
              : `readiness: ${readinessResult?.summaryStatus ?? '未取得'}`
          }
        />
      }
      actions={
        <div className="admin-actions">
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={onRefresh}
            disabled={refreshPending}
          >
            health/readiness 再取得
          </button>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={onRunConnectionTest}
            disabled={connectionTestPending || readOnly}
            aria-describedby={readOnly ? guardDetailsId : undefined}
          >
            ORCA 接続テスト
          </button>
        </div>
      }
    >
      <div className="admin-inline-meta">
        <AdminStatusPill
          status={livenessTone}
          value={healthPending ? 'health: 実行中' : `health: ${healthResult?.summaryStatus ?? '未取得'}`}
        />
        <AdminStatusPill
          status={pvtTone}
          value={pvtWorkerPending ? 'PVT worker: 実行中' : `PVT worker: ${pvtWorkerResult?.workerStatus ?? '未取得'}`}
        />
        <AdminStatusPill status={orcaConnectionStatusTone} value={`ORCA接続: ${orcaConnectionStatusLabel}`} />
      </div>

      <div className="admin-scroll admin-scroll--sticky">
        <table className="admin-table" aria-label="readiness checks">
          <thead>
            <tr>
              <th>check</th>
              <th>status</th>
              <th>details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>database</td>
              <td>{checks.database?.status ?? '―'}</td>
              <td>{getCheckDetails(checks.database)}</td>
            </tr>
            <tr>
              <td>orca</td>
              <td>{checks.orca?.status ?? '―'}</td>
              <td>{getCheckDetails(checks.orca)}</td>
            </tr>
            <tr>
              <td>attachmentStorage</td>
              <td>{checks.attachmentStorage?.status ?? '―'}</td>
              <td>{getCheckDetails(checks.attachmentStorage)}</td>
            </tr>
            <tr>
              <td>pvtQueue</td>
              <td>{checks.pvtQueue?.status ?? '―'}</td>
              <td>{getCheckDetails(checks.pvtQueue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="admin-result admin-result--stack">
        <div>liveness HTTP: {healthResult?.status ?? '―'}</div>
        <div>readiness HTTP: {readinessResult?.status ?? '―'}</div>
        <div>PVT worker HTTP: {pvtWorkerResult?.status ?? '―'}</div>
        <div>
          ORCA test: HTTP {orcaConnectionResult?.orcaHttpStatus ?? orcaConnectionResult?.status ?? '―'} / Api_Result=
          {orcaConnectionResult?.apiResult ?? '―'}
        </div>
        {pvtWorkerResult?.reasons.length ? <div>PVT reasons: {pvtWorkerResult.reasons.join(' / ')}</div> : null}
        {healthResult?.error ? <div className="admin-error">health error: {healthResult.error}</div> : null}
        {readinessResult?.error ? <div className="admin-error">readiness error: {readinessResult.error}</div> : null}
        {pvtWorkerResult?.error ? <div className="admin-error">pvt worker error: {pvtWorkerResult.error}</div> : null}
      </div>

      {pending ? <p className="admin-note">監視情報を更新中です。</p> : null}
    </AdminCard>
  );
}
