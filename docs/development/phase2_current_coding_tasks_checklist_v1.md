# Phase2 現時点コーディングタスク 開発チェックリスト v1

作成日: 2026-03-24  
更新日: 2026-03-24  
RUN_ID: 20260324T111046Z  
対象: `server-modernized`  
想定読者: A3 / A4 / A5 実装担当、レビュー担当、QA  
位置付け: `server-modernized` の現行開発計画正本  
目的: 現時点で着手可能なコーディングタスクと、着手条件付きの後続コーディングタスクを、担当者が追加設計なしで実装できる粒度まで具体化する。

---

## 0. この文書の使い方

- 各タスクは **そのまま PR 単位**として切る。
- 1 PR に複数タスクを混ぜない。
- **Ready Now** のタスクだけ先に着手する。
- **Blocked / Hold** は条件が満たされるまでコードを書かない。
- すべての PR は `target/` など生成物を含めない。
- すべての PR は **JDK 25 既定**で通す。Mockito の attach 問題が出る場合のみ fallback として JDK 21 + byte-buddy-agent を使う。
- 後方互換は考慮しない。alias / dual support / 旧 key 併存を作らない。
- 補助資料は `docs/development/supporting/phase2a_handoff_docs_bundle/` 配下を参照する。補助資料は設計補足であり、この文書の代替正本ではない。

---

## 1. 固定ルール

### 1.1 絶対ルール
- [x] dangerous path stopgap を戻さない
- [x] dual support を作らない
- [x] route / config key / class 名の互換 alias を作らない
- [x] ORCA runtime path に implicit/default/session/MDC facility を戻さない
- [x] ORCA live と local projection を同じ DTO / service / route で混在させない
- [x] `password reset` の public 再公開をしない
- [x] bare `diagnosisId` の public mutation を再公開しない
- [x] hidden consumer inventory 完了前に public route rename/delete をしない
- [x] generated artifact をコミットしない
- [x] 新しい durable runtime state を `runtime_state_store` に押し込まない。専用 table を作る

### 1.2 この文書で固定する naming
- [x] `OrcaWrapperService` は **`OrcaLiveGateway`** に rename する
- [x] trusted proxy 設定 key は **`security.trusted-proxies`**、env は **`SECURITY_TRUSTED_PROXIES`** に統一する
- [x] admin step-up scope は **`admin:mutation`** の 1 つだけに固定する
- [x] schedule key は **`facilityId + ":" + orcaAppointmentId`**
- [x] encounter key は **`facilityId + ":" + orcaAcceptanceId`**
- [x] business state は **`scheduled / checked_in / chart_opened / billed / cancelled`** のみ
- [x] auth factor mode は **`off | totp`** のみ。今リリースの正規経路は TOTP-only
- [x] document integrity の production-like 運用は **`enforce`** 固定

### 1.3 実装順
1. CT-01 Trusted proxy 統合  
2. CT-02 Batch-1 security/audit schema  
3. CT-03 Step-up + session registry + admin guard  
4. CT-04 Truthful session revoke  
5. CT-05 Authoritative audit chain + outbox  
6. CT-06 Integrity contract hardening + FIDO/backup cleanup  
7. CT-07 ORCA internal boundary split  
8. CT-08 Batch-2 domain/runtime schema  
9. CT-09 Sync truthful model  
10. CT-10 Push truthful model  
11. CT-11 Facility-native ORCA user link  
12. CT-H 系（条件解放後）

---

## 2. Ready Now タスク

## CT-01 Trusted proxy / forwarded resolver 統合

**状態**: Ready Now  
**目的**: `AbstractResource` と `RequestSecuritySupport` に分裂している trusted proxy 判定を 1 実装へ統合する。  
**依存**: なし  
**PR 名**: `A5-01 trusted-request-context-resolver`  

### 2.1 変更対象ファイル

#### 追加
- [x] `src/main/java/open/dolphin/security/auth/TrustedProxyPolicy.java`
- [x] `src/main/java/open/dolphin/security/auth/TrustedRequestContextResolver.java`
- [x] `src/test/java/open/dolphin/security/auth/TrustedProxyPolicyTest.java`
- [x] `src/test/java/open/dolphin/security/auth/TrustedRequestContextResolverTest.java`

#### 変更
- [x] `src/main/java/open/dolphin/rest/AbstractResource.java`
- [x] `src/main/java/open/dolphin/rest/RequestSecuritySupport.java`
- [x] `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- [x] `src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
- [x] `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- [x] `config/server-modernized.env.sample`
- [x] `src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
- [x] `src/test/java/open/dolphin/runtime/config/ServerConfigurationValidatorTest.java`

### 2.2 仕様

#### config contract
- [x] 旧 trusted-proxy env key は削除する
- [x] 新しい env 名は `SECURITY_TRUSTED_PROXIES`
- [x] 対応 property key は `security.trusted-proxies`
- [x] 値は **comma-separated** の exact IP または CIDR
- [x] 許可例:
  - `127.0.0.1`
  - `10.0.0.0/24`
  - `2001:db8::1`
  - `2001:db8::/64`
- [x] 不許可例:
  - 空 token（`,,`）
  - ホスト名
  - `*`
  - `10.0.0.0/33`
  - CIDR でない任意文字列

#### resolver contract
`TrustedRequestContextResolver` は次の record を返す。

```java
public record TrustedRequestContext(
        String remoteAddr,
        String clientIp,
        String scheme,
        String host,
        int port,
        boolean secure,
        boolean trustedProxy,
        boolean forwardedUsed) {
}
```

#### client IP 解決ルール
- [x] まず `request.getRemoteAddr()` を `remoteAddr` として取得する
- [x] `remoteAddr` が trusted proxy に含まれない場合、`Forwarded` / `X-Forwarded-*` / `X-Real-IP` は**すべて無視**する
- [x] `remoteAddr` が trusted proxy の場合のみ forwarded 解釈に進む
- [x] `Forwarded` を第一優先、無ければ `X-Forwarded-For` を使う
- [x] chain は **右から左**へ走査し、trusted proxy を剥がして最初の non-trusted hop を `clientIp` にする
- [x] chain が全部 trusted の場合は一番左を `clientIp` とする
- [x] malformed chain / malformed token / parse 失敗時は **forwarded 全体を無視**し、`clientIp = remoteAddr` にする
- [x] `X-Real-IP` は trusted proxy 配下で、かつ `Forwarded` と `X-Forwarded-For` が無いときだけ補助的に使う
- [x] untrusted source からの `Forwarded` / `X-Forwarded-*` / `X-Real-IP` は **ログに残してもよいが採用しない**

#### scheme / host / port 解決ルール
- [x] trusted proxy 配下で `Forwarded` が正しく parse できる場合、`proto` / `host` を採用する
- [x] `Forwarded` が無い場合のみ `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-Port` を使う
- [x] `host` に port が含まれる場合は host/port に分解する
- [x] parse 失敗時は request の scheme/serverName/serverPort に戻す
- [x] `secure = scheme.equalsIgnoreCase("https")`

### 2.3 実装チェックリスト

#### TrustedProxyPolicy
- [x] IP/CIDR parser を実装する
- [x] 追加ライブラリは入れない。JDK 標準だけで実装する
- [x] exact IP と CIDR を同じ matcher interface に正規化する
- [x] IPv4/IPv6 両方を通す
- [x] `isTrusted(String ip)` は invalid input に対して `false` を返す

