# Export / Readability Contract

## Purpose

診療録・処方指示・ORCA連携履歴の見読性、保存性、説明可能性を固定する。

OpenDolphinNext 正本である診療録本文、SOAP、所見、患者説明、処方指示は export 対象に含める。ORCA / WebORCA 正本由来の受付、保険、診療行為、会計、収納、領収、帳票、レセプトは cache / snapshot / operation ledger / reconciliation summary としてだけ含め、local 正本として扱わない。

## Export Units

- Patient scoped export: 患者に紐づく診療録 revision、SOAP/所見/説明、添付文書メタデータ、処方履歴、ORCA operation ledger 要約を含む。
- Visit-date scoped export: 当日の診療録、処方、ORCA送信候補、ORCAレスポンス hash、警告、不一致、UNKNOWN / reconciliation status を含む。
- Period scoped export: 期間内の診療録 revision と、確定、訂正、追記、取消、無効化、処方変更、中止、取消、再発行、再送履歴を含む。

## JSON Contract

JSON export は機械可読な audit / snapshot / event id を保持する。

- `exportSchemaVersion`
- `exportHashAlgorithm`
- `exportHash`
- `chartId`
- `currentRevisionId`
- `revisions[].revisionId`
- `revisions[].contentHash`
- `revisions[].snapshotManifest`
- `revisions[].clinicalSections[]`
- `revisions[].attachments[]`
- `events[].eventId`
- `prescriptionEvents[].eventId`
- `orcaEvents[].orcaOperationId`
- `orcaEvents[].latestTransmissionId`
- `orcaEvents[].requestHash`
- `orcaEvents[].responseHash`
- `orcaEvents[].reconciliationStatus`

`clinicalSections[]` は `sourceOfTruth=OpenDolphinNext` / `sourceLayer=chart-authority` を持つ。`attachments[]` は attachment body や storage URI / object key を含めず、file name、content type、size、digest、externalized flag だけを含める。

## PDF / Print Readability

PDF / print には少なくとも次を表示する。

- 患者識別情報
- 診療日
- ORCA受付IDまたは受付なし / snapshot 欠落の理由
- 診療科
- 担当医
- 保険組合せ
- export hash
- 診療録本文 / SOAP / 所見 / 患者説明
- 添付文書メタデータ
- 訂正、追記、取消、無効化履歴
- 処方 event 履歴
- ORCA operation ledger 要約

ORCA送信成功、診療録確定、処方確定、会計済み、収納済み、領収発行、レセプト作成は別状態として表示する。`UNKNOWN`、警告、不一致、`NEEDS_REVIEW` は成功へ丸めない。

## CSV Contract

CSV は監査・移行用であり、表示用正本ではない。各行は次の共通列を持つ。

- `recordType`
- `chartId`
- `currentRevisionId`
- `revisionId`
- `revisionNumber`
- `status`
- `eventId`
- `eventType`
- `actorUserId`
- `occurredAt`
- `reasonCode`
- `reasonText`
- `contentHash`
- `summary`

CSV 出力は spreadsheet formula injection を防ぐため、`=`, `+`, `-`, `@`, tab で始まる値を neutralize する。

## Redaction Boundary

export / PDF / CSV / validation evidence に次を含めてはならない。

- ORCA URL / host / credential-bearing URL
- Basic / Authorization / Cookie / JSESSIONID / CSRF
- ORCA username / password
- client certificate / certificate password / private key
- raw ORCA XML / raw ORCA JSON body
- raw report binary / raw request XML
- storage URI / object key / bucket / digest authority supplied by client
- HAR / trace / video / screenshot / raw network JSON

Hash, count, status, event id, operation id, transmission id, sanitized warning class, sanitized mismatch class は export 可能とする。
