import { useCallback, useEffect, useRef, useState } from 'react';

type ImageCameraCaptureProps = {
  onCapture: (file: File) => void;
  disabled?: boolean;
  disabledReason?: string;
  attachmentTargetLabel?: string;
  onCameraError?: (reason: string, message: string) => void;
};

type CameraAvailability = {
  supported: boolean;
  secureContext: boolean;
  hasDevice: boolean | null;
  message?: string;
};

const defaultAvailability: CameraAvailability = {
  supported: false,
  secureContext: false,
  hasDevice: null,
};

const resolveCameraError = (error: unknown) => {
  const name = (error as DOMException | { name?: string })?.name ?? 'UnknownError';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      reason: 'permission_denied',
      message: 'カメラの利用が拒否されました。ブラウザ設定でカメラ許可を再度有効化してください。',
    };
  }
  if (name === 'NotFoundError') {
    return {
      reason: 'device_not_found',
      message: 'カメラデバイスが見つかりません。接続状態を確認してください。',
    };
  }
  if (name === 'NotReadableError') {
    return {
      reason: 'device_unavailable',
      message: 'カメラを使用中のため起動できません。別アプリを閉じて再試行してください。',
    };
  }
  return {
    reason: 'camera_start_failed',
    message: 'カメラの起動に失敗しました。ブラウザ設定とデバイス状態を確認してください。',
  };
};

export function ImageCameraCapture({ onCapture, disabled, disabledReason, attachmentTargetLabel, onCameraError }: ImageCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [availability, setAvailability] = useState<CameraAvailability>(defaultAvailability);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const secureContext = typeof window !== 'undefined' && window.isSecureContext;
    if (!secureContext) {
      setAvailability({
        supported,
        secureContext,
        hasDevice: null,
        message: 'カメラ撮影は HTTPS 環境でのみ利用できます。',
      });
      return;
    }
    if (!supported) {
      setAvailability({
        supported,
        secureContext,
        hasDevice: null,
        message: 'このブラウザではカメラ撮影に対応していません。',
      });
      return;
    }

    let mounted = true;
    const enumerate = navigator.mediaDevices.enumerateDevices?.bind(navigator.mediaDevices);
    if (!enumerate) {
      setAvailability({
        supported,
        secureContext,
        hasDevice: null,
        message: 'カメラデバイスの検出が利用できません。',
      });
      return;
    }

    enumerate()
      .then((devices) => {
        if (!mounted) return;
        const hasDevice = devices.some((device) => device.kind === 'videoinput');
        setAvailability({
          supported,
          secureContext,
          hasDevice,
          message: hasDevice ? undefined : 'カメラデバイスが検出されません。接続状態を確認してください。',
        });
      })
      .catch(() => {
        if (!mounted) return;
        setAvailability({
          supported,
          secureContext,
          hasDevice: null,
          message: 'カメラデバイスの確認に失敗しました。',
        });
      });

    return () => {
      mounted = false;
      stopStream();
    };
  }, [stopStream]);

  const handleStart = useCallback(async () => {
    setError(null);
    if (disabled) return;
    if (!availability.secureContext || !availability.supported) return;
    try {
      setBusy(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      const resolved = resolveCameraError(err);
      setError(resolved.message);
      onCameraError?.(resolved.reason, resolved.message);
      stopStream();
    } finally {
      setBusy(false);
    }
  }, [availability.secureContext, availability.supported, disabled, stopStream]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || disabled) return;
    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    setBusy(true);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          setError('画像の生成に失敗しました。');
          return;
        }
        const fileName = `camera_${Date.now()}.png`;
        const file = new File([blob], fileName, { type: blob.type || 'image/png', lastModified: Date.now() });
        onCapture(file);
      },
      'image/png',
      0.92,
    );
  }, [disabled, onCapture]);

  const canStart = availability.secureContext && availability.supported && availability.hasDevice !== false;
  const cameraBlockedReason =
    disabled && disabledReason
      ? disabledReason
      : !availability.secureContext || !availability.supported
        ? availability.message
        : availability.hasDevice === false
          ? availability.message
          : undefined;

  return (
    <section className="charts-image-camera" data-test-id="image-camera-panel">
      <div className="charts-image-camera__header">
        <h3>カメラ撮影</h3>
        <p>添付先: {attachmentTargetLabel ?? '患者画像一覧と選択中カルテ'}。撮影後はアップロード待ちキューに追加します。</p>
      </div>
      {availability.message ? (
        <div className="charts-image-camera__fallback" data-test-id="image-camera-fallback">
          {availability.message}
        </div>
      ) : null}
      {error ? (
        <div className="charts-image-camera__error" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}
      {cameraBlockedReason ? (
        <p className="charts-image-camera__fallback" role="status">
          {cameraBlockedReason}
        </p>
      ) : null}
      <div className="charts-image-camera__body">
        <div className="charts-image-camera__preview">
          <video ref={videoRef} muted playsInline />
          {!active ? <div className="charts-image-camera__placeholder">プレビュー待機中</div> : null}
        </div>
        <div className="charts-image-camera__actions">
          {!active ? (
            <button type="button" onClick={handleStart} disabled={disabled || busy || !canStart}>
              {busy ? '起動中…' : 'カメラ起動'}
            </button>
          ) : (
            <>
              <button type="button" onClick={handleCapture} disabled={disabled || busy}>
                {busy ? '処理中…' : '撮影して追加'}
              </button>
              <button type="button" onClick={stopStream} disabled={disabled}>
                停止
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
