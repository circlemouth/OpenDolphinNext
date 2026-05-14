import type { ReactNode } from 'react';

type DiffPreviewLayoutProps = {
  title?: string;
  beforeTitle: string;
  afterTitle: string;
  before: ReactNode;
  after: ReactNode;
  summary?: ReactNode;
  className?: string;
};

export function DiffPreviewLayout({ title, beforeTitle, afterTitle, before, after, summary, className }: DiffPreviewLayoutProps) {
  return (
    <section className={`diff-preview-layout${className ? ` ${className}` : ''}`}>
      {title || summary ? (
        <header className="diff-preview-layout__header">
          {title ? <h3>{title}</h3> : null}
          {summary ? <div className="diff-preview-layout__summary">{summary}</div> : null}
        </header>
      ) : null}
      <div className="diff-preview-layout__grid">
        <article className="diff-preview-layout__pane">
          <h4>{beforeTitle}</h4>
          <div>{before}</div>
        </article>
        <article className="diff-preview-layout__pane diff-preview-layout__pane--after">
          <h4>{afterTitle}</h4>
          <div>{after}</div>
        </article>
      </div>
    </section>
  );
}
