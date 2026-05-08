import type { ReactNode } from 'react';

import { PatientMetaRow } from './PatientMetaRow';

import './patientIdentityBar.css';

export interface PatientIdentityBarProps {
  title?: string;
  patientId?: string;
  patientName?: string;
  patientKana?: string;
  sex?: string;
  age?: string;
  visitDate?: string;
  receptionId?: string;
  appointmentId?: string;
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
  patientName,
  patientKana,
  sex,
  age,
  visitDate,
  receptionId,
  appointmentId,
  eyebrow = 'Patient identity',
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
  const resolvedNote = normalizeValue(note);

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
              <p className="patient-identity-bar__eyebrow">{eyebrow}</p>
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

          {chips ? <div className="patient-identity-bar__chips">{chips}</div> : null}
          {supporting ? <div className="patient-identity-bar__supporting">{supporting}</div> : null}
        </div>
      </div>
    </section>
  );
}
