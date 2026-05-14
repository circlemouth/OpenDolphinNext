# Subagent B Report

- RUN_ID: `20260514T202711Z`
- Worktree: `/Users/Hayato/Documents/GitHub/worktrees/p0d-db-repository-boundary`
- Branch: `codex/p0d-db-repository-boundary`

## Scope

- `orca_prescription_orders` への prescription source-of-truth write path を除去。
- 同 table を ORCA-derived cache / projection / read model only として DB/contract で固定。
- `prescription_order` family と `prescription_order_event` だけを処方 authority mutation 先として維持。
- finalized direct write guard / append-only event / projection-only guard の focused test を追加・強化。

## Preflight

- 正本:
  - OpenDolphinNext 処方正本: `opendolphin.prescription_order`, `..._revision`, `..._item`, `..._event`
  - ORCA由来 projection/read model: `opendolphin.orca_prescription_orders`
- ORCA正本情報の local 正本化は禁止。
- 処方確定と ORCA 送信結果は混同しない。
- 既存 finalized row の直接 UPDATE/DELETE と event rewrite/delete は fail-closed にする。

## Misuse Cases Covered

1. 旧 local save/do-import が `orca_prescription_orders` へ payload を保存し、authority/event hash chain を迂回する。
2. アプリケーションまたは SQL 直叩きが `orca_prescription_orders` を authority table として INSERT/UPDATE/DELETE する。
3. FINAL/CHANGED 系処方 row を直接 DELETE し、revision/event を残さず改変する。
4. `prescription_order_event` を UPDATE/DELETE して append-only 監査列を消す。

## Changes

### 1. Repository boundary

- `server-modernized/src/main/java/open/dolphin/rest/orca/PrescriptionOrderRepository.java`
  - `save(...)` を legacy authority write 拒否へ変更。
  - 例外コード `orca_prescription_orders_projection_write_denied` を固定。
  - `findLatest(...)` の read path は維持。

### 2. Schema guard

- `server-modernized/tools/flyway/sql/V0335__orca_prescription_orders_projection_only.sql`
  - `orca_prescription_orders` に projection-only table comment を追加。
  - `trg_orca_prescription_orders_projection_guard` を追加。
  - direct `INSERT/UPDATE/DELETE` を `orca_prescription_orders_projection_write_denied` で拒否。

### 3. Test strengthening

- `server-modernized/src/test/java/open/dolphin/db/PrescriptionAuthoritySchemaTest.java`
  - FINAL row の direct `DELETE` 拒否を追加。
  - `prescription_order_event` の direct `DELETE` 拒否を追加。
  - `orca_prescription_orders` の direct `INSERT/UPDATE/DELETE` 拒否 schema test を追加。
- `server-modernized/src/test/java/open/dolphin/db/FreshSchemaBaselineTest.java`
  - Flyway latest version を `0335` へ更新。
  - `orca_prescription_orders` table / index / trigger の存在確認を追加。
- `server-modernized/src/test/java/open/dolphin/rest/orca/PrescriptionOrderRepositoryTest.java`
  - repository が legacy authority write を即時拒否する unit test を追加。

### 4. Docs / contracts

- `docs/architecture/ehr-orca-source-of-truth-boundary.md`
  - `orca_prescription_orders` を ORCA-derived cache/projection/read model only に固定。
- `docs/contracts/prescription-authority.md`
  - authority write 先は `prescription_order*` / `prescription_order_event` のみであることを明記。
  - `orca_prescription_orders` direct write prohibition と legacy bypass misuse case を追加。
- `docs/testing/ehr-orca-required-test-matrix.md`
  - `orca_prescription_orders` source-of-truth write prohibition を required test matrix に追加。

## Verification

### Focused commands

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PrescriptionAuthoritySchemaTest,FreshSchemaBaselineTest,PrescriptionOrderRepositoryTest test
bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"
```

### Result

- PASS: `PrescriptionAuthoritySchemaTest`
- PASS: `FreshSchemaBaselineTest`
- PASS: `PrescriptionOrderRepositoryTest`
- PASS: `check-finalized-write-guards.sh`

## Residual Risks / Handoff

- `LocalPrescriptionOrderResource` mutation route 自体の production runtime unreachable 化は Subagent A scope。今回の branch では repository + DB guard により `orca_prescription_orders` への authority write は fail-closed になるが、route inventory / registration の最終除去は A 側統合が必要。
- 将来 `orca_prescription_orders` を本当に ORCA-derived projection として再利用する場合は、dedicated ingest path・source metadata・operator/audit contract を追加した上で guard を設計し直す必要がある。現行は誤用防止を優先して direct DML 全面禁止。
