import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { buildFacilityPath } from '../../routes/facilityRoutes';
import { useAppNavigation } from '../../routes/useAppNavigation';
import { hasHandoffEncounterKey } from '../charts/encounterContext';
import {
  readChartsPatientTabsStorage,
  writeChartsPatientTabsStorage,
  type ChartsPatientTab,
  type ChartsPatientTabsStorage,
} from '../charts/patientTabsStorage';
import {
  CHARTS_PATIENT_TABS_UPDATED_EVENT,
  dispatchChartsPatientTabsUpdated,
  dispatchWorkspaceChartsTabRequest,
} from './workspaceTabEvents';

type WorkspaceTabBarProps = {
  facilityId?: string;
  userId?: string;
  role?: string;
  onRequestSwitchAccount?: () => void;
  onRequestLogout?: () => void;
  orcaStatus?: {
    tone: 'info' | 'success' | 'warning' | 'error';
    label: string;
    tooltip?: string;
  };
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const createInitialTabsState = (): ChartsPatientTabsStorage => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  savedAt: new Date().toISOString(),
  activeKey: undefined,
  tabs: [],
});

const resolvePatientToken = (tab: ChartsPatientTab) => {
  const raw = normalizeText(tab.encounterKey) ?? normalizeText(tab.scheduleKey);
  if (!raw) return undefined;
  const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? raw;
};

const resolvePatientTabDisplay = (tab: ChartsPatientTab) => {
  const primary = normalizeText(tab.name) ?? `患者 ID:${tab.patientId}`;
  const secondaryParts = [`ID:${tab.patientId}`];
  const department = normalizeText(tab.department);
  if (department) secondaryParts.push(department);
  const token = resolvePatientToken(tab);
  if (token) secondaryParts.push(token);
  if (normalizeText(tab.visitDate)) secondaryParts.push(tab.visitDate);
  const secondary = secondaryParts.join(' / ');
  return {
    primary,
    secondary,
    accessibleLabel: `${primary} ${secondary}`.trim(),
    title: [primary, secondary].filter(Boolean).join('\n'),
  };
};

const resolveTabListTabs = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return [];
  const tabList = target.closest('[role="tablist"]');
  if (!(tabList instanceof HTMLElement)) return [];
  return Array.from(tabList.querySelectorAll<HTMLElement>('[role="tab"]'));
};

