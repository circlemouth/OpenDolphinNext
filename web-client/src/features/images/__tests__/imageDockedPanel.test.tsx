import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

import { ImageDockedPanel } from '../components/ImageDockedPanel';
import { fetchKarteImageList } from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    fetchKarteImageList: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      endpoint: '/patients/{patientId}/images',
      list: [],
    }),
  };
});

vi.mock('../mobileApi', () => ({
  uploadPatientImageViaXhr: vi.fn(),
}));

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImageDockedPanel', () => {
  it('患者、添付先、SOAP挿入先、スキャン取込の導線を初期表示する', async () => {
    renderWithClient(
      <ImageDockedPanel
        patientId="P-001"
        appointmentId="A-001"
        selectedAttachmentIds={[10, 11]}
        soapTargetOptions={[
          { value: 'objective', label: 'O: 所見' },
          { value: 'plan', label: 'P: 方針' },
        ]}
        soapTargetSection="objective"
      />,
    );

    expect(await screen.findByText('患者画像')).toBeInTheDocument();
    expect(fetchKarteImageList).toHaveBeenCalledWith({ chartId: 'P-001' });
    expect(screen.getByText('添付先: 患者ID P-001 / 受付・予約 A-001')).toBeInTheDocument();
    expect(screen.getByText(/文書添付候補: 2 件/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'スキャン取込' })).toBeInTheDocument();
    expect(screen.getByText(/保存 URI、object key、digest、所有者、施設は/)).toBeInTheDocument();
  });
});
