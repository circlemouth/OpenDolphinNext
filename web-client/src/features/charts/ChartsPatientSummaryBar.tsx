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
  visitDate?: string;
  encounterStatus?: string;
  receptionId?: string;
  appointmentId?: string;
  department?: string;
  physician?: string;
  runId?: string;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  cacheHit?: boolean;
  dataSourceTransition?: DataSourceTransition;
  inlineActionBar?: ReactNode;
};

type PatientSexTone = 'male' | 'female' | 'unknown';
type PatientAgeGroup = 'adult' | 'child' | 'unknown';

const CHILD_AGE_MAX = 14;

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
  if (normalized === '1' || normalized === 'm' || normalized === 'male' || normalized === '男' || normalized === '男性') {
    return '男';
  }
  if (normalized === '2' || normalized === 'f' || normalized === 'female' || normalized === '女' || normalized === '女性') {
    return '女';
  }
  if (normalized === '9') return '不明';
  return safe;
};

const resolvePatientSexTone = (sex?: string): PatientSexTone => {
  const formatted = formatSex(sex);
  if (formatted === '男') return 'male';
  if (formatted === '女') return 'female';
  return 'unknown';
};

const resolvePatientAgeGroup = (age?: string): PatientAgeGroup => {
  const safe = normalizeValue(age);
  if (!safe) return 'unknown';
  const match = safe.match(/\d+/);
  if (!match) return 'unknown';
  const years = Number(match[0]);
  if (!Number.isFinite(years) || years < 0 || years > 130) return 'unknown';
  return years <= CHILD_AGE_MAX ? 'child' : 'adult';
};

function ChartsPatientProfileIcon({ sexTone, ageGroup }: { sexTone: PatientSexTone; ageGroup: PatientAgeGroup }) {
  const isChild = ageGroup === 'child';
  const isFemale = sexTone === 'female';
  const headY = isChild ? 10.7 : 9.8;
  const headRadius = isChild ? 3.55 : 4.05;
  const bodyPath = isFemale
    ? isChild
      ? 'M10.5 25.9C11.6 19.4 13.6 15.9 16 15.9C18.4 15.9 20.4 19.4 21.5 25.9H10.5Z'
      : 'M9.7 26.4C11 18.9 13.3 15.2 16 15.2C18.7 15.2 21 18.9 22.3 26.4H9.7Z'
    : isChild
      ? 'M10 26V21.8C10 18.4 12.6 15.9 16 15.9C19.4 15.9 22 18.4 22 21.8V26H10Z'
      : 'M9.6 26.4V21.3C9.6 17.8 12.4 15.2 16 15.2C19.6 15.2 22.4 17.8 22.4 21.3V26.4H9.6Z';

  return (
    <span className="reception-patient-icon charts-patient-summary__profile-icon" data-sex-tone={sexTone} data-age-group={ageGroup}>
      <svg viewBox="0 0 32 32" focusable="false">
        <circle className="reception-patient-icon__halo" cx="16" cy="16" r="13.2" />
        <path className="reception-patient-icon__shadow" d="M8.8 26.8H23.2" />
        <circle className="reception-patient-icon__head" cx="16" cy={headY} r={headRadius} />
        <path className="reception-patient-icon__body" d={bodyPath} />
        <path
          className="reception-patient-icon__highlight"
          d={isFemale ? 'M13.1 18.1C14 17.2 15 16.8 16 16.8' : 'M12.6 18.2C13.5 17.4 14.6 16.9 15.9 16.9'}
        />
        {isChild ? (
          <g className="reception-patient-icon__age-mark">
            <circle cx="23.5" cy="8.4" r="3.2" />
            <path d="M22.2 8.4H24.8M23.5 7.1V9.7" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}

export function ChartsPatientSummaryBar({
  patientDisplay,
  patientId,
  visitDate,
  encounterStatus,
  department,
  physician,
  runId,
  missingMaster,
  fallbackUsed,
  cacheHit,
  dataSourceTransition,
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
  const normalizedVisitDate = normalizeValue(visitDate) ?? '未解決';
  const normalizedEncounterStatus = normalizeValue(encounterStatus) ?? '再選択が必要';
  const normalizedDepartment = normalizeValue(department) ?? '未設定';
  const normalizedPhysician = normalizeValue(physician) ?? '未設定';
  const sexTone = resolvePatientSexTone(patientDisplay.sex);
  const ageGroup = resolvePatientAgeGroup(patientDisplay.age);

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
        eyebrow="CHARTS"
        patientId={patientId}
        patientName={displayName}
        patientKana={kana}
        photo={<ChartsPatientProfileIcon sexTone={sexTone} ageGroup={ageGroup} />}
        note={undefined}
        selected
        titleTrailing={
          <span className="charts-patient-summary__compact-meta" aria-label="患者基本情報">
            <span>{sex}</span>
            <span>{age}</span>
            <span>{birthDate}</span>
          </span>
        }
        showMeta={false}
        showVisitSupport={false}
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
          </>
        }
        supporting={
          <div className="charts-patient-summary__supporting">
            <section className="charts-patient-summary__encounter-band" aria-label="来院文脈">
              <span className="charts-patient-summary__encounter-item">
                <span className="charts-patient-summary__encounter-label">診療日</span>
                <span className="charts-patient-summary__encounter-value">{normalizedVisitDate}</span>
              </span>
              <span className="charts-patient-summary__encounter-item">
                <span className="charts-patient-summary__encounter-label">状態</span>
                <span className="charts-patient-summary__encounter-value">{normalizedEncounterStatus}</span>
              </span>
              <span className="charts-patient-summary__encounter-item charts-patient-summary__encounter-item--wide">
                <span className="charts-patient-summary__encounter-label">診療科 / 担当医</span>
                <span className="charts-patient-summary__encounter-value">
                  {normalizedDepartment} / {normalizedPhysician}
                </span>
              </span>
            </section>
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
