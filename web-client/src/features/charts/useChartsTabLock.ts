import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  acquireChartsTabLock,
  buildChartsTabLockStorageKey,
  buildLegacyChartsTabLockStorageKey,
  getOrCreateTabSessionId,
  isChartsTabLockExpired,
  readChartsTabLock,
  releaseChartsTabLock,
  renewChartsTabLock,
  subscribeChartsTabLock,
  type ChartsLockTarget,
  type ChartsTabLockRecord,
} from './editLock';
import {
  acquireChartEditSession,
  heartbeatChartEditSession,
  releaseChartEditSession,
  type ChartEditSessionParams,
} from './chartEditSessionApi';

export type ChartsTabLockStatus = 'owned' | 'other-tab' | 'none' | 'expired';

export type ChartsTabLockState = {
  status: ChartsTabLockStatus;
  storageKey?: string;
  tabSessionId: string;
  ownerRunId?: string;
  ownerTabSessionId?: string;
  expiresAt?: string;
  acquiredAt?: string;
  isReadOnly: boolean;
  readOnlyReason?: string;
};

const DEFAULT_TTL_MS = 5 * 60_000;
const REFRESH_INTERVAL_MS = 60_000;

const isSameLockState = (left: ChartsTabLockState, right: ChartsTabLockState) => {
  return (
    left.status === right.status &&
    left.storageKey === right.storageKey &&
    left.tabSessionId === right.tabSessionId &&
    left.ownerRunId === right.ownerRunId &&
    left.ownerTabSessionId === right.ownerTabSessionId &&
    left.expiresAt === right.expiresAt &&
    left.acquiredAt === right.acquiredAt &&
    left.isReadOnly === right.isReadOnly &&
    left.readOnlyReason === right.readOnlyReason
  );
};

const formatOwnerHint = (lock: ChartsTabLockRecord) => {
  const suffix = lock.owner.runId ? `（runId=${lock.owner.runId}）` : '';
  return `別タブが編集中です${suffix}`;
};

