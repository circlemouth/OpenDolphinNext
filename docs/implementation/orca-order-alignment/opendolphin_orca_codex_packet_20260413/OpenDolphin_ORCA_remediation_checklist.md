# OpenDolphin Web Client ORCA是正プロジェクト  
## チェックボックス式 作業工程表（実装詳細込み・最後まで追える版）

> 前提
> - 後方互換性は考慮しない。旧 public route / 旧 payload / 旧 UI 文言に互換 shim を置かない。
> - 過去の DB 遺産はないものとして扱い、本番運用を見据えた最短の正しい形へ寄せる。
> - zip 内の build 成果物 / artifacts は無視し、ソースだけを見る。
> - ORCA 仕様確認の起点は `https://www.orca.med.or.jp/receipt/users/tec/api/overview.html` とする。
> - official ORCA API / ORCA master-backed / local-only wrapper の境界をコードと UI で明示する。

---

## 0. この工程表の使い方

- [ ] PR は **PR0 → PR1 → PR2 → PR3 → PR4 → PR5 → PR6** の順に進める
- [ ] 各 PR の着手前に「依存 PR がマージ済みか」を確認する
- [ ] 各 PR の最後に「Done 条件」「テスト」「grep チェック」を必ず実施する
- [ ] 不明点は “放置” せず、**safe side 実装** に倒す  
      例: official 仕様未確認のフィールドは送らない / UI に出さない / local-only と明示する
- [ ] local-only を official 名で見せる挙動を残さない
- [ ] 本番で誤送信しうるフローを最優先で止める
- [ ] UI 文言・監査名・route metadata を必ずコード変更と一緒に直す

---

## 1. 最終到達像（Definition of Done）

### 1-1. 境界定義

- [ ] public route で `/api/orca/official/*` は official ORCA transport 到達分だけになっている
- [ ] `/api/orca/master/*` は master-backed 参照 API に限定されている
- [ ] local-only wrapper は `/api/local/*` または admin/debug 専用 route に退避している
- [ ] UI 名、監査名、http metadata が actual behavior と一致している

### 1-2. 主要不一致の解消

- [ ] `medicalmodv23` が chart send / finish フローから完全に外れている
- [ ] `medicalmodv2` が canonical encounter context 必須で送信される
- [ ] `medicalmodv2` に `Insurance_Combination_Number` が正しく載る
- [ ] `Perform_Date=today fallback` が消えている
- [ ] `acceptmodv2` の `21/60` 解釈が正しい
- [ ] `patientlst3v2` request が official 形状になっている
- [ ] `manageusersv2` create/update XML が official 準拠
- [ ] PatientsPage と chart patient edit が official `patientmodv2` 更新導線を使う
- [ ] `incomeinfv2` の UI semantics が official と一致する
- [ ] 一般オーダー画面の「禁忌チェック」が official `contraindicationcheckv2` を本当に叩く
- [ ] `medicationgetv2` の 01/02 両モードの扱いが UI / client / server で一致する
- [ ] subjectives / patient mutation / local summary が official 風の名前を持っていない

### 1-3. 仕上げ

- [ ] XML contract tests が official sample / route 仕様を保証している
- [ ] UI tests が新文言・新導線・送信停止条件を保証している
- [ ] docs / notes / operations 文書が新設計と一致している
- [ ] リリース順序が server → web-client 同時切替で整理されている
- [ ] “旧 route を残したせいで誤用” が起きない

---

## 2. 問題カバレッジ表

### W1 管理

- [ ] W1-01 `manageusersv2` update request 不一致 → PR4-A
- [ ] W1-02 `manageusersv2` create request に `User_Number` を送っている → PR4-A
- [ ] W1-03 sync 文言が実態とズレる → PR4-B
- [ ] W1-04 “認証済み” 文言が local admin 権限と ORCA 認証を混同 → PR4-B
- [ ] W1-05 `pushUrl` / `pushTenantId` UI 欠落 → PR4-C
- [ ] W1-06 master updates が official 取得と local artifact を混在表示 → PR4-D
- [ ] W1-07 internal wrapper patient-mutation の説明齟齬 → PR0-B / PR4-E
- [ ] W1-08 `ORCA_CERTIFICATION_ONLY.md` が古い → PR6-C
- [ ] W1-09 一括疎通（グループ）の命名齟齬 → PR4-E

### W2 受付

- [ ] W2-01 `acceptmodv2` `Api_Result=21` を受付なしと誤解釈 → PR3-A
- [ ] W2-02 `patientlst3v2` request 形状不一致 → PR3-B
- [ ] W2-03 `visitptlstv2` に診療科フィルタ未伝播 → PR3-C
- [ ] W2-04 `Medical_Information` を固定 `01` に潰している → PR3-D
- [ ] W2-05 `appointlstv2` local DTO に `departmentCode` が残る → PR3-E
- [ ] W2-06 `Acceptance_Push` suppress comment と実装が workaround のまま → PR3-F
- [ ] W2-07 `Api_Result=91` の独自解釈 → PR3-B
- [ ] W2-08 `0001 -> 10001` physician code hack → PR3-F
- [ ] W2-09 reception が新患作成を中途半端に匂わせる → PR3-G

### W3 患者

- [ ] W3-01 PatientsPage 保存導線が local-only なのに ORCA 反映 UI → PR2-A / PR0-B
- [ ] W3-02 official `patientlst3v2` wrapper 不一致 → PR3-B
- [ ] W3-03 `patientmodv2 class=01` create 未実装 → PR2-B
- [ ] W3-04 `/patients` 画面の役割と実装がズレる → PR2-A / PR6-C
- [ ] W3-05 local search と official search の境界曖昧 → PR2-C / PR3-B
- [ ] W3-06 保険者参照の scope 不明瞭 → PR5-D / PR6-C