#### ServerConfigurationResolver / Validator
- [x] `security.trusted-proxies` を resolver に追加する
- [x] `audit.trusted.proxies` と FIDO 由来 key 参照を削除する
- [x] validator で token を全件 parse し、invalid token が 1 つでもあれば起動失敗にする
- [x] blank は `loopback-only` 扱いにする
- [x] env sample の説明文を `SECURITY_TRUSTED_PROXIES` へ書き換える

#### AbstractResource / RequestSecuritySupport
- [x] `AbstractResource.resolveClientIp()` は resolver 呼び出しに置き換える
- [x] `RequestSecuritySupport` の `Forwarded` parse 実装は削除する
- [x] `RequestSecuritySupport` は resolver が返した `scheme/host/port/secure` を使うだけに縮退する
- [x] trusted proxy 判定ロジックを rest package から削除する

### 2.4 受け入れ条件
- [x] `AbstractResource` と `RequestSecuritySupport` に trusted proxy 判定コードが残っていない
- [x] untrusted remote から付与した `Forwarded` を無視する
- [x] trusted remote からの正しい `Forwarded` を採用する
- [x] malformed header で fail-close する
- [x] validator が invalid CIDR を reject する

### 2.5 テスト
- [x] `TrustedProxyPolicyTest`
  - [x] IPv4 exact
  - [x] IPv4 CIDR
  - [x] IPv6 exact
  - [x] IPv6 CIDR
  - [x] invalid token
- [x] `TrustedRequestContextResolverTest`
  - [x] untrusted remote + spoofed forwarded
  - [x] trusted remote + valid Forwarded
  - [x] trusted remote + valid X-Forwarded-*
  - [x] malformed Forwarded
  - [x] forwarded chain で right-to-left 解決
- [x] `ServerConfigurationValidatorTest`
  - [x] invalid CIDR reject
  - [x] blank accepted as loopback-only

### 2.6 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=TrustedProxyPolicyTest,TrustedRequestContextResolverTest,ServerConfigurationResolverTest,ServerConfigurationValidatorTest test
```

---

## CT-02 Batch-1 security / session / audit schema と persistence 骨格

**状態**: Ready Now  
**目的**: A5 の step-up / revoke / audit chain / outbox を受ける durable schema を先に作る。  
**依存**: なし  
**PR 名**: `A4-01 security-audit-schema-batch1`

### 3.1 変更対象ファイル

#### 追加
- [x] `tools/flyway/sql/V0306__security_session_audit_tables.sql`
- [x] `src/main/java/open/dolphin/security/auth/UserSecurityStateRepository.java`
- [x] `src/main/java/open/dolphin/security/auth/AuthSessionRegistryRepository.java`
- [x] `src/main/java/open/dolphin/security/audit/AuthoritativeAuditRepository.java`
- [x] `src/main/java/open/dolphin/security/audit/AuditOutboxRepository.java`
- [x] `src/test/java/open/dolphin/security/auth/UserSecurityStateRepositoryTest.java`
- [x] `src/test/java/open/dolphin/security/auth/AuthSessionRegistryRepositoryTest.java`
- [x] `src/test/java/open/dolphin/security/audit/AuthoritativeAuditRepositoryTest.java`
- [x] `src/test/java/open/dolphin/security/audit/AuditOutboxRepositoryTest.java`

#### 変更
- [x] `src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`

### 3.2 実装方針
- [x] JPA entity は追加しない
- [x] repository は `EntityManager#createNativeQuery` または JDBC template 相当で実装する
- [x] `runtime_state_store` は使わない
- [x] 監査 chain head は **single row lock** で実装する

### 3.3 DDL（このまま実装する）

```sql
SET search_path TO opendolphin, public;

CREATE TABLE IF NOT EXISTS user_security_state (
    user_pk BIGINT PRIMARY KEY,
    credential_epoch BIGINT NOT NULL DEFAULT 0,
    session_epoch BIGINT NOT NULL DEFAULT 0,
    password_changed_at TIMESTAMPTZ,
    factor2_required BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_session_registry (
    session_id VARCHAR(128) PRIMARY KEY,
    user_pk BIGINT NOT NULL,
    actor_id VARCHAR(128) NOT NULL,
    facility_id VARCHAR(64),
    client_uuid VARCHAR(128),
    factor_level VARCHAR(32) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason VARCHAR(64),
    credential_epoch_at_issue BIGINT NOT NULL,
    session_epoch_at_issue BIGINT NOT NULL,
    step_up_scope VARCHAR(128),
    step_up_verified_at TIMESTAMPTZ,
    step_up_expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_session_registry_user_active
    ON auth_session_registry (user_pk, revoked_at, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_session_registry_session_active
    ON auth_session_registry (session_id, revoked_at);

CREATE TABLE IF NOT EXISTS audit_event (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_time TIMESTAMPTZ NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(256) NOT NULL,
    actor_id VARCHAR(128),
    actor_role VARCHAR(64),
    facility_id VARCHAR(64),
    subject_type VARCHAR(64),
    subject_id VARCHAR(128),
    outcome VARCHAR(16) NOT NULL,
    http_status INTEGER,
    trace_id VARCHAR(128),
    request_id VARCHAR(128),
    ip_address VARCHAR(64),
    user_agent_hash VARCHAR(128),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload_hash VARCHAR(64) NOT NULL,
    previous_event_id BIGINT,
    previous_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_event_time_desc
    ON audit_event (event_time DESC, event_id DESC);

CREATE INDEX IF NOT EXISTS idx_authoritative_audit_event_trace_id
    ON audit_event (trace_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_subject
    ON audit_event (subject_type, subject_id, event_time DESC);

CREATE TABLE IF NOT EXISTS audit_chain_head (
    singleton_key SMALLINT PRIMARY KEY CHECK (singleton_key = 1),
    head_event_id BIGINT,
    head_hash VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO audit_chain_head (singleton_key, head_event_id, head_hash)
VALUES (1, NULL, NULL)
ON CONFLICT (singleton_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_export_outbox (
    event_id BIGINT NOT NULL REFERENCES audit_event(event_id) ON DELETE CASCADE,
    destination VARCHAR(64) NOT NULL,
    delivery_state VARCHAR(16) NOT NULL,
    last_attempt_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    PRIMARY KEY (event_id, destination)
);

CREATE INDEX IF NOT EXISTS idx_audit_export_outbox_delivery
    ON audit_export_outbox (delivery_state, last_attempt_at, attempt_count);
```

### 3.4 repository 必須メソッド

#### UserSecurityStateRepository
- [x] `ensureRow(long userPk)`
- [x] `long currentSessionEpoch(long userPk)`
- [x] `long currentCredentialEpoch(long userPk)`
- [x] `void incrementSessionEpoch(long userPk, Instant updatedAt)`
- [x] `void incrementCredentialEpoch(long userPk, Instant updatedAt)`
- [x] `void markPasswordChanged(long userPk, Instant changedAt)`

#### AuthSessionRegistryRepository
- [x] `void upsertAuthenticatedSession(...)`
- [x] `Optional<SessionRow> findBySessionId(String sessionId)`
- [x] `void touchLastSeen(String sessionId, Instant seenAt)`
- [x] `void saveStepUp(String sessionId, String scope, Instant verifiedAt, Instant expiresAt)`
- [x] `void revokeSession(String sessionId, String reason, Instant revokedAt)`
- [x] `int revokeAllActiveSessions(long userPk, String reason, Instant revokedAt)`
- [x] `void purgeRevokedOlderThan(Instant cutoff)`

