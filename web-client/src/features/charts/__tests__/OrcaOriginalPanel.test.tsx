import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OrcaOriginalPanel } from '../OrcaOriginalPanel';

describe('OrcaOriginalPanel', () => {
  it('ORCA正本、院内表示、キャッシュを分けて未確認を成功扱いしない', () => {
    render(<OrcaOriginalPanel patientId="P-001" visitDate="2026-05-14" runId="RUN-ORCA" />);

    expect(screen.getByRole('region', { name: 'ORCA正本差分確認' })).toBeInTheDocument();
    expect(screen.getByText('ORCA正本・院内表示・キャッシュ差分')).toBeInTheDocument();
    expect(screen.getByText('ORCA正本未確認')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('ORCA正本の警告・不一致・未確認は成功扱いしません');
    expect(screen.getByText(/会計反映状態の確定、診療録確定、処方確定を意味しません。/)).toBeInTheDocument();

    const patientSection = screen.getByRole('region', { name: '患者基本の差分' });
    expect(within(patientSection).getByText('ORCA正本')).toBeInTheDocument();
    expect(within(patientSection).getByText('院内表示')).toBeInTheDocument();
    expect(within(patientSection).getByText('キャッシュ/snapshot')).toBeInTheDocument();
  });

  it('警告、不一致、一致を同一表示に丸めない', () => {
    render(
      <OrcaOriginalPanel
        patientId="P-002"
        visitDate="2026-05-14"
        sourceStatus="fresh"
        rows={[
          {
            id: 'name',
            label: '患者氏名',
            orcaValue: 'ORCA canonical',
            localValue: '院内表示',
            cacheValue: 'cache',
            severity: 'unmatched',
            note: '氏名表示に差分があります。',
          },
          {
            id: 'insurance',
            label: '保険組合せ',
            orcaValue: '001',
            localValue: '001',
            cacheValue: '001',
            severity: 'match',
          },
          {
            id: 'acceptance',
            label: '受付状態',
            severity: 'warning',
            note: 'ORCA再取得後に受付を確認してください。',
          },
        ]}
      />,
    );

    expect(screen.getByText('ORCA正本再取得済み')).toBeInTheDocument();
    expect(screen.getByText('不一致')).toBeInTheDocument();
    expect(screen.getByText('一致')).toBeInTheDocument();
    expect(screen.getByText('警告')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '患者氏名の差分' })).toHaveTextContent('ORCA canonical');
    expect(screen.getByRole('region', { name: '患者氏名の差分' })).toHaveTextContent('院内表示');
    expect(screen.getByRole('region', { name: '患者氏名の差分' })).toHaveTextContent('cache');
  });
});
