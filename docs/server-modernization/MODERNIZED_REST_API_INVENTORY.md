# モダナイズ版サーバー REST API インベントリ

- 作成日: 2026-XX-XX
- 更新日: 2026-01-26（CLAIM 廃止反映）
- 対象: `server-modernized/src/main/java/open/dolphin/**` および `open/orca/rest` に実装されている Jakarta EE ベースのモダナイズ版サーバー API。
- 前提: 現行実装は旧サーバー互換のため `userName` / `password(MD5)` / `clientUUID` ヘッダーを引き続き要求し、施設 ID はアプリケーションサーバーの `RemoteUser` から解決する。JSON シリアライザは Jackson 2.x だが、戻り値の多くは後方互換のため `application/octet-stream` を指定している。
- 注意: 本一覧はモダナイズ工程で Jakarta API へ移行済みの REST リソースを網羅する。仕様更新時は当ファイルと `docs/server-modernization/rest-api-modernization.md` の整合を保つこと。
- 補足: ORCA モダナイズ REST（/api/orca/master/*, /api/orca/tensu/*）の最新サマリは `src/webclient_modernized_bridge/03_ギャップ解消方針とUI影響分析.md` §8（RUN_ID=`20251123T135709Z`）を参照。

> **【重要】**
> このドキュメントは、モダナイズが**完了した**APIのみを掲載しています。
> `legacy-server-modernization-checklist.md`（Archive: `docs/archive/2025Q4/server-modernization/legacy-server-modernization-checklist.md`）の注記にある通り、まだ多数のAPIが未移植の状態です。開発に着手する際は、必ず新旧のAPIインベントリを比較し、移植対象かどうかを確認してください。

## CLAIM関連（廃止/未登録）
CLAIM 依存の REST エンドポイントは 2026-01-26 時点で server-modernized に登録されません。
- `GET /serverinfo/claim/conn`
- `POST /schedule/document`
- `POST /karte/diagnosis/claim`
- `PUT /karte/claim`
- `/api/orca/claim/outpatient/*`
- `/claim/conn`

## 1. 認証・施設・システム情報

### UserResource (`/user`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/user/{userId}` | ログインユーザー本人の情報取得 | `userName` ヘッダーと一致しない場合は `null` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/UserResource.java†L35-L59】 |
| GET | `/user` | 施設所属ユーザー一覧取得 | 管理者権限を `UserServiceBean#isAdmin` で検証。【F:server-modernized/src/main/java/open/dolphin/rest/UserResource.java†L61-L88】 |
| POST | `/user` | ユーザー新規登録 | 施設 ID とロール参照を再構築して保存。【F:server-modernized/src/main/java/open/dolphin/rest/UserResource.java†L90-L132】 |
| PUT | `/user` | ユーザー情報更新 | 管理者または本人のみ更新可、権限昇格は追加チェック。【F:server-modernized/src/main/java/open/dolphin/rest/UserResource.java†L134-L183】 |
| DELETE | `/user/{userId}` | ユーザー削除 | 管理者のみ。戻り値なし。【F:server-modernized/src/main/java/open/dolphin/rest/UserResource.java†L185-L205】 |
| PUT | `/user/facility` | 施設情報更新 | `UserServiceBean#updateFacility` を呼び出し件数を返却。【F:server-modernized/src/main/java/open/dolphin/rest/UserResource.java†L207-L223】 |
| GET | `/user/name/{userId}` | ユーザー表示名取得 | 施設認証不要、単純なテキスト応答。【F:server-modernized/src/main/java/open/dolphin/rest/UserResource.java†L226-L230】 |

### SystemResource (`/dolphin`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/dolphin/activity/{yyyy,MM,count}` | 月次活動ログ取得 | `ActivityServiceBean#getActivities` を呼び出す。【F:server-modernized/src/main/java/open/dolphin/rest/SystemResource.java†L70-L102】 |
| POST | `/dolphin/license` | Cloud Zero 向けライセンス登録/検証 | 成功時 `0`、エラーコードは `2`〜`4`。【F:server-modernized/src/main/java/open/dolphin/rest/SystemResource.java†L113-L155】 |
| GET | `/dolphin/cloudzero/sendmail` | CloudZero 月次メール送信 | ライセンスログを出力するのみ。【F:server-modernized/src/main/java/open/dolphin/rest/SystemResource.java†L174-L196】 |

### ServerInfoResource (`/serverinfo`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/serverinfo/jamri` | JMARI コード取得 | `custom.properties` から読み込み。【F:server-modernized/src/main/java/open/dolphin/rest/ServerInfoResource.java†L33-L53】 |
| GET | `/serverinfo/cloud/zero` | Cloud Zero 設定取得 | `SystemServiceBean#getCloudZero` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/ServerInfoResource.java†L76-L95】 |

## 2. 患者・受付・スケジュール

### PatientResource (`/patient`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/patient/name/{name}` | 氏名検索 | 施設内患者を部分一致で取得。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L34-L52】 |
| GET | `/patient/kana/{kana}` | カナ検索 | カナ列で検索。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L53-L72】 |
| GET | `/patient/digit/{digit}` | 生年月日/電話番号検索 | 数字列で検索。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L73-L92】 |
| GET | `/patient/id/{pid}` | 患者 ID 検索 | 単一患者を返却。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L93-L112】 |
| GET | `/patient/pvt/{yyyymmdd}` | 日次来院患者取得 | `patientServiceBean#getPatientsByPvtDate` を利用。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L113-L134】 |
| GET | `/patient/documents/status` | 仮保存カルテ保有患者 | `patientServiceBean#getTmpKarte`。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L135-L156】 |
| POST | `/patient` | 患者登録 | 施設 ID を付与し保存。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L157-L182】 |
| PUT | `/patient` | 患者更新 | `patientServiceBean#update` を呼び出し件数返却。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L183-L210】 |
| GET | `/patient/count/{query}` | 検索件数取得 | 1000件超過時の確認用。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L211-L228】 |
| GET | `/patient/all` | 施設内患者全件取得 | 大量データ応答に留意。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L229-L248】 |
| GET | `/patient/custom/{query}` | カスタム検索（傷病名など） | `patientServiceBean#getCustom` を利用。【F:server-modernized/src/main/java/open/dolphin/rest/PatientResource.java†L249-L263】 |

### PVTResource (`/pvt`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/pvt/{params}` | 受付一覧取得 | パラメータ配列で医師/受付/予約期間を指定。【F:server-modernized/src/main/java/open/dolphin/rest/PVTResource.java†L32-L79】 |
| POST | `/pvt` | 受付登録 | 保険情報の親参照を再構築して保存。【F:server-modernized/src/main/java/open/dolphin/rest/PVTResource.java†L81-L121】 |
| PUT | `/pvt/{pvtPK,state}` | 受付ステータス更新 | 更新件数を返却。【F:server-modernized/src/main/java/open/dolphin/rest/PVTResource.java†L123-L142】 |
| PUT | `/pvt/memo/{pvtPK,memo}` | 受付メモ更新 | 空文字にも対応。【F:server-modernized/src/main/java/open/dolphin/rest/PVTResource.java†L144-L161】 |
| DELETE | `/pvt/{pvtPK}` | 受付削除 | 戻り値なし。【F:server-modernized/src/main/java/open/dolphin/rest/PVTResource.java†L163-L175】 |

### ScheduleResource (`/schedule`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/schedule/pvt/{params}` | 予約/受付一覧取得 | 医師別または日付のみで抽出。【F:server-modernized/src/main/java/open/dolphin/rest/ScheduleResource.java†L32-L70】 |
| DELETE | `/schedule/pvt/{pvtPK,ptPK,yyyy-MM-dd}` | 予約削除 | 日付は `yyyy-MM-dd` 指定。【F:server-modernized/src/main/java/open/dolphin/rest/ScheduleResource.java†L106-L136】 |

### AppoResource (`/appo`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| PUT | `/appo` | 予約一覧更新 | `AppoList` JSON を受け取り一括更新件数を返却。【F:server-modernized/src/main/java/open/dolphin/rest/AppoResource.java†L31-L55】 |

## 3. カルテ・診療記録

### KarteResource (`/karte`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/karte/pid/{pid,from}` | 患者 ID 指定カルテ取得 | 施設 ID でフィルタ。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L46-L74】 |
| GET | `/karte/{patientPk,from}` | 患者 PK 指定カルテ取得 | 施設フィルタなし。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L76-L100】 |
| GET | `/karte/docinfo/{karteId,from,includeModified}` | 文書メタ情報一覧 | 変更済み含有フラグ対応。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L102-L138】 |
| GET | `/karte/documents/{docIds}` | 複数文書詳細取得 | 添付バイナリを `null` に差替え。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L140-L176】 |
| POST | `/karte/document` | 新規カルテ保存 | モジュール/シェーマ/添付の親参照を再構築。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L178-L241】 |
| POST | `/karte/document/pvt/{pvtPK[,state]}` | 受付紐付け保存 | 保存後に受付ステータスを更新。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L243-L290】 |
| PUT | `/karte/document/{id}` | 文書タイトル更新 | `DocumentServiceBean#updateTitle`。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L292-L320】 |
| DELETE | `/karte/document/{id}` | 文書削除 | 削除済み文書 ID を `StringList` で返却。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L322-L362】 |
| GET | `/karte/modules/{karteId,entity,from,to,...}` | モジュール履歴取得 | 期間複数指定に対応。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L364-L410】 |
| GET | `/karte/iamges/{karteId,from,to,...}` | 画像メタ情報取得 | 旧綴り `iamges` を継承。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L412-L454】 |
| GET | `/karte/image/{id}` | 単一画像取得 | `SchemaModelConverter` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L456-L486】 |
| GET | `/karte/diagnosis/{karteId,from[,activeOnly]}` | 病名一覧取得 | `activeOnly` オプション対応。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L488-L526】 |
| POST | `/karte/diagnosis` | 病名新規登録 | 追加 ID 群を返却。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L577-L606】 |
| PUT | `/karte/diagnosis` | 病名更新 | 更新件数返却。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L608-L637】 |
| DELETE | `/karte/diagnosis/{ids}` | 病名削除 | カンマ区切り ID を削除。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L639-L668】 |
| GET | `/karte/observations/{karteId,observation,phenomenon[,date]}` | 観察値取得 | オプション日付あり。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L670-L714】 |
| POST | `/karte/observations` | 観察値登録 | 追加 ID を返却。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L716-L744】 |
| PUT | `/karte/observations` | 観察値更新 | 更新件数返却。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L746-L774】 |
| DELETE | `/karte/observations/{ids}` | 観察値削除 | カンマ区切り ID。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L776-L804】 |
| PUT | `/karte/memo` | 患者メモ更新 | `PatientMemoModel` を保存。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L806-L832】 |
| GET | `/karte/freedocument/{patientId}` | フリードキュメント取得 | `facilityPatId` を施設 ID 付きで解決。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L834-L858】 |
| PUT | `/karte/freedocument` | フリードキュメント更新 | `facilityPatId` を上書き。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L860-L886】 |
| GET | `/karte/appo/{karteId,from,to,...}` | 予約履歴取得 | 日付範囲複数指定対応。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L888-L924】 |
| GET | `/karte/moduleSearch/{karteId,from,to,entity...}` | Entity 単位モジュール検索 | `documentServiceBean#getModuleSearch`。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L953-L998】 |
| GET | `/karte/docinfo/all/{karteId}` | 全文書取得 | 添付バイナリを `null` に差替え。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L1000-L1032】 |
| GET | `/karte/attachment/{id}` | 添付ファイル取得 | `AttachmentModel` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/KarteResource.java†L1034-L1060】 |

### LetterResource (`/odletter`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| PUT | `/odletter/letter` | 紹介状などの保存/更新 | `LetterModule` を保存し PK を返却。【F:server-modernized/src/main/java/open/dolphin/rest/LetterResource.java†L38-L78】 |
| GET | `/odletter/list/{karteId}` | 文書一覧取得 | `LetterModuleList` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/LetterResource.java†L80-L112】 |
| GET | `/odletter/letter/{id}` | 文書詳細取得 | `LetterModuleConverter` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/LetterResource.java†L114-L134】 |
| DELETE | `/odletter/letter/{id}` | 文書削除 | `LetterServiceBean#delete` を呼び出し。監査ログ対応は別途実装予定。【F:server-modernized/src/main/java/open/dolphin/rest/LetterResource.java†L136-L144】 |

### StampResource (`/stamp`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/stamp/tree/{userPk}` | 個人スタンプツリー取得 | `StampServiceBean#getTrees` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L33-L52】 |
| PUT | `/stamp/tree` | 個人スタンプツリー保存 | バージョン衝突時は `RuntimeException` を投げる。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L54-L77】 |
| PUT | `/stamp/tree/sync` | 個人ツリー同期保存 | `pk,version` 文字列を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L79-L105】 |
| PUT | `/stamp/tree/forcesync` | 個人ツリー強制同期 | 衝突時も強制的に上書き。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L107-L126】 |
| PUT | `/stamp/published/tree` | 公開ツリー更新 | 公開カタログを更新し最新版を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L138-L164】 |
| PUT | `/stamp/published/cancel` | 公開ツリー取消 | 公開状態を解除しバージョンを返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L166-L187】 |
| GET | `/stamp/published/tree` | 公開ツリー一覧取得 | 施設 ID とグローバル共有を含む。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L189-L217】 |
| PUT | `/stamp/subscribed/tree` | サブスクライブ登録 | サブスク対象のツリー ID を登録。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L219-L249】 |
| DELETE | `/stamp/subscribed/tree/{idPks}` | サブスクライブ解除 | 解除件数を文字列で返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L251-L271】 |
| GET | `/stamp/id/{stampId}` | スタンプ単体取得 | `StampModelConverter` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L278-L291】 |
| GET | `/stamp/list/{stampIds}` | 複数スタンプ取得 | カンマ区切り ID を受け取り一覧を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L293-L313】 |
| PUT | `/stamp/id` | スタンプ保存/更新 | 単体スタンプを保存し ID を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L315-L335】 |
| PUT | `/stamp/list` | スタンプ一括保存 | `StampList` を受け取り保存 ID 群を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L337-L361】 |
| DELETE | `/stamp/id/{stampId}` | スタンプ削除 | 削除件数を返却。削除監査で requestId/traceId と errorMessage を記録。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L363-L374】 |
| DELETE | `/stamp/list/{stampIds}` | スタンプ一括削除 | 複数 ID を削除し件数を返却。【F:server-modernized/src/main/java/open/dolphin/rest/StampResource.java†L376-L391】 |

### ChartEventResource (`/chartEvent`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/chartEvent/subscribe` | 長輪講ポーリングでの購読 | レガシー互換のロングポーリング。【F:server-modernized/src/main/java/open/dolphin/rest/ChartEventResource.java†L48-L91】 |
| PUT | `/chartEvent/event` | チャートイベント送信 | `ChartEventServiceBean#processEvent`。【F:server-modernized/src/main/java/open/dolphin/rest/ChartEventResource.java†L110-L152】 |
| GET | `/chartEvent/dispatch` | 受診者単位のイベント配信 | 旧クライアント互換 API。【F:server-modernized/src/main/java/open/dolphin/rest/ChartEventResource.java†L133-L206】 |

### ChartEventStreamResource (`/chart-events`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/chart-events` | SSE 購読開始 | `clientUUID` と `Last-Event-ID` ヘッダーを検証し `ChartEventSseSupport` へ登録。【F:server-modernized/src/main/java/open/dolphin/rest/ChartEventStreamResource.java†L18-L48】 |

### MmlResource (`/mml`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/mml/document/{param}` | 施設カルテを MML 形式で出力 | `param` に施設 ID と期間を指定。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L27-L51】 |
| GET | `/mml/patient/{param}` | 患者病名を MML 出力 | JSON/MML 双方対応。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L52-L140】 |
| GET | `/mml/patient/list/{param}` | 対象患者一覧 MML 出力 | CSV 形式の ID 群を受け取る。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L80-L118】 |
| GET | `/mml/patient/json/{param}` | 患者 JSON 出力 | `IPatientModel` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L101-L140】 |
| GET | `/mml/disease/list/{param}` | 傷病名一覧 MML 出力 | `DiseaseHelper` を利用。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L116-L154】 |
| GET | `/mml/disease/json/{param}` | 傷病名 JSON 出力 | `RegisteredDiagnosisModelConverter`。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L137-L178】 |
| GET | `/mml/memo/list/{param}` | メモ一覧 MML 出力 | `PatientMemoServiceBean` 連携。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L152-L188】 |
| GET | `/mml/memo/json/{param}` | メモ JSON 出力 | `PatientMemoModelConverter`。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L171-L206】 |
| GET | `/mml/observation/list/{param}` | 観察値 MML 出力 | パラメータは CSV。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L188-L214】 |
| GET | `/mml/observation/json/{param}` | 観察値 JSON 出力 | `ObservationModelConverter` を返却。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L209-L244】 |
| GET | `/mml/karte/list/{param}` | カルテ文書一覧 MML | 添付含む長大レスポンスに注意。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L224-L260】 |
| GET | `/mml/karte/json/{param}` | カルテ文書 JSON | `KarteModel` を JSON で返却。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L262-L307】 |
| GET | `/mml/module/{param}` | モジュール取得 | `param` で種別と ID を指定。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L527-L607】 |
| GET | `/mml/interaction` | 服薬相互作用取得 | ORCA 連携データ。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L771-L846】 |
| GET | `/mml/stampTree/{param}` | スタンプツリー取得 | JSON 文字列を直接返却。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L847-L883】 |
| GET | `/mml/stamp/{param}` | スタンプ取得 | JSON 文字列を返却。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L882-L916】 |
| GET | `/mml/claim/conn` | CLAIM 接続設定取得 | `SystemServiceBean#getClaimConnectionType`。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L996-L1017】 |
| GET | `/mml/serverinfo` | サーバー情報取得 | `SystemServiceBean#getServerInfo` を JSON 返却。【F:server-modernized/src/main/java/open/dolphin/rest/MmlResource.java†L1009-L1030】 |

### NLabResource (`/lab`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/lab/module/{pid,first,max}` | ラボ検査履歴取得 | 分割取得パラメータを CSV で指定。【F:server-modernized/src/main/java/open/dolphin/rest/NLabResource.java†L35-L62】 |
| GET | `/lab/module/count/{pid}` | ラボ検査件数取得 | `nLabServiceBean#getLaboTestCount`。【F:server-modernized/src/main/java/open/dolphin/rest/NLabResource.java†L64-L84】 |
| GET | `/lab/item/{pid,first,max,itemCode}` | ラボ項目別履歴取得 | 項目コード指定。【F:server-modernized/src/main/java/open/dolphin/rest/NLabResource.java†L85-L116】 |
| GET | `/lab/patient/{pid1,pid2,...}` | ラボ検査対象患者取得 | CSV の患者 ID で絞り込み。【F:server-modernized/src/main/java/open/dolphin/rest/NLabResource.java†L117-L149】 |
| POST | `/lab/module` | ラボ検査結果登録 | 関連項目の親参照を再構築して保存。【F:server-modernized/src/main/java/open/dolphin/rest/NLabResource.java†L150-L188】 |
| DELETE | `/lab/module/{moduleId}` | ラボ検査削除 | `nLabServiceBean#deleteLabTest`。【F:server-modernized/src/main/java/open/dolphin/rest/NLabResource.java†L190-L199】 |

## 4. ORCA・外部連携

### OrcaResource (`/orca`)
主に ORCA マスタ・病名・スタンプ連携を担う大規模リソース。代表的なパスは以下の通り。
マスタ未提供分の REST 追加検討時は、ORCA DB 定義書のオフラインアーカイブ（`docs/server-modernization/phase2/operations/assets/orca-db-schema/README.md`）を参照し、正式版（2024-04-26）を基本に項目・型を確認すること。
- 接続備考（RUN_ID=`20251124T080000Z`）: ORCA JDBC は `custom.properties` 直読みから DataSource/Vault 管理へ移行するドラフトを `MODERNIZED_SERVER_GAP_TRACKER_20251116T210500Z.md#orca-07` に記載。REST 実測時も env 経由の DS (`java:/datasources/OrcaDb`) を優先し、`custom.properties` はフォールバック扱いとする。

| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/api/orca/facilitycode` | ORCA 施設コード取得 | `OrcaServiceBean#getFacilityCode`。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L179-L214】 |
| GET | `/api/orca/tensu/shinku/{code}/` | 点数マスタ（新区）取得 | 末尾 `/` 付きパスを維持。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L261-L333】 |
| GET | `/api/orca/tensu/name/{keyword}/` | 名称検索 | 大文字小文字を区別しない部分一致。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L338-L422】 |
| GET | `/api/orca/tensu/code/{code}/` | 点数コード検索 | 完全一致検索。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L426-L510】 |
| GET | `/api/orca/tensu/ten/{ten}/` | 点数範囲検索 | `ten` 文字列を解析。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L502-L587】 |
| GET | `/api/orca/disease/name/{keyword}/` | 傷病名検索 | レガシー病名マスタを返却。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L594-L688】 |
| PUT | `/api/orca/interaction` | 服薬相互作用照会 | `OrcaServiceBean#getInteraction`。Legacy と同一リクエストボディを受け付け、結果は `DragInteractionListConverter` で返却する。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L709-L772】 |
| GET | `/api/orca/general/{code}` | 一般名マスタ取得 | `CodeNamePackConverter` を返却。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L774-L821】 |
| GET | `/api/orca/inputset` | 入力セット一覧取得 | `ModuleListConverter` を返却。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L824-L946】 |
| GET | `/api/orca/stamp/{id}` | ORCA スタンプ取得 | `ModuleListConverter`。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L948-L1113】 |
| GET | `/api/orca/disease/import/{pid}` | ORCA 傷病名取込 | ORCA 側病名を診療録形式に変換。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L1429-L1508】 |
| GET | `/api/orca/disease/active/{pid}` | ORCA 継続傷病名取得 | アクティブな病名のみ返却。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L1580-L1670】 |
| GET | `/api/orca/deptinfo` | 診療科情報一覧 | `OrcaServiceBean#getDeptInfo`。【F:server-modernized/src/main/java/open/orca/rest/OrcaResource.java†L1729-L1786】 |

※ 上記以外にも `/api/orca/tensu/point/` 系の補助エンドポイントが存在するため、要件変更時はソース全体を確認すること。CLAIM 系は廃止/未登録。

### OrcaPatientApiResource / modernized ORCA JSON contracts（2026-03 時点）
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/api01rv2/patientgetv2` | 患者参照（JSON） | `/api/orca/patientgetv2` と `/api/api01rv2/patientgetv2` も同義。`format=json` のみ許可。 |
| POST | `/api/orca/chart-support/medical-mod-v2` | ORCA 診療行為送信（medicalmodv2） | browser は JSON を送信し、server 側で ORCA XML を組み立てる。 |
| POST | `/api/orca/chart-support/medical-mod-v23` | ORCA 診療行為送信（medicalmodv23） | browser は JSON を送信し、server 側で ORCA XML を組み立てる。 |
| POST | `/api/orca/chart-support/income-info` | 収納情報取得 | browser は JSON を送信し、server 側で ORCA XML を組み立てる。 |
| POST | `/api/orca/reports/{type}` | 帳票生成 | `type=prescription|medicinenotebook|karteno1|karteno3|invoicereceipt|statement`。browser は JSON を送信し、server 側で ORCA XML を組み立てる。 |

> `/api/v1/orca/bridge` は 2026-03-15（RUN_ID=`20260315T060323Z`）で削除済み。web-client からの ORCA XML bridge 依存も撤去した。

> 2026-03-11（RUN_ID=20260311T060146Z, P2-06）で以下の XML 専用公開Resourceを削除済み:
> `OrcaAcceptanceListResource` `OrcaSystemManagementResource` `OrcaReportResource` `OrcaDiseaseApiResource` `OrcaMedicalApiResource` `OrcaAdditionalApiResource`

### OrcaClaimOutpatientResource (`/api/orca/claim/outpatient`)
CLAIM 廃止方針により、server-modernized では登録されない。

### OrcaMedicalModV2Resource (`/api/orca/medical/outpatient`)
| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| POST | `/api/orca/medical/outpatient` | 外来医療記録サマリ取得 | PVT から外来データを集計し、`ORCA_MEDICAL_GET` を監査記録。`telemetryFunnelStage=charts_orchestration` を付与。RUN_ID=20251225T231456Z 実測（`src/server_modernized_gap_20251221/06_server_ops_required/Webクライアント_MSW無効化検証.md`）。【F:server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalModV2Resource.java†L37-L136】 |

#### ORCA-08: ORCA マスタ系（Spec-based / MSW 実装済み、UI 実装中）
- RUN_ID=`20251123T135709Z`。サーバー実装は未着手だが、web-client 側で MSW フィクスチャ＋型定義は実装済み（`web-client/src/mocks/fixtures/orcaMaster.ts` ほか）。OrcaOrderPanel の UI 連携は ORCA-04 backlog として実装中。証跡: `docs/server-modernization/phase2/operations/logs/20251123T135709Z-orca-master-gap.md`（artifact スキーマ: `artifacts/api-stability/20251123T130134Z/schemas/orca-master-*.json`）。
- 2025-11-24 追記（RUN_ID=`20251124T073245Z`）: ORCA DB 定義書（正式版 2024-04-26）に沿った項目セットと監査メタを確定。サーバー実装オーナー=Worker-B（暫定）、優先度=P1。ETA: ORCA-05/06=2025-12-06, ORCA-08=2025-12-20。クライアント側は DTO 拡張と Bridge スケルトンを用意済み（`src/webclient_modernized_bridge/04_マスターデータ補完ブリッジ実装計画.md` / `web-client/src/types/orca.ts` / `web-client/src/features/charts/api/orca-api.ts`）。
- 2025-11-24 追記（RUN_ID=`20251124T090500Z`, 親=`20251124T000000Z`）: ORCA-05/06/08 の OpenAPI 断片 draft（paths/components/例レス、監査メタ付き）を `docs/server-modernization/phase2/operations/assets/openapi/orca-master-orca05-06-08-draft.yaml` に追加。web-client 型生成の暫定パイプライン案を同ディレクトリ `README.md` に記載（pnpm dlx openapi-typescript, 出力先 `web-client/src/generated/orca-master.ts`）。サーバー実装着手時は本 draft を基に正式版へ昇格させる。

##### ORCA-08 電子点数表 REST 仕様草案（RUN_ID=`20251124T080000Z`, 親=`20251124T000000Z`）
- エンドポイント案: `GET /api/orca/tensu/etensu/{srycd}`（必須: 診療行為コード）。クエリ: `asOf=YYYYMMDD`（既定=当日）、`tensuVersion`（点数表版、JMA 公表版の文字列）、`includeConflicts=true|false`。`404` は存在なし、`410` は有効期間外、`206` は部分的欠落（off/sample のみ）を返す。
- レスポンス骨子（共通メタ付き DTO）:
  - `srycd`, `effectiveFrom`=`YUKOSTYMD`, `effectiveTo`=`YUKOEDYMD`, `version`=`tensuVersion`, `changedAt`=`CHGYMD`, `dataSource`=`TBL_ETENSU_*`, `runId`.
  - `bundling`: `TBL_ETENSU_1` の `H_TANI{1..3}` / `H_GROUP{1..3}` を配列で返却（unit=`day|month|same|week|surgery` などコード値はそのまま numeric で保持）、`nGroup`=`N_GROUP`, `countConstraint`=`C_KAISU`.
  - `bundlingMembers`: `TBL_ETENSU_2` と `TBL_ETENSU_2_JMA` を統合し、`groupCode`=`H_GROUP`, `srycd`, `specialCondition`=`TOKUREI` を列挙。`exclusions` は `TBL_ETENSU_2_OFF` を `excluded=true` として付与。
  - `specimens`: `TBL_ETENSU_2_SAMPLE` の `sampleCode`=`SAMPLECD`, `seq`=`RENNUM`。
  - `conflicts`: `TBL_ETENSU_3_{1..4}` を `scope=day|month|same|week`、`leftSrycd`=`SRYCD1`, `rightSrycd`=`SRYCD2`, `rule`=`HAIHAN`, `specialCondition`=`TOKUREI` として返却。
  - `additions`: `TBL_ETENSU_4` の `nGroup`, `srycd`, `additionCode`=`KASAN`。
  - `calcUnits`: `TBL_ETENSU_5` の `unitCode`=`TANICD`, `unitName`=`TANINAME`, `maxCount`=`KAISU`, `specialCondition`=`TOKUREI`。
- 監査・フェイルセーフ: 取得時は `asOf` と `version` をリクエスト/レスポンス両方に含め、欠落テーブルがある場合は `partial=true` と `missingTables` を返す。ORCA DB とキャッシュの整合が崩れた場合は HTTP 503 + `retryAfter` を返却する。

| HTTP | パス | 主な処理 | 備考 | 実装状況 |
| --- | --- | --- | --- | --- |
| GET | `/api/orca/master/address?zip=` | 郵便番号から住所 1 件を返却。未一致時は 200/空 body。 | OpenAPI 正式版は 404 `MASTER_ADDRESS_NOT_FOUND` も規定。 | 実装準備中（RUN_ID=`20251124T110000Z`, ETA=2025-12-06, ORCA-06） |
| GET | `/api/orca/master/hokenja?pref=&keyword=&effective=` | 保険者検索（名称/カナ部分一致）。 | `totalCount+items[]` でページング。 | 実装準備中（RUN_ID=`20251124T110000Z`, ETA=2025-12-06, ORCA-06） |
| GET | `/api/orca/master/generic-class?keyword=&effective=&page=&size=` | 薬剤分類ツリー取得。 | `DrugMasterEntry` + 監査メタ必須。 | 実装済み（RUN_ID=`20251219T140028Z`）。`totalCount` と `items` を返却し、`page`/`size` でページング。 |
| GET | `/api/orca/master/generic-price?srycd=&effective=` | 薬価（単一）を返却。未一致時は price=null。 | 404 非採用、200 + null を明記。 | 実装済み（RUN_ID=`20251219T140028Z`）。SRYCD 9 桁バリデーションの 422 応答を追加。 |
| GET | `/api/orca/master/youhou?keyword=&effective=` | 用法マスタ取得。 | 配列返却、監査メタ必須。 | 実装済み（RUN_ID=`20251219T140028Z`）。 |
| GET | `/api/orca/master/material?keyword=&effective=` | 特定器材マスタ取得。 | price 0 許容、ページング対応。 | 実装済み（RUN_ID=`20251219T140028Z`）。 |
| GET | `/api/orca/master/kensa-sort?keyword=&effective=` | 検査分類マスタ取得。 | `kensaSort` 必須、監査メタ必須。 | 実装済み（RUN_ID=`20251219T140028Z`）。 |
| GET | `/api/orca/tensu/etensu?keyword=&category=&asOf=&tensuVersion=&page=&pageSize=` | 電子点数表検索。 | `totalCount+items[]`、404 は `TENSU_NOT_FOUND`。 | 実装準備中（RUN_ID=`20251124T110000Z`, ETA=2025-12-20, ORCA-08） |

### PHRResource (`/20/adm/phr`)
- ADM20 側で PHR 連携の責務を担うが、2025-11-14 時点では RESTEasy へのリソース登録が保留となっており Legacy API 11 件が未公開。`PhrRequestContextExtractor` や `PhrAuditHelper` は用意済みのため、各エンドポイントごとに監査 ID・施設整合チェック・署名付き応答ルールを整理してから公開する必要がある。

#### 欠落エンドポイント整理 (2025-11-14)

| ID | HTTP | パス | レガシー機能 | 必要なモダナイズ側モジュール | 優先度 / 前提条件 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| PHR-01 | GET | `/20/adm/phr/abnormal/{patientId}` | 直近検査から異常値のみを抽出しテキスト出力。 | `PhrDataAssembler`（`PHRContainer` → 異常値 DTO）+ `AMD20_PHRServiceBean` + `PhrAuditHelper` | P0（患者公開情報）。`TouchRequestContextExtractor` による facility / traceId 必須、監査イベント `PHR_ABNORMAL_TEXT` 追加が前提。 | `web.xml` context-param `touch.phr.requiredHeaders`（`X-Facility-Id`, `X-Touch-TraceId`）必須 |
| PHR-02 | PUT | `/20/adm/phr/accessKey` | PHRKey を登録・更新し患者と施設を紐付け。 | `AMD20_PHRServiceBean` + `PhrRequestContextExtractor` + `PhrAuditHelper` | P0（外部利用鍵管理）。`phr_access_key` Flyway 適用と `X-Facility-Id` ヘッダー必須化が条件。 | 同上 |
| PHR-03 | GET | `/20/adm/phr/accessKey/{accessKey}` | アクセスキー末尾照合で PHRKey を検索。 | `PhrDataAssembler` + `PhrAuditHelper` + `TouchErrorResponse` | P0。アクセスキー suffix マスクと facility 一致検証、`PHR_ACCESS_KEY_FETCH` 監査 ID 整備が必要。 | 同上 |
| PHR-04 | GET | `/20/adm/phr/allergy/{patientId}` | アレルギー一覧をテキスト列挙。 | `PhrDataAssembler`（`AllergyModel` → 文字列）+ `PhrAuditHelper` | P1。`PHR_ALLERGY_TEXT` 監査とエンコーディング変換、`Shift_JIS` 回避のため UTF-8 固定化が前提。 | 同上 |
| PHR-05 | GET | `/20/adm/phr/disease/{patientId}` | 継続傷病名一覧をテキスト返却。 | `PhrDataAssembler` + `PhrAuditHelper` | P1。Legacy 固定メッセージとの差分検証と多言語対応ポリシー確定が必要。 | 同上 |
| PHR-06 | POST | `/20/adm/phr/identityToken` | Layer ID 認証トークン発行。 | `IdentityService` + `PhrRequestContextExtractor` + `PhrAuditHelper` | P0（PHR 認証）。Layer ID クライアント証明書格納と `IdentityService` シークレット注入が必須。 | 同上 |
| PHR-07 | GET | `/20/adm/phr/image/{patientId}` | Schema 画像を JPEG ストリーミング。 | `PhrDataAssembler` + `SchemaModel` ストリーマ + `TouchErrorResponse` | P1。`Cache-Control: no-store` と大容量スロットリング設計、`/resources` 登録が前提。 | 同上 |
| PHR-08 | GET | `/20/adm/phr/labtest/{patientId}` | 直近検査結果をテキスト整形して返却。 | `AMD20_PHRServiceBean` + `PhrDataAssembler` + `PhrAuditHelper` | P1。`normalizeSampleDate2` の Jakarta 互換実装とラボ件数フィルタ（docSince/labSince）の設計が必要。 | 同上 |
| PHR-09 | GET | `/20/adm/phr/medication/{patientId}` | 直近処方の用法・数量をテキスト表示。 | `PhrDataAssembler`（`ClaimBundle` 復元）+ `PhrAuditHelper` | P1。`BundleDolphin` → JSON 変換と禁忌語置換ロジックを `TouchMedicationFormatter` へ抽出する前提。 | 同上 |
| PHR-10 | GET | `/20/adm/phr/patient/{patientId}` | 患者 ID から PHRKey を取得。 | `PhrDataAssembler` + `PhrRequestContextExtractor` + `PhrAuditHelper` | P0。施設整合と `PHR_ACCESS_KEY_FETCH_BY_PATIENT` 監査、患者不在時 404 雛形が必要。 | 同上 |
| PHR-11 | GET | `/20/adm/phr/{facilityId,patientId,...}` | 文書・検査・連絡先を束ねた `PHRContainer` を返却。 | `PhrDataAssembler` + `PhrDataAssembler#assemble()` + `SignedUrlService`（SMS 連絡先） | P0（PHR 本体）。`docSince`/`labSince` クエリの設計、`PHRContainer` の Jackson DTO 化、署名付き URL 発行のための `PHR_EXPORT_CONFIG` 設定が前提。 | 同上 |

> 備考: `PhrExportJobManager`/`PHRAsyncJobServiceBean` を利用する `/20/adm/phr/export*` 系は別タスク `PHR-EXPORT-TRACK` で管理中。まずは PHR-01〜11 の RESTEasy 登録と監査ログ整備を完了させ、その後にエクスポート API を復活させる。

## 5. 管理・受付バックエンド (ADM10/ADM20)

### AdmissionResource (`/20/adm`)
2FA・入院管理などの業務 API。主要エンドポイントは以下。

| HTTP | パス | 主な処理 | 備考 |
| --- | --- | --- | --- |
| GET | `/20/adm/carePlan/{param}` | ケアプラン取得 | `patientPK` から最新ケアプラン一覧を返す。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L132-L154】 |
| POST | `/20/adm/carePlan` | ケアプラン登録 | JSON で受け取り `CarePlanModel` を永続化。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L156-L174】 |
| PUT | `/20/adm/carePlan` | ケアプラン更新 | 該当レコードを更新し件数を返す。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L176-L194】 |
| DELETE | `/20/adm/carePlan` | ケアプラン削除 | 対象ケアプランを削除し削除件数を返す。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L197-L215】 |
| GET | `/20/adm/lastDateCount/{param}` | 来院履歴要約取得 | `fid,pid` を基に最終受診などを検索。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L217-L237】 |
| GET | `/20/adm/docid/{param}` | ドキュメント ID 一覧取得 | CSV のパラメータでフィルタ。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L134-L186】 |
| GET | `/20/adm/document/{param}` | ドキュメント取得 | `AdmissionServiceBean#getDocument`。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L188-L243】 |
| POST | `/20/adm/sendPackage` | カルテ送信 | 受付パッケージをまとめて送信。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L178-L214】 |
| PUT | `/20/adm/factor2/device` | 2FA デバイス紐付け更新 | 新端末登録を処理。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L268-L330】 |
| PUT | `/20/adm/factor2/code` | SMS 認証コード再送 | 5 リクエスト/分でレート制限予定。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L332-L390】 |
| DELETE | `/20/adm/factor2/auth/{param}` | 2FA 認証状態リセット | 端末紐付けを解除。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L392-L436】 |
| POST | `/20/adm/factor2/totp/registration` | TOTP 登録開始 | シークレットと `otpauth://` URI を返す。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L720-L742】 |
| POST | `/20/adm/factor2/totp/verification` | TOTP 登録完了 | バックアップコード生成と検証。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L744-L769】 |
| POST | `/20/adm/factor2/fido2/registration/options` | FIDO2 登録チャレンジ開始 | WebAuthn `PublicKeyCredentialCreationOptions` を返す。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L780-L804】 |
| POST | `/20/adm/factor2/fido2/registration/finish` | FIDO2 登録完了 | 認証器を `Factor2Credential` に登録。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L806-L829】 |
| POST | `/20/adm/factor2/fido2/assertion/options` | FIDO2 認証チャレンジ開始 | Challenge を生成し返却。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L834-L854】 |
| POST | `/20/adm/factor2/fido2/assertion/finish` | FIDO2 認証完了 | 署名検証と監査ログを実施。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L860-L880】 |
| PUT | `/20/adm/user/factor2/device` | 2FA 端末認証 | SMS コードで新端末を信頼済みに登録。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L689-L704】 |
| PUT | `/20/adm/user/factor2/backup` | バックアップコード解除 | ハッシュ化したバックアップコードを検証。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L705-L719】 |
| POST | `/20/adm/nurseProgressCourse` | 看護経過記録保存 | PUT/DELETE/GET も同リソースで提供。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L438-L572】 |
| GET | `/20/adm/nurseProgressCourse/{param}` | 看護経過記録取得 | 指定期間の看護記録を返す。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L438-L509】 |
| POST | `/20/adm/ondoban` | 温度板記録保存 | GET/PUT/DELETE あり。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L574-L736】 |
| PUT | `/20/adm/sms/message` | SMS メッセージ送信 | `SmsServiceBean#send`。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L738-L796】 |

### JsonTouchResource (ADM10/ADM20)
- `/10/adm/jtouch` および `/20/adm/jtouch` ベースで、JSON 化された受付・カルテパッケージを扱う。
- 主な機能: ユーザー情報取得、患者検索（氏名/ID）、受付パッケージ取得、スタンプツリー/スタンプ取得、モジュール収集、薬剤相互作用照会など。【F:server-modernized/src/main/java/open/dolphin/adm10/rest/JsonTouchResource.java†L69-L488】【F:server-modernized/src/main/java/open/dolphin/adm20/rest/JsonTouchResource.java†L78-L512】

### EHTResource (`/10/eht`, `/20/adm/eht`)
- 電子問診・タブレット連携向け API。来院者一覧、仮保存カルテ、患者メモ、診断、バイタル、身体所見の取得・更新を提供。【F:server-modernized/src/main/java/open/dolphin/touch/EHTResource.java†L100-L1404】【F:server-modernized/src/main/java/open/dolphin/adm20/rest/EHTResource.java†L75-L972】

## 6. タッチクライアント連携 (`/touch`, `/demo`)

### DolphinResource / DolphinResourceASP (`/touch`)
- スマートデバイス向けカルテビューア。カルテ文書・患者情報・検査結果・スタンプツリー取得、`POST /touch/idocument` / `/touch/idocument2` によるカルテ登録を提供。【F:server-modernized/src/main/java/open/dolphin/touch/DolphinResource.java†L24-L428】【F:server-modernized/src/main/java/open/dolphin/touch/DolphinResourceASP.java†L24-L1436】

> **2025-11-14 再登録**: `server-modernized/src/main/webapp/WEB-INF/web.xml` の `resteasy.resources` へ `open.dolphin.touch.DolphinResourceASP` を再追加し、Touch 系 ASP エンドポイントも RESTEasy 配下に戻した（Task-A）。web.xml への依存が増えるため、以降の差分検証では該当ファイル差分を必ずレビューする。
>
> **2025-11-14 ギャップ棚卸し**: Legacy XML 応答／Touch 専用 DTO への置換・監査拡充は未完了。`TouchPatientResource`/`TouchStampResource`/`TouchUserResource` 等の新実装に統合し、ヘッダー検証・JSON 応答へ揃える必要がある。

#### 欠落エンドポイント整理 (2025-11-14)

| ID | HTTP | パス | レガシー機能 | 必要なモダナイズ側モジュール | 優先度 / 前提条件 |
| --- | --- | --- | --- | --- | --- |
| Dolphin-01 | GET | `/touch/document/progressCourse/{param}` | カルテ経過記録の閲覧。 | `DolphinResource` + `TouchModuleService`（ProgressCourse DTO）+ `DolphinTouchAuditLogger` | P0（診療フロー）。`TouchAuthHandler` で `X-Access-Reason` を必須化し、監査イベント `TOUCH_PROGRESS_COURSE_VIEW` を定義。 |
| Dolphin-02 | POST | `/touch/idocument` | Progress/soap 等カルテ保存。 | `KarteServiceBean` + `TouchDocumentConverter (IDocument)` + `TouchAuditHelper` | P0。JTA トランザクション復活とエラーマッピング統一、電子署名/JMS 連携の前提を整理。 |
| Dolphin-03 | POST | `/touch/idocument2` | IDocument2 形式でのカルテ保存。 | `KarteServiceBean` + `TouchDocumentConverter (IDocument2)` + `TouchAuditHelper` | P0。`FreeText`/`ProgressCourse` モジュール変換を統一し、`Trace-Id` の透過を保証。 |
| Dolphin-04 | GET | `/touch/item/laboItem/{param}` | 単項目ラボの推移取得。 | `TouchModuleService#getLaboGraph` + `TouchResponseCache` | P1。10 秒 TTL キャッシュと `X-Facility-Id` 検証、Micrometer 計測が必須。 |
| Dolphin-05 | GET | `/touch/module/diagnosis/{param}` | 診断モジュール取得。 | `TouchModuleService#getDiagnoses` + `TouchAuditHelper` | P1。ページング API を QueryParam 化し、診断リスト DTO を JSON Schema 化。 |
| Dolphin-06 | GET | `/touch/module/laboTest/{param}` | ラボモジュール取得。 | `TouchModuleService#getLaboModules` + `TouchRequestContextExtractor` | P1。施設ヘッダーと患者 ID 整合、`labSince` オプションの設計が前提。 |
| Dolphin-07 | GET | `/touch/module/rp/{param}` | 処方モジュール取得。 | `TouchModuleService#getRpModules` + `IOSHelper` | P1。RP 多剤表示用 DTO を確定し、旧端末向け `numDays` 等の互換性を確保。 |
| Dolphin-08 | GET | `/touch/module/schema/{param}` | スキーマ画像取得。 | `TouchModuleService#getSchema` + `SchemaModel` ストリーマ | P1。Base64 応答 or `image/jpeg` 直送の選択、`Cache-Control: no-store` 設計が必要。 |
| Dolphin-09 | GET | `/touch/module/{param}` | 任意 entity のモジュール取得。 | `TouchModuleService#getModules` + `TouchRequestContextExtractor` | P1。`entity`/`firstResult`/`maxResult` を QueryParam 化し、監査項目を entity 別に記録。 |
| Dolphin-10 | GET | `/touch/patient/firstVisitors/{param}` | 初診患者一覧取得。 | `TouchPatientService#getFirstVisitors` + `TouchAuditHelper` | P1。`consentToken` ヘッダー必須＋来院シナリオの seed データ整備。 |
| Dolphin-11 | GET | `/touch/patient/visit/{param}` | 来院履歴取得。 | `TouchPatientService#getVisitList` + `TouchRequestContextExtractor` | P0（受付画面）。offset/limit/sort QueryParam 実装と `facilityMismatch` 403 の標準化が必要。 |
| Dolphin-12 | GET | `/touch/patient/visitLast/{param}` | 最終来院情報取得。 | `TouchPatientService#getLastVisit` + `TouchAuditHelper` | P1。FHIR/AuditEvent 連携と 0 件時のレスポンス仕様策定が前提。 |
| Dolphin-13 | GET | `/touch/patient/visitRange/{param}` | 期間指定で来院履歴取得。 | `TouchPatientService#getVisitRange` + `TouchRequestContextExtractor` | P1。`from/to` バリデーションと 31 日超リクエストのレート制御が必要。 |
| Dolphin-14 | GET | `/touch/patient/{pk}` | 患者基本情報取得。 | `TouchPatientService#getPatientByPk` + `TouchAuditHelper` | P0。`X-Consent-Token` と `Trace-Id` を必須にし、監査 `TOUCH_PATIENT_PROFILE_VIEW` を活用。 |
| Dolphin-15 | GET | `/touch/patientPackage/{pk}` | 患者パッケージ取得。 | `TouchPatientService#getPatientPackage` + `JsonTouchSharedService` + `IOSHelper` | P0。アレルギー・保険 DTO を JSON 化し、機微ログを redact するガイドラインが必要。 |
| Dolphin-16 | GET | `/touch/patients/name/{param}` | 氏名検索。 | `TouchPatientService#searchPatientsByName` + `KanjiHelper` + `TouchAuditHelper` | P1。Facility ガード・かな/漢字正規化・検索ログの匿名化が必須。 |
| Dolphin-17 | GET | `/touch/stamp/{param}` | スタンプ取得。 | `TouchStampService#getStamp` + `TouchResponseCache` | P1。`X-Stamp-Revision` キャッシュキーと監査 `TOUCH_STAMP_FETCH` の整備が前提。 |
| Dolphin-18 | GET | `/touch/stampTree/{param}` | スタンプツリー取得。 | `TouchStampService#getStampTree` + `TouchResponseCache` | P1。公開/共有/施設別ツリーのキャッシュ分割と 5MB 超データの分割配信設計が必要。 |
| Dolphin-19 | GET | `/touch/user/{param}` | Touch ユーザー認証。 | `TouchUserService#getUser` + `TouchAuthHandler` + `DolphinTouchAuditLogger` | P0（ログイン）。`X-Device-Id` を含むヘッダー整合・2FA 状態確認・監査 `TOUCH_USER_AUTH` が前提。 |

### DemoResource / DemoResourceASP (`/demo`)
- デモモード用エンドポイント。`/touch` 相当の読み取り専用 API を提供。
- 現行実装: JSON は `open.dolphin.rest.DemoResourceAsp` に集約済み。XML 版 `DemoResource`/`DemoResourceASP` の公開は終了（`web.xml` から登録削除）。【F:server-modernized/src/main/java/open/dolphin/rest/DemoResourceAsp.java†L85-L825】【F:server-modernized/src/main/java/open/dolphin/touch/DemoResource.java†L24-L347】【F:server-modernized/src/main/java/open/dolphin/touch/DemoResourceASP.java†L24-L1440】
- 利用判断の一次情報: `src/server_modernized_gap_20251221/04_touch_demo/Demo_API_整理.md`

> **2025-11-14 再登録**: `web.xml` へ `open.dolphin.touch.DemoResourceASP` を再追加し、デモ環境固定値 `touch.demo.fixedFacilityId=1.3.6.1.4.1.9414.2.100` を context-param で配布。DemoResource 系エンドポイントは該当パラメータを参照して Facility 強制の設計レビューを行うこと。
>
> **2025-11-14 ギャップ棚卸し**: Demo テナントの XML レスポンスが Legacy クラス（`open.dolphin.touch.DemoResourceASP`）のまま。モダナイズ済みの `Touch*` サービスを流用して JSON 応答へ統一する必要がある。
>
> **2025-12-24 棚卸し**: `open.dolphin.rest.DemoResourceAsp` で 15 API の JSON 実装が完了。`web.xml` には XML 版（`DemoResource`/`DemoResourceASP`）も登録済みのため、公開整理は Demo API 整理の方針に合わせる。
>
> **2025-12-24 利用確認 (RUN_ID: 20251224T163500Z)**: Web クライアント/非 Phase2 ドキュメントに `/demo` の利用記述が見当たらず、15 API は「保留（決裁待ち）」として整理。
>
> **2025-12-25 合意 (RUN_ID: 20251225T195836Z)**: JSON 版 15 API を維持し、XML 版 `DemoResource`/`DemoResourceASP` の公開を終了（web.xml から登録削除）。

#### Demo エンドポイント一覧（2025-12-25 / RUN_ID: 20251225T195836Z）

| ID | HTTP | パス | 機能概要 | 実装形態 | 運用判断 |
| --- | --- | --- | --- | --- | --- |
| Demo-01 | GET | `/demo/document/progressCourse/{param}` | デモカルテの経過記録 XML を返し、看護業務フローを再現。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-02 | GET | `/demo/item/laboItem/{param}` | 単項目ラボトレンドを返却しグラフ表示を再現。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-03 | GET | `/demo/module/diagnosis/{param}` | 登録診断のページング取得。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-04 | GET | `/demo/module/laboTest/{param}` | 検査結果モジュール一覧を返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-05 | GET | `/demo/module/rp/{param}` | 処方モジュールを返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-06 | GET | `/demo/module/schema/{param}` | スキーマ画像を Base64 で返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-07 | GET | `/demo/module/{param}` | 任意 entity のモジュール（観察値等）取得。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-08 | GET | `/demo/patient/firstVisitors/{param}` | 初診患者一覧を返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-09 | GET | `/demo/patient/visit/{param}` | 来院履歴を返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-10 | GET | `/demo/patient/visitLast/{param}` | 最終来院情報を返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-11 | GET | `/demo/patient/visitRange/{param}` | 期間指定の来院履歴を返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-12 | GET | `/demo/patient/{pk}` | 患者基本情報を取得。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-13 | GET | `/demo/patientPackage/{pk}` | 患者パッケージ（患者＋保険＋アレルギー）取得。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-14 | GET | `/demo/patients/name/{param}` | 氏名検索で患者リストを返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |
| Demo-15 | GET | `/demo/user/{param}` | デモユーザーの資格情報を返却。 | JSON: `DemoResourceAsp` | 維持（JSON）/ XML 廃止 |

※ デモ運用の一次情報が入手できた場合は、JSON 版 15 API の維持範囲を再評価する。
RUN_ID: 20251225T195836Z

### JsonTouchResource (`/touch/jtouch`)
- `/touch/jtouch` 系は JSON ベースの軽量 API として患者検索、受付パッケージ取得、スタンプ取得などを提供。【F:server-modernized/src/main/java/open/dolphin/touch/JsonTouchResource.java†L69-L488】

### TouchPatientResource / TouchStampResource / TouchUserResource (`/touch/*`)
- `/touch/patient` 系エンドポイントを `TouchPatientResource` と `TouchPatientService` に分離し、施設整合チェック・`X-Access-Reason`／`X-Consent-Token` ヘッダー必須化・`AuditTrailService` 連携を実装。レスポンスは `IPatientModel`/DTO ベースの JSON へ正規化。【F:server-modernized/src/main/java/open/dolphin/touch/patient/TouchPatientResource.java†L13-L66】【F:server-modernized/src/main/java/open/dolphin/touch/patient/TouchPatientService.java†L25-L190】
- `GET /touch/patient/{patientPk}/firstEncounter`（新設想定）で Touch 初診データを取得。`docType` クエリ（任意）を指定すると `FirstEncounterModel.docType` でフィルタされ、`FirstEncounter0Model` / `FirstEncounter1Model` / `FirstEncounter2Model` など Legacy サブタイプを判別できる。未指定時は施設カルテ ID ごとに `recorded desc` で全件返却。レスポンスは `FirstEncounterModel` の `beanBytes` と `docType` を含むリストで、クライアント側で `IOSHelper.xmlDecode` により既存フォーマットへ復元する想定。
- `/touch/stamp`／`/touch/stampTree` は `TouchStampResource`＋`TouchStampService` が応答し、`TouchResponseCache`（TTL 10 秒）でスタンプ取得をキャッシュ。監査イベントは `TOUCH_STAMP_FETCH`／`TOUCH_STAMP_TREE_FETCH` へ統一。【F:server-modernized/src/main/java/open/dolphin/touch/stamp/TouchStampResource.java†L13-L45】【F:server-modernized/src/main/java/open/dolphin/touch/stamp/TouchStampService.java†L20-L69】
- `/touch/user/{param}` は `TouchUserResource` へ移行し、`userName/password` ヘッダー検証・施設 ID 正規化・S3 Secret マスクを実施。監査は `TOUCH_USER_LOOKUP` に統一。【F:server-modernized/src/main/java/open/dolphin/touch/user/TouchUserResource.java†L13-L34】【F:server-modernized/src/main/java/open/dolphin/touch/user/TouchUserService.java†L24-L154】
- ユニットテスト: `TouchPatientServiceTest`・`TouchStampServiceTest`・`TouchUserServiceTest` で consent／キャッシュ／ヘッダー突合を自動化（いずれも Maven 未導入環境のため CI 実行待ち）。【F:server-modernized/src/test/java/open/dolphin/touch/patient/TouchPatientServiceTest.java†L1-L112】【F:server-modernized/src/test/java/open/dolphin/touch/stamp/TouchStampServiceTest.java†L1-L73】【F:server-modernized/src/test/java/open/dolphin/touch/user/TouchUserServiceTest.java†L1-L110】

## 7. ORCA API ラッパー整備状況（Matrix No.2-18, 32-37, 42）

`docs/server-modernization/phase2/domains/API_PARITY_MATRIX.md` および `phase2/operations/assets/orca-api-spec/orca-api-matrix.with-spec.csv` と突き合わせた、ORCA API ラッパーの最新状況。`GET /api/orca/disease/{import|active}` を除き、ここに記載した API は現状モダナイズ版サーバーに REST ラッパーが存在しない or Sprint2 設計段階で実装中のものを列挙する。

> RUN_ID=`20251116T173000Z`: Trial サーバーで POST/PHR API が禁止されている間は Spec-based 実装として扱い、最終段階で ORMaster／本番サーバー接続に切り替えて通信検証を行う。検証完了後に DOC_STATUS／Runbook／API_STATUS を同日更新する。

- 予約/請求/来院系は `OrcaAppointmentResource`（`/api/orca/appointments/*`, `/api/orca/billing/estimate`, `/api/orca/visits/list`）が一括で担当し、`OrcaWrapperService` と `OrcaXmlMapper` が ORCA XML ⇔ DTO 変換を吸収する。全エンドポイントに RUN_ID=`20251116T170500Z` と Blocker=`TrialLocalOnly` を付与。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaAppointmentResource.java†L40-L94】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L35-L117】【F:server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java†L21-L188】
- 患者同期系（ID リスト／バッチ／氏名検索／保険組合せ／旧姓履歴）は `OrcaPatientBatchResource` が `/api/orca/patients/*` と `/api/orca/insurance/combinations` を公開し、同じ `OrcaWrapperService` 経由で JSON を生成する。Trial ではスタブ XML を `StubOrcaTransport` から供給している。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientBatchResource.java†L41-L105】【F:server-modernized/src/main/java/open/dolphin/orca/transport/StubOrcaTransport.java†L13-L33】
- 医療行為／病名／セット関連は `OrcaMedicalResource`・`OrcaDiseaseResource`・`OrcaPatientResource`・`OrcaSubjectiveResource`・`OrcaMedicalAdministrationResource` に集約し、`/api/orca/medical/*`・`/api/orca/disease/*`・`/api/orca/patient/mutation`・`/api/orca/chart/subjectives`・`/api/orca/medical-sets`・`/api/orca/tensu/sync`・`/api/orca/birth-delivery` を提供。`medicalget`／`disease import/mutation`／`patient mutation` はモダナイズ DB と `SessionAuditDispatcher` を接続済み、`subjectives`／`medical-sets`／`tensu`／`birth-delivery` は Trial 未開放につき Spec-based stub（`Api_Result=79`, RUN_ID=`20251116T170500Z`）。【F:server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalResource.java†L19-L118】【F:server-modernized/src/main/java/open/dolphin/rest/orca/OrcaDiseaseResource.java†L19-L163】【F:server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientResource.java†L19-L85】【F:server-modernized/src/main/java/open/dolphin/rest/orca/OrcaSubjectiveResource.java†L12-L32】【F:server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalAdministrationResource.java†L12-L52】

| No | 優先度 | ORCA API | モダナイズ REST | 状況 | Final validation (Production/ORMaster) | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | P0 | `/orca14/appointmodv2` | `POST /api/orca/appointments/mutation` | ◎ 実装完了 | RUN_ID=20251121PostOpenCheckZ1 実測（`docs/server-modernization/phase2/operations/logs/20251121PostOpenCheckZ1-api-contract.md#orca14appointmodv2`） | 予約登録/取消/新規患者番号割当。`AppointmentMutationRequest/Response` と `OrcaAppointmentMutationFacade` で `AppoServiceBean` を同期し、警告は SSE へ連携。2025-11-21 開発接続先（詳細は `docs/web-client/operations/mac-dev-login.local.md` 参照）では `HTTP 405 (Allow: OPTIONS, GET)` のまま（`20251121T153200Z` → `20251121PostOpenCheckZ1` で変化なし）。Evidence: `artifacts/orca-connectivity/20251121PostOpenCheckZ1/crud/appointmodv2/headers_*.txt`。 |
| 4 | P0 | `/orca11/acceptmodv2` | `POST /api/orca/visits/mutation` | ◎ 実装完了 | RUN_ID=20251121PostOpenCheckZ1 実測（`docs/server-modernization/phase2/operations/logs/20251121PostOpenCheckZ1-api-contract.md#orca11acceptmodv2`） | 受付 CRUD・新規患者受付。`VisitMutationRequest/Response` で `PVTServiceBean` と `ChartEventServiceBean` を同時更新し、`PatientServiceBean` が番号確定を補助。2025-11-21 ORMaster も `HTTP 405 (Allow: OPTIONS, GET)` のまま（`20251121T153200Z` → `20251121PostOpenCheckZ1` で変化なし）。開放後に再検証する。Evidence: `artifacts/orca-connectivity/20251121PostOpenCheckZ1/crud/acceptmodv2/headers_*.txt`。 |
| 6 | P0 | `/api01rv2/appointlstv2` | `POST /api/orca/appointments/list` | ◎ 実装完了 | RUN_ID=20251121T153200Z 実測（`docs/server-modernization/phase2/operations/logs/20251121T153200Z-api-contract.md#appointlstv2`） | `OrcaAppointmentResource#listAppointments` が ORCA XML を DTO `OrcaAppointmentListResponse` へ変換し、予約ウィジェットがモダナイズ REST だけで取得できるようにした。2025-11-21 の ORMaster 実測では `Api_Result=12 (ドクターが存在しません)` でデータ不足（Evidence: `crud/appointlstv2/response_*.xml`）。医師マスタ投入後に再測予定。 |
| 7 | P1 | `/orca102/medicatonmodv2` | `POST /api/orca/tensu/sync` | △ Spec-based | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#medicatonmodv2`） | `MedicationModRequest/Response` を追加し `/api/orca/tensu/sync` stub を実装。Trial が POST を拒否するため `Api_Result=79` を返し、実データ投入は ORMaster 環境の復旧待ち。 |
| 8 | P0 | `/api01rv2/patientlst1v2` | `POST /api/orca/patients/id-list` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#patientlst1v2`） | `OrcaPatientBatchResource#patientIdList` が日付範囲を検証し、`OrcaWrapperService`→`OrcaXmlMapper` で ID リストを JSON 化。Blocker=`TrialLocalOnly`（RUN_ID=`20251116T170500Z`）としてスタブ応答を返し Web クライアント側のバッチ同期を解放。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientBatchResource.java†L41-L52】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L79-L85】 |
| 9 | P0 | `/api01rv2/patientlst2v2` | `POST /api/orca/patients/batch` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#patientlst2v2`） | `patientlst2v2` の XML から住所・保険組合せを `PatientDetail` へ投影し、`/api/orca/patients/batch` でまとめて返却。Blocker=`TrialLocalOnly`／RUN_ID=`20251116T170500Z`。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientBatchResource.java†L54-L65】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L87-L93】 |
| 10 | P0 | `/api01rv2/patientlst3v2` | `POST /api/orca/patients/name-search` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#patientlst3v2`） | 氏名／カナに応じて `PatientSearchResponse` を返すフォームを追加し、`searchTerm` をレスポンスに含め UI 側でハイライトできるようにした。Blocker=`TrialLocalOnly`（RUN_ID=`20251116T170500Z`）。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientBatchResource.java†L67-L79】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L95-L101】 |
| 11 | P1 | `/api01rv2/system01lstv2` | `POST /api/orca/system/management` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#system01lstv2`） | 診療科/職員/医療機関情報など 7 クラスを `SystemMasterSnapshotRequest` で取得し、`SystemServiceBean` キャッシュを更新。Trial通信不可だが実装完了（RUN_ID=20251116T164200Z, 仕様ベース）。 |
| 12 | P0 | `/api01rv2/medicalgetv2` | `POST /api/orca/medical/records` | △ Spec-based | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#medicalgetv2`） | `MedicalGetRequest/Response` を導入しカルテ履歴を JSON で返す。ORCA Trial POST が閉鎖されているためモダナイズ DB のみ参照（RUN_ID=`20251116T170500Z`）。 |
| 13 | P0 | `/api01rv2/diseasegetv2` | `GET /api/orca/disease/import/{pid}` | △ 実装（Trial未検証） | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#diseasegetv2`） | `OrcaDiseaseResource` が `RegisteredDiagnosisModel` を ORCA 項目へ整形。Trial で GET が開放されたら ORCA 応答を透過させる。 |
| 14 | P0 | `/orca12/patientmodv2` | `POST /api/orca/patient/mutation` | △ Spec-based | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#patientmodv2`） | create/update は `PatientServiceBean` を更新し、delete は Trial で禁止のため `Api_Result=79` を返却。 |
| 15 | P0 | `/api01rv2/appointlst2v2` | `POST /api/orca/appointments/patient` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#appointlst2v2`） | `OrcaAppointmentResource#patientAppointments` で患者番号からの予約一覧を返却し、既存 UI が ORCA 直接呼び出しを止められるようにした。Blocker=`TrialLocalOnly`／RUN_ID=`20251116T170500Z`。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaAppointmentResource.java†L53-L64】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L55-L61】 |
| 16 | P0 | `/api01rv2/acsimulatev2` | `POST /api/orca/billing/estimate` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#acsimulatev2`） | 請求試算 API を `BillingSimulationRequest/Response` へ正規化し、診療科コードとポイント内訳を JSON で返却。Trial 実測不可のため Blocker=`TrialLocalOnly`／RUN_ID=`20251116T170500Z`。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaAppointmentResource.java†L66-L81】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L63-L69】 |
| 17 | P0 | `/orca25/subjectivesv2` | `POST /api/orca/chart/subjectives` | △ Spec-based | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#subjectivesv2`） | Trial 未開放のため stub 応答（`Api_Result=79`）を返す。ORCA POST が解禁されたら `KarteServiceBean` 連携を有効化する。 |
| 18 | P0 | `/api01rv2/visitptlstv2` | `POST /api/orca/visits/list` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#visitptlstv2`） | `VisitPatientListResponse` で受付番号・来院順序を返し、PVT キャッシュ連携の前段を REST 化。Blocker=`TrialLocalOnly`／RUN_ID=`20251116T170500Z`。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaAppointmentResource.java†L83-L94】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L71-L77】 |
| 32 | P2 | `/orca101/manageusersv2` | `POST /api/orca/system/users` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#manageusersv2`） | ユーザー一覧/登録/更新/削除。`OrcaUserManagementRequest/Response` で `UserServiceBean`＋`SystemServiceBean` を同期し、権限も RoleModel へ写経。Trial通信不可だが実装完了（RUN_ID=20251116T164200Z, 仕様ベース）。 |
| 33 | P0 | `/orca21/medicalsetv2` | `POST /api/orca/medical-sets` | △ Spec-based | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#medicalsetv2`） | `/api/orca/medical-sets` stub を追加済み。Trial で POST が封鎖されているためレスポンスは警告のみ。 |
| 34 | P1 | `/orca31/birthdeliveryv2` | `POST /api/orca/birth-delivery` | △ Spec-based | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#birthdeliveryv2`） | 出産育児一時金 API stub。ORCA POST が開放されるまで `Api_Result=79` を返す。 |
| 35 | P0 | `/api01rv2/patientlst6v2` | `POST /api/orca/insurance/combinations` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#patientlst6v2`） | `InsuranceCombinationResponse` へ給付率・証明書期間を詰めて返却。Blocker=`TrialLocalOnly`／RUN_ID=`20251116T170500Z`。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientBatchResource.java†L81-L92】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L104-L109】 |
| 51 | P1 | `/api01rv2/patientlst8v2` | `POST /api/orca/patients/former-names` | ◎ 実装完了 | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#patientlst8v2`） | 旧姓履歴を `FormerNameHistoryResponse` へ変換し、患者属性画面が ORCA REST へ統一アクセスできるようにした。Blocker=`TrialLocalOnly`／RUN_ID=`20251116T170500Z`。【F:server-modernized/src/main/java/open/dolphin/orca/rest/OrcaPatientBatchResource.java†L94-L105】【F:server-modernized/src/main/java/open/dolphin/orca/service/OrcaWrapperService.java†L112-L117】 |
| 36 | P0 | `/orca22/diseasev2` | `POST /api/orca/disease` | △ 実装（Trial未検証） | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#diseasev2`） | `DiseaseMutationRequest/Response` を `RegisteredDiagnosisModel`＋`KarteServiceBean` と連携。Trial POST が閉鎖されているため ORCA 実測待ち。 |
| 37 | P0 | `/orca22/diseasev3` | `POST /api/orca/disease/v3` | △ Spec-based | RUN_ID=20251116T173000Z 計画（`docs/server-modernization/phase2/operations/logs/20251116T173000Z-prod-validation-plan.md#diseasev3`） | v3 固有フィールドを扱う stub を追加。Trial POST が開放されたら v2 実装を拡張する。 |
| 42 | P2 | `/orca42/receiptprintv3` | `POST /api/orca/report/print` | ◎ 実装完了 | RUN_ID=20251121PostOpenCheckZ1 実測（`docs/server-modernization/phase2/operations/logs/20251121PostOpenCheckZ1-api-contract.md#orca42receiptprintv3`） | 帳票印刷ジョブ（push-exchanger 連携 + `/blobapi/{Data_Id}` ダウンロード）。2025-11-21 ORMaster も `HTTP 405 (Allow: OPTIONS, GET)` のため POST 不可（前回 `20251121T153200Z` から変化なし）。push-exchanger/`/blobapi` 構成後に再検証。Evidence: `artifacts/orca-connectivity/20251121PostOpenCheckZ1/crud/receiptprintv3/headers_*.txt`。 |

> **メモ**: 各 API の DTO・依存サービス・リリースターゲットは `docs/server-modernization/phase2/domains/API_PARITY_MATRIX.md` の「ORCA ラッパー計画」節に詳細を記載する。

## 8. リアルタイム配信とモダナイズ特有の注意点

- SSE によるチャートイベント配信は `GET /chart-events` で開始し、`clientUUID` と `Last-Event-ID` をヘッダーで指定する。サーバーは `ChartEventSseSupport` を通じて再接続時の差分配送を行う。【F:server-modernized/src/main/java/open/dolphin/rest/ChartEventStreamResource.java†L18-L48】
- 旧ロングポーリング API (`/chartEvent/subscribe` と `/chartEvent/dispatch`) は互換性維持のため残置されており、将来的に段階的廃止予定。新旧クライアントが混在する期間は SSE と REST の双方を監視する。
- 2FA や SMS 認証エンドポイントは ADM20 配下で Jakarta API へ移行済みだが、レート制限・監査ログは今後のマイクロプロファイル連携が前提。運用導入時は API Gateway 側での制御を忘れないこと。【F:server-modernized/src/main/java/open/dolphin/adm20/rest/AdmissionResource.java†L332-L436】

## 9. Webクライアント互換 API（Administration/Outpatient）

- `/api/admin/config`（GET/PUT）: 配信設定の取得/保存。`x-admin-delivery-verification`、`x-orca-queue-mode`、`etag`、`x-delivery-etag` をヘッダーで返し、`deliveryId/deliveryVersion/deliveredAt/verified` をボディへ付与する。
- `/api/admin/delivery`（GET）: 配信済み設定を返す（`/api/admin/config` と同一スキーマ、delivery メタ付き）。
- `/api/orca/queue`（GET/DELETE）: `patientId` フィルタと `retry` を受理。`retry` は未実装のため `retryRequested/retryReason` をボディに明示。
- `/api/orca/appointments/list/*`（POST）: `runId/traceId/requestId/dataSourceTransition/cacheHit/missingMaster/fallbackUsed/fetchedAt/recordsReturned` を返却し、`auditEvent` を付与。
- `/api/orca/patient/mutation(/mock)`（POST）: `operation=create/update/delete` を受理。delete は Trial 制限につき `HTTP 403 + Api_Result=79` を返す。`facilityId` は `remoteUser` → `X-Facility-Id` → `facilityId` の順で解決する。
- Web クライアントからの実アクセスは `/api/*` と `/api/orca/*` を利用する。
- 検証ログ: `docs/server-modernization/operations/logs/20260110T212643Z-web-client-compat.md`（RUN_ID=20260110T212643Z）。

---

**更新手順メモ**
1. 新規エンドポイントを追加した際は、本インベントリと `server-api-inventory.yaml` の双方を更新する。
2. SSE/リアルタイム関連を変更する場合は `ChartEventStreamResource` と `ChartEventResource` の両方の挙動を検証し、Web クライアント向け通知仕様書も併せて改訂する。
