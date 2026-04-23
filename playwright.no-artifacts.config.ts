import { defineConfig } from '@playwright/test';

const useMockOrcaQueue = process.env.VITE_USE_MOCK_ORCA_QUEUE === '1';
const verifyAdminDelivery = process.env.VITE_VERIFY_ADMIN_DELIVERY === '1';
const disableMsw = process.env.VITE_DISABLE_MSW === '1' || process.env.PLAYWRIGHT_DISABLE_MSW === '1';
const useHttps = process.env.VITE_DEV_USE_HTTPS === '1';
const protocol = useHttps ? 'https' : 'http';
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? '4173');
const patientImagesMvp = process.env.VITE_PATIENT_IMAGES_MVP === '1';
const patientImagesMobileUi = process.env.VITE_PATIENT_IMAGES_MOBILE_UI === '1';
const enableMsw = process.env.VITE_ENABLE_MSW ?? '1';
const enableDebugUi = process.env.VITE_ENABLE_DEBUG_UI ?? '1';
const receptionStatusMvp = process.env.VITE_RECEPTION_STATUS_MVP ?? '2';
const webServerCommand = `cd web-client && VITE_DEV_USE_HTTPS=${useHttps ? '1' : '0'} VITE_DISABLE_PROXY=1 VITE_ENABLE_MSW=${enableMsw} VITE_DISABLE_MSW=${disableMsw ? '1' : '0'} VITE_ENABLE_DEBUG_UI=${enableDebugUi} VITE_RECEPTION_STATUS_MVP=${receptionStatusMvp} VITE_PATIENT_IMAGES_MVP=${patientImagesMvp ? '1' : '0'} VITE_PATIENT_IMAGES_MOBILE_UI=${patientImagesMobileUi ? '1' : '0'} npm run dev -- --host --port ${webPort} --clearScreen false`;

export default defineConfig({
  testDir: '.',
  testIgnore: ['**/wt/**', '**/artifacts/**', '**/test-results/**'],
  reporter: [['line']],
  outputDir: 'test-results/no-artifacts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `${protocol}://localhost:${webPort}`,
    ignoreHTTPSErrors: true,
    serviceWorkers: 'allow',
    extraHTTPHeaders: {
      'x-use-mock-orca-queue': useMockOrcaQueue ? '1' : '0',
      'x-verify-admin-delivery': verifyAdminDelivery ? '1' : '0',
    },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
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
