import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-SUBJECTIVES-BOUNDARY' })),
  resolveAriaLive: vi.fn(() => 'polite'),
  resolveRunId: vi.fn((runId?: string) => runId ?? 'RUN-SUBJECTIVES-BOUNDARY'),
  resolveTraceId: vi.fn((traceId?: string) => traceId ?? 'TRACE-SUBJECTIVES-BOUNDARY'),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { SubjectivesPanel } from '../soap/SubjectivesPanel';
import { postChartSubjectiveEntry } from '../soap/subjectiveChartApi';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(httpFetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        apiResult: '00',
        apiResultMessage: '処理終了',
        runId: 'RUN-SUBJECTIVES-LOCAL',
        recordedAt: '2026-04-10T00:00:00Z',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ),
  );
});

afterEach(() => {
  cleanup();
});

describe('SOAP subjectives ORCA boundary', () => {
  it('posts local SOAP subjectives only to /api/local and never to ORCA subjectivesv2', async () => {
    const result = await postChartSubjectiveEntry({
      patientId: 'P-SUBJECTIVE-001',
      performDate: '2026-04-10',
      soapCategory: 'S',
      physicianCode: 'DR-001',
      body: '主観情報',
    });

    expect(result.ok).toBe(true);
    expect(result.runId).toBe('RUN-SUBJECTIVES-LOCAL');
    expect(httpFetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(httpFetch).mock.calls[0] ?? [];
    expect(url).toBe('/api/local/charts/subjectives');
    expect(String(url)).not.toContain('/api/orca');
    expect(String(url)).not.toContain('subjectivesv2');
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      patientId: 'P-SUBJECTIVE-001',
      performDate: '2026-04-10',
      soapCategory: 'S',
      physicianCode: 'DR-001',
      body: '主観情報',
    });
  });

  it('keeps SubjectivesPanel wording on the local SOAP boundary', () => {
    render(<SubjectivesPanel patientId="P-SUBJECTIVE-001" visitDate="2026-04-10" runId="RUN-SUBJECTIVES-BOUNDARY" />);

    expect(screen.getByText('症状詳記の専用入力は廃止しました。必要な補足は院内ローカル SOAP 入力で扱います。')).toBeInTheDocument();
    expect(screen.queryByText(/subjectivesv2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ORCAへ反映|今すぐ同期/)).not.toBeInTheDocument();
  });
});
