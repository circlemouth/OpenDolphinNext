import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { resolveAriaLive } from '../../libs/observability/observability';

import { fetchPatientFreeDocument, savePatientFreeDocument } from './patientFreeDocumentApi';
import { resolveUserSafeFetchFailure, resolveUserSafeOperationFailure } from './userSafeErrorCopy';

type PatientSummaryPanelProps = {
  patientId?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
};

const normalizeConfirmedLabel = (confirmed?: number | string): string | null => {
  if (confirmed === undefined || confirmed === null) return null;
  if (typeof confirmed === 'number' && Number.isFinite(confirmed)) {
    const date = new Date(confirmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof confirmed === 'string' && confirmed.trim()) {
    const raw = confirmed.trim();
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      const date = new Date(num);
      return Number.isNaN(date.getTime()) ? raw : date.toISOString();
    }
    return raw;
  }
  return null;
};

export function PatientSummaryPanel({ patientId, readOnly = false, readOnlyReason }: PatientSummaryPanelProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);
  const patientIdRef = useRef<string | undefined>(patientId);

  const freeDocQuery = useQuery({
    queryKey: ['charts-free-document', patientId],
    queryFn: () => {
      if (!patientId) {
        return Promise.resolve({
          ok: false,
          supported: false,
          runId: 'unknown',
          status: 0,
          payload: null,
          error: 'patientId is required',
        });
      }
      return fetchPatientFreeDocument({ patientId });
    },
    enabled: Boolean(patientId),
    retry: false,
    staleTime: 30_000,
  });

  const supported = freeDocQuery.data?.supported ?? true;
  const payload = freeDocQuery.data?.payload ?? null;
  const storedComment = payload?.comment ?? '';
  const confirmedLabel = useMemo(() => normalizeConfirmedLabel(payload?.confirmed), [payload?.confirmed]);

  useEffect(() => {
    if (patientIdRef.current === patientId) return;
    patientIdRef.current = patientId;
    setDraft('');
    setDirty(false);
    setStatusNotice(null);
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    if (!supported) return;
    if (freeDocQuery.isFetching) return;
    if (!freeDocQuery.data || !freeDocQuery.data.ok) return;
    if (dirty) return;
    setDraft(storedComment);
  }, [dirty, freeDocQuery.data, freeDocQuery.isFetching, patientId, storedComment, supported]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) {
        return { ok: false, supported: false, runId: 'unknown', status: 0, error: 'patientId is required' };
      }
      return savePatientFreeDocument({
        patientId,
        id: payload?.id,
        confirmed: Date.now(),
        comment: draft,
        expectedContentHash: payload?.contentHash,
      });
    },
    onSuccess: (result) => {
      if (result.ok) {
        setDirty(false);
        setStatusNotice({ tone: 'success', message: '患者サマリを保存しました。' });
        void queryClient.invalidateQueries({ queryKey: ['charts-free-document', patientId] });
        return;
      }
      setStatusNotice({
        tone: 'error',
        message: `患者サマリの保存に失敗しました。${resolveUserSafeOperationFailure(result.error)}`,
      });
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : String(error);
      setStatusNotice({
        tone: 'error',
        message: `患者サマリの保存に失敗しました。${resolveUserSafeOperationFailure(detail)}`,
      });
    },
  });

  if (!patientId) return null;
  if (!supported) return null;
  if (freeDocQuery.isLoading && !freeDocQuery.data) return null;

  const isSaving = saveMutation.isPending;
  const canSave = !readOnly && !isSaving && dirty;
  const saveBlockedReasonId = 'charts-patient-summary-save-block-reason';
  const saveBlockedReason = readOnly
    ? readOnlyReason ?? '読み取り専用のため保存できません。'
    : isSaving
      ? '保存中です。'
      : !dirty
        ? '変更がありません。'
        : '';
  const ariaLive = resolveAriaLive('info');
  const saveError =
    saveMutation.data && !saveMutation.data.ok
      ? `患者サマリの保存に失敗しました。${resolveUserSafeOperationFailure(saveMutation.data.error)}`
      : null;
  const loadError =
    freeDocQuery.data && !freeDocQuery.data.ok ? freeDocQuery.data.error ?? `取得に失敗しました。(HTTP ${freeDocQuery.data.status})` : null;

  return (
    <details
      className="charts-card charts-fold charts-fold--free-doc"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      aria-label="患者サマリ（free document）"
      data-dirty={dirty ? '1' : '0'}
      data-loading={freeDocQuery.isFetching ? '1' : '0'}
    >
      <summary className="charts-fold__summary">
        患者サマリ
        <span className="charts-free-doc__meta" aria-hidden="true">
          {dirty ? '未保存' : confirmedLabel ? `更新:${confirmedLabel.replace('T', ' ').slice(0, 16)}` : '未登録'}
        </span>
      </summary>
      <div className="charts-fold__content">
        <div className="charts-free-doc__statusline" role="status" aria-live={ariaLive}>
          <span>{dirty ? '状態: 未保存（保存が必要です）' : '状態: 保存済み'}</span>
          <span>更新日時: {confirmedLabel ? confirmedLabel.replace('T', ' ').slice(0, 19) : '—'}</span>
        </div>
        {statusNotice ? (
          <div className={`charts-side-panel__notice charts-side-panel__notice--${statusNotice.tone}`} role="status" aria-live={ariaLive}>
            {statusNotice.message}
          </div>
        ) : null}
        {loadError ? (
          <p className="charts-free-doc__error" role="status" aria-live={ariaLive}>
            {resolveUserSafeFetchFailure('患者サマリ', loadError)}
          </p>
        ) : null}
        <textarea
          className="charts-free-doc__textarea"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setDirty(true);
          }}
          placeholder="患者サマリ（家族歴/既往/社会背景/注意事項など）を記載します。"
          rows={5}
          readOnly={readOnly}
          aria-readonly={readOnly}
        />
        <div className="charts-free-doc__actions" role="group" aria-label="患者サマリ操作">
          {saveBlockedReason ? (
            <p id={saveBlockedReasonId} className="charts-free-doc__status">
              保存はブロックされています: {saveBlockedReason}
            </p>
          ) : null}
          <button
            type="button"
            className="charts-free-doc__save"
            disabled={!canSave}
            aria-describedby={saveBlockedReason ? saveBlockedReasonId : undefined}
            title={saveBlockedReason || undefined}
            onClick={() => {
              setStatusNotice({ tone: 'info', message: '患者サマリを保存中です。' });
              void saveMutation.mutate();
            }}
          >
            保存
          </button>
          <button
            type="button"
            className="charts-free-doc__reset"
            disabled={readOnly || isSaving || (!dirty && draft === storedComment)}
            onClick={() => {
              setDraft(storedComment);
              setDirty(false);
              setStatusNotice({ tone: 'info', message: '編集中の変更を取り消しました。' });
            }}
          >
            取り消し
          </button>
          {isSaving ? <span className="charts-free-doc__status">保存中...</span> : null}
          {saveMutation.data?.ok ? <span className="charts-free-doc__status">保存しました</span> : null}
          {saveError ? (
            <span className="charts-free-doc__status charts-free-doc__status--error" role="status" aria-live={ariaLive}>
              {saveError}
            </span>
          ) : null}
        </div>
      </div>
    </details>
  );
}
