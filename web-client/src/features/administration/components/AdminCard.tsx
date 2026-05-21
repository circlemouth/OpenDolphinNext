import type { ReactNode } from 'react';

type AdminCardProps = {
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
};

export function AdminCard({
  title,
  description,
  status,
  actions,
  children,
  className,
  id,
  ariaLabel,
}: AdminCardProps) {
  return (
    <section
      id={id}
      className={`administration-card admin-card-shell${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel ?? title}
    >
      <header className="admin-card-shell__header">
        <div className="admin-card-shell__header-main">
          <h2 className="administration-card__title">{title}</h2>
          {description ? <p className="admin-card-shell__description">{description}</p> : null}
        </div>
        {status ? <div className="admin-card-shell__status">{status}</div> : null}
      </header>
      {actions ? <div className="admin-card-shell__actions odn-action-bar odn-action-bar--start">{actions}</div> : null}
      <div className="admin-card-shell__body">{children}</div>
    </section>
  );
}
