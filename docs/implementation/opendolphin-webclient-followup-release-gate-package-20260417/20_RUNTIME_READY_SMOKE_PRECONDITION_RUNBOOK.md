# runtime-ready-smoke precondition closure runbook

## 目的
`cd web-client && node scripts/runtime-ready-smoke.mjs` の失敗を、実装不備と決め打ちせず、まず backend 前提未充足かどうかを repo 証拠で閉じる。
現時点の report では、`127.0.0.1:9080` への `ECONNREFUSED` が原因とされている。

## 既知事実
- 現在の失敗は `127.0.0.1:9080` への接続拒否
- report では implementation bug ではなく backend 前提未充足と判断されている
- ただし、backend を起動しても同じ失敗が続くなら、この判断は reopen する

## 手順
1. repo で `runtime-ready-smoke.mjs` の接続先と必要前提を確認する
2. repo で backend の起動方法、または smoke 前提の起動手順を確認する
   - start command は repo 証拠で確認する
   - invent しない
3. backend を前提どおりに起動してから、同じ command を再実行する
4. pass した場合
   - 「precondition closure」で記録する
   - code change は不要
5. backend 起動後も fail する場合
   - `code/integration blocker` に昇格する
   - 接続先、env、baseUrl、port、依存サービス前提のどこがずれているかを repo 証拠で再整理する

## reopen 条件
- backend 起動後も `ECONNREFUSED` が続く
- script 側の target host/port が stale である証拠が出る
- smoke が現在の起動方式や env と噛み合っていない証拠が出る

## 禁止事項
- backend を起動せず script bug と断定すること
- repo に証拠のない start command や health endpoint を invent すること
- smoke script を pass させるためだけに wait や bypass を足すこと
- fixed premise を崩す変更

## 記録フォーマット
- script_target
- required_preconditions_from_repo
- actual_backend_launch_method_used
- rerun_result
- reopened_as_code_issue_or_not
