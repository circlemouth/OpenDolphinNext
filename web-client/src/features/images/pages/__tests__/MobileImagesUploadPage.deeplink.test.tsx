import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { clearDeepLinkContext, saveDeepLinkContext } from '../../../../routes/deepLinkContextStorage';
import { MobileImagesUploadPage } from '../MobileImagesUploadPage';
import { fetchPatientImageList } from '../../mobileApi';

vi.mock('../../../../libs/observability/observability', () => ({
  resolveAriaLive: () => 'polite',
  resolveRunId: (value?: string) => value ?? undefined,
}));

vi.mock('../../../../libs/security/safeUrl', () => ({
  safeSameOriginHttpUrl: () => undefined,
}));

vi.mock('../../../../AppRouter', () => ({
  useOptionalSession: () => ({ facilityId: '0001', userId: 'user-1' }),
}));

vi.mock('../../../charts/authService', () => ({
  useAuthService: () => ({ flags: { runId: 'RUN-IMAGES-TEST' } }),
}));

vi.mock('../../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    fromCandidate: 'charts',
    returnToCandidate: '/f/0001/charts',
  }),
}));

vi.mock('../../../shared/ReturnToBar', () => ({
  ReturnToBar: () => <div data-test-id="return-to-bar" />,
}));

vi.mock('../../mobileApi', () => ({
  fetchPatientImageList: vi.fn(async () => ({
    ok: true,
    status: 200,
    endpoint: '/patients/123/images',
    list: [],
  })),
  uploadPatientImageViaXhr: vi.fn(),
}));

describe('MobileImagesUploadPage deeplink fallback', () => {
  beforeEach(() => {
    clearDeepLinkContext();
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('scrub 後でも deeplink context の patientId で描画できる', async () => {
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });
    expect(screen.queryByText('患者情報が見つからないため、この画面だけでは再開できません。戻り導線から患者を選び直してください。')).not.toBeInTheDocument();
    expect(document.querySelector('[data-test-id="mobile-image-capture-input"]')).toBeEnabled();
    expect(document.querySelector('[data-test-id="mobile-image-file-input"]')).toBeEnabled();
  });

  it('URL/退避どちらにも patientId が無い場合は明確エラーを表示し送信不可', async () => {
    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('患者情報が見つからないため、この画面だけでは再開できません。戻り導線から患者を選び直してください。')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="mobile-images-missing-patient"]')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="mobile-image-send"]')).toBeDisabled();
    expect(document.querySelector('[data-test-id="mobile-image-capture-input"]')).toBeDisabled();
    expect(document.querySelector('[data-test-id="mobile-image-file-input"]')).toBeDisabled();
    expect(vi.mocked(fetchPatientImageList)).not.toHaveBeenCalled();
  });

  it('feature_disabled は専用メッセージを表示する', async () => {
    vi.mocked(fetchPatientImageList).mockResolvedValueOnce({
      ok: false,
      status: 404,
      endpoint: '/patients/123/images',
      list: [],
      error: 'HTTP 404',
      errorCode: 'feature_disabled',
    } as any);
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('患者画像機能はサーバーで無効化されています。')).toBeInTheDocument();
    });
    expect(document.querySelector('[data-test-id="mobile-image-send"]')).toBeDisabled();
  });
});
