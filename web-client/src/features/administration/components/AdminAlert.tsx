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
  const bannerTone =
    tone === 'error' ? 'danger' : tone === 'warn' ? 'warning' : tone === 'ok' ? 'info' : 'info';

  return (
    <div
      className={`admin-alert admin-alert--${tone} odn-banner odn-banner--${bannerTone}${className ? ` ${className}` : ''}`}
      role={role}
      aria-live={live}
      aria-atomic="true"
    >
      <strong className="admin-alert__tone">{tone.toUpperCase()}</strong>
      <div className="admin-alert__content">
        <p className="admin-alert__message">{message}</p>
        {detail ? <p className="admin-alert__detail">{detail}</p> : null}
      </div>
    </div>
  );
}
