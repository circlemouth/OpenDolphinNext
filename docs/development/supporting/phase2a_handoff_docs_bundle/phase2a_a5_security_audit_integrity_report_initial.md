# Phase2-A5 設計レポート（初版）

対象: `server-modernized`

基準:
- 承認済み D5 / D9 / D10 を再議論しない
- 後方互換性は考慮しない
- dual support を作らない
- dangerous path stopgap を戻さない
- source inspection を基準に初版設計をまとめる

確認ベース:
- `server-modernized.zip` 展開ソース
- handoff docs の A5 prompt / decision docs
- clean rebuild は未実施（bundle が generated artifact を含むため）

---

## 1. Executive Summary

A5 は「止血済み stopgap を、本番運用可能な security control plane へ置き換える」仕事である。

現状の良い点:
- ログイン時 2FA は TOTP-only に寄っている
- password reset route は public registration から外されている
- production-like 起動では FIDO2 設定、integrity 非 enforce、invalid keyring を reject する stopgap が入っている
- audit details の allowlist / sanitizer は入っている

ただし、本番設計としては次が未完成である。

1. step-up MFA が password reset の局所実装に留まり、admin mutation 全体へ一般化されていない
2. truthful session revoke が存在せず、password reset は「対象ユーザー全 session revoke」を満たしていない
3. trusted proxy 判定が `AbstractResource` と `RequestSecuritySupport` に分裂している
4. login / logout / factor2 の成功監査が不足している
5. audit chain が `event_time desc limit 1` ベースで、並行書き込み時に線形性を保証できない
6. audit 永続化と JMS publish が非原子的で、配信不達が warning 止まり
7. document integrity の型/validator surface がまだ `off/permissive/enforce` を許しており、prod-like 固定方針が validator contract に反映し切れていない
8. FIDO2 / backup code の残骸が config/runtime surface に残っている

A5 の target は以下で固定する。

- 今リリースの 2FA は **TOTP-only**
- すべての admin mutation は **session-bound step-up proof** 必須
- password reset / factor2 disable / admin privilege change は **対象ユーザー全 active session revoke** 必須
- trusted proxy / forwarded resolution は **単一 policy service** に集約
- document integrity は **production-like で enforce 固定**
- audit は **線形 chain + minimal payload + replay/verify 可能**
- break-glass は **通常運用から分離**

---

## 2. Target Design

### 2.1 Auth / TOTP-only

#### Target
- 認証要素は `password + TOTP` のみを正規経路とする
- `factor2Auth` は `off | totp` のみ
- verified credential は `verified=true` の TOTP credential 1 件以上で判定する
- backup code / challenge / WebAuthn / FIDO2 は今リリースの auth surface から削除する

#### Runtime contract
- password login は `LOGIN_PASSWORD_OK / LOGIN_PASSWORD_BLOCKED / LOGIN_PASSWORD_FAIL / LOGIN_FACTOR2_REQUIRED` を監査する
- factor2 verify は `LOGIN_FACTOR2_OK / LOGIN_FACTOR2_FAIL / LOGIN_FACTOR2_EXPIRED` を監査する
- verified credential が無い actor は factor2 phase へ進めない

#### Delete First
- `BackupCodeGenerator`
- `ServerRuntimeConfiguration.Fido2Settings`
- `ServerConfigurationResolver#fido2()`
- 未使用の `validateFido2(...)`
- FIDO2/backup/challenge 用 config surface

### 2.2 Step-up MFA

#### Target
- admin mutation payload に `totpCode` を直接混ぜない
- 代わりに **session-bound step-up proof** を導入する
- proof は current authenticated session に紐づき、TTL を持ち、scope を持つ

#### New flow
1. `POST /api/session/step-up`
   - body: `{"method":"totp","code":"123456","scope":"admin:mutation"}`
   - 成功時は server-side session registry に `stepUpVerifiedAt`, `stepUpExpiresAt`, `stepUpScope` を保存
2. すべての admin write endpoint は `AdminStepUpGuard.require("admin:mutation")` を通す
3. TTL 超過、scope 不一致、session revoke 後は失効

#### Scope definition
- `admin:mutation`: `/api/admin/**` の POST / PUT / DELETE / PATCH 全般
- 最低対象:
  - user create / update / password reset
  - ORCA user create / update / delete / sync
  - ORCA user link put / delete
  - ORCA connection update / default-facility update / connection test
  - master update run / rollback / upload / schedule update
  - config update

