import type { ReactNode } from 'react';

import { StatusPill } from '../../shared/StatusPill';

export type OrcaResultPanelState = 'success' | 'warning' | 'error' | 'unknown' | 'idle' | 'locked';

type OrcaResultPanelProps = {
  title?: string;
  state: OrcaResultPanelState;
  statusLabel: string;
  message: ReactNode;
  patientLabel?: string;
  encounterLabel?: string;
  nextAction?: ReactNode;
  evidence?: ReactNode;
};

const stateTone = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  unknown: 'warning',
  idle: 'info',
  locked: 'neutral',
} as const;

export function OrcaResultPanel({
  title = 'ORCA送信・会計連携状態',
  state,
  statusLabel,
  message,
  patientLabel,
  encounterLabel,
  nextAction,
  evidence,
}: OrcaResultPanelProps) {
  return (
    <section className="orca-result-panel" data-state={state} aria-label={title}>
      <header className="orca-result-panel__header">
        <div>
          <p className="orca-result-panel__eyebrow">正本境界</p>
          <h3>{title}</h3>
        </div>
        <StatusPill tone={stateTone[state]} size="sm" className="orca-result-panel__status">
          {statusLabel}
        </StatusPill>
      </header>
      <p className="orca-result-panel__message">{message}</p>
      <dl className="orca-result-panel__facts">
        {patientLabel ? (
          <div>
            <dt>対象患者</dt>
            <dd>{patientLabel}</dd>
          </div>
        ) : null}
        {encounterLabel ? (
          <div>
            <dt>受付/来院</dt>
            <dd>{encounterLabel}</dd>
          </div>
        ) : null}
      </dl>
      {nextAction ? <div className="orca-result-panel__next">次にやること: {nextAction}</div> : null}
      {evidence ? <div className="orca-result-panel__evidence">{evidence}</div> : null}
    </section>
  );
}
