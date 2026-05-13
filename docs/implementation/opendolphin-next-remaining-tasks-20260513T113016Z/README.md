# OpenDolphinNext 残タスク完遂 作業計画書

対象リポジトリは `OpenDolphinNext` とし、作業対象は差し替え後ZIP相当の現行コードベースです。
UI作業は `dads_app_ui_design_rules_20260411.md` を基準にします。

---

## 0. 作業方針

- [ ] コード変更はすべて個別ワークツリーで行う。
- [ ] 後方互換性は考慮しない。
- [ ] 過去DB遺産はないものとして、正本境界・監査・見読性を本番運用基準で再設計する。
- [ ] legacy reference と明示された旧コードは、現行運用に必要なものだけを残し、本番公開経路からは外す。
- [ ] ORCA / WebORCA を正本とする領域と、OpenDolphinNext を正本とする領域を混同しない。
- [ ] WebクライアントからORCA API、ORCA URL、Basic認証、証明書、証明書パスワードへ到達できないことを完了条件に含める。
- [ ] 各担当は、自分のワークツリーで実装・テスト・ドキュメント更新まで完結させる。
- [ ] 統括担当がマージ順、コンフリクト、横断テスト、最終レビューを管理する。

---

## 1. 担当割当とワークツリー構成

| 担当ID | 担当領域 | 推奨ワークツリー名 | 主な対象 | 並列可否 | マージ優先度 |
|---|---|---|---|---|---|
| Lead | 統括・マージ・最終品質保証 | `wt/lead-integration` | 工程管理、merge順、最終E2E、リリース判定 | 常時 | 最後 |
| A | 診療録authority・旧route廃止 | `wt/chart-authority` | `KarteDocumentWriteResource`, `chart_revision`, 確定済みguard | 並列可 | 1 |
| B | 確定時ORCA snapshot完成 | `wt/chart-orca-snapshot` | finalize snapshot、patient/acceptance/insurance/disease/prescription/medical candidate | Aと調整 | 2 |
| C | 患者・施設境界・セキュリティ | `wt/patient-facility-security` | patientmod、facility解決、route auth、secret露出検査 | 並列可 | 1 |
| D | 処方authority・hash chain・taxonomy | `wt/prescription-authority` | `/api/prescriptions`, prescription event, lifecycle | 並列可 | 1 |
| E | ORCA ledger・UNKNOWN・再送制御 | `wt/orca-ledger-unknown` | ORCA operation ledger、medicalmod、diseasev3、idempotency | B/Dと調整 | 3 |
| F | 病名境界・local候補整理 | `wt/disease-boundary` | `LocalDiagnosisResource`, `DiagnosisEditPanel`, `httpClient.ts` metadata | 並列可 | 2 |
| G | Web UI / DADS 医療安全UI | `wt/dads-medical-safety-ui` | patient header、confirm modal、forms、disabled、placeholder | 並列可 | 3 |
| H | 保存性・見読性・export・backup | `wt/readability-export-backup` | PDF/print/export、履歴出力、runbook | A/B/D/E後に調整 | 4 |
| I | テスト・CI・セキュリティ検査 | `wt/test-ci-security` | route inventory、E2E、bundle secret scan、DADS lint | 各担当と並列 | 5 |
| J | 実ORCA検証・運用資料 | `wt/orca-validation-runbook` | ORCA trial接続手順、UNKNOWN運用、障害運用 | 実装後中心 | 6 |

---

## 2. マージ順序

- [ ] **Step 1:** A / C / D を先行マージする。理由: 本番危険経路、施設境界、処方authorityの基盤を先に閉じる。
- [ ] **Step 2:** F をマージする。理由: 病名境界の誤認を取り除き、B/Eのsnapshot・ledger設計と整合させる。
- [ ] **Step 3:** B をマージする。理由: 診療録確定snapshotはAのauthority整理後に安定する。
- [ ] **Step 4:** E をマージする。理由: ORCA ledger・UNKNOWN制御はB/D/Fの識別子・状態設計を参照する。
- [ ] **Step 5:** G をマージする。理由: UIは最終API契約・状態名・警告分類に合わせる。
- [ ] **Step 6:** H をマージする。理由: export/readabilityは確定済みデータ構造とledgerが固まってから統合する。
- [ ] **Step 7:** I を横断マージする。理由: route inventory、E2E、security scan、DADS検査を最終状態に合わせる。
- [ ] **Step 8:** J と Lead でリリース判定、実ORCA検証、運用資料、最終ZIP化を行う。

---

## 3. P0 タスク

### P0-A. 旧 `karte/document` 書込routeを本番公開経路から廃止する