#### AuthoritativeAuditRepository
- [x] `AuditWriteResult append(AuditWriteCommand command)`
- [x] `append` 内で `audit_chain_head` を `SELECT ... FOR UPDATE` する
- [x] `event_hash` は SHA-256 hex で保存する
- [x] `payload_hash` は sanitized payload JSON の SHA-256 hex で保存する

#### AuditOutboxRepository
- [x] `void enqueue(long eventId, String destination)`
- [x] `List<OutboxRow> claimPending(String destination, int limit, Instant now)`
- [x] `void markDelivered(long eventId, String destination, Instant deliveredAt)`
- [x] `void markFailed(long eventId, String destination, Instant failedAt, String error)`

### 3.5 受け入れ条件
- [x] Flyway fresh schema で 4 table + 2 state table が作成される
- [x] `audit_chain_head` seed row が 1 行だけ入る
- [x] repositories の最小 CRUD が test で通る
- [x] 既存 migration と名前衝突しない

### 3.6 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=FreshSchemaBaselineTest,UserSecurityStateRepositoryTest,AuthSessionRegistryRepositoryTest,AuthoritativeAuditRepositoryTest,AuditOutboxRepositoryTest test
```

---

## CT-03 Step-up proof + session registry filter + admin mutation guard

**状態**: CT-02 完了後 Ready  
**目的**: すべての admin mutation を session-bound step-up proof 前提にする。  
**依存**: CT-02  
**PR 名**: `A5-02 step-up-session-guard`

### 4.1 変更対象ファイル

#### 追加
- [x] `src/main/java/open/dolphin/security/auth/AuthSessionRegistryFilter.java`
- [x] `src/main/java/open/dolphin/security/auth/AuthSessionRegistryService.java`
- [x] `src/main/java/open/dolphin/security/auth/StepUpSessionService.java`
- [x] `src/main/java/open/dolphin/security/auth/AdminStepUpGuard.java`
- [x] `src/test/java/open/dolphin/security/auth/AuthSessionRegistryFilterTest.java`
- [x] `src/test/java/open/dolphin/security/auth/AdminStepUpGuardTest.java`

#### 変更
- [x] `src/main/java/open/dolphin/rest/AuthSessionSupport.java`
- [x] `src/main/java/open/dolphin/rest/SessionAuthResource.java`
- [x] `src/main/java/open/dolphin/rest/LogoutResource.java`
- [x] `src/main/java/open/dolphin/rest/AdminConfigResource.java`
- [x] `src/main/java/open/dolphin/rest/AdminMasterUpdateResource.java`
- [x] `src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`
- [x] `src/main/java/open/dolphin/rest/AdminOrcaUserResource.java`
- [x] `src/main/java/open/dolphin/rest/AdminOrcaUserLinkResource.java`
- [x] `src/main/java/open/dolphin/rest/AdminAccessResource.java`
- [x] `src/main/java/open/dolphin/rest/AdminAccessMutationSupport.java`
- [x] `src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- [x] `src/test/java/open/dolphin/rest/SessionAuthResourceTest.java`
- [x] `src/test/java/open/dolphin/rest/LogoutResourceTest.java`
- [x] `src/test/java/open/dolphin/rest/AdminOrcaConnectionResourceTest.java`
- [x] admin resource 近傍 test 一式

### 4.2 HTTP 契約

#### 新設 endpoint
`POST /api/session/step-up`

**request**
```json
{
  "method": "totp",
  "code": "123456",
  "scope": "admin:mutation"
}
```

**success response**
- status: `200 OK`
- body:
```json
{
  "scope": "admin:mutation",
  "verifiedAt": "2026-03-24T06:45:00Z",
  "expiresAt": "2026-03-24T06:50:00Z",
  "ttlSeconds": 300
}
```

**error**
- [x] 未認証 session: `401 unauthorized`
- [x] code なし / scope 不正 / method 不正: `400 invalid_request`
- [x] TOTP 不正: `401 factor2_invalid`
- [x] verified TOTP credential なし: `412 factor2_missing`
- [x] revoked session: `401 session_revoked`

#### admin mutation 失敗契約
- [x] step-up 無し: `412 Precondition Failed`
- [x] error body:
```json
{
  "error": "step_up_required",
  "code": "step_up_required",
  "message": "管理操作には追加認証が必要です。",
  "requiredScope": "admin:mutation",
  "status": 412
}
```

### 4.3 step-up 仕様

- [x] `method` は `"totp"` 固定。他は 400
- [x] `scope` は `"admin:mutation"` 固定。他は 400
- [x] TTL は **300 秒**
- [x] proof は server-side session と `auth_session_registry` の両方に保存する
- [x] proof は current session にのみ有効。別 session へは移らない
- [x] logout / revoke / session epoch 変化で即失効する
- [x] step-up 成功時、`factor_level` は `step-up` に更新する
- [x] login/factor2 成功時、registry row が無ければ作成する

### 4.4 AuthSessionSupport 変更点
- [x] session attribute を追加する
  - [x] `AUTH_STEP_UP_SCOPE`
  - [x] `AUTH_STEP_UP_VERIFIED_AT`
  - [x] `AUTH_STEP_UP_EXPIRES_AT`
- [x] `populateAuthenticatedSession()` で step-up 属性を clear する
- [x] `clearAuthenticatedSession()` で step-up 属性も clear する

### 4.5 filter / guard 実装

#### AuthSessionRegistryFilter
- [x] JAX-RS `ContainerRequestFilter` として実装し、`OpenDolphinRestApplication` に登録する
- [x] request ごとに session があれば `auth_session_registry` を見る
- [x] `revoked_at != null` なら session clear + 401
- [x] `session_epoch_at_issue < user_security_state.session_epoch` なら session clear + 401
- [x] 成功時 `last_seen_at` を更新する
- [x] 無名 request / pending factor2 session には干渉しない

#### AdminStepUpGuard
- [x] `require(HttpServletRequest request, String scope)` を実装する
- [x] proof なし / 期限切れ / scope 不一致で 412 を投げる
- [x] 期限比較は `Instant.now()` 基準
- [x] scope は完全一致のみ。prefix match をしない

### 4.6 guard 適用対象

以下の **POST / PUT / DELETE** にすべて guard を入れる。

- [x] `PUT /api/admin/config`
- [x] `POST /api/admin/orca/transport/reload`
- [x] `POST /api/admin/master-updates/datasets/{datasetCode}/run`
- [x] `POST /api/admin/master-updates/datasets/{datasetCode}/rollback`
- [x] `POST /api/admin/master-updates/datasets/{datasetCode}/upload`
- [x] `PUT /api/admin/master-updates/schedule`
- [x] `PUT /api/admin/orca/connection`
- [x] `PUT /api/admin/orca/connection/default-facility`
- [x] `POST /api/admin/orca/connection/test`
- [x] `POST /api/admin/orca/sync`
- [x] `POST /api/admin/orca/users`
- [x] `PUT /api/admin/orca/users/{orcaUserId}`
- [x] `DELETE /api/admin/orca/users/{orcaUserId}`
- [x] `PUT /api/admin/users/{ehrUserId}/orca-link`
- [x] `DELETE /api/admin/users/{ehrUserId}/orca-link`
- [x] `POST /api/admin/access/users`
- [x] `PUT /api/admin/access/users/{userPk}`

