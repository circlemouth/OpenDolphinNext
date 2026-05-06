---
name: full-stack-verify-web-server
description: Run lint/typecheck/test/build for web-client and test/build/static analysis for server-modernized in one command and summarize pass/fail.
---

# Full Stack Verify (web-client + server-modernized)

`web-client/` と `server-modernized/` の検証コマンドをまとめて実行する。

## 実行コマンド

```bash
.codex/skills/full-stack-verify-web-server/scripts/run.sh
```

## 実行内容
- `web-client/`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test -- --runInBand`（存在時）
  - `npm run build`
- `server-modernized/`
  - `./gradlew test`
  - `./gradlew build -x test`
  - `./gradlew checkstyleMain checkstyleTest`（存在時）

## 出力
- `tmp/full-stack-verify-report.md`
- `tmp/full-stack-verify/*.log`

## 注意事項
- 依存未導入やCI専用設定が必要な場合は失敗理由を明記し、再実行手順を報告する。