export function useChartsTabLock(options: {
  runId?: string;
  target: ChartsLockTarget;
  enabled?: boolean;
  ttlMs?: number;
  scope?: { facilityId?: string; userId?: string };
}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const tabSessionId = useMemo(() => getOrCreateTabSessionId(options.scope), [options.scope]);
  const storageKey = useMemo(() => buildChartsTabLockStorageKey(options.target, options.scope), [options.scope, options.target]);
  const legacyStorageKey = useMemo(() => buildLegacyChartsTabLockStorageKey(options.target), [options.target]);
  const enabled = options.enabled ?? true;
  const runId = options.runId;

  const [state, setState] = useState<ChartsTabLockState>(() => ({
    status: 'none',
    storageKey: storageKey ?? undefined,
    tabSessionId,
    isReadOnly: false,
  }));

  const storageKeyRef = useRef<string | null>(storageKey);
  storageKeyRef.current = storageKey;
  const previousStorageKeyRef = useRef<string | null>(storageKey);
  const legacyKeyRef = useRef<string | null>(legacyStorageKey);
  legacyKeyRef.current = legacyStorageKey;
  const serverLeaseIdRef = useRef<string | null>(null);
  const serverLeaseForceTakeoverRef = useRef(false);

  const serverLeaseParams = useMemo<ChartEditSessionParams | null>(() => {
    const patientId = (options.target.patientId ?? '').trim();
    if (!patientId) return null;
    return {
      patientId,
      appointmentId: options.target.appointmentId?.trim() || undefined,
      receptionId: options.target.receptionId?.trim() || undefined,
      ownerTabSessionId: tabSessionId,
      ownerRunId: runId,
      ttlSeconds: Math.ceil(ttlMs / 1000),
    };
  }, [options.target.appointmentId, options.target.patientId, options.target.receptionId, runId, tabSessionId, ttlMs]);

  const markServerLockConflict = useCallback(
    (result: { lockStatus?: string; ownerRunId?: string; ownerTabSessionId?: string; expiresAt?: string; acquiredAt?: string }) => {
      setState((prev) => {
        if (!prev.storageKey) return prev;
        const next: ChartsTabLockState = {
          ...prev,
          status: 'other-tab',
          ownerRunId: result.ownerRunId,
          ownerTabSessionId: result.ownerTabSessionId,
          acquiredAt: result.acquiredAt,
          expiresAt: result.expiresAt,
          isReadOnly: true,
          readOnlyReason: result.ownerRunId
            ? `他端末が編集中です（runId=${result.ownerRunId}）`
            : '他端末が編集中です',
        };
        return isSameLockState(prev, next) ? prev : next;
      });
    },
    [],
  );

  const releaseServerLease = useCallback(() => {
    if (!serverLeaseParams || !serverLeaseIdRef.current) return;
    const leaseId = serverLeaseIdRef.current;
    serverLeaseIdRef.current = null;
    void releaseChartEditSession({ ...serverLeaseParams, leaseId }).catch(() => undefined);
  }, [serverLeaseParams]);

  const apply = useCallback(
    (nextKey: string | null, hint?: { force?: boolean }) => {
      if (!nextKey) {
        setState({
          status: 'none',
          storageKey: undefined,
          tabSessionId,
          isReadOnly: false,
        });
        return;
      }

      const now = new Date();

      // migrate legacy lock to scoped key if存在
      const legacyKey = legacyKeyRef.current;
      if (legacyKey && legacyKey !== nextKey && typeof localStorage !== 'undefined') {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw && !localStorage.getItem(nextKey)) {
          try {
            localStorage.setItem(nextKey, legacyRaw);
            localStorage.removeItem(legacyKey);
          } catch {
            // ignore migration failures
          }
        }
      }
      const owner = { tabSessionId, runId };
      const result = acquireChartsTabLock({ storageKey: nextKey, owner, ttlMs, now, force: hint?.force });
      if (result.ok) {
        setState({
          status: 'owned',
          storageKey: nextKey,
          tabSessionId,
          ownerRunId: owner.runId,
          ownerTabSessionId: owner.tabSessionId,
          acquiredAt: result.record.acquiredAt,
          expiresAt: result.record.expiresAt,
          isReadOnly: false,
        });
        return;
      }
      const existing = result.existing;
      const expired = isChartsTabLockExpired(existing, now);
      if (expired) {
        // 期限切れは奪取できるため再試行（同期待ちが発生しても最終書き込み勝ちで整合する）
        const retry = acquireChartsTabLock({ storageKey: nextKey, owner, ttlMs, now, force: true });
        if (retry.ok) {
          setState({
            status: 'owned',
            storageKey: nextKey,
            tabSessionId,
            acquiredAt: retry.record.acquiredAt,
            expiresAt: retry.record.expiresAt,
            isReadOnly: false,
          });
          return;
        }
      }
      setState({
        status: 'other-tab',
        storageKey: nextKey,
        tabSessionId,
        ownerRunId: existing.owner.runId,
        ownerTabSessionId: existing.owner.tabSessionId,
        acquiredAt: existing.acquiredAt,
        expiresAt: existing.expiresAt,
        isReadOnly: true,
        readOnlyReason: formatOwnerHint(existing),
      });
    },
    [runId, tabSessionId, ttlMs],
  );

  const refreshFromStorage = useCallback(
    (key: string) => {
      if (!key) return;
      const activeKey = storageKeyRef.current;
      if (!activeKey || key !== activeKey) return;
      const now = new Date();
      const lock = readChartsTabLock(key);
      if (!lock) {
        setState((prev) => {
          const next: ChartsTabLockState = {
            ...prev,
            status: 'none',
            ownerRunId: undefined,
            ownerTabSessionId: undefined,
            acquiredAt: undefined,
            expiresAt: undefined,
            isReadOnly: false,
            readOnlyReason: undefined,
          };
          return isSameLockState(prev, next) ? prev : next;
        });
        return;
      }

      const expired = isChartsTabLockExpired(lock, now);
      const ownedBySelf = lock.owner.tabSessionId === tabSessionId;
      if (expired) {
        setState((prev) => {
          const next: ChartsTabLockState = {
            ...prev,
            status: 'expired',
            ownerRunId: lock.owner.runId,
            ownerTabSessionId: lock.owner.tabSessionId,
            acquiredAt: lock.acquiredAt,
            expiresAt: lock.expiresAt,
            isReadOnly: !ownedBySelf,
            readOnlyReason: ownedBySelf ? undefined : formatOwnerHint(lock),
          };
          return isSameLockState(prev, next) ? prev : next;
        });
        return;
      }
      if (ownedBySelf) {
        setState((prev) => {
          const next: ChartsTabLockState = {
            ...prev,
            status: 'owned',
            ownerRunId: lock.owner.runId,
            ownerTabSessionId: lock.owner.tabSessionId,
            acquiredAt: lock.acquiredAt,
            expiresAt: lock.expiresAt,
            isReadOnly: false,
            readOnlyReason: undefined,
          };
          return isSameLockState(prev, next) ? prev : next;
        });
        return;
      }
      setState((prev) => {
        const next: ChartsTabLockState = {
          ...prev,
          status: 'other-tab',
          ownerRunId: lock.owner.runId,
          ownerTabSessionId: lock.owner.tabSessionId,
          acquiredAt: lock.acquiredAt,
          expiresAt: lock.expiresAt,
          isReadOnly: true,
          readOnlyReason: formatOwnerHint(lock),
        };
        return isSameLockState(prev, next) ? prev : next;
      });
    },
    [tabSessionId],
  );

  useEffect(() => {
    const previousStorageKey = previousStorageKeyRef.current;
    if (previousStorageKey && previousStorageKey !== storageKey) {
      releaseServerLease();
      releaseChartsTabLock({ storageKey: previousStorageKey, ownerTabSessionId: tabSessionId });
    }
    previousStorageKeyRef.current = storageKey;

    if (!enabled) {
      if (storageKey) {
        releaseServerLease();
        releaseChartsTabLock({ storageKey, ownerTabSessionId: tabSessionId });
      }
      setState((prev) => ({ ...prev, status: 'none', isReadOnly: false, readOnlyReason: undefined }));
      return;
    }
    apply(storageKey ?? null);
  }, [apply, enabled, releaseServerLease, storageKey, tabSessionId]);

  useEffect(() => {
    return () => {
      const activeKey = storageKeyRef.current;
      releaseServerLease();
      if (!activeKey) return;
      releaseChartsTabLock({ storageKey: activeKey, ownerTabSessionId: tabSessionId });
    };
  }, [releaseServerLease, tabSessionId]);

  useEffect(() => {
    if (!enabled || state.status !== 'owned' || !storageKey || !serverLeaseParams) return;
    let canceled = false;
    const forceTakeover = serverLeaseForceTakeoverRef.current;
    serverLeaseForceTakeoverRef.current = false;
    void acquireChartEditSession({
      ...serverLeaseParams,
      leaseId: serverLeaseIdRef.current ?? undefined,
      forceTakeover,
    })
      .then((result) => {
        if (canceled) return;
        if (result.ok && result.leaseId) {
          serverLeaseIdRef.current = result.leaseId;
          setState((prev) => {
            const next: ChartsTabLockState = {
              ...prev,
              status: 'owned',
              ownerRunId: result.ownerRunId ?? runId,
              ownerTabSessionId: result.ownerTabSessionId ?? tabSessionId,
              acquiredAt: result.acquiredAt ?? prev.acquiredAt,
              expiresAt: result.expiresAt ?? prev.expiresAt,
              isReadOnly: false,
              readOnlyReason: undefined,
            };
            return isSameLockState(prev, next) ? prev : next;
          });
          return;
        }
        if (result.supported !== false) {
          markServerLockConflict(result);
        }
      })
      .catch(() => {
        if (!canceled) {
          markServerLockConflict({});
        }
      });
    return () => {
      canceled = true;
    };
  }, [enabled, markServerLockConflict, runId, serverLeaseParams, state.status, storageKey, tabSessionId]);

  useEffect(() => {
    if (!enabled) return;
    if (!storageKey) return;

    const disposeSubscription = subscribeChartsTabLock({
      onMessage: (key) => refreshFromStorage(key),
    });

    const interval = window.setInterval(() => {
      const activeKey = storageKeyRef.current;
      if (!activeKey) return;

      // 自分がロック保持している場合は更新、そうでなければ状態同期のみ
      const renewed = renewChartsTabLock({ storageKey: activeKey, ownerTabSessionId: tabSessionId, ttlMs });
      if (renewed.ok) {
        refreshFromStorage(activeKey);
      } else {
        refreshFromStorage(activeKey);
      }
      if (serverLeaseParams && serverLeaseIdRef.current) {
        void heartbeatChartEditSession({ ...serverLeaseParams, leaseId: serverLeaseIdRef.current })
          .then((result) => {
            if (!result.ok && result.supported !== false) {
              markServerLockConflict(result);
            }
          })
          .catch(() => markServerLockConflict({}));
      }
    }, REFRESH_INTERVAL_MS);

    const onBeforeUnload = () => {
      const activeKey = storageKeyRef.current;
      releaseServerLease();
      if (!activeKey) return;
      releaseChartsTabLock({ storageKey: activeKey, ownerTabSessionId: tabSessionId });
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const activeKey = storageKeyRef.current;
      if (!activeKey) return;
      refreshFromStorage(activeKey);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disposeSubscription();
    };
  }, [enabled, markServerLockConflict, refreshFromStorage, releaseServerLease, serverLeaseParams, storageKey, tabSessionId, ttlMs]);

  const forceTakeover = useCallback(() => {
    if (!storageKey) return;
    serverLeaseForceTakeoverRef.current = true;
    apply(storageKey, { force: true });
  }, [apply, storageKey]);

  const release = useCallback(() => {
    if (!storageKey) return;
    releaseServerLease();
    releaseChartsTabLock({ storageKey, ownerTabSessionId: tabSessionId });
    refreshFromStorage(storageKey);
  }, [refreshFromStorage, releaseServerLease, storageKey, tabSessionId]);

  return {
    ...state,
    forceTakeover,
    release,
  };
}
