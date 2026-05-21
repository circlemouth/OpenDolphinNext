import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { clearDeepLinkContext, saveDeepLinkContext } from '../../../../routes/deepLinkContextStorage';
import { MobileImagesUploadPage } from '../MobileImagesUploadPage';
import { fetchPatientImageList, uploadPatientImageViaXhr } from '../../mobileApi';

vi.mock('../../../../libs/observability/observability', () => ({
  resolveAriaLive: () => 'polite',
  resolveRunId: (value?: string) => value ?? undefined,
}));

vi.mock('../../../../libs/security/safeUrl', () => ({
  safeSameOriginHttpUrl: (value?: string) => value ?? undefined,
}));

vi.mock('../../../../AppRouter', () => ({
  useOptionalSession: () => ({ facilityId: '0001', userId: 'user-1' }),
}));

vi.mock('../../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    fromCandidate: 'charts',
    returnToCandidate: '/f/0001/charts',
    safeReturnToCandidate: '/f/0001/charts',
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
    const identityBar = screen.getByRole('region', { name: '患者識別帯' });
    expect(identityBar).toBeInTheDocument();
    expect(identityBar).toHaveTextContent('患者ID: 123');
    expect(screen.queryByText('患者文脈が引き継がれていないため、この画面だけでは再開できません。戻り導線から患者を選び直してください。')).not.toBeInTheDocument();
    expect(document.querySelector('[data-test-id="mobile-image-capture-input"]')).toBeEnabled();
    expect(document.querySelector('[data-test-id="mobile-image-file-input"]')).toBeEnabled();
  });

  it('遷移文脈の診療日・診療科・担当医・保険組合せを医療安全患者ヘッダーへ表示する', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/f/0001/m/images',
            state: {
              patientId: '123',
              encounter: {
                patientId: '123',
                encounterKey: 'enc-20260511-1',
                visitDate: '2026-05-11',
                departmentCode: '01',
                physicianCode: '10001',
                insuranceCombinationNumber: '0001',
              },
            },
          },
        ]}
      >
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });
    const medicalSafetyHeader = screen.getByLabelText('医療安全患者ヘッダー');
    expect(medicalSafetyHeader).toHaveTextContent('受付日');
    expect(medicalSafetyHeader).toHaveTextContent('2026-05-11');
    expect(medicalSafetyHeader).toHaveTextContent('診療科コード 01');
    expect(medicalSafetyHeader).toHaveTextContent('担当医コード 10001');
    expect(medicalSafetyHeader).toHaveTextContent('保険組合せ 0001');
    expect(medicalSafetyHeader).toHaveTextContent('ORCA取得');
    expect(medicalSafetyHeader).toHaveTextContent('遷移文脈 / unverified');
    expect(medicalSafetyHeader).not.toHaveTextContent('内部参照ID');
    expect(medicalSafetyHeader).not.toHaveTextContent('enc-20260511-1');
    expect(screen.queryByRole('button', { name: 'RUN_ID をコピー' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^RUN_ID:/)).not.toBeInTheDocument();
  });

  it('URL/退避どちらにも patientId が無い場合は明確エラーを表示し送信不可', async () => {
    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('患者文脈が引き継がれていないため、この画面だけでは再開できません。戻り導線から患者を選び直してください。')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="mobile-images-missing-patient"]')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="mobile-image-send"]')).toBeDisabled();
    expect(document.querySelector('[data-test-id="mobile-image-capture-input"]')).toBeDisabled();
    expect(document.querySelector('[data-test-id="mobile-image-file-input"]')).toBeDisabled();
    expect(screen.getByText('患者を確定すると撮影または写真選択へ進めます。')).toBeInTheDocument();
    expect(screen.getByText('患者が未確定のため送信できません。患者を選び直してください。')).toBeInTheDocument();
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

  it('visible button から file picker を開ける', async () => {
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });

    const captureInput = document.querySelector('[data-test-id="mobile-image-capture-input"]') as HTMLInputElement;
    const fileInput = document.querySelector('[data-test-id="mobile-image-file-input"]') as HTMLInputElement;
    const captureClickSpy = vi.spyOn(captureInput, 'click');
    const fileClickSpy = vi.spyOn(fileInput, 'click');
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: '撮影して送る' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '写真を選んで送る' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '撮影して送る' }));
    await user.click(screen.getByRole('button', { name: '写真を選んで送る' }));

    expect(captureClickSpy).toHaveBeenCalledTimes(1);
    expect(fileClickSpy).toHaveBeenCalledTimes(1);
  });

  it('upload failure は canonical copy のみ表示し raw error detail を出さない', async () => {
    vi.mocked(uploadPatientImageViaXhr).mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: 'java.sql.SQLException',
      errorCode: 'internal_error',
    } as any);
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });

    const fileInput = document.querySelector('[data-test-id="mobile-image-file-input"]') as HTMLInputElement;
    const file = new File(['image'], 'upload.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '送信' }));

    expect(await screen.findByText('送信に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.getByText('送信は完了していません。患者文脈と選択ファイルを確認して再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/java\.sql\.SQLException/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^debug:/)).not.toBeInTheDocument();
  });

  it('選択したファイルの要約を表示する', async () => {
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });

    const fileInput = document.querySelector('[data-test-id="mobile-image-file-input"]') as HTMLInputElement;
    const file = new File(['image'], 'upload.jpg', { type: 'image/jpeg', lastModified: Date.parse('2026-05-21T12:34:56Z') });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const summary = document.querySelector('[data-test-id="mobile-image-selected-summary"]');
    expect(summary).not.toBeNull();
    expect(summary).toHaveTextContent('upload.jpg');
    expect(summary).toHaveTextContent('形式: image/jpeg');
    expect(summary).toHaveTextContent('サイズ: 5 B');
  });

  it('再試行で送信ボタンへ focus を戻す', async () => {
    vi.mocked(uploadPatientImageViaXhr).mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: 'network_error',
      errorCode: 'internal_error',
    } as any);
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });

    const fileInput = document.querySelector('[data-test-id="mobile-image-file-input"]') as HTMLInputElement;
    const file = new File(['image'], 'upload.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '送信' }));
    await user.click(await screen.findByRole('button', { name: '再試行' }));

    expect(screen.getByRole('button', { name: '送信' })).toHaveFocus();
  });

  it('患者が切り替わった後は画像再選択を促す', async () => {
    vi.mocked(uploadPatientImageViaXhr).mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: 'network_error',
      errorCode: 'internal_error',
    } as any);
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });

    const fileInput = document.querySelector('[data-test-id="mobile-image-file-input"]') as HTMLInputElement;
    const file = new File(['image'], 'upload.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '送信' }));

    const patientInput = screen.getByRole('textbox', { name: '患者ID' }) as HTMLInputElement;
    await user.clear(patientInput);
    await user.type(patientInput, '456');
    await user.click(screen.getByRole('button', { name: '患者を確定' }));

    expect(
      screen.getByText(
        '選択中の患者文脈が引き継がれていないため、この画面だけでは再試行できません。戻り導線から患者を選び直して、画像を再選択してください。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再試行' })).toBeEnabled();
  });

  it('送信成功後は最初の参照リンクへ focus し、リンク名を一意にする', async () => {
    vi.mocked(fetchPatientImageList)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        endpoint: '/patients/123/images',
        list: [],
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        endpoint: '/patients/123/images',
        list: [
          {
            imageId: 'img-1',
            fileName: 'upload-1.jpg',
            size: 1200,
            downloadUrl: 'https://example.test/images/1',
          },
          {
            imageId: 'img-2',
            fileName: 'upload-2.jpg',
            size: 1300,
            downloadUrl: 'https://example.test/images/2',
          },
        ],
      } as any);
    vi.mocked(uploadPatientImageViaXhr).mockResolvedValueOnce({
      ok: true,
      status: 201,
    } as any);
    saveDeepLinkContext({ patientId: '123' });

    render(
      <MemoryRouter initialEntries={['/f/0001/m/images']}>
        <MobileImagesUploadPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(vi.mocked(fetchPatientImageList)).toHaveBeenCalledWith('123');
    });

    const fileInput = document.querySelector('[data-test-id="mobile-image-file-input"]') as HTMLInputElement;
    const file = new File(['image'], 'upload.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '送信' }));

    const firstLink = await screen.findByRole('link', { name: '参照リンクを開く: upload-1.jpg' });
    const secondLink = screen.getByRole('link', { name: '参照リンクを開く: upload-2.jpg' });
    expect(firstLink).toHaveFocus();
    expect(secondLink).toBeInTheDocument();
  });
});
