import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { logUiState, logAuditEvent } from '../../libs/audit/auditLogger';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { resolveAriaLive } from '../../libs/observability/observability';
import type { DataSourceTransition } from '../../libs/observability/types';
import { savePatient, type PatientRecord, type PatientMutationResult } from '../patients/api';
import { fetchOrcaAddress } from '../patients/orcaAddressApi';
import { PatientFormErrorAlert } from '../patients/PatientFormErrorAlert';
import { diffPatientKeys, PATIENT_FIELD_LABEL, pickPatientSection } from '../patients/patientDiff';
import { validatePatientMutation, type PatientOperation, type PatientValidationError } from '../patients/patientValidation';
import { resolveUserSafeFetchFailure, resolveUserSafeOperationFailure } from './userSafeErrorCopy';

type EditMeta = {
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  visitDate?: string;
  actorRole?: string;
};

export type PatientInfoEditDialogProps = {
  open: boolean;
  baseline: PatientRecord | null;
  fallback: PatientRecord | null;
  editAllowed: boolean;
  editBlockedReason?: string;
  meta: EditMeta;
  onClose: () => void;
  onSaved?: (result: PatientMutationResult) => void;
  onRefetchBaseline?: () => void;
};

type ReviewFieldKey = keyof typeof PATIENT_FIELD_LABEL;

const fieldOrder: ReviewFieldKey[] = ['patientId', 'name', 'kana', 'birthDate', 'sex', 'phone', 'zip', 'address'];
const DRAFT_COMPARE_KEYS: Array<keyof PatientRecord> = [
  'patientId',
  'name',
  'kana',
  'birthDate',
  'sex',
  'phone',
  'zip',
  'address',
];
const normalizeDraftValue = (value: unknown) => (value === undefined || value === null ? '' : String(value)).trim();
const isSameDraft = (left: PatientRecord | null | undefined, right: PatientRecord | null | undefined) =>
  DRAFT_COMPARE_KEYS.every((key) => normalizeDraftValue(left?.[key]) === normalizeDraftValue(right?.[key]));
