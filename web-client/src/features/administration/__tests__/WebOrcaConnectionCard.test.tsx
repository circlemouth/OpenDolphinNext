import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { WebOrcaConnectionCard } from '../delivery/WebOrcaConnectionCard';

const baseForm = {
  useWeborca: true,
  serverUrl: 'https://weborca.example.invalid',
  port: '443',
  username: 'orca-admin',
  pushUrl: 'wss://push.example.invalid/ws',
  pushTenantId: 'tenant-01',
  password: '',
  passwordConfigured: true,
  passwordUpdatedAt: '2026-04-11T00:00:00Z',
  clientAuthEnabled: true,
  clientCertificateFile: null,
  clientCertificateConfigured: true,
  clientCertificateFileName: 'client.p12',
  clientCertificateUploadedAt: '2026-04-11T00:00:00Z',
  clientCertificatePassphrase: '',
  clientCertificatePassphraseConfigured: true,
  clientCertificatePassphraseUpdatedAt: '2026-04-11T00:00:00Z',
  caCertificateFile: null,
  caCertificateConfigured: false,
  caCertificateFileName: undefined,
  caCertificateUploadedAt: undefined,
  updatedAt: '2026-04-11T00:00:00Z',
};

describe('WebOrcaConnectionCard', () => {
  it('管理画面権限と ORCA 接続テストの文言を分離し、placeholder 説明を使わない', () => {
    render(
      <WebOrcaConnectionCard
        form={baseForm}
        fieldErrors={{}}
        isSystemAdmin
        accessVerified
        authBlocked={false}
        connectionCapability={{
          available: true,
          testedScope: 'api_only',
          hint: '接続テストは WebORCA API の到達確認のみで、push WebSocket の接続確認は行いません。',
        }}
        dirty={false}
        statusTone="ok"
        statusLabel="接続OK"
        testSummary={null}
        savePending={false}
        testPending={false}
        refetchPending={false}
        onPatch={vi.fn()}
        onToggleWeborca={vi.fn()}
        onSave={vi.fn()}
        onTest={vi.fn()}
        onRefetch={vi.fn()}
        onCopyRequestTemplate={vi.fn()}
        requestTemplate="request template"
      />,
    );

    expect(screen.getByText('管理画面権限: 確認済み')).toBeInTheDocument();
    expect(screen.getByText('ORCA接続テスト: 接続OK')).toBeInTheDocument();
    expect(screen.getByText('testedScope: API到達のみ')).toBeInTheDocument();
    expect(screen.getByText('Push保存状態: Push URL + tenant ID 設定済み')).toBeInTheDocument();
    expect(screen.getByText('Push URL を保存する場合のみ指定します。Push tenant ID 単独では保存できません。')).toBeInTheDocument();
    expect(screen.getByText('設定済み値は再表示しません。変更時のみ入力してください。mTLS を OFF にしている間は編集できません。')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード / APIキー')).not.toHaveAttribute('placeholder');
    expect(screen.getByLabelText('証明書パスフレーズ')).not.toHaveAttribute('placeholder');
  });

  it('権限未取得時は接続成功と混同しない依頼テンプレを表示する', () => {
    render(
      <WebOrcaConnectionCard
        form={{ ...baseForm, pushUrl: '', pushTenantId: '', clientAuthEnabled: false }}
        fieldErrors={{}}
        isSystemAdmin
        accessVerified={false}
        authBlocked
        connectionCapability={{
          available: true,
          testedScope: 'api_only',
        }}
        dirty={false}
        statusTone="idle"
        statusLabel="未実行"
        testSummary={null}
        savePending={false}
        testPending={false}
        refetchPending={false}
        onPatch={vi.fn()}
        onToggleWeborca={vi.fn()}
        onSave={vi.fn()}
        onTest={vi.fn()}
        onRefetch={vi.fn()}
        onCopyRequestTemplate={vi.fn()}
        requestTemplate="request template"
      />,
    );

    expect(
      screen.getByText('WebORCA 接続設定は管理画面の接続設定取得権限が確認できたセッションでのみ表示します。この状態は ORCA 接続成功を意味しません。'),
    ).toBeInTheDocument();
    expect(screen.getByText('管理画面権限: 未取得 / 権限不足')).toBeInTheDocument();
    expect(screen.getByText('ORCA 接続成否: 接続テスト未実行')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '依頼テンプレをコピー' })).toBeInTheDocument();
  });
});
