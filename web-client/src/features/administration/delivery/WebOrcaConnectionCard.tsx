import { AdminCard } from '../components/AdminCard';
import { AdminField } from '../components/AdminField';
import { AdminStatusPill } from '../components/AdminStatusPill';
import { DirtyStateBar } from '../components/DirtyStateBar';

type OrcaConnectionFormValue = {
  useWeborca: boolean;
  serverUrl: string;
  port: string;
  username: string;
  pushUrl: string;
  pushTenantId: string;
  password: string;
  passwordConfigured: boolean;
  passwordUpdatedAt?: string;
  clientAuthEnabled: boolean;
  clientCertificateFile: File | null;
  clientCertificateConfigured: boolean;
  clientCertificateFileName?: string;
  clientCertificateUploadedAt?: string;
  clientCertificatePassphrase: string;
  clientCertificatePassphraseConfigured: boolean;
  clientCertificatePassphraseUpdatedAt?: string;
  caCertificateFile: File | null;
  caCertificateConfigured: boolean;
  caCertificateFileName?: string;
  caCertificateUploadedAt?: string;
  updatedAt?: string;
};

type ConnectionFieldErrors = {
  serverUrl?: string;
  port?: string;
  username?: string;
  password?: string;
  clientCertificate?: string;
  clientCertificatePassphrase?: string;
};

type OrcaConnectionTestSummary = {
  ok: boolean;
  orcaHttpStatus?: number;
  apiResult?: string;
  apiResultMessage?: string;
  errorCategory?: string;
  error?: string;
  testedAt?: string;
};

