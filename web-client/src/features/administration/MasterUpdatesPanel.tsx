import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isSystemAdminRole } from '../../libs/auth/roles';
import { useAppToast } from '../../libs/ui/appToast';
import {
  fetchMasterUpdateDatasetDetail,
  fetchMasterUpdateDatasets,
  fetchMasterUpdateSchedule,
  previewMasterUpdateDatasetUpload,
  rollbackMasterUpdateDataset,
  runMasterUpdateDataset,
  saveMasterUpdateSchedule,
  uploadMasterUpdateDataset,
  type MasterUpdateDataset,
  type MasterUpdateSchedule,
  type MasterUpdateUploadPreview,
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

const formatOfficialUpdateDate = (value?: string) => {
  if (!value) return '―';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return formatTimestamp(value);
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

const MASTER_CANDIDATE_QUERY_KEYS = new Set([
  'charts-prescription-drug-search-v2',
  'charts-prescription-usage-master-v2',
  'charts-order-item-predictive',
  'charts-order-selection-comments',
  'charts-order-usage-search',
  'charts-order-bodypart-search',
  'charts-order-comment-search',
  'charts-diagnosis-master-candidates',
]);

const shouldInvalidateMasterCandidateQuery = (queryKey: readonly unknown[]) => {
  const head = queryKey[0];
  return typeof head === 'string' && MASTER_CANDIDATE_QUERY_KEYS.has(head);
};

const formatMasterTypeCounts = (counts?: Record<string, number>) => {
  const entries = Object.entries(counts ?? {});
  if (entries.length === 0) return '―';
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 4)
    .map(([type, count]) => `${type}:${count}`)
    .join(' / ');
};

export function MasterUpdatesPanel({ runId, role }: MasterUpdatesPanelProps) {
  const isSystemAdmin = isSystemAdminRole(role);
  const queryClient = useQueryClient();
  const { enqueue } = useAppToast();
  const [selectedDatasetCode, setSelectedDatasetCode] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<MasterUpdateUploadPreview | null>(null);
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
    setUploadFile(null);
    setUploadPreview(null);
  }, [selectedDataset?.code]);

  useEffect(() => {
    if (scheduleQuery.data?.schedule) {
      setScheduleForm(normalizeSchedule(scheduleQuery.data.schedule));
    }
  }, [scheduleQuery.data?.schedule]);

  const refreshQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-master-updates-datasets'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-master-updates-dataset-detail'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-master-updates-schedule'] });
    await queryClient.invalidateQueries({ predicate: (query) => shouldInvalidateMasterCandidateQuery(query.queryKey) });
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

  const previewMutation = useMutation({
    mutationFn: async (params: { code: string; file: File }) => previewMasterUpdateDatasetUpload(params.code, params.file),
    onSuccess: async (result) => {
      setUploadPreview(result.preview ?? null);
      enqueue({
        tone: result.preview?.importable ? 'success' : 'warning',
        message: result.message ?? 'artifact を検証しました。',
        detail: result.preview?.masterVersion ? `masterVersion: ${result.preview.masterVersion}` : undefined,
      });
      await refreshQueries();
    },
    onError: (error) => {
      setUploadPreview(null);
      enqueue({
        tone: 'error',
        message: 'artifact 検証に失敗しました。',
        detail: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (params: { code: string; file: File; previewHash?: string }) =>
      uploadMasterUpdateDataset(params.code, params.file, params.previewHash),
    onSuccess: async (result, variables) => {
      enqueue({
        tone: 'success',
        message: result.message ?? 'アップロード更新を実行しました。',
        detail: `対象: ${variables.code} / ファイル: ${variables.file.name}`,
      });
      setUploadFile(null);
      setUploadPreview(null);
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
  const isLocalMasterCacheDataset = detailDataset?.code === 'local_orca_master_cache';
  const previewReady = Boolean(uploadPreview?.importable && uploadPreview.uploadedSha256);

  return (
    <>
      <section className="administration-card" aria-label="マスタ更新ダッシュボード">
        <h2 className="administration-card__title">マスタ更新ダッシュボード</h2>
        <p className="admin-quiet">RUN_ID: {runId}</p>
        <p className="admin-note">
          official 最終更新情報の確認と、取り込んだ local artifact の管理を分けて表示します。official 取得を実行すると、結果は local artifact 履歴へ追加されます。
        </p>

        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>状態</th>
                <th>データセット</th>
                <th>official最終更新日</th>
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
                  <td>{formatOfficialUpdateDate(dataset.officialSource?.officialLastUpdateDate)}</td>
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
                      {dataset.code === 'local_orca_master_cache' ? '自動取得を実行' : 'official取得を実行'}
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
              <summary>official 最終更新情報</summary>
              <ul className="placeholder-page__list">
                <li>取得方式: {resolveOfficialSourceLabel(detailDataset)}</li>
                <li>official最終更新日: {formatOfficialUpdateDate(detailDataset.officialSource?.officialLastUpdateDate)}</li>
                <li>official取得日時: {formatTimestamp(detailDataset.officialSource?.officialCapturedAt)}</li>
                <li>取得元URL: {detailDataset.officialSource?.sourceUrl ?? detailDataset.sourceUrl ?? '―'}</li>
                <li>更新頻度: {detailDataset.officialSource?.updateFrequency ?? detailDataset.updateFrequency ?? '―'}</li>
                <li>保存形式: {detailDataset.officialSource?.format ?? detailDataset.format ?? '―'}</li>
                <li>利用注意: {detailDataset.officialSource?.usageNotes ?? detailDataset.usageNotes ?? '―'}</li>
                <li>最終照会: {formatTimestamp(detailDataset.officialSource?.lastCheckedAt ?? detailDataset.lastCheckedAt)}</li>
                <li>更新検知: {(detailDataset.officialSource?.updateDetected ?? detailDataset.updateDetected) ? 'あり' : 'なし'}</li>
              </ul>
            </details>

            <details className="admin-master__minor">
              <summary>local artifact 履歴 / rollback</summary>
              <ul className="placeholder-page__list">
                <li>現行版ID: {detailDataset.localArtifacts?.currentVersionId ?? detailDataset.currentVersionId ?? '―'}</li>
                <li>現行取り込み日時: {formatTimestamp(detailDataset.localArtifacts?.currentCapturedAt ?? detailDataset.currentCapturedAt)}</li>
                <li>現行件数: {detailDataset.localArtifacts?.currentRecordCount ?? detailDataset.currentRecordCount ?? '―'}</li>
                <li>現行 master type 別件数: {formatMasterTypeCounts(detailDataset.localArtifacts?.currentMasterTypeCounts)}</li>
                <li>artifact 保存先: {detailDataset.localArtifacts?.currentArtifactPath ?? '―'}</li>
                <li>履歴件数: {detailDataset.localArtifacts?.versionCount ?? detailDataset.versionCount ?? 0}</li>
              </ul>
            </details>

            <div className="admin-actions">
              <button
                type="button"
                className="admin-button admin-button--primary"
                disabled={!isSystemAdmin || detailDataset.running || runMutation.isPending}
                onClick={() => runMutation.mutate({ code: detailDataset.code, force: true })}
              >
                {isLocalMasterCacheDataset ? '自動取得を実行' : 'official取得を実行'}
              </button>
              {isLocalMasterCacheDataset ? (
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  disabled={
                    !isSystemAdmin
                    || !uploadFile
                    || previewMutation.isPending
                    || uploadMutation.isPending
                    || detailDataset.running
                  }
                  onClick={() => {
                    if (!uploadFile) {
                      enqueue({ tone: 'warning', message: '検証する artifact を選択してください。' });
                      return;
                    }
                    previewMutation.mutate({ code: detailDataset.code, file: uploadFile });
                  }}
                >
                  artifact を検証
                </button>
              ) : null}
              <button
                type="button"
                className="admin-button admin-button--secondary"
                disabled={
                  !(detailDataset.localArtifacts?.manualUploadAllowed ?? detailDataset.manualUploadAllowed)
                  || !isSystemAdmin
                  || uploadMutation.isPending
                  || previewMutation.isPending
                  || detailDataset.running
                  || (isLocalMasterCacheDataset && !previewReady)
                }
                onClick={() => {
                  if (!uploadFile) {
                    enqueue({ tone: 'warning', message: 'アップロードするファイルを選択してください。' });
                    return;
                  }
                  uploadMutation.mutate({
                    code: detailDataset.code,
                    file: uploadFile,
                    previewHash: isLocalMasterCacheDataset ? uploadPreview?.uploadedSha256 : undefined,
                  });
                }}
              >
                確定アップロード
              </button>
              <input
                type="file"
                accept={isLocalMasterCacheDataset ? '.zip,application/zip' : undefined}
                onChange={(event) => {
                  setUploadFile(event.target.files?.[0] ?? null);
                  setUploadPreview(null);
                }}
                disabled={
                  !(detailDataset.localArtifacts?.manualUploadAllowed ?? detailDataset.manualUploadAllowed)
                  || !isSystemAdmin
                  || uploadMutation.isPending
                  || previewMutation.isPending
                  || detailDataset.running
                }
              />
            </div>

            {isLocalMasterCacheDataset ? (
              <div className="admin-master__minor" aria-label="local master artifact preview">
                <h3>local master artifact 検証</h3>
                {uploadPreview ? (
                  <>
                    <ul className="placeholder-page__list">
                      <li>判定: {uploadPreview.importable ? '取り込み可能' : '取り込み不可'}</li>
                      <li>masterVersion: {uploadPreview.masterVersion ?? '―'}</li>
                      <li>sourceKind: {uploadPreview.sourceKind ?? '―'}</li>
                      <li>sourceId: {uploadPreview.sourceId ?? '―'}</li>
                      <li>uploadedSha256: {uploadPreview.uploadedSha256 ?? '―'}</li>
                      <li>行数: {uploadPreview.importedRows ?? '―'}</li>
                    </ul>
                    <div className="admin-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>master type</th>
                            <th>件数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(uploadPreview.masterTypeCounts ?? {}).map(([type, count]) => (
                            <tr key={type}>
                              <td>{type}</td>
                              <td>{count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {uploadPreview.warnings?.length ? (
                      <p className="admin-error">{uploadPreview.warnings.join(' / ')}</p>
                    ) : (
                      <p className="admin-quiet">警告はありません。</p>
                    )}
                  </>
                ) : (
                  <p className="admin-quiet">artifact を選択して検証すると、manifest と master type 別件数を表示します。</p>
                )}
              </div>
            ) : null}

            <div className="admin-scroll" aria-label="local artifact history">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>版ID</th>
                    <th>取得元</th>
                    <th>取り込み日時</th>
                    <th>件数</th>
                    <th>master type 別件数</th>
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
                      <td>{formatMasterTypeCounts(version.masterTypeCounts)}</td>
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
