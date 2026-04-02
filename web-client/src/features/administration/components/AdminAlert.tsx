import { resolveAriaLive } from '../../../libs/observability/observability';
import { toLegacyWarningTone, type FeedbackTone } from '../../shared/feedbackTone';

type AdminAlertTone = 'ok' | FeedbackTone;

type AdminAlertProps = {
  tone: AdminAlertTone;
  message: string;
  detail?: string;
  className?: string;
};

export function AdminAlert({ tone, message, detail, className }: AdminAlertProps) {
  const role = tone === 'error' || tone === 'warn' ? 'alert' : 'status';
  const live = resolveAriaLive(tone === 'ok' ? 'success' : toLegacyWarningTone(tone), undefined);

  return (
    <div
      className={`admin-alert admin-alert--${tone}${className ? ` ${className}` : ''}`}
      role={role}
      aria-live={live}
      aria-atomic="true"
    >
      <strong className="admin-alert__tone">{tone.toUpperCase()}</strong>
      <p className="admin-alert__message">
        {message}
        {detail ? ` ${detail}` : ''}
      </p>
    </div>
  );
}
