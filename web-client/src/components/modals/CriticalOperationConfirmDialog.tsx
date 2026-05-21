import type { ReactNode } from 'react';

import { FocusTrapDialog } from './FocusTrapDialog';

export type CriticalOperationTone = 'warning' | 'danger';
export type CriticalOperationChecklistItem = {
  label: string;
  checked?: boolean;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
};

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
  checklistTitle?: string;
  checklistItems?: CriticalOperationChecklistItem[];
  extraContent?: ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'full';
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
  checklistTitle = '実行前チェック',
  checklistItems,
  extraContent,
  size = 'lg',
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
      size={size}
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
        {checklistItems && checklistItems.length > 0 ? (
          <section className="critical-operation-confirm__section" aria-label={checklistTitle}>
            <h3>{checklistTitle}</h3>
            <ul className="critical-operation-confirm__checklist">
              {checklistItems.map((item) => (
                <li key={item.label} data-tone={item.tone ?? (item.checked ? 'success' : 'warning')}>
                  <span className="critical-operation-confirm__checkmark" aria-hidden="true">
                    {item.checked ? '✓' : '!'}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {extraContent ? <div className="critical-operation-confirm__extra">{extraContent}</div> : null}
        <div className="critical-operation-confirm__actions odn-action-bar" role="group" aria-label={`${operationLabel}操作`}>
          <button
            type="button"
            className="critical-operation-confirm__button critical-operation-confirm__button--secondary odn-button odn-button--secondary"
            onClick={onCancel}
            disabled={cancelDisabled}
            aria-disabled={cancelDisabled || undefined}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`critical-operation-confirm__button critical-operation-confirm__button--primary odn-button ${
              tone === 'danger' ? 'odn-button--danger' : 'odn-button--primary'
            }`}
            onClick={onConfirm}
            disabled={confirmDisabled}
            aria-disabled={confirmDisabled || undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </FocusTrapDialog>
  );
}
