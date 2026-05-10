import { useMemo, useState } from 'react';

import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { getObservabilityMeta, resolveAriaLive } from '../../libs/observability/observability';
import { useSession } from '../../AppRouter';
import { RunIdBadge } from '../shared/RunIdBadge';
import {
  ORCA_INTERNAL_WRAPPER_ENDPOINTS,
  postOrcaInternalWrapper,
  type OrcaInternalWrapperEndpoint,
  type OrcaInternalWrapperResult,
} from '../administration/orcaInternalWrapperApi';
import './orcaInternalWrapper.css';

type WrapperFormState = {
  payloadText: string;
  dirty: boolean;
  sending: boolean;
  error?: string;
  result?: OrcaInternalWrapperResult | null;
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDefaultPayloads = (today: string) => {
  const fromDate = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  return {
    'medical-sets': {
      requestNumber: '01',
      patientId: '00002',
      sets: [
        {
          medicalClass: '110',
          medicationCode: '112007410',
          medicationName: 'テスト薬剤',
          quantity: '1',
          note: '',
        },
      ],
    },
    'birth-delivery': {
      requestNumber: '01',
      patientId: '00002',
      insuranceCombinationNumber: '0001',
      performDate: today,
      note: '検証用の入力例',
    },
    'medical-records': {
      patientId: '00002',
      fromDate,
      toDate: today,
      performMonths: 12,
      departmentCode: '01',
      sequentialNumber: '',
      insuranceCombinationNumber: '0001',
      includeVisitStatus: false,
    },
    'chart-subjectives': {
      patientId: '00002',
      performDate: today,
      soapCategory: 'S',
      physicianCode: '10001',
      body: '主訴のテスト入力です。',
    },
  } satisfies Record<OrcaInternalWrapperEndpoint, Record<string, unknown>>;
};

const buildInitialState = (defaults: Record<OrcaInternalWrapperEndpoint, Record<string, unknown>>) => {
  const entries = ORCA_INTERNAL_WRAPPER_ENDPOINTS.map((endpoint) => {
    const payload = defaults[endpoint.id] ?? {};
    const state: WrapperFormState = {
      payloadText: JSON.stringify(payload, null, 2),
      dirty: false,
      sending: false,
      result: null,
    };
    return [endpoint.id, state] as const;
  });
  return Object.fromEntries(entries) as Record<OrcaInternalWrapperEndpoint, WrapperFormState>;
};

export function OrcaInternalWrapperPage() {
  const session = useSession();
  const today = useMemo(() => formatDate(new Date()), []);
  const defaults = useMemo(() => buildDefaultPayloads(today), [today]);
  const [selected, setSelected] = useState<OrcaInternalWrapperEndpoint>('medical-sets');
  const [states, setStates] = useState<Record<OrcaInternalWrapperEndpoint, WrapperFormState>>(() =>
    buildInitialState(defaults),
  );

  const current = states[selected];
  const selectedDefinition =
    ORCA_INTERNAL_WRAPPER_ENDPOINTS.find((entry) => entry.id === selected) ?? ORCA_INTERNAL_WRAPPER_ENDPOINTS[0];

  const updateState = (endpoint: OrcaInternalWrapperEndpoint, patch: Partial<WrapperFormState>) => {
    setStates((prev) => ({
      ...prev,
      [endpoint]: {
        ...prev[endpoint],
        ...patch,
      },
    }));
  };

  const handleReset = () => {
    updateState(selected, {
      payloadText: JSON.stringify(defaults[selected], null, 2),
      dirty: false,
      error: undefined,
    });
  };

  const handleSend = async () => {
    const raw = current.payloadText.trim();
    let payload: Record<string, unknown> = {};
    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch (error) {
        updateState(selected, {
          error: error instanceof Error ? error.message : 'JSON の解析に失敗しました。',
        });
        return;
      }
    }

    updateState(selected, { sending: true, error: undefined });
    try {
      const result = await postOrcaInternalWrapper(selected, payload);
      updateState(selected, { result, sending: false });

      const resolvedRunId = result.runId ?? getObservabilityMeta().runId;
      logUiState({
        action: 'send',
        screen: 'debug/orca-internal-wrapper',
        runId: resolvedRunId,
        traceId: result.traceId,
        missingMaster: result.missingMaster,
        fallbackUsed: result.fallbackUsed,
        dataSourceTransition: result.dataSourceTransition,
        details: {
          endpoint: result.path,
          status: result.status,
          ok: result.ok,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
          isStub: result.isStub,
          messageDetail: result.messageDetail,
          warningMessage: result.warningMessage,
          error: result.error,
          errorDetail: result.errorDetail,
          recordsReturned: result.recordsReturned,
        },
      });
      logAuditEvent({
        runId: resolvedRunId,
        traceId: result.traceId,
        source: 'orca-internal-wrapper',
        missingMaster: result.missingMaster,
        fallbackUsed: result.fallbackUsed,
        dataSourceTransition: result.dataSourceTransition,
        payload: {
          action: 'ORCA_INTERNAL_WRAPPER_SEND',
          outcome: result.ok ? 'success' : 'error',
          details: {
            endpoint: result.path,
            status: result.status,
            apiResult: result.apiResult,
            apiResultMessage: result.apiResultMessage,
            messageDetail: result.messageDetail,
            warningMessage: result.warningMessage,
            isStub: result.isStub,
            missingMaster: result.missingMaster,
            fallbackUsed: result.fallbackUsed,
            dataSourceTransition: result.dataSourceTransition,
            error: result.error,
            errorDetail: result.errorDetail,
            recordsReturned: result.recordsReturned,
          },
        },
      });
    } catch (error) {
      updateState(selected, {
        sending: false,
        result: {
          endpoint: selected,
          path: selectedDefinition.path,
          ok: false,
          status: 0,
          raw: {},
          payload: undefined,
          rawText: null,
          records: [],
          error: error instanceof Error ? error.message : '送信に失敗しました。',
        },
      });
    }
  };

  const response = current.result;
  const responseStatus = response ? `HTTP ${response.status}` : '未送信';
  const hasApiResult = Boolean(response?.apiResult);
  const dataBadgeClass = response
    ? response.isStub
      ? 'is-stub'
      : hasApiResult
        ? 'is-real'
        : 'is-warning'
    : 'is-warning';
  const dataBadgeLabel = response
    ? response.isStub
      ? 'stub応答'
      : hasApiResult
        ? '実データ'
        : '判定不能'
    : '未送信';

  const missingMasterLabel = response
    ? response.missingMasterProvided
      ? String(response.missingMaster)
      : '未提供'
    : '—';
  const fallbackUsedLabel = response
    ? response.fallbackUsedProvided
      ? String(response.fallbackUsed)
      : '未提供'
    : '—';

  return (
    <main className="orca-internal-wrapper">
      <header className="orca-internal-wrapper__header">
        <div>
          <p className="orca-internal-wrapper__kicker">Debug / ORCA Internal Wrapper</p>
          <h1>ORCA 内製ラッパー（stub混在）</h1>
          <p className="orca-internal-wrapper__sub">
            JSON ラッパー API の stub/実データ判定と監査メタを確認します（QA/検証専用）。
          </p>
        </div>
        <div>
          <RunIdBadge runId={response?.runId ?? getObservabilityMeta().runId} />
          <p className="orca-internal-wrapper__hint" style={{ marginTop: '0.5rem' }}>
            facility: {session.facilityId} / user: {session.userId}
          </p>
        </div>
      </header>

      <section className="orca-internal-wrapper__grid">
        <div className="orca-internal-wrapper__panel">
          <label>
            <span>API 選択</span>
            <select
              id="orca-internal-endpoint"
              name="orcaInternalEndpoint"
              value={selected}
              onChange={(event) => setSelected(event.target.value as OrcaInternalWrapperEndpoint)}
            >
              {ORCA_INTERNAL_WRAPPER_ENDPOINTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <p className="orca-internal-wrapper__hint">{selectedDefinition.description}</p>
          <div className="orca-internal-wrapper__defaults">
            <span>Template date: {today}</span>
            <span className={`orca-internal-wrapper__badge ${selectedDefinition.stub ? 'is-stub' : 'is-real'}`}>
              {selectedDefinition.stub ? 'stub想定' : '実データ対応'}
            </span>
          </div>
          <label className="orca-internal-wrapper__textarea">
            <span>JSON Payload</span>
            <textarea
              id="orca-internal-payload"
              name="orcaInternalPayload"
              value={current.payloadText}
              rows={14}
              onChange={(event) =>
                updateState(selected, {
                  payloadText: event.target.value,
                  dirty: true,
                })
              }
            />
          </label>
          {current.error ? (
            <div className="orca-internal-wrapper__error-box" role="alert">
              JSON エラー: {current.error}
            </div>
          ) : null}
          <div className="orca-internal-wrapper__actions">
            <button type="button" className="ghost" onClick={handleReset} disabled={!current.dirty || current.sending}>
              テンプレへ戻す
            </button>
            <button type="button" onClick={handleSend} disabled={current.sending}>
              {current.sending ? '送信中…' : '送信'}
            </button>
          </div>
        </div>

        <div className="orca-internal-wrapper__panel">
          <header className="orca-internal-wrapper__panel-header">
            <h2>レスポンス</h2>
            <span className="orca-internal-wrapper__meta">{responseStatus}</span>
          </header>
          {response ? (
            <>
              <div className="orca-internal-wrapper__status" aria-live={resolveAriaLive(response.ok ? 'info' : 'warning')}>
                <span className={`orca-internal-wrapper__badge ${dataBadgeClass}`}>{dataBadgeLabel}</span>
                <span>Api_Result: {response.apiResult ?? '—'}</span>
                <span>Api_Result_Message: {response.apiResultMessage ?? '—'}</span>
                <span>Message_Detail: {response.messageDetail ?? '—'}</span>
                <span>Warning: {response.warningMessage ?? '—'}</span>
                <span>RunId: {response.runId ?? '—'}</span>
                <span>TraceId: {response.traceId ?? '—'}</span>
                <span>dataSourceTransition: {response.dataSourceTransition ?? '—'}</span>
                <span>missingMaster: {missingMasterLabel}</span>
                <span>fallbackUsed: {fallbackUsedLabel}</span>
                <span>recordsReturned: {response.recordsReturned ?? '—'}</span>
                {response.error ? <span className="orca-internal-wrapper__error">Error: {response.error}</span> : null}
                {response.errorDetail ? (
                  <span className="orca-internal-wrapper__warning">Detail: {response.errorDetail}</span>
                ) : null}
              </div>
              <pre className="orca-internal-wrapper__response">
                {response.rawText ? response.rawText : 'レスポンス本文は空です。'}
              </pre>
            </>
          ) : (
            <p className="orca-internal-wrapper__empty">送信結果がここに表示されます。</p>
          )}
        </div>
      </section>
    </main>
  );
}