### 4.7 payload-embedded TOTP 削除
- [x] `AdminAccessResource.verifyAdminTotp()` 呼び出しを削除する
- [x] `AdminAccessMutationSupport` から `totpCode` 読み出しを削除する
- [x] admin mutation payload に `totpCode` を残さない
- [x] 旧 payload を受け取っても無視しない。**400 invalid_request** で reject する

### 4.8 auth lifecycle audit（この PR で同時に入れる）
以下の action を **必ず success/failure で記録**する。

- [x] `LOGIN_PASSWORD_OK`
- [x] `LOGIN_PASSWORD_BLOCKED`
- [x] `LOGIN_PASSWORD_FAIL`
- [x] `LOGIN_FACTOR2_REQUIRED`
- [x] `LOGIN_FACTOR2_OK`
- [x] `LOGIN_FACTOR2_FAIL`
- [x] `LOGIN_FACTOR2_EXPIRED`
- [x] `SESSION_STEP_UP_OK`
- [x] `SESSION_STEP_UP_FAIL`
- [x] `LOGOUT_OK`
- [x] `ADMIN_STEP_UP_BLOCKED`

payload 最小項目:
- [x] `facilityId`
- [x] `requestId`
- [x] `traceId`
- [x] `scope`（step-up のとき）
- [x] `errorCode`
- [x] `httpStatus`

### 4.9 受け入れ条件
- [x] admin mutation 全件が step-up 無しで 412 になる
- [x] valid step-up 後は TTL 内だけ成功する
- [x] TTL 超過で再び 412 になる
- [x] logout 後は proof が失効する
- [x] revoked session が 401 になる
- [x] login / factor2 / step-up / logout の success/failure audit が残る

### 4.10 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=SessionAuthResourceTest,LogoutResourceTest,AdminOrcaConnectionResourceTest,AuthSessionRegistryFilterTest,AdminStepUpGuardTest test
```

---

## CT-04 Truthful session revoke

**状態**: CT-02 完了後 Ready  
**目的**: password reset / privilege downgrade で対象ユーザーの全 active session を本当に無効化する。  
**依存**: CT-02  
**PR 名**: `A5-03 truthful-session-revoke`

### 5.1 変更対象ファイル

#### 追加
- [x] `src/main/java/open/dolphin/security/auth/SessionRevocationService.java`
- [x] `src/test/java/open/dolphin/security/auth/SessionRevocationServiceTest.java`

#### 変更
- [x] `src/main/java/open/dolphin/rest/AdminAccessMutationSupport.java`
- [x] `src/main/java/open/dolphin/rest/AdminAccessResource.java`
- [x] `src/main/java/open/dolphin/rest/SessionAuthResource.java`
- [x] `src/main/java/open/dolphin/rest/LogoutResource.java`
- [x] `src/test/java/open/dolphin/rest/AdminAccessResourceTest.java`
- [x] `src/test/java/open/dolphin/rest/SessionAuthResourceTest.java`

### 5.2 revoke trigger
この PR で revoke するのは次だけに固定する。

- [x] password reset
- [x] admin role を含む権限から admin role を外した update
- [x] 将来の factor2 credential revoke は hook だけ用意し、route 実装は別 PR とする

### 5.3 実装仕様

#### password reset
- [x] `AdminAccessMutationSupport.resetPassword(...)` で `invalidateCurrentSession()` を**主処理から外す**
- [x] 代わりに `SessionRevocationService.revokeAllForUser(userPk, "password_reset")` を呼ぶ
- [x] その前に `user_security_state.session_epoch` を increment する
- [x] `password_changed_at` を更新する
- [x] current request の session も registry 上 revoke されるので、次 request から 401 になる

#### privilege downgrade
- [x] update 前 roles と update 後 roles を比較する
- [x] `oldRoles` に `admin` があり `newRoles` に `admin` が無いとき revoke する
- [x] revoke reason は `privilege_downgrade`
- [x] session epoch を increment する

#### registry enforcement
- [x] `AuthSessionRegistryFilter` で revoked/session epoch mismatch を 401 にする
- [x] 401 body は次で固定する
```json
{
  "error": "session_revoked",
  "code": "session_revoked",
  "message": "セッションは無効化されました。再ログインしてください。",
  "status": 401
}
```

### 5.4 audit
- [x] `SESSION_REVOKED` を記録する
- [x] payload:
  - [x] `facilityId`
  - [x] `targetUserPk`
  - [x] `reason`
  - [x] `revokedCount`
  - [x] `requestId`
  - [x] `traceId`

### 5.5 受け入れ条件
- [x] password reset 後、対象ユーザーの既存 session が次 request で 401 になる
- [x] admin role downgrade 後、対象ユーザーの既存 session が次 request で 401 になる
- [x] `session.invalidate()` のみに依存するコードが残っていない
- [x] `AdminAccessPasswordResetResource` を再登録していない

### 5.6 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=SessionRevocationServiceTest,AdminAccessResourceTest,SessionAuthResourceTest test
```

---

## CT-05 Authoritative audit chain + outbox

**状態**: CT-02 完了後 Ready  
**目的**: authoritative audit を linearly append し、JMS publish を outbox へ分離する。  
**依存**: CT-02  
**PR 名**: `A5-04 authoritative-audit-chain`

### 6.1 変更対象ファイル

#### 追加
- [x] `src/main/java/open/dolphin/security/audit/AuditHashService.java`
- [x] `src/main/java/open/dolphin/security/audit/AuditChainVerifier.java`
- [x] `src/main/java/open/dolphin/security/audit/AuditOutboxDispatcher.java`
- [x] `src/test/java/open/dolphin/security/audit/AuditHashServiceTest.java`
- [x] `src/test/java/open/dolphin/security/audit/AuditChainVerifierTest.java`
- [x] `src/test/java/open/dolphin/security/audit/AuditOutboxDispatcherTest.java`

#### 変更
- [x] `src/main/java/open/dolphin/security/audit/AuditTrailService.java`
- [x] `src/main/java/open/dolphin/security/audit/SessionAuditDispatcher.java`
- [x] `src/test/java/open/dolphin/security/audit/AuditTrailServiceTest.java`
- [x] `src/test/java/open/dolphin/security/audit/SessionAuditDispatcherTest.java`

### 6.2 実装仕様

#### authoritative write
- [x] `AuditTrailService.write(...)` は `AuthoritativeAuditRepository.append(...)` を使う
- [x] `event_time desc limit 1` による previous event 解決を削除する
- [x] `append(...)` 内で `audit_chain_head` row を `FOR UPDATE` する
- [x] 同一 transaction 内で
  1. head row lock
  2. payload sanitize
  3. payload hash
  4. event hash
  5. audit_event insert
  6. head update
  7. outbox enqueue
  の順で実行する

#### hash material
event hash は次の固定順で canonical 連結して SHA-256 hex 化する。

1. `event_time`
2. `action`
3. `resource`
4. `actor_id`
5. `facility_id`
6. `subject_type`
7. `subject_id`
8. `outcome`
9. `http_status`
10. `trace_id`
11. `request_id`
12. `payload_hash`
13. `previous_event_id`
14. `previous_hash`

- [x] JSON text の key 順に依存しない
- [x] `payload_json` は canonical serializer でシリアライズする

#### outbox delivery
- [x] `SessionAuditDispatcher.dispatch(...)` は JMS へ直接 publish しない
- [x] authoritative write 後に `audit_export_outbox` へ `destination='jms:dolphin'` を enqueue する
- [x] `AuditOutboxDispatcher` が pending row を取り出して JMS 送信する
- [x] success で `delivery_state='sent'`
- [x] failure で `delivery_state='failed'`, `attempt_count++`, `last_error` 更新
- [x] scheduler は 10 秒間隔、1 回 100 件まで
- [x] 並行 dispatcher は 1 インスタンスだけにする

