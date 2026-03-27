import type { Location } from 'react-router-dom';

export type LoginSwitchContext = {
  mode: 'switch';
  reason?: 'manual' | 'facility' | 'user' | 'role';
  actor?: {
    facilityId: string;
    userId: string;
    role?: string;
    runId?: string;
  };
};

export type LoginRouteState = { from?: string | Location; switchContext?: LoginSwitchContext };

export const normalizeFromState = (state: unknown): LoginRouteState | undefined => {
  if (!state) return undefined;
  if (typeof state === 'object' && state !== null && 'from' in state) {
    return state as LoginRouteState;
  }
  if (typeof state === 'object' && state !== null && 'switchContext' in state) {
    return state as LoginRouteState;
  }
  return undefined;
};

export const resolveFromState = (state: unknown): string | Location | undefined =>
  normalizeFromState(state)?.from;

export const resolveSwitchContext = (state: unknown): LoginSwitchContext | undefined =>
  normalizeFromState(state)?.switchContext;

export const isLegacyFrom = (from?: string | Location) => {
  if (!from) return false;
  const pathname = typeof from === 'string' ? from.split('?')[0]?.split('#')[0] ?? '' : from.pathname ?? '';
  if (!pathname || pathname === '/login') return false;
  return false;
};
