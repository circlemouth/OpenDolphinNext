import type { ReactNode } from 'react';

type ClinicalPanelShellProps = {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ClinicalPanelShell({ title, eyebrow, meta, actions, children, className }: ClinicalPanelShellProps) {
  return (
    <section className={`clinical-panel-shell${className ? ` ${className}` : ''}`}>
      <header className="clinical-panel-shell__header">
        <div>
          {eyebrow ? <p className="clinical-panel-shell__eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {meta ? <div className="clinical-panel-shell__meta">{meta}</div> : null}
        </div>
        {actions ? <div className="clinical-panel-shell__actions">{actions}</div> : null}
      </header>
      <div className="clinical-panel-shell__content">{children}</div>
    </section>
  );
}
