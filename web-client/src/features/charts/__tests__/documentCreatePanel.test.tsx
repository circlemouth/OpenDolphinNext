import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { DocumentCreatePanel } from '../DocumentCreatePanel';
import { logUiState } from '../../../libs/audit/auditLogger';
import { buildScopedStorageKey } from '../../../libs/session/storageScope';
import { AUTH_SESSION_STORAGE_KEY } from '../../../libs/session/authStorage';
import { IMAGE_ATTACHMENT_MAX_SIZE_BYTES, sendKarteDocumentWithAttachments } from '../../images/api';
import { recordChartsAuditEvent } from '../audit';
import {
  deleteLetter,
  fetchKarteIdByPatientId,
  fetchLetterDetail,
  fetchLetterList,
  saveLetterModule,
} from '../letterApi';

const openPrintDocument = vi.fn();

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/0001/charts',
    currentScreen: 'charts',
    fromCandidate: null,
    returnToCandidate: null,
    safeReturnToCandidate: null,
    carryover: {},
    external: {},
    encounter: {},
    openReception: vi.fn(),
    openPatients: vi.fn(),
    openCharts: vi.fn(),
    openOrderSets: vi.fn(),
    openPrintOutpatient: vi.fn(),
    openPrintDocument,
    openMobileImages: vi.fn(),
  }),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logUiState: vi.fn(),
}));

vi.mock('../audit', () => ({
  recordChartsAuditEvent: vi.fn(),
}));

vi.mock('../letterApi', () => ({
  fetchKarteIdByPatientId: vi.fn(),
  fetchLetterList: vi.fn(),
  fetchLetterDetail: vi.fn(),
  saveLetterModule: vi.fn(),
  deleteLetter: vi.fn(),
}));

vi.mock('../../images/api', async () => {
  const actual = await vi.importActual<typeof import('../../images/api')>('../../images/api');
  return {
    ...actual,
    sendKarteDocumentWithAttachments: vi.fn(),
  };
});

const makeLetter = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  patientId: 'P-100',
  letterType: 'client',
  consultantHospital: '東京クリニック',
  consultantDept: '内科',
  consultantDoctor: '山田太郎',
  title: '東京クリニック',
  recorded: '2026-01-03T00:00:00Z',
  ...overrides,
});

const makeReferralDetail = () =>
  makeLetter({
    letterItems: [
      { name: 'webTemplateId', value: 'REF-ODT-STD' },
      { name: 'webTemplateLabel', value: '標準紹介状' },
      { name: 'purpose', value: '精査依頼' },
      { name: 'disease', value: '高血圧' },
    ],
    letterTexts: [{ name: 'clinicalCourse', textValue: '既往歴と検査結果を記載' }],
  });

const makeReferralDetailWithAttachment = () =>
  makeLetter({
    letterItems: [
      { name: 'webTemplateId', value: 'REF-ODT-STD' },
      { name: 'webTemplateLabel', value: '標準紹介状' },
      { name: 'purpose', value: '精査依頼' },
      { name: 'disease', value: '高血圧' },
      { name: 'webAttachmentIds', value: '[901]' },
    ],
    letterTexts: [{ name: 'clinicalCourse', textValue: '既往歴と検査結果を記載' }],
  });

const makeCertificateDetail = () =>
  makeLetter({
    id: 2,
    letterType: 'medicalCertificate',
    title: '会社提出',
    letterItems: [
      { name: 'webTemplateId', value: 'CERT-ODT-STD' },
      { name: 'webTemplateLabel', value: '標準診断書' },
      { name: 'webSubmitTo', value: '会社提出' },
      { name: 'disease', value: '感冒' },
      { name: 'purpose', value: '勤務先提出' },
    ],
    letterTexts: [{ name: 'informedContent', textValue: '安静と投薬' }],
  });

const makeReplyDetail = () =>
  makeLetter({
    id: 3,
    letterType: 'consultant',
    title: '返信書',
    clientHospital: '紹介元病院',
    clientDept: '精神科',
    clientDoctor: '紹介医師',
    letterItems: [
      { name: 'webTemplateId', value: 'REPLY-ODT-STD' },
      { name: 'webTemplateLabel', value: '標準返信書' },
    ],
    letterTexts: [{ name: 'informedContent', textValue: '返信内容を記載' }],
  });

const baseProps = {
  patientId: 'P-100',
  meta: {
    runId: 'RUN-DOC',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
  },
};

