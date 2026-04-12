import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MedicalOutpatientRecordPanel } from '../MedicalOutpatientRecordPanel';

vi.mock('../shared/ApiFailureBanner', () => ({
  ApiFailureBanner: ({
    subject,
    destination,
    nextAction,
  }: {
    subject: string;
    destination: string;
    nextAction: string;
  }) => <div>{`${subject} / ${destination} / ${nextAction}`}</div>,
}));

vi.mock('../../reception/components/ToneBanner', () => ({
  ToneBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('../../../libs/ui/appToast', () => ({
  useAppToast: () => ({ enqueue: vi.fn() }),
}));

describe('MedicalOutpatientRecordPanel', () => {
  it('200 SUCCESS を描画する', () => {
    render(
      <MedicalOutpatientRecordPanel
        selectedPatientId="00001"
        summary={{
          runId: 'RUN-1',
          requestId: 'req-1',
          recordsReturned: 1,
          outcome: 'SUCCESS',
          payload: {
            outpatientList: [
              {
                encounterKey: 'F001:E100',
                patient: { patientId: '00001', wholeName: 'テスト患者' },
                department: '内科',
                physician: '主治医',
                recordsReturned: 2,
                outcome: 'SUCCESS',
                sections: {
                  diagnosis: { outcome: 'SUCCESS', recordsReturned: 1, items: [{ name: '高血圧症', code: 'I10' }] },
                  prescription: { outcome: 'SUCCESS', recordsReturned: 1, items: [{ name: 'アムロジピン', dose: '5mg' }] },
                  lab: { outcome: 'SUCCESS', recordsReturned: 0, items: [] },
                  procedure: { outcome: 'SUCCESS', recordsReturned: 0, items: [] },
                  memo: { outcome: 'SUCCESS', recordsReturned: 1, items: [{ text: '診療メモ' }] },
                },
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('テスト患者（00001） / 内科 / 主治医')).toBeInTheDocument();
    expect(screen.getByText('高血圧症（I10）')).toBeInTheDocument();
    expect(screen.getByText('アムロジピン')).toBeInTheDocument();
  });

  it('院内ローカル診療サマリとして描画する', () => {
    render(<MedicalOutpatientRecordPanel selectedPatientId="00001" summary={undefined} />);

    expect(screen.getByText('院内ローカル診療サマリ')).toBeInTheDocument();
    expect(screen.getByText('院内ローカル診療サマリを取得中です。')).toBeInTheDocument();
    expect(screen.queryByText('ORCA診療サマリ')).not.toBeInTheDocument();
  });

  it('200 MISSING では empty state を描画する', () => {
    render(
      <MedicalOutpatientRecordPanel
        selectedPatientId="00001"
        summary={{
          recordsReturned: 0,
          outcome: 'MISSING',
          payload: {
            outpatientList: [],
          },
        }}
      />,
    );

    expect(screen.getByText(/表示対象の院内ローカル診療サマリが見つかりません/)).toBeInTheDocument();
  });

  it('200 PARTIAL では一部欠落を表示する', () => {
    render(
      <MedicalOutpatientRecordPanel
        selectedPatientId="00001"
        summary={{
          recordsReturned: 1,
          outcome: 'PARTIAL',
          payload: {
            outpatientList: [
              {
                encounterKey: 'F001:E100',
                patient: { patientId: '00001', wholeName: 'テスト患者' },
                recordsReturned: 1,
                outcome: 'PARTIAL',
                sections: {
                  diagnosis: { outcome: 'SUCCESS', recordsReturned: 1, items: [{ name: '高血圧症' }] },
                  prescription: { outcome: 'MISSING', recordsReturned: 0, items: [] },
                  lab: { outcome: 'MISSING', recordsReturned: 0, items: [] },
                  procedure: { outcome: 'MISSING', recordsReturned: 0, items: [] },
                  memo: { outcome: 'MISSING', recordsReturned: 0, items: [] },
                },
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('一部欠落')).toBeInTheDocument();
  });

  it.each([404, 409, 503])('HTTP %s では error banner を描画する', (httpStatus) => {
    render(
      <MedicalOutpatientRecordPanel
        selectedPatientId="00001"
        summary={{
          runId: 'RUN-ERR',
          traceId: 'TRACE-ERR',
          httpStatus,
          outcome: 'ERROR',
          recordsReturned: 0,
          payload: {
            outpatientList: [],
          },
        }}
      />,
    );

    expect(screen.getAllByText(new RegExp(`HTTP ${httpStatus}`)).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        httpStatus === 404 ? /院内ローカル診療サマリが見つかりませんでした/ : /院内ローカル診療サマリの取得に失敗しました/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('院内ローカル診療サマリの操作')).toBeInTheDocument();
  });
});