type WebOrcaConnectionCardProps = {
  form: OrcaConnectionFormValue;
  fieldErrors: ConnectionFieldErrors;
  isSystemAdmin: boolean;
  accessVerified: boolean;
  authBlocked: boolean;
  dirty: boolean;
  statusTone: 'ok' | 'warn' | 'error' | 'pending' | 'idle';
  statusLabel: string;
  testSummary: OrcaConnectionTestSummary | null;
  savePending: boolean;
  testPending: boolean;
  refetchPending: boolean;
  onPatch: (patch: Partial<OrcaConnectionFormValue>) => void;
  onToggleWeborca: (next: boolean) => void;
  onSave: () => void;
  onTest: () => void;
  onRefetch: () => void;
  onCopyRequestTemplate: () => void;
  requestTemplate: string;
  guardDetailsId?: string;
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

export function WebOrcaConnectionCard({
  form,
  fieldErrors,
  isSystemAdmin,
  accessVerified,
  authBlocked,
  dirty,
  statusTone,
  statusLabel,
  testSummary,
  savePending,
  testPending,
  refetchPending,
  onPatch,
  onToggleWeborca,
  onSave,
  onTest,
  onRefetch,
  onCopyRequestTemplate,
  requestTemplate,
  guardDetailsId,
}: WebOrcaConnectionCardProps) {
  const disabledByRole = !isSystemAdmin;
  const accessStatusLabel = accessVerified ? '設定取得可' : authBlocked ? '権限要確認' : '未確認';
  const accessStatusTone = accessVerified ? 'ok' : authBlocked ? 'error' : 'idle';

  return (
    <AdminCard
      title="WebORCA接続設定"
      description="管理画面権限、接続先設定、ORCA接続テストを分離して扱い、local admin 権限と ORCA 到達確認を混同しません。"
      status={<AdminStatusPill status={statusTone} value={`接続テスト: ${statusLabel}`} />}
    >
      {accessVerified ? (
        <>
          <div className="admin-inline-meta">
            <AdminStatusPill status={accessStatusTone} value={`管理画面権限: ${accessStatusLabel}`} />
            <AdminStatusPill status={statusTone} value={`ORCA接続テスト: ${statusLabel}`} />
          </div>
          <p className="admin-note">
            接続テストは保存済み設定で実行されます。未保存の変更（ドラフト）は反映されません。管理画面が表示できても ORCA 接続成功とは限りません。
          </p>
          <DirtyStateBar dirty={dirty} updatedAt={form.updatedAt} />

          <div className="admin-group">
            <h3 className="admin-group__title">接続先</h3>
            <div className="admin-form__toggles">
              <div className="admin-toggle">
                <div className="admin-toggle__label">
                  <span>WebORCAモード（/api自動付与）</span>
                  <span className="admin-toggle__hint">ON:443 / OFF:8000（必要に応じて変更）</span>
                </div>
                <input
                  id="orca-connection-use-weborca"
                  type="checkbox"
                  checked={form.useWeborca}
                  onChange={(event) => onToggleWeborca(event.target.checked)}
                  disabled={disabledByRole}
                  aria-describedby={disabledByRole ? guardDetailsId : undefined}
                />
              </div>
            </div>
            <AdminField
              label="サーバURL"
              htmlFor="orca-connection-server-url"
              required
              error={fieldErrors.serverUrl}
              hint="例: https://weborca.cloud.orcamo.jp"
            >
              <input
                id="orca-connection-server-url"
                type="text"
                value={form.serverUrl}
                onChange={(event) => onPatch({ serverUrl: event.target.value })}
                readOnly={disabledByRole}
                aria-readonly={disabledByRole}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
              />
            </AdminField>
            <AdminField
              label="ポート"
              htmlFor="orca-connection-port"
              required
              error={fieldErrors.port}
              hint="1〜65535（既定値: WebORCA=443 / オンプレ=8000）"
            >
              <input
                id="orca-connection-port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(event) => onPatch({ port: event.target.value })}
                readOnly={disabledByRole}
                aria-readonly={disabledByRole}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
              />
            </AdminField>
          </div>

          <div className="admin-group">
            <h3 className="admin-group__title">認証</h3>
            <AdminField label="ユーザー名" htmlFor="orca-connection-username" required error={fieldErrors.username}>
              <input
                id="orca-connection-username"
                type="text"
                value={form.username}
                onChange={(event) => onPatch({ username: event.target.value })}
                readOnly={disabledByRole}
                aria-readonly={disabledByRole}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
              />
            </AdminField>
            <AdminField
              label="パスワード / APIキー"
              htmlFor="orca-connection-password"
              error={fieldErrors.password}
              hint="秘密情報は再表示されません。変更時のみ入力してください。"
            >
              <input
                id="orca-connection-password"
                type="password"
                value={form.password}
                onChange={(event) => onPatch({ password: event.target.value })}
                readOnly={disabledByRole}
                aria-readonly={disabledByRole}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
                placeholder={form.passwordConfigured ? '（設定済み。変更時のみ入力）' : ''}
              />
              <div className="admin-inline-meta">
                <AdminStatusPill status={form.passwordConfigured ? 'ok' : 'idle'} value={form.passwordConfigured ? '設定済み' : '未設定'} />
                <span>最終更新: {formatTimestamp(form.passwordUpdatedAt)}</span>
              </div>
            </AdminField>
          </div>

          <div className="admin-group">
            <h3 className="admin-group__title">Push 連携（任意）</h3>
            <AdminField label="Push URL" htmlFor="orca-connection-push-url" hint="例: wss://push.example.orca/ws">
              <input
                id="orca-connection-push-url"
                type="url"
                value={form.pushUrl}
                onChange={(event) => onPatch({ pushUrl: event.target.value })}
                readOnly={disabledByRole}
                aria-readonly={disabledByRole}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
              />
            </AdminField>
            <AdminField
              label="Push tenant ID"
              htmlFor="orca-connection-push-tenant-id"
              hint="Push 利用時のみ指定します。"
            >
              <input
                id="orca-connection-push-tenant-id"
                type="text"
                value={form.pushTenantId}
                onChange={(event) => onPatch({ pushTenantId: event.target.value })}
                readOnly={disabledByRole}
                aria-readonly={disabledByRole}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
              />
            </AdminField>
          </div>

          <div className="admin-group">
            <h3 className="admin-group__title">証明書（mTLS）</h3>
            <div className="admin-form__toggles">
              <div className="admin-toggle">
                <div className="admin-toggle__label">
                  <span>mTLS</span>
                  <span className="admin-toggle__hint">ON の場合は p12 と passphrase が必須</span>
                </div>
                <input
                  id="orca-connection-client-auth-enabled"
                  type="checkbox"
                  checked={form.clientAuthEnabled}
                  onChange={(event) => onPatch({ clientAuthEnabled: event.target.checked })}
                  disabled={disabledByRole}
                  aria-describedby={disabledByRole ? guardDetailsId : undefined}
                />
              </div>
            </div>
            <AdminField
              label="クライアント証明書（.p12）"
              htmlFor="orca-connection-client-cert"
              error={fieldErrors.clientCertificate}
              hint="設定済みの場合も変更時のみ再アップロードしてください。"
            >
              <input
                id="orca-connection-client-cert"
                type="file"
                accept=".p12,.pfx,application/x-pkcs12"
                onChange={(event) => onPatch({ clientCertificateFile: event.target.files?.[0] ?? null })}
                disabled={disabledByRole || !form.clientAuthEnabled}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
              />
              <div className="admin-inline-meta">
                <AdminStatusPill
                  status={form.clientCertificateConfigured ? 'ok' : 'idle'}
                  value={form.clientCertificateConfigured ? '設定済み' : '未設定'}
                />
                <span>{form.clientCertificateFileName ?? 'ファイル名なし'}</span>
                <span>{formatTimestamp(form.clientCertificateUploadedAt)}</span>
              </div>
            </AdminField>
            <AdminField
              label="証明書パスフレーズ"
              htmlFor="orca-connection-client-passphrase"
              error={fieldErrors.clientCertificatePassphrase}
            >
              <input
                id="orca-connection-client-passphrase"
                type="password"
                value={form.clientCertificatePassphrase}
                onChange={(event) => onPatch({ clientCertificatePassphrase: event.target.value })}
                readOnly={disabledByRole || !form.clientAuthEnabled}
                aria-readonly={disabledByRole || !form.clientAuthEnabled}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
                placeholder={form.clientCertificatePassphraseConfigured ? '（設定済み。変更時のみ入力）' : ''}
              />
              <div className="admin-inline-meta">
                <AdminStatusPill
                  status={form.clientCertificatePassphraseConfigured ? 'ok' : 'idle'}
                  value={form.clientCertificatePassphraseConfigured ? '設定済み' : '未設定'}
                />
                <span>{formatTimestamp(form.clientCertificatePassphraseUpdatedAt)}</span>
              </div>
            </AdminField>
            <AdminField label="CA証明書（任意）" htmlFor="orca-connection-ca-cert">
              <input
                id="orca-connection-ca-cert"
                type="file"
                accept=".crt,.pem,.cer,application/x-x509-ca-cert"
                onChange={(event) => onPatch({ caCertificateFile: event.target.files?.[0] ?? null })}
                disabled={disabledByRole}
                aria-describedby={disabledByRole ? guardDetailsId : undefined}
              />
              <div className="admin-inline-meta">
                <AdminStatusPill status={form.caCertificateConfigured ? 'ok' : 'idle'} value={form.caCertificateConfigured ? '設定済み' : '未設定'} />
                <span>{form.caCertificateFileName ?? 'ファイル名なし'}</span>
                <span>{formatTimestamp(form.caCertificateUploadedAt)}</span>
              </div>
            </AdminField>
          </div>

          <p className="admin-quiet">ドラフト一時テストは未対応です。必要な場合は保存後に接続テストを実行してください。</p>

          <div className="admin-actions">
            <button type="button" className="admin-button admin-button--primary" onClick={onSave} disabled={savePending || disabledByRole}>
              保存
            </button>
            <button type="button" className="admin-button admin-button--secondary" onClick={onRefetch} disabled={refetchPending}>
              再取得
            </button>
            <button type="button" className="admin-button admin-button--secondary" onClick={onTest} disabled={testPending || disabledByRole}>
              接続テスト
            </button>
          </div>

          {testSummary ? (
            <div className="admin-result admin-result--stack">
              <div>結果: {testSummary.ok ? '接続テスト成功' : '接続テスト失敗'}</div>
              <div>HTTP: {testSummary.orcaHttpStatus ?? '―'}</div>
              <div>Api_Result: {testSummary.apiResult ?? '―'}</div>
              <div>testedAt: {formatTimestamp(testSummary.testedAt)}</div>
              {!testSummary.ok ? <div>失敗理由の詳細は通常表示に出さず、RUN_ID と traceId で確認します。</div> : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="admin-form">
          <p className="admin-note">
            WebORCA 接続設定は管理画面の接続設定取得権限が確認できたセッションでのみ表示します。この状態は ORCA 接続成功を意味しません。
          </p>
          <ul className="placeholder-page__list">
            <li>管理画面権限: {authBlocked ? '未取得 / 権限不足' : '確認中または未取得'}</li>
            <li>ORCA 接続成否: 接続テスト未実行</li>
            <li>運用依頼テンプレをコピーして管理者へ依頼してください。</li>
          </ul>
          <div className="admin-request-template">
            <textarea value={requestTemplate} readOnly rows={6} aria-label="権限依頼テンプレート" />
            <button type="button" className="admin-button admin-button--secondary" onClick={onCopyRequestTemplate}>
              依頼テンプレをコピー
            </button>
          </div>
          <div className="admin-actions">
            <button type="button" className="admin-button admin-button--secondary" onClick={onRefetch} disabled={refetchPending}>
              権限状態を再確認
            </button>
          </div>
        </div>
      )}
    </AdminCard>
  );
}