const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.selectOptions(screen.getByLabelText('テンプレート *'), 'REF-ODT-STD');
  await user.type(screen.getByLabelText('宛先医療機関 *'), '東京クリニック');
  await user.type(screen.getByLabelText('宛先医師 *'), '山田太郎');
  await user.type(screen.getByLabelText('紹介目的 *'), '精査依頼');
  await user.type(screen.getByLabelText('主病名 *'), '高血圧');
  await user.type(screen.getByLabelText('紹介内容 *'), '既往歴と検査結果を記載');
};

beforeEach(() => {
  localStorage.setItem('devFacilityId', '0001');
  localStorage.setItem('devUserId', 'user01');
  sessionStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      facilityId: '0001',
      userId: 'user01',
      userPk: 101,
      role: 'doctor',
      runId: 'RUN-DOC',
      clientUuid: 'client-doc',
    }),
  );
  vi.mocked(fetchKarteIdByPatientId).mockResolvedValue({ ok: true, karteId: 201 });
  vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [] });
  vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: makeReferralDetail() });
  vi.mocked(saveLetterModule).mockResolvedValue({ ok: true, letterId: 1 });
  vi.mocked(deleteLetter).mockResolvedValue({ ok: true });
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  openPrintDocument.mockReset();
  vi.mocked(recordChartsAuditEvent).mockReset();
  vi.mocked(sendKarteDocumentWithAttachments).mockReset();
  vi.mocked(fetchKarteIdByPatientId).mockReset();
  vi.mocked(fetchLetterList).mockReset();
  vi.mocked(fetchLetterDetail).mockReset();
  vi.mocked(saveLetterModule).mockReset();
  vi.mocked(deleteLetter).mockReset();
});

