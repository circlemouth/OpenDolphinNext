import type { ReactNode } from 'react';

import { FocusTrapDialog } from '../../../components/modals/FocusTrapDialog';

type ConfirmDialogTone = 'default' | 'danger';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'キャンセル',
  tone = 'default',
  pending,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <FocusTrapDialog
      open={open}
      role="alertdialog"
      title={title}
      description={description}
      onClose={pending ? () => undefined : onCancel}
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      showCloseButton={!pending}
      testId="admin-confirm-dialog"
    >
      <div className="admin-dialog">
        {children ? <div className="admin-dialog__body">{children}</div> : null}
        <div className="admin-dialog__actions" role="group" aria-label="確認ダイアログ操作">
          <button type="button" className="admin-button admin-button--secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`admin-button ${tone === 'danger' ? 'admin-button--danger' : 'admin-button--primary'}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? '実行中…' : confirmLabel}
          </button>
        </div>
      </div>
    </FocusTrapDialog>
  );
}