### 6.3 payload minimum policy
- [x] clinical free text を保存しない
- [x] raw query/body を保存しない
- [x] cookie/auth header/token/secret を保存しない
- [x] patient name 等の可読 PHI を payload に重複保存しない
- [x] subject は `subject_type` / `subject_id` に出す

### 6.4 受け入れ条件
- [x] 並行書き込みで chain fork が起きない
- [x] `SessionAuditDispatcher` が JMS 直送をしていない
- [x] outbox 再送が可能
- [x] `AuditChainVerifier` で hash 再計算が通る
- [x] payload sanitizer で PHI / token が落ちる

### 6.5 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=AuditTrailServiceTest,SessionAuditDispatcherTest,AuditHashServiceTest,AuditChainVerifierTest,AuditOutboxDispatcherTest test
```

---

## CT-06 Document integrity contract hardening + FIDO / backup 残骸削除

**状態**: Ready Now  
**目的**: production-like の integrity contract を明文化し、不要な FIDO/backup surface を除去する。  
**依存**: なし  
**PR 名**: `A5-05 integrity-contract-and-surface-cleanup`

### 7.1 変更対象ファイル

#### 削除
- [x] `src/main/java/open/dolphin/security/totp/BackupCodeGenerator.java`

#### 変更
- [x] `src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
- [x] `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- [x] `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- [x] `src/main/java/open/dolphin/security/integrity/DocumentIntegrityConfig.java`
- [x] `config/server-modernized.env.sample`
- [x] `src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
- [x] `src/test/java/open/dolphin/runtime/config/ServerConfigurationValidatorTest.java`
- [x] `src/test/java/open/dolphin/security/integrity/DocumentIntegrityConfigTest.java`
- [x] `src/test/java/open/dolphin/mbean/ServletStartupSecurityGuardTest.java`

### 7.2 FIDO / backup cleanup
- [x] `ServerRuntimeConfiguration.Fido2Settings` を削除する
- [x] `ServerConfigurationResolver#fido2()` を削除する
- [x] `ServerConfigurationValidator#validateFido2(...)` を削除する
- [x] FIDO2 config key constants を削除する
- [x] `ServerConfigurationResolverTest` の FIDO 関連 test を削除する
- [x] env sample から FIDO2 設定説明を削除する
- [x] backup code 生成クラス参照が無いことを grep で確認する

### 7.3 integrity contract
- [x] env sample には `DOCUMENT_INTEGRITY_MODE=enforce` しか書かない
- [x] validator は production-like で `document.integrity.mode != enforce` を reject する
- [x] validator は keyring missing/invalid を reject する
- [x] `DocumentIntegrityConfig` の keyring validation は継続する
- [x] read path verify / write path seal の既存挙動は壊さない
- [x] `SECURITY_TRUSTED_PROXIES` と `FACTOR2_AES_KEY_B64` が未設定なら startup fail にする

### 7.4 grep チェック
- [x] `rg -n "fido2|Fido2|BackupCodeGenerator" src/main/java src/test/java config` で残骸が無い
- [x] `rg -n "AUDIT_TRUSTED_""PROXIES" .` で旧 key が無い

### 7.5 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=ServerConfigurationResolverTest,ServerConfigurationValidatorTest,DocumentIntegrityConfigTest,ServletStartupSecurityGuardTest test
```

---

## CT-07 ORCA internal boundary split（public route は触らない）

**状態**: Ready Now  
**目的**: Slice-1 完了後の次段として、ORCA live / local projection の internal boundary を固定し、default facility を admin edge 限定に縮退させる。  
**依存**: なし  
**PR 名**: `A3-02 internal-orca-boundary-split`

### 8.1 変更対象ファイル

#### 追加
- [x] `src/main/java/open/dolphin/orca/service/OrcaLiveGateway.java`
- [x] `src/main/java/open/dolphin/orca/service/DefaultOrcaLiveGateway.java`
- [x] `src/main/java/open/dolphin/orca/service/OutpatientProjectionService.java`
- [x] `src/main/java/open/dolphin/orca/service/DiseaseProjectionService.java`
- [x] `src/test/java/open/dolphin/orca/service/DefaultOrcaLiveGatewayTest.java`

#### 変更
- [x] `src/main/java/open/dolphin/orca/service/OrcaWrapperService.java`
- [x] `src/main/java/open/dolphin/orca/service/OrcaWrapperServiceSupport.java`
- [x] `src/main/java/open/dolphin/orca/service/OrcaWrapperServiceMutationSupport.java`
- [x] `src/main/java/open/dolphin/orca/config/OrcaConnectionConfigStore.java`
- [x] `src/main/java/open/dolphin/rest/orca/AbstractOrcaWrapperResource.java`
- [x] `src/main/java/open/dolphin/rest/orca/OrcaMedicalOutpatientResource.java`
- [x] `src/main/java/open/dolphin/rest/orca/OrcaLocalMedicalOutpatientResource.java`
- [x] `src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java`
- [x] `src/test/java/open/dolphin/orca/service/OrcaWrapperServiceFailClosedTest.java`
- [x] `src/test/java/open/dolphin/rest/OrcaChartSupportResourceTest.java`
- [x] `src/test/java/open/dolphin/rest/OrcaReportDocumentResourceTest.java`

### 8.2 実装仕様

#### OrcaLiveGateway
- [x] `OrcaWrapperService` は hard rename する
- [x] 互換 interface を残さない
- [x] live ORCA read/write はすべて `facilityId` 必須
- [x] `DefaultOrcaLiveGateway` は current `OrcaWrapperService` 実装を移植する
- [x] helper は `OrcaWrapperServiceSupport` に残してよいが、facility 非依存 helper だけにする

#### local projection service
- [x] `OutpatientProjectionService` を追加する
- [x] `DiseaseProjectionService` を追加する
- [x] public route はこの PR では変えない
- [x] ただし resource 内 delegate は live gateway と local projection service を**別 field**で持つようにする
- [x] `OrcaMedicalOutpatientResource -> OrcaLocalMedicalOutpatientResource delegate` の直結をやめる

#### default facility 縮退
- [x] `OrcaConnectionConfigStore.resolve(null)` の runtime 呼び出しを禁止する
- [x] `resolve(null)` を残す場合は **AdminOrcaConnectionResource 内専用 private helper** に閉じ込める
- [x] transport / live gateway / adapter / sync / push / recovery / request-edge resource から null facility 呼び出しを全削除する
- [x] `AbstractOrcaWrapperResource` は facility を trace context へ注入しない

### 8.3 やってはいけないこと
- [x] `OpenDolphinRestApplication` の route 公開セットを変えない
- [x] public path rename/delete をしない
- [x] hidden consumer 未棚卸しの public cutover をしない
- [x] disease public mutation を再公開しない

### 8.4 grep チェック
- [x] `rg -n "resolve\(null\)|reloadSettings\(null\)|invoke\(null" src/main/java/open/dolphin/orca src/main/java/open/dolphin/rest`
- [x] `rg -n "SessionTraceManager|MDC" src/main/java/open/dolphin/orca src/main/java/open/dolphin/rest/orca`
- [x] ORCA runtime path に facility implicit が残っていない

### 8.5 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=RestOrcaTransportTest,OrcaTransportRegistryTest,OrcaWrapperServiceFailClosedTest,OrcaPatientSyncServiceTest,ReceptionPushHandlerTest,MedicalPushHandlerTest,AdminOrcaConnectionResourceTest,OrcaVisitResourceTest,OrcaChartSupportResourceTest,OrcaReportDocumentResourceTest test
```