#### Why payload-embedded TOTP is NG
- endpoint ごとに `totpCode` をばら撒く設計になる
- CSRF / replay / audit contract が endpoint ごとに揺れる
- step-up freshness を session 全体で統一できない

### 2.3 Truthful session revoke

#### Target
- password reset / factor2 credential revoke / admin disable / privilege downgrade で **対象ユーザー全 active session** を無効化する
- 現行 request の `session.invalidate()` のみでは不可

#### Proposed model
導入する表:

1. `user_security_state`
   - `user_pk`
   - `credential_epoch`
   - `session_epoch`
   - `password_changed_at`
   - `factor2_required`
   - `updated_at`

2. `auth_session_registry`
   - `session_id`
   - `user_pk`
   - `actor_id`
   - `facility_id`
   - `client_uuid`
   - `factor_level` (`password-only`, `password+totp`, `step-up`)
   - `issued_at`
   - `last_seen_at`
   - `revoked_at`
   - `revocation_reason`
   - `credential_epoch_at_issue`
   - `session_epoch_at_issue`
   - `step_up_scope`
   - `step_up_verified_at`
   - `step_up_expires_at`

#### Enforcement
- request filter は current session の registry row を読む
- `revoked_at != null` なら 401
- `registry.session_epoch_at_issue < user_security_state.session_epoch` なら 401
- password reset は target user の `session_epoch` を increment し、registry rows を bulk revoke

#### Re-exposure rule
- `AdminAccessPasswordResetResource` は上記が入るまで再公開しない

### 2.4 Trusted proxy / forwarded header policy

#### Target
- client IP, effective scheme/host/port, origin 判定を 1 つの component に統合する
- component 名は仮に `TrustedProxyPolicy` / `TrustedRequestContextResolver`
- `AbstractResource` と `RequestSecuritySupport` で二重に header 解釈しない

#### Rules
- untrusted source から来た `Forwarded`, `X-Forwarded-*`, `X-Real-IP` は無視
- trusted proxy chain から来た場合のみ canonical request context を作る
- `Forwarded` を第一優先、なければ `X-Forwarded-*` を使う
- malformed forwarded chain は fail-close で `remoteAddr` のみ採用
- login throttle, audit IP, CSRF same-origin, HSTS attach 判定は同じ resolver を使う

#### Startup contract
- `audit.trusted.proxies` は blank-only validation では足りない
- CIDR / exact IP の文法を validator で検証する
- production-like で proxy 配下運用する場合は trusted proxy 定義必須
- ingress 側では untrusted forwarded headers を strip する

### 2.5 Document integrity

#### Target
- production-like artifact の運用契約は `enforce` のみ
- keyring は external file / secret mount で運ぶ
- active key ちょうど 1 件、旧 key は verify-only で保持
- missing / invalid keyring は startup fail
- report signing / TSA は fail-open を禁止し、明文化された policy を持つ

#### Runtime
- write path は seal 必須
- read path は verify 必須
- mismatch / missing seal は 409 で止める
- break-glass 例外は通常運用 route とは別経路・別権限・別監査に分離

#### Rotation
- rotation 手順:
  1. 新 key を `active`
  2. 旧 key を `verify-only`
  3. 運用 window 終了後に verify-only を削除
- 既存文書の reseal policy は A4/B2 で別管理

### 2.6 Audit chain / minimal payload / delivery

#### Target
監査を以下の 3 層に分ける。

1. **authoritative audit log**
   - DB に永続化する一次証跡
   - 線形 chain を保証する
2. **export/outbox**
   - JMS / SIEM / reporting への配送責務
   - authoritative log と分離
3. **verification tool**
   - chain replay と hash verify を行う offline tool

#### New schema proposal
1. `audit_event`
   - `event_id` (monotonic)
   - `event_time`
   - `action`
   - `resource`
   - `actor_id`
   - `actor_role`
   - `facility_id`
   - `subject_type`
   - `subject_id`
   - `outcome`
   - `http_status`
   - `trace_id`
   - `request_id`
   - `ip_address`
   - `user_agent_hash`
   - `payload_json`
   - `payload_hash`
   - `previous_event_id`
   - `previous_hash`
   - `event_hash`

