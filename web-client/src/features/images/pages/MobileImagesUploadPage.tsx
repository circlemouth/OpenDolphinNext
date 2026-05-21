import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { resolveAriaLive } from '../../../libs/observability/observability';
import { safeSameOriginHttpUrl } from '../../../libs/security/safeUrl';
import { useOptionalSession } from '../../../AppRouter';
import { loadDeepLinkContext } from '../../../routes/deepLinkContextStorage';
import { buildFacilityPath } from '../../../routes/facilityRoutes';
import type { OutpatientEncounterContext } from '../../charts/encounterContext';
import { useAppNavigation } from '../../../routes/useAppNavigation';
import { MobilePatientPicker } from '../components/MobilePatientPicker';
import { fetchPatientImageList, uploadPatientImageViaXhr, type PatientImageListItem, type UploadProgressEvent } from '../mobileApi';
import { PatientIdentityBar } from '../../shared/PatientIdentityBar';
import { ReturnToBar } from '../../shared/ReturnToBar';
import { StatusPill } from '../../shared/StatusPill';
import type { FeedbackTone } from '../../shared/feedbackTone';
import '../mobile-images-upload.css';

type UploadStage = 'idle' | 'ready' | 'uploading' | 'success' | 'error';
type MobileImagesLocationState = {
  patientId?: string;
  encounter?: OutpatientEncounterContext;
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

const normalizeContextValue = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildPickFileDisabledReason = (options: {
  patientId?: string;
  featureDisabled: boolean;
  stage: UploadStage;
}) => {
  if (options.featureDisabled) return '機能停止中のため画像を選択できません。';
  if (!options.patientId) return '患者を確定すると撮影または写真選択へ進めます。';
  if (options.stage === 'uploading') return '送信中は新しい画像を選択できません。完了後に再選択してください。';
  return undefined;
};

const buildSendDisabledReason = (options: {
  patientId?: string;
  selectedFile: File | null;
  featureDisabled: boolean;
  stage: UploadStage;
}) => {
  if (options.featureDisabled) return '機能停止中のため送信できません。';
  if (!options.patientId) return '患者が未確定のため送信できません。患者を選び直してください。';
  if (!options.selectedFile) return '画像を1件選択すると送信できます。';
  if (options.stage === 'uploading') return '送信中です。完了メッセージが表示されるまでお待ちください。';
  return undefined;
};

export function MobileImagesUploadPage() {
  const session = useOptionalSession();
  const location = useLocation();
  const appNav = useAppNavigation({ facilityId: session?.facilityId, userId: session?.userId });
  const locationState = (location.state as MobileImagesLocationState | null) ?? null;
  const queryParams = useMemo(
    () => new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search),
    [location.search],
  );
  const patientIdParam = useMemo(() => normalizePatientId(queryParams.get('patientId')), [queryParams]);
  const statePatientId = useMemo(() => normalizePatientId(locationState?.patientId), [locationState?.patientId]);
  const stateEncounter = locationState?.encounter;
  const deepLinkPatientId = useMemo(
    () => normalizePatientId(loadDeepLinkContext()?.values.patientId),
    [location.search],
  );
  const encounterSafetyContext = useMemo(() => {
    const visitDate = normalizeContextValue(stateEncounter?.visitDate);
    const departmentCode = normalizeContextValue(stateEncounter?.departmentCode);
    const physicianCode = normalizeContextValue(stateEncounter?.physicianCode);
    const insuranceCombinationNumber = normalizeContextValue(stateEncounter?.insuranceCombinationNumber);
    const hasContext = Boolean(
      visitDate || departmentCode || physicianCode || insuranceCombinationNumber,
    );
    if (!hasContext) return undefined;
    return {
      acceptanceDate: visitDate,
      department: departmentCode ? `診療科コード ${departmentCode}` : undefined,
      physician: physicianCode ? `担当医コード ${physicianCode}` : undefined,
      insuranceCombination: insuranceCombinationNumber ? `保険組合せ ${insuranceCombinationNumber}` : undefined,
      orcaSourceLabel: '遷移文脈',
      orcaCacheStatus: 'unverified',
    };
  }, [stateEncounter]);
  const resolvedPatientId = patientIdParam ?? statePatientId ?? deepLinkPatientId;
  const resolvedPatientSourceLabel = patientIdParam
    ? '遷移入口'
    : statePatientId
      ? '遷移文脈'
      : deepLinkPatientId
        ? '一時引き継ぎ'
        : '未確定';
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
  const pickFileDisabledReason = buildPickFileDisabledReason({ patientId, featureDisabled, stage });
  const sendDisabledReason = buildSendDisabledReason({ patientId, selectedFile, featureDisabled, stage });

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
  const header = useMemo(() => {
    return (
      <header className="mobile-images-page__header">
        <div className="mobile-images-page__header-row">
          <div className="mobile-images-page__header-copy">
            <p className="mobile-images-page__eyebrow">patient-specific upload / reference</p>
            <h1 className="mobile-images-page__title">画像アップロード</h1>
          </div>
        </div>
        <p className="mobile-images-page__lead">患者を特定して、撮影または写真を選択し、送信します。</p>
      </header>
    );
  }, []);

  return (
    <main data-test-id="mobile-images-page" className="mobile-images-page">
      <div className="mobile-images-page__frame">
        <ReturnToBar
          scope={{ facilityId: session?.facilityId, userId: session?.userId }}
          returnTo={appNav.safeReturnToCandidate}
          from={appNav.fromCandidate}
          fallbackUrl={fallbackUrl}
        />
        {header}

        <div data-test-id="mobile-images-patient-identity">
          <PatientIdentityBar
            eyebrow="患者画像アップロード / 参照"
            patientId={patientId}
            patientName={patientId ? undefined : '患者未確定'}
            acceptanceDate={encounterSafetyContext?.acceptanceDate}
            department={encounterSafetyContext?.department}
            physician={encounterSafetyContext?.physician}
            insuranceCombination={encounterSafetyContext?.insuranceCombination}
            orcaSourceLabel={encounterSafetyContext?.orcaSourceLabel}
            orcaCacheStatus={encounterSafetyContext?.orcaCacheStatus}
            note="画面内で患者を選び直せます。遷移元の患者文脈はこの画面内だけで扱います。"
            chips={
              <>
                <StatusPill tone="neutral" size="xs">患者文脈: {resolvedPatientSourceLabel}</StatusPill>
                <StatusPill tone={patientId ? 'info' : 'warning'} size="xs">
                  {patientId ? '文脈あり' : '文脈待ち'}
                </StatusPill>
                <StatusPill tone={stage === 'error' ? 'warning' : stage === 'success' ? 'success' : 'neutral'} size="xs">
                  状態: {stage === 'uploading' ? '送信中' : stage === 'success' ? '送信完了' : stage === 'error' ? '再確認' : '待機'}
                </StatusPill>
                <StatusPill tone="neutral" size="xs">一覧: {listItems.length} 件</StatusPill>
                <StatusPill tone={featureDisabled ? 'warning' : 'success'} size="xs">
                  {featureDisabled ? '機能停止' : '利用可'}
                </StatusPill>
              </>
            }
          />
        </div>

        <nav className="mobile-images-page__step-rail" aria-label="画像アップロードの3ステップ">
          <div className={`mobile-images-page__step-chip${patientId ? ' is-active' : ''}`}>1 患者特定</div>
          <div className={`mobile-images-page__step-chip${selectedFile ? ' is-active' : ''}`}>2 撮影・アップロード</div>
          <div className={`mobile-images-page__step-chip${stage === 'success' ? ' is-active' : ''}`}>3 完了・参照</div>
        </nav>

        <div
          role={stage === 'error' ? 'alert' : 'status'}
          aria-live={stage === 'error' ? errorLive : infoLive}
          aria-atomic="true"
          data-test-id="mobile-images-status"
          className={`mobile-images-page__status mobile-images-page__status--${statusTone}`}
        >
          {statusText}
        </div>

        <section className="mobile-images-page__section mobile-images-page__section--primary">
          <div className="mobile-images-page__section-header">
            <h2 className="mobile-images-page__section-title">1) 患者特定</h2>
            <p className="mobile-images-page__section-lead">患者ID を確定してから撮影・参照に進みます。</p>
          </div>
          <MobilePatientPicker title="患者ID入力" selectedPatientId={undefined} onSelect={(pid) => setPatientId(pid)} />
        </section>

        <section className="mobile-images-page__section mobile-images-page__section--neutral">
          <div className="mobile-images-page__section-header">
            <h2 className="mobile-images-page__section-title">2) 撮影 / アップロード</h2>
            <p className="mobile-images-page__section-lead">撮影か写真選択のどちらかで画像を選び、送信前に内容を確認します。</p>
          </div>

          <div className="mobile-images-page__action-stack">
            <button
              type="button"
              className="odn-button odn-button--primary mobile-images-page__cta"
              disabled={!canPickFile}
              onClick={openCapturePicker}
              aria-describedby={pickFileDisabledReason ? 'mobile-images-pick-disabled-reason' : undefined}
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
              className="mobile-images-page__file-input"
              onChange={(event) => handleFilePicked(event.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              className="odn-button odn-button--secondary mobile-images-page__cta"
              disabled={!canPickFile}
              onClick={openFilePicker}
              aria-describedby={pickFileDisabledReason ? 'mobile-images-pick-disabled-reason' : undefined}
            >
              写真を選んで送る
            </button>
            <input
              ref={fileInputRef}
              data-test-id="mobile-image-file-input"
              type="file"
              accept="image/*"
              disabled={!canPickFile}
              className="mobile-images-page__file-input"
              onChange={(event) => handleFilePicked(event.target.files?.[0] ?? null)}
            />
            {pickFileDisabledReason ? (
              <p id="mobile-images-pick-disabled-reason" className="mobile-images-page__action-reason">
                {pickFileDisabledReason}
              </p>
            ) : null}
          </div>

          {selectedFile ? (
            <div className="mobile-images-page__file-summary" data-test-id="mobile-image-selected-summary">
              <div className="mobile-images-page__file-summary-main">
                選択中: <strong>{selectedFile.name}</strong>
              </div>
              <div className="mobile-images-page__file-summary-meta">
                <span>サイズ: {formatBytes(selectedFile.size)}</span>
                <span>形式: {selectedFile.type || '不明'}</span>
                <span>最終更新: {new Date(selectedFile.lastModified).toLocaleString('ja-JP', { hour12: false })}</span>
              </div>
              {previewUrl ? (
                <img data-test-id="mobile-image-preview" src={previewUrl} alt={selectedFile.name} className="mobile-images-page__preview" />
              ) : null}
            </div>
          ) : (
            <p className="mobile-images-page__empty-note">まだ画像が選択されていません。撮影または写真選択を行ってください。</p>
          )}

          <div className="mobile-images-page__send-area">
            <button
              type="button"
              data-test-id="mobile-image-send"
              ref={sendButtonRef}
              onClick={handleSend}
              disabled={!canSend}
              className="odn-button odn-button--primary mobile-images-page__cta mobile-images-page__cta--success"
              aria-describedby={sendDisabledReason ? 'mobile-images-send-disabled-reason' : undefined}
            >
              {stage === 'uploading' ? '送信中…' : '送信'}
            </button>
            {sendDisabledReason ? (
              <p id="mobile-images-send-disabled-reason" className="mobile-images-page__action-reason">
                {sendDisabledReason}
              </p>
            ) : null}
            {stage === 'uploading' ? (
              <div data-test-id="mobile-image-progress" className="mobile-images-page__progress">
                {progress.mode === 'real' && typeof progress.percent === 'number' ? `進捗: ${progress.percent}%` : '進捗: 送信中…'}
              </div>
            ) : null}
            {stage === 'error' && lastError ? (
              <button type="button" data-test-id="mobile-image-retry" onClick={handleRetry} className="odn-button odn-button--secondary mobile-images-page__cta">
                再試行
              </button>
            ) : null}
            {stage === 'error' && lastError ? (
              <p className="mobile-images-page__failure-note">送信は完了していません。患者文脈と選択ファイルを確認して再試行してください。</p>
            ) : null}
            {!patientId ? (
              <p data-test-id="mobile-images-missing-patient" role="alert" className="mobile-images-page__failure-note">
                患者文脈が引き継がれていないため送信できません。この画面だけでは再開できないので、戻り導線から患者を選び直してください。
              </p>
            ) : null}
          </div>
        </section>

        <section className="mobile-images-page__section mobile-images-page__section--success">
          <div className="mobile-images-page__section-header">
            <h2 className="mobile-images-page__section-title">3) 完了 / 参照</h2>
            <p className="mobile-images-page__section-lead">送信済み画像は最新のものから確認できます。</p>
          </div>
          {!patientId ? (
            <p className="mobile-images-page__empty-note">患者情報が取得できないため一覧を表示できません。</p>
          ) : listItems.length === 0 ? (
            <p className="mobile-images-page__empty-note">画像はまだありません。</p>
          ) : (
            <ul data-test-id="mobile-images-list" className="mobile-images-page__list">
              {listItems.slice(0, 6).map((item) => {
                const safeDownloadUrl = safeSameOriginHttpUrl(item.downloadUrl);
                return (
                  <li key={item.imageId} className="mobile-images-page__list-item">
                    <div className="mobile-images-page__list-item-header">
                      <strong>{item.fileName ?? item.imageId}</strong>
                      <span>{formatBytes(item.size)}</span>
                    </div>
                    {safeDownloadUrl ? (
                      <img
                        src={safeDownloadUrl}
                        alt={item.fileName ?? 'thumbnail'}
                        className="mobile-images-page__thumbnail"
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
                        className="mobile-images-page__download-link"
                      >
                        参照リンクを開く
                      </a>
                    ) : (
                      <span className="mobile-images-page__missing-link">参照リンク: (未提供)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
