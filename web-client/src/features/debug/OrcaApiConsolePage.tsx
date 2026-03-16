import { useSession } from '../../AppRouter';
import { buildFacilityPath } from '../../routes/facilityRoutes';

export function OrcaApiConsolePage() {
  const session = useSession();

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="orca-api-console-title">
        <header className="login-card__header">
          <h1 id="orca-api-console-title">ORCA API Console は廃止されました</h1>
          <p>ブラウザから ORCA XML を直接送信する経路は終了し、管理画面の typed JSON 導線へ統一しました。</p>
        </header>
        <div className="status-message" role="status">
          <p>運用確認は Administration の「運用監視」を利用してください。</p>
          <a className="facility-entry__secondary" href={buildFacilityPath(session.facilityId, '/administration?section=operations')}>
            Administration / 運用監視を開く
          </a>
        </div>
      </section>
    </main>
  );
}
