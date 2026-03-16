# P2-10 新旧 API 差分・移行後契約（RUN_ID: 20260315T060323Z）

- 更新日: 2026-03-15
- 目的: `P2-10` として、残す API / 廃止 API / 移行先 URI / 必須ヘッダ / 認証前提を 1 枚に固定する。
- 前提: `docs/modernization/api-v1-design.md`, `docs/modernization/remove-matrix.md`, `server-modernized/src/main/webapp/WEB-INF/web.xml`

## 1. 移行後の公開契約（正本）

- JSON を正本契約とする（XML 専用契約は新規追加しない）。
- 公開面は機能単位で `/api/v1/**` に集約する。
- 旧入口は「即時削除済み」と「移行期間で併存」を区別して管理する。

## 2. 必須ヘッダ・認証前提

| 区分 | 必須項目 |
| --- | --- |
| 認証 | `POST /api/session/login`（現行）または移行後 `/api/v1/auth/login`。セッション cookie 前提。 |
| CSRF | unsafe method（POST/PUT/PATCH/DELETE）は CSRF トークン必須。 |
| 添付系 | 画像機能は `X-Client-Feature-Images` を使用（旧 `X-Feature-Images` は廃止）。 |
| 形式 | ORCA XML 直接契約は廃止。browser は `/api/orca/chart-support/**` `/api/orca/reports/{type}` などの JSON 契約のみを利用する。 |

## 3. API マップ（患者・カルテ・添付・管理を先行定義）

| 旧入口（現行/過去） | 移行後契約（正本） | 状態 |
| --- | --- | --- |
| `/api/session/login`, `/api/session/me`, `/api/logout` | `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout` | 併存（移行対象） |
| `/api/admin/config`, `/api/admin/orca/connection`, `/api/admin/access/**`, `/api/admin/master-updates/**` | `/api/v1/admin/**` | 併存（移行対象） |
| `/karte/**` | `/api/v1/kartes/**` | 併存（移行対象） |
| `/patients/{patientId}/images`, `/karte/image/{id}`, `/karte/attachment/{id}` | `/api/v1/attachments/**` | 併存（移行対象） |
| `/pvt/**`, `/realtime/reception`, `/api/orca/queue` | `/api/v1/receptions/**`, `/api/v1/realtime/receptions`, `/api/v1/orca/queue` | 併存（移行対象） |
| `/api/orca/order/**`, `/api/orca/disease`, `/api/orca/patient/**`, `/api/orca/master/**`, `/api/orca/chart-support/**`, `/api/orca/reports/**` | `/api/v1/orca/**` 相当のモダン契約 | 併存（移行対象） |
| `/api01rv2/**`, `/api/api01rv2/**`, `/api21/**`, `/orca12/**`, `/orca21/**` | browser からは未使用。server 内部の ORCA transport 吸収専用 | 公開利用廃止 |
| `/touch/**`, `DolphinResourceASP`, `LegacyTouchAbstractResource` | 廃止（代替なし） | 削除済み（P2-04/P2-05） |
| XML 専用 resource 群（P2-06 対象） | JSON 契約へ統一 | 削除済み（P2-06） |

## 4. 廃止済み一覧（P2 完了分）

- `open/dolphin/touch/**`（Touch 入口）
- `open/dolphin/shared/legacytouch/LegacyTouchAbstractResource.java`
- XML 専用 endpoint 群（`docs/modernization/p2-06-xml-endpoint-removal.md` 参照）
- `common/src/main/java/open/dolphin/converter/**`
- `common/pom.xml` の `legacy-wildfly10` profile
- `server-modernized/src/main/java/jakarta/naming/*` 独自ブリッジ

## 5. 実装者向け注記

- 新規実装は `/api/v1/**` のみ追加し、旧命名への新規追加は禁止。
- ORCA 連携で XML が必要な場合は browser へ露出せず、server 内部の ORCA transport で吸収する。
- 旧入口の削除判断は `web-client` 参照有無と `WebXmlEndpointExposureTest` の通過を条件に行う。

## 6. P4 Resource 分割後の確認ポイント（P4-08）

| 分割対象 | 現行 Resource | 確認観点 |
| --- | --- | --- |
| カルテ write 系 | `KarteDocumentWriteResource` | `POST/PUT/DELETE /karte/document*` 契約、監査、facility境界確認 |
| 患者更新 mock 系 | `PatientModV2OutpatientMockResource` | `/api/orca/patient/mutation/mock` の mock 契約維持 |
| 管理者パスワード再設定 | `AdminAccessPasswordResetResource` | `/api/admin/access/users/{userPk}/password-reset` の認可/監査 |
| EHR-ORCA ユーザー連携 | `AdminOrcaUserLinkResource` | `/api/admin/users/{ehrUserId}/orca-link` のPUT/DELETE契約 |

- `WebXmlEndpointExposureTest` で上記分割 Resource の公開登録を常時確認する。
- 実装変更時は本節の表を更新し、契約変更があれば `docs/modernization/p4-08-api-doc-test-sync.md` に差分を追記する。