**担当:** A  
**ワークツリー:** `wt/chart-authority`  
**依存:** なし  
**関連リスク:** 確定済み診療録または診療録authorityを迂回した直接上書き

#### 作業チェックリスト

- [ ] `KarteDocumentWriteResource` の現行公開状況を確認する。
- [ ] `POST /api/karte/document` を本番public routeから外す。
- [ ] `PUT /api/karte/document` を本番public routeから外す。
- [ ] `DELETE /api/karte/document` を本番public routeから外す。
- [ ] 診療録タイトル更新routeを本番public routeから外す。
- [ ] draft作成、本文更新、タイトル更新、取消、訂正、追記を `chart_revision` authority service に統一する。
- [ ] 旧routeを残す場合は、test fixture または migration support 専用に隔離し、本番runtimeから到達不能にする。
- [ ] `OpenDolphinRestApplication` のresource登録を整理する。
- [ ] route inventory testに旧write route非公開チェックを追加する。
- [ ] 確定済み診療録の本文・SOAP・タイトル・添付を直接更新できないことをAPIテストで確認する。
- [ ] 旧route削除に伴うWebクライアント呼び出し先を更新する。
- [ ] `docs/contracts` に診療録authority API契約を明記する。

#### 完了条件

- [ ] 本番public routeに `karte/document` 書込系が存在しない。
- [ ] 診療録の作成・更新・確定・訂正・追記・取消はすべて `chart_revision` authority経由。
- [ ] 確定済み診療録本文・タイトル・添付の直接更新がDB guardとAPI guardの両方で拒否される。
- [ ] route inventory testで危険routeが検出されない。

---

### P0-B. 診療録確定時の完全ORCA snapshotを実装する

**担当:** B  
**ワークツリー:** `wt/chart-orca-snapshot`  
**依存:** Aのauthority整理  
**関連リスク:** 確定時点のORCA患者・受付・保険・病名・候補情報を後から説明できない

#### 作業チェックリスト

- [ ] `ChartRevisionFinalizeService` の現行snapshot項目を棚卸しする。
- [ ] `patientSnapshotStatus=IDENTIFIER_ONLY` を廃止する方針でschema/APIを整理する。
- [ ] 確定時にORCA患者基本情報snapshotを保存する。
- [ ] 確定時にORCA受付snapshotを保存する。
- [ ] 確定時にORCA保険・公費・保険組合せsnapshotを保存する。
- [ ] 確定時にORCA病名snapshotを保存する。
- [ ] 確定時に処方指示snapshotを保存する。
- [ ] 確定時にORCA送信候補、算定候補、medical candidate snapshotを保存する。
- [ ] 確定時にORCA警告、不一致、ORCA側のみ存在する情報の要約snapshotを保存する。
- [ ] snapshotには `sourceSystem`, `sourceApi`, `fetchedAt`, `orcaPatientId`, `acceptanceId`, `visitDate`, `department`, `physician`, `insuranceCombination` を含める。
- [ ] ORCA取得不能時の扱いを `NO_ACCEPTANCE_REASON` とは別に定義する。
- [ ] snapshot欠落時に確定を許す条件をAPI上で明確化する。
- [ ] snapshot完全性テストを追加する。
- [ ] 既存の `PENDING_WORKER_INTEGRATION` 表示・状態を削除または本番禁止にする。

#### 完了条件

- [ ] 診療録確定時に完全snapshotが保存される。
- [ ] 確定済み診療録から、当時参照した患者・受付・保険・病名・処方候補・算定候補を再現できる。
- [ ] ORCA側情報が後日変更されても、確定済み診療録snapshotは上書きされない。
- [ ] snapshot完全性テストがCIで通る。

---

### P0-C. 患者更新のfacility header fallbackを廃止する

**担当:** C  
**ワークツリー:** `wt/patient-facility-security`  
**依存:** なし  
**関連リスク:** 別施設操作、認証主体と施設権限の不一致

#### 作業チェックリスト

- [ ] `PatientModV2OutpatientResource` のfacility解決経路を棚卸しする。
- [ ] `X-Facility-Id` をauthorityとして採用するfallbackを削除する。
- [ ] facilityは認証済みsession、remote user、またはserver-side tenant contextからのみ解決する。
- [ ] facility欠落時は `401` または `403` を返す。
- [ ] header偽装で別facility patientmodを呼べないテストを追加する。
- [ ] patient create/update時のauditに、actor、resolvedFacilityId、orcaPatientId、operationIdを残す。
- [ ] local patient syncがORCA canonical re-fetch成功後にのみ行われることを再確認する。
- [ ] patientget/patientmod系API契約にfacility解決ルールを記載する。

