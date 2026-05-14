import type { ReactNode } from 'react';

import { StatusPill, type StatusPillTone } from '../../shared/StatusPill';

export type ChartSafetyBannerItem = {
  id: string;
  label: string;
  detail: ReactNode;
  tone?: StatusPillTone | 'danger';
  nextAction?: string;
};

const resolveTone = (tone?: ChartSafetyBannerItem['tone']): StatusPillTone => {
  if (tone === 'danger') return 'error';
  return tone ?? 'info';
};

export function ChartSafetyBanner({ items }: { items: ChartSafetyBannerItem[] }) {
  const visibleItems = items.filter((item) => item.detail !== null && item.detail !== undefined);
  if (visibleItems.length === 0) return null;

  return (
    <section className="chart-safety-banner" aria-label="患者安全・作業状態">
      {visibleItems.map((item) => (
        <article className="chart-safety-banner__item" data-tone={item.tone ?? 'info'} key={item.id}>
          <StatusPill tone={resolveTone(item.tone)} size="xs" className="chart-safety-banner__pill">
            {item.label}
          </StatusPill>
          <div className="chart-safety-banner__body">
            <p>{item.detail}</p>
            {item.nextAction ? <p className="chart-safety-banner__next">次: {item.nextAction}</p> : null}
          </div>
        </article>
      ))}
    </section>
  );
}
