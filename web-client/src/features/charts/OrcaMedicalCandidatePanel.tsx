import { useMemo, useRef, useState } from 'react';

import { resolveAriaLive } from '../../libs/observability/observability';
import {
  prepareOrcaMedicalCandidateFromChart,
  type OrcaMedicalCandidateResponse,
} from './orcaMedicalCandidateApi';

export type OrcaMedicalCandidatePanelProps = {
  chartRevisionId?: string;
  patientName?: string;
  patientId?: string;
  visitDate?: string;
  receptionId?: string;
  appointmentId?: string;
  department?: string;
  physician?: string;
  insuranceCombinationNumber?: string;
  disabled?: boolean;
  disabledReason?: string;
  onPrepared?: (candidate: OrcaMedicalCandidateResponse) => void;
};

const display = (value?: string | number | null) => {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  return text || '—';
};

export function OrcaMedicalCandidatePanel({
  chartRevisionId,
  patientName,
  patientId,
  visitDate,
  receptionId,
  appointmentId,
  department,
  physician,
  insuranceCombinationNumber,
  disabled = false,
  disabledReason,
  onPrepared,
}: OrcaMedicalCandidatePanelProps) {
  const [candidate, setCandidate] = useState<OrcaMedicalCandidateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const normalizedChartRevisionId = chartRevisionId?.trim();
  const blockedReason = useMemo(() => {
    if (disabled) return disabledReason ?? '候補作成は現在停止中です。';
    if (!normalizedChartRevisionId) return '診療録リビジョンが未確定のため候補を作成できません。';
    return null;
  }, [disabled, disabledReason, normalizedChartRevisionId]);

  const handlePrepare = async () => {
    if (blockedReason || !normalizedChartRevisionId || running) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunning(true);
    setError(null);
    try {
      const next = await prepareOrcaMedicalCandidateFromChart({
        chartRevisionId: normalizedChartRevisionId,
        signal: abortRef.current.signal,
      });
      setCandidate(next);
      if (!next.ok) {
        setError(next.message ?? '診療行為送信候補の作成に失敗しました。');
        return;
      }
      onPrepared?.(next);
    } catch (cause) {
      const aborted = cause instanceof DOMException ? cause.name === 'AbortError' : false;
      setError(aborted ? '候補作成を中断しました。' : '診療行為送信候補の作成に失敗しました。');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const totalMedications = candidate?.medicalInformation.reduce((sum, item) => sum + (item.medications?.length ?? 0), 0) ?? 0;

  return (
    <section className="orca-medical-candidate" aria-label="診療行為送信候補の確認">
      <header className="orca-medical-candidate__header">
        <div>
          <p className="orca-medical-candidate__kicker">処方から診療行為候補</p>
          <h3>送信前確認</h3>
        </div>
        <span
          className={`orca-medical-candidate__status orca-medical-candidate__status--${
            candidate?.sendable ? 'ready' : candidate ? 'review' : 'idle'
          }`}
        >
          {candidate ? `${display(candidate.candidateStatus)} / ${candidate.sendable ? '送信候補' : '要確認'}` : '未作成'}
        </span>
      </header>
      <dl className="orca-medical-candidate__context" aria-label="確認対象">
        <div>
          <dt>患者</dt>
          <dd>{display(patientName)} / {display(patientId)}</dd>
        </div>
        <div>
          <dt>受付</dt>
          <dd>{display(receptionId)} / {display(appointmentId)}</dd>
        </div>
        <div>
          <dt>診療日</dt>
          <dd>{display(visitDate)}</dd>
        </div>
        <div>
          <dt>診療科</dt>
          <dd>{display(department)}</dd>
        </div>
        <div>
          <dt>医師</dt>
          <dd>{display(physician)}</dd>
        </div>
        <div>
          <dt>保険組合せ</dt>
          <dd>{display(insuranceCombinationNumber)}</dd>
        </div>
      </dl>
      <p className="orca-medical-candidate__note">
        候補は処方正本から作成する院内確認用です。ORCA正本ではなく、この操作ではORCA送信しません。
      </p>
      <div className="orca-medical-candidate__actions">
        <button
          type="button"
          className="charts-actions__button charts-actions__button--print"
          disabled={Boolean(blockedReason) || running}
          data-disabled-reason={blockedReason ? 'chart_revision_missing' : running ? 'running' : undefined}
          onClick={handlePrepare}
        >
          {running ? '候補作成中…' : '候補を作成'}
        </button>
        {blockedReason ? <span className="orca-medical-candidate__blocked">{blockedReason}</span> : null}
      </div>
      {candidate?.ok ? (
        <div className="orca-medical-candidate__result" role="status" aria-live={resolveAriaLive(candidate.sendable ? 'success' : 'warning')}>
          <dl className="orca-medical-candidate__summary">
            <div>
              <dt>候補ID</dt>
              <dd>{display(candidate.candidateId)}</dd>
            </div>
            <div>
              <dt>処方版</dt>
              <dd>{display(candidate.prescriptionRevisionId)}</dd>
            </div>
            <div>
              <dt>診療行為行</dt>
              <dd>{candidate.medicalInformation.length}件</dd>
            </div>
            <div>
              <dt>薬剤行</dt>
              <dd>{totalMedications}件</dd>
            </div>
          </dl>
          {candidate.medicalInformation.length > 0 ? (
            <ol className="orca-medical-candidate__rows" aria-label="診療行為候補行">
              {candidate.medicalInformation.map((item, index) => {
                const rpLabel = `RP${display(item.rpSequence ?? index + 1)}`;
                const classLabel = [item.medicalClass, item.medicalClassName].map(display).filter((value) => value !== '—').join(' / ') || '—';
                const usageLabel = [item.usageCode, item.usageName].map(display).filter((value) => value !== '—').join(' / ') || '—';
                return (
                  <li key={`${rpLabel}-${item.medicalClass ?? 'class'}-${index}`}>
                    <div className="orca-medical-candidate__row-main">
                      <strong>{rpLabel}</strong>
                      <span>診療区分: {classLabel}</span>
                      <span>用法: {usageLabel}</span>
                    </div>
                    {item.medications && item.medications.length > 0 ? (
                      <ul className="orca-medical-candidate__medications" aria-label={`${rpLabel} 薬剤行`}>
                        {item.medications.map((medication, medicationIndex) => (
                          <li key={`${medication.itemSequence ?? medicationIndex + 1}-${medication.code ?? 'code'}-${medicationIndex}`}>
                            薬剤{display(medication.itemSequence ?? medicationIndex + 1)}: {display(medication.code)} / {display(medication.name)} / {display(medication.number)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {candidate.issues.length > 0 ? (
            <ul className="orca-medical-candidate__issues" aria-label="要確認項目">
              {candidate.issues.map((issue, index) => (
                <li key={`${issue.code ?? 'issue'}-${index}`}>
                  {display(issue.code)}: {display(issue.message)}
                  {issue.rpSequence ? ` / RP${issue.rpSequence}` : ''}
                  {issue.itemSequence ? ` / 薬剤${issue.itemSequence}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="orca-medical-candidate__error" role="alert" aria-live={resolveAriaLive('error')}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
