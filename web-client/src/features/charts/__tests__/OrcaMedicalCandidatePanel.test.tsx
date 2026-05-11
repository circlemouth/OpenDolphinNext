import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrcaMedicalCandidatePanel } from '../OrcaMedicalCandidatePanel';
import { prepareOrcaMedicalCandidateFromChart } from '../orcaMedicalCandidateApi';

vi.mock('../orcaMedicalCandidateApi', () => ({
  prepareOrcaMedicalCandidateFromChart: vi.fn(),
}));

describe('OrcaMedicalCandidatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows patient, acceptance, department, physician, insurance, and candidate result without live send controls', async () => {
    const user = userEvent.setup();
    vi.mocked(prepareOrcaMedicalCandidateFromChart).mockResolvedValueOnce({
      ok: true,
      runId: 'RUN-CAND',
      candidateId: 10,
      candidateStatus: 'NEEDS_REVIEW',
      sendable: false,
      nonAuthoritative: true,
      patientId: 'P-1',
      encounterId: 'E-1',
      chartRevisionId: 'REV-1',
      prescriptionId: 20,
      prescriptionRevisionId: 30,
      medicalInformation: [
        {
          entity: 'medOrder',
          rpSequence: 1,
          medicalClass: '211',
          medicalClassName: '内服',
          usageCode: '001000',
          usageName: '朝食後',
          medications: [{ itemSequence: 1, code: '620000001', name: '候補薬剤', number: '1' }],
        },
      ],
      issues: [{ code: 'usage_code_unresolved', message: 'usage code is required', rpSequence: 1 }],
    });

    render(
      <OrcaMedicalCandidatePanel
        chartRevisionId="REV-1"
        patientName="患者A"
        patientId="P-1"
        visitDate="2026-05-10"
        receptionId="R-1"
        appointmentId="A-1"
        department="内科"
        physician="医師A"
        insuranceCombinationNumber="INS-1"
      />,
    );

    expect(screen.getByText('患者A / P-1')).toBeInTheDocument();
    expect(screen.getByText('R-1 / A-1')).toBeInTheDocument();
    expect(screen.getByText('内科')).toBeInTheDocument();
    expect(screen.getByText('医師A')).toBeInTheDocument();
    expect(screen.getByText('INS-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '候補を作成' }));

    await waitFor(() => expect(prepareOrcaMedicalCandidateFromChart).toHaveBeenCalledWith({
      chartRevisionId: 'REV-1',
      signal: expect.any(AbortSignal),
    }));
    expect(screen.getByText('NEEDS_REVIEW / 要確認')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getAllByText('1件')).toHaveLength(2);
    expect(screen.getByRole('list', { name: '診療行為候補行' })).toHaveTextContent('RP1');
    expect(screen.getByText('診療区分: 211 / 内服')).toBeInTheDocument();
    expect(screen.getByText('用法: 001000 / 朝食後')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'RP1 薬剤行' })).toHaveTextContent('薬剤1: 620000001 / 候補薬剤 / 1');
    expect(screen.getByText(/usage_code_unresolved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /送信/ })).not.toBeInTheDocument();
  });

  it('does not call API when chartRevisionId is missing', async () => {
    const user = userEvent.setup();
    render(<OrcaMedicalCandidatePanel patientName="患者A" patientId="P-1" />);

    const button = screen.getByRole('button', { name: '候補を作成' });
    expect(button).toBeDisabled();
    expect(screen.getByText('診療録リビジョンが未確定のため候補を作成できません。')).toBeInTheDocument();

    await user.click(button);
    expect(prepareOrcaMedicalCandidateFromChart).not.toHaveBeenCalled();
  });
});
