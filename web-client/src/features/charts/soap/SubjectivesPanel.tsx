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
      message={readOnlyReason ?? '症状詳記セクションは廃止しました。SOAP 入力は通常のカルテ導線で扱います。'}
      runId={runId}
      showMeta={false}
    />
  );
}