#### 完了条件

- [ ] `X-Facility-Id` だけでは患者作成・更新できない。
- [ ] 認証主体に紐づくfacility以外の患者更新が拒否される。
- [ ] patientmod失敗時にlocal患者cacheが登録済み扱いにならない。
- [ ] facility spoofing testがCIで通る。

---

### P0-D. 処方authority routeをtaxonomy内へ移動し、hash chainを実装する

**担当:** D  
**ワークツリー:** `wt/prescription-authority`  
**依存:** なし  
**関連リスク:** 処方正本APIの統制漏れ、処方履歴の改ざん検知不足

#### 作業チェックリスト

- [ ] `/api/prescriptions` の公開routeを棚卸しする。
- [ ] 処方authority routeを `docs/contracts/orca-route-taxonomy.md` のtaxonomy内へ再配置する。
- [ ] 例: `/api/local/prescription-orders` または `/api/chart/prescription-orders` のように、ORCA正本ではないOpenDolphinNext正本領域として明示する。
- [ ] route変更に伴いWebクライアント呼び出し先を更新する。
- [ ] route inventory testでtaxonomy外public routeを検出する。
- [ ] `prescription_order_event` の `previous_event_hash` と `event_hash` を必須投入する。
- [ ] event hashには、order id、event type、actor、timestamp、before/after payload hash、previous hashを含める。
- [ ] append-only制約を強化する。
- [ ] 確定、変更、中止、取消、再発行、再送の全イベントでhash chainを張る。
- [ ] hash chain検証用repository/serviceを追加する。
- [ ] 改ざん検知テストを追加する。
- [ ] 確定済み処方指示の直接更新禁止テストを維持・拡充する。

#### 完了条件

- [ ] 処方authority APIがtaxonomy内に収まる。
- [ ] taxonomy外public routeが0件。
- [ ] 処方履歴がappend-onlyかつhash chainで検証可能。
- [ ] 確定済み処方指示の本文・薬剤・用量・日数・コメントを直接上書きできない。
- [ ] 処方イベントhash chainテストがCIで通る。

---

## 4. P1 タスク

### P1-E. ORCA operation ledgerを全ORCA連携で統一する

**担当:** E  
**ワークツリー:** `wt/orca-ledger-unknown`  
**依存:** B / D / F  
**関連リスク:** ORCA送信内容、警告、不一致、失敗、再送の追跡不能

#### 作業チェックリスト

- [ ] patientget/patientmodのledger記録状況を確認する。
- [ ] acceptlst/acceptmodのledger記録状況を確認する。
- [ ] diseaseget/diseasev3のledger記録状況を確認する。
- [ ] medicalmod/tmedicalgetのledger記録状況を確認する。
- [ ] income/accounting/report系のledger記録状況を確認する。
- [ ] 全ORCA operationに共通のoperation idを付与する。
- [ ] request payload hashを保存する。
- [ ] response payload hashを保存する。
- [ ] Api_Result、warning、error、unmatch、unmatched、mismatch、reconciliation statusを分類保存する。
- [ ] actor、target patient、target chart revision、target prescription order、target encounterを紐づける。
- [ ] raw患者情報・ORCA認証情報をlogに出さない設計を再確認する。
- [ ] ledger未記録のORCA callをCIで検出するテストを追加する。
- [ ] central auditとORCA operation ledgerを相互参照できるようにする。

#### 完了条件

- [ ] ORCA連携は全てledgerに記録される。
- [ ] ORCA request/response/warning/error/unmatch/reconciliationを監査で追跡できる。
- [ ] ORCA認証情報はDB、server log、browser log、bundleに露出しない。
- [ ] ledger必須テストがCIで通る。

---

### P1-F. UNKNOWN状態、再送、二重送信防止を統一する

**担当:** E  
**ワークツリー:** `wt/orca-ledger-unknown`  
**依存:** Eのledger基盤  
**関連リスク:** ORCA送信失敗・通信断を成功扱いする、二重送信する

#### 作業チェックリスト