export function WorkspaceTabBar({
  facilityId,
  userId,
  role,
  onRequestSwitchAccount,
  onRequestLogout,
  orcaStatus,
}: WorkspaceTabBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const appNav = useAppNavigation({ facilityId, userId });
  const dynamicListRef = useRef<HTMLDivElement | null>(null);
  const overflowRootRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const storageScope = useMemo(() => ({ facilityId, userId }), [facilityId, userId]);
  const loadPatientTabs = useCallback(
    () => readChartsPatientTabsStorage(storageScope) ?? createInitialTabsState(),
    [storageScope],
  );
  const [patientTabsState, setPatientTabsState] = useState<ChartsPatientTabsStorage>(loadPatientTabs);

  const dynamicTabs = patientTabsState.tabs;
  const isChartsScreen = /\/charts\/?$/.test(location.pathname);
  const isChartsArea = ['charts', 'print', 'orderSets'].includes(appNav.currentScreen);
  const activeDynamicKey = isChartsArea ? patientTabsState.activeKey : undefined;
  const isSystemAdmin = role === 'system_admin';

  const activeFixedKey = useMemo(() => {
    if (appNav.currentScreen === 'reception') return 'reception';
    if (appNav.currentScreen === 'patients') return 'patients';
    return undefined;
  }, [appNav.currentScreen]);

  const refreshPatientTabs = useCallback(() => {
    setPatientTabsState(loadPatientTabs());
  }, [loadPatientTabs]);

  const updateOverflow = useCallback(() => {
    const list = dynamicListRef.current;
    if (!list) {
      setHasOverflow(false);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const overflow = list.scrollWidth > list.clientWidth + 1;
    setHasOverflow(overflow);
    if (!overflow) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const left = list.scrollLeft;
    const maxLeft = Math.max(0, list.scrollWidth - list.clientWidth);
    setCanScrollLeft(left > 1);
    setCanScrollRight(left < maxLeft - 1);
  }, []);

  useEffect(() => {
    refreshPatientTabs();
  }, [refreshPatientTabs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleTabsUpdated = () => refreshPatientTabs();
    window.addEventListener(CHARTS_PATIENT_TABS_UPDATED_EVENT, handleTabsUpdated);
    return () => {
      window.removeEventListener(CHARTS_PATIENT_TABS_UPDATED_EVENT, handleTabsUpdated);
    };
  }, [refreshPatientTabs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rafId = window.requestAnimationFrame(updateOverflow);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [dynamicTabs, updateOverflow]);

  useEffect(() => {
    const list = dynamicListRef.current;
    if (!list || typeof window === 'undefined') return;
    const handleResize = () => updateOverflow();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    observer?.observe(list);
    list.addEventListener('scroll', handleResize, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      observer?.disconnect();
      list.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [updateOverflow, dynamicTabs.length]);

  useEffect(() => {
    if (!hasOverflow) {
      setOverflowOpen(false);
    }
  }, [hasOverflow]);

  useEffect(() => {
    if (!overflowOpen || typeof window === 'undefined') return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOverflowOpen(false);
      }
    };
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (overflowRootRef.current?.contains(target)) return;
      setOverflowOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [overflowOpen]);

  const selectDynamicTab = useCallback(
    (tab: ChartsPatientTab) => {
      setOverflowOpen(false);
      if (isChartsScreen) {
        dispatchWorkspaceChartsTabRequest({ action: 'select', key: tab.key });
        return;
      }
      if (!hasHandoffEncounterKey(tab)) {
        return;
      }
      appNav.openCharts({
        encounter: {
          patientId: tab.patientId,
          appointmentId: tab.appointmentId,
          receptionId: tab.receptionId,
          scheduleKey: tab.scheduleKey,
          encounterKey: tab.encounterKey,
          visitDate: tab.visitDate,
        },
      });
    },
    [appNav, isChartsScreen],
  );

  const closeDynamicTab = useCallback(
    (key: string) => {
      if (isChartsScreen) {
        dispatchWorkspaceChartsTabRequest({ action: 'close', key });
        return;
      }

      const currentState = readChartsPatientTabsStorage(storageScope) ?? patientTabsState;
      const index = currentState.tabs.findIndex((tab) => tab.key === key);
      if (index < 0) return;
      const nextTabs = currentState.tabs.filter((tab) => tab.key !== key);
      const nextActiveTab = nextTabs[index - 1] ?? nextTabs[index] ?? nextTabs[0] ?? undefined;
      const now = new Date().toISOString();
      const nextState: ChartsPatientTabsStorage = {
        version: 1,
        updatedAt: now,
        savedAt: currentState.savedAt ?? now,
        activeKey: nextActiveTab?.key,
        tabs: nextTabs,
      };
      writeChartsPatientTabsStorage(nextState, storageScope);
      setPatientTabsState(nextState);
      dispatchChartsPatientTabsUpdated();
    },
    [isChartsScreen, patientTabsState, storageScope],
  );

  const suppressCloseMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleCloseButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, key: string) => {
      event.preventDefault();
      event.stopPropagation();
      closeDynamicTab(key);
    },
    [closeDynamicTab],
  );

  const handleOpenAdministration = useCallback(() => {
    navigate(buildFacilityPath(facilityId, '/administration'));
  }, [facilityId, navigate]);

  const scrollDynamicTabs = useCallback((direction: 'left' | 'right') => {
    const list = dynamicListRef.current;
    if (!list) return;
    const offset = Math.max(200, Math.floor(list.clientWidth * 0.55));
    list.scrollBy({
      left: direction === 'left' ? -offset : offset,
      behavior: 'smooth',
    });
  }, []);

  const handleTabKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const tabs = resolveTabListTabs(event.currentTarget);
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab.focus();
    nextTab.click();
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        nextTab.focus();
      });
    }
  }, []);

  return (
    <div className="app-shell__tabbar">
      <div className="workspace-tabs">
        <div className="workspace-tabs__fixed" role="tablist" aria-label="固定ワークスペースタブ">
          <button
            type="button"
            role="tab"
            className={`workspace-tabs__tab workspace-tabs__tab--shortcut workspace-tabs__tab--reception${activeFixedKey === 'reception' ? ' is-active' : ''}`}
            aria-selected={activeFixedKey === 'reception'}
            tabIndex={activeFixedKey === 'reception' ? 0 : -1}
            onClick={() => appNav.openReception()}
            onKeyDown={handleTabKeyDown}
          >
            <svg
              className="workspace-tabs__tab-icon"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 6V4" />
              <path d="M16 6V4" />
              <path d="M4 9h16" />
              <path d="M6 20h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2z" />
              <path d="M8 13h4" />
              <path d="M8 16h6" />
            </svg>
            受付
          </button>
          <button
            type="button"
            role="tab"
            className={`workspace-tabs__tab workspace-tabs__tab--shortcut workspace-tabs__tab--patients${activeFixedKey === 'patients' ? ' is-active' : ''}`}
            aria-selected={activeFixedKey === 'patients'}
            tabIndex={activeFixedKey === 'patients' ? 0 : -1}
            onClick={() => appNav.openPatients()}
            onKeyDown={handleTabKeyDown}
          >
            <svg
              className="workspace-tabs__tab-icon"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="8" r="4" />
              <path d="M22 20v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            患者管理
          </button>
        </div>

        <div className="workspace-tabs__dynamic-area">
          <div className="workspace-tabs__dynamic-controls">
            {hasOverflow ? (
              <button
                type="button"
                className="workspace-tabs__scroll-btn"
                aria-label="患者タブを左へスクロール"
                onClick={() => scrollDynamicTabs('left')}
                disabled={!canScrollLeft}
              >
                {'<'}
              </button>
            ) : null}
            <div className="workspace-tabs__dynamic" ref={dynamicListRef} role="tablist" aria-label="患者ワークスペースタブ">
              {dynamicTabs.map((tab) => {
                const display = resolvePatientTabDisplay(tab);
                const isActive = activeDynamicKey === tab.key;
                return (
                  <div key={tab.key} className="workspace-tabs__item">
                    <button
                      type="button"
                      role="tab"
                      className={`workspace-tabs__tab workspace-tabs__tab--shortcut workspace-tabs__tab--chart workspace-tabs__tab--patient${isActive ? ' is-active' : ''}`}
                      aria-selected={isActive}
                      aria-label={display.accessibleLabel}
                      tabIndex={isActive ? 0 : -1}
                      title={display.title}
                      onClick={() => selectDynamicTab(tab)}
                      onKeyDown={handleTabKeyDown}
                    >
                      <svg
                        className="workspace-tabs__tab-icon"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 19a2 2 0 0 0 2 2h12" />
                        <path d="M6 2h12a2 2 0 0 1 2 2v16" />
                        <path d="M6 2a2 2 0 0 0-2 2v15" />
                        <path d="M8 6h8" />
                        <path d="M8 10h8" />
                        <path d="M8 14h6" />
                      </svg>
                      <span className="workspace-tabs__tab-labels">
                        <span className="workspace-tabs__tab-primary">{display.primary}</span>
                        <span className="workspace-tabs__tab-secondary">{display.secondary}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="workspace-tabs__close"
                      aria-label={`${display.accessibleLabel}を閉じる`}
                      onMouseDown={suppressCloseMouseDown}
                      onClick={(event) => handleCloseButtonClick(event, tab.key)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            {hasOverflow ? (
              <button
                type="button"
                className="workspace-tabs__scroll-btn"
                aria-label="患者タブを右へスクロール"
                onClick={() => scrollDynamicTabs('right')}
                disabled={!canScrollRight}
              >
                {'>'}
              </button>
            ) : null}
          </div>

          {hasOverflow ? (
            <div className="workspace-tabs__overflow" ref={overflowRootRef}>
              <button
                type="button"
                className="workspace-tabs__overflow-toggle"
                aria-label="患者タブ一覧を開く"
                aria-expanded={overflowOpen}
                onClick={() => setOverflowOpen((prev) => !prev)}
              >
                &gt;&gt;
              </button>
              {overflowOpen ? (
                <div className="workspace-tabs__overflow-panel" aria-label="患者タブ一覧">
                  {dynamicTabs.map((tab) => {
                    const display = resolvePatientTabDisplay(tab);
                    const isActive = activeDynamicKey === tab.key;
                    return (
                      <div key={`overflow-${tab.key}`} className="workspace-tabs__overflow-entry">
                        <button
                          type="button"
                          role="tab"
                          className={`workspace-tabs__tab workspace-tabs__tab--shortcut workspace-tabs__tab--chart workspace-tabs__tab--patient${isActive ? ' is-active' : ''}`}
                          aria-selected={isActive}
                          aria-label={display.accessibleLabel}
                          tabIndex={isActive ? 0 : -1}
                          title={display.title}
                          onClick={() => selectDynamicTab(tab)}
                          onKeyDown={handleTabKeyDown}
                        >
                          <span className="workspace-tabs__tab-labels">
                            <span className="workspace-tabs__tab-primary">{display.primary}</span>
                            <span className="workspace-tabs__tab-secondary">{display.secondary}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="workspace-tabs__close"
                          aria-label={`${display.accessibleLabel}を閉じる`}
                          onMouseDown={suppressCloseMouseDown}
                          onClick={(event) => handleCloseButtonClick(event, tab.key)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="workspace-tabs__actions" role="group" aria-label="ワークスペース操作">
          {isSystemAdmin && orcaStatus ? (
            <span
              className={`status-pill status-pill--xs status-pill--${orcaStatus.tone}`}
              role="status"
              aria-live="polite"
              title={orcaStatus.tooltip}
            >
              {orcaStatus.label}
            </span>
          ) : null}
          {isSystemAdmin ? (
            <button type="button" className="app-shell__admin" onClick={handleOpenAdministration} aria-label="管理画面を開く">
              管理画面
            </button>
          ) : null}
          <button type="button" className="app-shell__switch" onClick={onRequestSwitchAccount}>
            施設/ユーザー切替
          </button>
          <button type="button" className="app-shell__logout" onClick={onRequestLogout}>
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}
