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
- [ ] dangerous path stopgap を戻さない
- [ ] dual support を作らない
- [ ] route / config key / class 名の互換 alias を作らない
- [ ] ORCA runtime path に implicit/default/session/MDC facility を戻さない
- [ ] ORCA live と local projection を同じ DTO / service / route で混在させない
- [ ] `password reset` の public 再公開をしない
- [ ] bare `diagnosisId` の public mutation を再公開しない
- [ ] hidden consumer inventory 完了前に public route rename/delete をしない
- [ ] generated artifact をコミットしない
- [ ] 新しい durable runtime state を `runtime_state_store` に押し込まない。専用 table を作る

### 1.2 この文書で固定する naming
- [ ] `OrcaWrapperService` は **`OrcaLiveGateway`** に rename する
- [ ] trusted proxy 設定 key は **`security.trusted-proxies`**、env は **`SECURITY_TRUSTED_PROXIES`** に統一する
- [ ] admin step-up scope は **`admin:mutation`** の 1 つだけに固定する
- [ ] schedule key は **`facilityId + ":" + orcaAppointmentId`**
- [ ] encounter key は **`facilityId + ":" + orcaAcceptanceId`**
- [ ] business state は **`scheduled / checked_in / chart_opened / billed / cancelled`** のみ
- [ ] auth factor mode は **`off | totp`** のみ。今リリースの正規経路は TOTP-only
- [ ] document integrity の production-like 運用は **`enforce`** 固定

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
- [ ] `src/main/java/open/dolphin/security/auth/TrustedProxyPolicy.java`
- [ ] `src/main/java/open/dolphin/security/auth/TrustedRequestContextResolver.java`
- [ ] `src/test/java/open/dolphin/security/auth/TrustedProxyPolicyTest.java`
- [ ] `src/test/java/open/dolphin/security/auth/TrustedRequestContextResolverTest.java`

#### 変更
- [ ] `src/main/java/open/dolphin/rest/AbstractResource.java`
- [ ] `src/main/java/open/dolphin/rest/RequestSecuritySupport.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerRuntimeConfiguration.java`
- [ ] `src/main/java/open/dolphin/runtime/config/ServerConfigurationValidator.java`
- [ ] `config/server-modernized.env.sample`
- [ ] `src/test/java/open/dolphin/runtime/config/ServerConfigurationResolverTest.java`
- [ ] `src/test/java/open/dolphin/runtime/config/ServerConfigurationValidatorTest.java`

### 2.2 仕様

#### config contract
- [ ] `AUDIT_TRUSTED_PROXIES` は削除する
- [ ] 新しい env 名は `SECURITY_TRUSTED_PROXIES`
- [ ] 対応 property key は `security.trusted-proxies`
- [ ] 値は **comma-separated** の exact IP または CIDR
- [ ] 許可例:
  - `127.0.0.1`
  - `10.0.0.0/24`
  - `2001:db8::1`
  - `2001:db8::/64`
- [ ] 不許可例:
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
- [ ] まず `request.getRemoteAddr()` を `remoteAddr` として取得する
- [ ] `remoteAddr` が trusted proxy に含まれない場合、`Forwarded` / `X-Forwarded-*` / `X-Real-IP` は**すべて無視**する
- [ ] `remoteAddr` が trusted proxy の場合のみ forwarded 解釈に進む
- [ ] `Forwarded` を第一優先、無ければ `X-Forwarded-For` を使う
- [ ] chain は **右から左**へ走査し、trusted proxy を剥がして最初の non-trusted hop を `clientIp` にする
- [ ] chain が全部 trusted の場合は一番左を `clientIp` とする
- [ ] malformed chain / malformed token / parse 失敗時は **forwarded 全体を無視**し、`clientIp = remoteAddr` にする
- [ ] `X-Real-IP` は trusted proxy 配下で、かつ `Forwarded` と `X-Forwarded-For` が無いときだけ補助的に使う
- [ ] untrusted source からの `Forwarded` / `X-Forwarded-*` / `X-Real-IP` は **ログに残してもよいが採用しない**