- [ ] UNKNOWNの定義を文書化する。
- [ ] NETWORK_FAILED、AUTH_FAILED、CERT_FAILED、BUSINESS_ERROR、WARNING_NEEDS_REVIEW、UNMATCHED、UNKNOWNを状態分類する。
- [ ] ORCA送信成功と診療録確定を別状態として保持する。
- [ ] ORCA送信成功と会計済みを別状態として保持する。
- [ ] no uid、re-fetch失敗、reconciliation不成立は成功扱いしない。
- [ ] idempotency keyをoperation単位で固定する。
- [ ] 同一候補の二重送信を防ぐDB制約または状態遷移guardを追加する。
- [ ] 再送可能条件を定義する。
- [ ] 再送不可条件を定義する。
- [ ] UNKNOWN解消時の再取得・照合・手動確認フローをAPI化する。
- [ ] UNKNOWN中は「ORCA反映済み」「会計済み」「登録済み」と表示しない。
- [ ] UIにUNKNOWN解除導線を追加する。
- [ ] UNKNOWN、通信断、他端末使用中、認証失敗、証明書異常のテストを追加する。

#### 完了条件

- [ ] UNKNOWNが成功扱いされない。
- [ ] 再送・再取得・手動確認の状態遷移が監査に残る。
- [ ] 同一operationの二重送信が防止される。
- [ ] UNKNOWN解消まで会計送信済み・ORCA登録済み表示にならない。

---

### P1-G. 病名local候補とORCA正本病名を明確に分離する

**担当:** F  
**ワークツリー:** `wt/disease-boundary`  
**依存:** なし  
**関連リスク:** local病名候補をORCA登録済み病名と誤認する

#### 作業チェックリスト

- [ ] `LocalDiagnosisResource` の `pendingLocalDiseases` を棚卸しする。
- [ ] `pendingLocalDiseases` を `candidate` または `draftCandidate` として再定義する。
- [ ] local候補は `readOnly=false` ではなく、ORCA未登録・送信候補であることを明示する。
- [ ] `httpClient.ts` metadataのlocal diagnosis CRUD表現を削除する。
- [ ] metadataは `official diseasegetv2`、`official diseasev3`、`local candidate` の3分類に整理する。
- [ ] `DiagnosisEditPanel` でORCA登録病名、ORCA側のみ病名、送信候補、自由記述病名を視覚的に分離する。
- [ ] ORCA送信失敗時にlocal候補を登録済み表示しない。
- [ ] ORCA側のみ病名、warning、unmatchの表示テストを拡充する。
- [ ] 病名自由記述は診療録本文正本であり、ORCA病名正本ではないことをUI文言に残す。

#### 完了条件

- [ ] local病名候補がORCA登録済み病名に見えない。
- [ ] local病名CRUDを示すmetadataが消える。
- [ ] `diseasegetv2?class=01` 取得病名と `diseasev3` 更新結果が正本として扱われる。
- [ ] 警告・不一致・ORCA側のみ病名のUI/監査テストが通る。

---

### P1-H. Web UIをDADS医療安全観点で是正する

**担当:** G  
**ワークツリー:** `wt/dads-medical-safety-ui`  
**依存:** API状態名が固まるまで一部待機  
**関連リスク:** 患者取り違え、重大操作誤実行、警告見落とし

#### 作業チェックリスト

- [ ] 患者ヘッダーが診療録、病名、処方、ORCA送信、会計送信の主要画面で常時表示されることを確認する。
- [ ] 重大操作モーダル内に患者番号、氏名、生年月日、性別、年齢、受付日、診療科、担当医、保険組合せを再掲する。
- [ ] ORCA警告、エラー、不一致、ORCA側のみ情報、UNKNOWN、送信失敗を初期表示で見える位置に置く。
- [ ] 重要な病名・処方・ORCA警告をdetails/accordion初期非表示にしない。
- [ ] `placeholder` に説明を依存している入力をすべて洗い出す。
- [ ] placeholderの説明をラベルまたはサポートテキストへ移す。
- [ ] disabledボタンを洗い出す。
- [ ] disabledが必要な場合は、直近に理由と有効化条件を常時表示する。
- [ ] 可能な箇所はdisabledではなく、押下後に具体的エラーを表示する設計へ変更する。
- [ ] フォームには `※必須` / `※任意`、入力条件、具体例、エラーテキストを追加する。
- [ ] 「失敗しました」だけの通知を、原因・影響・次に取る行動を含む文言へ変更する。
- [ ] 処方確定、診療録確定、ORCA送信、診察終了、会計送信のconfirm flowを統一する。
- [ ] ボタン配置を「戻る/取消は左、進む/確定/送信は右」に統一する。
- [ ] キーボード操作、focus trap、focus visible、押下領域44px以上をテストする。
- [ ] コントラスト検査を追加する。
- [ ] DADS違反を検出する静的検査またはUI testを追加する。

#### 完了条件

- [ ] 患者識別情報が重大操作時に必ず再確認できる。
- [ ] ORCA警告・不一致・UNKNOWNが隠れない。
- [ ] placeholder依存が0件。
- [ ] disabled理由未表示が0件。
- [ ] UI testで患者取り違え防止、重大操作確認、警告表示、focus、押下領域が確認できる。