2. `audit_chain_head`
   - singleton row
   - `head_event_id`
   - `head_hash`
   - insert transaction で `SELECT ... FOR UPDATE`

3. `audit_export_outbox`
   - `event_id`
   - `destination`
   - `delivery_state`
   - `last_attempt_at`
   - `attempt_count`

#### Hash material
- event hash は canonicalized record から生成する
- `event_time`, `previous_hash`, `payload_hash`, `action`, `resource`, `subject_id`, `trace_id`, `request_id`, `actor_id`, `outcome` を固定順で含める
- JSON text の順序揺れに依存しない canonical serializer を使う

#### Payload minimum policy
JSON payload は「補助説明」であって正本ではない。

保持してよいもの:
- outcome, reason, errorCode, httpStatus
- facilityId, operation, scope, resource-local identifiers
- resultCount, rowCount, cacheHit などのメタ情報

保持してはいけないもの:
- free text clinical note
- query string / keyword / raw body
- cookies / auth headers / tokens / secrets
- patient name 等の可読 PHI

patient 参照が必要な場合は first-class subject field を使い、payload 内へ再重複させない。

### 2.7 Break-glass

#### Target
- 通常 admin session では break-glass できない
- break-glass は別アカウント、別 MPA、別監査 action、別 runbook
- document integrity / report signing の bypass とは結びつけない

---

## 3. Current → Target の差分

### 3.1 認証 / step-up / revoke

Current:
- `SessionAuthResource` は login / factor2 / me を持つが、成功監査を書いていない
- `LogoutResource` も成功監査を書いていない
- `AdminAccessMutationSupport.resetPassword(...)` は payload 内 `totpCode` を直接受け、`invalidateCurrentSession(...)` で current request session しか落としていない
- password reset route 自体は unregistered だが、truthful revoke 実装は未着手

Evidence:
- `src/main/java/open/dolphin/rest/SessionAuthResource.java:46-167`
- `src/main/java/open/dolphin/rest/LogoutResource.java:19-38`
- `src/main/java/open/dolphin/rest/AdminAccessMutationSupport.java:96-154`
- `src/main/java/open/dolphin/rest/AdminAccessMutationSupport.java:548-562`
- `src/main/java/open/dolphin/rest/AdminAccessPasswordResetResource.java:15-30`

Target:
- login / factor2 / logout / session revoke を全て success/failure 監査する
- step-up は dedicated endpoint + session-bound proof へ置換する
- password reset / privilege mutation は target user 全 session revoke を必須化する

変える理由:
- D9 / PB-10 の解除条件を満たしていないため

### 3.2 Admin mutation 保護

Current:
- 複数の admin mutation route は `requireAdminActor(...)` のみで、step-up guard が無い

Evidence:
- `src/main/java/open/dolphin/rest/AdminConfigResource.java`
- `src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`
- `src/main/java/open/dolphin/rest/AdminMasterUpdateResource.java`
- `src/main/java/open/dolphin/rest/AdminOrcaUserResource.java`
- `src/main/java/open/dolphin/rest/AdminOrcaUserLinkResource.java`

Target:
- `/api/admin/**` の mutation を `AdminStepUpGuard` で一律保護する
- endpoint ごとの ad-hoc `totpCode` を禁止する

変える理由:
- 管理変更は step-up MFA 必須という D9 を API surface に反映するため

### 3.3 Trusted proxy

Current:
- client IP 解決は `AbstractResource`
- origin / HSTS は `RequestSecuritySupport`
- どちらも trusted proxy を前提に forwarded headers を読む
- validation は `audit.trusted.proxies` の blank チェックしかない

