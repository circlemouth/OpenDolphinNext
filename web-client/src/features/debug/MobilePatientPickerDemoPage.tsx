import { useState } from 'react';

import { MobilePatientPicker } from '../images/components/MobilePatientPicker';
import { resolveAriaLive } from '../../libs/observability/observability';

export function MobilePatientPickerDemoPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="mobile-patient-picker-demo-title">
        <header className="login-card__header">
          <h1 id="mobile-patient-picker-demo-title">Mobile Patient Picker (Phase1 demo)</h1>
          <p>モバイル画像アップロード専用UI向けの「患者特定」コンポーネント検証ページです（QA/検証専用）。</p>
        </header>

        <div className="status-message" role="status" aria-live={resolveAriaLive('info')}>
          <p>選択中 patientId: {selectedPatientId ?? '(none)'}</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            note: 本ページは `VITE_ENABLE_DEBUG_PAGES=1` かつシステム管理者ロールでのみ表示されます。
          </p>
        </div>

        <MobilePatientPicker
          title="画像アップロード: 患者選択"
          selectedPatientId={selectedPatientId}
          onSelect={(patientId) => setSelectedPatientId(patientId)}
        />
      </section>
    </main>
  );
}