---

## 5. P2 タスク

### P2-I. 診療録・処方・ORCA履歴の見読性とexportを完成させる

**担当:** H  
**ワークツリー:** `wt/readability-export-backup`  
**依存:** A / B / D / E  
**関連リスク:** 診療録の保存性・見読性不足、監査説明不能

#### 作業チェックリスト

- [ ] 現行PDF/print/export endpointを棚卸しする。
- [ ] 患者単位exportに診療録本文、SOAP、所見、説明内容、添付文書を含める。
- [ ] 診療日単位exportに当日の診療録、処方、ORCA送信候補、ORCAレスポンス、警告、不一致を含める。
- [ ] 期間単位exportに訂正、追記、取消、無効化履歴を含める。
- [ ] 処方指示の変更、中止、取消、再発行、再送信履歴を出力対象に含める。
- [ ] ORCA operation ledgerの要約を診療録exportに含める。
- [ ] ORCA由来cacheとOpenDolphinNext正本を見出し・ラベルで明確に分離する。
- [ ] PDF出力で患者識別情報、診療日、ORCA受付ID、診療科、担当医、保険組合せを表示する。
- [ ] export JSONには機械可読なsnapshot、event、audit idを含める。
- [ ] export CSVは監査・移行用として項目定義を文書化する。
- [ ] export対象に秘密情報、ORCA認証情報、証明書情報が含まれないことをテストする。

#### 完了条件

- [ ] 患者単位、診療日単位、期間単位で診療録・処方・ORCA連携履歴を出力できる。
- [ ] PDF/printで診療録の見読性が確保される。
- [ ] ORCA由来cacheと診療録正本が混同されない。
- [ ] export security testが通る。

---

### P2-J. 収納・領収・帳票・レセプト関連のORCA由来cache境界を整備する

**担当:** E + H  
**ワークツリー:** `wt/orca-ledger-unknown`, `wt/readability-export-backup`  
**依存:** Eのledger統一  
**関連リスク:** 会計・帳票・請求情報の正本境界混同

#### 作業チェックリスト

- [ ] income/accounting/report/receipt系の現行テーブル・APIを棚卸しする。
- [ ] ORCA由来cacheに `sourceSystem`, `sourceApi`, `fetchedAt`, `acceptanceId`, `visitDate`, `department`, `insuranceCombination` を含める。
- [ ] OpenDolphinNext側では会計・収納・領収・レセプトを独立正本化しない。
- [ ] ORCA会計済み情報を未送信候補で上書き・取消しないguardを追加する。
- [ ] 会計情報表示UIにORCA由来・取得日時・受付IDを明示する。
- [ ] ORCA側のみ存在する会計済み情報をwarningとして表示する。
- [ ] 帳票snapshotと診療録exportの紐付けを整備する。
- [ ] receipt関連情報を扱う場合の表示cache/監査/出力範囲をdocsに明記する。

#### 完了条件

- [ ] 会計・収納・領収・帳票・レセプト情報がORCA正本として扱われる。
- [ ] OpenDolphinNextではcache/snapshot/logとしてのみ保持される。
- [ ] ORCA側会計済み情報をlocal未送信候補で上書きできない。
- [ ] 会計表示にsource/fetchedAt/acceptanceIdが常時出る。

---

### P2-K. バックアップ・復元・障害運用runbookを整備する

**担当:** J  
**ワークツリー:** `wt/orca-validation-runbook`  
**依存:** Hのexport方針  
**関連リスク:** DB障害、ORCA障害、監査ログ保全不能

#### 作業チェックリスト

- [ ] DBバックアップ対象を定義する。
- [ ] 診療録正本、処方正本、chart snapshot、prescription event、audit event、ORCA ledgerを必須対象にする。
- [ ] ORCA由来cacheとOpenDolphinNext正本の復元優先度を分ける。
- [ ] 復元手順をrunbook化する。
- [ ] 復元後にhash chainを検証する手順を定義する。
- [ ] ORCA停止時の診療録確定可否を定義する。
- [ ] ORCA停止時の処方指示、ORCA送信候補、会計待ちの扱いを定義する。
- [ ] UNKNOWN発生時の担当者、確認期限、再送/手動照合手順を定義する。
- [ ] 証明書期限切れ、認証失敗、通信断、他端末使用中の一次対応を定義する。
- [ ] 監査ログの閲覧権限、保存期間、外部保全方針を定義する。
- [ ] backup/restore rehearsalのチェックリストを作成する。

