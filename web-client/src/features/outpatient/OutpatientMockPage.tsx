import { useOptionalSession } from '../../AppRouter';
import { buildFacilityPath } from '../../routes/facilityRoutes';

export function OutpatientMockPage() {
  const session = useOptionalSession();

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="outpatient-mock-title">
        <header className="login-card__header">
          <h1 id="outpatient-mock-title">Outpatient Mock は廃止されました</h1>
          <p>legacy endpoint 前提のデバッグ画面は終了し、通常導線の typed JSON API に統一しました。</p>
        </header>
        <div className="status-message" role="status">
          <p>検証は Reception / Charts / Administration の現行導線で実施してください。</p>
          {session ? (
            <a className="facility-entry__secondary" href={buildFacilityPath(session.facilityId, '/reception')}>
              Reception を開く
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