Evidence:
- `src/main/java/open/dolphin/rest/AbstractResource.java:199-287`
- `src/main/java/open/dolphin/rest/RequestSecuritySupport.java:17-101`
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java:349-358`

Target:
- 1つの `TrustedRequestContextResolver` で IP / scheme / host / origin を解決
- proxy rule の文法を validator でチェック
- ingress strip policy を運用前提に固定

変える理由:
- security-sensitive な request context が二重実装のままだと境界条件でずれるため

### 3.4 Audit

Current:
- `AuditTrailService` は前イベント hash を `event_time desc limit 1` で取得している
- `SessionAuditDispatcher` は DB write 後に best-effort で JMS publish している
- login/logout/factor2 成功監査は未実装

Evidence:
- `src/main/java/open/dolphin/security/audit/AuditTrailService.java:31-32`
- `src/main/java/open/dolphin/security/audit/AuditTrailService.java:46-81`
- `src/main/java/open/dolphin/security/audit/SessionAuditDispatcher.java:45-52`
- `src/main/java/open/dolphin/security/audit/SessionAuditDispatcher.java:75-92`

Target:
- chain head lock による線形化
- authoritative log と export/outbox の分離
- auth lifecycle の成功/失敗監査を追加

変える理由:
- D10 / PB-11 の解除条件を満たしていないため

### 3.5 Document integrity

Current:
- `DocumentIntegrityConfig` と validator は `off/permissive/enforce` を受け付ける
- env sample も multi-mode surface のまま
- prod-like enforce は `ServletStartup` guard に依存している

Evidence:
- `src/main/java/open/dolphin/security/integrity/DocumentIntegrityConfig.java:39-64`
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java:457-468`
- `config/server-modernized.env.sample:202-207`

Target:
- production-like validator contract で enforce 固定
- invalid keyring / missing keyring は validator 段階で即 fail
- test/dev を除き `permissive` を運用 surface から外す

変える理由:
- stopgap ではなく runtime contract に D10 を落とすため

### 3.6 FIDO2 / backup 残骸

Current:
- FIDO2 key constants と typed resolver がまだ存在する
- `validateFido2(...)` は残っているが `validateOrThrow()` から呼ばれていない
- `BackupCodeGenerator` は source に残るが参照が無い
- `InitialAccountMaker` は source には無いが stale class が bundle に残る

Evidence:
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java:157-159`
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java:437-447`
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java:27-48`
- `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java:492-510`
- `src/main/java/open/dolphin/security/totp/BackupCodeGenerator.java:1-23`
- bundle stale artifact: `target/classes/open/dolphin/mbean/InitialAccountMaker.class`

Target:
- 今リリースの正規 route に不要な surface を削除
- 「FIDO2 を reject する guard」だけを最小形で残す

変える理由:
- D9 の TOTP-only を runtime surface まで徹底するため

---

## 4. Delete First / Rename First 一覧

### Delete First
1. `src/main/java/open/dolphin/security/totp/BackupCodeGenerator.java`
2. `ServerRuntimeConfiguration.Fido2Settings`
3. `ServerConfigurationResolver#fido2()`
4. `ServerConfigurationValidator#validateFido2(...)` と関連 test
5. payload-embedded `totpCode` という endpoint ごとの step-up 実装
6. `AuditTrailService` の `event_time desc limit 1` chain head 解決
7. authoritative audit と JMS publish の直結
8. bundle 内 stale `InitialAccountMaker.class`

### Rename / Replace First
1. `document.integrity.mode` の runtime contract
   - 現状: `off/permissive/enforce`
   - target: prod-like artifact は `enforce` 固定、dev/test だけ test profile で緩める
2. `audit.trusted.proxies`
   - 現状: audit 名前空間だが auth/csrf/origin でも使われている
   - target: `security.trusted-proxies` へ集約を推奨

---

## 5. 実装前提 / 契約 / データ境界

### API 契約
- `POST /api/session/login`
- `POST /api/session/login/factor2`
- `POST /api/session/step-up` ← 新設
- `POST /api/logout`
- `/api/admin/**` mutation は step-up 前提

### データ正本
- factor2 credential 正本: `Factor2Credential`（TOTP only）
- session 正本: `auth_session_registry`
- revoke 正本: `user_security_state.session_epoch`
- audit 正本: `audit_event` + `audit_chain_head`
- export 正本: `audit_export_outbox`
- integrity key 正本: external keyring file / secret mount

### facility / scope
- session, step-up, revoke, audit は actor facility を first-class で保持する
- admin mutation の scope は少なくとも `admin:mutation`
- 今後 A2/A3 と合わせて finer scope (`admin:orca-connection`, `admin:master-update`) を切ってよい

### error / auth / audit
- step-up 不足: 412 or 403 を統一する。初版推奨は `412 Precondition Failed`
- revoked session: 401
- untrusted forwarded header: request は継続するが forwarded は無視
- integrity mismatch: 409
- 監査 action は success/failure を必ず paired で定義する

---

## 6. Acceptance Criteria

### AC-1
すべての `/api/admin/**` mutation は valid step-up proof を要求し、未取得・期限切れ・scope 不一致では失敗する。

