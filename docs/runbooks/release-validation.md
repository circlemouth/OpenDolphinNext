# Release Validation Runbook

## 目的
本番投入前に、コード・文書・設定・テスト・監視が同じ契約で揃っていることを確認する。

## 事前確認
- [ ] `README.md` のリンクが存在する。
- [ ] `docs/` 以下の契約文書が今回の変更を反映している。
- [ ] `config/server-modernized.env.sample` が今回の設定変更を反映している。
- [ ] `target/` / `*.war` / `__MACOSX` / `.DS_Store` / `Thumbs.db` がレビュー対象に含まれていない。

## 静的確認コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am clean verify
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh --root "$(git rev-parse --show-toplevel)"
bash server-modernized/tools/ci/check-no-runtime-ddl.sh
bash server-modernized/tools/ci/check-persistence-entities.sh
bash server-modernized/tools/ci/check-no-generated-artifacts.sh --root "$(git rev-parse --show-toplevel)"
rg 'System\.get(env|Property)|ConfigProvider\.getConfig\(' server-modernized/src/main/java -n
rg 'dolphin\.facilityId' server-modernized -n -g '!docs/server-modernization/planning/**'
```

## 期待結果
- [ ] Surefire が成功する。
- [ ] Failsafe で 1 件以上の統合テストが実行される。
- [ ] CI 補助スクリプトがすべて成功する。
- [ ] direct runtime lookup grep は `ServerConfigurationResolver.java` の `ConfigProvider.getConfig()` 1 件だけを返す。
- [ ] `dolphin.facilityId` grep は 0 件。

## 手動確認
### Health
- [ ] `GET /api/health` が最小 payload を返す。
- [ ] `GET /api/health/readiness` が `status` だけを返す。
- [ ] 認証後の `GET /api/operations/readiness` が sanitize された詳細を返す。

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

## Review / Release Archive
- [ ] archive は repo root から作成する。
- [ ] 第一候補は `git archive` を使う。
- [ ] 手動 zip を作る場合も、`target/` / `*.war` / `__MACOSX` / `.DS_Store` / `Thumbs.db` を含めない。
- [ ] archive 生成後に `zipinfo -1` で禁止パターンを再検査する。

```bash
git archive --format=zip --output /tmp/OpenDolphinNext-clean.zip HEAD
```

```bash
zipinfo -1 /tmp/OpenDolphinNext-clean.zip | \
  rg '(^|/)target(/|$)|\.war$|(^|/)__MACOSX(/|$)|(^|/)\.DS_Store$|(^|/)Thumbs\.db$' && exit 1 || true
```

## 補足
- `check-no-generated-artifacts.sh` は git 管理下の tracked / untracked の両方を検査し、commit 済み生成物でも fail させる。
- `check-no-direct-runtime-lookup.sh` は `ServerConfigurationResolver.java` 以外の direct runtime lookup を許可しない。

## リリース判定
- [ ] すべての必須項目が完了した。
- [ ] 未完了項目がある場合はリリースを見送る。
