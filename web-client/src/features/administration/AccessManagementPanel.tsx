import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { isSystemAdminRole } from '../../libs/auth/roles';
import { logAuditEvent } from '../../libs/audit/auditLogger';
import { resolveAriaLive } from '../../libs/observability/observability';
import { useSession } from '../../AppRouter';
import {
  ACCESS_PASSWORD_RESET_PUBLIC_ROUTE_AVAILABLE,
  createAccessUser,
  fetchAccessUsers,
  resetAccessUserPassword,
  updateAccessUser,
  type AccessManagedUser,
  type AccessSex,
  type AccessUserUpsertPayload,
  type ApiFailure,
} from './accessManagementApi';

type AccessManagementPanelProps = {
  runId: string;
  role?: string;
  mode?: 'full' | 'linked-only';
};

type Feedback = { tone: 'success' | 'warning' | 'error' | 'info'; message: string };

const ROLE_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'admin', label: '管理者 (admin)', hint: 'Administration へのアクセスを許可' },
  { id: 'system-administrator', label: '管理者 (system-administrator)', hint: 'Legacy seed 互換' },
  { id: 'doctor', label: '医師 (doctor)', hint: '医師向け機能を想定' },
  { id: 'nurse', label: '看護師 (nurse)', hint: '看護師向け機能を想定' },
  { id: 'reception', label: '受付 (reception)', hint: '受付・患者更新を想定' },
  { id: 'clerk', label: '事務 (clerk)', hint: '患者更新を想定' },
  { id: 'office', label: '事務 (office)', hint: '患者更新を想定' },
  { id: 'user', label: '一般 (user)', hint: '基本ロール（常時付与）' },
];

const STAFF_ROLE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: '', label: '未設定' },
  { id: 'doctor', label: '医師' },
  { id: 'nurse', label: '看護師' },
  { id: 'reception', label: '受付' },
  { id: 'clerk', label: '事務' },
  { id: 'office', label: '事務（office）' },
  { id: 'admin', label: '管理者' },
  { id: 'other', label: 'その他' },
];

