import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChartsPatientSummaryBar } from '../ChartsPatientSummaryBar';

const baseProps = {
  patientDisplay: {
    name: '山田 太郎',
    kana: 'ヤマダ タロウ',
    sex: '男',
    age: '45歳6ヶ月',
    birthDateIso: '1980-05-20',
    zip: '100-0001',
    address: '東京都千代田区千代田1-1',
    note: '転倒歴あり。採血時は左腕を優先。',
  },
  patientId: '000001',
  runId: 'RUN-CHARTS',
};

describe('ChartsPatientSummaryBar', () => {
  it('note が空のときは患者メモパネルを表示しない', () => {
    render(
      <ChartsPatientSummaryBar
        {...baseProps}
        patientDisplay={{
          ...baseProps.patientDisplay,
          note: undefined,
        }}
      />,
    );

    expect(screen.getByRole('button', { name: '診察開始' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '患者メモ' })).toBeNull();
    expect(screen.queryByText('患者メモなし')).toBeNull();
    const identityBar = screen.getByRole('region', { name: '患者識別帯' });
    expect(identityBar).toHaveTextContent('1980-05-20');
    expect(identityBar).toHaveTextContent('〒100-0001');
    expect(identityBar).toHaveTextContent('東京都千代田区千代田1-1');
  });

  it('note があるときは識別帯の supporting copy に集約表示する', () => {
    render(<ChartsPatientSummaryBar {...baseProps} />);

    const identityBar = screen.getByRole('region', { name: '患者識別帯' });
    expect(identityBar).toHaveTextContent('転倒歴あり。採血時は左腕を優先。');
    expect(identityBar).toHaveTextContent('患者ID: 000001');
  });

  it('住所と郵便番号は識別帯の supporting copy に統合表示する', () => {
    render(
      <ChartsPatientSummaryBar
        {...baseProps}
        patientDisplay={{
          ...baseProps.patientDisplay,
          note: undefined,
        }}
      />,
    );

    const identityBar = screen.getByRole('region', { name: '患者識別帯' });
    expect(identityBar).toHaveTextContent('東京都千代田区千代田1-1');
    expect(identityBar).toHaveTextContent('〒100-0001');
    expect(screen.queryByRole('button', { name: '詳細' })).toBeNull();
  });
});
