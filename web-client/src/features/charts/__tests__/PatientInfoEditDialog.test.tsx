import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PatientInfoEditDialog } from '../PatientInfoEditDialog';

const mockFetchOrcaAddress = vi.fn();
const mockUpdateOfficialPatient = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options?: { mutationFn?: (variables: any) => Promise<any> }) => ({
    mutate: vi.fn((variables?: any) => {
      void options?.mutationFn?.(variables);
    }),
    isPending: false,
  }),
}));

vi.mock('../../patients/orcaAddressApi', () => ({
  fetchOrcaAddress: (...args: unknown[]) => mockFetchOrcaAddress(...args),
}));

vi.mock('../../patients/api', () => ({
  updateOfficialPatient: (...args: unknown[]) => mockUpdateOfficialPatient(...args),
}));

describe('PatientInfoEditDialog', () => {
  beforeEach(() => {
    mockFetchOrcaAddress.mockReset();
    mockUpdateOfficialPatient.mockReset();
    mockUpdateOfficialPatient.mockResolvedValue({ ok: true, patient: { patientId: '000001' } });
  });

  it('住所補完で draft.address を更新する', async () => {
    mockFetchOrcaAddress.mockResolvedValue({
      ok: true,
      status: 200,
      item: {
        zip: '1000001',
        fullAddress: '東京都千代田区千代田',
      },
    });
    const user = userEvent.setup();

    render(
      <PatientInfoEditDialog
        open
        baseline={{
          patientId: '000001',
          name: '山田 花子',
          zip: '100-0001',
          address: '',
        }}
        fallback={null}
        editAllowed
        meta={{ runId: 'RUN-TEST', dataSourceTransition: 'server' }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '住所補完' }));

    expect(mockFetchOrcaAddress).toHaveBeenCalledWith({ zip: '1000001', effective: expect.any(String) });
    expect(screen.getByDisplayValue('東京都千代田区千代田')).toBeInTheDocument();
  });

  it('住所補完失敗時は canonical copy を表示し raw detail を出さない', async () => {
    mockFetchOrcaAddress.mockResolvedValue({
      ok: false,
      status: 500,
      message: 'zip backend stacktrace: connection refused',
    });
    const user = userEvent.setup();

    render(
      <PatientInfoEditDialog
        open
        baseline={{
          patientId: '000001',
          name: '山田 花子',
          zip: '100-0001',
          address: '',
        }}
        fallback={null}
        editAllowed
        meta={{ runId: 'RUN-TEST', dataSourceTransition: 'server' }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '住所補完' }));

    expect(await screen.findByText('住所候補の取得に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/stacktrace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connection refused/i)).not.toBeInTheDocument();
  });

  it('保存時は official update route を呼び出す', async () => {
    const user = userEvent.setup();

    render(
      <PatientInfoEditDialog
        open
        baseline={{
          patientId: '000001',
          name: '山田 花子',
          zip: '100-0001',
          address: '東京都千代田区',
        }}
        fallback={null}
        editAllowed
        meta={{ runId: 'RUN-TEST', dataSourceTransition: 'server' }}
        onClose={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText('氏名（必須）'));
    await user.type(screen.getByLabelText('氏名（必須）'), '山田 花子 改');
    await user.click(screen.getByRole('button', { name: '差分確認へ' }));
    await user.click(screen.getByLabelText('差分を確認しました（保存を実行します）'));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(mockUpdateOfficialPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        patient: expect.objectContaining({
          patientId: '000001',
          name: '山田 花子 改',
        }),
      }),
    );
  });
});
