import type { QueryClient } from '@tanstack/react-query';

export type ReplayGapTarget = {
  key: readonly unknown[];
  label: string;
};

export const CHART_EVENT_REPLAY_TARGETS: ReplayGapTarget[] = [
  {
    key: ['outpatient-appointments'],
    label: '/api/orca/appointments/list & /api/orca/visits/list',
  },
  {
    key: ['charts-appointments'],
    label: '/api/orca/appointments/list & /api/orca/visits/list',
  },
  {
    key: ['orca-queue'],
    label: '/api/orca/queue',
  },
  {
    key: ['orca-push-events'],
    label: '/api/orca/pusheventgetv2',
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
