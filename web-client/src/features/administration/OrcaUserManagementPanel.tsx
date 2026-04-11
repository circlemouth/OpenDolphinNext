import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { isSystemAdminRole } from '../../libs/auth/roles';
import { logAuditEvent } from '../../libs/audit/auditLogger';
import { resolveAriaLive } from '../../libs/observability/observability';
import { useSession } from '../../AppRouter';
import { fetchAccessUsers, type AccessManagedUser } from './accessManagementApi';
import {
  createOrcaUser,
  deleteOrcaUser,
  fetchOrcaUsers,
  isValidOrcaUserId,
  linkEhrUserToOrca,
  syncOrcaUsers,
  unlinkEhrUserFromOrca,
  updateOrcaUser,
  type OrcaAdminApiError,
  type OrcaAdminUser,
} from './orcaUserAdminApi';

type OrcaUserManagementPanelProps = {
  runId: string;
  role?: string;
};

type Feedback = { tone: 'success' | 'warning' | 'error' | 'info'; message: string };

type OrcaCreateDraft = {
  userId: string;
  password: string;
  staffClass: string;
  fullName: string;
  fullNameKana: string;
  isAdmin: boolean;
};

type OrcaUpdateDraft = {
  userId: string;
  password: string;
  staffClass: string;
  fullName: string;
  fullNameKana: string;
  staffNumber: string;
  isAdmin: boolean;
};

const buildCreateDraft = (): OrcaCreateDraft => ({
  userId: '',
  password: '',
  staffClass: '',
  fullName: '',
  fullNameKana: '',
  isAdmin: false,
});

const buildUpdateDraft = (user: OrcaAdminUser): OrcaUpdateDraft => ({
  userId: user.userId,
  password: '',
  staffClass: user.staffClass ?? '',
  fullName: user.fullName ?? '',
  fullNameKana: user.fullNameKana ?? '',
  staffNumber: user.staffNumber ?? '',
  isAdmin: user.isAdmin,
});

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isApiError = (error: unknown): error is OrcaAdminApiError =>
  Boolean(error) && typeof error === 'object' && 'kind' in (error as Record<string, unknown>);

const buildApiResultSuffix = (result: {
  apiResult?: string;
  apiResultMessage?: string;
}) => {
  const parts: string[] = [];
  if (result.apiResult) parts.push(`Api_Result=${result.apiResult}`);
  if (result.apiResultMessage) parts.push(`Api_Result_Message=${result.apiResultMessage}`);
  return parts.length > 0 ? `（${parts.join(' / ')}）` : '';
};

