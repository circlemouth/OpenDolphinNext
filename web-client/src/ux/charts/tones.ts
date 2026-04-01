import type { BannerTone } from '../../features/reception/components/ToneBanner';
import type { DataSourceTransition } from '../../features/charts/authService';
import { MISSING_MASTER_RECOVERY_NEXT_ACTION } from '../../features/shared/missingMasterRecovery';

export type ChartTone = BannerTone;

export type ChartTonePayload = {
  missingMaster: boolean;
  cacheHit: boolean;
  dataSourceTransition: DataSourceTransition;
};

export function computeChartTone({ missingMaster, cacheHit, dataSourceTransition }: ChartTonePayload): ChartTone {
  if (missingMaster) {
    return dataSourceTransition === 'fallback' ? 'error' : 'warning';
  }
  if (cacheHit) {
    return 'info';
  }
  if (dataSourceTransition === 'server') {
    return 'warning';
  }
  return 'info';
}

export interface TransitionMeta {
  label: string;
  tone: BannerTone;
  description: string;
  reason: string;
}

const TRANSITION_META: Record<DataSourceTransition, TransitionMeta> = {
  mock: {
    label: 'dataSourceTransition=mock',
    tone: 'info',
    description: 'モック／デモ用データから取得中。診療判断には使わず server への切替を推奨。',
    reason: 'mock→server への移行待ち',
  },
  snapshot: {
    label: 'dataSourceTransition=snapshot',
    tone: 'warning',
    description: 'スナップショットキャッシュを参照中。マスタ欠損の可能性あり。',
    reason: 'server→snapshot （欠損検知時の暫定値）',
  },
  server: {
    label: 'dataSourceTransition=server',
    tone: 'warning',
    description: '実 ORCA サーバーから取得中。欠損が解消したら tone=info へ戻ります。',
    reason: 'mock・snapshot→server （本値取得）',
  },
  fallback: {
    label: 'dataSourceTransition=fallback',
    tone: 'error',
    description: 'フォールバックデータを利用中。計算は暫定、即時再取得が必要。',
    reason: 'server→fallback （master 欠損/通信失敗）',
  },
};

export function getTransitionMeta(transition: DataSourceTransition): TransitionMeta {
  return TRANSITION_META[transition];
}

export function getTransitionCopy(transition: DataSourceTransition) {
  const meta = getTransitionMeta(transition);
  return {
    headline: meta.label,
    body: `${meta.description} ｜ ${meta.reason}`,
    meta,
  };
}

export function isServerTransition(transition: DataSourceTransition) {
  return transition === 'server';
}

export interface ChartToneDetails {
  tone: ChartTone;
  message: string;
  transitionMeta: TransitionMeta;
}

export function getChartToneDetails(payload: ChartTonePayload): ChartToneDetails {
  const tone = computeChartTone(payload);
  const transitionMeta = getTransitionMeta(payload.dataSourceTransition);

  let message: string;
  if (payload.missingMaster) {
    message = `ORCA 参照が不足しています。${MISSING_MASTER_RECOVERY_NEXT_ACTION}してください。`;
  } else if (payload.cacheHit) {
    message = '前回取得した参照情報を表示しています。必要なら再取得してください。';
  } else {
    message = '最新データを確認しながら操作してください。';
  }

  return { tone, message, transitionMeta };
}
