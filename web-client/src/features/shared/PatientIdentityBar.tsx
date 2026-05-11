import type { ReactNode } from 'react';

import { PatientMetaRow } from './PatientMetaRow';

import './patientIdentityBar.css';

export interface PatientIdentityBarProps {
  title?: string;
  patientId?: string;
  internalPatientId?: string;
  patientName?: string;
  patientKana?: string;
  sex?: string;
  age?: string;
  visitDate?: string;
  acceptanceDate?: string;
  receptionId?: string;
  appointmentId?: string;
  department?: string;
  physician?: string;
  insuranceCombination?: string;
  orcaSourceLabel?: string;
  orcaFetchedAt?: string;
  orcaCacheStatus?: 'fresh' | 'stale' | 'unverified' | 'missing' | string;
  eyebrow?: string;
  note?: string;
  chips?: ReactNode;
  actions?: ReactNode;
  supporting?: ReactNode;
  photo?: ReactNode;
  titleTrailing?: ReactNode;
  showMeta?: boolean;
  showVisitSupport?: boolean;
  selected?: boolean;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'error';
  className?: string;
}

const normalizeValue = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export function PatientIdentityBar({
  title,
  patientId,
  internalPatientId,
  patientName,
  patientKana,
  sex,
  age,
  visitDate,
  acceptanceDate,
  receptionId,
  appointmentId,
  department,
  physician,
  insuranceCombination,
  orcaSourceLabel,
  orcaFetchedAt,
  orcaCacheStatus,
  eyebrow,
  note,
  chips,
  actions,
  supporting,
  photo,
  titleTrailing,
  showMeta = true,
  showVisitSupport = true,
  selected = false,
  tone = 'neutral',
  className,
}: PatientIdentityBarProps) {
  const resolvedPatientId = normalizeValue(patientId);
  const resolvedTitle =
    normalizeValue(title) ?? normalizeValue(patientName) ?? (resolvedPatientId ? `患者ID ${resolvedPatientId}` : '患者未選択');
  const resolvedName = normalizeValue(patientName);
  const resolvedKana = normalizeValue(patientKana);
  const resolvedVisitDate = normalizeValue(visitDate);
  const resolvedInternalPatientId = normalizeValue(internalPatientId);
  const resolvedAcceptanceDate = normalizeValue(acceptanceDate);
  const resolvedDepartment = normalizeValue(department);
  const resolvedPhysician = normalizeValue(physician);
  const resolvedInsuranceCombination = normalizeValue(insuranceCombination);
  const resolvedOrcaSourceLabel = normalizeValue(orcaSourceLabel);
  const resolvedOrcaFetchedAt = normalizeValue(orcaFetchedAt);
  const resolvedOrcaCacheStatus = normalizeValue(orcaCacheStatus);
  const resolvedNote = normalizeValue(note);
  const medicalSafetyItems = [
    resolvedInternalPatientId ? { label: '内部参照ID', value: resolvedInternalPatientId } : undefined,
    resolvedAcceptanceDate ?? resolvedVisitDate ? { label: '受付日', value: resolvedAcceptanceDate ?? resolvedVisitDate ?? '—' } : undefined,
    resolvedDepartment ? { label: '診療科', value: resolvedDepartment } : undefined,
    resolvedPhysician ? { label: '担当医', value: resolvedPhysician } : undefined,
    resolvedInsuranceCombination ? { label: '保険組合せ', value: resolvedInsuranceCombination } : undefined,
    resolvedOrcaSourceLabel || resolvedOrcaFetchedAt || resolvedOrcaCacheStatus
      ? {
          label: 'ORCA取得',
          value: [resolvedOrcaSourceLabel, resolvedOrcaFetchedAt, resolvedOrcaCacheStatus].filter(Boolean).join(' / ') || '—',
        }
      : undefined,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <section
      className={`patient-identity-bar${className ? ` ${className}` : ''}`}
      aria-label="患者識別帯"
      data-selected={selected ? 'true' : 'false'}
      data-tone={tone}
    >
      <div className="patient-identity-bar__surface">
        <div className="patient-identity-bar__avatar" aria-hidden="true">
          {photo ?? <span className="patient-identity-bar__avatar-fallback">Pt</span>}
        </div>
        <div className="patient-identity-bar__body">
          <div className="patient-identity-bar__header">
            <div className="patient-identity-bar__headline">
              {eyebrow ? <p className="patient-identity-bar__eyebrow">{eyebrow}</p> : null}
              {resolvedKana ? <p className="patient-identity-bar__kana">{resolvedKana}</p> : null}
              <div className="patient-identity-bar__title-row">
                <h2 className="patient-identity-bar__title">{resolvedTitle}</h2>
                {resolvedPatientId ? <span className="patient-identity-bar__id">患者ID: {resolvedPatientId}</span> : null}
                {titleTrailing ? <span className="patient-identity-bar__title-trailing">{titleTrailing}</span> : null}
              </div>
              {resolvedName && resolvedName !== resolvedTitle ? <p className="patient-identity-bar__name">{resolvedName}</p> : null}
            </div>
            {actions ? <div className="patient-identity-bar__actions">{actions}</div> : null}
          </div>

          {showMeta ? (
            <PatientMetaRow
              patientId={resolvedPatientId}
              receptionId={normalizeValue(receptionId)}
              appointmentId={normalizeValue(appointmentId)}
              sex={normalizeValue(sex)}
              age={normalizeValue(age)}
              variant="detailed"
              showLabels
              separator="dot"
              className="patient-identity-bar__meta"
            />
          ) : null}

          {showVisitSupport && (resolvedVisitDate || resolvedNote) ? (
            <div className="patient-identity-bar__supporting-copy">
              {resolvedVisitDate ? <span className="patient-identity-bar__supporting-item">診療日 {resolvedVisitDate}</span> : null}
              {resolvedNote ? <span className="patient-identity-bar__supporting-item">{resolvedNote}</span> : null}
            </div>
          ) : null}

          {medicalSafetyItems.length > 0 ? (
            <dl className="patient-identity-bar__medical-safety" aria-label="医療安全患者ヘッダー">
              {medicalSafetyItems.map((item) => (
                <div className="patient-identity-bar__medical-safety-item" key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {chips ? <div className="patient-identity-bar__chips">{chips}</div> : null}
          {supporting ? <div className="patient-identity-bar__supporting">{supporting}</div> : null}
        </div>
      </div>
    </section>
  );
}
