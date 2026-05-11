# ORCA Outage Recovery Runbook

## Purpose

ORCA / WebORCA が利用できない、または ORCA 送信結果が不明な場合に、OpenDolphinNext 正本を保護しながら診療継続・送信停止・復旧後再照合を行うための運用手順を固定する。

この runbook は `docs/contracts/orca-connection.md` と `docs/contracts/health-endpoints.md` の current contract に従う。接続先 URL、host、credential、raw ORCA body、患者氏名、住所、電話番号、保険詳細は証跡に残さない。

## Detection

- App shell に `ORCA連携停止中` が表示された場合、ORCA 停止または readiness 取得失敗として扱う。
- 管理者は `GET /api/health/readiness` または管理画面の運用監視で sanitized `checks.orca.status` と固定 `reasonCode` だけを確認する。
- `ORCA_UNKNOWN`、`ORCA_FAILED`、`CORRECTION_REQUIRED` の送信は Reception の ORCA送信要確認一覧で確認する。

## Allowed During ORCA Outage

- 診療録正本の閲覧。
- 診療録下書き保存。
- 運用設定で許可された診療録本文、SOAP、所見、説明内容の作成。
- 処方指示の下書き作成。
- 既存の診療時点スナップショット、ORCA由来キャッシュ、監査ログの参照。

## Blocked During ORCA Outage

- ORCA患者作成・更新送信。
- ORCA病名送信。
- ORCA診療行為送信。
- 会計送信、再送、追加送信、置換送信。
- ORCA送信成功、会計反映済み、登録済みへの UI 昇格。
- local-only 患者、病名、保険、会計情報を ORCA 正本として表示する fallback。

## DB Outage / Read-Only Mode

DB write path が利用できない、監査ログ書き込みが失敗する、または backup restore / migration recovery 中の場合は、OpenDolphinNext を read-only mode として扱う。ORCA が稼働していても、永続状態と監査ログを確定できない操作は実行しない。

backup / restore / hash verification の詳細手順は [backup-restore-hash-verification.md](./backup-restore-hash-verification.md) を正本とする。復元中は read-only mode を維持し、監査ログ hash chain、診療録/処方 content hash、document integrity、object storage inventory の検証が通るまで ORCA 再照合・再送・追加送信・置換送信を開始しない。

許可する操作:

- 既に永続化済みの診療録、確定済みリビジョン、処方指示履歴、診療時点スナップショット、ORCA由来キャッシュの閲覧。
- 既に永続化済みの監査ログ要約の閲覧。
- sanitized health / readiness の確認。

禁止する操作:

- 診療録下書き保存、確定、訂正、追記、取消。
- 処方作成、確定、変更、中止、取消、再発行。
- 添付文書の追加、削除、再関連付け。
- ORCA患者作成・更新、病名送信、診療行為送信、会計送信、再送、追加送信、置換送信。
- `ORCA_UNKNOWN` / `ORCA_FAILED` / `CORRECTION_REQUIRED` の再照合結果を永続状態へ反映する操作。
- DB 外の一時ファイル、ブラウザ保存領域、手元メモを診療録・処方・ORCA連携の代替正本として扱うこと。

UI は DB degraded / read-only と ORCA outage を混同しない。DB write path が落ちている場合は、ORCA readiness が `UP` でも ORCA送信操作を fail-closed にする。

## UNKNOWN Handling

1. `medicalmodv2` の通信断、`Medical_Uid` 欠落、parse ambiguity は `ORCA_UNKNOWN` とし、成功扱いにしない。
2. 同じ snapshot を即時再送しない。
3. Reception の ORCA送信要確認一覧から `ORCA状態を再照合` を実行する。
4. 再照合 request は server-side transmission ID だけを使う。patient、facility、insurance、voucher、sequential、`Medical_Uid`、URL、raw XML は client から受け取らない。
5. `tmedicalgetv2` の一致候補がある場合も、再送成功や会計反映済みとは扱わず、内容確認後の明示操作まで `needsUserReview=true` を維持する。
6. `Medical_Mode` または `Medical_Mode2` が空でなく `0` 以外の場合は `resendBlocked=true` とし、管理者確認なしに再送しない。

## Recovery After ORCA Restores

1. `GET /api/health/readiness` の sanitized ORCA check が `UP` に戻ったことを確認する。
2. Reception の ORCA送信要確認一覧を再取得する。
3. `ORCA_UNKNOWN`、`ORCA_FAILED`、`CORRECTION_REQUIRED` の各 transmission に対して `tmedicalgetv2` 再照合を実行する。
4. 再送前に、現在 ORCA 状態、前回送信 snapshot、患者番号、診療日、診療科、担当医、保険組合せ、会計済み/展開済みの可能性を確認する。
5. 差分や `resendBlocked` がある場合は管理者確認フローに回す。
6. 再送または追加送信が必要な場合も、server-side snapshot と server-derived encounter context から payload を再構成する。client-provided voucher、sequential、insurance combination、`Medical_Uid` は使わない。
7. すべての再照合、再送、停止判断を監査ログに残す。監査ログは sanitized summary と固定 status/reason code に限定する。

## Recovery After DB Restore

1. DB health と監査ログ書き込み health が sanitized `UP` に戻ったことを確認する。
2. read-only mode を解除する前に、監査ログ hash chain と診療録 `content_hash` 検証を実行する。
3. backup restore 後の local `ORCA_SENT`、`ORCA_CONFIRMED`、`ORCA_UNKNOWN`、`ORCA_FAILED`、`CORRECTION_REQUIRED` は、local DB 上の状態だけで正本確定しない。
4. ORCA患者、受付、保険、病名、診療行為、会計に関わる表示は server adapter 経由で ORCA から再取得する。local cache / snapshot は比較対象であり、現在正本として昇格しない。
5. 送信系 transmission は自動再送しない。まず Reception の ORCA送信要確認一覧に出し、`tmedicalgetv2` read-only 再照合で ORCA 側状態を確認する。
6. restore 前後の local snapshot と ORCA 再取得結果に差分がある場合は `NEEDS_REVIEW` とし、管理者確認まで再送・追加送信・置換送信を止める。
7. `Medical_Mode` または `Medical_Mode2` が空でなく `0` 以外の場合は、restore 前の local 状態に関係なく `resendBlocked=true` とする。
8. 復旧判断、hash chain 検証、content hash 検証、ORCA再取得、差分照合、再送可否判断を監査ログに保存する。監査ログには raw ORCA body、患者詳細、保険詳細、接続先情報を残さない。

## Evidence Policy

- 記録してよいもの: RUN_ID、traceId、operationStatus、reconciliationStatus、transmissionId、snapshotId、row count、`Medical_Uid` の存在有無、`Medical_Mode` / `Medical_Mode2`、`resendBlocked`、固定 reason code。
- 記録してはいけないもの: ORCA URL、host、port、Basic 認証、証明書、raw ORCA body、raw XML、患者氏名、住所、電話番号、保険詳細、`Medical_Uid` 値、voucher、sequential、insurance combination。

## Verification

- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `bash server-modernized/tools/ci/check-backup-restore-runbook.sh --root "$(git rev-parse --show-toplevel)"`
- `bash server-modernized/tools/ci/check-doc-links.sh`
- `bash server-modernized/tools/ci/check-config-contract.sh`
- `bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"`
