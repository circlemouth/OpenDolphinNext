# OpenDolphinNext 正本境界仕様

## 1. 目的

この文書は、OpenDolphinNext と ORCA / WebORCA の正本境界を定義する。

目的は次のとおり。

- ORCA正本情報をOpenDolphinNext側で独立正本化しない
- OpenDolphinNext正本である診療録・処方指示をORCA結果で無断上書きしない
- cache、snapshot、candidate、audit logを正本と混同しない
- 患者取り違え、二重送信、監査不能を防ぐ

## 2. 基本原則

ORCA / WebORCA を正本とする情報は、OpenDolphinNext 側で独立正本として作成、更新、削除してはならない。

OpenDolphinNext 側に保存できる ORCA由来情報は、次に限定する。

- 表示キャッシュ
- 診療時点スナップショット
- 送信候補
- ORCA送信リクエスト
- ORCAレスポンス
- ORCA警告
- ORCAエラー
- ORCA不一致
- UNKNOWN状態
- 照合結果
- 監査ログ

## 3. ORCA / WebORCA 正本

| 領域 | 正本 | OpenDolphinNextで保持できるもの |
|---|---|---|
| 患者番号 | ORCA | 対応ID、表示cache、snapshot |
| 患者基本情報 | ORCA | 表示cache、診療時点snapshot |
| 保険情報 | ORCA | 表示cache、診療時点snapshot |
| 公費情報 | ORCA | 表示cache、診療時点snapshot |
| 保険組合せ | ORCA | 表示cache、診療時点snapshot |
| 受付 | ORCA | 受付ID、診療日、診療科、担当医、snapshot |
| 病名 | ORCA | 表示cache、送信候補、diseasev3結果、警告、不一致 |
| 診療行為 | ORCA | 送信候補、medicalmod結果、照合結果 |
| 算定 | ORCA | 送信候補、ORCAレスポンス、表示cache |
| 会計 | ORCA | 表示cache、snapshot |
| 収納 | ORCA | 表示cache、snapshot |
| 領収 | ORCA | 表示cache、snapshot |
| レセプト | ORCA | 表示cache、snapshot |
| 請求関連情報 | ORCA | 表示cache、snapshot |

## 4. OpenDolphinNext 正本

| 領域 | 正本 | 要件 |
|---|---|---|
| 診療録本文 | OpenDolphinNext | 確定後直接上書き禁止 |
| SOAP | OpenDolphinNext | 確定後直接上書き禁止 |
| 所見 | OpenDolphinNext | 確定後直接上書き禁止 |
| 医師判断 | OpenDolphinNext | 確定者・確定日時必須 |
| 患者説明内容 | OpenDolphinNext | 確定後直接上書き禁止 |
| 処方指示 | OpenDolphinNext | 構造化保存、確定後直接上書き禁止 |
| 処方変更・中止・取消 | OpenDolphinNext | 履歴追加 |
| 添付文書 | OpenDolphinNext | 確定後直接上書き禁止 |
| 診療録確定履歴 | OpenDolphinNext | append-only |
| 訂正・追記・取消履歴 | OpenDolphinNext | append-only |
| ORCA送信候補 | OpenDolphinNext | ORCA正本ではないことを明示 |
| ORCA連携ログ | OpenDolphinNext | request/response/warning/error/unmatchを保存 |

## 5. 禁止事項

以下は禁止する。

- local患者CRUDを本番到達可能にすること
- local病名CRUDを本番到達可能にすること
- ORCA正本情報をlocal tableで独立更新すること
- ORCA DB直接参照
- ORCA DB直接更新
- CLAIM連携への新規依存
- diseasev2への新規依存
- ORCA送信結果で診療録本文を無断変更すること
- ORCA送信結果で処方指示を無断変更すること
- ORCA送信成功だけで診療録確定扱いすること
- 診療録確定だけでORCA会計済み扱いすること

## 6. cache仕様

ORCA由来cacheには、可能な限り次を保存する。

- sourceSystem
- sourceApi
- fetchedAt
- fetchedBy
- ORCA患者番号
- ORCA受付ID
- 診療日
- 診療科
- 担当医
- 保険組合せ
- 取得条件
- payload hash
- cacheStatus

cacheは正本ではない。
cache更新はORCA正本更新ではない。

## 7. snapshot仕様

診療録確定時点のsnapshotは不変とする。

snapshotには少なくとも次を含める。

- 患者基本情報snapshot
- 受付snapshot
- 保険snapshot
- 公費snapshot
- 保険組合せsnapshot
- 病名snapshot
- 処方指示snapshot
- ORCA送信候補snapshot
- ORCA警告・不一致snapshot

過去snapshotは、ORCA側で情報が変わっても上書きしない。

chart finalize snapshot の詳細契約は `docs/contracts/chart-finalize-snapshot.md` を正本とする。ORCA 取得不能、通信断、認証失敗、UNKNOWN は受付なし理由ではなく snapshot 欠落として扱い、完全 snapshot が保存されたかのように記録してはならない。

## 8. レビュー時の確認ポイント

- そのtable/APIは正本、cache、snapshot、candidate、audit logのどれか。
- ORCA正本情報をlocalで独立更新できないか。
- OpenDolphinNext正本がORCAレスポンスで上書きされないか。
- sourceSystem/sourceApi/fetchedAtがあるか。
- ORCA送信失敗、警告、不一致、UNKNOWNが保存・表示・監査されるか。