#### scheme / host / port 解決ルール
- [ ] trusted proxy 配下で `Forwarded` が正しく parse できる場合、`proto` / `host` を採用する
- [ ] `Forwarded` が無い場合のみ `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-Port` を使う
- [ ] `host` に port が含まれる場合は host/port に分解する
- [ ] parse 失敗時は request の scheme/serverName/serverPort に戻す
- [ ] `secure = scheme.equalsIgnoreCase("https")`

### 2.3 実装チェックリスト

#### TrustedProxyPolicy
- [ ] IP/CIDR parser を実装する
- [ ] 追加ライブラリは入れない。JDK 標準だけで実装する
- [ ] exact IP と CIDR を同じ matcher interface に正規化する
- [ ] IPv4/IPv6 両方を通す
- [ ] `isTrusted(String ip)` は invalid input に対して `false` を返す

#### ServerConfigurationResolver / Validator
- [ ] `security.trusted-proxies` を resolver に追加する
- [ ] `audit.trusted.proxies` と FIDO 由来 key 参照を削除する
- [ ] validator で token を全件 parse し、invalid token が 1 つでもあれば起動失敗にする
- [ ] blank は `loopback-only` 扱いにする
- [ ] env sample の説明文を `SECURITY_TRUSTED_PROXIES` へ書き換える

#### AbstractResource / RequestSecuritySupport
- [ ] `AbstractResource.resolveClientIp()` は resolver 呼び出しに置き換える
- [ ] `RequestSecuritySupport` の `Forwarded` parse 実装は削除する
- [ ] `RequestSecuritySupport` は resolver が返した `scheme/host/port/secure` を使うだけに縮退する
- [ ] trusted proxy 判定ロジックを rest package から削除する

### 2.4 受け入れ条件
- [ ] `AbstractResource` と `RequestSecuritySupport` に trusted proxy 判定コードが残っていない
- [ ] untrusted remote から付与した `Forwarded` を無視する
- [ ] trusted remote からの正しい `Forwarded` を採用する
- [ ] malformed header で fail-close する
- [ ] validator が invalid CIDR を reject する

### 2.5 テスト
- [ ] `TrustedProxyPolicyTest`
  - [ ] IPv4 exact
  - [ ] IPv4 CIDR
  - [ ] IPv6 exact
  - [ ] IPv6 CIDR
  - [ ] invalid token
- [ ] `TrustedRequestContextResolverTest`
  - [ ] untrusted remote + spoofed forwarded
  - [ ] trusted remote + valid Forwarded
  - [ ] trusted remote + valid X-Forwarded-*
  - [ ] malformed Forwarded
  - [ ] forwarded chain で right-to-left 解決
- [ ] `ServerConfigurationValidatorTest`
  - [ ] invalid CIDR reject
  - [ ] blank accepted as loopback-only

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
- [ ] `tools/flyway/sql/V0306__security_session_audit_tables.sql`
- [ ] `src/main/java/open/dolphin/security/auth/UserSecurityStateRepository.java`
- [ ] `src/main/java/open/dolphin/security/auth/AuthSessionRegistryRepository.java`
- [ ] `src/main/java/open/dolphin/security/audit/AuthoritativeAuditRepository.java`
- [ ] `src/main/java/open/dolphin/security/audit/AuditOutboxRepository.java`
- [ ] `src/test/java/open/dolphin/security/auth/UserSecurityStateRepositoryTest.java`
- [ ] `src/test/java/open/dolphin/security/auth/AuthSessionRegistryRepositoryTest.java`
- [ ] `src/test/java/open/dolphin/security/audit/AuthoritativeAuditRepositoryTest.java`
- [ ] `src/test/java/open/dolphin/security/audit/AuditOutboxRepositoryTest.java`

#### 変更
- [ ] `src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`

### 3.2 実装方針
- [ ] JPA entity は追加しない
