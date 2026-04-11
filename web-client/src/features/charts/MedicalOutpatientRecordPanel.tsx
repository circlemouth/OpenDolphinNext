import { useMemo } from 'react';

import type { OrcaOutpatientSummary } from '../outpatient/types';
import { resolveAriaLive, resolveRunId } from '../../libs/observability/observability';
import { ApiFailureBanner } from '../shared/ApiFailureBanner';
import { StatusBadge } from '../shared/StatusBadge';
import { extractMedicalOutpatientRecord, toOutcomeLabel, toOutcomeTone, type MedicalSectionState } from './medicalOutpatient';

export type MedicalOutpatientRecordPanelProps = {
  summary?: OrcaOutpatientSummary;
  selectedPatientId?: string;
};

const formatSectionMeta = (section: MedicalSectionState): string => {
  const count = section.recordsReturned ?? (section.items.length > 0 ? section.items.length : undefined);
  const suffix = count !== undefined ? ` (${count}件)` : '';
  if (section.outcome === 'ERROR' && section.message) return `エラー: ${section.message}${suffix}`;
  if (section.outcome === 'MISSING') return `未取得${suffix}`;
  if (section.outcome === 'PARTIAL') return `一部欠落${suffix}`;
  if (section.outcome === 'SUCCESS') return `取得済み${suffix}`;
  return `不明${suffix}`;
};

export function MedicalOutpatientRecordPanel({ summary, selectedPatientId }: MedicalOutpatientRecordPanelProps) {
  const record = useMemo(
    () => extractMedicalOutpatientRecord(summary?.payload, selectedPatientId),
    [selectedPatientId, summary?.payload],
  );
  const resolvedRunId = resolveRunId(summary?.runId);
  const infoLive = resolveAriaLive('info');

  if (!summary) {
    return (
      <section className="medical-record" aria-live={infoLive} data-test-id="medical-record-panel">
        <header className="medical-record__header">
          <strong>ローカル医療サマリ</strong>
        </header>
        <p className="medical-record__empty">ローカル医療サマリを取得中です。</p>
      </section>
    );
  }

  if (!record) {
    const httpStatus = summary.httpStatus;
    const hasFetchError = httpStatus === 0 || (typeof httpStatus === 'number' && httpStatus >= 400) || summary.outcome === 'ERROR';
    if (hasFetchError) {
      const httpLabel = httpStatus === 0 ? 'NETWORK' : typeof httpStatus === 'number' ? `HTTP ${httpStatus}` : 'UNKNOWN';
      const errorContext = {
        error: summary.outcome === 'ERROR' && !httpStatus ? `outcome=${summary.outcome}` : undefined,
        httpStatus,
        outcome: summary.outcome,
      };
      return (
        <section
          className="medical-record"
          aria-live={resolveAriaLive('error')}
          data-test-id="medical-record-panel"
          data-run-id={resolvedRunId}
        >
          <header className="medical-record__header">
            <strong>ローカル医療サマリ</strong>
            <span className="medical-record__meta">
              outcome: {summary.outcome ?? 'ERROR'} / recordsReturned: {summary.recordsReturned ?? '—'} / {httpLabel}
            </span>
          </header>
          <ApiFailureBanner
            subject="ローカル医療サマリ"
            destination="local-summary"
            runId={summary.runId}
            traceId={summary.traceId}
            apiResult={summary.apiResult}
            apiResultMessage={summary.apiResultMessage}
            nextAction="ローカル医療サマリを再取得"
            {...errorContext}
          />
        </section>
      );
    }
    return (
      <section className="medical-record" aria-live={infoLive} data-test-id="medical-record-panel">
        <header className="medical-record__header">
          <strong>ローカル医療サマリ</strong>
          <span className="medical-record__meta">recordsReturned: {summary.recordsReturned ?? '—'}</span>
        </header>
        <p className="medical-record__empty">
          表示対象のローカル医療サマリが見つかりません（patientId={selectedPatientId ?? '未選択'}）。
        </p>
      </section>
    );
  }

  const recordTone = toOutcomeTone(record.outcome);
  const ariaLive = resolveAriaLive(recordTone, record.outcome === 'SUCCESS' ? 'off' : undefined);

  return (
    <section className="medical-record" aria-live={ariaLive} data-test-id="medical-record-panel" data-run-id={resolvedRunId}>
      <header className="medical-record__header">
        <div className="medical-record__title">
          <strong>ローカル医療サマリ</strong>
          <span className="medical-record__meta">
            {record.patientName ?? '氏名未設定'}
            {record.patientId ? `（${record.patientId}）` : ''}
            {record.department ? ` / ${record.department}` : ''}
            {record.physician ? ` / ${record.physician}` : ''}
          </span>
        </div>
        <div className="medical-record__badges">
          <StatusBadge
            label="outcome"
            value={toOutcomeLabel(record.outcome)}
            tone={toOutcomeTone(record.outcome)}
            description="ローカル医療サマリの取得結果（セクション集計）"
            ariaLive="off"
            runId={summary.runId}
          />
          <StatusBadge
            label="recordsReturned"
            value={String(summary.recordsReturned ?? record.recordsReturned ?? '—')}
            tone={summary.recordsReturned && summary.recordsReturned > 0 ? 'info' : 'warning'}
            description="ローカル医療サマリ（visit/encounter）件数"
            ariaLive="off"
            runId={summary.runId}
          />
          {summary.requestId && (
            <StatusBadge
              label="requestId"
              value={summary.requestId}
              tone="info"
              description="サーバー側 requestId"
              ariaLive="off"
              runId={summary.runId}
            />
          )}
        </div>
      </header>

      <div className="medical-record__sections">
        {record.sections.map((section) => (
          <details key={section.key} className="medical-record__section" open={section.outcome !== 'MISSING'}>
            <summary className="medical-record__section-summary">
              <span className="medical-record__section-title">{section.label}</span>
              <span className="medical-record__section-meta">{formatSectionMeta(section)}</span>
            </summary>
            {section.items.length === 0 ? (
              <p className="medical-record__section-empty">
                {section.outcome === 'ERROR'
                  ? '取得に失敗しました。再取得を試してください。'
                  : section.outcome === 'MISSING'
                    ? '未取得です。'
                    : '該当データがありません。'}
              </p>
            ) : (
              <ul className="medical-record__section-list">
                {section.items.map((item, index) => (
                  <li key={`${section.key}-${index}`} className="medical-record__item">
                    <div className="medical-record__item-headline">{item.headline}</div>
                    {(item.subline || item.meta) && (
                      <div className="medical-record__item-sub">
                        {item.subline ?? ''}
                        {item.subline && item.meta ? ' / ' : ''}
                        {item.meta ?? ''}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
