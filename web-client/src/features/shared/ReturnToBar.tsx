import { useId } from 'react';
import { Link } from 'react-router-dom';

import { isSafeReturnTo } from '../../routes/appNavigation';

import './returnToBar.css';

type ReturnToBarProps = {
  scope: { facilityId: string | undefined; userId?: string };
  returnTo?: string | null;
  from?: string | null;
  fallbackUrl: string;
  showShortcuts?: boolean;
};

const resolveSurfaceLabel = (surface?: string | null, fallbackUrl?: string) => {
  if (surface === 'reception' || fallbackUrl?.includes('/reception')) return '受付';
  if (surface === 'patients' || fallbackUrl?.includes('/patients')) return '患者管理';
  if (surface === 'charts' || fallbackUrl?.includes('/charts')) return 'カルテ';
  if (surface === 'administration' || fallbackUrl?.includes('/administration')) return '管理画面';
  return '前の画面';
};

const resolvePrimaryActionLabel = (surfaceLabel: string, hasReturnTo: boolean) => {
  if (hasReturnTo) {
    return `${surfaceLabel}へ戻る`;
  }
  return `${surfaceLabel}から再開する`;
};

const resolveHint = (surface?: string | null, hasReturnTo?: boolean) => {
  if (surface === 'reception') {
    return hasReturnTo
      ? '戻ったあとに対象患者を選び直せます。'
      : '患者文脈が必要な場合は受付で対象患者を選び直してください。';
  }
  if (surface === 'patients') {
    return hasReturnTo
      ? '戻ったあとに患者一覧から対象患者を選び直せます。'
      : '患者一覧から対象患者を選び直してください。';
  }
  if (surface === 'charts') {
    return hasReturnTo
      ? '戻ったあとに必要な患者・受診を選び直してください。'
      : 'カルテまたは受付から対象患者を選び直してください。';
  }
  return hasReturnTo
    ? '前の画面から安全に入り直してください。'
    : '既定の戻り先から入り直してください。';
};

export function ReturnToBar({ scope, returnTo, from, fallbackUrl, showShortcuts = false }: ReturnToBarProps) {
  const hintId = useId();
  const safeReturnTo = isSafeReturnTo(returnTo, scope.facilityId) ? returnTo : undefined;
  const primaryUrl = safeReturnTo ?? fallbackUrl;
  const hasReturnTo = Boolean(safeReturnTo);
  const surfaceLabel = resolveSurfaceLabel(from, fallbackUrl);
  const primaryLabel = resolvePrimaryActionLabel(surfaceLabel, hasReturnTo);
  const hint = resolveHint(from, hasReturnTo);
  const fallbackLabel = `${resolveSurfaceLabel(undefined, fallbackUrl)}へ移動`;
  const showFallbackShortcut = showShortcuts && safeReturnTo && safeReturnTo !== fallbackUrl;

  return (
    <section className="return-to-bar" role="region" aria-label="戻り導線">
      <div className="return-to-bar__main">
        <Link className="return-to-bar__back" to={primaryUrl} aria-describedby={hintId}>
          {primaryLabel}
        </Link>
        <div id={hintId} className="return-to-bar__hint">
          {hint}
        </div>
      </div>
      {showFallbackShortcut ? (
        <div className="return-to-bar__links">
          <Link className="return-to-bar__link" to={fallbackUrl}>
            {fallbackLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
