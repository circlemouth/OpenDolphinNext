# Web クライアント API マッピング（RUN_ID=20251208T124645Z）

- Phase2 foundation の優先領域（`docs/server-modernization/phase2/foundation/IMPACT_MATRIX.md`）を踏まえ、外来/ORCA マスタ連携の接点を `httpClient` 層で一覧化します。
- `web-client/src/libs/http/httpClient.ts` に新設した `OUTPATIENT_API_ENDPOINTS` 定義は本書のテーブルと同期させ、今後の `resolveMasterSource`/監査メタ・フロー設計で共通参照源として使います。
- RUN_ID=`20251208T124645Z` で `/api/orca/medical/outpatient` を server-modernized に stub 実装し、`runId/dataSourceTransition/cacheHit/missingMaster/fallbackUsed` を含む telemetry 応答と `artifacts/api-stability/20251208T124645Z/outpatient/` のフィクスチャを揃えました（証跡: `docs/server-modernization/phase2/operations/logs/20251208T124645Z-api-gap-implementation.md`）。

## 1. 外来オペレーションで使う主要エンドポイント

| 概要 | エンドポイント | メソッド | 役割 | 渡すべき監査メタ | 参照ログ |
| --- | --- | --- | --- | --- | --- |
| 予約/請求試算/来院 | `/api/orca/appointments/list/*` | ANY | 予約一覧、患者別予約、請求試算、来院中リストなどを返却し、`ORCA_APPOINTMENT_OUTPATIENT` 相当の `details` を構成する。 | `runId/dataSource/cacheHit/missingMaster/fallbackUsed/dataSourceTransition/fetchedAt` | 同上 |
| カルテの外来医療記録 | `/api/orca/medical/outpatient` | ANY | Charts の DocumentTimeline/Search が使う medicalrecord を取得し、`recordsReturned`/`outcome` に対応する `auditEvent` を発行する。 | `runId/dataSource/cacheHit/missingMaster/fallbackUsed/dataSourceTransition/recordsReturned` | `docs/server-modernization/phase2/operations/logs/20251208T124645Z-api-gap-implementation.md` |
| 患者情報・保険登録 | `/api/orca/patient/mutation` | ANY | Patients/Administration で患者基本・保険情報を `create/update/delete` し、`action=ORCA_PATIENT_MUTATION` と `operation`/`facilityId` を監査ログに伝える。 | `runId/dataSource/cacheHit/missingMaster/fallbackUsed/operation` | 同上 |

## 2. `resolveMasterSource` と `dataSourceTransition=server` の実装前提

1. `resolveMasterSource(masterType)` は `WEB_ORCA_MASTER_SOURCE` / `VITE_DISABLE_MSW` / ランタイムでの `cmsHealth` などの reachability 判定を総合して `mock` → `snapshot` → `server` → `fallback` の順で `dataSource` を返す。
2. `server` に移行した際（`dataSourceTransition=server`）は `fetchWithResolver` により `runId/dataSource/dataSourceTransition/cacheHit/missingMaster/fallbackUsed` を `auditEvent`/`audit.logUiState` に必ず書き出す。`cacheHit` は React Query の `isCached`/`isStale` で判定し、キャッシュ命中時は `true`、強制リフェッチ時は `false` を送信する。
3. フローの概念図：

```
[MSW fixtures] --(障害/FLAGS)--> [snapshot artifacts] --(WEB_ORCA_MASTER_SOURCE=server + 可用性確認)--> [server ORCA-05/06/08] --(schema mismatch / timeout)--> [fallback constants]
                           |                                    |                                                    |
                    `cacheHit=true`                     `dataSourceTransition=server`                               `fallbackUsed=true`
```

この図は `docs/server-modernization/phase2/operations/logs/20251124T073245Z-webclient-master-bridge.md` の設計を参照し、`resolveMasterSource` が `server` を返すタイミングで Playwright/Stage が `warning banner tone=server` を再現できるよう誘導します。

## 3. `auditEvent` は `runId` を軸に metadata を透過

