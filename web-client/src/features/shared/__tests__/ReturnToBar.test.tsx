import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { ReturnToBar } from '../ReturnToBar';

const setMatchMedia = (matches: boolean) => {
  const listenerSet = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    matches,
    media: '(max-width: 720px)',
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listenerSet.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listenerSet.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listenerSet.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listenerSet.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      listenerSet.forEach((listener) => listener(event as MediaQueryListEvent));
      return true;
    },
  } as MediaQueryList;

  vi.stubGlobal('matchMedia', vi.fn(() => mediaQueryList));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQueryList),
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('ReturnToBar', () => {
  it('fallback だけでも surface-aware CTA を表示する', () => {
    render(
      <MemoryRouter>
        <ReturnToBar scope={{ facilityId: '0001', userId: 'doctor01' }} from="reception" fallbackUrl="/f/0001/reception" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: '戻り導線' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '受付から再開する' })).toHaveAttribute('href', '/f/0001/reception');
    expect(screen.getByText('患者文脈が引き継がれていない場合は、受付で対象患者を選び直してください。')).toBeInTheDocument();
  });

  it('returnTo がある場合は前の surface に戻る CTA を優先する', () => {
    render(
      <MemoryRouter>
        <ReturnToBar
          scope={{ facilityId: '0001', userId: 'doctor01' }}
          from="charts"
          returnTo="/f/0001/charts"
          fallbackUrl="/f/0001/charts"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'カルテへ戻る' })).toHaveAttribute('href', '/f/0001/charts');
    expect(screen.getByText('患者文脈は引き継がれていません。戻ったあとに患者と受診を選び直してください。')).toBeInTheDocument();
  });

  it('unsafe returnTo は direct return に使わず fallback に落とす', () => {
    render(
      <MemoryRouter>
        <ReturnToBar
          scope={{ facilityId: '0001', userId: 'doctor01' }}
          from="patients"
          returnTo="/f/9999/patients"
          fallbackUrl="/f/0001/charts"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '患者管理から再開する' })).toHaveAttribute('href', '/f/0001/charts');
    expect(screen.queryByRole('link', { name: '患者管理へ戻る' })).not.toBeInTheDocument();
  });

  it('showShortcuts=true かつ fallback が異なる場合は既定導線も併記する', () => {
    render(
      <MemoryRouter>
        <ReturnToBar
          scope={{ facilityId: '0001', userId: 'doctor01' }}
          from="patients"
          returnTo="/f/0001/patients"
          fallbackUrl="/f/0001/charts"
          showShortcuts
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '患者管理へ戻る' })).toHaveAttribute('href', '/f/0001/patients');
    expect(screen.getByRole('link', { name: 'カルテへ移動' })).toHaveAttribute('href', '/f/0001/charts');
  });

  it('narrow viewport でも recovery hint を link の説明として保持する', () => {
    setMatchMedia(true);

    render(
      <MemoryRouter>
        <ReturnToBar
          scope={{ facilityId: '0001', userId: 'doctor01' }}
          from="reception"
          returnTo="/f/0001/reception"
          fallbackUrl="/f/0001/charts"
        />
      </MemoryRouter>,
    );

    const region = screen.getByRole('region', { name: '戻り導線' });
    expect(region).toHaveAttribute('data-layout', 'narrow');
    expect(screen.getByRole('link', { name: '受付へ戻る' })).toHaveAccessibleDescription(
      '患者文脈は引き継がれていません。戻ったあとに対象患者を選び直せます。',
    );
  });
});
