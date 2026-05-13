import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusPill } from '../StatusPill';
import { PatientIdentityBar } from '../PatientIdentityBar';

describe('PatientIdentityBar', () => {
  it('患者識別帯の current 状態と補助情報をまとめて表示する', () => {
    render(
      <PatientIdentityBar
        eyebrow="患者マスタ / 監査"
        title="ORCA患者番号（Patient_ID） P-001"
        patientId="P-001"
        internalPatientId="local-123"
        patientName="山田 太郎"
        patientKana="ヤマダ タロウ"
        birthDateIso="1984-05-20"
        sex="男"
        age="42歳"
        acceptanceDate="2026-05-10"
        department="内科"
        physician="医師A"
        insuranceCombination="0001"
        orcaSourceLabel="ORCA patientgetv2"
        orcaFetchedAt="2026-05-10 09:10"
        orcaCacheStatus="fresh"
        note="最終受診 2026-01-08"
        selected
        chips={<StatusPill tone="warning" size="xs">編集ブロック中</StatusPill>}
      />,
    );

    const bar = screen.getByRole('region', { name: '患者識別帯' });
    expect(bar).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('heading', { name: 'ORCA患者番号（Patient_ID） P-001' })).toBeInTheDocument();
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.getByText('最終受診 2026-01-08')).toBeInTheDocument();
    expect(screen.getByText('編集ブロック中')).toBeInTheDocument();
    const medicalSafetyHeader = screen.getByLabelText('医療安全患者ヘッダー');
    expect(screen.getByText(/生年月日:/)).toBeInTheDocument();
    expect(screen.getByText(/1984-05-20/)).toBeInTheDocument();
    expect(medicalSafetyHeader).toHaveTextContent('内部参照ID');
    expect(medicalSafetyHeader).toHaveTextContent('local-123');
    expect(medicalSafetyHeader).toHaveTextContent('受付日');
    expect(medicalSafetyHeader).toHaveTextContent('2026-05-10');
    expect(medicalSafetyHeader).toHaveTextContent('診療科');
    expect(medicalSafetyHeader).toHaveTextContent('内科');
    expect(medicalSafetyHeader).toHaveTextContent('担当医');
    expect(medicalSafetyHeader).toHaveTextContent('医師A');
    expect(medicalSafetyHeader).toHaveTextContent('保険組合せ');
    expect(medicalSafetyHeader).toHaveTextContent('0001');
    expect(medicalSafetyHeader).toHaveTextContent('ORCA取得');
    expect(medicalSafetyHeader).toHaveTextContent('ORCA patientgetv2 / 2026-05-10 09:10 / fresh');
  });

  it('患者未選択でも壊れずに表示する', () => {
    render(<PatientIdentityBar eyebrow="受付登録" />);

    expect(screen.getByRole('heading', { name: '患者未選択' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '患者識別帯' })).toHaveAttribute('data-selected', 'false');
  });
});
