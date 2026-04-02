export const MISSING_MASTER_RECOVERY_ACTIONS = {
  refetch: '再取得',
  reception: '受付',
  share: '管理者共有',
} as const;

export const MISSING_MASTER_RECOVERY_NEXT_ACTION = MISSING_MASTER_RECOVERY_ACTIONS.refetch;

export const MISSING_MASTER_RECOVERY_STATUS_DETAIL = `復旧導線: ${MISSING_MASTER_RECOVERY_ACTIONS.refetch} → ${MISSING_MASTER_RECOVERY_ACTIONS.reception} → ${MISSING_MASTER_RECOVERY_ACTIONS.share}`;

export const MISSING_MASTER_RECOVERY_MESSAGE =
  'マスタ未取得/フォールバックのため暫定表示です。再取得で解消しない場合は受付で状態を確認し、管理者共有してください。';

export const MISSING_MASTER_RECOVERY_STEPS = [
  {
    key: 'refetch',
    label: MISSING_MASTER_RECOVERY_ACTIONS.refetch,
    detail: 'マスタ/外来データを再取得して状態を更新',
  },
  {
    key: 'reception',
    label: MISSING_MASTER_RECOVERY_ACTIONS.reception,
    detail: '受付で対象患者の状態を確認',
  },
  {
    key: 'share',
    label: MISSING_MASTER_RECOVERY_ACTIONS.share,
    detail: 'RUN_ID/traceId を共有して調査依頼',
  },
] as const;

export const MISSING_MASTER_RECOVERY_NEXT_STEPS = [
  `${MISSING_MASTER_RECOVERY_ACTIONS.refetch}（master/外来データ）`,
  `${MISSING_MASTER_RECOVERY_ACTIONS.reception}で状態確認`,
  `${MISSING_MASTER_RECOVERY_ACTIONS.share}（RUN_ID/traceId）`,
] as const;

export const buildMissingMasterShareText = (runId?: string, traceId?: string): string | null => {
  const normalizedRunId = runId?.trim();
  const normalizedTraceId = traceId?.trim();
  if (!normalizedRunId && !normalizedTraceId) return null;
  return `runId=${normalizedRunId ?? 'unknown'} / traceId=${normalizedTraceId ?? 'unknown'}`;
};
