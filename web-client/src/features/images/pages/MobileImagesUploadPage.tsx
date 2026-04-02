import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { resolveAriaLive, resolveRunId } from '../../../libs/observability/observability';
import { copyTextToClipboard } from '../../../libs/observability/runIdCopy';
import { safeSameOriginHttpUrl } from '../../../libs/security/safeUrl';
import { useOptionalSession } from '../../../AppRouter';
import { loadDeepLinkContext } from '../../../routes/deepLinkContextStorage';
import { buildFacilityPath } from '../../../routes/facilityRoutes';
import { useAuthService } from '../../charts/authService';
import { useAppNavigation } from '../../../routes/useAppNavigation';
import { MobilePatientPicker } from '../components/MobilePatientPicker';
import { fetchPatientImageList, uploadPatientImageViaXhr, type PatientImageListItem, type UploadProgressEvent } from '../mobileApi';
import { ReturnToBar } from '../../shared/ReturnToBar';
import type { FeedbackTone } from '../../shared/feedbackTone';

type UploadStage = 'idle' | 'ready' | 'uploading' | 'success' | 'error';
type MobileImagesLocationState = {
  patientId?: string;
};
const FEATURE_DISABLED_MESSAGE = '患者画像機能はサーバーで無効化されています。';

const formatBytes = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '―';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
};

const buildErrorMessage = (status: number, error?: string, errorCode?: string) => {
  if (errorCode === 'feature_disabled' || status === 404) return FEATURE_DISABLED_MESSAGE;
  if (status === 413) return '画像サイズが大きすぎます。小さい画像で再試行してください。';
  if (status === 415) return '対応していない画像形式です。jpg/png などで再試行してください。';
  if (status === 401 || status === 403) return 'ログイン状態を確認できませんでした。再ログインしてからやり直してください。';
  if (status === 0 || error === 'network_error') return '通信に失敗しました。電波状況を確認して再試行してください。';
  return '送信に失敗しました。時間をおいて再試行してください。';
};

