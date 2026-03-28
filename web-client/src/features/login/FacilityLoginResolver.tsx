import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';

import { buildFacilityPath, normalizeFacilityId, parseFacilityPath } from '../../routes/facilityRoutes';
import { FacilityLoginEntry } from './FacilityLoginEntry';
import { isLegacyFrom, resolveFromState, resolveSwitchContext } from './loginRouteState';
import { loadRecentFacilities } from './recentFacilityStore';

type FacilityJson = {
  facilityId?: unknown;
};

const readDefaultFacilityId = () => normalizeFacilityId(import.meta.env.VITE_DEFAULT_FACILITY_ID ?? '');

const loadFacilityIdFromJson = async (): Promise<string | undefined> => {
  if (typeof fetch === 'undefined') return undefined;
  try {
    const response = await fetch('/facility.json', { cache: 'no-store' });
    if (!response.ok) return undefined;
    const data = (await response.json()) as FacilityJson;
    if (!data || typeof data !== 'object') return undefined;
    return normalizeFacilityId(typeof data.facilityId === 'string' ? data.facilityId : undefined);
  } catch {
    return undefined;
  }
};

const resolveFacilityIdFromFromState = (from?: string | Location): string | undefined => {
  if (!from) return undefined;
  const pathname =
    typeof from === 'string'
      ? (from.split('?')[0] ?? '').split('#')[0] ?? ''
      : from.pathname ?? '';
  if (!pathname) return undefined;
  const parsed = parseFacilityPath(pathname);
  if (!parsed?.facilityId) return undefined;
  return normalizeFacilityId(parsed.facilityId);
};

const resolveFacilityId = async (fromState?: string | Location): Promise<string | undefined> => {
  const fromFacilityId = resolveFacilityIdFromFromState(fromState);
  if (fromFacilityId) return fromFacilityId;

  const recentFacilities = loadRecentFacilities();
  if (recentFacilities.length === 1) {
    return recentFacilities[0];
  }
  if (recentFacilities.length > 0) {
    return undefined;
  }

  const envFacilityId = readDefaultFacilityId();
  if (envFacilityId) return envFacilityId;

  return loadFacilityIdFromJson();
};

export const FacilityLoginResolver = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showEntry, setShowEntry] = useState(false);
  const [isResolving, setIsResolving] = useState(true);

  const fromState = useMemo(() => resolveFromState(location.state), [location.state]);
  const forwardableFromState = useMemo(() => {
    if (!fromState) return undefined;
    return resolveFacilityIdFromFromState(fromState) ? fromState : undefined;
  }, [fromState]);
  const forwardState = useMemo(
    () => (forwardableFromState ? { from: forwardableFromState } : undefined),
    [forwardableFromState],
  );
  const legacyFrom = useMemo(() => isLegacyFrom(fromState), [fromState]);
  const switchContext = useMemo(() => resolveSwitchContext(location.state), [location.state]);
  const forwardSearch = location.search ?? '';

  useEffect(() => {
    let active = true;
    setShowEntry(false);
    setIsResolving(true);

    const attemptResolve = async () => {
      if (switchContext) {
        setShowEntry(true);
        setIsResolving(false);
        return;
      }
      const facilityId = await resolveFacilityId(fromState);
      if (!active) return;
      if (facilityId) {
        // ルーティングの差分を最小化するため、/login 直アクセスは replace、
        // 旧URL/リダイレクト由来（fromState or legacyFrom）は push で履歴を残す。
        const basePath = buildFacilityPath(facilityId, '/login');
        const nextPath = forwardSearch ? `${basePath}${forwardSearch}` : basePath;
        navigate(nextPath, {
          replace: !(fromState || legacyFrom),
          state: forwardState,
        });
        return;
      }
      setShowEntry(true);
      setIsResolving(false);
    };

    void attemptResolve();

    return () => {
      active = false;
    };
  }, [forwardState, fromState, legacyFrom, location.key, navigate, switchContext]);

  if (isResolving) {
    return (
      <main className="login-shell">
        <section className="login-card" aria-labelledby="facility-login-resolve">
          <header className="login-card__header">
            <h1 id="facility-login-resolve">施設情報を確認中…</h1>
            <p>施設IDの補完候補を確認しています。少々お待ちください。</p>
          </header>
        </section>
      </main>
    );
  }

  if (!showEntry) return null;

  return <FacilityLoginEntry />;
};