### W4 カルテA

- [ ] W4-01 一般オーダーの禁忌チェックが stub → PR5-A
- [ ] W4-02 `medicationgetv2` `Request_Number=01` が client から使えない → PR5-B
- [ ] W4-03 相互作用チェックが official `contraindicationcheckv2` ではない → PR5-C
- [ ] W4-04 `medicationgetv2` response field を一部捨てている → PR5-B

### W5 カルテB

- [ ] W5-01 `medicalmodv23` を診療終了相当で自動実行 → PR1-A
- [ ] W5-02 `medicalmodv23` DTO/payload が official と合わない → PR1-A
- [ ] W5-03 `medicalmodv2` に保険組合せがない → PR1-B
- [ ] W5-04 visit context 補完が patientId first-match → PR1-B
- [ ] W5-05 `Perform_Date` today fallback → PR1-B
- [ ] W5-06 `incomeinfv2` 金額解釈誤り → PR1-C
- [ ] W5-07 `incomeinfv2` request 形状ずれ → PR1-C
- [ ] W5-08 ORCA記録/医療記録が local-only なのに誤認しやすい → PR5-D
- [ ] W5-09 診療科/医師コードを表示文字列から再解析 → PR1-B

### W6 カルテC

- [ ] W6-01 `/api/orca/chart/subjectives` が official `subjectivesv2` 風だが local-only → PR0-B / PR5-D
- [ ] W6-02 chart patient edit が official `patientmodv2` 風だが local-only → PR2-A / PR5-D
- [ ] W6-03 `/api/orca/patient/mutation` contract が flat / nested で揺れる → PR0-C / PR2-D
- [ ] W6-04 `PATIENTMODV2_OUTPATIENT_*` audit 名が誤認を誘う → PR0-D / PR5-D
- [ ] W6-05 metadata / UI 文言が route 能力を過大表示 → PR0-D / PR4-E / PR5-D
- [ ] W6-06 `subjectives` 成功判定が将来 official warning を扱えない → PR0-E / PR5-D
- [ ] W6-07 `PatientModV2OutpatientResource` の名前と実体がズレる → PR2-B / PR6-C

---

## 3. PR0: 境界・route・契約を先に正す

> 目的  
> official / master / local の境界を public route・DTO・UI metadata で明示し、以後の PR が “誤った名前” の上に積み上がらないようにする。

### 対象ファイル

- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaSubjectiveResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalResource.java`
- `web-client/src/libs/http/httpClient.ts`
- `web-client/src/features/administration/AdministrationPage.tsx`
- `web-client/src/features/administration/orcaInternalWrapperApi.ts`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/PatientMutationRequest.java`
- 必要に応じて新規 DTO / route resource

### 変更内容

#### PR0-A route taxonomy を確定する

- [ ] official ORCA transport 到達 route の prefix を `/api/orca/official/*` へ寄せる
- [ ] ORCA master-backed 参照 route の prefix を `/api/orca/master/*` で統一する
- [ ] local-only wrapper を `/api/local/*` または `/api/admin/internal/*` へ移す
- [ ] `OpenDolphinRestApplication.java` の公開 resource 登録を見直す
- [ ] local-only resource が `/api/orca/*` 名を持たないようにする
- [ ] `PublicRouteInventoryContractTest` を追加・更新し、taxonomy を固定する

**具体修正案**
- `OrcaPatientResource` の `@Path` を `/api/local/patient/mutation` 相当に変更する
- `OrcaSubjectiveResource` の `@Path` を `/api/local/chart/soap-notes` 相当に変更する
- `OrcaMedicalResource` の `@Path` を `/api/local/encounters/{encounterKey}/medical-summary` 相当に変更する
- official resource は `/api/orca/official/...` で統一し、patient / chart-support / report / visit / appointment も整理する
- route 名変更に合わせて web-client API wrapper の path constants を更新する

#### PR0-B local-only UI を official 名から切り離す

- [ ] `subjectives` の API 名 / metadata / card 説明から ORCA official の含意を外す
- [ ] `patient-mutation` の internal wrapper 説明から “保険更新 / 削除 / ORCA反映” の含意を外す
- [ ] `medical-records` / `medical-summary` も local-only と分かる名前にする
- [ ] `AdministrationPage.tsx` の wrapper 表示文言を actual behavior に合わせる

**具体修正案**
- `AdministrationPage.tsx` の `patient-mutation` 説明を「ローカル患者 create/update wrapper（delete 未対応）」に変更
- `chart-subjectives` を「ローカルSOAP保存 wrapper」に変更
- `medical-records` を「ローカル診療サマリ取得 wrapper」に変更
- `httpClient.ts` の metadata 文言も同時に差し替える

#### PR0-C payload contract を一本化する

- [ ] `/api/orca/patient/mutation` 系の flat / nested 揺れを解消する
- [ ] public route は 1 URI 1 schema にする
- [ ] admin/debug と chart/patient UI で同じ request shape を使う
- [ ] DTO 名を operation ごとに分ける

**具体修正案**
- `PatientMutationRequest` は public から外し、local admin 専用なら `LocalPatientMutationRequest` に改名
- official 用には別 DTO を追加:
  - `OfficialPatientCreateRequest`
  - `OfficialPatientUpdateRequest`
  - `OfficialPatientImportRequest`
  - `OfficialPatientSearchRequest`
- chart / patients / administration で同じ DTO を使い回さず、用途別 route に明確に分割する

#### PR0-D audit 名・scope 名を整理する

- [ ] audit action 名を `ORCA_OFFICIAL_*` / `ORCA_MASTER_*` / `LOCAL_*` の 3 系統に分ける
- [ ] local-only flow に `PATIENTMODV2_*` など official 名を使わない
- [ ] observability / operation log で scope を追えるようにする

