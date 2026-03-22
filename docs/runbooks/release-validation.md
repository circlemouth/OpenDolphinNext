# Release Validation Runbook

## 目的
本番投入前に、コード・文書・設定・テスト・監視が同じ契約で揃っていることを確認する。

## 事前確認
- [ ] `README.md` のリンクが存在する。
- [ ] `docs/` 以下の契約文書が今回の変更を反映している。
- [ ] `config/server-modernized.env.sample` が今回の設定変更を反映している。
- [ ] `target/` や WAR がレビュー対象に含まれていない。

## 静的確認コマンド
```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am clean verify
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-config-contract.sh
bash server-modernized/tools/ci/check-no-direct-runtime-lookup.sh
bash server-modernized/tools/ci/check-no-runtime-ddl.sh
bash server-modernized/tools/ci/check-persistence-entities.sh
bash server-modernized/tools/ci/check-no-generated-artifacts.sh
```

## 期待結果
- [ ] Surefire が成功する。
- [ ] Failsafe で 1 件以上の統合テストが実行される。
- [ ] CI 補助スクリプトがすべて成功する。

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

## リリース判定
- [ ] すべての必須項目が完了した。
- [ ] 未完了項目がある場合はリリースを見送る。
