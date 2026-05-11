import type { ReactNode } from 'react';

import { FocusTrapDialog } from './FocusTrapDialog';

export type CriticalOperationTone = 'warning' | 'danger';

export type CriticalOperationField = {
  label: string;
  value: ReactNode;
};

export interface CriticalOperationConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  operationLabel: string;
  patientName?: string;
  patientFields: CriticalOperationField[];
  summaryTitle: string;
  summaryFields: CriticalOperationField[];
  cancelLabel?: string;
  confirmLabel: string;
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
  tone?: CriticalOperationTone;
  testId?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const normalizeText = (value?: string | null) => {
  if (typeof value !== 'string') return '—';
  const trimmed = value.trim();
  return trimmed || '—';
};

export function CriticalOperationConfirmDialog({
  open,
  title,
  description,
  operationLabel,
  patientName,
  patientFields,
  summaryTitle,
  summaryFields,
  cancelLabel = 'キャンセル',
  confirmLabel,
  cancelDisabled = false,
  confirmDisabled = false,
  tone = 'warning',
  testId,
  onCancel,
  onConfirm,
}: CriticalOperationConfirmDialogProps) {
  return (
    <FocusTrapDialog
      open={open}
      role="alertdialog"
      title={title}
      description={description}
      onClose={onCancel}
      closeOnBackdrop={false}
      testId={testId}
    >
      <section className="critical-operation-confirm" aria-label={`${operationLabel}の重大操作確認`} data-tone={tone}>
        <p className="critical-operation-confirm__operation">
          実行操作: <strong>{operationLabel}</strong>
        </p>
        <section className="critical-operation-confirm__section" aria-label="患者確認">
          <h3>患者確認</h3>
          <p className="critical-operation-confirm__identity">
            <strong>{normalizeText(patientName)}</strong>
          </p>
          <dl className="critical-operation-confirm__list">
            {patientFields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="critical-operation-confirm__section" aria-label={summaryTitle}>
          <h3>{summaryTitle}</h3>
          <dl className="critical-operation-confirm__list">
            {summaryFields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="critical-operation-confirm__actions" role="group" aria-label={`${operationLabel}操作`}>
          <button type="button" onClick={onCancel} disabled={cancelDisabled}>
            {cancelLabel}
          </button>
          <button type="button" className="critical-operation-confirm__primary" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </FocusTrapDialog>
  );
}