**具体修正案**
- `PATIENTMODV2_OUTPATIENT_SAVE` → official route 接続後のみ許可
- local patient edit は `LOCAL_PATIENT_EDIT_SAVE`
- local SOAP 保存は `LOCAL_SOAP_SAVE`
- metadata に `scope: "official" | "master" | "local"` を追加

#### PR0-E ORCA result policy を共通化する

- [ ] `Api_Result` の success / warning / error 判定を 1 箇所に寄せる
- [ ] `00` 以外にも warning-success を扱える設計にする
- [ ] `acceptmodv2` / 帳票 / 将来の `subjectivesv2` に共通適用できるようにする

**具体修正案**
- `web-client/src/libs/orca/orcaApiResultPolicy.ts` を新設
- helper 例:
  - `isOrcaSuccess(result: string): boolean`
  - `isOrcaWarning(result: string): boolean`
  - `toOrcaResultKind(result: string): "success" | "warning" | "error"`
- `SoapNotePanel` / `reception/api.ts` / `useOrcaReportPrint.ts` / `orcaIncomeInfoApi.ts` などに適用する

### Done 条件

- [ ] `/api/orca/*` を grep して local-only route が残っていない
- [ ] public route inventory test が通る
- [ ] AdministrationPage の wrapper カードが actual behavior を説明している
- [ ] audit scope 名が official/master/local に分かれている

### grep チェック

- [ ] `grep -R "/api/orca/patient/mutation" -n web-client server-modernized` で public 参照が残っていない
- [ ] `grep -R "PATIENTMODV2_OUTPATIENT" -n web-client server-modernized` で local-only flow に残っていない
- [ ] `grep -R "chart/subjectives" -n web-client server-modernized` が new local path に置き換わっている

---

## 4. PR1: カルテ送信ホットパス（chart send / finish / income）

> 目的  
> 誤送信リスクが高い chart send を official 準拠に寄せ、`medicalmodv23` 誤用・context 推測・金額意味誤認を止める。

### 対象ファイル

