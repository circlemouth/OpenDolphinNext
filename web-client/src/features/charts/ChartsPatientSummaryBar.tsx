import type { ReactNode } from 'react';

import type { DataSourceTransition } from '../../libs/observability/types';
import { PatientIdentityBar } from '../shared/PatientIdentityBar';
import { StatusPill } from '../shared/StatusPill';

type PatientDisplay = {
  name: string;
  kana?: string;
  sex?: string;
  age?: string;
  birthDateEra?: string;
  birthDateIso?: string;
  zip?: string;
  address?: string;
  note?: string;
};

type ChartsPatientSummaryBarProps = {
  patientDisplay: PatientDisplay;
  patientId?: string;
  runId?: string;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  cacheHit?: boolean;
  dataSourceTransition?: DataSourceTransition;
  onStartEncounter?: () => void;
  onFinishEncounter?: () => void;
  onPauseEncounter?: () => void;
  onCloseChart?: () => void;
  onReloadChart?: () => void;
  encounterActionDisabled?: boolean;
  inlineActionBar?: ReactNode;
};

const normalizeValue = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (value.trim() === '' || value === '—') return undefined;
  return value;
};

const normalizeMemo = (value?: string): string | undefined => {
  const safe = normalizeValue(value);
  if (!safe) return undefined;
  if (safe === 'メモなし') return undefined;
  return safe;
};

const normalizeZip = (zip?: string): string | undefined => {
  const safeZip = normalizeValue(zip);
  if (!safeZip) return undefined;
  return safeZip.startsWith('〒') ? safeZip : `〒${safeZip}`;
};

const formatSex = (sex?: string): string => {
  const safe = normalizeValue(sex);
  if (!safe) return '—';
  const normalized = safe.trim().toLowerCase();
  if (normalized === '1' || normalized === 'm' || normalized === 'male' || normalized === '男') return '男';
  if (normalized === '2' || normalized === 'f' || normalized === 'female' || normalized === '女') return '女';
  if (normalized === '9') return '不明';
  return safe;
};

export function ChartsPatientSummaryBar({
  patientDisplay,
  patientId,
  runId,
  missingMaster,
  fallbackUsed,
  cacheHit,
  dataSourceTransition,
  onStartEncounter,
  onCloseChart,
  onReloadChart,
  encounterActionDisabled = false,
  inlineActionBar,
}: ChartsPatientSummaryBarProps) {
  const displayName = normalizeValue(patientDisplay.name) ?? '患者未選択';
  const kana = normalizeValue(patientDisplay.kana);
  const sex = formatSex(patientDisplay.sex);
  const age = normalizeValue(patientDisplay.age) ?? '—';
  const birthEra = normalizeValue(patientDisplay.birthDateEra);
  const birthIso = normalizeValue(patientDisplay.birthDateIso);
  const birthDate = birthIso ?? birthEra ?? '—';
  const zip = normalizeZip(patientDisplay.zip);
  const address = normalizeValue(patientDisplay.address);
  const memo = normalizeMemo(patientDisplay.note);
  const hasAddressMeta = Boolean(zip || address);

  return (
    <div
      className="charts-patient-summary"
      data-run-id={runId}
      data-missing-master={String(missingMaster ?? false)}
      data-cache-hit={String(cacheHit ?? false)}
      data-fallback-used={String(fallbackUsed ?? false)}
      data-source-transition={dataSourceTransition}
    >
      <PatientIdentityBar
        className="charts-patient-summary__identity-bar"
        eyebrow="Charts / patient"
        patientId={patientId}
        patientName={displayName}
        patientKana={kana}
        sex={sex}
        age={age}
        note={undefined}
        selected
        chips={
          <>
            {missingMaster ? (
              <StatusPill tone="warning" size="xs" className="charts-patient-summary__alert-pill">
                ORCA参照不足
              </StatusPill>
            ) : null}
            {fallbackUsed ? (
              <StatusPill tone="warning" size="xs" className="charts-patient-summary__alert-pill">
                暫定参照
              </StatusPill>
            ) : null}
            {cacheHit ? (
              <StatusPill tone="info" size="xs" className="charts-patient-summary__alert-pill">
                Cache hit
              </StatusPill>
            ) : null}
            {dataSourceTransition ? (
              <StatusPill tone="neutral" size="xs" className="charts-patient-summary__alert-pill">
                {dataSourceTransition}
              </StatusPill>
            ) : null}
          </>
        }
        actions={
          <div className="charts-patient-summary__primary-actions" role="group" aria-label="カルテ操作">
            <button
              type="button"
              className="charts-patient-summary__primary-action charts-patient-summary__primary-action--start"
              onClick={onStartEncounter}
              disabled={encounterActionDisabled || !onStartEncounter}
            >
              診察開始
            </button>
            <button
              type="button"
              className="charts-patient-summary__primary-action charts-patient-summary__primary-action--reload"
              onClick={onReloadChart}
              disabled={encounterActionDisabled || !onReloadChart}
            >
              更新
            </button>
            <button
              type="button"
              className="charts-patient-summary__primary-action charts-patient-summary__primary-action--close"
              onClick={onCloseChart}
              disabled={!onCloseChart}
            >
              閉じる
            </button>
          </div>
        }
        supporting={
          <div className="charts-patient-summary__supporting">
            <div className="charts-patient-summary__fact-grid" aria-label="患者補足情報">
              <span className="charts-patient-summary__fact">
                <span className="charts-patient-summary__fact-label">生年月日</span>
                <span className="charts-patient-summary__fact-value">{birthDate}</span>
              </span>
              <span className="charts-patient-summary__fact">
                <span className="charts-patient-summary__fact-label">性別</span>
                <span className="charts-patient-summary__fact-value">{sex}</span>
              </span>
              <span className="charts-patient-summary__fact">
                <span className="charts-patient-summary__fact-label">年齢</span>
                <span className="charts-patient-summary__fact-value">{age}</span>
              </span>
            </div>
            {hasAddressMeta ? (
              <details className="charts-patient-summary__extra">
                <summary className="charts-patient-summary__extra-summary">住所・連絡情報</summary>
                <div className="charts-patient-summary__extra-body">
                  {zip ? <p className="charts-patient-summary__address">{zip}</p> : null}
                  {address ? <p className="charts-patient-summary__address">{address}</p> : null}
                </div>
              </details>
            ) : null}
            {memo ? (
              <section className="charts-patient-summary__memo-panel" aria-label="患者メモ">
                <h3 className="charts-patient-summary__memo-title">患者メモ</h3>
                <p className="charts-patient-summary__memo-body">{memo}</p>
              </section>
            ) : null}
          </div>
        }
      />

      {inlineActionBar ? <div className="charts-patient-summary__inline-actionbar">{inlineActionBar}</div> : null}
    </div>
  );
}