const normalizeZipDigits = (value?: string | null) => (value ?? '').replace(/\D+/g, '');
const todayCompact = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export function PatientInfoEditDialog({
  open,
  baseline,
  fallback,
  editAllowed,
  editBlockedReason,
  meta,
  onClose,
  onSaved,
  onRefetchBaseline,
}: PatientInfoEditDialogProps) {
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [errors, setErrors] = useState<PatientValidationError[]>([]);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string; detail?: string } | null>(null);
  const [orcaAddressPending, setOrcaAddressPending] = useState(false);
  const draftRef = useRef<PatientRecord>({});
  const lastBaseDraftRef = useRef<PatientRecord | null>(null);
  const wasOpenRef = useRef(false);
  const [draft, setDraft] = useState<PatientRecord>({});
  const lastAttemptRef = useRef<{ payload: PatientRecord; operation: PatientOperation; changedKeys: (keyof PatientRecord)[] } | null>(null);

  const focusField = (field: keyof PatientRecord) => {
    const id = `patient-edit-${String(field)}`;
    const el = typeof document !== 'undefined' ? (document.getElementById(id) as HTMLElement | null) : null;
    if (el && typeof el.focus === 'function') el.focus();
  };

  const masterOk = useMemo(() => {
    return !meta.missingMaster && !meta.fallbackUsed && (meta.dataSourceTransition ?? 'server') === 'server';
  }, [meta.dataSourceTransition, meta.fallbackUsed, meta.missingMaster]);

  const baseDraft = useMemo(() => pickPatientSection({ baseline, fallback }), [baseline, fallback]);

  const changedKeys = useMemo(() => diffPatientKeys({ baseline, draft }), [baseline, draft]);
  const editAllowedResolved = editAllowed;
  const editBlockedReasonResolved = editBlockedReason;

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const firstOpen = !wasOpenRef.current;
    wasOpenRef.current = true;
    const baseChanged = !isSameDraft(lastBaseDraftRef.current, baseDraft);
    const hasLocalEdits = changedKeys.length > 0;
    if (!firstOpen && !baseChanged) return;
    if (!firstOpen && baseChanged && hasLocalEdits) {
      lastBaseDraftRef.current = baseDraft;
      return;
    }
    setStep('edit');
    setConfirmChecked(false);
    setErrors([]);
    setNotice(null);
    setDraft(baseDraft);
    draftRef.current = baseDraft;
    lastBaseDraftRef.current = baseDraft;

    recordOutpatientFunnel('charts_patient_edit', {
      runId: meta.runId,
      cacheHit: meta.cacheHit ?? false,
      missingMaster: meta.missingMaster ?? false,
      dataSourceTransition: meta.dataSourceTransition ?? 'server',
      fallbackUsed: meta.fallbackUsed ?? false,
      action: 'open',
      outcome: editAllowedResolved ? 'success' : 'blocked',
      note: 'basic',
      reason: editAllowedResolved ? undefined : editBlockedReasonResolved ?? 'edit not allowed',
    });

    logUiState({
      action: 'patient_edit_open',
      screen: 'charts',
      controlId: 'patient-basic-edit',
      runId: meta.runId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      details: {
        section: 'basic',
        patientId: meta.patientId,
        receptionId: meta.receptionId,
        appointmentId: meta.appointmentId,
        visitDate: meta.visitDate,
        editAllowed: editAllowedResolved,
        editBlockedReason: editBlockedReasonResolved,
      },
    });
  }, [
    baseDraft,
    changedKeys.length,
    editAllowedResolved,
    editBlockedReasonResolved,
    meta.appointmentId,
    meta.cacheHit,
    meta.dataSourceTransition,
    meta.fallbackUsed,
    meta.missingMaster,
    meta.patientId,
    meta.receptionId,
    meta.runId,
    meta.visitDate,
    open,
  ]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const mutation = useMutation({
    mutationFn: async (params: { patient: PatientRecord; operation: PatientOperation; changedKeys: (keyof PatientRecord)[] }) => {
      return savePatient({
        patient: params.patient,
        operation: params.operation,
        runId: meta.runId,
        auditMeta: {
          source: 'charts',
          section: 'basic',
          changedKeys: params.changedKeys.map(String),
          receptionId: meta.receptionId,
          appointmentId: meta.appointmentId,
          visitDate: meta.visitDate,
          actorRole: meta.actorRole,
        },
      });
    },
    onSuccess: (result) => {
      onSaved?.(result);
      const failureMessage = result.message
        ? `患者情報の保存に失敗しました。${resolveUserSafeOperationFailure(result.message)}`
        : '患者情報の保存に失敗しました。状態を確認してからやり直してください。';
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.ok ? (result.message ?? '保存しました') : failureMessage });
      if (result.ok) {
        recordOutpatientFunnel('charts_patient_edit', {
          runId: result.runId ?? meta.runId,
          cacheHit: result.cacheHit ?? false,
          missingMaster: result.missingMaster ?? false,
          dataSourceTransition: result.dataSourceTransition ?? meta.dataSourceTransition ?? 'server',
          fallbackUsed: result.fallbackUsed ?? false,
          action: 'save',
          outcome: 'success',
          note: `basic changedKeys=${changedKeys.map(String).join(',') || 'none'}`,
        });
        onRefetchBaseline?.();
        onClose();
      } else {
        recordOutpatientFunnel('charts_patient_edit', {
          runId: result.runId ?? meta.runId,
          cacheHit: result.cacheHit ?? false,
          missingMaster: result.missingMaster ?? false,
          dataSourceTransition: result.dataSourceTransition ?? meta.dataSourceTransition ?? 'server',
          fallbackUsed: result.fallbackUsed ?? false,
          action: 'save',
          outcome: 'error',
          note: result.ok ? 'save success' : failureMessage,
          reason: result.ok ? undefined : failureMessage,
        });
      }
    },
    onError: (error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      const failureMessage = `患者情報の保存に失敗しました。${resolveUserSafeOperationFailure(detail)}`;
      setNotice({ tone: 'error', message: failureMessage });
      logAuditEvent({
        runId: meta.runId,
        source: 'charts-patient-edit',
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'PATIENTMODV2_OUTPATIENT_SAVE',
          outcome: 'error',
          subject: 'charts',
          details: {
            operation: lastAttemptRef.current?.operation,
            section: 'basic',
            patientId: meta.patientId,
            receptionId: meta.receptionId,
            appointmentId: meta.appointmentId,
            error: detail,
            changedKeys: lastAttemptRef.current?.changedKeys?.map(String),
          },
        },
      });
    },
  });

  const canEdit = editAllowedResolved && masterOk;
  const operation: PatientOperation = draft.patientId ? 'update' : 'create';

  const handleOrcaAddressLookup = async () => {
    const zip = normalizeZipDigits(draft.zip);
    if (!canEdit || step !== 'edit' || orcaAddressPending || zip.length !== 7) return;
    setOrcaAddressPending(true);
    try {
      const result = await fetchOrcaAddress({ zip, effective: todayCompact() });
      if (result.ok && result.item) {
        const fullAddress = result.item.fullAddress ?? [result.item.city, result.item.town].filter(Boolean).join('');
        setDraft((prev) => ({ ...prev, address: fullAddress || prev.address }));
        setNotice({ tone: 'success', message: '住所を補完しました。', detail: fullAddress || '住所候補を取得しました。' });
        return;
      }
      if (result.notFound) {
        setNotice({ tone: 'error', message: '該当する住所が見つかりませんでした' });
        return;
      }
      setNotice({
        tone: 'error',
        message: resolveUserSafeFetchFailure('住所候補', result.message ?? '住所補完に失敗しました。'),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '住所補完に失敗しました。';
      setNotice({
        tone: 'error',
        message: resolveUserSafeFetchFailure('住所候補', detail),
      });
    } finally {
      setOrcaAddressPending(false);
    }
  };

  const validate = () => {
    const validation = validatePatientMutation({
      patient: draft,
      operation,
      context: { masterOk },
    });
    setErrors(validation);
    return validation;
  };

  const onNextReview = () => {
    const validation = validate();
    if (validation.length > 0) {
      setNotice({ tone: 'error', message: '入力内容を確認してください。' });
      return;
    }
    if (!changedKeys.length) {
      setNotice({ tone: 'info', message: '変更箇所がありません（差分 0）。' });
    }
    setStep('review');
    setConfirmChecked(false);
  };

  const onRollback = () => {
    const next = baseDraft;
    setDraft(next);
    setErrors([]);
    setNotice({ tone: 'info', message: '変更を巻き戻しました（編集開始時点へ戻しました）。' });
    setStep('edit');
    setConfirmChecked(false);
    recordOutpatientFunnel('charts_patient_edit', {
      runId: meta.runId,
      cacheHit: meta.cacheHit ?? false,
      missingMaster: meta.missingMaster ?? false,
      dataSourceTransition: meta.dataSourceTransition ?? 'server',
      fallbackUsed: meta.fallbackUsed ?? false,
      action: 'rollback',
      outcome: 'success',
      note: 'basic',
    });
    logAuditEvent({
      runId: meta.runId,
      source: 'charts-patient-edit',
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      payload: {
        action: 'PATIENTMODV2_OUTPATIENT_ROLLBACK',
        outcome: 'success',
        subject: 'charts',
        details: { section: 'basic', patientId: meta.patientId, receptionId: meta.receptionId, appointmentId: meta.appointmentId },
      },
    });
  };

  const onSave = () => {
    if (!canEdit) {
      setNotice({ tone: 'error', message: '編集ガード中のため保存できません。', detail: editBlockedReasonResolved });
      return;
    }
    const validation = validate();
    if (validation.length > 0) {
      setNotice({ tone: 'error', message: '入力内容を確認してください。' });
      return;
    }
    if (!confirmChecked) {
      setNotice({ tone: 'error', message: '差分確認チェックが必要です。' });
      return;
    }
    const payload = draftRef.current;
    const changed = diffPatientKeys({ baseline, draft: payload });
    lastAttemptRef.current = { payload, operation, changedKeys: changed };
    mutation.mutate({ patient: payload, operation, changedKeys: changed });
  };

  const title = '患者基本情報を更新';
  const description = '保存前に差分を確認し、/api/orca/patient/mutation で更新します。';

  const fieldErrorMap = useMemo(() => {
    const map = new Map<keyof PatientRecord, string>();
    for (const e of errors) {
      if (!e.field || e.field === 'form') continue;
      map.set(e.field, e.message);
    }
    return map;
  }, [errors]);

  const renderRow = (key: ReviewFieldKey) => {
    const label = PATIENT_FIELD_LABEL[key] ?? String(key);
    const baselineValue = baseline?.[key];
    const draftValue = draft[key];
    const isChanged = key !== 'patientId' && changedKeys.includes(key);
    return (
      <div key={String(key)} className={`patient-edit__diff-row${isChanged ? ' is-changed' : ''}`}>
        <div className="patient-edit__diff-label">{label}</div>
        <div className="patient-edit__diff-before">{baselineValue ? String(baselineValue) : '—'}</div>
        <div className="patient-edit__diff-after">{draftValue ? String(draftValue) : '—'}</div>
      </div>
    );
  };

  return (
    <FocusTrapDialog
      open={open}
      title={title}
      description={description}
      onClose={() => {
        setNotice(null);
        setErrors([]);
        onClose();
      }}
      testId="patient-info-edit-dialog"
    >
      {!editAllowedResolved ? (
        <div className="patient-edit__blocked" role="alert" aria-live={resolveAriaLive('warning')}>
          <p>編集ガード中のため更新できません。</p>
          {editBlockedReasonResolved ? <p className="patient-edit__blocked-reason">{editBlockedReasonResolved}</p> : null}
          <div className="patient-edit__actions">
            <button type="button" className="patients-tab__ghost" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      ) : (
        <>
          {notice ? (
            <div
              className={`patient-edit__notice patient-edit__notice--${notice.tone}`}
              role="alert"
              aria-live={resolveAriaLive(notice.tone)}
            >
              <p className="patient-edit__notice-title">{notice.message}</p>
              {notice.detail ? <p className="patient-edit__notice-detail">{notice.detail}</p> : null}
            </div>
          ) : null}

          <PatientFormErrorAlert errors={errors} onFocusField={focusField} />

          <div className="patient-edit__meta" role="note" aria-label="監査メタ">
            <span>operation={operation}</span>
            <span>section=basic</span>
            <span>changedKeys={changedKeys.length}</span>
          </div>

          {step === 'edit' ? (
            <form
              className="patient-edit__form"
              onSubmit={(event) => {
                event.preventDefault();
                onNextReview();
              }}
            >
              <div className="patient-edit__grid">
                <label className="patient-edit__field">
                  <span>患者ID</span>
                  <input id="patient-edit-patientId" value={draft.patientId ?? ''} readOnly aria-readonly="true" />
                </label>

                  <>
                    <label className="patient-edit__field">
                      <span>氏名（必須）</span>
                      <input
                        id="patient-edit-name"
                        value={draft.name ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                        aria-invalid={fieldErrorMap.has('name')}
                        aria-describedby={fieldErrorMap.has('name') ? 'patient-edit-error-name' : undefined}
                        required
                      />
                      {fieldErrorMap.has('name') ? (
                        <small id="patient-edit-error-name" className="patient-edit__field-error" role="alert">
                          {fieldErrorMap.get('name')}
                        </small>
                      ) : null}
                    </label>

                    <label className="patient-edit__field">
                      <span>カナ</span>
                      <input
                        id="patient-edit-kana"
                        value={draft.kana ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, kana: event.target.value }))}
                        aria-invalid={fieldErrorMap.has('kana')}
                        aria-describedby={fieldErrorMap.has('kana') ? 'patient-edit-error-kana' : undefined}
                        placeholder="ヤマダ ハナコ"
                      />
                      {fieldErrorMap.has('kana') ? (
                        <small id="patient-edit-error-kana" className="patient-edit__field-error" role="alert">
                          {fieldErrorMap.get('kana')}
                        </small>
                      ) : null}
                    </label>

                    <label className="patient-edit__field">
                      <span>生年月日</span>
                      <input
                        id="patient-edit-birthDate"
                        type="date"
                        value={draft.birthDate ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, birthDate: event.target.value }))}
                        aria-invalid={fieldErrorMap.has('birthDate')}
                        aria-describedby={fieldErrorMap.has('birthDate') ? 'patient-edit-error-birthDate' : undefined}
                      />
                      {fieldErrorMap.has('birthDate') ? (
                        <small id="patient-edit-error-birthDate" className="patient-edit__field-error" role="alert">
                          {fieldErrorMap.get('birthDate')}
                        </small>
                      ) : null}
                    </label>

                    <label className="patient-edit__field">
                      <span>性別</span>
                      <select
                        id="patient-edit-sex"
                        value={draft.sex ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, sex: event.target.value }))}
                        aria-invalid={fieldErrorMap.has('sex')}
                        aria-describedby={fieldErrorMap.has('sex') ? 'patient-edit-error-sex' : undefined}
                      >
                        <option value="">未選択</option>
                        <option value="M">男性</option>
                        <option value="F">女性</option>
                      </select>
                      {fieldErrorMap.has('sex') ? (
                        <small id="patient-edit-error-sex" className="patient-edit__field-error" role="alert">
                          {fieldErrorMap.get('sex')}
                        </small>
                      ) : null}
                    </label>

                    <label className="patient-edit__field">
                      <span>電話</span>
                      <input
                        id="patient-edit-phone"
                        value={draft.phone ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                        aria-invalid={fieldErrorMap.has('phone')}
                        aria-describedby={fieldErrorMap.has('phone') ? 'patient-edit-error-phone' : undefined}
                        placeholder="03-1234-5678"
                      />
                      {fieldErrorMap.has('phone') ? (
                        <small id="patient-edit-error-phone" className="patient-edit__field-error" role="alert">
                          {fieldErrorMap.get('phone')}
                        </small>
                      ) : null}
                    </label>

                    <label className="patient-edit__field">
                      <span>郵便番号</span>
                      <input
                        id="patient-edit-zip"
                        value={draft.zip ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, zip: event.target.value }))}
                        aria-invalid={fieldErrorMap.has('zip')}
                        aria-describedby={fieldErrorMap.has('zip') ? 'patient-edit-error-zip' : undefined}
                        placeholder="123-4567"
                      />
                      <button
                        type="button"
                        className="patients-tab__ghost"
                        onClick={() => void handleOrcaAddressLookup()}
                        disabled={step !== 'edit' || !canEdit || orcaAddressPending || normalizeZipDigits(draft.zip).length !== 7}
                      >
                        {orcaAddressPending ? '住所補完中…' : '住所補完'}
                      </button>
                      {fieldErrorMap.has('zip') ? (
                        <small id="patient-edit-error-zip" className="patient-edit__field-error" role="alert">
                          {fieldErrorMap.get('zip')}
                        </small>
                      ) : null}
                    </label>

                    <label className="patient-edit__field patient-edit__field--wide">
                      <span>住所</span>
                      <input
                        id="patient-edit-address"
                        value={draft.address ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
                        placeholder="東京都…"
                      />
                    </label>
                  </>
              </div>

              <div className="patient-edit__actions">
                <button type="button" className="patients-tab__ghost" onClick={onRollback} disabled={mutation.isPending}>
                  変更を巻き戻す
                </button>
                <button type="button" className="patients-tab__ghost" onClick={onRefetchBaseline} disabled={mutation.isPending}>
                  再取得
                </button>
                <div className="patient-edit__actions-spacer" />
                <button type="button" className="patients-tab__ghost" onClick={onClose} disabled={mutation.isPending}>
                  キャンセル
                </button>
                <button type="submit" className="patients-tab__primary" disabled={!canEdit || mutation.isPending}>
                  差分確認へ
                </button>
              </div>
            </form>
          ) : (
            <div className="patient-edit__review" aria-label="差分確認">
              <p className="patient-edit__review-title">差分（before / after）</p>
              <div className="patient-edit__diff" role="table" aria-label="差分テーブル">
                <div className="patient-edit__diff-header" role="row">
                  <div role="columnheader">項目</div>
                  <div role="columnheader">before</div>
                  <div role="columnheader">after</div>
                </div>
                {fieldOrder.map(renderRow)}
              </div>

              <label className="patient-edit__confirm">
                <input
                  id="patient-edit-confirm"
                  name="patientEditConfirm"
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                />
                <span>差分を確認しました（保存を実行します）</span>
              </label>

              <div className="patient-edit__actions">
                <button type="button" className="patients-tab__ghost" onClick={() => setStep('edit')} disabled={mutation.isPending}>
                  編集に戻る
                </button>
                <button
                  type="button"
                  className="patients-tab__ghost"
                  onClick={() => {
                    if (!lastAttemptRef.current) return;
                    mutation.mutate({
                      patient: lastAttemptRef.current.payload,
                      operation: lastAttemptRef.current.operation,
                      changedKeys: lastAttemptRef.current.changedKeys,
                    });
                  }}
                  disabled={!lastAttemptRef.current || mutation.isPending}
                >
                  直前の内容で再試行
                </button>
                <div className="patient-edit__actions-spacer" />
                <button type="button" className="patients-tab__primary" onClick={onSave} disabled={!canEdit || mutation.isPending}>
                  {mutation.isPending ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </FocusTrapDialog>
  );
}