- `web-client/src/features/charts/ChartsActionBar.tsx`
- `web-client/src/features/charts/pages/ChartsPage.tsx`
- `web-client/src/features/charts/orcaClaimApi.ts`
- `web-client/src/features/charts/orcaMedicalModApi.ts`
- `web-client/src/features/charts/orcaIncomeInfoApi.ts`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/ChartSupportMedicalModV2Request.java`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/ChartSupportMedicalModV23Request.java`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/ChartSupportIncomeInfoRequest.java`

### 変更内容

#### PR1-A `medicalmodv23` を chart flow から除去する

- [ ] `ChartsActionBar.tsx` の send 成功後 `medicalmodv23` 呼び出しを削除
- [ ] `ChartsActionBar.tsx` の finish 後 `medicalmodv23` 呼び出しを削除
- [ ] “診療終了相当” コメント・命名・トーストを削除
- [ ] `orcaMedicalModApi.ts` を chart flow から参照しない
- [ ] `OrcaChartSupportResource.medicalModV23` を public chart-support surface から外すか、専用 feature 化する
- [ ] `ChartSupportMedicalModV23Request` は専用 feature へ隔離し、chart send からは import しない

**具体修正案**
- `ChartsActionBar.tsx` の `postOrcaMedicalModV23Xml(...)` 呼び出し箇所を完全削除
- 将来必要なら `/api/orca/official/first-calculation-date/*` のような専用 route と UI を新設
- 既存 `medicalmodv23` helper が不要なら削除。残すなら `deprecated/` ではなく `firstCalculationDate/` モジュールへ移動

#### PR1-B `medicalmodv2` の encounter context を canonical 化する

- [ ] `OrcaEncounterContext` を新設し、送信に必要な context を 1 つの型に束ねる
- [ ] `patientId first-match` をやめる
- [ ] `voucherNumber` / `sequentialNumber` / `insuranceCombinationNumber` を encounter 単位で保持する
- [ ] `resolveDepartmentCode` / `resolvePhysicianCode` の表示文字列再解析をやめる
- [ ] `Perform_Date=today fallback` を廃止する
- [ ] context 不足時は ORCA送信ボタンを disable する
- [ ] `Insurance_Combination_Number` を request DTO と XML に追加する

**`OrcaEncounterContext` の必須項目**
- `patientId`
- `visitDate`
- `departmentCode`
- `physicianCode`
- `insuranceCombinationNumber`
- `voucherNumber`
- `sequentialNumber`

**具体修正案**
- `ChartsPage.tsx` で `selectedEntry` から canonical context を組み立てて `ChartsActionBar` に渡す
- `ChartsActionBar.tsx` 側では context を再推測しない
- `fetchVisitContextCodes` を削除または補助 read-only utility に格下げ
- `actionVisitDate` の today fallback を削除し、`visitDate` 未確定なら送信不能メッセージにする
- `ChartSupportMedicalModV2Request` に `insuranceCombinationNumber` を追加
- `OrcaChartSupportSupport.buildMedicalModV2RequestXml()` で `Insurance_Combination_Number` を組む
- `OrcaXmlMapper.toVisitList()` から得ている `Insurance_Combination_Number` を context に持ち回る

#### PR1-C `incomeinfv2` request / parser / UI semantics を正す

- [ ] `ChartSupportIncomeInfoRequest` を official 寄りに作り直す
- [ ] `performDate` を扱えるようにする
- [ ] month/year/date は optional にし、未指定時は official 既定動作へ委ねる
- [ ] parser に `Unpaid_Money_Total` / `Unpaid_Money_Information` を追加
- [ ] `Ic_Money` / `Ac_Money` / `Ai_Money` / `Oe_Money` を UI ラベルへ正しく対応づける
- [ ] `未収 = aiMoney` / `入金 = oeMoney` の誤表示を廃止
- [ ] `OrcaSummary.tsx` で ORCA収納情報とローカル診療サマリを表示分離する

**推奨表示ラベル**
- `Ic_Money` → 入金額
- `Ac_Money` → 請求額
- `Ai_Money` → 保険適用額
- `Oe_Money` → 自費額
- `Unpaid_Money_Total` → 未収合計

**具体修正案**
- `orcaIncomeInfoApi.ts` の request builder を `buildIncomeInfoRequest` から official 形へ更新
- `OrcaChartSupportSupport.buildIncomeInfoRequestXml()` から `Request_Number=01` を外す方向で調整し、sample 準拠を優先
- `parseIncomeInfoResponse()` に未収フィールドを追加
- `OrcaSummary.tsx` の card を分ける:
  - `ORCA収納情報`
  - `ローカル診療サマリ`

### Done 条件

- [ ] `medicalmodv23` が chart send / finish から完全に消えている
- [ ] encounter context 不足時は送信不能
- [ ] `Insurance_Combination_Number` が request に含まれる
- [ ] today fallback が消えている
- [ ] `incomeinfv2` UI が official 金額意味と一致する

### テスト

- [ ] `ChartsActionBar` unit test: `medicalmodv23` が呼ばれない
- [ ] `ChartsActionBar` unit test: `visitDate` 欠如時に send disable
- [ ] XML contract test: `medicalmodv2` request に `Insurance_Combination_Number` が入る
- [ ] parser test: `incomeinfv2` の各 money field が正しい key に入る
- [ ] UI test: `OrcaSummary` ラベルが新 semantics になる

### grep チェック

- [ ] `grep -R "medicalmodv23" -n web-client/src/features/charts server-modernized/src/main/java/open/dolphin/rest/orca`
- [ ] `grep -R "today fallback" -n web-client/src/features/charts`
- [ ] `grep -R "Insurance_Combination_Number" -n web-client server-modernized api-contract`

---

## 5. PR2: 患者導線を official create / update / import に再編する

> 目的  
> 患者画面と chart 画面の患者編集を official patient API に揃え、local-only なのに ORCA反映と見える状態を止める。

### 対象ファイル

- `web-client/src/features/patients/PatientsPage.tsx`
- `web-client/src/features/patients/api.ts`
- `web-client/src/features/charts/PatientInfoEditDialog.tsx`
- `web-client/src/features/outpatient/orcaPatientImportApi.ts`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/PatientModV2OutpatientOrcaCoordinator.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/OrcaPatientApiResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientSyncResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/OpenDolphinRestApplication.java`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/PatientModV2OutpatientResourceIdempotencyTest.java`
- `api-contract/src/main/java/open/dolphin/rest/dto/orca/*Patient*`

### 変更内容

#### PR2-A PatientsPage の役割を “新患登録 / ORCA既存患者取込 / 既存患者更新” に分ける

- [ ] `PatientsPage.tsx` の UI モードを明示分割する
- [ ] 「保存（ORCAへ反映）」は official route に接続した場合のみ表示する
- [ ] local-only 保存導線を削除するか admin/debug 専用へ退避する
- [ ] chart からの `PatientInfoEditDialog` も同じ official update route を使う
- [ ] 保存成功後に `patientgetv2` または `patientlst2v2` で再取得して local upsert する

**推奨 route**
- `POST /api/orca/official/patientmodv2/create`
- `POST /api/orca/official/patientmodv2/update`
- `POST /api/orca/official/patientlst2v2/import`

**具体修正案**
- `savePatient()` を廃止し、用途別関数に分割:
  - `createOfficialPatient()`
  - `updateOfficialPatient()`
  - `importOfficialPatientById()`
- `PatientInfoEditDialog.tsx` は `updateOfficialPatient()` を使う
- `OrcaPatientResource` は local admin 専用 route に移し、patient/charts からは参照しない

#### PR2-B `patientmodv2 class=01` create を実装する

- [ ] `PatientModV2OutpatientResource` の create を import ではなく official create へ変更する
- [ ] `Patient_ID='*'` 自動採番を既定にする
- [ ] 手入力 patientId は本当に必要な場合だけ optional で許可する
- [ ] create 成功後は canonical patient を再取得して local 同期する
- [ ] `PatientModV2OutpatientResource` の名前が update/import 専用なら rename も実施する

**具体修正案**
- `handleCreate()` を `patientmodv2 class=01` request builder に差し替える
- `PatientModV2OutpatientSupport` に create 用 `buildPatientCreatePayload()` を追加
- update helper との混同を避けるため class 分岐を明示する
- route 名は generic ではなく operation 単位に分ける

#### PR2-C 患者検索の local / official 境界を見える化する

- [ ] `PatientsPage` の一覧検索を “ローカル患者検索” と明示する
- [ ] local search で使っていない `departmentCode` / `physicianCode` / `paymentMode` を request から外す
- [ ] official name search が必要なら別ダイアログで `patientlst3v2` を使う
- [ ] search API 名 / helper 名 / placeholder を local search に寄せる

**具体修正案**
- `fetchPatients()` の request body から未使用条件を削除
- `PatientsPage` の検索フォーム文言を `ローカル患者検索` に変更
- official ORCA search は `Search in ORCA` モーダルなど別導線に分離

#### PR2-D request contract の揺れを解消する

- [ ] chart / patients / admin すべてで official update request shape を統一する
- [ ] flat / nested 混在を解消する
- [ ] tests も新 contract に合わせて更新する

**具体修正案**
- official route は flat JSON なら flat に統一
- `api-contract` / `web-client` / `server tests` を全部同じ schema に揃える
- `PatientModV2OutpatientResourceIdempotencyTest` と `OrcaPatientResourceIdempotencyTest` の URI / payload を衝突しないように分離する

### Done 条件

- [ ] 患者画面と chart 画面が official update route を使っている
- [ ] local-only route を “ORCAへ反映” と見せる箇所がない
- [ ] create/update/import が別 route / 別 DTO で分離されている
- [ ] local search は local と明示されている

### テスト

- [ ] `PatientsPage` UI test: 新患登録 / 既存更新 / ORCA取込が分岐する
- [ ] `PatientInfoEditDialog` UI test: official update route 呼び出し
- [ ] resource test: create は `patientmodv2 class=01`
- [ ] resource test: update は `patientmodv2 class=02`
- [ ] resource test: success 後に canonical re-fetch が走る
- [ ] inventory test: old local mutation route が public 患者導線に残らない

### grep チェック

- [ ] `grep -R "ORCAへ反映" -n web-client/src/features/patients web-client/src/features/charts`
- [ ] `grep -R "savePatient(" -n web-client/src`
- [ ] `grep -R "/api/orca/patient/mutation" -n web-client/src/features/patients web-client/src/features/charts`

---

## 6. PR3: 受付を official 準拠に戻す

> 目的  
> 受付ホットパスの仕様不一致を潰し、患者氏名検索・受付登録/取消・来院一覧の意味を official 準拠に揃える。

### 対象ファイル

- `web-client/src/features/reception/api.ts`
- `web-client/src/features/reception/patientSearchApi.ts`
- `web-client/src/features/reception/pages/ReceptionPage.tsx`
- `web-client/src/features/reception/__tests__/acceptmodv2.test.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPatientBatchResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/DefaultOrcaLiveGateway.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaLiveGatewaySupport.java`
- `server-modernized/src/main/java/open/dolphin/orca/service/OrcaLiveGatewayMutationSupport.java`
- `server-modernized/src/main/java/open/dolphin/orca/converter/OrcaXmlMapper.java`
- 必要に応じて `system01lstv2` 用 read API

### 変更内容

#### PR3-A `acceptmodv2` result mapping を修正する

- [ ] `Api_Result=21` を保険不一致として扱う
- [ ] `Api_Result=60` を受付なしとして扱う
- [ ] `Api_Result_Message` を最優先表示する
- [ ] mock / unit test / toast 文言を全部同時修正する

**具体修正案**
- `reception/api.ts` の result normalization を修正
- `ReceptionPage.tsx` の toast/message helper を修正
- `acceptmodv2.test.ts` の期待値を書き換える
- 独自文言は “補助説明” とし、ORCA の原文を消さない

#### PR3-B `patientlst3v2` request を official 形へ作り直す

- [ ] endpoint を `patientlst3v2?class=01` にする
- [ ] request root を `<patientlst3req type="record">` にする
- [ ] `WholeName` を必須にする
- [ ] `Birth_StartDate` / `Birth_EndDate` / `Sex` / `InOut` を official payload に正しく流す
- [ ] `fuzzyMode` を廃止するか、`*` 付加の前方一致ルールへ改名する
- [ ] `inOut` の UI 必須化をやめる
- [ ] `Api_Result=91` の独自解釈をやめる

**具体修正案**
- `patientSearchApi.ts` の request type から `fuzzyMode` を削除
- `ReceptionPage.tsx` の “区分未選択なら検索不可” を削除
- `OrcaLiveGatewaySupport.buildPatientSearchPayload()` を official XML builder に差し替える
- `DefaultOrcaLiveGateway.searchPatients()` の endpoint query を `class=01` 固定にする
- カナ検索 tag 名は live contract test で確認できるまで safe side で off にするか、local search に限定する

#### PR3-C `visitptlstv2` に診療科フィルタを通す

- [ ] UI が診療科絞り込みを持つなら request に `Department_Code` を渡す
- [ ] 施設全体一覧が要件なら UI から診療科絞り込み期待を外す
- [ ] `patientId first-match` 系の補助ロジックと食い違わないよう統一する

**具体修正案**
- `fetchAppointmentOutpatients()` から visits list へ `departmentCode` を渡す
- `buildVisitListPayload()` に `Department_Code` を追加
- XML mapper / request DTO を更新

#### PR3-D `Medical_Information` 固定 `01` をやめる

- [ ] `system01lstv2` class=06 を参照する read API を用意する
- [ ] `Medical_Information` を選択 UI 化する
- [ ] 未選択時は tag を送らず ORCA 既定動作へ委ねる
- [ ] `resolveMedicalInformation` の固定 `01` ロジックを削除する

**具体修正案**
- `ReceptionPage.tsx` に診療内容選択 dropdown を追加
- `system01lstv2` 読み込み helper を追加
- 互換のために固定 `01` を残さない

#### PR3-E `appointlstv2` local DTO の掃除

- [ ] `departmentCode` を appointment request DTO から削除する
- [ ] client-side filter が必要なら別名にする
- [ ] official request と local filter を混同させない

#### PR3-F workaround を client から追い出す

- [ ] `Acceptance_Push` suppress を explicit server config 化する
- [ ] `0001 -> 10001` physician code hack を削除するか server 設定で明示する
- [ ] client は canonical code 以外を勝手補完しない
- [ ] docs に environment-specific workaround を明記する

**具体修正案**
- `shouldSuppressAcceptancePush()` を削除
- `normalizePhysicianCode()` を削除
- 必要なら `OrcaTransportSettings` / `OrcaVisitResource` 側に feature flag を追加し、default off

#### PR3-G reception の役割を既存患者受付に限定する

- [ ] 新患作成は PatientsPage に寄せる
- [ ] reception UI から新患受付を匂わせる文言を外す
- [ ] 新患が必要なときは PatientsPage へ誘導する

### Done 条件

- [ ] `acceptmodv2` の 21/60 が正しい
- [ ] `patientlst3v2` request が official 形
- [ ] `Medical_Information` 固定 01 が消える
- [ ] client 側の勝手補完/hack が残っていない
- [ ] reception の役割が既存患者受付に明示されている

### テスト

- [ ] `acceptmodv2.test.ts` を全面更新
- [ ] XML contract test: `patientlst3v2?class=01`
- [ ] XML contract test: `visitptlstv2` に `Department_Code`
- [ ] UI test: `inOut` 未選択でも患者検索可能
- [ ] UI test: `Medical_Information` 選択 / 未選択の両分岐
- [ ] server test: `Acceptance_Push` suppress が explicit config のときだけ効く

### grep チェック

- [ ] `grep -R "fuzzyMode" -n web-client server-modernized`
- [ ] `grep -R "normalizePhysicianCode" -n web-client`
- [ ] `grep -R "shouldSuppressAcceptancePush" -n web-client`
- [ ] `grep -R "受付なし" -n web-client/src/features/reception`

---

## 7. PR4: 管理画面を actual behavior ベースに再設計する

> 目的  
> ORCA users / connection / master updates / internal wrappers の official/local 境界を管理画面上で正しく見せる。

### 対象ファイル

- `web-client/src/features/administration/AdministrationPage.tsx`
- `web-client/src/features/administration/orcaConnectionApi.ts`
- `web-client/src/features/administration/orcaUserAdminApi.ts`
- `web-client/src/features/administration/orcaInternalWrapperApi.ts`
- `web-client/src/features/administration/OrcaUserManagementPanel.tsx`
- `web-client/src/features/administration/MasterUpdatesPanel.tsx`
- `web-client/src/features/administration/masterUpdateApi.ts`
- `web-client/src/features/administration/delivery/WebOrcaConnectionCard.tsx`
- `web-client/src/features/administration/delivery/OrcaInternalWrapperCard.tsx`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionTestSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/AdminMasterUpdateResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/masterupdate/MasterUpdateCatalog.java`
- `server-modernized/src/main/java/open/dolphin/rest/masterupdate/MasterUpdateArtifacts.java`
- `server-modernized/src/main/java/open/dolphin/rest/masterupdate/MasterUpdateService.java`
- `server-modernized/src/main/java/open/dolphin/orca/push/OrcaPushClient.java`
- `../../../../docs/operations/ORCA_CERTIFICATION_ONLY.md`

### 変更内容

#### PR4-A `manageusersv2` create/update を official 準拠にする

- [ ] create から `User_Number` を外す
- [ ] update から `New_Group_Number` / `New_User_Number` / `New_Administrator_Privilege` を外す
- [ ] mutable field だけ update で送る
- [ ] create 後は ORCA 再読込で採番済み `User_Number` を返す
- [ ] UI で `staffClass` / `staffNumber` の create-only / read-only を徹底する

**具体修正案**
- `AdminOrcaUserSupport.buildCreateRequestXml()` から `User_Number` 削除
- `AdminOrcaUserSupport.buildUpdateRequestXml()` を official 項目へ修正
- `OrcaUserManagementPanel.tsx` で update フォームから変更不能項目を readOnly / disable
- `orcaUserAdminApi.ts` の create/update DTO を分割

#### PR4-B auth / sync 文言を正す

- [ ] “今すぐ同期” を “ORCAユーザ再取得” に改名する
- [ ] `syncOrcaUsers()` を `reloadOrcaUsers()` に改名する
- [ ] “認証済み” を `管理画面権限確認済み` と `ORCA接続テスト成功` に分ける
- [ ] local admin session と ORCA auth 成功を混同させない

#### PR4-C push 設定を UI に出す

- [ ] `pushUrl` / `pushTenantId` を API 型に追加する
- [ ] `WebOrcaConnectionCard.tsx` に入力欄を出す
- [ ] server capability と UI capability を一致させる
- [ ] 未サポートにするなら server から field 自体を消して docs に明記する  
      ※今回は production 前提なので **UI に正式対応** を推奨

#### PR4-D master updates を 2 面に分離する

- [ ] official `masterlastupdatev3` 取得部分を独立カード化する
- [ ] local artifact history / rollback / upload を別カード化する
- [ ] `手動更新` などの文言が official ORCA 側更新実行に見えないようにする
- [ ] `masterlastupdatev3` request から独自 `Request_Number=01` を外す方向で修正する

#### PR4-E internal wrapper カードを capability-driven にする

- [ ] `GET /api/admin/orca/capabilities` を追加する
- [ ] 実装されていない wrapper は UI に出さない
- [ ] `medical-sets` / `birth-delivery` の current status を capability で表現する
- [ ] `patient-mutation` の説明を local-only に修正する
- [ ] “一括疎通（グループ）” を “ローカル/ORCA混在診断” に改名する

### Done 条件

- [ ] `manageusersv2` create/update XML が official 準拠
- [ ] UI で変更不能項目が編集できない
- [ ] sync / auth / master updates / internal wrapper の文言が actual behavior と一致
- [ ] push 設定が UI から扱える
- [ ] capability-driven に未実装 wrapper が隠れる

### テスト

- [ ] XML contract test: `manageusersv2` create
- [ ] XML contract test: `manageusersv2` update
- [ ] UI test: update form で staffNumber/staffClass が readOnly
- [ ] UI test: sync ボタン文言・auth 表示
- [ ] UI test: pushUrl/pushTenantId の表示保存
- [ ] master update resource test: request sample 準拠

### grep チェック

- [ ] `grep -R "今すぐ同期" -n web-client`
- [ ] `grep -R "認証済み" -n web-client/src/features/administration`
- [ ] `grep -R "User_Number" -n server-modernized/src/main/java/open/dolphin/rest/AdminOrcaUserSupport.java`
- [ ] `grep -R "New_Group_Number\|New_User_Number\|New_Administrator_Privilege" -n server-modernized`

---

## 8. PR5: カルテ支援 API・local-only UI・命名を整理する

> 目的  
> W4/W5/W6 の “official に見えるが実体は違う” 問題を潰し、support API は本当に support させる。

### 対象ファイル

- `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
- `web-client/src/features/charts/orcaMedicationGetApi.ts`
- `web-client/src/features/charts/orcaOrderInteractionApi.ts`
- `web-client/src/features/charts/soap/subjectiveChartApi.ts`
- `web-client/src/features/charts/SoapNotePanel.tsx`
- `web-client/src/features/charts/soap/SubjectivesPanel.tsx`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/MedicalOutpatientRecordPanel.tsx`
- `web-client/src/features/charts/api.ts`
- `web-client/src/features/charts/PatientsTab.tsx`
- `web-client/src/libs/http/httpClient.ts`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleResource.java`
- `server-modernized/src/main/java/open/dolphin/orca/read/OrcaOrderInteractionReadService.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaSubjectiveResource.java`
- `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaMedicalResource.java`

### 変更内容

#### PR5-A 一般オーダー画面の “禁忌チェック” を本当に official に接続する

- [ ] `OrderBundleEditPanel.tsx` の stub `runContraindicationCheck()` を廃止する
- [ ] client API wrapper を追加して `OrcaChartSupportResource.contraindicationCheck` を呼ぶ
- [ ] 必要 request (`patientId`, `performMonth`, `checkTerm`, `Medical_Information_child`) を組む
- [ ] 結果を UI に表示する
- [ ] 必須要件なら fail-closed、任意要件なら “未実行” を明示する

#### PR5-B `medicationgetv2` 01/02 両モードを正しく扱う

- [ ] `requestNumber` ごとに `requestCode` validation を分岐する
- [ ] `01` は入力コード、`02` は 9桁診療行為コードにする
- [ ] UI で lookup モードを明示分離する
- [ ] parser に `Condition_Category` / `Not_Use_Comment` / `Process_Category` / `Selection_Grep_Name` を保持する
- [ ] 必要に応じて UI で非表示でもよいが、parser で捨てない

#### PR5-C static interaction check の命名を正す

- [ ] `orcaOrderInteractionApi.ts` の機能名を static / master-based であると分かる名前に変える
- [ ] `PrescriptionOrderEditorPanel.tsx` の画面文言も official 禁忌チェックと混同しないようにする
- [ ] official patient-aware check が必要な場合は PR5-A の結果と併記する

**具体修正案**
- 例: `checkOrcaOrderInteractions` → `checkOrcaMasterInteractionPairs`
- 例: UI ラベル `相互作用事前チェック（マスタ）`

#### PR5-D subjectives / local summary / local patient mutation の命名を正す

- [ ] `subjectiveChartApi.ts` を local SOAP 保存名へ寄せる
- [ ] `SoapNotePanel.tsx` の “症状詳記（ORCA）” 見出しをやめる
- [ ] `SubjectivesPanel.tsx` の placeholder も local scope に書き換える
- [ ] `MedicalOutpatientRecordPanel.tsx` と `fetchChartsMedicalSummary()` の表示を local summary と明示する
- [ ] `PatientsTab.tsx` / `PatientInfoEditDialog.tsx` から official 風の audit / 文言を हटす
- [ ] `httpClient.ts` metadata も揃える

### Done 条件

- [ ] 一般オーダーの禁忌チェックが本当に official route を叩く
- [ ] `medicationgetv2` 01/02 が contract 一致
- [ ] static master check と official patient-aware check が UI で区別できる
- [ ] subjectives / local summary / local patient mutation が official 風に見えない

### テスト

- [ ] `OrderBundleEditPanel` test: contraindication API が呼ばれる
- [ ] `orcaMedicationGetApi` test: `01` は英数字入力コードを許可
- [ ] parser test: extra fields を落とさない
- [ ] UI test: “症状詳記（ORCA）” が消える
- [ ] UI test: `MedicalOutpatientRecordPanel` が local summary 表示になる

### grep チェック

- [ ] `grep -R "症状詳記（ORCA）" -n web-client`
- [ ] `grep -R "runContraindicationCheck" -n web-client`
- [ ] `grep -R "^\s*return true;\s*$" -n web-client/src/features/charts/OrderBundleEditPanel.tsx`
- [ ] `grep -R "PATIENTMODV2_" -n web-client/src/features/charts`

---

## 9. PR6: テスト・docs・運用ドキュメント・リリース手順

> 目的  
> 再発防止と引き継ぎのため、契約テスト・UI テスト・docs を新設計に揃える。

### 対象ファイル

- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/*`
- `web-client/src/features/**/__tests__/*`
- `docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md`
- `../../../../web-client/notes/ui-current-contract.md`
- `../../../../web-client/notes/orca-order-remediation-20260403.md`
- `../../../../web-client/notes/orca-order-contract-cleanup-20260404.md`
- `../../../../web-client/notes/orca-charge-canonicalization-20260404.md`
- `../../../../docs/contracts/orca-master-api.md`
- `../../../../docs/operations/ORCA_CERTIFICATION_ONLY.md`
- 必要に応じて `../../../../docs/releases/orca-remediation-cutover.md` 新設

### 変更内容

#### PR6-A XML contract tests を整備する

- [ ] `manageusersv2` create/update/list/delete の XML snapshot test を追加
- [ ] `patientlst3v2` request XML test を追加
- [ ] `visitptlstv2` request XML test を追加
- [ ] `medicalmodv2` request XML test を追加
- [ ] `incomeinfv2` request XML / parser test を追加
- [ ] `contraindicationcheckv2` request XML test を追加
- [ ] `medicationgetv2` 01/02 両モード test を追加

#### PR6-B UI / integration tests を整備する

- [ ] `PatientsPage` の create/update/import フロー test
- [ ] `PatientInfoEditDialog` official update test
- [ ] `ReceptionPage` `acceptmodv2` result mapping test
- [ ] `ReceptionPage` official patient search test
- [ ] `ChartsActionBar` send precondition test
- [ ] `OrcaSummary` labels / cards test
- [ ] `AdministrationPage` wording / capability test
- [ ] `SoapNotePanel` local-only wording test

#### PR6-C docs を新実装に合わせる

- [ ] architecture docs を route taxonomy / screen responsibility に合わせて更新
- [ ] `ui-current-contract.md` を public route と schema に合わせて更新
- [ ] ORCA order remediation / canonicalization notes を新設計で更新
- [ ] `orca-master-api.md` に master-backed の位置づけを明記
- [ ] `ORCA_CERTIFICATION_ONLY.md` を current cloud 前提へ更新
- [ ] route 変更・互換廃止・同時リリース前提を書いた cutover doc を新設する

#### PR6-D 可観測性と運用手順を仕上げる

- [ ] log / audit に `scope` を出す
- [ ] official 失敗と local wrapper 失敗をログで区別できるようにする
- [ ] リリース順序を明文化する
- [ ] rollback 方法を PR / deploy レベルで定義する  
      ※ API 互換は切るので server / web-client のペアリリース必須

**推奨 cutover 手順**
- [ ] server 新版をデプロイ
- [ ] web-client 新版を即時デプロイ
- [ ] route inventory health check 実施
- [ ] 管理画面 connection test 実施
- [ ] 受付 patient search / accept / cancel を smoke test
- [ ] 患者 update / import / create を smoke test
- [ ] chart send / report / income summary を smoke test
- [ ] admin manageusers create/update/delete を smoke test

### Done 条件

- [ ] contract tests / UI tests / docs が揃っている
- [ ] route 互換を切る前提の cutover 手順がある
- [ ] 監査・ログで official/master/local が追える

---

## 10. 実装順・並行実行戦略

### 10-1. 実装順

1. [ ] PR0 境界・契約
2. [ ] PR1 chart send / income
3. [ ] PR2 patient official flows
4. [ ] PR3 reception official compliance
5. [ ] PR4 administration official compliance
6. [ ] PR5 chart support / naming
7. [ ] PR6 tests/docs/cutover

### 10-2. 並行してよいもの

- [ ] PR4 と PR5 は PR0 完了後なら並行可
- [ ] PR6 の docs 下書きは PR1〜PR5 と並行可
- [ ] ただし PR1 と PR2 と PR3 は route / DTO 依存が強いので PR0 後に順番を守る

### 10-3. 先に止血すべき hotfix

- [ ] `medicalmodv23` の chart flow 除去
- [ ] `Perform_Date=today fallback` 削除
- [ ] `acceptmodv2` 21/60 修正
- [ ] PatientsPage の “ORCAへ反映” 文言是正 or official route 接続
- [ ] `manageusersv2` create/update XML 修正

---

## 11. 実装時の判断ルール（迷ったらこれで決める）

- [ ] official 仕様にない項目は送らない
- [ ] official か不明な項目は UI から隠す / local-only へ寄せる
- [ ] local-only を ORCA 名で見せない
- [ ] 画面が使う値は display string から再解析しない
- [ ] “推測で補完して送る” より “送信停止して不足を見せる” を優先する
- [ ] 更新成功後は canonical source 再取得で確定させる
- [ ] warning と error を同一扱いしない
- [ ] contract が揺れる route を残さない
- [ ] public route は tests で inventory 固定する
- [ ] docs 更新を後回しにしない

---

## 12. 最終確認チェックリスト（全 PR 完了後）

### route / naming

- [ ] `/api/orca/official/*` に local-only route が存在しない
- [ ] `/api/local/*` が official 風名称を持たない
- [ ] `AdministrationPage` / `PatientsPage` / `Charts` / `Reception` の文言が actual behavior と一致
- [ ] audit scope が official/master/local に分かれている

### official API

- [ ] `medicalmodv23` は chart flow から消えた
- [ ] `medicalmodv2` に `Insurance_Combination_Number` が載る
- [ ] `acceptmodv2` 21/60 解釈が正しい
- [ ] `patientlst3v2` が `class=01` + `<patientlst3req>`
- [ ] `manageusersv2` create/update XML が official 準拠
- [ ] `contraindicationcheckv2` が UI から呼ばれる
- [ ] `medicationgetv2` 01/02 がどちらも contract 一致
- [ ] `incomeinfv2` 金額表示が official と一致

### local/master 境界

- [ ] local patient search は local と明示
- [ ] subjectives は local SOAP 保存と明示
- [ ] local medical summary は local summary と明示
- [ ] master address / hokenja は master-backed として説明される

### tests/docs

- [ ] contract tests pass
- [ ] UI tests pass
- [ ] docs updated
- [ ] cutover doc updated

---

## 13. 実装完了時に提出させるべき成果物

- [ ] 変更ファイル一覧
- [ ] route 変更一覧
- [ ] DTO 変更一覧
- [ ] XML contract test の差分一覧
- [ ] UI 文言変更一覧
- [ ] 主要 smoke test 結果
- [ ] 未解決論点（ゼロが理想）
- [ ] cutover / rollback 手順書