const SEX_OPTIONS: Array<{ id: '' | AccessSex; label: string }> = [
  { id: '', label: '未設定' },
  { id: 'M', label: 'M (male)' },
  { id: 'F', label: 'F (female)' },
  { id: 'O', label: 'O (other/unknown)' },
];

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const normalizeRoles = (roles?: string[]) => {
  const set = new Set((roles ?? []).map((r) => (r ?? '').trim()).filter(Boolean));
  set.add('user');
  const list = Array.from(set);
  // Prefer admin-ish roles first for readability.
  list.sort((a, b) => {
    const rank = (v: string) => (v === 'admin' || v === 'system-administrator' ? 0 : v === 'doctor' ? 1 : 2);
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
  return list;
};

const buildEmptyCreateDraft = (): AccessUserUpsertPayload => ({
  loginId: '',
  password: '',
  displayName: '',
  sirName: '',
  givenName: '',
  email: '',
  sex: '',
  staffRole: '',
  roles: ['user'],
});

const buildEditDraft = (user: AccessManagedUser): AccessUserUpsertPayload => ({
  displayName: user.displayName ?? '',
  sirName: user.sirName ?? '',
  givenName: user.givenName ?? '',
  email: user.email ?? '',
  sex: (user.sex ?? '') as AccessSex | '',
  staffRole: user.staffRole ?? '',
  roles: normalizeRoles(user.roles),
});

export function AccessManagementPanel({ runId, role, mode = 'full' }: AccessManagementPanelProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const isSystemAdmin = isSystemAdminRole(role ?? session.role);
  const linkedOnlyMode = mode === 'linked-only';
  const infoLive = resolveAriaLive('info');

  const [keyword, setKeyword] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<AccessUserUpsertPayload>(() => buildEmptyCreateDraft());

  const [editTarget, setEditTarget] = useState<AccessManagedUser | null>(null);
  const [editDraft, setEditDraft] = useState<AccessUserUpsertPayload | null>(null);

  const [resetTarget, setResetTarget] = useState<AccessManagedUser | null>(null);
  const [resetTemporaryPassword, setResetTemporaryPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-access-users'],
    queryFn: fetchAccessUsers,
    enabled: isSystemAdmin,
    staleTime: 30_000,
  });

  const users = usersQuery.data?.users ?? [];
  const linkedUsers = useMemo(() => users.filter((u) => u.orcaLink?.linked), [users]);
  const targetUsers = linkedOnlyMode ? linkedUsers : users;
  const filteredUsers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return targetUsers;
    return targetUsers.filter((u) => {
      const hay = [
        u.loginId,
        u.displayName,
        u.sirName,
        u.givenName,
        u.email,
        u.orcaLink?.orcaUserId,
        ...(u.roles ?? []),
        u.staffRole ?? '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [keyword, targetUsers]);

  const createMutation = useMutation({
    mutationFn: (payload: AccessUserUpsertPayload) => createAccessUser(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-users'] });
      setFeedback({ tone: 'success', message: `作成しました: ${created.loginId}` });
      setCreateOpen(false);
      setCreateDraft(buildEmptyCreateDraft());
      logAuditEvent({
        runId,
        source: 'admin/access',
        note: 'user created',
        payload: { operation: 'create', actor: `${session.facilityId}:${session.userId}`, targetUserPk: created.userPk },
      });
    },
    onError: (error) => {
      setFeedback({ tone: 'error', message: `作成に失敗しました: ${toErrorMessage(error)}` });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { userPk: number; payload: AccessUserUpsertPayload }) => updateAccessUser(params.userPk, params.payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-users'] });
      setFeedback({ tone: 'success', message: `更新しました: ${updated.loginId}` });
      setEditTarget(null);
      setEditDraft(null);
      logAuditEvent({
        runId,
        source: 'admin/access',
        note: 'user updated',
        payload: { operation: 'update', actor: `${session.facilityId}:${session.userId}`, targetUserPk: updated.userPk },
      });
    },
    onError: (error) => {
      setFeedback({ tone: 'error', message: `更新に失敗しました: ${toErrorMessage(error)}` });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (params: { userPk: number; totpCode: string; temporaryPassword: string; targetUserPk: number }) =>
      resetAccessUserPassword(params.userPk, {
        totpCode: params.totpCode,
        temporaryPassword: params.temporaryPassword,
      }),
    onSuccess: (_unused, params) => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-users'] });
      setFeedback({ tone: 'success', message: 'パスワードをリセットしました。' });
      logAuditEvent({
        runId,
        source: 'admin/access',
        note: 'password reset',
        payload: {
          operation: 'password-reset',
          actor: `${session.facilityId}:${session.userId}`,
          targetUserPk: params.targetUserPk,
        },
      });
      setResetTarget(null);
      setResetTemporaryPassword('');
      setTotpCode('');
    },
    onError: (error: unknown) => {
      const api = error as ApiFailure;
      const extra =
        api?.errorCode === 'totp_missing'
          ? 'Authenticator（TOTP）未登録の管理者では実行できません。'
          : api?.errorCode === 'totp_required'
            ? 'TOTP コードが必要です。'
            : api?.errorCode === 'totp_invalid'
              ? 'TOTP コードが不正です。'
              : api?.errorCode === 'route_blocked'
                ? '現行 public contract では未公開のため実行できません。'
              : undefined;
      setFeedback({ tone: 'error', message: `パスワードリセットに失敗しました: ${extra ?? toErrorMessage(error)}` });
    },
  });

  const openCreate = () => {
    if (linkedOnlyMode) return;
    setFeedback(null);
    setCreateDraft(buildEmptyCreateDraft());
    setCreateOpen(true);
  };

  const openEdit = (user: AccessManagedUser) => {
    setFeedback(null);
    setEditTarget(user);
    setEditDraft(buildEditDraft(user));
  };

  const openReset = (user: AccessManagedUser) => {
    if (linkedOnlyMode) return;
    setFeedback(null);
    setResetTarget(user);
    setResetTemporaryPassword('');
    setTotpCode('');
  };

  const validateCreateDraft = (draft: AccessUserUpsertPayload): string | null => {
    const loginId = (draft.loginId ?? '').trim();
    const displayName = (draft.displayName ?? '').trim();
    const password = draft.password ?? '';
    if (!loginId) return 'loginId は必須です。';
    if (loginId.includes(':') || loginId.includes(' ')) return "loginId に ':' や空白は使用できません。";
    if (!displayName) return '氏名（displayName）は必須です。';
    if (!password) return 'password は必須です。';
    if (password.length < 8) return 'password は 8 文字以上にしてください。';
    return null;
  };

  const handleSubmitCreate = () => {
    if (linkedOnlyMode) return;
    const error = validateCreateDraft(createDraft);
    if (error) {
      setFeedback({ tone: 'error', message: error });
      return;
    }
    const payload: AccessUserUpsertPayload = {
      ...createDraft,
      roles: normalizeRoles(createDraft.roles),
    };
    createMutation.mutate(payload);
  };

  const handleSubmitEdit = () => {
    if (!editTarget || !editDraft) return;
    const payload: AccessUserUpsertPayload = linkedOnlyMode
      ? { roles: normalizeRoles(editDraft.roles) }
      : {
          ...editDraft,
          roles: normalizeRoles(editDraft.roles),
        };
    updateMutation.mutate({ userPk: editTarget.userPk, payload });
  };

  const handleSubmitReset = () => {
    if (!resetTarget) return;
    const temporaryPassword = resetTemporaryPassword.trim();
    const code = totpCode.trim();
    if (!temporaryPassword) {
      setFeedback({ tone: 'error', message: '一時パスワードを入力してください。' });
      return;
    }
    if (!code) {
      setFeedback({ tone: 'error', message: 'TOTP コードを入力してください。' });
      return;
    }
    resetMutation.mutate({
      userPk: resetTarget.userPk,
      totpCode: code,
      temporaryPassword,
      targetUserPk: resetTarget.userPk,
    });
  };

  const toggleRole = (draft: AccessUserUpsertPayload, roleId: string, enabled: boolean) => {
    const next = new Set(draft.roles ?? []);
    if (enabled) {
      next.add(roleId);
    } else {
      next.delete(roleId);
    }
    next.add('user');
    return { ...draft, roles: Array.from(next) };
  };
  const panelTitle = linkedOnlyMode ? '電子カルテ権限付与（ORCA連携済み）' : 'アクセス管理（職員ユーザー）';
  const panelLabel = linkedOnlyMode ? '電子カルテ権限付与' : 'アクセス管理';

  if (!isSystemAdmin) {
    return (
      <section className="administration-card" aria-label={panelLabel}>
        <h2 className="administration-card__title">{panelTitle}</h2>
        <div className="admin-guard" role="alert" aria-live={resolveAriaLive('warning')}>
          <div className="admin-guard__header">
            <span className="admin-guard__title">操作ガード中</span>
            <span className="admin-guard__badge">システム管理者のみ</span>
          </div>
          <p className="admin-guard__message">
            現在のロール（{role ?? session.role ?? 'unknown'}）では {panelLabel} を操作できません。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="administration-card" aria-label={panelLabel} data-run-id={runId}>
      <h2 className="administration-card__title">{panelTitle}</h2>
      <p className="admin-quiet" role="status" aria-live={infoLive}>
        {linkedOnlyMode
          ? `ORCA連携済みユーザー（${linkedUsers.length}件）の電子カルテ権限のみ編集できます。`
          : ACCESS_PASSWORD_RESET_PUBLIC_ROUTE_AVAILABLE
            ? '職員ユーザーの作成/編集、パスワードリセットを行います。パスワードリセットは管理者の Authenticator（TOTP）を必須とします。'
            : '職員ユーザーの作成/編集を行います。パスワードリセット route は現行 public contract では未公開のため fail-closed です。'}
      </p>

      {feedback ? (
        <div className="admin-alert" role="status" aria-live={resolveAriaLive(feedback.tone)}>
          <span className="admin-alert__tone">{feedback.tone.toUpperCase()}</span>
          <p className="admin-alert__message">{feedback.message}</p>
        </div>
      ) : null}

      <div className="admin-actions">
        {!linkedOnlyMode ? (
          <button type="button" className="admin-button admin-button--primary" onClick={openCreate}>
            新規作成
          </button>
        ) : null}
        <div className="admin-form__field" style={{ marginLeft: 'auto', minWidth: 220 }}>
          <label htmlFor="admin-access-search">絞り込み</label>
          <input
            id="admin-access-search"
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={linkedOnlyMode ? 'loginId / ORCA User_Id / role で検索' : 'loginId / 氏名 / role で検索'}
          />
        </div>
      </div>

      {linkedOnlyMode && linkedUsers.length === 0 ? (
        <p className="admin-note">
          ORCA連携済みユーザーがまだありません。先に「ORCAユーザー連携」セクションでリンクを実行してください。
        </p>
      ) : null}

      {usersQuery.isPending ? <p className="admin-quiet">読み込み中…</p> : null}
      {usersQuery.isError ? <p className="admin-error">取得に失敗しました: {toErrorMessage(usersQuery.error)}</p> : null}

      <div className="admin-scroll" aria-label={linkedOnlyMode ? 'ORCA連携済みユーザー一覧' : 'ユーザー一覧'}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>loginId</th>
              <th>氏名</th>
              {linkedOnlyMode ? <th>ORCA User_Id</th> : null}
              <th>性別</th>
              <th>役割</th>
              <th>roles</th>
              <th>2FA</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.userPk}>
                <td>{user.loginId}</td>
                <td>{user.displayName ?? '—'}</td>
                {linkedOnlyMode ? <td>{user.orcaLink?.orcaUserId ?? '—'}</td> : null}
                <td>{user.sex ?? '—'}</td>
                <td>{user.staffRole ?? '—'}</td>
                <td>{(user.roles ?? []).join(', ') || '—'}</td>
                <td>{user.factor2Auth ?? '—'}</td>
                <td>
                  <button type="button" className="admin-button admin-button--secondary" onClick={() => openEdit(user)}>
                    {linkedOnlyMode ? '権限編集' : '編集'}
                  </button>{' '}
                  {!linkedOnlyMode && ACCESS_PASSWORD_RESET_PUBLIC_ROUTE_AVAILABLE ? (
                    <button type="button" className="admin-button admin-button--danger" onClick={() => openReset(user)}>
                      パスワードリセット
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={linkedOnlyMode ? 8 : 7} className="admin-quiet">
                  該当ユーザーがありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!linkedOnlyMode ? (
        <FocusTrapDialog
          open={createOpen}
          title="職員ユーザー作成"
          description="loginId と氏名、初期パスワードを登録します。"
          onClose={() => setCreateOpen(false)}
          testId="admin-access-create"
        >
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <div className="admin-form__field">
            <label htmlFor="admin-access-create-loginId">loginId</label>
            <input
              id="admin-access-create-loginId"
              type="text"
              value={createDraft.loginId ?? ''}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, loginId: event.target.value }))}
              placeholder="例: doctor01"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="admin-access-create-displayName">氏名（displayName）</label>
            <input
              id="admin-access-create-displayName"
              type="text"
              value={createDraft.displayName ?? ''}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, displayName: event.target.value }))}
              placeholder="例: 山田 太郎"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="admin-access-create-sex">性別</label>
            <select
              id="admin-access-create-sex"
              value={(createDraft.sex ?? '') as string}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, sex: event.target.value as AccessSex | '' }))}
            >
              {SEX_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form__field">
            <label htmlFor="admin-access-create-staffRole">役割（表示用）</label>
            <select
              id="admin-access-create-staffRole"
              value={(createDraft.staffRole ?? '') as string}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, staffRole: event.target.value }))}
            >
              {STAFF_ROLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form__field">
            <label htmlFor="admin-access-create-email">メール（任意）</label>
            <input
              id="admin-access-create-email"
              type="text"
              value={createDraft.email ?? ''}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="例: user@example.com"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="admin-access-create-password">初期パスワード</label>
            <input
              id="admin-access-create-password"
              type="password"
              value={createDraft.password ?? ''}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="8文字以上"
              autoComplete="new-password"
            />
          </div>

          <div className="admin-form__field">
            <label>権限（roles）</label>
            <div className="admin-form__toggles">
              {ROLE_OPTIONS.map((opt) => {
                const checked = (createDraft.roles ?? []).includes(opt.id) || opt.id === 'user';
                const disabled = opt.id === 'user';
                return (
                  <div className="admin-toggle" key={opt.id}>
                    <div className="admin-toggle__label">
                      <span>{opt.label}</span>
                      <span className="admin-toggle__hint">{opt.hint}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      aria-label={opt.label}
                      onChange={(event) =>
                        setCreateDraft((prev) => toggleRole(prev, opt.id, event.target.checked))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="admin-actions">
            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={handleSubmitCreate}
              disabled={createMutation.isPending}
            >
              作成
            </button>
            <button type="button" className="admin-button admin-button--secondary" onClick={() => setCreateOpen(false)}>
              キャンセル
            </button>
          </div>
        </form>
        </FocusTrapDialog>
      ) : null}

      <FocusTrapDialog
        open={Boolean(editTarget && editDraft)}
        title={linkedOnlyMode ? '電子カルテ権限編集' : '職員ユーザー編集'}
        description={
          editTarget
            ? linkedOnlyMode
              ? `loginId: ${editTarget.loginId} / ORCA User_Id: ${editTarget.orcaLink?.orcaUserId ?? '未連携'}`
              : `loginId: ${editTarget.loginId}`
            : undefined
        }
        onClose={() => {
          setEditTarget(null);
          setEditDraft(null);
        }}
        testId="admin-access-edit"
      >
        {editTarget && editDraft ? (
          <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
            {!linkedOnlyMode ? (
              <>
                <div className="admin-form__field">
                  <label htmlFor="admin-access-edit-displayName">氏名（displayName）</label>
                  <input
                    id="admin-access-edit-displayName"
                    type="text"
                    value={editDraft.displayName ?? ''}
                    onChange={(event) => setEditDraft((prev) => ({ ...(prev ?? {}), displayName: event.target.value }))}
                  />
                </div>
                <div className="admin-form__field">
                  <label htmlFor="admin-access-edit-sex">性別</label>
                  <select
                    id="admin-access-edit-sex"
                    value={(editDraft.sex ?? '') as string}
                    onChange={(event) =>
                      setEditDraft((prev) => ({ ...(prev ?? {}), sex: event.target.value as AccessSex | '' }))
                    }
                  >
                    {SEX_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form__field">
                  <label htmlFor="admin-access-edit-staffRole">役割（表示用）</label>
                  <select
                    id="admin-access-edit-staffRole"
                    value={(editDraft.staffRole ?? '') as string}
                    onChange={(event) => setEditDraft((prev) => ({ ...(prev ?? {}), staffRole: event.target.value }))}
                  >
                    {STAFF_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form__field">
                  <label htmlFor="admin-access-edit-email">メール（任意）</label>
                  <input
                    id="admin-access-edit-email"
                    type="text"
                    value={editDraft.email ?? ''}
                    onChange={(event) => setEditDraft((prev) => ({ ...(prev ?? {}), email: event.target.value }))}
                  />
                </div>
              </>
            ) : (
              <p className="admin-note">
                ORCA連携済みユーザーに対して、電子カルテ側の権限（roles）のみ変更できます。
              </p>
            )}

            <div className="admin-form__field">
              <label>権限（roles）</label>
              <div className="admin-form__toggles">
                {ROLE_OPTIONS.map((opt) => {
                  const checked = (editDraft.roles ?? []).includes(opt.id) || opt.id === 'user';
                  const disabled = opt.id === 'user';
                  return (
                    <div className="admin-toggle" key={opt.id}>
                      <div className="admin-toggle__label">
                        <span>{opt.label}</span>
                        <span className="admin-toggle__hint">{opt.hint}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        aria-label={opt.label}
                        onChange={(event) =>
                          setEditDraft((prev) => toggleRole(prev ?? {}, opt.id, event.target.checked))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="admin-actions">
              <button
                type="button"
                className="admin-button admin-button--primary"
                onClick={handleSubmitEdit}
                disabled={updateMutation.isPending}
              >
                更新
              </button>
              <button
                type="button"
                className="admin-button admin-button--secondary"
                onClick={() => {
                  setEditTarget(null);
                  setEditDraft(null);
                }}
              >
                閉じる
              </button>
            </div>
          </form>
        ) : null}
      </FocusTrapDialog>

      {!linkedOnlyMode && ACCESS_PASSWORD_RESET_PUBLIC_ROUTE_AVAILABLE ? (
        <FocusTrapDialog
          open={Boolean(resetTarget)}
          title="パスワードリセット"
          description={resetTarget ? `対象: ${resetTarget.loginId} / ${resetTarget.displayName ?? ''}` : undefined}
          onClose={() => {
            setResetTarget(null);
            setResetTemporaryPassword('');
            setTotpCode('');
          }}
          testId="admin-access-reset"
        >
          {resetTarget ? (
            <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
              <div className="admin-form__field">
                <label htmlFor="admin-access-reset-temporary-password">一時パスワード</label>
                <input
                  id="admin-access-reset-temporary-password"
                  type="text"
                  value={resetTemporaryPassword}
                  onChange={(event) => setResetTemporaryPassword(event.target.value)}
                  placeholder="利用者へ通知する一時パスワード"
                  autoComplete="new-password"
                />
              </div>
              <div className="admin-form__field">
                <label htmlFor="admin-access-reset-totp">管理者 Authenticator（TOTP）コード</label>
                <input
                  id="admin-access-reset-totp"
                  type="text"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  placeholder="6桁"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <p className="admin-quiet">
                  対策: 管理者の 2FA 未登録時は 412（totp_missing）でブロックします。
                </p>
              </div>

              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-button admin-button--danger"
                  onClick={handleSubmitReset}
                  disabled={resetMutation.isPending}
                >
                  パスワードリセット
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  onClick={() => {
                    setResetTarget(null);
                    setResetTemporaryPassword('');
                    setTotpCode('');
                  }}
                >
                  閉じる
                </button>
              </div>
            </form>
          ) : null}
        </FocusTrapDialog>
      ) : null}
    </section>
  );
}