const normalizePatientId = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function MobileImagesUploadPage() {
  const session = useOptionalSession();
  const location = useLocation();
  const { flags } = useAuthService();
  const resolvedRunId = resolveRunId(flags.runId);
  const appNav = useAppNavigation({ facilityId: session?.facilityId, userId: session?.userId });
  const locationState = (location.state as MobileImagesLocationState | null) ?? null;
  const queryParams = useMemo(
    () => new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search),
    [location.search],
  );
  const patientIdParam = useMemo(() => normalizePatientId(queryParams.get('patientId')), [queryParams]);
  const statePatientId = useMemo(() => normalizePatientId(locationState?.patientId), [locationState?.patientId]);
  const deepLinkPatientId = useMemo(
    () => normalizePatientId(loadDeepLinkContext()?.values.patientId),
    [location.search],
  );
  const resolvedPatientId = patientIdParam ?? statePatientId ?? deepLinkPatientId;
  const fallbackUrl = useMemo(() => {
    const facilityId = session?.facilityId;
    if (appNav.fromCandidate === 'reception') return buildFacilityPath(facilityId, '/reception');
    if (appNav.fromCandidate === 'patients') return buildFacilityPath(facilityId, '/patients');
    return buildFacilityPath(facilityId, '/charts');
  }, [appNav.fromCandidate, session?.facilityId]);
  const infoLive = resolveAriaLive('info');
  const errorLive = resolveAriaLive('error');
  const [patientId, setPatientId] = useState<string | undefined>(() => resolvedPatientId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [statusText, setStatusText] = useState<string>('患者を選択してください。');
  const [lastError, setLastError] = useState<{ status: number; error?: string } | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [progress, setProgress] = useState<{ mode: UploadProgressEvent['mode']; percent?: number }>({
    mode: 'indeterminate',
  });
  const [listItems, setListItems] = useState<PatientImageListItem[]>([]);
  const lastAttemptRef = useRef<{ patientId: string; file: File } | null>(null);
  const pendingFocusTargetRef = useRef<'send' | 'download' | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sendButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstDownloadLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!resolvedPatientId) return;
    setPatientId(resolvedPatientId);
  }, [resolvedPatientId]);

  useEffect(() => {
    if (pendingFocusTargetRef.current === 'send' && stage === 'ready') {
      sendButtonRef.current?.focus();
      pendingFocusTargetRef.current = null;
      return;
    }
    if (pendingFocusTargetRef.current === 'download' && stage === 'success' && listItems.length > 0) {
      firstDownloadLinkRef.current?.focus();
      pendingFocusTargetRef.current = null;
    }
  }, [listItems.length, stage]);

  useEffect(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const refreshList = useCallback(
    async (pid: string) => {
      const res = await fetchPatientImageList(pid);
      if (!res.ok) {
        if (res.errorCode === 'feature_disabled') {
          setFeatureDisabled(true);
          setStage('error');
          setStatusText(FEATURE_DISABLED_MESSAGE);
          return;
        }
        setStatusText(`画像一覧の取得に失敗しました（HTTP ${res.status}）。`);
        return;
      }
      setFeatureDisabled(false);
      setListItems(res.list ?? []);
    },
    [],
  );

  useEffect(() => {
    setSelectedFile(null);
    setFeatureDisabled(false);
    setListItems([]);
    if (!patientId) {
      setStage('error');
      setStatusText('患者文脈が引き継がれていないため、この画面だけでは再開できません。戻り導線から患者を選び直してください。');
      setLastError(null);
      return;
    }
    if (lastAttemptRef.current && lastAttemptRef.current.patientId !== patientId) {
      setStage('error');
      setLastError({ status: 0, error: 'patient_switched' });
      setStatusText('選択中の患者文脈が引き継がれていないため、この画面だけでは再試行できません。戻り導線から患者を選び直して、画像を再選択してください。');
      refreshList(patientId).catch(() => {
        // ignore
      });
      return;
    }
    setStage('ready');
    setStatusText('患者情報を確認しました。画像を選択して送信してください。');
    setLastError(null);
    refreshList(patientId).catch(() => {
      // ignore
    });
  }, [patientId, refreshList]);

  const canPickFile = Boolean(patientId) && stage !== 'uploading' && !featureDisabled;
  const canSend = Boolean(patientId) && Boolean(selectedFile) && stage !== 'uploading' && !featureDisabled;

  const handleFilePicked = useCallback(
    (file: File | null) => {
      if (!file) return;
      setSelectedFile(file);
      setStage('ready');
      setStatusText(`${file.name}（${formatBytes(file.size)}）を選択しました。`);
      setLastError(null);
    },
    [],
  );

  const openCapturePicker = useCallback(() => {
    const input = captureInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  }, []);

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  }, []);

  const handleSend = useCallback(async () => {
    if (!patientId || !selectedFile) return;
    setStage('uploading');
    setProgress({ mode: 'indeterminate' });
    setStatusText('送信中…');
    setLastError(null);
    lastAttemptRef.current = { patientId, file: selectedFile };

    const res = await uploadPatientImageViaXhr({
      patientId,
      file: selectedFile,
      onProgress: (event) => {
        setProgress({ mode: event.mode, percent: event.percent });
      },
    });

    if (!res.ok) {
      const message = buildErrorMessage(res.status, res.error, res.errorCode);
      setFeatureDisabled(res.errorCode === 'feature_disabled');
      setStage('error');
      setLastError({ status: res.status, error: res.error });
      setStatusText(message);
      return;
    }

    setFeatureDisabled(false);
    setStage('success');
    setStatusText('送信しました。');
    pendingFocusTargetRef.current = 'download';
    lastAttemptRef.current = null;
    await refreshList(patientId);
  }, [patientId, refreshList, selectedFile]);

  const handleRetry = useCallback(() => {
    const last = lastAttemptRef.current;
    if (!last) return;
    // Retry keeps the current patient context; if user switched patient, they should reselect file intentionally.
    if (patientId && last.patientId !== patientId) {
      setStatusText('選択中の患者文脈が引き継がれていないため、この画面だけでは再試行できません。戻り導線から患者を選び直して、画像を再選択してください。');
      setStage('ready');
      setLastError(null);
      return;
    }
    setSelectedFile(last.file);
    setStage('ready');
    setStatusText('再送信の準備ができました。');
    setLastError(null);
    pendingFocusTargetRef.current = 'send';
  }, [patientId]);

  const statusTone: FeedbackTone = stage === 'error' ? 'error' : stage === 'success' ? 'success' : 'info';
  const statusBg = statusTone === 'error' ? '#fee4e2' : statusTone === 'success' ? '#dcfce7' : '#eef2ff';
  const statusFg = statusTone === 'error' ? '#b42318' : statusTone === 'success' ? '#166534' : '#1e3a8a';
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  const handleCopyRunId = useCallback(async () => {
    if (!resolvedRunId) return;
    try {
      await copyTextToClipboard(resolvedRunId);
      setCopyFeedback('RUN_ID をコピーしました。');
    } catch {
      setCopyFeedback('RUN_ID のコピーに失敗しました。');
    }
  }, [resolvedRunId]);

  const header = useMemo(() => {
    return (
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>画像アップロード（モバイル）</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
            <span>RUN_ID: {resolvedRunId ?? '―'}</span>
            {resolvedRunId ? (
              <button type="button" onClick={handleCopyRunId} style={{ fontSize: '0.8rem' }}>
                コピー
              </button>
            ) : null}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>
          患者を特定して、撮影または写真を選択し、送信します。
        </p>
        {copyFeedback ? (
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }} role="status" aria-live={infoLive}>
            {copyFeedback}
          </p>
        ) : null}
      </header>
    );
  }, [copyFeedback, handleCopyRunId, infoLive, resolvedRunId]);

  return (
    <main
      data-test-id="mobile-images-page"
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '1rem',
        display: 'grid',
        gap: '1rem',
      }}
    >
      <ReturnToBar
        scope={{ facilityId: session?.facilityId, userId: session?.userId }}
        returnTo={appNav.safeReturnToCandidate}
        from={appNav.fromCandidate}
        fallbackUrl={fallbackUrl}
      />
      {header}

      <div
        role={stage === 'error' ? 'alert' : 'status'}
        aria-live={stage === 'error' ? errorLive : infoLive}
        aria-atomic="true"
        data-test-id="mobile-images-status"
        style={{
          borderRadius: 16,
          padding: '0.85rem 0.95rem',
          background: statusBg,
          color: statusFg,
          border: '1px solid rgba(0,0,0,0.08)',
          fontSize: '0.98rem',
          fontWeight: 600,
        }}
      >
        {statusText}
      </div>

      <section
        style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          padding: '0.9rem',
          background: 'white',
        }}
      >
        <MobilePatientPicker title="1) 患者特定" selectedPatientId={undefined} onSelect={(pid) => setPatientId(pid)} />
      </section>

      <section
        style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          padding: '0.9rem',
          background: 'white',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>2) 撮影 / アップロード</h2>

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <button
            type="button"
            style={{
              display: 'grid',
              placeItems: 'center',
              padding: '0.95rem 1rem',
              borderRadius: 14,
              background: canPickFile ? '#0b69ff' : '#94a3b8',
              color: 'white',
              fontWeight: 800,
              fontSize: '1.05rem',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
            disabled={!canPickFile}
            onClick={openCapturePicker}
          >
            撮影して送る
          </button>
          <input
            ref={captureInputRef}
            data-test-id="mobile-image-capture-input"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={!canPickFile}
            style={{ display: 'none' }}
            onChange={(event) => handleFilePicked(event.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            style={{
              display: 'grid',
              placeItems: 'center',
              padding: '0.95rem 1rem',
              borderRadius: 14,
              background: canPickFile ? '#111827' : '#94a3b8',
              color: 'white',
              fontWeight: 800,
              fontSize: '1.05rem',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
            disabled={!canPickFile}
            onClick={openFilePicker}
          >
            写真を選んで送る
          </button>
          <input
            ref={fileInputRef}
            data-test-id="mobile-image-file-input"
            type="file"
            accept="image/*"
            disabled={!canPickFile}
            style={{ display: 'none' }}
            onChange={(event) => handleFilePicked(event.target.files?.[0] ?? null)}
          />
        </div>

        {selectedFile ? (
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <div style={{ fontSize: '0.95rem', opacity: 0.85 }}>
              選択中: <strong>{selectedFile.name}</strong>（{formatBytes(selectedFile.size)}）
            </div>
            {previewUrl ? (
              <img
                data-test-id="mobile-image-preview"
                src={previewUrl}
                alt={selectedFile.name}
                style={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'contain',
                  background: '#f8fafc',
                  borderRadius: 14,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}
              />
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <button
            type="button"
            data-test-id="mobile-image-send"
            ref={sendButtonRef}
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: '100%',
              padding: '1rem 1rem',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.08)',
              background: canSend ? '#16a34a' : '#94a3b8',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: 900,
            }}
          >
            {stage === 'uploading' ? '送信中…' : '送信'}
          </button>
          {stage === 'uploading' ? (
            <div data-test-id="mobile-image-progress" style={{ fontSize: '0.9rem', opacity: 0.85 }}>
              {progress.mode === 'real' && typeof progress.percent === 'number' ? `進捗: ${progress.percent}%` : '進捗: 送信中…'}
            </div>
          ) : null}
          {stage === 'error' && lastError ? (
            <button
              type="button"
              data-test-id="mobile-image-retry"
              onClick={handleRetry}
              style={{
                width: '100%',
                padding: '0.9rem 1rem',
                borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.15)',
                background: '#fff',
                color: '#111827',
                fontSize: '1rem',
                fontWeight: 800,
              }}
            >
              再試行
            </button>
          ) : null}
          {!patientId ? (
            <p
              data-test-id="mobile-images-missing-patient"
              role="alert"
              style={{ margin: 0, fontSize: '0.9rem', color: '#b42318' }}
            >
              患者文脈が引き継がれていないため送信できません。この画面だけでは再開できないので、戻り導線から患者を選び直してください。
            </p>
          ) : null}
        </div>

      </section>

      <section
        style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          padding: '0.9rem',
          background: 'white',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>3) 完了 / 参照</h2>
        {!patientId ? (
          <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.85 }}>患者情報が取得できないため一覧を表示できません。</p>
        ) : listItems.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.85 }}>画像はまだありません。</p>
        ) : (
          <ul data-test-id="mobile-images-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
            {listItems.slice(0, 6).map((item) => {
              const safeDownloadUrl = safeSameOriginHttpUrl(item.downloadUrl);
              return (
                <li
                  key={item.imageId}
                  style={{
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 14,
                    padding: '0.7rem',
                    display: 'grid',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{item.fileName ?? item.imageId}</strong>
                    <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>{formatBytes(item.size)}</span>
                  </div>
                  {safeDownloadUrl ? (
                    <img
                      src={safeDownloadUrl}
                      alt={item.fileName ?? 'thumbnail'}
                      style={{
                        width: '100%',
                        maxHeight: 150,
                        objectFit: 'contain',
                        background: '#f8fafc',
                        borderRadius: 12,
                        border: '1px solid rgba(0,0,0,0.06)',
                      }}
                    />
                  ) : null}
                  {safeDownloadUrl ? (
                    <a
                      data-test-id="mobile-images-download-link"
                      ref={item === listItems[0] ? firstDownloadLinkRef : undefined}
                      href={safeDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`参照リンクを開く: ${item.fileName ?? item.imageId}`}
                      style={{ fontSize: '0.95rem' }}
                    >
                      参照リンクを開く
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>参照リンク: (未提供)</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
