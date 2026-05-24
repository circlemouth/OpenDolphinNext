# 現在の状態

## 実装済み

- 現行の実装対象は `web-client/` と `server-modernized/` です。
- Web クライアントには `verify:web-guard`、`typecheck`、`test:ci`、`build`、`ci` が用意されています。
- Server 側には sibling module を含めた Maven ビルド入口 `pom.server-modernized.xml` があります。
- ローカル起動用に `setup-modernized-env.sh`、最小 smoke 用に `web-client/scripts/runtime-ready-smoke.mjs` があります。

## 未検証

- live ORCA 接続を使う実運用相当の検証結果は、この最小説明セットには含めていません。
- production secrets、外部設定、GitHub 側の required checks など repo 外の状態は、このリポジトリだけでは確定できません。
- ローカル環境での full gate 実行結果は、都度の RUN_ID と証跡で確認する前提です。

## 未完了

- release-ready 判定は、コードの存在だけでは完了しません。
- 実運用前には Web / Server の full gate、runtime smoke、必要な外部連携確認を別途実行する必要があります。

## 注意点

- このリポジトリは電子カルテと ORCA 連携を前提にしており、通常の Web アプリより安全境界の制約が強い構成です。
- 旧 Java クライアントと旧サーバー実装は現行構成に含めません。