### AC-2
password reset / factor2 revoke / admin privilege downgrade は対象ユーザーの全 active session を revoke し、既存 session は次 request で 401 になる。

### AC-3
`login`, `logout`, `login/factor2`, `session revoke`, `admin mutation` は success/failure を監査する。

### AC-4
client IP / origin / secure-scheme 判定は単一 resolver を通り、trusted proxy 設定の不備は validator で検知される。

### AC-5
production-like では `document.integrity.mode != enforce`、keyring missing/invalid、factor2 key missing で起動失敗する。

### AC-6
audit chain は並行書き込み下でも fork せず、offline replay で `event_hash` を再計算して検証できる。

### AC-7
audit payload から clinical free text / raw query / tokens / secrets が排除される。

---

## 7. Open Blockers

### Blocker 1
reverse proxy / ingress が untrusted `Forwarded` / `X-Forwarded-*` を strip しているか未確認。

依存:
- infra 実装確認
- WAF / ingress / LB 設定メモ

### Blocker 2
break-glass の業務運用主体と承認フローが未確定。

依存:
- security owner
- 運用責任者

### Blocker 3
report signing / TSA failure policy が未確定。

依存:
- reporting owner
- compliance

### Blocker 4
cluster / sticky session / distributed cache の前提が不明で、session revoke 実装方式の sizing が未確定。

依存:
- deploy topology
- session affinity 方針

### Blocker 5
既存文書に対する integrity reseal / drift 実測が未了。

依存:
- A4/B2
- data sampling

---

## 8. Phase2-B へ渡すべき前提

### SRE
- keyring mount / rotate runbook
- trusted proxy / ingress strip policy
- audit outbox 配送監視
- session registry purge / retention policy

### QA
- step-up TTL / scope mismatch / replay / revoke 後 request の E2E
- login/logout/factor2 audit event assertion
- trusted proxy spoofing negative test
- integrity missing/mismatch negative test

### Performance
- audit head lock contention test
- session registry lookup overhead
- bulk revoke latency

### Refactoring
- `AbstractResource` と `RequestSecuritySupport` の統合
- `SessionAuthResource` と admin resources の audit/guard 共通化

### Reporting
- authoritative audit から SIEM/export への downstream contract
- report signing / TSA 障害時の運用手順

---

## 9. 正規化 Issue 一覧

### Issue 1
- Title: Admin mutation に step-up MFA guard が無い
- Area: auth / admin
- Severity: Critical
- Type: design gap
- Evidence: `AdminConfigResource`, `AdminOrcaConnectionResource`, `AdminMasterUpdateResource`, `AdminOrcaUserResource`, `AdminOrcaUserLinkResource` は mutation route を持つが `verifyAdminTotp` 相当を通していない
- Impact: admin session 盗難時に高リスク操作が 1 要素で成立する
- Recommended Action: `POST /api/session/step-up` + `AdminStepUpGuard` を導入し `/api/admin/**` mutation に一律適用
- Dependency: D9, A2, A4
- Effort: M
- Production Blocker: Yes

### Issue 2
- Title: Password reset が truthful session revoke を満たしていない
- Area: auth / session
- Severity: Critical
- Type: implementation gap
- Evidence: `AdminAccessMutationSupport.java:128`, `:548-562`
- Impact: target user の既存 session が生き残る
- Recommended Action: `user_security_state` + `auth_session_registry` を導入し全 active session revoke を実装
- Dependency: D9, A4
- Effort: L
- Production Blocker: Yes

### Issue 3
- Title: login / logout / factor2 success audit が欠けている
- Area: audit
- Severity: High
- Type: observability gap
- Evidence: `SessionAuthResource.java:46-167`, `LogoutResource.java:19-38`
- Impact: auth lifecycle の追跡と incident replay ができない
- Recommended Action: auth lifecycle action set を追加し success/failure を必ず記録
- Dependency: D9, D10
- Effort: M
- Production Blocker: Yes

### Issue 4
- Title: Trusted proxy 解決が二重実装
- Area: edge security
- Severity: High
- Type: design flaw
- Evidence: `AbstractResource.java:199-287`, `RequestSecuritySupport.java:17-101`
- Impact: client IP / origin / HSTS 判定が条件によってずれる
- Recommended Action: `TrustedRequestContextResolver` へ統合
- Dependency: D9
- Effort: M
- Production Blocker: Yes

