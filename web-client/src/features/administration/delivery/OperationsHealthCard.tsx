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
  refreshPending: boolean;
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
  if (typeof check.mode === 'string' && check.mode) return `mode=${check.mode}`;
  if (typeof check.reasonCode === 'string' && check.reasonCode) return `reasonCode=${check.reasonCode}`;
  if (typeof check.backendReachable === 'boolean') return `backendReachable=${check.backendReachable}`;
  if (typeof check.credentialConfigured === 'boolean') return `credentialConfigured=${check.credentialConfigured}`;
  if (typeof check.workerStatus === 'string' && check.workerStatus) return `worker=${check.workerStatus}`;
  if (Array.isArray(check.reasonCodes) && check.reasonCodes.length > 0) return `reasonCodes=${check.reasonCodes.join(', ')}`;
  return 'OK';
};

export function OperationsHealthCard({
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
  refreshPending,
}: OperationsHealthCardProps) {
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
      description="health/readiness と直近の接続状態を参照します。接続テストの実行は接続設定から行います。"
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
            <tr>
              <td>patientImages</td>
              <td>{checks.patientImages?.status ?? '―'}</td>
              <td>{getCheckDetails(checks.patientImages)}</td>
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
        {pvtWorkerResult?.reasonCodes.length ? <div>PVT reasonCodes: {pvtWorkerResult.reasonCodes.join(' / ')}</div> : null}
        {healthResult?.error || readinessResult?.error || pvtWorkerResult?.error ? (
          <div className="admin-note">内部エラー詳細は通常表示に出さず、RUN_ID と traceId で追跡します。</div>
        ) : null}
      </div>

      {pending ? <p className="admin-note">監視情報を更新中です。</p> : null}
    </AdminCard>
  );
}
