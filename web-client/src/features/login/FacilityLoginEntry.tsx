import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { buildFacilityPath, normalizeFacilityId } from '../../routes/facilityRoutes';
import { loadRecentFacilities } from './recentFacilityStore';
import { isLegacyFrom, normalizeFromState, resolveSwitchContext } from './loginRouteState';

type FacilityLoginEntryProps = {
  heading?: string;
};

export const FacilityLoginEntry = ({ heading = 'OpenDolphin Web 施設選択' }: FacilityLoginEntryProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [recentFacilities] = useState(() => loadRecentFacilities());
  const [manualMode, setManualMode] = useState(recentFacilities.length === 0);
  const [facilityInput, setFacilityInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fromState = useMemo(() => normalizeFromState(location.state)?.from, [location.state]);
  const showLegacyNotice = useMemo(() => isLegacyFrom(fromState), [fromState]);
  const switchContext = useMemo(() => resolveSwitchContext(location.state), [location.state]);
  const switchActor = switchContext?.actor;
  const forwardSearch = location.search ?? '';
  const forwardState = useMemo(() => {
    if (!fromState && !switchContext) return undefined;
    return {
      ...(fromState ? { from: fromState } : {}),
      ...(switchContext ? { switchContext } : {}),
    };
  }, [fromState, switchContext]);

  const handleSelectFacility = (facilityId: string) => {
    const normalized = normalizeFacilityId(facilityId);
    if (!normalized) {
      setError('施設IDを入力してください。');
      return;
    }
    setError(null);
    const basePath = buildFacilityPath(normalized, '/login');
    const nextPath = forwardSearch ? `${basePath}${forwardSearch}` : basePath;
    navigate(nextPath, { state: forwardState });
  };

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSelectFacility(facilityInput);
  };

  const handleManualChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFacilityInput(event.target.value);
    if (error) setError(null);
  };

  const hasRecentFacilities = recentFacilities.length > 0;

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="facility-login-heading">
        <header className="login-card__header">
          <h1 id="facility-login-heading">{heading}</h1>
          <p>ログインする施設IDを選択または入力してください。選択後にログイン画面へ進みます。</p>
        </header>
        {switchContext ? (
          <div className="status-message is-error" role="status">
            <p>ユーザー切替を開始しました。権限境界を明示するため、再ログインが必要です。</p>
            {switchActor ? (
              <p className="status-message__detail">
                直前のログイン: {switchActor.facilityId}:{switchActor.userId}
                {switchActor.role ? ` / role=${switchActor.role}` : ''}
                {switchActor.runId ? ` / RUN_ID=${switchActor.runId}` : ''}
              </p>
            ) : (
              <p className="status-message__detail">前回のログイン情報は取得できませんでした。</p>
            )}
          </div>
        ) : null}
        {showLegacyNotice ? (
          <p className="status-message" role="status">
            旧URLからアクセスされています。施設IDを選択すると目的の画面へ進みます。
          </p>
        ) : null}

        {hasRecentFacilities ? (
          <div className="facility-entry__block" aria-label="最近利用施設">
            <p className="facility-entry__label">最近利用した施設</p>
            <div className="facility-entry__choices">
              {recentFacilities.map((facilityId) => (
                <button
                  key={facilityId}
                  type="button"
                  className="facility-entry__choice"
                  onClick={() => handleSelectFacility(facilityId)}
                >
                  {facilityId}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="facility-entry__toggle"
              onClick={() => setManualMode(true)}
              disabled={manualMode}
            >
              別施設を選択
            </button>
          </div>
        ) : (
          <p className="facility-entry__empty">最近利用した施設は未登録です。</p>
        )}

        {manualMode ? (
          <form className="login-form facility-entry__form" onSubmit={handleManualSubmit} noValidate>
            <label className="field">
              <span>施設ID</span>
              <input
                id="facility-login-id"
                name="facilityLoginId"
                type="text"
                autoComplete="organization"
                value={facilityInput}
                onChange={handleManualChange}
                placeholder="例: 0001"
              />
            </label>
            {error ? <span className="field-error">{error}</span> : null}

            <div className="login-form__actions facility-entry__actions">
              <button type="submit">ログインへ進む</button>
              {hasRecentFacilities ? (
                <button
                  type="button"
                  className="facility-entry__secondary"
                  onClick={() => setManualMode(false)}
                >
                  最近利用施設から選択
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
};
