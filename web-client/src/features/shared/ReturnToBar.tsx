import { useEffect, useId, useState } from 'react';
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
      ? '患者文脈は引き継がれていません。戻ったあとに対象患者を選び直せます。'
      : '患者文脈が引き継がれていない場合は、受付で対象患者を選び直してください。';
  }
  if (surface === 'patients') {
    return hasReturnTo
      ? '患者文脈は引き継がれていません。戻ったあとに患者一覧から対象患者を選び直せます。'
      : '患者文脈が引き継がれていない場合は、患者一覧から対象患者を選び直してください。';
  }
  if (surface === 'charts') {
    return hasReturnTo
      ? '患者文脈は引き継がれていません。戻ったあとに患者と受診を選び直してください。'
      : '患者文脈が引き継がれていない場合は、カルテまたは受付から対象患者を選び直してください。';
  }
  return hasReturnTo
    ? '患者文脈は引き継がれていません。前の画面から安全に入り直してください。'
    : '患者文脈が引き継がれていない場合は、既定の戻り先から入り直してください。';
};

const useIsNarrowViewport = (query = '(max-width: 720px)') => {
  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQueryList = window.matchMedia(query);
    const update = () => setIsNarrow(mediaQueryList.matches);
    update();

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', update);
      return () => mediaQueryList.removeEventListener('change', update);
    }

    mediaQueryList.addListener(update);
    return () => mediaQueryList.removeListener(update);
  }, [query]);

  return isNarrow;
};

export function ReturnToBar({ scope, returnTo, from, fallbackUrl, showShortcuts = false }: ReturnToBarProps) {
  const hintId = useId();
  const isNarrowViewport = useIsNarrowViewport();
  const safeReturnTo = isSafeReturnTo(returnTo, scope.facilityId) ? returnTo : undefined;
  const primaryUrl = safeReturnTo ?? fallbackUrl;
  const hasReturnTo = Boolean(safeReturnTo);
  const surfaceLabel = resolveSurfaceLabel(from, fallbackUrl);
  const primaryLabel = resolvePrimaryActionLabel(surfaceLabel, hasReturnTo);
  const hint = resolveHint(from, hasReturnTo);
  const fallbackLabel = `${resolveSurfaceLabel(undefined, fallbackUrl)}へ移動`;
  const showFallbackShortcut = showShortcuts && safeReturnTo && safeReturnTo !== fallbackUrl;

  return (
    <section className="return-to-bar" role="region" aria-label="戻り導線" data-layout={isNarrowViewport ? 'narrow' : 'wide'}>
      <div className="return-to-bar__main">
        <Link className="return-to-bar__back" to={primaryUrl} aria-describedby={hintId}>
          {primaryLabel}
        </Link>
        <div id={hintId} className="return-to-bar__hint" data-layout={isNarrowViewport ? 'narrow' : 'wide'}>
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
