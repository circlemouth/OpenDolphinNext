import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-INPUTSET-TEST', traceId: 'TRACE-INPUTSET-TEST' })),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { fetchOrcaOrderInputSetDetail } from '../orcaOrderInputSetApi';

describe('orcaOrderInputSetApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchOrcaOrderInputSetDetail parses first-class rowRole/adminCode/sourceSetCode fields', async () => {
    vi.mocked(httpFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          runId: 'RUN-DETAIL',
          traceId: 'TRACE-DETAIL',
          setCode: 'R70001',
          bundle: {
            entity: 'radiologyOrder',
            sourceSetCode: 'R70001',
            bundleName: '胸部CTセット',
            bundleNumber: '3',
            classCode: '700',
            classCodeSystem: 'Claim007',
            className: '画像診断',
            admin: '適宜',
            adminCode: '4101',
            adminCodeSystem: 'Claim007',
            adminMemo: '撮影前確認',
            memo: '院内メモ',
            started: '2026-03-09',
            bodyPart: {
              code: '002001',
              name: '胸部',
              quantity: '1',
              unit: '部位',
              memo: '',
              rowRole: 'bodyPart',
            },
            items: [
              { code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '', rowRole: 'main' },
              {
                code: '700000001',
                name: '造影剤',
                quantity: '1',
                unit: '本',
                memo: '',
                rowRole: 'auxiliary',
                rowSubtype: 'contrastDrug',
              },
              { code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '注意', rowRole: 'comment' },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'x-trace-id': 'TRACE-DETAIL' },
        },
      ),
    );

    const result = await fetchOrcaOrderInputSetDetail({ setCode: 'R70001', entity: 'radiologyOrder', effective: '20260309' });

    expect(result.ok).toBe(true);
    expect(result.setCode).toBe('R70001');
    expect(result.bundle?.sourceSetCode).toBe('R70001');
    expect(result.bundle?.adminCode).toBe('4101');
    expect(result.bundle?.adminCodeSystem).toBe('Claim007');
    expect(result.bundle?.adminMemo).toBe('撮影前確認');
    expect(result.bundle?.bodyPart).toEqual(
      expect.objectContaining({ code: '002001', name: '胸部', rowRole: 'bodyPart' }),
    );
    expect(result.bundle?.items).toEqual([
      expect.objectContaining({ code: '170017510', rowRole: 'main' }),
      expect.objectContaining({ code: '700000001', rowRole: 'auxiliary', rowSubtype: 'contrastDrug' }),
      expect.objectContaining({ code: '0085001', rowRole: 'comment', memo: '注意' }),
    ]);
  });
});
