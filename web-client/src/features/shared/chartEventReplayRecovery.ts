import type { QueryClient } from '@tanstack/react-query';

export type ReplayGapTarget = {
  key: readonly unknown[];
  label: string;
};

export const CHART_EVENT_REPLAY_TARGETS: ReplayGapTarget[] = [
  {
    key: ['outpatient-appointments'],
    label: '/api/orca/official/appointments/list & /api/orca/official/visits/list',
  },
  {
    key: ['charts-appointments'],
    label: '/api/orca/official/appointments/list & /api/orca/official/visits/list',
  },
  {
    key: ['orca-queue'],
    label: 'ORCA queue public route (intentionally unavailable)',
  },
  {
    key: ['orca-push-events'],
    label: 'ORCA push-event public route (intentionally unavailable)',
  },
];

export type ReplayGapRecoveryFailure = {
  target: ReplayGapTarget;
  error: unknown;
};

export type ReplayGapRecoveryResult = {
  targets: ReplayGapTarget[];
  failures: ReplayGapRecoveryFailure[];
};

export async function triggerChartEventReplayRecovery(
  queryClient: Pick<QueryClient, 'refetchQueries'>,
): Promise<ReplayGapRecoveryResult> {
  const failures: ReplayGapRecoveryFailure[] = [];

  await Promise.all(
    CHART_EVENT_REPLAY_TARGETS.map(async (target) => {
      try {
        await queryClient.refetchQueries({
          queryKey: target.key,
          type: 'all',
        });
      } catch (error) {
        failures.push({ target, error });
      }
    }),
  );

  return { targets: CHART_EVENT_REPLAY_TARGETS, failures };
}