---

## 3. Batch-2 先行タスク（schema は Ready Now、利用コードは CT-08 以降）

## CT-08 Batch-2 domain / runtime schema

**状態**: Ready Now  
**目的**: schedule / encounter / sync / push / user-link truthful model 用 schema を先に用意する。  
**依存**: なし  
**PR 名**: `A4-02 domain-runtime-schema-batch2`

### 9.1 変更対象ファイル

#### 追加
- [x] `tools/flyway/sql/V0307__schedule_encounter_runtime_tables.sql`
- [x] `src/main/java/open/dolphin/encounter/ScheduleProjectionRepository.java`
- [x] `src/main/java/open/dolphin/encounter/EncounterProjectionRepository.java`
- [x] `src/main/java/open/dolphin/encounter/EncounterTransitionLogRepository.java`
- [x] `src/main/java/open/dolphin/reconciliation/ReconciliationTaskRepository.java`
- [x] `src/main/java/open/dolphin/orca/sync/OrcaSyncCursorStore.java`
- [x] `src/main/java/open/dolphin/orca/sync/OrcaSyncRunStore.java`
- [x] `src/main/java/open/dolphin/orca/push/OrcaPushEventInboxStore.java`
- [x] `src/main/java/open/dolphin/orca/push/OrcaPushCursorStore.java`
- [x] `src/main/java/open/dolphin/orca/push/OrcaPushConnectionStateStore.java`
- [x] `src/test/java/open/dolphin/encounter/EncounterProjectionRepositoryTest.java`
- [x] `src/test/java/open/dolphin/orca/sync/OrcaSyncRunStoreTest.java`
- [x] `src/test/java/open/dolphin/orca/push/OrcaPushEventInboxStoreTest.java`

#### 変更
- [x] `src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`

### 9.2 DDL（このまま実装する）

```sql
SET search_path TO opendolphin, public;

CREATE TABLE IF NOT EXISTS schedule_projection (
    schedule_key VARCHAR(128) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    karte_id BIGINT,
    orca_appointment_id VARCHAR(64) NOT NULL,
    scheduled_datetime TIMESTAMPTZ NOT NULL,
    department_code VARCHAR(32),
    physician_code VARCHAR(32),
    state VARCHAR(16) NOT NULL,
    linked_encounter_key VARCHAR(128),
    source_updated_at TIMESTAMPTZ,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (facility_id, orca_appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_projection_patient_time
    ON schedule_projection (facility_id, patient_id, scheduled_datetime DESC);

CREATE TABLE IF NOT EXISTS encounter_projection (
    encounter_key VARCHAR(128) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    karte_id BIGINT,
    schedule_key VARCHAR(128),
    orca_acceptance_id VARCHAR(64) NOT NULL,
    acceptance_datetime TIMESTAMPTZ NOT NULL,
    business_state VARCHAR(16) NOT NULL,
    chart_opened_at TIMESTAMPTZ,
    billed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    owner_user_id VARCHAR(128),
    memo TEXT,
    worklist_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_orca_sync_at TIMESTAMPTZ,
    state_version BIGINT NOT NULL DEFAULT 0,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (facility_id, orca_acceptance_id)
);

CREATE INDEX IF NOT EXISTS idx_encounter_projection_patient_time
    ON encounter_projection (facility_id, patient_id, acceptance_datetime DESC);

CREATE INDEX IF NOT EXISTS idx_encounter_projection_state
    ON encounter_projection (facility_id, business_state, acceptance_datetime DESC);

CREATE TABLE IF NOT EXISTS encounter_transition_log (
    transition_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    encounter_key VARCHAR(128) NOT NULL,
    operation VARCHAR(64) NOT NULL,
    from_state VARCHAR(16),
    to_state VARCHAR(16),
    request_id VARCHAR(128) NOT NULL,
    trace_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    last_error TEXT,
    reconciliation_required BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (facility_id, encounter_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_encounter_transition_log_request
    ON encounter_transition_log (request_id, trace_id);

CREATE TABLE IF NOT EXISTS reconciliation_task (
    task_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    subject_type VARCHAR(32) NOT NULL,
    subject_key VARCHAR(128) NOT NULL,
    reason_code VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_task_open
    ON reconciliation_task (facility_id, status, priority, updated_at DESC);

CREATE TABLE IF NOT EXISTS encounter_patient_snapshot (
    encounter_key VARCHAR(128) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS encounter_insurance_snapshot (
    encounter_key VARCHAR(128) NOT NULL,
    insurance_slot VARCHAR(32) NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (encounter_key, insurance_slot)
);

CREATE TABLE IF NOT EXISTS orca_job_schedule (
    facility_id VARCHAR(64) NOT NULL,
    job_kind VARCHAR(32) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    interval_minutes INTEGER NOT NULL,
    initial_lookback_days INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(128),
    PRIMARY KEY (facility_id, job_kind)
);

CREATE TABLE IF NOT EXISTS d_orca_sync_cursor (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    cursor_type VARCHAR(16) NOT NULL,
    cursor_value VARCHAR(128) NOT NULL,
    last_applied_run_id VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (facility_id, stream_kind)
);

CREATE TABLE IF NOT EXISTS d_orca_sync_run (
    run_id VARCHAR(64) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    trigger VARCHAR(16) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    requested_count INTEGER NOT NULL DEFAULT 0,
    fetched_count INTEGER NOT NULL DEFAULT 0,
    applied_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL,
    error_code VARCHAR(64),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_d_orca_sync_run_facility_time
    ON d_orca_sync_run (facility_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS d_orca_push_event_inbox (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    event_uuid VARCHAR(64) NOT NULL,
    event_name VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fetched_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code VARCHAR(64),
    error_message TEXT,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_recovery_run_id VARCHAR(64),
    PRIMARY KEY (facility_id, stream_kind, event_uuid)
);

CREATE INDEX IF NOT EXISTS idx_d_orca_push_event_inbox_status
    ON d_orca_push_event_inbox (facility_id, stream_kind, status, received_at);

CREATE TABLE IF NOT EXISTS d_orca_push_cursor (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    last_fetched_event_time TIMESTAMPTZ,
    last_fetched_event_uuid VARCHAR(64),
    last_applied_event_time TIMESTAMPTZ,
    last_applied_event_uuid VARCHAR(64),
    last_recovery_run_id VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (facility_id, stream_kind)
);

CREATE TABLE IF NOT EXISTS d_orca_push_connection_state (
    facility_id VARCHAR(64) NOT NULL,
    stream_kind VARCHAR(32) NOT NULL,
    connection_status VARCHAR(16) NOT NULL,
    websocket_url VARCHAR(512),
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (facility_id, stream_kind)
);
```