#### 完了条件

- [ ] backup/restore runbookが存在する。
- [ ] ORCA障害・DB障害・UNKNOWN発生時の業務継続手順が存在する。
- [ ] 復元後の監査ログ・hash chain検証手順が存在する。
- [ ] 本番前リハーサル項目が定義されている。

---

## 6. P3 タスク

### P3-L. 実ORCA接続試験計画を作成・実施する

**担当:** J  
**ワークツリー:** `wt/orca-validation-runbook`  
**依存:** E / F / B  
**関連リスク:** 静的レビューでは検出できないORCA実レスポンス・排他・警告差異

#### 作業チェックリスト

- [ ] ORCA trialまたは検証環境の接続情報をsecret管理へ登録する。
- [ ] 接続情報をコード、ブラウザbundle、ログに出さない。
- [ ] patientgetv2取得試験を実施する。
- [ ] patientmodv2 create/update試験を実施する。
- [ ] acceptlstv2/acceptmodv2試験を実施する。
- [ ] diseasegetv2 `class=01` 試験を実施する。
- [ ] diseasev3 追加・変更・削除・転帰更新試験を実施する。
- [ ] diseasev3 warning/unmatch/ORCA側のみ病名の試験を実施する。
- [ ] medicalmodv2送信試験を実施する。
- [ ] tmedicalgetv2再取得・照合試験を実施する。
- [ ] income/accounting系取得試験を実施する。
- [ ] 通信断、認証失敗、証明書異常、他端末使用中を可能な範囲で再現する。
- [ ] UNKNOWN解消フローを試験する。
- [ ] 実試験ログには実在患者情報・秘密値を残さない。
- [ ] 試験結果を `docs/validation/orca-live-validation.md` に整理する。

#### 完了条件

- [ ] ORCA公式APIとの実通信で主要workflowが確認済み。
- [ ] 失敗系・警告・不一致・UNKNOWNの挙動が記録済み。
- [ ] 実試験結果がCI/E2Eで再現できない範囲も含めて文書化されている。

---

## 7. 横断テスト・CI計画

**担当:** I  
**ワークツリー:** `wt/test-ci-security`  
**依存:** 全担当と連携

### 7.1 Route inventory / 正本境界テスト

- [ ] 本番public route一覧を自動収集する。
- [ ] taxonomy外routeを失敗扱いにする。
- [ ] `karte/document` 書込系が存在しないことを確認する。
- [ ] local患者CRUDが存在しないこと、または本番到達不能であることを確認する。
- [ ] local病名CRUDが存在しないこと、または本番到達不能であることを確認する。
- [ ] `/api/prescriptions` のようなtaxonomy外routeが存在しないことを確認する。
- [ ] Webクライアントがraw ORCA pathへ到達できないことを確認する。

### 7.2 診療録テスト

- [ ] 下書き作成テスト。
- [ ] 確定テスト。
- [ ] 訂正テスト。
- [ ] 追記テスト。
- [ ] 取消テスト。
- [ ] 無効化テスト。
- [ ] 確定済み本文直接更新禁止テスト。
- [ ] 確定済みタイトル直接更新禁止テスト。
- [ ] 確定時完全snapshotテスト。
- [ ] ORCA側変更後も確定済みsnapshotが上書きされないテスト。
- [ ] PDF/print/exportテスト。

### 7.3 処方テスト

- [ ] 処方作成テスト。
- [ ] 処方確定テスト。
- [ ] 処方変更テスト。
- [ ] 処方中止テスト。
- [ ] 処方取消テスト。
- [ ] 処方再発行テスト。
- [ ] 確定済み処方直接上書き禁止テスト。
- [ ] prescription event hash chainテスト。
- [ ] hash chain改ざん検知テスト。
- [ ] ORCA送信失敗時に反映済み表示しないテスト。
- [ ] 二重送信防止テスト。
- [ ] 再送テスト。
- [ ] 差分照合テスト。

### 7.4 ORCA連携テスト

- [ ] patientgetv2 mock test。
- [ ] patientmodv2 success/failure mock test。
- [ ] acceptlst/acceptmod mock test。
- [ ] diseasegetv2 class=01 mock test。
- [ ] diseasev3 add/change/delete/outcome mock test。
- [ ] diseasev3 warning/unmatch mock test。
- [ ] medicalmodv2 success/failure mock test。
- [ ] UNKNOWN test。
- [ ] 他端末使用中test。
- [ ] 通信断test。
- [ ] 認証失敗test。
- [ ] 証明書異常test。
- [ ] ORCA ledger必須記録test。
- [ ] ORCA認証情報がログに出ないtest。