const buildFailureMessage = (operation: string, error: unknown, addConflictHint = false) => {
  if (!isApiError(error)) {
    return `${operation}に失敗しました: ${toErrorMessage(error)}`;
  }

  const category = (() => {
    if (error.kind === 'permission') return '権限不足（管理者権限が必要）';
    if (error.kind === 'input') return '入力エラー';
    if (error.kind === 'conflict') return '競合エラー';
    if (error.kind === 'network') return '通信エラー';
    if (error.kind === 'server') return 'サーバーエラー';
    return '処理エラー';
  })();

  const apiSuffix = buildApiResultSuffix(error);
  const reason = error.message?.trim();
  const conflictHint =
    addConflictHint && error.kind === 'conflict'
      ? ' 1対1制約により、対象ORCA User_Idが既に別ユーザへリンクされている可能性があります。'
      : '';

  return `${operation}に失敗しました: ${category}${apiSuffix}${reason ? ` / ${reason}` : ''}${conflictHint}`;
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

const resolveEhrUserId = (user: AccessManagedUser) => {
  const userId = (user.userId ?? '').trim();
  if (userId) return userId;
  return String(user.userPk);
};

const isDoctorStaffClass = (staffClass?: string) => {
  const value = (staffClass ?? '').trim().toLowerCase();
  if (!value) return false;
  return value === '01' || value === '1' || value.includes('doctor') || value.includes('医師');
};

const validateCreateDraft = (draft: OrcaCreateDraft): string | null => {
  const userId = draft.userId.trim();
  if (!userId) return 'ORCA User_Id は必須です。';
  if (!isValidOrcaUserId(userId)) return 'ORCA User_Id は半角英数字とアンダーバーのみ使用できます。';
  if (!draft.password.trim()) return '初期パスワードは必須です。';
  if (!draft.staffClass.trim()) return '職員区分は必須です。';
  if (!draft.fullName.trim()) return '氏名は必須です。';
  return null;
};

const validateUpdateDraft = (draft: OrcaUpdateDraft): string | null => {
  const userId = draft.userId.trim();
  if (!userId) return 'ORCA User_Id は必須です。';
  if (!isValidOrcaUserId(userId)) return 'ORCA User_Id は半角英数字とアンダーバーのみ使用できます。';
  if (!draft.fullName.trim()) return '氏名は必須です。';
  return null;
};

export function OrcaUserManagementPanel({ runId, role }: OrcaUserManagementPanelProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const isSystemAdmin = isSystemAdminRole(role ?? session.role);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [keyword, setKeyword] = useState('');
  const [staffClassFilter, setStaffClassFilter] = useState('all');
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  const [selectedEhrUserId, setSelectedEhrUserId] = useState('');
  const [selectedOrcaUserId, setSelectedOrcaUserId] = useState('');

  const [createDraft, setCreateDraft] = useState<OrcaCreateDraft>(() => buildCreateDraft());

  const [editTarget, setEditTarget] = useState<OrcaAdminUser | null>(null);
  const [editDraft, setEditDraft] = useState<OrcaUpdateDraft | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<OrcaAdminUser | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleteDoctorConfirmChecked, setDeleteDoctorConfirmChecked] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['admin-orca-users'],
    queryFn: fetchOrcaUsers,
    enabled: isSystemAdmin,
    staleTime: 15_000,
  });

  const ehrUsersQuery = useQuery({
    queryKey: ['admin-access-users'],
    queryFn: fetchAccessUsers,
    enabled: isSystemAdmin,
    staleTime: 30_000,
  });

  const orcaUsers = usersQuery.data?.users ?? [];
  const ehrUsers = ehrUsersQuery.data?.users ?? [];
  const syncStatus = usersQuery.data?.syncStatus;
  const infoLive = resolveAriaLive('info');

  useEffect(() => {
    if (ehrUsers.length === 0) {
      setSelectedEhrUserId('');
      return;
    }
    const hasSelected = ehrUsers.some((user) => resolveEhrUserId(user) === selectedEhrUserId);
    if (!hasSelected) {
      setSelectedEhrUserId(resolveEhrUserId(ehrUsers[0]));
    }
  }, [ehrUsers, selectedEhrUserId]);

  useEffect(() => {
    if (orcaUsers.length === 0) {
      setSelectedOrcaUserId('');
      return;
    }
    const hasSelected = orcaUsers.some((user) => user.userId === selectedOrcaUserId);
    if (!hasSelected) {
      setSelectedOrcaUserId(orcaUsers[0].userId);
    }
  }, [orcaUsers, selectedOrcaUserId]);

  const selectedEhrUser = useMemo(
    () => ehrUsers.find((user) => resolveEhrUserId(user) === selectedEhrUserId) ?? null,
    [ehrUsers, selectedEhrUserId],
  );

  const selectedEhrUserLink = useMemo(() => {
    if (!selectedEhrUser) return null;
    const ehrUserId = resolveEhrUserId(selectedEhrUser);
    const loginId = selectedEhrUser.loginId;
    return (
      orcaUsers.find((user) => user.link.ehrUserId === ehrUserId || (loginId ? user.link.ehrLoginId === loginId : false)) ?? null
    );
  }, [orcaUsers, selectedEhrUser]);

  const filteredUsers = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();
    return orcaUsers.filter((user) => {
      if (staffClassFilter !== 'all' && (user.staffClass ?? '') !== staffClassFilter) return false;
      if (linkFilter === 'linked' && !user.link.linked) return false;
      if (linkFilter === 'unlinked' && user.link.linked) return false;
      if (!lowerKeyword) return true;
      const haystack = [user.userId, user.fullName, user.fullNameKana]
        .map((value) => (value ?? '').toLowerCase())
        .join(' ');
      return haystack.includes(lowerKeyword);
    });
  }, [keyword, linkFilter, orcaUsers, staffClassFilter]);

  const staffClassOptions = useMemo(() => {
    const unique = new Set(
      orcaUsers
        .map((user) => user.staffClass)
        .filter((value): value is string => Boolean(value)),
    );
    return ['all', ...Array.from(unique).sort((a, b) => a.localeCompare(b, 'ja'))];
  }, [orcaUsers]);

  const syncMutation = useMutation({
    mutationFn: syncOrcaUsers,
    onSuccess: (result) => {
      void queryClient.refetchQueries({ queryKey: ['admin-orca-users'] });
      const count = result.syncStatus?.syncedCount;
      const countLabel = typeof count === 'number' ? ` / 取得件数: ${count}` : '';
      setFeedback({
        tone: 'success',
        message: `ORCAユーザを再取得しました${countLabel} ${buildApiResultSuffix(result)}`.trim(),
      });
      logAuditEvent({
        runId,
        source: 'admin/orca-users',
        note: 'sync users',
        payload: {
          operation: 'sync',
          actor: `${session.facilityId}:${session.userId}`,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
          syncedCount: result.syncStatus?.syncedCount,
        },
      });
    },
    onError: (error) => {
      setFeedback({ tone: 'error', message: buildFailureMessage('ORCAユーザ再取得', error) });
    },
  });

  const createMutation = useMutation({
    mutationFn: createOrcaUser,
    onSuccess: (result) => {
      void queryClient.refetchQueries({ queryKey: ['admin-orca-users'] });
      setFeedback({
        tone: 'success',
        message: `ORCAユーザを作成しました: ${result.user?.userId ?? createDraft.userId.trim()} ${buildApiResultSuffix(result)}`.trim(),
      });
      setCreateDraft(buildCreateDraft());
      logAuditEvent({
        runId,
        source: 'admin/orca-users',
        note: 'create orca user',
        payload: {
          operation: 'create',
          actor: `${session.facilityId}:${session.userId}`,
          userId: result.user?.userId ?? createDraft.userId.trim(),
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
        },
      });
    },
    onError: (error) => {
      setFeedback({ tone: 'error', message: buildFailureMessage('ORCAユーザ作成', error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { orcaUserId: string; payload: OrcaUpdateDraft }) => {
      const payload = {
        password: params.payload.password.trim() || undefined,
        fullName: params.payload.fullName.trim(),
        fullNameKana: params.payload.fullNameKana.trim() || undefined,
      };
      return updateOrcaUser(params.orcaUserId, payload);
    },
    onSuccess: (result, variables) => {
      void queryClient.refetchQueries({ queryKey: ['admin-orca-users'] });
      setFeedback({
        tone: 'success',
        message: `ORCAユーザを更新しました: ${variables.orcaUserId} ${buildApiResultSuffix(result)}`.trim(),
      });
      setEditTarget(null);
      setEditDraft(null);
      logAuditEvent({
        runId,
        source: 'admin/orca-users',
        note: 'update orca user',
        payload: {
          operation: 'update',
          actor: `${session.facilityId}:${session.userId}`,
          previousUserId: variables.orcaUserId,
          userId: variables.orcaUserId,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
        },
      });
    },
    onError: (error) => {
      setFeedback({ tone: 'error', message: buildFailureMessage('ORCAユーザ更新', error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (orcaUserId: string) => deleteOrcaUser(orcaUserId),
    onSuccess: (result, orcaUserId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orca-users'] });
      setFeedback({
        tone: 'success',
        message: `ORCAユーザを削除しました: ${orcaUserId} ${buildApiResultSuffix(result)}`.trim(),
      });
      setDeleteTarget(null);
      setDeleteConfirmChecked(false);
      setDeleteDoctorConfirmChecked(false);
      logAuditEvent({
        runId,
        source: 'admin/orca-users',
        note: 'delete orca user',
        payload: {
          operation: 'delete',
          actor: `${session.facilityId}:${session.userId}`,
          userId: orcaUserId,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
        },
      });
    },
    onError: (error) => {
      setFeedback({ tone: 'error', message: buildFailureMessage('ORCAユーザ削除', error) });
    },
  });

  const linkMutation = useMutation({
    mutationFn: (params: { ehrUserId: string; orcaUserId: string }) =>
      linkEhrUserToOrca(params.ehrUserId, { orcaUserId: params.orcaUserId }),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orca-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-access-users'] });
      setFeedback({
        tone: 'success',
        message: `リンクしました: ehrUserId=${variables.ehrUserId} / ORCA User_Id=${variables.orcaUserId} ${buildApiResultSuffix(result)}`.trim(),
      });
      logAuditEvent({
        runId,
        source: 'admin/orca-users',
        note: 'link ehr and orca user',
        payload: {
          operation: 'link',
          actor: `${session.facilityId}:${session.userId}`,
          ehrUserId: variables.ehrUserId,
          orcaUserId: variables.orcaUserId,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
        },
      });
    },
    onError: (error) => {
      setFeedback({
        tone: 'error',
        message: buildFailureMessage('リンク', error, true),
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (ehrUserId: string) => unlinkEhrUserFromOrca(ehrUserId),
    onSuccess: (result, ehrUserId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orca-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-access-users'] });
      setFeedback({
        tone: 'success',
        message: `アンリンクしました: ehrUserId=${ehrUserId} ${buildApiResultSuffix(result)}`.trim(),
      });
      logAuditEvent({
        runId,
        source: 'admin/orca-users',
        note: 'unlink ehr and orca user',
        payload: {
          operation: 'unlink',
          actor: `${session.facilityId}:${session.userId}`,
          ehrUserId,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
        },
      });
    },
    onError: (error) => {
      setFeedback({ tone: 'error', message: buildFailureMessage('アンリンク', error) });
    },
  });

  const handleCreate = () => {
    const validationError = validateCreateDraft(createDraft);
    if (validationError) {
      setFeedback({ tone: 'error', message: validationError });
      return;
    }
    createMutation.mutate({
      userId: createDraft.userId.trim(),
      password: createDraft.password.trim(),
      staffClass: createDraft.staffClass.trim(),
      fullName: createDraft.fullName.trim(),
      fullNameKana: createDraft.fullNameKana.trim() || undefined,
      isAdmin: createDraft.isAdmin,
    });
  };

  const handleOpenEdit = (user: OrcaAdminUser) => {
    setEditTarget(user);
    setEditDraft(buildUpdateDraft(user));
  };

  const handleUpdate = () => {
    if (!editTarget || !editDraft) return;
    const validationError = validateUpdateDraft(editDraft);
    if (validationError) {
      setFeedback({ tone: 'error', message: validationError });
      return;
    }
    updateMutation.mutate({ orcaUserId: editTarget.userId, payload: editDraft });
  };

  const openDeleteDialog = (user: OrcaAdminUser) => {
    setDeleteTarget(user);
    setDeleteConfirmChecked(false);
    setDeleteDoctorConfirmChecked(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (!deleteConfirmChecked) {
      setFeedback({ tone: 'warning', message: '削除確認チェックを有効にしてください。' });
      return;
    }
    if (isDoctorStaffClass(deleteTarget.staffClass) && !deleteDoctorConfirmChecked) {
      setFeedback({ tone: 'warning', message: '医師区分削除の二重確認チェックが必要です。' });
      return;
    }
    deleteMutation.mutate(deleteTarget.userId);
  };

  const handleLink = () => {
    const ehrUserId = selectedEhrUserId.trim();
    const orcaUserId = selectedOrcaUserId.trim();
    if (!ehrUserId) {
      setFeedback({ tone: 'error', message: 'リンク対象の電子カルテユーザを選択してください。' });
      return;
    }
    if (!orcaUserId) {
      setFeedback({ tone: 'error', message: 'リンク対象のORCA User_Idを選択してください。' });
      return;
    }
    linkMutation.mutate({ ehrUserId, orcaUserId });
  };

  const handleUnlink = () => {
    const ehrUserId = selectedEhrUserId.trim();
    if (!ehrUserId) {
      setFeedback({ tone: 'error', message: 'アンリンク対象の電子カルテユーザを選択してください。' });
      return;
    }
    if (!selectedEhrUserLink) {
      setFeedback({ tone: 'warning', message: 'この電子カルテユーザは現在リンクされていません。' });
      return;
    }
    unlinkMutation.mutate(ehrUserId);
  };

  const handleSyncRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-orca-users'] });
  };

  const totalLinked = orcaUsers.filter((user) => user.link.linked).length;
  const selectedOrcaUser = orcaUsers.find((user) => user.userId === selectedOrcaUserId) ?? null;
  const doctorDeleteRequired = isDoctorStaffClass(deleteTarget?.staffClass);
  const deleteReady = deleteConfirmChecked && (!doctorDeleteRequired || deleteDoctorConfirmChecked);

  if (!isSystemAdmin) {
    return (
      <section className="administration-card" aria-label="ORCAユーザー連携">
        <h2 className="administration-card__title">ORCAユーザー連携</h2>
        <div className="admin-guard" role="alert" aria-live={resolveAriaLive('warning')}>
          <div className="admin-guard__header">
            <span className="admin-guard__title">操作ガード中</span>
            <span className="admin-guard__badge">システム管理者のみ</span>
          </div>
          <p className="admin-guard__message">
            現在のロール（{role ?? session.role ?? 'unknown'}）では ORCA ユーザー管理を操作できません。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="administration-card" aria-label="ORCAユーザー連携" data-run-id={runId}>
      <h2 className="administration-card__title">ORCAユーザー連携（職員マスタ）</h2>
      <p className="admin-note" role="status" aria-live={infoLive}>
        混同防止: 電子カルテは <strong>login_id</strong>、ORCAは <strong>User_Id</strong> を使用します。画面上は常に別欄で表示します。
      </p>

      {feedback ? (
        <div className="admin-alert" role="status" aria-live={resolveAriaLive(feedback.tone)}>
          <span className="admin-alert__tone">{feedback.tone.toUpperCase()}</span>
          <p className="admin-alert__message">{feedback.message}</p>
        </div>
      ) : null}

      <div className="admin-callout">
        <div className="admin-callout__body">
          <p className="admin-callout__title">ORCA連携ステータス</p>
          <div className="admin-summary">
            <div className="admin-summary__row">
              <span className="admin-summary__label">最終再取得日時</span>
              <span>{formatTimestamp(syncStatus?.lastSyncedAt)}</span>
            </div>
            <div className="admin-summary__row">
              <span className="admin-summary__label">最終再取得件数</span>
              <span>{typeof syncStatus?.syncedCount === 'number' ? syncStatus.syncedCount : '―'}</span>
            </div>
            <div className="admin-summary__row">
              <span className="admin-summary__label">直近エラー</span>
              <span>{syncStatus?.recentErrorSummary ?? 'なし'}</span>
            </div>
            <div className="admin-summary__row">
              <span className="admin-summary__label">リンク済み件数</span>
              <span>
                {totalLinked} / {orcaUsers.length}
              </span>
            </div>
          </div>
        </div>
        <div className="admin-callout__actions">
          <button type="button" className="admin-button admin-button--primary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            ORCAユーザ再取得
          </button>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={handleSyncRefetch}
            disabled={usersQuery.isFetching}
          >
            再取得
          </button>
          {syncMutation.isPending ? (
            <span className="admin-inline-progress" role="status" aria-live={resolveAriaLive('info')}>
              <span className="admin-spinner" aria-hidden="true" />
              再取得中...
            </span>
          ) : null}
        </div>
      </div>

      <div className="admin-actions">
        <div className="admin-form__field" style={{ minWidth: 240 }}>
          <label htmlFor="orca-user-search">検索（User_Id / 氏名 / カナ）</label>
          <input
            id="orca-user-search"
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="例: doctor01 / 山田 / ヤマダ"
          />
        </div>
        <div className="admin-form__field" style={{ minWidth: 180 }}>
          <label htmlFor="orca-user-staff-class">職員区分</label>
          <select
            id="orca-user-staff-class"
            value={staffClassFilter}
            onChange={(event) => setStaffClassFilter(event.target.value)}
          >
            {staffClassOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'すべて' : option}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form__field" style={{ minWidth: 180 }}>
          <label htmlFor="orca-user-link-filter">リンク状態</label>
          <select
            id="orca-user-link-filter"
            value={linkFilter}
            onChange={(event) => setLinkFilter(event.target.value as 'all' | 'linked' | 'unlinked')}
          >
            <option value="all">すべて</option>
            <option value="linked">リンク済み</option>
            <option value="unlinked">未リンク</option>
          </select>
        </div>
      </div>

      {usersQuery.isPending ? <p className="admin-quiet">ORCAユーザを読み込み中...</p> : null}
      {usersQuery.isError ? <p className="admin-error">取得に失敗しました: {toErrorMessage(usersQuery.error)}</p> : null}

      <div className="admin-scroll" aria-label="ORCAユーザー一覧">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ORCA User_Id</th>
              <th>氏名</th>
              <th>カナ</th>
              <th>職員区分</th>
              <th>職員番号</th>
              <th>管理者権限</th>
              <th>リンク状況</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.userId}>
                <td>
                  <strong>{user.userId}</strong>
                </td>
                <td>{user.fullName ?? '―'}</td>
                <td>{user.fullNameKana ?? '―'}</td>
                <td>{user.staffClass ?? '―'}</td>
                <td>{user.staffNumber ?? '―'}</td>
                <td>{user.isAdmin ? 'あり' : 'なし'}</td>
                <td>
                  <div className="admin-orca-link-status">
                    <span className={`admin-status ${user.link.linked ? 'admin-status--ok' : 'admin-status--idle'}`}>
                      {user.link.linked ? 'リンク済み' : '未リンク'}
                    </span>
                    {user.link.linked ? (
                      <span className="admin-quiet">
                        ehrUserId={user.link.ehrUserId ?? '―'} / login_id={user.link.ehrLoginId ?? '―'}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <button type="button" className="admin-button admin-button--secondary" onClick={() => handleOpenEdit(user)}>
                    更新
                  </button>{' '}
                  <button type="button" className="admin-button admin-button--danger" onClick={() => openDeleteDialog(user)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-quiet">
                  該当するORCAユーザがありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-divider" />

      <section className="admin-form" aria-label="電子カルテユーザ紐づけ">
        <h3 className="administration-card__title">電子カルテユーザとの紐づけ</h3>
        <div className="admin-form__field">
          <label htmlFor="orca-link-ehr-user">電子カルテユーザ（ehrUserId / login_id）</label>
          <select
            id="orca-link-ehr-user"
            value={selectedEhrUserId}
            onChange={(event) => setSelectedEhrUserId(event.target.value)}
          >
            {ehrUsers.map((user) => {
              const ehrUserId = resolveEhrUserId(user);
              const displayName = user.displayName ?? (`${user.sirName ?? ''}${user.givenName ?? ''}`.trim() || '名称未設定');
              return (
                <option key={ehrUserId} value={ehrUserId}>
                  {displayName} / ehrUserId:{ehrUserId} / login_id:{user.loginId}
                </option>
              );
            })}
          </select>
          <p className="admin-quiet">
            選択中: ehrUserId={selectedEhrUser ? resolveEhrUserId(selectedEhrUser) : '―'} / login_id={selectedEhrUser?.loginId ?? '―'}
          </p>
          <p className="admin-quiet">
            現在リンク: {selectedEhrUserLink ? `ORCA User_Id=${selectedEhrUserLink.userId}` : '未リンク'}
          </p>
        </div>

        <div className="admin-form__field">
          <label htmlFor="orca-link-orca-user">ORCA User_Id</label>
          <select
            id="orca-link-orca-user"
            value={selectedOrcaUserId}
            onChange={(event) => setSelectedOrcaUserId(event.target.value)}
          >
            {orcaUsers.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.userId} / {user.fullName ?? '氏名未設定'} {user.link.linked ? '（リンク済み）' : '（未リンク）'}
              </option>
            ))}
          </select>
          <p className="admin-quiet">
            選択中 ORCA User_Id: {selectedOrcaUser?.userId ?? '―'}
            {selectedOrcaUser?.link.linked
              ? ` / 現在リンク先 ehrUserId=${selectedOrcaUser.link.ehrUserId ?? '―'} login_id=${selectedOrcaUser.link.ehrLoginId ?? '―'}`
              : ''}
          </p>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-button admin-button--primary"
            onClick={handleLink}
            disabled={linkMutation.isPending}
          >
            リンク実行
          </button>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={handleUnlink}
            disabled={unlinkMutation.isPending}
          >
            アンリンク
          </button>
        </div>
      </section>

      <div className="admin-divider" />

      <section className="admin-form" aria-label="ORCAユーザ作成">
        <h3 className="administration-card__title">ORCAユーザ作成</h3>
        <div className="admin-form__toggles">
          <div className="admin-form__field">
            <label htmlFor="orca-create-user-id">ORCA User_Id</label>
            <input
              id="orca-create-user-id"
              type="text"
              value={createDraft.userId}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, userId: event.target.value }))}
              placeholder="例: doctor_01"
            />
            {createDraft.userId.trim() && !isValidOrcaUserId(createDraft.userId) ? (
              <p className="admin-error">半角英数字とアンダーバーのみ使用できます。</p>
            ) : (
              <p className="admin-quiet">許可文字: 半角英数字 + _</p>
            )}
          </div>
          <div className="admin-form__field">
            <label htmlFor="orca-create-password">初期パスワード</label>
            <input
              id="orca-create-password"
              type="password"
              value={createDraft.password}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="初期パスワード"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="orca-create-staff-class">職員区分</label>
            <input
              id="orca-create-staff-class"
              type="text"
              value={createDraft.staffClass}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, staffClass: event.target.value }))}
              placeholder="例: doctor / nurse / 01"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="orca-create-full-name">氏名</label>
            <input
              id="orca-create-full-name"
              type="text"
              value={createDraft.fullName}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, fullName: event.target.value }))}
              placeholder="例: 山田 太郎"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="orca-create-full-name-kana">カナ（任意）</label>
            <input
              id="orca-create-full-name-kana"
              type="text"
              value={createDraft.fullNameKana}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, fullNameKana: event.target.value }))}
              placeholder="例: ヤマダ タロウ"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="orca-create-staff-number">職員番号</label>
            <input
              id="orca-create-staff-number"
              type="text"
              value=""
              disabled
              readOnly
              aria-readonly="true"
              placeholder="作成後の再取得で ORCA 採番値を反映"
            />
            <p className="admin-quiet">official create request では指定せず、作成後の再取得で採番済み値を反映します。</p>
          </div>
        </div>

        <div className="admin-toggle">
          <div className="admin-toggle__label">
            <span>管理者権限</span>
            <span className="admin-toggle__hint">ORCA側管理者権限を付与する場合にON</span>
          </div>
          <input
            type="checkbox"
            checked={createDraft.isAdmin}
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, isAdmin: event.target.checked }))}
            aria-label="ORCA管理者権限"
          />
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-button admin-button--primary"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            作成
          </button>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={() => setCreateDraft(buildCreateDraft())}
          >
            入力クリア
          </button>
        </div>
      </section>

      <FocusTrapDialog
        open={Boolean(editTarget && editDraft)}
        title="ORCAユーザ更新"
        description={editTarget ? `変更対象 ORCA User_Id: ${editTarget.userId}` : undefined}
        onClose={() => {
          setEditTarget(null);
          setEditDraft(null);
        }}
      >
        {editTarget && editDraft ? (
          <form className="admin-form" onSubmit={(event) => event.preventDefault()}>
            <div className="admin-form__field">
              <label htmlFor="orca-edit-user-id">ORCA User_Id</label>
              <input
                id="orca-edit-user-id"
                type="text"
                value={editDraft.userId}
                readOnly
                aria-readonly="true"
              />
              <p className="admin-quiet">official update request では変更しません。</p>
            </div>
            <div className="admin-form__field">
              <label htmlFor="orca-edit-full-name">氏名</label>
              <input
                id="orca-edit-full-name"
                type="text"
                value={editDraft.fullName}
                onChange={(event) => setEditDraft((prev) => ({ ...(prev ?? buildUpdateDraft(editTarget)), fullName: event.target.value }))}
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="orca-edit-full-name-kana">カナ</label>
              <input
                id="orca-edit-full-name-kana"
                type="text"
                value={editDraft.fullNameKana}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...(prev ?? buildUpdateDraft(editTarget)), fullNameKana: event.target.value }))
                }
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="orca-edit-password">パスワード（変更時のみ入力）</label>
              <input
                id="orca-edit-password"
                type="password"
                value={editDraft.password}
                onChange={(event) => setEditDraft((prev) => ({ ...(prev ?? buildUpdateDraft(editTarget)), password: event.target.value }))}
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="orca-edit-staff-class">職員区分</label>
              <input
                id="orca-edit-staff-class"
                type="text"
                value={editDraft.staffClass}
                readOnly
                aria-readonly="true"
              />
              <p className="admin-quiet">職員区分は読み取り専用です。</p>
            </div>
            <div className="admin-form__field">
              <label htmlFor="orca-edit-staff-number">職員番号</label>
              <input
                id="orca-edit-staff-number"
                type="text"
                value={editDraft.staffNumber}
                readOnly
                aria-readonly="true"
              />
              <p className="admin-quiet">職員番号は ORCA 採番値のため更新しません。</p>
            </div>
            <div className="admin-toggle">
              <div className="admin-toggle__label">
                <span>管理者権限</span>
                <span className="admin-toggle__hint">create 時のみ指定可能</span>
              </div>
              <input
                type="checkbox"
                checked={editDraft.isAdmin}
                disabled
                readOnly
                aria-readonly="true"
                aria-label="ORCA管理者権限（読み取り専用）"
              />
            </div>
            <p className="admin-quiet">ORCA側管理者権限は official update request では変更しません。</p>

            <div className="admin-actions">
              <button
                type="button"
                className="admin-button admin-button--primary"
                onClick={handleUpdate}
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
                キャンセル
              </button>
            </div>
          </form>
        ) : null}
      </FocusTrapDialog>

      <FocusTrapDialog
        open={Boolean(deleteTarget)}
        title="ORCAユーザ削除"
        description={deleteTarget ? `削除対象 ORCA User_Id: ${deleteTarget.userId}` : undefined}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteConfirmChecked(false);
          setDeleteDoctorConfirmChecked(false);
        }}
      >
        {deleteTarget ? (
          <form className="admin-form" onSubmit={(event) => event.preventDefault()}>
            <p className="admin-quiet">
              この操作は取り消せません。ORCA User_Id=<strong>{deleteTarget.userId}</strong> を削除します。
            </p>
            {doctorDeleteRequired ? (
              <div className="admin-warning-box" role="alert" aria-live={resolveAriaLive('warning')}>
                医師区分の削除は診療・請求業務への影響が大きいため、二重確認が必須です。
              </div>
            ) : null}
            <label className="admin-toggle">
              <span className="admin-toggle__label">
                <span>削除内容を確認した</span>
                <span className="admin-toggle__hint">この操作を実行してよいことを確認</span>
              </span>
              <input
                type="checkbox"
                checked={deleteConfirmChecked}
                onChange={(event) => setDeleteConfirmChecked(event.target.checked)}
              />
            </label>
            {doctorDeleteRequired ? (
              <label className="admin-toggle">
                <span className="admin-toggle__label">
                  <span>医師区分削除の影響を理解した</span>
                  <span className="admin-toggle__hint">業務影響を確認し、実施責任を持つ</span>
                </span>
                <input
                  type="checkbox"
                  checked={deleteDoctorConfirmChecked}
                  onChange={(event) => setDeleteDoctorConfirmChecked(event.target.checked)}
                />
              </label>
            ) : null}

            <div className="admin-actions">
              <button
                type="button"
                className="admin-button admin-button--danger"
                onClick={handleDelete}
                disabled={!deleteReady || deleteMutation.isPending}
              >
                削除を実行
              </button>
              <button
                type="button"
                className="admin-button admin-button--secondary"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmChecked(false);
                  setDeleteDoctorConfirmChecked(false);
                }}
              >
                キャンセル
              </button>
            </div>
          </form>
        ) : null}
      </FocusTrapDialog>
    </section>
  );
}
