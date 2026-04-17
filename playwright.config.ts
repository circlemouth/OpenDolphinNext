import { defineConfig } from '@playwright/test';

// RUN_ID=20251212T054836Z
// MSW/実API 切替フラグ（Vite 側と合わせる）:
// - VITE_USE_MOCK_ORCA_QUEUE=1 なら ORCA キューをモックし、0/未設定なら実 API に向ける。
// - VITE_VERIFY_ADMIN_DELIVERY=1 なら Administration 設定配信をテストで検証する。
// - VITE_DISABLE_MSW/PLAYWRIGHT_DISABLE_MSW で dev サーバーの MSW を無効化できる（CI matrix 用）。
const useMockOrcaQueue = process.env.VITE_USE_MOCK_ORCA_QUEUE === '1';
const verifyAdminDelivery = process.env.VITE_VERIFY_ADMIN_DELIVERY === '1';
const disableMsw = process.env.VITE_DISABLE_MSW === '1' || process.env.PLAYWRIGHT_DISABLE_MSW === '1';
const useHttps = process.env.VITE_DEV_USE_HTTPS === '1';
const protocol = useHttps ? 'https' : 'http';
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? '4173');
const patientImagesMvp = process.env.VITE_PATIENT_IMAGES_MVP === '1';
const patientImagesMobileUi = process.env.VITE_PATIENT_IMAGES_MOBILE_UI === '1';
// MSW は「明示的に ON であること」を gate にしているため、E2E では既定で有効化する。
// 既存の制御フラグで無効化したい場合は PLAYWRIGHT_DISABLE_MSW=1 または VITE_DISABLE_MSW=1 を使う。
const enableMsw = process.env.VITE_ENABLE_MSW ?? '1';
// Fault injection (x-msw-fault / x-msw-delay-ms) は DEV + VITE_ENABLE_MSW + ?msw=1 + debug env で gate する。
// E2E では既定で有効化し、アプリの通常 UI 露出は別ゲート（ReceptionPage は ?debug=1 / role=system_admin）で抑制する。
const enableDebugUi = process.env.VITE_ENABLE_DEBUG_UI ?? '1';
// Reception status MVP: tests/reception/e2e-rec-001-status-mvp.spec.ts を安定して検証するため既定で phase2 を有効にする。
const receptionStatusMvp = process.env.VITE_RECEPTION_STATUS_MVP ?? '2';
const webServerCommand = `cd web-client && VITE_DEV_USE_HTTPS=${useHttps ? '1' : '0'} VITE_DISABLE_PROXY=1 VITE_ENABLE_MSW=${enableMsw} VITE_DISABLE_MSW=${disableMsw ? '1' : '0'} VITE_ENABLE_DEBUG_UI=${enableDebugUi} VITE_RECEPTION_STATUS_MVP=${receptionStatusMvp} VITE_PATIENT_IMAGES_MVP=${patientImagesMvp ? '1' : '0'} VITE_PATIENT_IMAGES_MOBILE_UI=${patientImagesMobileUi ? '1' : '0'} npm run dev -- --host --port ${webPort} --clearScreen false`;

export default defineConfig({
  testIgnore: ['**/wt/**', '**/artifacts/**', '**/test-results/**'],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `${protocol}://localhost:${webPort}`,
    ignoreHTTPSErrors: true,
    serviceWorkers: 'allow',
    // 環境フラグはヘッダー経由でテストアプリに伝播させる（サーバー側で参照する想定）。
    extraHTTPHeaders: {
      'x-use-mock-orca-queue': useMockOrcaQueue ? '1' : '0',
      'x-verify-admin-delivery': verifyAdminDelivery ? '1' : '0',
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: webServerCommand,
    url: `${protocol}://localhost:${webPort}`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
