import { useCallback, useState } from 'react';

type ImageDropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  disabledReason?: string;
  attachmentTargetLabel?: string;
  maxSizeLabel?: string;
};

const toFileArray = (list: FileList | null) => (list ? Array.from(list) : []);

export function ImageDropzone({ onFiles, disabled, disabledReason, attachmentTargetLabel, maxSizeLabel }: ImageDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const noteId = 'image-dropzone-note';

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (disabled) return;
      const items = toFileArray(files);
      if (items.length === 0) return;
      onFiles(items);
    },
    [disabled, onFiles],
  );

  return (
    <div
      className="charts-image-dropzone"
      data-active={dragging ? 'true' : 'false'}
      data-test-id="image-dropzone"
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled) return;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (disabled) return;
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (disabled) return;
        setDragging(false);
        handleFiles(event.dataTransfer?.files ?? null);
      }}
    >
      <div className="charts-image-dropzone__body">
        <p className="charts-image-dropzone__title">画像をドラッグ&ドロップ</p>
        <p className="charts-image-dropzone__hint">またはボタンから画像を選択してください。</p>
        <p id={noteId} className="charts-image-dropzone__meta">
          添付先: {attachmentTargetLabel ?? '患者画像一覧と選択中カルテ'} / 保存先はサーバーが解決します。
        </p>
        {disabled && disabledReason ? (
          <p className="charts-image-dropzone__meta" role="status">
            {disabledReason}
          </p>
        ) : null}
        <label className="charts-image-dropzone__button">
          ファイルを選択
          <input
            data-test-id="image-file-input"
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            aria-describedby={noteId}
            onChange={(event) => handleFiles(event.target.files)}
            onClick={(event) => {
              const input = event.currentTarget;
              input.value = '';
            }}
          />
        </label>
        <p className="charts-image-dropzone__meta">対応形式: JPG/PNG/GIF/WEBP など {maxSizeLabel ? `｜${maxSizeLabel}` : ''}</p>
      </div>
      <div className="charts-image-dropzone__overlay" aria-hidden="true" />
    </div>
  );
}
