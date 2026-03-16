import { ToneBanner } from '../../reception/components/ToneBanner';

type SubjectivesPanelProps = {
  patientId?: string;
  visitDate?: string;
  runId?: string;
  suggestedText?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
};

export function SubjectivesPanel({ readOnly = false, readOnlyReason, runId }: SubjectivesPanelProps) {
  return (
    <ToneBanner
      tone={readOnly ? 'warning' : 'info'}
      message={readOnlyReason ?? '症状詳記 UI は撤去しました。SOAP 入力と ORCA 送信は通常のオーダー/カルテ導線に統一しています。'}
      runId={runId}
      showMeta={false}
    />
  );
}
