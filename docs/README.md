# Docs Index

このディレクトリは、`server-modernized` の現行運用ドキュメントと開発契約の索引である。更新対象は repo root 側の文書を正本とし、参照用の計画ディレクトリは原則として編集しない。

## 先に読む文書
- [現行開発計画](development/phase2_current_coding_tasks_checklist_v1.md)
- [開発状況](DEVELOPMENT_STATUS.md)
- [開発計画インデックス](development/README.md)
- [Server-Modernization ハブ](server-modernization/README.md)
- [server-modernized 改修計画の入口](server-modernization/planning/server-modernized-plan/README.md)

## 開発文書
- [開発計画インデックス](development/README.md)
- [現行コーディングタスク開発チェックリスト](development/phase2_current_coding_tasks_checklist_v1.md)
- [改修マスターチェックリスト](development/server-modernized-remediation-master-checklist.md)
- [PR チェックリストテンプレート](development/pull-request-checklist-template.md)
- [実行ログ](development/execution-log.md)

## 契約文書
- [Runtime Config](contracts/runtime-config.md)
- [Health Endpoint](contracts/health-endpoints.md)
- [ORCA Connection](contracts/orca-connection.md)
- [Document Integrity](contracts/document-integrity.md)
- [Patient Images](contracts/patient-images.md)
- [ORCA Master API](contracts/orca-master-api.md)

## 運用文書
- [Release Validation Runbook](runbooks/release-validation.md)

## 運用原則
- コード変更と同じ PR で関連文書を更新する。
- 文書が更新されていないコード変更はマージしない。
- 後方互換は保持しない。
- 過去の DB 遺産は前提にしない。
- fail-fast / fail-closed / 最小権限 / 情報最小公開を優先する。