### Issue 5
- Title: audit chain が concurrency-safe ではない
- Area: audit
- Severity: Critical
- Type: correctness bug
- Evidence: `AuditTrailService.java:31-32`, `:46-81`
- Impact: 並行 insert で chain fork の可能性がある
- Recommended Action: `audit_chain_head` row lock 方式へ置換
- Dependency: D10, A4
- Effort: M
- Production Blocker: Yes

### Issue 6
- Title: authoritative audit と JMS publish が非原子的
- Area: audit delivery
- Severity: High
- Type: reliability gap
- Evidence: `SessionAuditDispatcher.java:45-52`, `:75-92`
- Impact: DB にはあるが export 不達、または downstream 再送不能
- Recommended Action: `audit_export_outbox` を導入し非同期配送へ分離
- Dependency: D10, A4, B2
- Effort: M
- Production Blocker: Yes

### Issue 7
- Title: document integrity validator が permissive/off を運用 surface に残している
- Area: integrity
- Severity: High
- Type: contract drift
- Evidence: `DocumentIntegrityConfig.java:39-64`, `ServerConfigurationValidator.java:457-468`, `config/server-modernized.env.sample:202-207`
- Impact: D10 が startup guard にだけ依存し、runtime contract が緩い
- Recommended Action: production-like validator contract を enforce 固定へ寄せる
- Dependency: D10
- Effort: S
- Production Blocker: Yes

### Issue 8
- Title: FIDO2 / backup code 残骸が runtime/config surface に残る
- Area: auth surface
- Severity: Medium
- Type: cleanup
- Evidence: `ServerConfigurationResolver.java:157-159`, `:437-447`, `ServerConfigurationValidator.java:492-510`, `BackupCodeGenerator.java:1-23`
- Impact: TOTP-only 方針に対し surface が過剰で誤運用余地が残る
- Recommended Action: reject-only guard を残して typed support を削除
- Dependency: D9
- Effort: S
- Production Blocker: No

### Issue 9
- Title: `audit.trusted.proxies` validator が blank しか見ていない
- Area: config validation
- Severity: Medium
- Type: validation gap
- Evidence: `ServerConfigurationValidator.java:349-358`
- Impact: typo/CIDR 不正が起動時に検知されない
- Recommended Action: exact IP / CIDR parser を validator に追加
- Dependency: D9
- Effort: S
- Production Blocker: Yes

### Issue 10
- Title: stale generated artifact が security cleanup の完了判定を曇らせる
- Area: bundle hygiene
- Severity: Medium
- Type: packaging defect
- Evidence: `target/classes/open/dolphin/mbean/InitialAccountMaker.class` など stale artifact 残存
- Impact: 削除済み surface の誤判定と再現性低下
- Recommended Action: clean source-only bundle を authoritative input にする
- Dependency: intake cleanup
- Effort: S
- Production Blocker: Yes

---

## 10. 直近の実装スライス提案

### Slice A5-S1
trusted proxy 統合
- `TrustedRequestContextResolver`
- `TrustedProxyPolicy`
- validator に CIDR/exact IP 検証追加
- `AbstractResource` / `RequestSecuritySupport` の依存差し替え

### Slice A5-S2
step-up guard 導入
- `POST /api/session/step-up`
- `AdminStepUpGuard`
- `/api/admin/**` mutation へ適用
- payload-embedded `totpCode` 廃止

### Slice A5-S3
truthful revoke 導入
- `user_security_state`
- `auth_session_registry`
- request filter revoke check
- password reset / factor2 revoke で bulk revoke

### Slice A5-S4
audit authoritative/outbox 再設計
- `audit_event`
- `audit_chain_head`
- `audit_export_outbox`
- login/logout/factor2/session revoke/admin mutation action 追加

### Slice A5-S5
integrity contract hardening
- validator を prod-like enforce 固定へ寄せる
- keyring rotation runbook を docs 化
- report signing / TSA policy を blocker として分離明文化

---

## 11. A5 初版判断

着手判断としては以下。

- A5 は **開始してよい**
- 最初の coding slice は **S1 trusted proxy 統合** と **S2 step-up guard** が適切
- `AdminAccessPasswordResetResource` の再公開は **S3 truthful revoke 完了後のみ**
- A4 には session/audit schema を即連携する

