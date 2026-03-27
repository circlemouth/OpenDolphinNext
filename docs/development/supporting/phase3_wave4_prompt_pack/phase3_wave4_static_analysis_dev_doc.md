# Phase3+ Wave 4 Static-Analysis Tail Burn-down

## 背景
- 現在の primary source of truth は current repo。
- 後方互換性は考慮しない。
- broad refactor ではなく、smallest viable diff で SpotBugs / FindSecBugs の残件を削る。
- 現在の canonical 状態は以下。
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile` は通過済み
- `bash ./scripts/server-modernized/verify-static-analysis.sh` は SpotBugs 35 件で fail
- baseline の残件は 7 cluster に分けられる
- `pom.server-modernized.xml` の static-analysis 方針は維持する。
  - SpotBugs / FindSecBugs: fail-on-error
  - Checkstyle / PMD: skip のまま
- blanket suppression や threshold 緩和は禁止。
- inventory 正本: `docs/server-modernization/static-analysis-baseline-inventory.md`

## 実行方針
- [ ] current repo を正本とする
- [ ] `pom.server-modernized.xml` の `failOnError` / `threshold` / exclude filter を変更しない
- [ ] Checkstyle / PMD を有効化しない
- [ ] blanket suppression を追加しない
- [ ] broad refactor をしない
- [ ] closed Phase2 論点を reopen しない
- [ ] smallest viable diff を優先する
- [ ] 変更後は `docs/server-modernization/static-analysis-baseline-inventory.md` を更新する

## 工程表

### Phase 0: 親の inventory 固定
- [ ] `bash ./scripts/server-modernized/verify-static-analysis.sh` を実行し current XML を生成する
- [ ] `server-modernized/target/static-analysis/spotbugs/spotbugs-opendolphin-server-modernized.xml` から package / class / bug code / count を集計する
- [ ] 現在の 35 件が以下 7 cluster に一致することを確認する
- [ ] 子エージェントへ cluster ごとの対象 package / class を配布する

### Phase 1: 並列修正
- [ ] WS-A `open.dolphin.rest` tail 13 件
- [ ] WS-B `open.dolphin.rest.orca` tail 7 件
- [ ] WS-C `open.dolphin.persistence.query` tail 4 件
- [ ] WS-D `open.dolphin.security.audit` tail 3 件
- [ ] WS-E `open.dolphin.orca.adapter` tail 3 件
- [ ] WS-F `open.dolphin.orca.converter` tail 1 件
- [ ] WS-G `open.dolphin.runtime` / `open.dolphin.runtime.config` / `open.dolphin.security.integrity` / `open.dolphin.security.totp` tail 4 件

### Phase 2: 親の統合
- [ ] 各 lane の diff を衝突確認して統合する
- [ ] `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile` を再実行する
- [ ] `bash ./scripts/server-modernized/verify-static-analysis.sh` を再実行する
- [ ] before / after 件数を `docs/server-modernization/static-analysis-baseline-inventory.md` に追記する
- [ ] green 未達なら残件を package / class / bug code 単位で再分割する

## Workstream 定義

### WS-A: open.dolphin.rest tail
- [ ] 対象 package: `open.dolphin.rest`
- [ ] 代表 bug code:
  - [ ] `DLS_DEAD_LOCAL_STORE`
  - [ ] `NP_BOOLEAN_RETURN_NULL`
  - [ ] `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`
  - [ ] `AT_STALE_THREAD_WRITE_OF_PRIMITIVE`
  - [ ] `DB_DUPLICATE_BRANCHES`
  - [ ] `EI_EXPOSE_REP`
  - [ ] `EI_EXPOSE_REP2`
  - [ ] `MS_EXPOSE_REP`
  - [ ] `NP_LOAD_OF_KNOWN_NULL_VALUE`
  - [ ] `URF_UNREAD_FIELD`
- [ ] 代表クラス候補:
  - [ ] `open.dolphin.rest.AdminConfigResource`
  - [ ] `open.dolphin.rest.AdminOrcaConnectionResource`
  - [ ] `open.dolphin.rest.KarteResource`
  - [ ] `open.dolphin.rest.StampResource`
  - [ ] `open.dolphin.rest.masterupdate.*`
- [ ] 方針:
  - [ ] boolean-null を `Boolean` 契約が本当に必要か見直し、不要なら primitive / 明示 2 値へ寄せる
  - [ ] redundant nullcheck / duplicate branches / dead local store を局所整理する
  - [ ] expose-rep は defensive copy / unmodifiable view / immutable field で閉じる
  - [ ] stale thread write / unread field は thread-safety を弱めずに smallest diff で閉じる

### WS-B: open.dolphin.rest.orca tail
- [ ] 対象 package: `open.dolphin.rest.orca`
- [ ] 代表 bug code:
  - [ ] `EI_EXPOSE_REP2`
  - [ ] `HSM_HIDING_METHOD`
  - [ ] `NP_BOOLEAN_RETURN_NULL`
  - [ ] `RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE`
  - [ ] `REC_CATCH_EXCEPTION`
  - [ ] `UPM_UNCALLED_PRIVATE_METHOD`
- [ ] 方針:
  - [ ] broad API redesign はしない
  - [ ] catch-all exception は意図のある narrower catch または fail-fast に寄せる
  - [ ] expose-rep は defensive copy
  - [ ] unused private method は dead なら削除、必要なら call site を明確化

### WS-C: open.dolphin.persistence.query tail
- [ ] 対象 package: `open.dolphin.persistence.query`
- [ ] 代表 bug code:
  - [ ] `EI_EXPOSE_REP2`
- [ ] 方針:
  - [ ] mutable field / array / collection の outward exposure を defensive copy または immutable 化で閉じる
  - [ ] query semantics を変えない
  - [ ] query string の設計変更に広げない

### WS-D: open.dolphin.security.audit tail
- [ ] 対象 package: `open.dolphin.security.audit`
- [ ] 代表 bug code:
  - [ ] `EI_EXPOSE_REP`
  - [ ] `EI_EXPOSE_REP2`
  - [ ] `NM_SAME_SIMPLE_NAME_AS_INTERFACE`
- [ ] 代表クラス候補:
  - [ ] `open.dolphin.security.audit.AuditChainVerifier`
- [ ] 方針:
  - [ ] expose-rep は immutable / copy で閉じる
  - [ ] naming 衝突は public contract を壊さない最小 rename または局所整理で閉じる
  - [ ] audit semantics を変えない

### WS-E: open.dolphin.orca.adapter tail
- [ ] 対象 package: `open.dolphin.orca.adapter`
- [ ] 代表 bug code:
  - [ ] `EI_EXPOSE_REP`
- [ ] 方針:
  - [ ] adapter が持つ mutable DTO / collection の outward exposure を defensive copy に置き換える
  - [ ] adapter contract を変えない
  - [ ] ORCA integration behavior を変えない

### WS-F: open.dolphin.orca.converter tail
- [ ] 対象 package: `open.dolphin.orca.converter`
- [ ] 代表 bug code:
  - [ ] `IT_NO_SUCH_ELEMENT`
- [ ] 代表クラス候補:
  - [ ] `open.dolphin.orca.converter.OrcaXmlMapper`
- [ ] 方針:
  - [ ] iterator / optional / collection 走査で empty case を fail-safe に処理する
  - [ ] parse semantics を必要以上に変えない
  - [ ] converter 全体の再設計はしない

### WS-G: runtime / security tail
- [ ] 対象 package:
  - [ ] `open.dolphin.runtime`
  - [ ] `open.dolphin.runtime.config`
  - [ ] `open.dolphin.security.integrity`
  - [ ] `open.dolphin.security.totp`
- [ ] 代表 bug code:
  - [ ] `NP_BOOLEAN_RETURN_NULL`
  - [ ] `UPM_UNCALLED_PRIVATE_METHOD`
  - [ ] `CT_CONSTRUCTOR_THROW`
- [ ] 方針:
  - [ ] startup / integrity / totp semantics を変えない
  - [ ] boolean-null は契約を 2 値化できるか確認する
  - [ ] dead private method は削除または reachable にする
  - [ ] constructor throw は factory 化が必要なら smallest viable diff で行う

## 受け入れ条件
- [ ] `pom.server-modernized.xml` の static-analysis gate 方針は不変
- [ ] `mvn -f pom.server-modernized.xml -pl server-modernized -am -DskipTests compile` が通る
- [ ] `bash ./scripts/server-modernized/verify-static-analysis.sh` が green になる
- [ ] green 未達でも residual findings が package / class / bug code 単位に再整理されている
- [ ] `docs/server-modernization/static-analysis-baseline-inventory.md` が更新されている
- [ ] unrelated cleanup が混ざっていない