### 7.5 UI / DADSテスト

- [ ] 主要画面で患者ヘッダー常時表示test。
- [ ] 重大操作confirmに患者識別情報が再掲されるtest。
- [ ] ORCA警告・エラー・不一致・UNKNOWNが初期表示されるtest。
- [ ] placeholder依存がない静的検査。
- [ ] disabled理由未表示がない静的検査。
- [ ] フォームラベル・必須/任意・サポートテキスト・具体的エラーtest。
- [ ] 重要情報がaccordion/details初期非表示になっていないtest。
- [ ] button priority/placement test。
- [ ] keyboard operation test。
- [ ] focus visible/focus trap test。
- [ ] contrast test。
- [ ] 44px以上押下領域test。

### 7.6 セキュリティテスト

- [ ] production bundleにORCA URLが含まれないことを検査する。
- [ ] production bundleにBasic認証文字列が含まれないことを検査する。
- [ ] production bundleに証明書、証明書パスワード、secretが含まれないことを検査する。
- [ ] `/orca22`, `/api01rv2` 等のraw ORCA pathへフロントから到達できないことを確認する。
- [ ] server logにORCA認証情報が出ないことを確認する。
- [ ] browser logに患者個人情報・ORCA認証情報が出ないことを確認する。
- [ ] 権限なしユーザーが診療録確定、処方確定、ORCA送信、監査ログ閲覧をできないことを確認する。

---

## 8. 統括担当 Lead の作業

**担当:** Lead  
**ワークツリー:** `wt/lead-integration`

### 8.1 作業開始時

- [ ] 各担当用worktreeを作成する。
- [ ] 各担当のbase commitを統一する。
- [ ] 各担当の作業範囲をREADMEまたはissueに記載する。
- [ ] 各担当の禁止事項を明記する。
- [ ] taxonomy、正本境界、DADS、ORCA連携方針を共有する。
- [ ] マージ順を固定する。
- [ ] conflict hotspotを共有する。

### 8.2 作業中

- [ ] A/C/DのP0進捗を毎日確認する。
- [ ] B/E/G/HがA/DのAPI変更に追従できるよう、API契約差分を管理する。
- [ ] route taxonomy変更を中央で管理する。
- [ ] migration番号の衝突を調整する。
- [ ] DTO名・状態名・audit event名の揺れを調整する。
- [ ] ORCA state名、UNKNOWN分類、warning/unmatch分類を統一する。
- [ ] UI表示文言とserver状態名の対応表を作る。
- [ ] 各担当のテスト追加漏れを確認する。

### 8.3 マージ時

- [ ] 各worktreeでunit testを実行する。
- [ ] 各worktreeでintegration testを実行する。
- [ ] 各worktreeでroute inventory testを実行する。
- [ ] 各worktreeでsecret scanを実行する。
- [ ] Aをマージする。
- [ ] Cをマージする。
- [ ] Dをマージする。
- [ ] Fをマージする。
- [ ] Bをマージする。
- [ ] Eをマージする。
- [ ] Gをマージする。
- [ ] Hをマージする。
- [ ] Iをマージする。
- [ ] Jをマージする。
- [ ] migration番号衝突を解消する。
- [ ] API契約docの整合を確認する。
- [ ] Webクライアントの型生成・API client整合を確認する。

### 8.4 最終判定

- [ ] P0が全て完了している。
- [ ] P1が全て完了している。
- [ ] 未完了P2/P3が本番運用上のCritical/Highリスクを残していない。
- [ ] route inventoryで危険経路が0件。
- [ ] ORCA認証情報のブラウザ露出が0件。
- [ ] 確定済み診療録・処方指示の直接上書き経路が0件。
- [ ] ORCA送信失敗・UNKNOWNを成功扱いする経路が0件。
- [ ] UI上、患者取り違え防止と重大操作確認が成立している。
- [ ] export/PDF/printで診療録の見読性が成立している。
- [ ] release validation reportを作成する。

---

## 9. コンフリクトが起きやすい箇所

| 箇所 | 関係担当 | 予想される衝突 | 調整方針 |
|---|---|---|---|
| `OpenDolphinRestApplication` | A / D / I | resource登録、route inventory | Leadが一元管理 |
| DB migration番号 | A / B / D / E / H | migration連番衝突 | Leadが採番表を管理 |
| `docs/contracts/orca-route-taxonomy.md` | A / D / F / E / I | taxonomy分類変更 | DとIが草案、Leadが確定 |
| `ChartRevisionFinalizeService` | A / B / E / H | finalize状態、snapshot、audit | A後にB、E、Hが追従 |
| `DiagnosisEditPanel.tsx` | F / G | 病名境界とDADS UI | Fが意味分類、GがUI配置 |
| `ChartsActionBar.tsx` | E / G | UNKNOWN、送信状態、confirm flow | Eが状態、Gが表示 |
| `httpClient.ts` | F / G / I | metadata、API path、client calls | route変更後にIが検査 |
| `PrescriptionAuthorityResource` | D / E / G | API path、状態、UI連携 | DがAPI、EがORCA状態、GがUI |

