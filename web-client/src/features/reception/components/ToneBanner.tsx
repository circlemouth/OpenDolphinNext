import { Global } from '@emotion/react';

import type { LiveRegionAria } from '../../../libs/observability/types';
import { resolveAriaLive, resolveRunId, resolveTraceId } from '../../../libs/observability/observability';
import { normalizeFeedbackTone, toLegacyWarningTone } from '../../shared/feedbackTone';
import { toneBannerStyles } from '../styles';

export type BannerTone = 'error' | 'warning' | 'info';
type ToneBannerTone = BannerTone | 'warn';

const tonePrefix: Record<ToneBannerTone, string> = {
  error: 'エラー',
  warning: '注意',
  warn: '注意',
  info: '情報',
};

export interface ToneBannerProps {
  tone: ToneBannerTone;
  message: string;
  patientId?: string;
  receptionId?: string;
  destination?: string;
  nextAction?: string;
  runId?: string;
  traceId?: string;
  ariaLive?: LiveRegionAria;
  showMeta?: boolean;
}

export function ToneBanner({
  tone,
  message,
  patientId,
  receptionId,
  destination,
  nextAction,
  runId,
  traceId,
  ariaLive,
  showMeta,
}: ToneBannerProps) {
  const normalizedTone = normalizeFeedbackTone(tone);
  const legacyTone = toLegacyWarningTone(tone);
  const live = resolveAriaLive(legacyTone, ariaLive);
  const role = normalizedTone === 'info' ? 'status' : 'alert';
  const resolvedRunId = resolveRunId(runId);
  const resolvedTraceId = resolveTraceId(traceId);
  const shouldShowMeta = showMeta ?? normalizedTone === 'error';
  const metaFragments = shouldShowMeta
    ? [`RUN_ID: ${resolvedRunId ?? '未取得'}`, `traceId: ${resolvedTraceId ?? '未取得'}`]
    : [];
  const fragments = [
    message,
    patientId ? `患者ID: ${patientId}` : undefined,
    receptionId ? `受付ID: ${receptionId}` : undefined,
    destination ? `送信先: ${destination}` : undefined,
    nextAction ? `次アクション: ${nextAction}` : undefined,
    ...metaFragments,
  ].filter((fragment): fragment is string => typeof fragment === 'string');
  const ariaText = [tonePrefix[tone], ...fragments].join('、');
  return (
    <>
      <Global styles={toneBannerStyles} />
      <div
        className={`tone-banner tone-banner--${legacyTone}`}
        role={role}
        aria-live={live}
        aria-atomic="true"
        aria-label={ariaText}
        tabIndex={0}
        data-run-id={resolvedRunId}
        data-trace-id={resolvedTraceId}
      >
        <div className="tone-banner__tag">{tonePrefix[tone]}</div>
        <p className="tone-banner__message">{fragments.join(' ｜ ')}</p>
      </div>
    </>
  );
}