- `docs/server-modernization/phase2/operations/orca-master-sprint-plan.md` で定義されている共通 metadata（`runId`, `dataSource`, `snapshotVersion`, `cacheHit`, `missingMaster`, `fallbackUsed`, `dataSourceTransition`, `fetchedAt`）をすべて `details` に入れ、UI は `audit.logUiState` で `tone`/`aria-live` などと紐づける。`claim`/`appointment` では `facilityId`/`patientId`/`appointmentId`/`claimBundles` を追加。
- `medicalmodv2/outpatient`では `recordsReturned`/`outcome=SUCCESS` 明示と `traceId`/`requestId` の伝播、`patientmodv2/outpatient` では `operation=create|update|delete` を `details` に記録し `ORCA_PATIENT_MUTATION` の audit を完成させる。
- `httpClient` 側では上記エンドポイントの定義を `OUTPATIENT_API_ENDPOINTS` に集約し、追跡や Playwright の `extraHTTPHeaders` にも同じ `runId` を透過できるようにします。

## 3.5 Legacy REST 互換 API（debug 導線）

RUN_ID=20260114T134736Z。Legacy REST は **debug 導線**（`/debug/legacy-rest`）のみで疎通確認し、通常導線には出さない。

| 概要 | エンドポイント | メソッド | 役割 | 監査メタ | UI 表現 |
| --- | --- | --- | --- | --- | --- |
| 受付/来院 | `/pvt` `/pvt2` `/appo` | ANY | Legacy 受付/来院系の疎通確認 | `runId/traceId/screen/action/endpoint/legacy` | 2xx=success / 4xx=warning / 5xx=error |
| カルテ/ドキュメント | `/karte` `/stamp` `/patient` `/odletter` | ANY | Legacy カルテ/文書の疎通確認 | 同上 | 同上 |
| スケジュール/帳票/検体 | `/schedule` `/reporting/karte` `/lab` `/mml` | ANY | Legacy 帳票/検体の疎通確認 | 同上 | `content-type` に応じて JSON/テキスト/バイナリ表示 |
| イベント/システム | `/chartEvent` `/chart-events` `/system` `/serverinfo` `/demo` | ANY | Legacy イベント/システム系の疎通確認 | 同上 | 2xx/4xx 判定を UI に表示 |

- 実装: `web-client/src/features/debug/legacyRestApi.ts` / `web-client/src/features/debug/LegacyRestConsolePage.tsx`
- 監査: `logAuditEvent` の `payload.legacy=true` を必須化し、`screen=debug/legacy-rest` `action=legacy-rest-request` `endpoint=/...` を明示。
- 応答形態: `content-type` が `text|json|xml` の場合は本文表示、それ以外はバイナリサイズのみ表示。

## 3.6 Legacy REST 互換 API（通常導線 / Administration）

RUN_ID=20260114T135802Z。system_admin 専用の通常導線として Administration 画面に Legacy REST パネルを追加し、2xx/4xx 判定を UI で確認できるようにした。

| 概要 | エンドポイント | 画面 | 役割 | 監査メタ | UI 表現 |
| --- | --- | --- | --- | --- | --- |
| Legacy REST 疎通 | `/pvt` `/pvt2` `/appo` `/karte` `/stamp` `/patient` `/odletter` `/schedule` `/reporting/karte` `/lab` `/mml` `/chartEvent` `/chart-events` `/system` `/serverinfo` `/demo` | Administration | system_admin が疎通確認する最小導線 | `runId/traceId/screen/action/endpoint/legacy` | 2xx=success / 4xx=warning / 5xx=error |

- 導線: `/f/:facilityId/administration` → 「Legacy REST 互換 API（通常導線）」パネル
- 監査: `screen=administration/legacy-rest`, `action=legacy-rest-request`, `payload.legacy=true`, `payload.endpoint` を必須化。

## 4. バナーとの連携ポイント

- Reception/Charts の ORCA バナーは `missingMaster=true` を受け取った際に `tone=warning`/`aria-live=assertive` を発火し、`cacheHit=false` であれば `retry` ボタンを表示する。`resolveMasterSource` で `server` に移行したら `dataSourceTransition=server` を `AuditSummary` に反映し、ヘッダーの `data-run-id` を更新する。
- Patients/Administration では `ORCA_PATIENT_MUTATION` の `details.operation` を権限ガードと同期させ、`fallbackUsed=true` が設定された場合は `warning` トーストを表示し保存をブロックする。

## 参照資料
- `docs/server-modernization/phase2/foundation/IMPACT_MATRIX.md`
- `docs/server-modernization/phase2/operations/orca-master-sprint-plan.md`
- `docs/server-modernization/phase2/operations/logs/20251124T073245Z-webclient-master-bridge.md`
- `docs/server-modernization/phase2/operations/logs/20251204T064209Z-api-gap.md`
