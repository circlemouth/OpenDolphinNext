import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isSystemAdminRole } from '../../libs/auth/roles';
import { useAppToast } from '../../libs/ui/appToast';
import {
  fetchMasterUpdateDatasetDetail,
  fetchMasterUpdateDatasets,
  fetchMasterUpdateSchedule,
  rollbackMasterUpdateDataset,
  runMasterUpdateDataset,
  saveMasterUpdateSchedule,
  uploadMasterUpdateDataset,
  type MasterUpdateDataset,
  type MasterUpdateSchedule,
} from './masterUpdateApi';

type MasterUpdatesPanelProps = {
  runId: string;
  role?: string;
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

const toStatusTone = (status?: string) => {
  if (status === 'normal') return 'ok';
  if (status === 'running') return 'pending';
  if (status === 'failed') return 'error';
  if (status === 'update_detected') return 'warn';
  return 'idle';
};

const normalizeSchedule = (schedule?: MasterUpdateSchedule): MasterUpdateSchedule => ({
  autoUpdateTime: schedule?.autoUpdateTime ?? '03:00',
  retryCount: schedule?.retryCount ?? 2,
  timeoutSeconds: schedule?.timeoutSeconds ?? 300,
  maxConcurrency: schedule?.maxConcurrency ?? 2,
  orcaPollIntervalMinutes: schedule?.orcaPollIntervalMinutes ?? 15,
  datasetAutoEnabledOverrides: schedule?.datasetAutoEnabledOverrides ?? {},
});

const resolveOfficialSourceLabel = (dataset?: MasterUpdateDataset) => {
  const kind = dataset?.officialSource?.kind;
  if (kind === 'masterlastupdatev3') return 'official masterlastupdatev3';
  return 'official source metadata';
};

export function MasterUpdatesPanel({ runId, role }: MasterUpdatesPanelProps) {
  const isSystemAdmin = isSystemAdminRole(role);
  const queryClient = useQueryClient();
  const { enqueue } = useAppToast();
  const [selectedDatasetCode, setSelectedDatasetCode] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [scheduleForm, setScheduleForm] = useState<MasterUpdateSchedule>(() => normalizeSchedule());

  const datasetsQuery = useQuery({
    queryKey: ['admin-master-updates-datasets'],
    queryFn: fetchMasterUpdateDatasets,
    staleTime: 30_000,
  });

  const selectedDataset = useMemo(() => {
    const datasets = datasetsQuery.data?.datasets ?? [];
    return datasets.find((dataset) => dataset.code === selectedDatasetCode) ?? datasets[0] ?? null;
  }, [datasetsQuery.data?.datasets, selectedDatasetCode]);

  const detailQuery = useQuery({
    queryKey: ['admin-master-updates-dataset-detail', selectedDataset?.code],
    queryFn: () => fetchMasterUpdateDatasetDetail(selectedDataset?.code ?? ''),
    enabled: Boolean(selectedDataset?.code),
    staleTime: 30_000,
  });

  const scheduleQuery = useQuery({
    queryKey: ['admin-master-updates-schedule'],
    queryFn: fetchMasterUpdateSchedule,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!selectedDatasetCode && datasetsQuery.data?.datasets?.length) {
      setSelectedDatasetCode(datasetsQuery.data.datasets[0].code);
    }
  }, [datasetsQuery.data?.datasets, selectedDatasetCode]);

  useEffect(() => {
    if (scheduleQuery.data?.schedule) {
      setScheduleForm(normalizeSchedule(scheduleQuery.data.schedule));
    }
  }, [scheduleQuery.data?.schedule]);

  const refreshQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-master-updates-datasets'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-master-updates-dataset-detail'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-master-updates-schedule'] });
  };

  const runMutation = useMutation({
    mutationFn: async (params: { code: string; force?: boolean }) => runMasterUpdateDataset(params.code, params.force ?? false),
    onSuccess: async (result, variables) => {
      enqueue({
        tone: 'success',
        message: result.message ?? '更新処理を実行しました。',
        detail: `対象: ${variables.code}`,
      });
      await refreshQueries();
    },
    onError: (error) => {
      enqueue({ tone: 'error', message: '更新処理に失敗しました。', detail: error instanceof Error ? error.message : String(error) });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async (params: { code: string; versionId: string }) => rollbackMasterUpdateDataset(params.code, params.versionId),
    onSuccess: async (result, variables) => {
      enqueue({
        tone: 'success',
        message: result.message ?? 'ロールバックを実行しました。',
        detail: `対象: ${variables.code} / 版ID: ${variables.versionId}`,
      });
      await refreshQueries();
    },
    onError: (error) => {
      enqueue({ tone: 'error', message: 'ロールバックに失敗しました。', detail: error instanceof Error ? error.message : String(error) });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (params: { code: string; file: File }) => uploadMasterUpdateDataset(params.code, params.file),
    onSuccess: async (result, variables) => {
      enqueue({
        tone: 'success',
        message: result.message ?? 'アップロード更新を実行しました。',
        detail: `対象: ${variables.code} / ファイル: ${variables.file.name}`,
      });
      setUploadFile(null);
      await refreshQueries();
    },
    onError: (error) => {
      enqueue({
        tone: 'error',
        message: 'アップロード更新に失敗しました。',
        detail: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => saveMasterUpdateSchedule(scheduleForm),
    onSuccess: async (result) => {
      setScheduleForm(normalizeSchedule(result.schedule));
      enqueue({ tone: 'success', message: 'スケジュールを更新しました。' });
      await refreshQueries();
    },
    onError: (error) => {
      enqueue({
        tone: 'error',
        message: 'スケジュールの更新に失敗しました。',
        detail: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const applyScheduleOverride = (datasetCode: string, enabled: boolean) => {
    setScheduleForm((prev) => ({
      ...prev,
      datasetAutoEnabledOverrides: {
        ...prev.datasetAutoEnabledOverrides,
        [datasetCode]: enabled,
      },
    }));
  };

  const detailDataset: MasterUpdateDataset | null = detailQuery.data?.dataset ?? selectedDataset;

  return (
    <>
      <section className="administration-card" aria-label="マスタ更新ダッシュボード">
        <h2 className="administration-card__title">マスタ更新ダッシュボード</h2>
        <p className="admin-quiet">RUN_ID: {runId}</p>

        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>状態</th>
                <th>データセット</th>
                <th>最終更新</th>
                <th>現行件数</th>
                <th>更新検知</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {(datasetsQuery.data?.datasets ?? []).map((dataset) => (
                <tr key={dataset.code}>
                  <td>
                    <span className={`admin-status admin-status--${toStatusTone(dataset.status)}`}>{dataset.status ?? 'idle'}</span>
                  </td>
                  <td>
                    <strong>{dataset.name}</strong>
                    <div className="admin-quiet">{dataset.code}</div>
                    <div className="admin-quiet">{resolveOfficialSourceLabel(dataset)}</div>
                  </td>
                  <td>{formatTimestamp(dataset.officialSource?.lastCheckedAt ?? dataset.lastSuccessfulAt)}</td>
                  <td>{dataset.currentRecordCount ?? '―'}</td>
                  <td>{dataset.updateDetected ? '更新あり' : '更新なし'}</td>
                  <td className="admin-master__actions">
                    <button
                      type="button"
                      className="admin-button admin-button--secondary"
                      onClick={() => setSelectedDatasetCode(dataset.code)}
                    >
                      詳細
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--primary"
                      disabled={!isSystemAdmin || dataset.running || runMutation.isPending}
                      onClick={() => runMutation.mutate({ code: dataset.code, force: false })}
                    >
                      official再取得
                    </button>
                  </td>
                </tr>
              ))}
              {!datasetsQuery.data?.datasets?.length ? (
                <tr>
                  <td colSpan={6}>データセット情報を取得中です...</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {detailDataset?.lastFailureReason ? (
          <p className="admin-error">最新失敗: {detailDataset.lastFailureReason}</p>
        ) : (
          <p className="admin-quiet">直近の失敗はありません。</p>
        )}
      </section>

      <section className="administration-card" aria-label="データセット詳細">
        <h2 className="administration-card__title">データセット詳細</h2>
        {detailDataset ? (
          <>
            <div className="admin-status-row">
              <span className={`admin-status admin-status--${toStatusTone(detailDataset.status)}`}>{detailDataset.status ?? 'idle'}</span>
              <span>{detailDataset.name}</span>
              <span>最終成功: {formatTimestamp(detailDataset.lastSuccessfulAt)}</span>
            </div>

            <details className="admin-master__minor">
              <summary>official 取得状況</summary>
              <ul className="placeholder-page__list">
                <li>取得方式: {resolveOfficialSourceLabel(detailDataset)}</li>
                <li>取得元URL: {detailDataset.officialSource?.sourceUrl ?? detailDataset.sourceUrl ?? '―'}</li>
                <li>更新頻度: {detailDataset.officialSource?.updateFrequency ?? detailDataset.updateFrequency ?? '―'}</li>
                <li>保存形式: {detailDataset.officialSource?.format ?? detailDataset.format ?? '―'}</li>
                <li>利用注意: {detailDataset.officialSource?.usageNotes ?? detailDataset.usageNotes ?? '―'}</li>
                <li>最終照会: {formatTimestamp(detailDataset.officialSource?.lastCheckedAt ?? detailDataset.lastCheckedAt)}</li>
                <li>更新検知: {(detailDataset.officialSource?.updateDetected ?? detailDataset.updateDetected) ? 'あり' : 'なし'}</li>
              </ul>
            </details>

            <div className="admin-actions">
              <button
                type="button"
                className="admin-button admin-button--primary"
                disabled={!isSystemAdmin || detailDataset.running || runMutation.isPending}
                onClick={() => runMutation.mutate({ code: detailDataset.code, force: true })}
              >
                official再取得
              </button>
              <button
                type="button"
                className="admin-button admin-button--secondary"
                disabled={
                  !(detailDataset.localArtifacts?.manualUploadAllowed ?? detailDataset.manualUploadAllowed)
                  || !isSystemAdmin
                  || uploadMutation.isPending
                  || detailDataset.running
                }
                onClick={() => {
                  if (!uploadFile) {
                    enqueue({ tone: 'warning', message: 'アップロードするファイルを選択してください。' });
                    return;
                  }
                  uploadMutation.mutate({ code: detailDataset.code, file: uploadFile });
                }}
              >
                local artifact をアップロード
              </button>
              <input
                type="file"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                disabled={
                  !(detailDataset.localArtifacts?.manualUploadAllowed ?? detailDataset.manualUploadAllowed)
                  || !isSystemAdmin
                  || uploadMutation.isPending
                  || detailDataset.running
                }
              />
            </div>

            <div className="admin-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>版ID</th>
                    <th>取得元</th>
                    <th>取り込み日時</th>
                    <th>件数</th>
                    <th>差分</th>
                    <th>状態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailDataset.localArtifacts?.versions ?? detailDataset.versions ?? []).slice(0, 5).map((version) => (
                    <tr key={version.versionId}>
                      <td>{version.versionId}</td>
                      <td>{version.sourceKind === 'local_upload' ? 'local upload' : 'official fetch'}</td>
                      <td>{formatTimestamp(version.capturedAt)}</td>
                      <td>{version.recordCount ?? '―'}</td>
                      <td>
                        +{version.addedCount ?? 0} / -{version.removedCount ?? 0} / ~{version.changedCount ?? 0}
                      </td>
                      <td>{version.current ? 'CURRENT' : version.status ?? 'READY'}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-button admin-button--secondary"
                          disabled={!isSystemAdmin || Boolean(version.current) || rollbackMutation.isPending || detailDataset.running}
                          onClick={() => rollbackMutation.mutate({ code: detailDataset.code, versionId: version.versionId })}
                        >
                          ロールバック
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(detailDataset.localArtifacts?.versions ?? detailDataset.versions ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7}>まだ local artifact 履歴がありません。</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="admin-quiet">データセットを選択すると詳細を表示します。</p>
        )}
      </section>

      <section className="administration-card" aria-label="スケジュール設定">
        <h2 className="administration-card__title">スケジュール設定</h2>
        <div className="admin-form">
          <div className="admin-form__field-row">
            <div className="admin-form__field">
              <label htmlFor="master-auto-time">自動更新時刻</label>
              <input
                id="master-auto-time"
                type="time"
                value={scheduleForm.autoUpdateTime}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, autoUpdateTime: event.target.value }))}
                disabled={!isSystemAdmin || saveScheduleMutation.isPending}
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="master-retry">再試行回数</label>
              <input
                id="master-retry"
                type="number"
                min={0}
                max={10}
                value={scheduleForm.retryCount}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, retryCount: Math.max(0, Number(event.target.value) || 0) }))
                }
                disabled={!isSystemAdmin || saveScheduleMutation.isPending}
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="master-timeout">タイムアウト(秒)</label>
              <input
                id="master-timeout"
                type="number"
                min={10}
                max={3600}
                value={scheduleForm.timeoutSeconds}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, timeoutSeconds: Math.max(10, Number(event.target.value) || 10) }))
                }
                disabled={!isSystemAdmin || saveScheduleMutation.isPending}
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="master-concurrency">同時実行上限</label>
              <input
                id="master-concurrency"
                type="number"
                min={1}
                max={10}
                value={scheduleForm.maxConcurrency}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, maxConcurrency: Math.max(1, Number(event.target.value) || 1) }))
                }
                disabled={!isSystemAdmin || saveScheduleMutation.isPending}
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="master-orca-poll">ORCA更新検知間隔(分)</label>
              <input
                id="master-orca-poll"
                type="number"
                min={1}
                max={1440}
                value={scheduleForm.orcaPollIntervalMinutes}
                onChange={(event) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    orcaPollIntervalMinutes: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
                disabled={!isSystemAdmin || saveScheduleMutation.isPending}
              />
            </div>
          </div>

          <details className="admin-master__minor">
            <summary>データセット別 自動更新ON/OFF</summary>
            <div className="admin-master__schedule-overrides">
              {(datasetsQuery.data?.datasets ?? []).map((dataset) => {
                const override = scheduleForm.datasetAutoEnabledOverrides[dataset.code];
                const effective = override ?? dataset.autoEnabled ?? false;
                return (
                  <label key={`schedule-${dataset.code}`} className="admin-toggle">
                    <span className="admin-toggle__label">
                      <span>{dataset.name}</span>
                      <span className="admin-toggle__hint">{dataset.code}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(effective)}
                      disabled={!isSystemAdmin || saveScheduleMutation.isPending}
                      onChange={(event) => applyScheduleOverride(dataset.code, event.target.checked)}
                    />
                  </label>
                );
              })}
            </div>
          </details>

          <div className="admin-actions">
            <button
              type="button"
              className="admin-button admin-button--primary"
              disabled={!isSystemAdmin || saveScheduleMutation.isPending}
              onClick={() => saveScheduleMutation.mutate()}
            >
              スケジュール保存
            </button>
            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={() => {
                setScheduleForm(normalizeSchedule(scheduleQuery.data?.schedule));
                enqueue({ tone: 'info', message: '現在値を再反映しました。' });
              }}
              disabled={saveScheduleMutation.isPending}
            >
              再読込
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
