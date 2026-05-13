# ORCA UNKNOWN 状態運用 Runbook

## 1. UNKNOWNとは

UNKNOWNは、ORCA送信結果が成功とも失敗とも判定できない状態である。

例:

- 通信断
- timeout
- ORCAレスポンス欠落
- ORCAレスポンス解析失敗
- ORCA側登録有無の照合不能
- 他端末処理中
- 証明書異常
- 認証失敗後の中途状態
- request送信済みだがresponse未確認

UNKNOWNは成功ではない。

状態名、UNKNOWN分類、reconciliation status、UI向けの安全なDTO境界は [../contracts/orca-ledger-and-unknown-state.md](../contracts/orca-ledger-and-unknown-state.md) を正本とする。担当者、確認期限、再送/手動照合判断の運用手順は [../runbooks/orca-unknown-resolution.md](../runbooks/orca-unknown-resolution.md) を使用する。

## 2. 禁止事項

UNKNOWN状態で次をしてはならない。

- 登録済み表示
- 会計済み表示
- 反映済み表示
- 診療録確定扱い
- 処方確定扱いの変更
- 自動再送
- 自動取消
- ORCA側情報の無断上書き

## 3. 解消手順

1. 対象患者、ORCA患者番号、ORCA受付ID、診療日、診療科、保険組合せを確認する。
2. 元送信request hashとidempotency keyを確認する。
3. `orca_operation`、`orca_transmission`、`orca_response_summary`、`orca_reconciliation_result` と central audit trace id を確認する。
4. ORCA側を再取得する。
5. OpenDolphinNext側の送信候補とORCA側登録内容を照合する。
6. 次のいずれかに分類する。
   - ORCA登録あり
   - ORCA登録なし
   - ORCA登録ありだが差分あり
   - ORCA側のみ情報あり
   - なお照合不能
7. 二重送信リスクを評価する。
8. 再送、取消、手動修正、保留のいずれかを選ぶ。
9. 操作者、判断理由、照合結果を監査ログに残す。
10. UI状態を更新する。

再送は同じ logical operation の追加 `orca_transmission` として記録する。request hash が変わる場合は、既存 operation の再送ではなく、訂正または新規候補作成の監査 event を先に作る。`reconciliation_status=PENDING|BLOCKED|UNKNOWN|NEEDS_REVIEW|CONFLICT|UNMATCHED` のまま自動再送してはならない。

## 4. UI表示

UNKNOWN状態は、患者画面、診療録画面、処方画面、会計送信画面で隠さず表示する。

表示する内容:

- UNKNOWNであること
- 成功扱いではないこと
- 最終送信日時
- 対象API
- 対象患者
- 対象受付
- 次に必要な操作
- 再取得・照合・手動確認の導線

## 5. 監査ログ

UNKNOWN発生時と解消時に監査ログを残す。

記録する項目:

- 操作者
- 対象患者
- 対象診療録
- 対象処方
- ORCA患者番号
- ORCA受付ID
- 送信API
- idempotency key
- request hash
- response hash
- 発生理由
- UNKNOWN分類
- 照合結果
- central audit trace id
- 解消操作
- 解消日時

## 6. テスト観点

- 通信断でUNKNOWNになること
- timeoutでUNKNOWNになること
- UNKNOWNが成功表示されないこと
- UNKNOWN中に二重送信できないこと
- 再取得・照合後だけ状態遷移すること
- UNKNOWN発生・解消が監査ログに残ること
- 同一 idempotency key の再試行が operation を増やさず transmission だけ追加すること
- ORCA URL、Basic認証、証明書情報、raw ORCA body が ledger / audit / log / bundle に残らないこと
- UIに患者識別情報と次の操作が表示されること
