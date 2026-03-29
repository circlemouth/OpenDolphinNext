# ORCA-05/06/08 Playwright E2E
- RUN_ID: `20251124T181500Z`（親 `20251124T000000Z`）
- シナリオ表: `tests/e2e/orca-master.scenarios.md`（MSW 正常/422、Live 並列表記、レジリエンス fault 要約付き）。

## プロファイル切替
- **MSW (デフォルト)**: 追加設定不要。`dataSource=snapshot` を前提にシナリオ実行。
- **Live**: 環境変数 `VITE_DEV_PROXY_TARGET=http://<stage-host>:8000` を指定して起動。Playwright も同環境変数を参照し、テスト内で `profile==='live'` のブロックが有効になる。
- RUN_ID は `RUN_ID=YYYYMMDDThhmmssZ` 形式で上書き可（監査メタ・証跡パスに埋め込む）。

## 実行コマンド
```bash
# MSW プロファイル（既定）
RUN_ID=20251124T181500Z npx playwright test tests/e2e/orca-master.spec.ts

# Live プロファイル（接続先が用意できた場合）
RUN_ID=20251124T181500Z VITE_DEV_PROXY_TARGET=http://100.102.17.40:8000 \
  npx playwright test tests/e2e/orca-master.spec.ts
```

## 期待成果物・保存先
- HAR / コンソール / 監査メタ抽出: `artifacts/api-stability/<RUN_ID>/e2e/orca-master/` に `har/`, `console/`, `audit/` を作成して保存する。
- fault 名はテスト側の scenario id をそのままファイル名に含める（例: `db-down-20251124T181500Z-har.har`）。

## メモ
- 422 バリデーション/Live シナリオは `test.skip` または `test.fixme` でスケルトン状態。UI セレクタが確定したら解除して実装する。
- 監査メタ検証は `tests/e2e/helpers/orcaMaster.ts` の `expectAuditMeta` を使用。UI/PerfLog 取り込みは `recordPerfLog` を適宜呼び出す。