### 9.3 repository 必須メソッド
- [x] `ScheduleProjectionRepository.upsertFromOrca(...)`
- [x] `ScheduleProjectionRepository.linkEncounter(scheduleKey, encounterKey, projectedAt)`
- [x] `EncounterProjectionRepository.upsertCheckedIn(...)`
- [x] `EncounterProjectionRepository.transitionState(...)`
- [x] `EncounterProjectionRepository.findByEncounterKey(...)`
- [x] `EncounterTransitionLogRepository.insertAttempt(...)`
- [x] `EncounterTransitionLogRepository.markReconciliationRequired(...)`
- [x] `ReconciliationTaskRepository.openTask(...)`
- [x] `OrcaSyncCursorStore.load(...)`
- [x] `OrcaSyncCursorStore.save(...)`
- [x] `OrcaSyncRunStore.createRequested(...)`
- [x] `OrcaSyncRunStore.markFetching(...)`
- [x] `OrcaSyncRunStore.markApplying(...)`
- [x] `OrcaSyncRunStore.markCompleted(...)`
- [x] `OrcaSyncRunStore.markPartial(...)`
- [x] `OrcaSyncRunStore.markFailed(...)`
- [x] `OrcaPushEventInboxStore.markReceived(...)`
- [x] `OrcaPushEventInboxStore.markFetched(...)`
- [x] `OrcaPushEventInboxStore.markApplied(...)`
- [x] `OrcaPushEventInboxStore.markFailed(...)`
- [x] `OrcaPushEventInboxStore.findApplied(...)`
- [x] `OrcaPushCursorStore.load/save(...)`
- [x] `OrcaPushConnectionStateStore.upsertConnectionState(...)`

### 9.4 受け入れ条件
- [x] fresh schema で batch-2 tables が全部作成される
- [x] `schedule_projection` と `encounter_projection` に canonical key が入る
- [x] sync/push truthful model の最低 table が揃う
- [x] generic state store 追加が無い

### 9.5 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=FreshSchemaBaselineTest,EncounterProjectionRepositoryTest,OrcaSyncRunStoreTest,OrcaPushEventInboxStoreTest test
```

---

## CT-09 Sync truthful model

**状態**: CT-08 完了後 Ready  
**目的**: single-facility env 依存をやめ、cursor store と run store に分離した truthful sync へ置換する。  
**依存**: CT-08  
**PR 名**: `A3-03 sync-truthful-model`

### 10.1 変更対象ファイル

#### 追加
- [x] `src/main/java/open/dolphin/orca/sync/OrcaPatientImportService.java`
- [x] `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncPlanner.java`
- [x] `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncRunner.java`
- [x] `src/test/java/open/dolphin/orca/sync/OrcaPatientSyncPlannerTest.java`
- [x] `src/test/java/open/dolphin/orca/sync/OrcaPatientSyncRunnerTest.java`

#### 変更
- [x] `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncService.java`
- [x] `src/main/java/open/dolphin/orca/sync/OrcaPatientSyncScheduler.java`
- [x] `src/main/java/open/dolphin/rest/orca/OrcaPatientSyncResource.java`
- [x] `src/test/java/open/dolphin/orca/sync/OrcaPatientSyncServiceTest.java`

### 10.2 実装仕様

#### 分割
- [x] `OrcaPatientSyncService` は facade としてだけ残すか、完全に削除する
- [x] 推奨は完全削除し、resource/scheduler から planner/runner を直接呼ぶ
- [x] `OrcaPatientImportService` は on-demand import のみ
- [x] `OrcaPatientSyncPlanner` は facility ごとの cursor と job schedule を読む
- [x] `OrcaPatientSyncRunner` は 1 run を責任持って完結させる

#### scheduler
- [x] `ORCA_PATIENT_SYNC_FACILITY_ID` env 依存を削除する
- [x] `orca_job_schedule` の `enabled=true` 行を全件列挙する
- [x] facility ごとに独立 runId を採番する
- [x] `runId` 形式は `SYNC-{facilityId}-{yyyyMMddHHmmss}-{random8}`

#### cursor
- [x] 初期 cursor 未作成時は `cursor_type='date'`, `cursor_value=today-initial_lookback_days`
- [x] successful apply 後だけ cursor を進める
- [x] partial / failed では cursor を進めない
- [x] `last_applied_run_id` を保存する

#### run state
- [x] status は `requested / fetching / applying / completed / partial / failed`
- [x] `requestedCount`, `fetchedCount`, `appliedCount`, `failedCount`, `skippedCount` を埋める
- [x] resource trigger は `trigger='api'`
- [x] scheduler trigger は `trigger='scheduler'`

### 10.3 受け入れ条件
- [x] single-facility env を読まない
- [x] per-facility schedule registry で動く
- [x] run state と cursor が分離保持される
- [x] partial/failed が再実行可能な形で残る

### 10.4 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=OrcaPatientSyncPlannerTest,OrcaPatientSyncRunnerTest,OrcaPatientSyncServiceTest test
```

---

## CT-10 Push truthful model

**状態**: CT-08 完了後部分着手、recovery 厳密化は upstream fact-finding 待ち  
**目的**: markSeen 先行確定をやめ、event inbox 基準の truthful push にする。  
**依存**: CT-08  
**PR 名**: `A3-04 push-truthful-model`

### 11.1 変更対象ファイル

#### 変更
- [x] `src/main/java/open/dolphin/orca/push/ReceptionPushHandler.java`
- [x] `src/main/java/open/dolphin/orca/push/MedicalPushHandler.java`
- [x] `src/main/java/open/dolphin/orca/push/OrcaPushRecoveryService.java`
- [x] `src/main/java/open/dolphin/orca/push/OrcaPushStateStore.java`
- [x] `src/test/java/open/dolphin/orca/push/ReceptionPushHandlerTest.java`
- [x] `src/test/java/open/dolphin/orca/push/MedicalPushHandlerTest.java`

### 11.2 live push path（この PR で実装する）
- [x] handler 冒頭の `markSeen()` を削除する
- [x] event 到着時に inbox row を `status='received'` で upsert する
- [x] fetch 成功時 `status='fetched'`
- [x] local apply 成功時 `status='applied'` + `applied_at`
- [x] local apply 失敗時 `status='failed'` + `failed_at` + error
- [x] duplicate 判定は **同一 `(facility_id, stream_kind, event_uuid)` row に `applied_at IS NOT NULL`** だけで行う
- [x] `applied` 済みなら `duplicate` として no-op にする

### 11.3 recovery path（この PR では bootstrap のみ）
- [x] strict cursor replay 実装は **まだしない**
- [x] ただし `d_orca_push_cursor` への read/write skeleton は入れる
- [x] cursor 未存在時の bootstrap だけ実装してよい
- [x] upstream `pusheventgetv2` replay/cursor 契約が確定するまで lookback ロジックの最終実装はしない

### 11.4 rename
- [x] `OrcaPushStateStore` は `OrcaPushConnectionStateStore` へ rename する
- [x] event truth は inbox/cursor に分離するので、connection state store に event last-* を残さない

### 11.5 受け入れ条件
- [x] apply failure 後でも replay 不能にならない
- [x] duplicate は applied 基準でしか確定しない
- [x] live push path で `received / fetched / applied / failed / duplicate` が表現できる

### 11.6 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=ReceptionPushHandlerTest,MedicalPushHandlerTest test
```

---

## CT-11 ORCA user link を facility-native 化

**状態**: CT-08 完了後 Ready  
**目的**: multi-facility で `orca_user_id` が衝突しない data model にする。  
**依存**: CT-08  
**PR 名**: `A3-05 facility-native-orca-user-link`

### 12.1 変更対象ファイル
- [x] `tools/flyway/sql/V0308__orca_user_link_facility_native.sql`
- [x] `src/main/java/open/dolphin/rest/AdminOrcaUserLinkResource.java`
- [x] `src/main/java/open/dolphin/session/UserServiceBean.java`（or link repository 実装位置）
- [x] `src/test/java/open/dolphin/rest/AdminOrcaUserLinkResourceTest.java`

### 12.2 DDL
この PR では **既存 table を延命しない**。no-legacy 前提で次に置き換える。

```sql
SET search_path TO opendolphin, public;

