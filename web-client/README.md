# OpenDolphinNext Web Client

`web-client/` は OpenDolphinNext の現行 Web クライアントです。React / Vite / TypeScript で構成され、患者、受付、カルテ、管理、ORCA 状態表示などのブラウザ UI を提供します。

## 主要コマンド

```bash
npm run dev
npm run verify:web-guard
npm run typecheck
npm run test:ci
npm run build
npm run ci
```

`npm run ci` は `verify:web-guard`、`typecheck`、`test:ci`、`build` をまとめて実行します。

## 境界

- ブラウザは ORCA に直接接続しません。
- ORCA URL、Basic 認証、証明書、証明書パスワードはブラウザ側へ置きません。
- 患者文脈は URL や browser storage を正本にしません。
- 認可、監査、ORCA 接続先の決定は server 側の責務です。

全体説明は [docs/README.md](../docs/README.md) から参照してください。
