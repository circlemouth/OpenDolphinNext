import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockBroadcastChannel {
  static channelListeners = new Map<string, Set<(event: MessageEvent) => void>>();
  name: string;
  listeners: Set<(event: MessageEvent) => void>;

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channelListeners.has(name)) {
      MockBroadcastChannel.channelListeners.set(name, new Set());
    }
    this.listeners = new Set();
  }

  postMessage(data: unknown) {
    const listeners = MockBroadcastChannel.channelListeners.get(this.name);
    listeners?.forEach((listener) => listener({ data } as MessageEvent));
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    const listeners = MockBroadcastChannel.channelListeners.get(this.name);
    listeners?.add(listener);
    this.listeners.add(listener);
  }

  close() {
    const listeners = MockBroadcastChannel.channelListeners.get(this.name);
    this.listeners.forEach((listener) => listeners?.delete(listener));
    this.listeners.clear();
  }
}

describe('sessionExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T00:00:00Z'));
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
    (globalThis as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
    (window as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
    // Reload module state for each test
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches event, stores notice for login, and shares debounce timestamp', async () => {
    const {
      notifySessionExpired: notify,
      SESSION_EXPIRED_EVENT,
      SESSION_EXPIRED_STORAGE_KEY,
      SESSION_EXPIRED_DEBOUNCE_STORAGE_KEY,
    } = await import('./sessionExpiry');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    notify('unauthorized', 401);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const customEvent = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(customEvent.type).toBe(SESSION_EXPIRED_EVENT);
    expect(sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY)).toContain('unauthorized');
    expect(localStorage.getItem(SESSION_EXPIRED_DEBOUNCE_STORAGE_KEY)).not.toBeNull();
    expect(customEvent.detail.message).toContain('ログイン状態を確認できませんでした');
  });

  it('debounces within window and across tabs via shared timestamp', async () => {
    const { notifySessionExpired: notify, SESSION_EXPIRED_DEBOUNCE_STORAGE_KEY } = await import('./sessionExpiry');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    notify('unauthorized', 401);
    // Within debounce window
    vi.advanceTimersByTime(1000);
    notify('timeout', 419);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    // Simulate another tab by pre-populating last-notified timestamp in localStorage
    localStorage.setItem(SESSION_EXPIRED_DEBOUNCE_STORAGE_KEY, `${Date.now()}`);
    vi.advanceTimersByTime(1000);
    notify('unauthorized', 401);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('receives storage-broadcast from another tab and re-dispatches event with same message', async () => {
    const {
      notifySessionExpired: notify,
      SESSION_EXPIRED_BROADCAST_STORAGE_KEY,
      SESSION_EXPIRED_EVENT,
    } = await import('./sessionExpiry');
    const handler = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, handler as EventListener);

    // first tab notifies (sets lastHandledId to avoid self-loop)
    notify('unauthorized', 401);
    handler.mockClear();

    const envelope = {
      id: 'remote-1',
      notice: {
        reason: 'timeout',
        status: 419,
        occurredAt: new Date().toISOString(),
        message: 'timeout',
      },
    };
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: SESSION_EXPIRED_BROADCAST_STORAGE_KEY,
        newValue: JSON.stringify(envelope),
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.reason).toBe('timeout');
  });

  it('shares debounce across tabs via BroadcastChannel and suppresses duplicate notifications', async () => {
    (window as typeof window & { __OPD_ALLOW_BROADCAST_IN_TESTS?: boolean }).__OPD_ALLOW_BROADCAST_IN_TESTS = true;
    const {
      notifySessionExpired: notify,
      SESSION_EXPIRED_BROADCAST_CHANNEL,
    } = await import('./sessionExpiry');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    notify('unauthorized', 401);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    dispatchSpy.mockClear();

    vi.advanceTimersByTime(2_000);
    const remoteChannel = new BroadcastChannel(SESSION_EXPIRED_BROADCAST_CHANNEL);
    remoteChannel.postMessage({
      id: 'remote-1',
      notice: {
        reason: 'timeout',
        status: 419,
        occurredAt: new Date().toISOString(),
        message: 'timeout',
      },
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    notify('unauthorized', 401);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    // cleanup flag for subsequent tests
    delete (window as typeof window & { __OPD_ALLOW_BROADCAST_IN_TESTS?: boolean }).__OPD_ALLOW_BROADCAST_IN_TESTS;
  });
});