ALTER TABLE d_orca_user_link
    ADD COLUMN IF NOT EXISTS facility_id VARCHAR(64);

ALTER TABLE d_orca_user_link
    DROP CONSTRAINT IF EXISTS d_orca_user_link_pkey;

ALTER TABLE d_orca_user_link
    ADD CONSTRAINT d_orca_user_link_pkey PRIMARY KEY (facility_id, ehr_user_pk);

DROP INDEX IF EXISTS uq_d_orca_user_link_orca_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_d_orca_user_link_facility_orca_user
    ON d_orca_user_link (facility_id, orca_user_id);
```

### 12.3 実装仕様
- [x] PUT/DELETE link は facility 必須にする
- [x] lookup も `(facilityId, ehrUserPk)` / `(facilityId, orcaUserId)` で引く
- [x] facility なし lookup を削除する

### 12.4 実行コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized \
  -Dtest=AdminOrcaUserLinkResourceTest test
```

---

## 4. Hold / Blocked（仕様固定、コードはまだ書かない）

## CT-H01 public route rename/delete

**状態**: Hold  
**着手条件**: hidden consumer inventory 完了  
**今はやらない理由**: A1/A3 とも hidden consumer 未確認を blocker としているため。  

### 実装内容（条件解放後に着手）
- [x] ORCA 名義 local outpatient route の public rename/delete
- [x] `PatientModV2OutpatientResource operation=create` の rename/delete
- [x] raw PVT state route 削除
- [x] `document/pvt/{params}` route 削除

---

## CT-H02 encounter / PVT cutover

**状態**: Blocked  
**着手条件**: CT-08 完了 + A2 public contract 確定 + hidden consumer inventory 完了  
**目的**: `patient + 日付` merge と raw int state をやめ、schedule/encounter projection へ切り替える。

### 対象ファイル
- [x] `src/main/java/open/dolphin/rest/PVTResource.java`
- [x] `src/main/java/open/dolphin/session/PVTServiceBean.java`
- [x] `src/main/java/open/dolphin/session/PVTServiceBeanSupport.java`
- [x] `src/main/java/open/dolphin/session/ChartEventServiceBean.java`
- [x] `src/test/java/open/dolphin/session/PVTServiceBeanAddPvtTest.java`
- [x] `src/test/java/open/dolphin/session/PVTServiceBeanClinicalTest.java`
- [x] `src/test/java/open/dolphin/rest/PVTResourceLimitTest.java`

### 固定仕様
- [x] `patientId + 日付`
- [x] `patientId + pvtDate`
- [x] local generated visit key  
  を canonical identity に使わない
- [x] checked-in 以降の projection key は `encounterKey`
- [x] schedule は `scheduleKey`
- [x] raw int state write route を削除する
- [x] business state と UI metadata を別 field に分離する
- [x] `/api/pvt` から patient / insurance master を更新しない

---

## CT-H03 document save と encounter transition の分離

**状態**: Blocked  
**着手条件**: CT-08 完了 + transition API contract 確定  
**目的**: document save fail-open で PVT state を best-effort 更新する実装を廃止する。

### 対象ファイル
- [x] `src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java`
- [x] `src/main/java/open/dolphin/session/KarteDocumentWriteService.java`
- [x] `src/test/java/open/dolphin/rest/KarteDocumentWriteResourceTest.java`

### 固定仕様
- [x] `POST /karte/document/pvt/{pvtPK,state}` 型の結合 route を削除する
- [x] document save は document aggregate write だけにする
- [x] encounter transition は別 command にする
- [x] ORCA 依存 transition は `idempotencyKey` 必須
- [x] local projection 更新失敗時は reconciliation task を open する

---

## CT-H04 disease / local diagnosis public cutover

**状態**: Blocked  
**着手条件**: A2 contract + hidden consumer inventory 完了  
**目的**: ORCA live disease と local diagnosis を public surface で分離する。  

### 固定仕様
- [x] ORCA live disease と local diagnosis を同じ response schema に混ぜない
- [x] local diagnosis mutation は `facilityId + patientId + karteId + diagnosisId` 必須
- [x] bare `diagnosisId` update/delete を許可しない
- [x] public 再公開は composite scope 実装後のみ

---

## 5. 共通レビュー観点

### 5.1 コードレビュー
- [x] null/default facility fallback が入っていない
- [x] session / request / MDC 依存 facility 解決が入っていない
- [x] route / config / class 名に互換 alias を作っていない
- [x] PHI / token / secret が audit payload に入っていない
- [x] `runtime_state_store` を再利用していない
- [x] public route exposure を勝手に変えていない
- [x] `AdminAccessPasswordResetResource` を登録していない

### 5.2 grep gate
- [x] `rg -n "resolveFacilityId\(|requireResolvedFacilityId\(|reloadSettings\(null\)|invoke\(null" src/main/java`
- [x] `rg -n "AUDIT_TRUSTED_""PROXIES|fido2|Fido2|BackupCodeGenerator" src/main/java src/test/java config`
- [x] `rg -n "totpCode" src/main/java/open/dolphin/rest`
- [x] `rg -n "event_time desc limit 1" src/main/java`
- [x] `rg -n "markSeen\(" src/main/java/open/dolphin/orca/push`

### 5.3 最小回帰
- [x] `SessionAuthResourceTest`
- [x] `LogoutResourceTest`
- [x] `AdminOrcaConnectionResourceTest`
- [x] `RestOrcaTransportTest`
- [x] `OrcaTransportRegistryTest`
- [x] `OrcaWrapperServiceFailClosedTest`
- [x] `OrcaPatientSyncServiceTest`
- [x] `ReceptionPushHandlerTest`
- [x] `MedicalPushHandlerTest`
- [x] `FreshSchemaBaselineTest`
- [x] `ServerConfigurationValidatorTest`
- [x] `DocumentIntegrityConfigTest`
- [x] `AuditTrailServiceTest`
- [x] `SessionAuditDispatcherTest`

---

## 6. 今は着手禁止の項目

- [x] public password reset route 再公開
- [x] public disease mutation 再公開
- [x] hidden consumer 未確認の route rename/delete
- [x] ORCA upstream replay 契約未確定の strict recovery 完全実装
- [x] break-glass route 実装
- [x] report signing / TSA failure policy 実装
- [x] backward compatibility alias 追加

---

## 7. Done 定義

この文書に基づく各 PR の Done は次で統一する。

- [x] 仕様欄の checkbox がすべて埋まっている
- [x] 対応 test が green
- [x] grep gate が clean
- [x] generated artifact が差分に無い
- [x] docs / env sample / migration / test がコードと一致している
- [x] public exposure を変えた PR ではない（CT-H を除く）
- [x] PR 説明に「何を削除したか」「何を rename したか」「何を意図的に触っていないか」を明記している

---

## 8. 最終メモ

- 現時点の **即着手**は `CT-01, 02, 06, 07, 08`。  
- `CT-03, 04, 05` は `CT-02` 後に着手。  
- `CT-09, 10, 11` は `CT-08` 後に着手。  
- `CT-H` は条件が解放されるまで実装禁止。  

この文書を正として、担当者は追加設計なしで PR を切ること。
