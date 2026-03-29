import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { ReturnToBar } from '../ReturnToBar';

describe('ReturnToBar', () => {
  it('fallback だけでも surface-aware CTA を表示する', () => {
    render(
      <MemoryRouter>
        <ReturnToBar scope={{ facilityId: '0001', userId: 'doctor01' }} from="reception" fallbackUrl="/f/0001/reception" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: '戻り導線' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '受付から再開する' })).toHaveAttribute('href', '/f/0001/reception');
    expect(screen.getByText('患者文脈が必要な場合は受付で対象患者を選び直してください。')).toBeInTheDocument();
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
    expect(screen.getByText('戻ったあとに必要な患者・受診を選び直してください。')).toBeInTheDocument();
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
});
