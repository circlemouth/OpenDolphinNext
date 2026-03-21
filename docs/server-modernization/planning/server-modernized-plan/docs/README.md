# server-modernized ドキュメント索引

このディレクトリは、`server-modernized` の次の開発ドキュメント一式に含まれる運用・契約文書の索引である。
`README.md` を入口にして、必要な契約文書と運用文書へ進む。

## 先に読む文書
- `docs/development/server-modernized-remediation-master-checklist.md`
- `docs/development/pull-request-checklist-template.md`

## 契約文書
- `docs/contracts/runtime-config.md`
- `docs/contracts/health-endpoints.md`
- `docs/contracts/orca-connection.md`
- `docs/contracts/document-integrity.md`
- `docs/contracts/patient-images.md`
- `docs/contracts/orca-master-api.md`

## 運用文書
- `docs/runbooks/release-validation.md`

## 運用原則
- コード変更と同じ PR で関連文書を更新する。
- 文書が更新されていないコード変更はマージしない。
- 後方互換は保持しない。互換レイヤーを増やすより、契約を整理して古い分岐を削除する。
- 過去の DB 遺産は前提にしない。実行時 DDL ではなく Flyway を唯一のスキーマ変更手段とする。
- 本番運用を前提とし、fail-fast / fail-closed / 最小権限 / 情報最小公開を優先する。
