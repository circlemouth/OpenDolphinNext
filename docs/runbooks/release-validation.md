# Release Validation

## 目的
本番投入前に、`web-client` と `server-modernized` の現行契約、設定、静的検証、最小 smoke が揃っていることを確認する。

## 事前確認
- `docs/contracts/` が今回の変更を反映している。
- `docs/architecture/` の summary が current contract と矛盾していない。
- `docs/managerdocs/` の release/readiness 説明が gate と矛盾していない。
- `config/server-modernized.env.sample` が設定契約と一致している。
- `target/` / `*.war` / `__MACOSX` / `.DS_Store` / `Thumbs.db` をレビュー対象に含めない。

## 必須コマンド
```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

## Worker G の post-merge 確認
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=PublicRouteInventoryContractTest,WebXmlEndpointExposureTest test
cd web-client && node scripts/verify-no-blocked-orca-route-strings.mjs
```

- `PublicRouteInventoryContractTest` で official / master / local / admin-internal inventory が current taxonomy と一致することを確認する。
- `WebXmlEndpointExposureTest` で `/api/*` exposure と `/api/orca/*` taxonomy が崩れていないことを確認する。
- `verify-no-blocked-orca-route-strings.mjs` で web-client source に taxonomy drift や blocked mock surface が残っていないことを確認する。
- Reception / Patients / Charts / Admin の UI と server contract が taxonomy contract と一致していることを確認する。

## 補助コマンド
```bash
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-no-runtime-ddl.sh
bash server-modernized/tools/ci/check-persistence-entities.sh
bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"
rg 'System\\.get(env|Property)|ConfigProvider\\.getConfig\\(' server-modernized/src/main/java -n
rg 'dolphin\\.facilityId' server-modernized -n
```

## 期待結果
- `npm run ci` が成功する。
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` が成功する。
- `runtime-ready-smoke` が成功する。
- direct runtime lookup grep は `ServerConfigurationResolver.java` の `ConfigProvider.getConfig()` 1 件だけを返す。
- `dolphin.facilityId` grep は 0 件。

## 証跡保存先
- runtime smoke の既知出力先は `web-client/artifacts/webclient/runtime-gate-ready/<RUN_ID>`。
- ORCA 接続確認の既知出力先は `artifacts/orca-connectivity/<RUN_ID>/`。
- Worker G の smoke memo / diff / grep 結果は release 判定に使う artifact 配下へまとめ、cutover 記録と分離しない。

## 手動確認
### Health
- [ ] `GET /api/health` が最小 payload を返す。
- [ ] `GET /api/health/readiness` が `status` だけを返す。
- [ ] 認証後の operations readiness が sanitize された詳細を返す。

### ORCA connection
- [ ] 既定施設が明示設定されていない場合、facility 未解決で fail する。
- [ ] 施設 A の更新で施設 B へ影響しない。
- [ ] readiness / audit に URL / host / port が出ない。

### Document integrity
- [ ] active key を切り替えても旧文書が verify できる。
- [ ] `mode=enforce` で検証失敗時に 409 を返す。
- [ ] `mode=permissive` で検証失敗時に読み取り継続する。

### Patient images
- [ ] 一覧の `downloadUrl` が context-root 非依存である。
- [ ] 大きすぎる画像を 4xx で拒否する。
- [ ] MIME mismatch を 4xx で拒否する。
- [ ] upload/download の `Cache-Control` が `private, no-store` である。

### Schema / Build
- [ ] `src/main/java` に runtime DDL が存在しない。
- [ ] Flyway migration のみで必要テーブルが揃う。
- [ ] `server-modernized/pom.xml` に sibling source 追加 (`../api-contract/src/main/java`) が存在しない。
- [ ] `persistence.xml` の entity 明示列挙と `@Entity` 実装が一致する。

## Review / Archive
- archive は repo root から作成する。
- 第一候補は `git archive` を使う。
- 手動 zip を作る場合も、`target/` / `*.war` / `__MACOSX` / `.DS_Store` / `Thumbs.db` を含めない。
- archive 生成後に `zipinfo -1` で禁止パターンを再検査する。

```bash
git archive --format=zip --output /tmp/OpenDolphinNext-clean.zip HEAD
```

```bash
zipinfo -1 /tmp/OpenDolphinNext-clean.zip | \
  rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' && exit 1 || true
```

## 補足
- `check-no-generated-artifacts.sh` は tracked / untracked の両方を検査する。
- `check-no-direct-runtime-lookup.sh` は `ServerConfigurationResolver.java` 以外の direct runtime lookup を許可しない。
- どれか 1 つでも失敗したら release は見送る。
- cutover / rollback の実施順序と停止条件は [../releases/orca-remediation-cutover.md](../releases/orca-remediation-cutover.md) を正本とする。
