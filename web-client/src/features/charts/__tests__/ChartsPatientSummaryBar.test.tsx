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
  visitDate: '2026-04-17',
  encounterStatus: '診療中',
  receptionId: 'R-001',
  appointmentId: 'A-001',
  department: '内科',
  physician: '医師A',
  runId: 'RUN-CHARTS',
};

describe('ChartsPatientSummaryBar', () => {
  it('患者サマリーを ORCA 患者ID中心のコンパクト表示にする', () => {
    const { container } = render(
      <ChartsPatientSummaryBar
        {...baseProps}
        patientDisplay={{
          ...baseProps.patientDisplay,
          note: undefined,
        }}
      />,
    );

    const summary = container.querySelector('.charts-patient-summary');
    expect(summary).not.toBeNull();
    expect(summary).toHaveTextContent('患者ID: 000001');
    expect(summary).toHaveTextContent('2026-04-17');
    expect(summary).toHaveTextContent('診療中');
    expect(summary).toHaveTextContent('内科 / 医師A');
    expect(summary).toHaveTextContent('男');
    expect(summary).toHaveTextContent('45歳6ヶ月');
    expect(summary).toHaveTextContent('1980-05-20');
    expect(summary).toHaveTextContent('〒100-0001');
    expect(summary).toHaveTextContent('東京都千代田区千代田1-1');
    expect(summary).not.toHaveTextContent('受付ID');
    expect(summary).not.toHaveTextContent('予約ID');
    expect(summary).not.toHaveTextContent('R-001');
    expect(summary).not.toHaveTextContent('A-001');
    expect(summary).not.toHaveTextContent('CHARTS');

    const profileIcon = container.querySelector('.charts-patient-summary__profile-icon');
    expect(profileIcon).toHaveAttribute('data-sex-tone', 'male');
    expect(profileIcon).toHaveAttribute('data-age-group', 'adult');
  });

  it('note があるときだけ患者メモを表示する', () => {
    const { container } = render(<ChartsPatientSummaryBar {...baseProps} />);

    const summary = container.querySelector('.charts-patient-summary');
    expect(summary).toHaveTextContent('転倒歴あり。採血時は左腕を優先。');
    expect(screen.getByRole('heading', { name: '患者メモ' })).toBeInTheDocument();
  });

  it('住所と郵便番号は details ではなく閉じた補助情報としてまとめる', () => {
    const { container } = render(
      <ChartsPatientSummaryBar
        {...baseProps}
        patientDisplay={{
          ...baseProps.patientDisplay,
          note: undefined,
        }}
      />,
    );

    const summary = container.querySelector('.charts-patient-summary');
    expect(summary).toHaveTextContent('東京都千代田区千代田1-1');
    expect(summary).toHaveTextContent('〒100-0001');
    expect(screen.queryByRole('button', { name: '詳細' })).toBeNull();
  });

  it('data source transition is telemetry only and is not shown as a patient chip', () => {
    const { container } = render(
      <ChartsPatientSummaryBar
        {...baseProps}
        dataSourceTransition="server"
        patientDisplay={{
          ...baseProps.patientDisplay,
          note: undefined,
        }}
      />,
    );

    const summary = container.querySelector('.charts-patient-summary');
    expect(summary).toHaveAttribute('data-source-transition', 'server');
    expect(summary).not.toHaveTextContent('server');
  });

  it('ORCA参照不足と暫定参照は患者ヘッダー上の alert として表示する', () => {
    const { container } = render(
      <ChartsPatientSummaryBar
        {...baseProps}
        missingMaster
        fallbackUsed
        patientDisplay={{
          ...baseProps.patientDisplay,
          note: undefined,
        }}
      />,
    );

    const alert = screen.getByTestId('charts-patient-summary-source-alert');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('ORCA正本確認が必要');
    expect(alert).toHaveTextContent('ORCA参照不足と暫定参照です。ORCA送信・会計送信前に受付で再取得してください。');
    expect(alert.closest('details')).toBeNull();

    const summary = container.querySelector('.charts-patient-summary');
    expect(summary).toHaveTextContent('ORCA参照不足');
    expect(summary).toHaveTextContent('暫定参照');
  });
});
