import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isSystemAdminRole } from '../../libs/auth/roles';
import { useAppToast } from '../../libs/ui/appToast';
import {
  fetchMasterVisibility,
  MASTER_VISIBILITY_QUERY_KEY,
  saveMasterVisibility,
  type MasterVisibilityCategoryCode,
  type PrescriptionDrugSearchMethod,
} from './masterVisibilityApi';

type MasterVisibilityPanelProps = {
  runId: string;
  role?: string;
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

export function MasterVisibilityPanel({ runId, role }: MasterVisibilityPanelProps) {
  const isSystemAdmin = isSystemAdminRole(role);
  const queryClient = useQueryClient();
  const { enqueue } = useAppToast();
  const [form, setForm] = useState<Partial<Record<MasterVisibilityCategoryCode, boolean>>>({});
  const [prescriptionDrugSearchMethodDefault, setPrescriptionDrugSearchMethodDefault] =
    useState<PrescriptionDrugSearchMethod>('prefix');

  const visibilityQuery = useQuery({
    queryKey: MASTER_VISIBILITY_QUERY_KEY,
    queryFn: fetchMasterVisibility,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!visibilityQuery.data?.categories) return;
    setForm(
      Object.fromEntries(
        visibilityQuery.data.categories.map((category) => [category.code, category.visible]),
      ) as Partial<Record<MasterVisibilityCategoryCode, boolean>>,
    );
    setPrescriptionDrugSearchMethodDefault(visibilityQuery.data.prescriptionDrugSearchMethodDefault);
  }, [visibilityQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => saveMasterVisibility(form, { prescriptionDrugSearchMethodDefault }),
    onSuccess: async () => {
      enqueue({ tone: 'success', message: 'マスタ表示設定を更新しました。' });
      await queryClient.invalidateQueries({ queryKey: MASTER_VISIBILITY_QUERY_KEY });
    },
    onError: (error) => {
      enqueue({
        tone: 'error',
        message: 'マスタ表示設定の更新に失敗しました。',
        detail: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const categories = visibilityQuery.data?.categories ?? [];
  const hiddenCount = useMemo(
    () => categories.filter((category) => form[category.code] === false).length,
    [categories, form],
  );
  const canSave = isSystemAdmin && categories.length > 0 && !saveMutation.isPending;

  return (
    <>
      <section className="administration-card" aria-label="マスタ表示設定">
        <h2 className="administration-card__title">マスタ表示設定</h2>
        <p className="admin-quiet">RUN_ID: {runId}</p>
        <p className="admin-note">
          本設定は業務UIの候補表示だけを切り替えます。ORCAマスタAPI、local master cache、ORCA送信前の通常検証、相互作用チェックは変更しません。
        </p>
        <div className="admin-status-row">
          <span className="admin-status admin-status--ok">UI候補表示</span>
          <span>非表示カテゴリ: {hiddenCount}件</span>
          <span>最終更新: {formatTimestamp(visibilityQuery.data?.updatedAt)}</span>
          <span>更新者: {visibilityQuery.data?.updatedBy ?? '―'}</span>
        </div>
        {!isSystemAdmin ? (
          <p className="admin-error">更新にはシステム管理者権限と step-up が必要です。現在のセッションでは参照のみ可能です。</p>
        ) : null}
      </section>

      <section className="administration-card" aria-label="カテゴリ別候補表示">
        <h2 className="administration-card__title">カテゴリ別候補表示</h2>
        <div className="admin-form-grid">
          <label className="admin-form-field" htmlFor="master-visibility-prescription-search-method">
            <span>処方薬剤検索の既定値</span>
            <select
              id="master-visibility-prescription-search-method"
              value={prescriptionDrugSearchMethodDefault}
              disabled={!isSystemAdmin || saveMutation.isPending}
              onChange={(event) => setPrescriptionDrugSearchMethodDefault(event.target.value as PrescriptionDrugSearchMethod)}
            >
              <option value="prefix">前方一致</option>
              <option value="partial">部分一致</option>
            </select>
          </label>
        </div>
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>表示</th>
                <th>カテゴリ</th>
                <th>影響する master type</th>
                <th>業務UI</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const checked = form[category.code] ?? true;
                return (
                  <tr key={category.code}>
                    <td>
                      <label className="admin-toggle admin-toggle--compact">
                        <span className="admin-toggle__label">{checked ? '表示' : '非表示'}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isSystemAdmin || saveMutation.isPending}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              [category.code]: event.target.checked,
                            }))
                          }
                        />
                      </label>
                    </td>
                    <td>
                      <strong>{category.label}</strong>
                      <div className="admin-quiet">{category.code}</div>
                    </td>
                    <td>{category.masterTypes.join(', ') || '―'}</td>
                    <td>{category.affectedSurfaces.join(' / ') || '―'}</td>
                  </tr>
                );
              })}
              {visibilityQuery.isLoading ? (
                <tr>
                  <td colSpan={4}>マスタ表示設定を取得中です...</td>
                </tr>
              ) : null}
              {visibilityQuery.isError ? (
                <tr>
                  <td colSpan={4}>マスタ表示設定を取得できませんでした。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-button admin-button--primary"
            disabled={!canSave}
            onClick={() => saveMutation.mutate()}
          >
            表示設定を保存
          </button>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            disabled={visibilityQuery.isFetching || saveMutation.isPending}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: MASTER_VISIBILITY_QUERY_KEY });
              enqueue({ tone: 'info', message: 'マスタ表示設定を再取得します。' });
            }}
          >
            再読込
          </button>
        </div>
      </section>
    </>
  );
}
