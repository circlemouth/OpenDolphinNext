# ORCA連携 Safety Contract

## 1. 基本原則

ORCA連携は必ずサーバー側アダプタを経由する。
Web clientからORCA APIを直接呼ばない。

ORCA正本情報はOpenDolphinNext側で独立正本化しない。

## 2. 使用するAPI系統

原則として次を使う。

| 領域 | API |
|---|---|
| 患者基本情報取得 | patientgetv2 |
| 患者作成・更新 | patientmodv2 |
| 受付 | acceptmodv2, acceptlstv2 |
| 病名取得 | diseasegetv2?class=01 |
| 病名追加・変更・削除・転帰更新 | diseasev3 |
| 診療行為・処方・算定候補送信 | medicalmodv2 |
| 会計・収納・帳票・請求関連 | ORCA公式API経由の参照cache/snapshot |

候補検索・入力補助用の薬剤、点数、コメント、部位、用法、材料、検査、保険者、住所、入力セット、相互作用、病名候補は OpenDolphin local master cache / projection を使う。これは ORCA official API の代替正本ではなく、ORCA送信成功、会計反映、病名正本、患者正本の根拠にしてはならない。

## 3. 禁止方式

- CLAIM連携への新規依存
- diseasev2への新規依存
- ORCA DB直接参照
- ORCA DB直接更新
- production / normal dev master search で `ORCADS`、`ORCA_DB_*`、`jma-receipt-docker-db-1` を必須化すること
- Web clientから生ORCA pathへ到達するproxy
- ORCA認証情報のブラウザ露出
- ORCAレスポンス受信前の成功扱い
- local interaction master cache の未インポート・取得不能を「相互作用なし」や「安全確認済み」と扱うこと

## 4. ORCA送信で保存する情報

- 操作者
- 対象患者
- 対象診療録
- 対象処方
- ORCA患者番号
- ORCA受付ID
- 診療日
- 診療科
- 担当医
- 保険組合せ
- 送信API
- 送信条件
- idempotency key
- request hash
- response hash
- ORCA Api_Result
- ORCA警告
- ORCAエラー
- ORCA不一致
- ORCA側のみ存在する情報
- 送信状態
- UNKNOWN状態
- 再送履歴
- 照合結果
- 監査ログID

## 5. 送信状態

- DRAFT
- READY_TO_SEND
- SENDING
- SENT
- ORCA_ACCEPTED
- ORCA_WARNING
- ORCA_REJECTED
- ORCA_UNMATCHED
- UNKNOWN
- NEEDS_REVIEW
- RETRY_REQUESTED
- CANCEL_REQUESTED
- CANCELLED

UNKNOWNは成功扱いしない。
ORCAレスポンスを受け取る前に成功扱いしない。
通信断、認証失敗、証明書異常、他端末使用中は区別する。

## 6. 冪等性

ORCA送信には必ずidempotency keyを持たせる。

同一患者、同一受付、同一診療日、同一診療録、同一処方、同一送信内容の重複送信を防ぐ。

## 7. 再送

再送時には次を保存する。

- 再送理由
- 再送者
- 再送日時
- 元送信ID
- 新送信ID
- 差分
- ORCA照合結果

## 8. ORCA警告・不一致

ORCA警告、不一致、ORCA側のみ存在する情報は、保存し、UIで表示し、監査ログに残す。

警告や不一致を単なる成功として扱ってはならない。

## 9. Web client 境界

Web clientはORCA APIを直接叩かない。

禁止する露出:

- ORCA接続URL
- Basic認証
- クライアント証明書
- 証明書パスワード
- ORCA API token
- ORCA DB接続情報

Vite proxyや開発proxyでも、生ORCA pathをブラウザから到達可能にしない。

## 10. レビュー時の危険シグナル

- `api01rv2`, `orca22`, `api21` が web-client runtime source に出る
- `Basic`, `ORCA_API_PASSWORD`, certificate passwordがbrowser bundleへ入る
- UNKNOWNを `registered`, `accepted`, `completed`, `billed` に変換する
- warning/unmatchを捨てるDTO
- retry時にidempotency keyが変わる、または未記録
- ORCA送信後に再取得・照合なしで会計済み表示する
