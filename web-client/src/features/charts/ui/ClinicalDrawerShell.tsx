import type { ReactNode } from 'react';

type ClinicalDrawerShellProps = {
  title: string;
  sourceLabel?: string;
  patientContext?: ReactNode;
  search?: ReactNode;
  candidates?: ReactNode;
  editor?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function ClinicalDrawerShell({
  title,
  sourceLabel,
  patientContext,
  search,
  candidates,
  editor,
  footer,
  className,
}: ClinicalDrawerShellProps) {
  return (
    <section className={`clinical-drawer-shell${className ? ` ${className}` : ''}`}>
      <header className="clinical-drawer-shell__header">
        <div>
          <p className="clinical-drawer-shell__eyebrow">候補・入力ドロワー</p>
          <h2>{title}</h2>
          {sourceLabel ? <p className="clinical-drawer-shell__source">{sourceLabel}</p> : null}
        </div>
        {patientContext ? <div className="clinical-drawer-shell__patient">{patientContext}</div> : null}
      </header>
      {search ? <div className="clinical-drawer-shell__search">{search}</div> : null}
      <div className="clinical-drawer-shell__grid">
        {candidates ? <div className="clinical-drawer-shell__candidates">{candidates}</div> : null}
        {editor ? <div className="clinical-drawer-shell__editor">{editor}</div> : null}
      </div>
      {footer ? <footer className="clinical-drawer-shell__footer">{footer}</footer> : null}
    </section>
  );
}
