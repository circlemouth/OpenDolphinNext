import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

// BroadcastChannel が Node 環境で Event インスタンスを要求して失敗するため、テストでは簡易モックを適用
class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(name: string) {
    this.name = name;
  }
  postMessage(_data: unknown) {}
  addEventListener(_type: string, _listener: (ev: MessageEvent) => void) {}
  removeEventListener(_type: string, _listener: (ev: MessageEvent) => void) {}
  close() {}
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.BroadcastChannel = MockBroadcastChannel;

const installObjectUrlMock = () => {
  const urlObject = globalThis.URL;
  if (!urlObject) return;
  Object.defineProperty(urlObject, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:opendolphin-test-object-url'),
  });
  Object.defineProperty(urlObject, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
};

installObjectUrlMock();

if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    pointerId: number;

    constructor(type: string, params: MouseEventInit & { pointerId?: number } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.PointerEvent = MockPointerEvent;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalThis.PointerEvent = MockPointerEvent;
}

beforeEach(() => {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector("meta[name='csrf-token']");
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    document.head.appendChild(meta);
  }
  if (!(meta instanceof HTMLMetaElement)) return;
  if (!meta.content.trim()) {
    meta.content = 'test-csrf-token';
  }
});
