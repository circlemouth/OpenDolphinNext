import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchKarteImageList,
  validateAttachmentPayload,
  IMAGE_ATTACHMENT_ALLOWED_EXTENSIONS,
  IMAGE_ATTACHMENT_MAX_SIZE_BYTES,
  type UploadProgressMode,
  type KarteImageListItem,
} from '../api';
import { buildAttachmentPayload, formatBytes } from '../imageUploader';
import { logAuditEvent } from '../../../libs/audit/auditLogger';
import { recordOutpatientFunnel } from '../../../libs/telemetry/telemetryClient';
import { ensureObservabilityMeta, resolveAriaLive, resolveRunId } from '../../../libs/observability/observability';
import { safeSameOriginHttpUrl } from '../../../libs/security/safeUrl';
import { ImageCameraCapture } from './ImageCameraCapture';
import { ImageDropzone } from './ImageDropzone';
import { uploadPatientImageViaXhr } from '../mobileApi';

type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  progressMode: UploadProgressMode;
  error?: string;
  previewUrl?: string;
  endpoint?: string;
};

type StatusMessage = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

const formatRecordedAt = (value?: string) => {
  if (!value) return '―';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
};

const buildUploadId = () => `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const FEATURE_DISABLED_MESSAGE = '患者画像機能はサーバーで無効化されています。';

export function ImageDockedPanel({
  patientId,
  appointmentId,
  runId,
  selectedAttachmentIds = [],
  onToggleDocumentAttachment,
  onInsertSoapAttachment,
  soapTargetOptions,
  soapTargetSection,
  onSoapTargetChange,
  onStateChange,
}: {
  patientId?: string;
  appointmentId?: string;
  runId?: string;
  selectedAttachmentIds?: number[];
  onToggleDocumentAttachment?: (attachment: KarteImageListItem) => void;
  onInsertSoapAttachment?: (attachment: KarteImageListItem) => void;
  soapTargetOptions?: Array<{ value: string; label: string }>;
  soapTargetSection?: string;
  onSoapTargetChange?: (value: string) => void;
  onStateChange?: (next: {
    queueCount: number;
    uploadingCount: number;
    hasError: boolean;
  }) => void;
}) {
  const meta = ensureObservabilityMeta();
  const resolvedRunId = resolveRunId(runId) ?? meta.runId;
  const infoLive = resolveAriaLive('info');
  const selectedIdSet = useMemo(() => new Set(selectedAttachmentIds), [selectedAttachmentIds]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const uploadItemsRef = useRef<UploadItem[]>([]);
  const uploadingRef = useRef<Set<string>>(new Set());
  const [brokenThumbnails, setBrokenThumbnails] = useState<Set<number>>(new Set());

  useEffect(() => {
    uploadItemsRef.current = uploadItems;
  }, [uploadItems]);

  useEffect(() => {
    return () => {
      uploadItemsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const imageListQuery = useQuery({
    queryKey: ['karte-image-list', patientId],
    queryFn: () => fetchKarteImageList({ chartId: patientId }),
    enabled: Boolean(patientId),
  });

  const listItems = imageListQuery.data?.list ?? [];
  const imagesFeatureDisabled = imageListQuery.data?.errorCode === 'feature_disabled';

  const maxSizeLabel = useMemo(() => {
    return `最大 ${formatBytes(IMAGE_ATTACHMENT_MAX_SIZE_BYTES)}`;
  }, []);

  const updateUploadItem = useCallback((id: string, updater: (item: UploadItem) => UploadItem) => {
    setUploadItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const resolveProgressMode = useCallback((id: string) => {
    return uploadItemsRef.current.find((entry) => entry.id === id)?.progressMode ?? 'indeterminate';
  }, []);

  const markThumbnailBroken = useCallback((id?: number) => {
    if (!id) return;
    setBrokenThumbnails((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const recordTelemetry = useCallback(
    (payload: {
      outcome: 'started' | 'success' | 'error';
      contentSize: number;
      endpoint?: string;
      reason?: string;
      fileName?: string;
      progressMode: UploadProgressMode;
    }) => {
      recordOutpatientFunnel('charts_patient_sidepane', {
        action: 'image_upload_ui',
        outcome: payload.outcome,
        cacheHit: meta.cacheHit ?? false,
        missingMaster: meta.missingMaster ?? false,
        dataSourceTransition: meta.dataSourceTransition ?? 'server',
        note: JSON.stringify({
          contentSize: payload.contentSize,
          endpoint: payload.endpoint,
          fileName: payload.fileName,
          progressMode: payload.progressMode,
        }),
        reason: payload.outcome === 'error' ? payload.reason ?? 'upload_failed' : undefined,
      });
    },
    [meta.cacheHit, meta.dataSourceTransition, meta.missingMaster],
  );

  const recordAudit = useCallback(
    (payload: {
      outcome: 'started' | 'success' | 'error';
      contentSize: number;
      endpoint?: string;
      fileName?: string;
      error?: string;
      reason?: string;
      progressMode: UploadProgressMode;
    }) => {
      logAuditEvent({
        runId: resolvedRunId,
        traceId: meta.traceId,
        payload: {
          action: 'image_upload_ui',
          screen: 'charts',
          outcome: payload.outcome,
          endpoint: payload.endpoint,
          contentSize: payload.contentSize,
          fileName: payload.fileName,
          patientId,
          appointmentId,
          error: payload.error,
          reason: payload.reason,
          details: {
            endpoint: payload.endpoint,
            contentSize: payload.contentSize,
            fileName: payload.fileName,
            patientId,
            appointmentId,
            reason: payload.reason,
            progressMode: payload.progressMode,
          },
        },
      });
    },
    [appointmentId, meta.traceId, patientId, resolvedRunId],
  );

  const handleUpload = useCallback(
    async (itemId: string) => {
      if (uploadingRef.current.has(itemId)) return;
      const item = uploadItemsRef.current.find((entry) => entry.id === itemId);
      if (!item) return;
      uploadingRef.current.add(itemId);
      updateUploadItem(itemId, (current) => ({
        ...current,
        status: 'uploading',
        progress: 0,
        progressMode: 'indeterminate',
        error: undefined,
      }));
      const startMode = resolveProgressMode(itemId);
      recordTelemetry({
        outcome: 'started',
        contentSize: item.file.size,
        endpoint: '/patients/{patientId}/images',
        fileName: item.file.name,
        progressMode: startMode,
      });
      recordAudit({
        outcome: 'started',
        contentSize: item.file.size,
        endpoint: '/patients/{patientId}/images',
        fileName: item.file.name,
        progressMode: startMode,
      });

      try {
        const attachment = await buildAttachmentPayload(item.file);
        const validation = validateAttachmentPayload([attachment]);
        if (!validation.ok) {
          const message = validation.errors.map((entry) => entry.message).join(' / ');
          updateUploadItem(itemId, (current) => ({ ...current, status: 'error', error: message, progress: 100 }));
          setStatusMessage({ tone: 'error', message: `アップロードに失敗しました: ${message}` });
          recordTelemetry({
            outcome: 'error',
            contentSize: item.file.size,
            endpoint: '/patients/{patientId}/images',
            reason: 'validation_failed',
            fileName: item.file.name,
            progressMode: resolveProgressMode(itemId),
          });
          recordAudit({
            outcome: 'error',
            contentSize: item.file.size,
            endpoint: '/patients/{patientId}/images',
            fileName: item.file.name,
            error: message,
            reason: 'validation_failed',
            progressMode: resolveProgressMode(itemId),
          });
          return;
        }
        const result = await uploadPatientImageViaXhr({
          patientId: patientId ?? '',
          file: item.file,
          onProgress: (event) => {
            updateUploadItem(itemId, (current) => ({
              ...current,
              progressMode: event.mode,
              progress: event.mode === 'real' && typeof event.percent === 'number' ? event.percent : current.progress,
            }));
          },
        });
        if (!result.ok) {
          const message = result.errorCode === 'feature_disabled' ? FEATURE_DISABLED_MESSAGE : result.error ?? `HTTP ${result.status}`;
          updateUploadItem(itemId, (current) => ({
            ...current,
            status: 'error',
            error: message,
            progress: current.progress,
            endpoint: result.endpoint,
          }));
          setStatusMessage({ tone: 'error', message: `アップロードに失敗しました: ${message}` });
          recordTelemetry({
            outcome: 'error',
            contentSize: item.file.size,
            endpoint: result.endpoint,
            reason: 'upload_failed',
            fileName: item.file.name,
            progressMode: result.progressMode,
          });
          recordAudit({
            outcome: 'error',
            contentSize: item.file.size,
            endpoint: result.endpoint,
            fileName: item.file.name,
            error: message,
            reason: 'upload_failed',
            progressMode: result.progressMode,
          });
          return;
        }
        updateUploadItem(itemId, (current) => ({
          ...current,
          status: 'success',
          progress: 100,
          endpoint: result.endpoint,
        }));
        setStatusMessage({ tone: 'success', message: `${item.file.name} をアップロードしました。` });
        recordTelemetry({
          outcome: 'success',
          contentSize: item.file.size,
          endpoint: result.endpoint,
          fileName: item.file.name,
          progressMode: result.progressMode,
        });
        recordAudit({
          outcome: 'success',
          contentSize: item.file.size,
          endpoint: result.endpoint,
          fileName: item.file.name,
          progressMode: result.progressMode,
        });
        await imageListQuery.refetch();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'アップロードに失敗しました。';
        updateUploadItem(itemId, (current) => ({
          ...current,
          status: 'error',
          error: message,
          progress: current.progress,
        }));
        setStatusMessage({ tone: 'error', message: `アップロードに失敗しました: ${message}` });
        recordTelemetry({
          outcome: 'error',
          contentSize: item.file.size,
          endpoint: '/patients/{patientId}/images',
          reason: 'upload_failed',
          fileName: item.file.name,
          progressMode: resolveProgressMode(itemId),
        });
        recordAudit({
          outcome: 'error',
          contentSize: item.file.size,
          endpoint: '/patients/{patientId}/images',
          fileName: item.file.name,
          error: message,
          reason: 'upload_failed',
          progressMode: resolveProgressMode(itemId),
        });
      } finally {
        uploadingRef.current.delete(itemId);
      }
    },
    [imageListQuery, patientId, recordAudit, recordTelemetry, resolveProgressMode, updateUploadItem],
  );

  useEffect(() => {
    const queued = uploadItems.filter((item) => item.status === 'queued');
    queued.forEach((item) => {
      handleUpload(item.id);
    });
  }, [handleUpload, uploadItems]);

  const enqueueFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setUploadItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: buildUploadId(),
        file,
        status: 'queued' as UploadStatus,
        progress: 0,
        progressMode: 'indeterminate' as UploadProgressMode,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const handleRetry = useCallback(
    (itemId: string) => {
      updateUploadItem(itemId, (current) => ({ ...current, status: 'queued', error: undefined, progress: 0 }));
    },
    [updateUploadItem],
  );

  const statusLive = statusMessage
    ? resolveAriaLive(statusMessage.tone === 'info' ? 'info' : statusMessage.tone === 'error' ? 'error' : 'success')
    : resolveAriaLive('info');
  const statusRole = statusMessage?.tone === 'error' ? 'alert' : 'status';
  const uploadingCount = useMemo(() => uploadItems.filter((item) => item.status === 'uploading').length, [uploadItems]);
  const hasErrorState = Boolean(
    statusMessage?.tone === 'error' ||
      uploadItems.some((item) => item.status === 'error') ||
      imageListQuery.isError ||
      (imageListQuery.data && !imageListQuery.data.ok),
  );

  useEffect(() => {
    onStateChange?.({
      queueCount: uploadItems.length,
      uploadingCount,
      hasError: hasErrorState,
    });
  }, [hasErrorState, onStateChange, uploadItems.length, uploadingCount]);

  return (
    <section className="charts-image-panel" data-test-id="charts-image-panel" data-run-id={resolvedRunId}>
      <header className="charts-image-panel__header">
        <div>
          <p className="charts-image-panel__eyebrow">画像/スキャン</p>
          <h3>患者画像</h3>
          <p className="charts-image-panel__lead">
            サムネイル一覧の確認と、ファイル/カメラからのアップロード導線をまとめています。
          </p>
        </div>
        <div className="charts-image-panel__meta" aria-live={infoLive}>
          <span>対応拡張子: {IMAGE_ATTACHMENT_ALLOWED_EXTENSIONS.join(', ')}</span>
          <span>最大サイズ: {formatBytes(IMAGE_ATTACHMENT_MAX_SIZE_BYTES)}</span>
        </div>
      </header>
      {soapTargetOptions && soapTargetOptions.length > 0 ? (
        <div className="charts-image-panel__target">
          <label>
            SOAP挿入先
            <select
              id="image-soap-target"
              name="imageSoapTarget"
              value={soapTargetSection ?? soapTargetOptions[0].value}
              onChange={(event) => onSoapTargetChange?.(event.target.value)}
              disabled={!patientId}
              aria-label="SOAP貼付先"
            >
              {soapTargetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          className={`charts-image-panel__status charts-image-panel__status--${statusMessage.tone}`}
          role={statusRole}
          aria-live={statusLive}
          aria-atomic="true"
          data-test-id="image-upload-status"
        >
          {statusMessage.message}
        </div>
      ) : null}

      {!patientId ? (
        <div className="charts-image-panel__notice" role="alert" aria-live="assertive">
          患者が未選択のため、画像の登録は無効です。患者を選択してください。
        </div>
      ) : null}

      <div className="charts-image-panel__upload">
        <ImageDropzone onFiles={enqueueFiles} disabled={!patientId || imagesFeatureDisabled} maxSizeLabel={maxSizeLabel} />
        <div className="charts-image-panel__queue" data-test-id="image-upload-queue">
          <h4>アップロード状況</h4>
          {uploadItems.length === 0 ? (
            <p className="charts-image-panel__empty" role="status" aria-live={infoLive}>
              追加した画像はここに表示されます。
            </p>
          ) : (
            <ul>
              {uploadItems.map((item) => (
                <li key={item.id} data-test-id="image-upload-item" data-progress-mode={item.progressMode}>
                  <div className="charts-image-panel__queue-item">
                      <div className="charts-image-panel__queue-thumb">
                        {item.previewUrl ? <img src={item.previewUrl} alt={item.file.name} /> : null}
                      </div>
                    <div className="charts-image-panel__queue-info">
                      <div className="charts-image-panel__queue-name">{item.file.name}</div>
                      <div className="charts-image-panel__queue-meta">
                        <span>{formatBytes(item.file.size)}</span>
                        <span>{item.status === 'uploading' ? 'アップロード中' : item.status === 'success' ? '完了' : item.status === 'error' ? '失敗' : '待機'}</span>
                      </div>
                      {item.error ? <p className="charts-image-panel__queue-error">{item.error}</p> : null}
                      <div className="charts-image-panel__queue-progress">
                        <progress
                          value={item.status === 'uploading' && item.progressMode === 'indeterminate' ? undefined : item.progress}
                          max={100}
                          data-test-id="image-upload-progress"
                        />
                        <span>
                          {item.status === 'uploading'
                            ? item.progressMode === 'indeterminate'
                              ? '送信中…'
                              : `${item.progress}%`
                            : item.status === 'success'
                              ? '完了'
                              : item.status === 'error'
                                ? '失敗'
                                : '待機'}
                        </span>
                      </div>
                    </div>
                    <div className="charts-image-panel__queue-actions">
                      {item.status === 'error' ? (
                        <button type="button" onClick={() => handleRetry(item.id)} disabled={!patientId}>
                          再試行
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ImageCameraCapture
          onCapture={(file) => enqueueFiles([file])}
          disabled={!patientId || imagesFeatureDisabled}
          onCameraError={(reason, message) => {
            setStatusMessage({ tone: 'error', message });
            recordTelemetry({
              outcome: 'error',
              contentSize: 0,
              endpoint: 'getUserMedia',
              reason,
              progressMode: 'indeterminate',
            });
            recordAudit({
              outcome: 'error',
              contentSize: 0,
              endpoint: 'getUserMedia',
              error: message,
              reason,
              progressMode: 'indeterminate',
            });
          }}
        />
      </div>

      <div className="charts-image-panel__gallery">
        <div className="charts-image-panel__gallery-header">
          <h4>サムネイル一覧</h4>
          <button type="button" onClick={() => imageListQuery.refetch()} disabled={imageListQuery.isFetching}>
            {imageListQuery.isFetching ? '更新中…' : '再取得'}
          </button>
        </div>
        {!patientId ? (
          <p className="charts-image-panel__empty" role="status" aria-live={infoLive}>
            患者を選択すると画像一覧が表示されます。
          </p>
        ) : imageListQuery.isLoading ? (
          <p className="charts-image-panel__empty" role="status" aria-live={infoLive}>
            読み込み中…
          </p>
        ) : imagesFeatureDisabled ? (
          <div className="charts-image-panel__error" role="alert" aria-live="assertive">
            {FEATURE_DISABLED_MESSAGE}
          </div>
        ) : imageListQuery.isError || (imageListQuery.data && !imageListQuery.data.ok) ? (
          <div className="charts-image-panel__error" role="alert" aria-live="assertive">
            画像一覧の取得に失敗しました。再取得してください。
          </div>
        ) : listItems.length === 0 ? (
          <p className="charts-image-panel__empty" role="status" aria-live={infoLive}>
            画像が登録されていません。
          </p>
        ) : (
          <ul className="charts-image-panel__grid" data-test-id="image-thumbnail-list">
            {listItems.map((item: KarteImageListItem) => {
              const safeThumbnailUrl = safeSameOriginHttpUrl(item.thumbnailUrl);
              const documentAttachBlockedReason = !patientId
                ? '患者が未選択のため、文書には添付できません。'
                : imagesFeatureDisabled
                  ? FEATURE_DISABLED_MESSAGE
                  : typeof item.contentSize === 'number' && item.contentSize > IMAGE_ATTACHMENT_MAX_SIZE_BYTES
                    ? '患者画像としては保存済みですが、文書には添付できません。'
                    : undefined;
              const canAttachToDocument = !documentAttachBlockedReason && typeof onToggleDocumentAttachment === 'function';
              return (
                <li key={item.id} className="charts-image-panel__card">
                  <div className="charts-image-panel__thumb">
                    {safeThumbnailUrl && !brokenThumbnails.has(item.id) ? (
                      <img
                        src={safeThumbnailUrl}
                        alt={item.title ?? item.fileName ?? 'image'}
                        onError={() => markThumbnailBroken(item.id)}
                      />
                    ) : null}
                  </div>
                  <div className="charts-image-panel__card-body">
                    <strong>{item.title ?? item.fileName ?? '画像'}</strong>
                    <span>{formatBytes(item.contentSize)}</span>
                    <span>{formatRecordedAt(item.recordedAt)}</span>
                    {documentAttachBlockedReason ? (
                      <span className="charts-image-panel__card-note">{documentAttachBlockedReason}</span>
                    ) : null}
                  </div>
                  <div className="charts-image-panel__card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        onToggleDocumentAttachment?.(item);
                        const nextActive = !selectedIdSet.has(item.id);
                        setStatusMessage({
                          tone: 'info',
                          message: nextActive ? '文書への貼付候補に追加しました。' : '文書への貼付候補から外しました。',
                        });
                      }}
                      data-active={selectedIdSet.has(item.id) ? 'true' : 'false'}
                      disabled={!canAttachToDocument}
                      data-test-id="image-attach-document"
                    >
                      {selectedIdSet.has(item.id) ? '文書添付を解除' : '文書に添付'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onInsertSoapAttachment?.(item);
                        setStatusMessage({ tone: 'success', message: 'SOAP に画像リンクを挿入しました。' });
                      }}
                      disabled={!patientId}
                      data-test-id="image-attach-soap"
                    >
                      SOAPに挿入
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
