export type SessionExpiryReason = 'unauthorized' | 'forbidden' | 'timeout';

export type SessionExpiryNotice = {
  reason: SessionExpiryReason;
  status?: number;
  occurredAt: string;
  message: string;
};

export const SESSION_EXPIRED_EVENT = 'opendolphin:session-expired';
export const SESSION_EXPIRED_BROADCAST_CHANNEL = 'opendolphin:web-client:session-expired';
export const SESSION_EXPIRED_STORAGE_KEY = 'opendolphin:web-client:session-expired';
export const SESSION_EXPIRED_BROADCAST_STORAGE_KEY = `${SESSION_EXPIRED_STORAGE_KEY}:broadcast`;
export const SESSION_EXPIRED_DEBOUNCE_STORAGE_KEY = `${SESSION_EXPIRED_STORAGE_KEY}:last-notified`;

const SESSION_EXPIRED_DEBOUNCE_MS = 5000;

type SessionExpiryEnvelope = {
  id: string;
  notice: SessionExpiryNotice;
};

let lastNotifiedAt = 0;
let lastHandledId: string | null = null;
let broadcastChannel: BroadcastChannel | null = null;
const STORAGE_LISTENER_FLAG = '__opdSessionExpiryStorageListenerRegistered';
const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

const buildMessage = (reason: SessionExpiryReason) => {
  if (reason === 'forbidden') {
    return 'この画面へのアクセス権限を確認できませんでした。権限を確認して再ログインしてください。';
  }
  if (reason === 'timeout') {
    return 'セッションの有効期限が切れました。再ログインしてください。';
  }
  return 'ログイン状態を確認できませんでした。再ログインしてください。';
};

const generateEnvelopeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-expired-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const persistNoticeForLogin = (notice: SessionExpiryNotice) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, JSON.stringify(notice));
  } catch {
    // ignore storage errors
  }
};

const dispatchSessionExpiredEvent = (notice: SessionExpiryNotice) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: notice }));
};

const readSharedLastNotifiedAt = () => {
  if (typeof localStorage === 'undefined') return lastNotifiedAt;
  try {
    const stored = Number(localStorage.getItem(SESSION_EXPIRED_DEBOUNCE_STORAGE_KEY));
    if (Number.isFinite(stored)) {
      return Math.max(lastNotifiedAt, stored);
    }
  } catch {
    // ignore storage errors
  }
  return lastNotifiedAt;
};

const updateSharedLastNotifiedAt = (timestamp: number) => {
  lastNotifiedAt = timestamp;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SESSION_EXPIRED_DEBOUNCE_STORAGE_KEY, String(timestamp));
  } catch {
    // ignore storage errors
  }
};

const resolveBroadcastChannelCtor = () => {
  if (isTestEnv && !(window as typeof window & { __OPD_ALLOW_BROADCAST_IN_TESTS?: boolean }).__OPD_ALLOW_BROADCAST_IN_TESTS) {
    return null;
  }
  if (typeof window === 'undefined') return null;
  const ctor = window.BroadcastChannel;
  return typeof ctor === 'function' ? ctor : null;
};

const ensureBroadcastChannel = () => {
  if (broadcastChannel) return broadcastChannel;
  const BroadcastChannelCtor = resolveBroadcastChannelCtor();
  if (!BroadcastChannelCtor) return null;

  broadcastChannel = new BroadcastChannelCtor(SESSION_EXPIRED_BROADCAST_CHANNEL);
  broadcastChannel.addEventListener('message', (event) => {
    handleRemoteSessionExpiry((event as MessageEvent).data as SessionExpiryEnvelope | null);
  });
  return broadcastChannel;
};

const emitStorageBroadcast = (envelope: SessionExpiryEnvelope) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SESSION_EXPIRED_BROADCAST_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore storage errors
  }
};

const broadcastSessionExpiry = (envelope: SessionExpiryEnvelope) => {
  try {
    ensureBroadcastChannel()?.postMessage(envelope);
  } catch {
    // ignore broadcast failures (e.g., unsupported BroadcastChannel in test/runtime)
  }
  emitStorageBroadcast(envelope);
};

const handleRemoteSessionExpiry = (envelope: SessionExpiryEnvelope | null) => {
  if (!envelope?.id || !envelope.notice) return;
  if (envelope.id === lastHandledId) return;
  lastHandledId = envelope.id;
  const timestamp = Date.parse(envelope.notice.occurredAt);
  updateSharedLastNotifiedAt(Number.isFinite(timestamp) ? timestamp : Date.now());
  persistNoticeForLogin(envelope.notice);
  dispatchSessionExpiredEvent(envelope.notice);
};

if (typeof window !== 'undefined') {
  const win = window as typeof window & { [STORAGE_LISTENER_FLAG]?: boolean };
  if (!win[STORAGE_LISTENER_FLAG]) {
    ensureBroadcastChannel();
    window.addEventListener('storage', (event) => {
      if (event.key !== SESSION_EXPIRED_BROADCAST_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as SessionExpiryEnvelope;
        handleRemoteSessionExpiry(parsed);
      } catch {
        // ignore parsing errors
      }
    });
    win[STORAGE_LISTENER_FLAG] = true;
  }
}

export function notifySessionExpired(reason: SessionExpiryReason, status?: number) {
  const now = Date.now();
  if (now - readSharedLastNotifiedAt() < SESSION_EXPIRED_DEBOUNCE_MS) return;

  const notice: SessionExpiryNotice = {
    reason,
    status,
    occurredAt: new Date(now).toISOString(),
    message: buildMessage(reason),
  };
  const envelope: SessionExpiryEnvelope = { id: generateEnvelopeId(), notice };

  updateSharedLastNotifiedAt(now);
  lastHandledId = envelope.id;
  persistNoticeForLogin(notice);
  dispatchSessionExpiredEvent(notice);
  broadcastSessionExpiry(envelope);
}

export function consumeSessionExpiredNotice(): SessionExpiryNotice | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY);
    const parsed = JSON.parse(raw) as SessionExpiryNotice;
    if (!parsed?.message) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionExpiredNotice() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