---

## 10. 完了判定チェックリスト

### 10.1 Critical / High リスク解消

- [ ] ORCAを正本とする患者・保険・受付・病名・診療行為・会計・レセプト情報をOpenDolphinNext側で独立正本化していない。
- [ ] OpenDolphinNext正本である診療録・処方指示がORCA結果で無断上書きされない。
- [ ] 確定済み診療録を直接上書きできない。
- [ ] 確定済み処方指示を直接上書きできない。
- [ ] 診療録の確定者、入力者、代行入力者、日時、訂正履歴、監査ログが残る。
- [ ] ORCA送信失敗時に反映済み、登録済み、会計済み扱いしない。
- [ ] WebクライアントがORCA APIを直接叩かない。
- [ ] WebクライアントがORCA認証情報を保持しない。
- [ ] 患者取り違え防止UIが主要画面と重大操作で成立している。
- [ ] 処方確定、診療録確定、ORCA送信、会計送信の確認フローが成立している。
- [ ] ORCA警告、エラー、不一致、ORCA側のみ情報が利用者に見える。
- [ ] 診療録の表示、印刷、PDF、exportの見読性が成立している。
- [ ] CLAIM、diseasev2、ORCA DB直接参照・直接更新に依存しない。
- [ ] ORCA request/response/warning/error/unmatch/operator/patient/chartが監査に残る。
- [ ] ORCA接続URL、Basic認証、証明書、証明書パスワードがブラウザ側に露出しない。
- [ ] ORCA送信の冪等性、二重送信防止、再送、UNKNOWN状態が統制されている。

### 10.2 本番前ゲート

- [ ] `mvn test` または該当server test suiteが通る。
- [ ] Web client unit testが通る。
- [ ] Web client E2E testが通る。
- [ ] route inventory testが通る。
- [ ] migration validationが通る。
- [ ] secret scanが通る。
- [ ] production bundle scanが通る。
- [ ] DADS UI静的検査が通る。
- [ ] PDF/export regression testが通る。
- [ ] ORCA mock integration testが通る。
- [ ] 実ORCA検証結果が文書化されている。
- [ ] backup/restore runbookが文書化されている。
- [ ] release validation reportが作成されている。

---

## 11. 成果物一覧

- [ ] `docs/contracts/orca-route-taxonomy.md` 更新版
- [ ] `docs/contracts/chart-authority-api.md`
- [ ] `docs/contracts/prescription-authority-api.md`
- [ ] `docs/contracts/orca-ledger-and-unknown-state.md`
- [ ] `docs/contracts/disease-boundary.md`
- [ ] `docs/ui/dads-medical-safety-checklist.md`
- [ ] `docs/runbooks/orca-unknown-resolution.md`
- [ ] `docs/runbooks/backup-restore.md`
- [ ] `docs/runbooks/orca-outage.md`
- [ ] `docs/validation/orca-live-validation.md`
- [ ] `docs/validation/release-validation-report.md`
- [ ] route inventory test suite
- [ ] ORCA mock integration test suite
- [ ] prescription hash chain test suite
- [ ] chart snapshot completeness test suite
- [ ] DADS UI compliance test suite
- [ ] production bundle secret scan job

---

## 12. 最小リリース条件

本番相当のORCA連携電子カルテとして最低限リリース判定に進める条件は次です。

- [ ] P0-A 完了
- [ ] P0-B 完了
- [ ] P0-C 完了
- [ ] P0-D 完了
- [ ] P1-E 完了
- [ ] P1-F 完了
- [ ] P1-G 完了
- [ ] P1-H 完了
- [ ] route inventoryで危険route 0件
- [ ] ORCA認証情報ブラウザ露出 0件
- [ ] 確定済み診療録直接更新経路 0件
- [ ] 確定済み処方指示直接更新経路 0件
- [ ] ORCA失敗・UNKNOWN成功扱い経路 0件
- [ ] 患者取り違え防止UIと重大操作confirmがE2Eで確認済み
- [ ] 診療録PDF/print/exportが確認済み
- [ ] 実ORCA検証または検証不能項目の明示的なリスク受容が完了済み

