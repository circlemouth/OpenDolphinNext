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
      message={readOnlyReason ?? '症状詳記の専用入力は廃止しました。必要な補足は院内ローカル SOAP 入力で扱います。'}
      runId={runId}
      showMeta={false}
    />
  );
}