describe('DocumentCreatePanel', () => {
  it('文書作成メニューとフォームが表示される', () => {
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );
    expect(screen.getByText('文書作成メニュー')).toBeInTheDocument();
    expect(screen.getByText('紹介状')).toBeInTheDocument();
    expect(screen.getByText('診断書')).toBeInTheDocument();
    expect(screen.getByText('返信書')).toBeInTheDocument();
    expect(screen.getByLabelText('テンプレート *')).toBeInTheDocument();
    expect(screen.getByLabelText('宛先医療機関 *')).toBeInTheDocument();
  });

  it('必須項目が未入力のときに警告を表示する', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/必須項目が未入力/)).toBeInTheDocument();
  });

  it('発行日が空のときに保存せず具体的な必須エラーを表示する', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );
    await fillRequiredFields(user);
    await user.clear(screen.getByLabelText('発行日 *'));

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(screen.getByText(/必須項目が未入力です: 発行日/)).toBeInTheDocument();
    expect(saveLetterModule).not.toHaveBeenCalled();
  });

  it('保存すると履歴に追加される', async () => {
    const user = userEvent.setup();
    const listSummary = makeLetter({ letterItems: [{ name: 'webTemplateId', value: 'REF-ODT-STD' }] });
    vi.mocked(fetchLetterList)
      .mockResolvedValueOnce({ ok: true, letters: [] })
      .mockResolvedValueOnce({ ok: true, letters: [listSummary] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: makeReferralDetail() });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/文書を保存しました/)).toBeInTheDocument();
    expect(screen.getByText('保存済み文書')).toBeInTheDocument();
    expect(screen.getAllByText('紹介状').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'プレビュー' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '印刷' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF出力' })).toBeInTheDocument();
  }, 15000);

  it('文書履歴の検索・フィルタが機能する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [makeReferralDetail(), makeCertificateDetail()] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: makeReferralDetail() });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    await screen.findByLabelText('文書種別フィルタ');
    await user.selectOptions(screen.getByLabelText('文書種別フィルタ'), 'certificate');
    const list = screen.getByRole('list');
    expect(within(list).getByText('会社提出')).toBeInTheDocument();
    expect(within(list).queryByText('東京クリニック')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('文書履歴の検索'), '会社');
    expect(within(list).getByText('会社提出')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('出力可否フィルタ'), 'available');
    expect(within(list).getByText('会社提出')).toBeInTheDocument();
  }, 15000);

  it('文書履歴取得失敗時は raw detail ではなく canonical copy を表示する', async () => {
    vi.mocked(fetchLetterList).mockResolvedValue({
      ok: false,
      status: 500,
      error: 'HTTP 500 (/odletter/list/201)',
      letters: [],
    });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('文書履歴の取得に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument();
  }, 15000);

  it('患者フィルタで選択患者のみがデフォルト表示される', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchLetterList).mockResolvedValue({
      ok: true,
      letters: [
        makeReferralDetail(),
        makeLetter({ id: 9, patientId: 'P-200', title: 'P-200-診断書', letterType: 'medicalCertificate' }),
      ],
    });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: makeReferralDetail() });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    await screen.findByText('東京クリニック');
    const list = screen.getByRole('list');
    expect(within(list).getByText('東京クリニック')).toBeInTheDocument();
    expect(within(list).queryByText('P-200-診断書')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('患者フィルタ'), 'all');
    expect(within(list).getByText('P-200-診断書')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('患者フィルタ'), 'current');
    expect(within(list).queryByText('P-200-診断書')).not.toBeInTheDocument();
  });

  it('履歴からコピーして編集できる', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [makeCertificateDetail()] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: makeCertificateDetail() });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'コピーして編集' });
    await user.click(screen.getByRole('button', { name: 'コピーして編集' }));
    expect(screen.getByLabelText('提出先 *')).toHaveValue('会社提出');
    expect(screen.getByLabelText('診断名 *')).toHaveValue('感冒');
    expect(screen.getByLabelText('用途 *')).toHaveValue('勤務先提出');
    expect(screen.getByLabelText('所見 *')).toHaveValue('安静と投薬');
    expect(screen.getByLabelText('テンプレート *')).toHaveValue('CERT-ODT-STD');
  });

  it('中断で入力を破棄して閉じる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} onClose={onClose} />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('宛先医療機関 *'), 'テスト病院');
    await user.click(screen.getByRole('button', { name: '中断' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('入力を中断しました。')).toBeInTheDocument();
  });

  it('テンプレ選択でUIログを記録する', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );
    await user.selectOptions(screen.getByLabelText('テンプレート *'), 'REF-ODT-STD');
    const mocked = vi.mocked(logUiState);
    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'scenario_change',
        screen: 'charts/document-create',
        controlId: 'document-template',
        details: expect.objectContaining({
          templateId: 'REF-ODT-STD',
        }),
      }),
    );
  });

  it('文書出力の成功結果を履歴とトーストへ反映する', async () => {
    const listSummary = makeReferralDetail();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [listSummary] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: listSummary });

    const outputKey = buildScopedStorageKey(
      'opendolphin:web-client:charts:printResult:document',
      'v2',
      { facilityId: '0001', userId: 'user01' },
    );
    if (outputKey) {
      sessionStorage.setItem(
        outputKey,
        JSON.stringify({
          documentId: 'letter-1',
          outcome: 'success',
          mode: 'print',
          at: '2026-01-03T00:00:00Z',
          detail: 'output=print afterprint',
          runId: 'RUN-DOC',
          traceId: 'TRACE-1',
          endpoint: 'window.print',
          httpStatus: 200,
        }),
      );
    }
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );
    await screen.findByText(/文書出力成功/);
    const list = await screen.findByRole('list');
    expect(within(list).getByText(/監査結果: 成功/)).toBeInTheDocument();
  });

  it('文書出力の失敗結果で監査フィルタと復旧導線が表示される', async () => {
    const listSummary = makeCertificateDetail();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [listSummary] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: listSummary });

    const outputKey = buildScopedStorageKey(
      'opendolphin:web-client:charts:printResult:document',
      'v2',
      { facilityId: '0001', userId: 'user01' },
    );
    if (outputKey) {
      sessionStorage.setItem(
        outputKey,
        JSON.stringify({
          documentId: 'letter-2',
          outcome: 'failed',
          mode: 'pdf',
          at: '2026-01-03T00:00:00Z',
          detail: '印刷ダイアログの起動に失敗しました。',
          runId: 'RUN-DOC',
          traceId: 'TRACE-2',
          endpoint: 'window.print',
          httpStatus: 0,
        }),
      );
    }
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );
    await screen.findByLabelText('監査結果フィルタ');
    await user.selectOptions(screen.getByLabelText('監査結果フィルタ'), 'failed');
    const list = screen.getByRole('list');
    expect(within(list).getByText('会社提出')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /再出力/ })).toBeInTheDocument();
  });

  it('監査結果フィルタで処理中/未実行を絞り込める', async () => {
    const pendingLetter = makeReferralDetail();
    const successLetter = makeCertificateDetail();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [pendingLetter, successLetter] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: pendingLetter });

    const outputKey = buildScopedStorageKey(
      'opendolphin:web-client:charts:printResult:document',
      'v2',
      { facilityId: '0001', userId: 'user01' },
    );
    if (outputKey) {
      sessionStorage.setItem(
        outputKey,
        JSON.stringify({
          documentId: 'letter-2',
          outcome: 'success',
          mode: 'print',
          at: '2026-01-03T00:00:00Z',
          detail: 'output=print afterprint',
          runId: 'RUN-DOC',
        }),
      );
    }
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    await screen.findByLabelText('監査結果フィルタ');
    await user.selectOptions(screen.getByLabelText('監査結果フィルタ'), 'pending');
    const list = screen.getByRole('list');
    expect(within(list).getByText('東京クリニック')).toBeInTheDocument();
    expect(within(list).queryByText('会社提出')).not.toBeInTheDocument();
  });

  it('添付付き保存成功時に監査ログが欠落せず記録される', async () => {
    const user = userEvent.setup();
    const attachment = {
      id: 901,
      fileName: 'xray.png',
      contentType: 'image/png',
      contentSize: 1024,
    };
    vi.mocked(sendKarteDocumentWithAttachments).mockResolvedValue({
      ok: true,
      status: 200,
      endpoint: '/karte/document',
      docPk: 2001,
      payload: { docPk: 2001 },
    });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} imageAttachments={[attachment]} />
      </MemoryRouter>,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存' }));

    const events = vi.mocked(recordChartsAuditEvent).mock.calls.map((call) => call[0]);
    const attachEvents = events.filter((event) => event.action === 'chart_image_attach');
    expect(attachEvents).toHaveLength(1);
    expect(attachEvents[0]?.outcome).toBe('success');
    const savedPayload = vi.mocked(saveLetterModule).mock.calls.at(-1)?.[0] as { payload?: { letterItems?: Array<{ name?: string; value?: string }> } };
    const documentIdItem = savedPayload.payload?.letterItems?.find((item) => item.name === 'webDocumentId');
    expect(documentIdItem?.value).toBe('2001');
  });

  it('添付サイズ超過は aria-live で通知し監査ログを残す', async () => {
    const user = userEvent.setup();
    const attachment = {
      id: 902,
      fileName: 'large.png',
      contentType: 'image/png',
      contentSize: IMAGE_ATTACHMENT_MAX_SIZE_BYTES + 1,
    };

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} imageAttachments={[attachment]} />
      </MemoryRouter>,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存' }));

    const notice = screen.getByRole('alert');
    expect(notice).toHaveAttribute('aria-live', 'assertive');
    expect(screen.queryByRole('button', { name: '再送' })).toBeNull();

    const events = vi.mocked(recordChartsAuditEvent).mock.calls.map((call) => call[0]);
    const attachEvents = events.filter((event) => event.action === 'chart_image_attach');
    expect(attachEvents).toHaveLength(1);
    expect(attachEvents[0]?.outcome).toBe('blocked');
  });

  it('保存失敗時のみ再送ボタンが有効になる', async () => {
    const user = userEvent.setup();
    const attachment = {
      id: 903,
      fileName: 'xray.png',
      contentType: 'image/png',
      contentSize: 1024,
    };
    vi.mocked(sendKarteDocumentWithAttachments).mockResolvedValue({
      ok: false,
      status: 500,
      endpoint: '/karte/document',
      docPk: -1,
      error: 'HTTP 500',
    });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} imageAttachments={[attachment]} />
      </MemoryRouter>,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存' }));

    const retryButton = screen.getByRole('button', { name: '再送' });
    expect(retryButton).toBeEnabled();
    expect(screen.getByText('添付付き保存が失敗した場合のみ再送できます。')).toBeInTheDocument();

    const events = vi.mocked(recordChartsAuditEvent).mock.calls.map((call) => call[0]);
    const attachEvents = events.filter((event) => event.action === 'chart_image_attach');
    expect(attachEvents).toHaveLength(1);
    expect(attachEvents[0]?.outcome).toBe('error');
  });

  it('添付 document 成功後に letter 保存が失敗しても入力を残し、再送で document を二重作成しない', async () => {
    const user = userEvent.setup();
    const attachment = {
      id: 904,
      fileName: 'letter-xray.png',
      contentType: 'image/png',
      contentSize: 1024,
    };
    const onImageAttachmentsClear = vi.fn();
    vi.mocked(sendKarteDocumentWithAttachments).mockResolvedValue({
      ok: true,
      status: 200,
      endpoint: '/karte/document',
      docPk: 3001,
      payload: { docPk: 3001 },
    });
    vi.mocked(saveLetterModule)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        endpoint: '/odletter/letter',
        error: 'サーバーエラーが発生しました。時間をおいて再試行してください。',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        endpoint: '/odletter/letter',
        letterId: 44,
      });

    render(
      <MemoryRouter>
        <DocumentCreatePanel
          {...baseProps}
          imageAttachments={[attachment]}
          onImageAttachmentsClear={onImageAttachmentsClear}
        />
      </MemoryRouter>,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/カルテ文書保存は完了しました/)).toBeInTheDocument();
    expect(screen.getByText(/紹介状モジュール保存失敗/)).toBeInTheDocument();
    expect(screen.queryByText(/\/karte\/document|\/odletter\/letter/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('宛先医療機関 *')).toHaveValue('東京クリニック');
    expect(screen.getByLabelText('紹介内容 *')).toHaveValue('既往歴と検査結果を記載');
    expect(screen.getByText(/letter-xray\.png/)).toBeInTheDocument();
    expect(onImageAttachmentsClear).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '再送' }));

    expect(sendKarteDocumentWithAttachments).toHaveBeenCalledTimes(1);
    expect(saveLetterModule).toHaveBeenCalledTimes(2);
    const retryPayload = vi.mocked(saveLetterModule).mock.calls.at(-1)?.[0] as {
      payload?: { letterItems?: Array<{ name?: string; value?: string }> };
    };
    expect(retryPayload.payload?.letterItems?.find((item) => item.name === 'webDocumentId')?.value).toBe('3001');
    expect(retryPayload.payload?.letterItems?.find((item) => item.name === 'webAttachmentIds')?.value).toBe('[904]');
    expect(await screen.findByText(/画像参照 1 件を関連付けました/)).toBeInTheDocument();
    expect(onImageAttachmentsClear).toHaveBeenCalledTimes(1);
  }, 15000);

  it('カルテ文書保存失敗は phase と safe copy を表示し raw detail を出さない', async () => {
    const user = userEvent.setup();
    const attachment = {
      id: 905,
      fileName: 'unsafe-detail.png',
      contentType: 'image/png',
      contentSize: 1024,
    };
    vi.mocked(sendKarteDocumentWithAttachments).mockResolvedValue({
      ok: false,
      status: 500,
      endpoint: '/karte/document',
      docPk: -1,
      error: 'java.lang.IllegalStateException: s3://internal-bucket failed',
    });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} imageAttachments={[attachment]} />
      </MemoryRouter>,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/カルテ文書保存失敗/)).toBeInTheDocument();
    expect(screen.getByText(/カルテ文書の保存に失敗しました。時間をおいて再試行してください。/)).toBeInTheDocument();
    expect(screen.queryByText(/java\.lang|s3:\/\/internal-bucket/)).not.toBeInTheDocument();
    expect(screen.queryByText('入力内容を確認してください')).not.toBeInTheDocument();
  }, 15000);

  it('設定不足は入力不備と分けて表示する', async () => {
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(screen.getByText(/設定不足: ユーザー情報が取得できないため文書を保存できません。/)).toBeInTheDocument();
    expect(screen.queryByText('入力内容を確認してください')).not.toBeInTheDocument();
  }, 15000);

  it('編集と削除の導線が表示される', async () => {
    const listSummary = makeReplyDetail();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [listSummary] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: listSummary });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '文書履歴参照を削除' })).toBeInTheDocument();
  });

  it('画像参照付き文書はコピー編集と編集を fail-close する', async () => {
    const listSummary = makeReferralDetailWithAttachment();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [listSummary] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: listSummary });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/画像参照付き文書は現契約では安全に再編集できません/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'コピーして編集' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '編集' })).toBeDisabled();
  });

  it('文書プレビュー遷移で preview state を sessionStorage に保存しない', async () => {
    const listSummary = makeReferralDetail();
    vi.mocked(fetchLetterList).mockResolvedValue({ ok: true, letters: [listSummary] });
    vi.mocked(fetchLetterDetail).mockResolvedValue({ ok: true, letter: listSummary });

    render(
      <MemoryRouter>
        <DocumentCreatePanel {...baseProps} />
      </MemoryRouter>,
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: 'プレビュー' }));

    expect(openPrintDocument).toHaveBeenCalledTimes(1);
    expect(
      sessionStorage.getItem(
        buildScopedStorageKey(
          'opendolphin:web-client:charts:printPreview:document',
          'v2',
          { facilityId: '0001', userId: 'user01' },
        ) ?? '',
      ),
    ).toBeNull();
  });
});
