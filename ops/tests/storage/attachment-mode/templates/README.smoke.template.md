# 添付ファイル既存スタック検証ログ (RUN_ID={{RUN_ID}})

## 1. 実施サマリ
- RUN_ID: {{RUN_ID}}
- MODE_LABEL: {{MODE_LABEL}}
- 参照手順: `ops/tests/storage/attachment-mode/smoke_existing_stack.sh`
- WildFly 既存スタック: (例) `server-modernized-dev`（docker 再構築なし）
- 設定投入パス: `/opt/jboss/config/attachment-storage.yaml`

## 2. 前段確認
- [ ] `load_config.sh --mode <database|s3>` を用いて Secrets を差し替え済み
- [ ] `tmp/attachment-mode/minio.env` を source し、MinIO/S3 シークレットをシェルへ展開
- [ ] `curl -sf -H userName:<SYSAD> -H password:<SYSAD_MD5> http://localhost:9080/openDolphin/resources/dolphin` でヘルス確認
- [ ] `artifacts/parity-manual/attachments/{{RUN_ID}}/README.md` を本テンプレで作成

## 3. 実行ログ貼付
1. `MODE_LABEL={{MODE_LABEL}}` で `smoke_existing_stack.sh` を実行。
2. `logs/` フォルダへ HTTP レスポンス、docker compose logs、MinIO mc ログを保存。
3. `hashes/` へアップロード/ダウンロードの SHA-256 を記録し、差分が無いことを確認。

```
例:
MODE_LABEL=manual \
  SYSAD_USER_NAME=... SYSAD_PASSWORD=... \
  bash ops/tests/storage/attachment-mode/smoke_existing_stack.sh \
    --output-root artifacts/parity-manual/attachments \
    --sample-file ops/tests/storage/attachment-mode/payloads/sample-attachment.txt
```

## 4. 結果サマリ
- DB モード: (例) `OK - 3 files uploaded/downloaded`
- S3 モード: (例) `NG - MinIO 認証エラー` → `logs/minio.txt` 参照
- 追加メモ: (未実施/ブロッカーなどを記載)

## 5. 次アクション
- [ ] `docs/runbooks/release-validation.md` の storage 関連確認に沿って結果を反映
- [ ] 必要なら current ticket / PR comment へ RUN_ID 単位で追記
- [ ] `artifacts/parity-manual/attachments/{{RUN_ID}}/` へのリンクを報告チャネルへ共有
