import { useState } from 'react';

import type { MedicalPatientSummary, MedicalRecordEntry, OrcaInternalWrapperBase } from '../orcaInternalWrapperApi';

import { AdminAlert } from '../components/AdminAlert';
import { AdminCard } from '../components/AdminCard';
import { AdminCodeBlock } from '../components/AdminCodeBlock';
import { AdminField } from '../components/AdminField';
import { AdminStatusPill } from '../components/AdminStatusPill';

type OrcaInternalWrapperEndpoint =
  | 'medical-sets'
  | 'birth-delivery'
  | 'medical-records'
  | 'patient-mutation'
  | 'chart-subjectives';

type OrcaInternalWrapperOption = {
  id: OrcaInternalWrapperEndpoint;
  label: string;
  hint: string;
  stubFixed?: boolean;
  routeNamespace?: 'official' | 'master' | 'local';
  behavior?: string;
};

type OrcaInternalWrapperResult = OrcaInternalWrapperBase & {
  generatedAt?: string;
  patient?: MedicalPatientSummary;
  records?: MedicalRecordEntry[];
  warnings?: string[];
  recordedAt?: string;
  patientDbId?: number;
  patientId?: string;
};

type OrcaInternalWrapperFormState = {
  payload: string;
  result?: OrcaInternalWrapperResult | null;
  parseError?: string;
};

type OrcaInternalWrapperCardProps = {
  isSystemAdmin: boolean;
  guardDetailsId?: string;
  options: OrcaInternalWrapperOption[];
  target: OrcaInternalWrapperEndpoint;
  currentOption: OrcaInternalWrapperOption;
  currentState: OrcaInternalWrapperFormState;
  result: OrcaInternalWrapperResult | null;
  statusTone: 'ok' | 'warn' | 'error' | 'pending' | 'idle';
  statusLabel: string;
  pending: boolean;
  onTargetChange: (value: OrcaInternalWrapperEndpoint) => void;
  onPayloadChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
};

export function OrcaInternalWrapperCard({
  isSystemAdmin,
  guardDetailsId,
  options,
  target,
  currentOption,
  currentState,
  result,
  statusTone,
  statusLabel,
  pending,
  onTargetChange,
  onPayloadChange,
  onSubmit,
  onReset,
}: OrcaInternalWrapperCardProps) {
  const readOnly = !isSystemAdmin;
  const [formatError, setFormatError] = useState<string | null>(null);

  const handleFormatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(currentState.payload), null, 2);
      onPayloadChange(formatted);
      setFormatError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSON parse error';
      setFormatError(message);
    }
  };

  const stubLabel = result ? (result.stub ? 'stub' : result.ok ? 'real' : 'error') : '―';
  const routeNamespaceLabel = currentOption.routeNamespace ?? 'unknown';
  const behaviorLabel = currentOption.behavior ?? (currentOption.stubFixed ? 'stub_fixed' : 'custom');

  return (
    <AdminCard
      title="ORCA内製ラッパー"
      description="capability で許可された local-only wrapper だけを表示します。official ORCA API 互換の画面ではありません。"
      status={<AdminStatusPill status={statusTone} value={statusLabel} />}
    >
      <div className="admin-inline-meta">
        <span>HTTP: {result?.status ?? '―'}</span>
        <span>Api_Result: {result?.apiResult ?? '―'}</span>
        <AdminStatusPill status="idle" value={`scope: ${routeNamespaceLabel}`} />
        <AdminStatusPill status="idle" value={`behavior: ${behaviorLabel}`} />
        <AdminStatusPill status={result?.stub ? 'warn' : result?.ok ? 'ok' : 'idle'} value={`source: ${stubLabel}`} />
        {currentOption.stubFixed ? <AdminStatusPill status="warn" value="stub固定" /> : null}
      </div>
      {result?.stub ? (
        <AdminAlert tone="warn" message="この wrapper は現在 stub 応答を返しています。official ORCA 実データではありません。" />
      ) : null}
      {routeNamespaceLabel !== 'official' ? (
        <AdminAlert
          tone="info"
          message={`この導線は ${routeNamespaceLabel} namespace の ${behaviorLabel} contract です。official ORCA bridge としては扱いません。`}
        />
      ) : null}

      <AdminField label="エンドポイント" htmlFor="orca-internal-endpoint" hint={currentOption.hint}>
        <select
          id="orca-internal-endpoint"
          value={target}
          onChange={(event) => onTargetChange(event.target.value as OrcaInternalWrapperEndpoint)}
          disabled={readOnly}
          aria-describedby={readOnly ? guardDetailsId : undefined}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </AdminField>

      <AdminField
        label="payload (JSON)"
        htmlFor="orca-internal-payload"
        error={currentState.parseError ?? formatError ?? undefined}
      >
        <textarea
          id="orca-internal-payload"
          className="admin-textarea"
          value={currentState.payload}
          onChange={(event) => {
            onPayloadChange(event.target.value);
            if (formatError) setFormatError(null);
          }}
          readOnly={readOnly}
          aria-readonly={readOnly}
          aria-describedby={readOnly ? guardDetailsId : undefined}
          rows={8}
        />
      </AdminField>

      <div className="admin-actions">
        <button type="button" className="admin-button admin-button--secondary" onClick={handleFormatJson} disabled={readOnly}>
          JSON整形
        </button>
        <button type="button" className="admin-button admin-button--primary" onClick={onSubmit} disabled={pending || readOnly}>
          送信
        </button>
        <button type="button" className="admin-button admin-button--secondary" onClick={onReset} disabled={pending || readOnly}>
          テンプレ再生成
        </button>
      </div>

      {result ? (
        <div className="admin-result admin-result--stack">
          <div>Api_Result: {result.apiResult ?? '―'}</div>
          <div>Message: {result.apiResultMessage ?? '―'}</div>
          {result.messageDetail ? <div>Detail: {result.messageDetail}</div> : null}
          {result.warningMessage ? <div>Warning: {result.warningMessage}</div> : null}
          {result.generatedAt ? <div>generatedAt: {result.generatedAt}</div> : null}
          {result.recordedAt ? <div>recordedAt: {result.recordedAt}</div> : null}
          {result.patient ? (
            <div>
              patient: {result.patient.patientId ?? '―'} / {result.patient.wholeName ?? '―'}
            </div>
          ) : null}
          {result.records ? <div>records: {result.records.length}件</div> : null}
          {result.warnings?.length ? <div>warnings: {result.warnings.join(' / ')}</div> : null}
          {result.error ? <div className="admin-error">error: {result.error}</div> : null}
        </div>
      ) : null}

      {result?.records ? (
        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>診療日</th>
                <th>部門</th>
                <th>status</th>
                <th>documentId</th>
              </tr>
            </thead>
            <tbody>
              {result.records.length ? (
                result.records.map((record, index) => (
                  <tr key={`${record.documentId ?? 'record'}-${index}`}>
                    <td>{record.performDate ?? '―'}</td>
                    <td>{record.departmentName ?? record.departmentCode ?? '―'}</td>
                    <td>{record.documentStatus ?? '―'}</td>
                    <td>{record.documentId ?? '―'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>診療記録はまだ取得されていません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {result ? (
        <AdminCodeBlock
          value={JSON.stringify(result.raw ?? {}, null, 2)}
          language="json"
          title="internal wrapper raw"
          collapsedByDefault
        />
      ) : null}
    </AdminCard>
  );
}
