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
mvn clean verify
python tools/ci/check-doc-links.py
python tools/ci/check-config-contract.py
python tools/ci/check-no-direct-runtime-lookup.py
python tools/ci/check-no-runtime-ddl.py
python tools/ci/check-persistence-entities.py
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
- [ ] runtime DDL が存在しない。
- [ ] Flyway migration のみで必要テーブルが揃う。
- [ ] sibling source 依存なしで build できる。

## リリース判定
- [ ] すべての必須項目が完了した。
- [ ] 未完了項目がある場合はリリースを見送る。
