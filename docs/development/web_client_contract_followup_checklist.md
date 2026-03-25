# Phase2 Web-client 契約追随 実装チェックリスト
## 対象
`web-client` を、現行 `server-modernized` 契約に追随させる。  
最優先対象は **`/api/orca/medical/outpatient`** と **`/api/orca/deptinfo`** への依存除去である。

---

## 1. このタスクのゴール

- web-client から **server 側で blocked route 扱いになっている endpoint 参照をゼロにする**
- ORCA live / local projection の境界を web-client 側でも明確化する
- 実装担当者が **route を推測して補う** ことなく、現物契約に沿って迷わず作業できる状態にする
- mocks / tests / endpoint registry / audit 文言まで含めて **同じ契約に揃える**
- 後続の EncounterResource / ScheduleResource 連携に備えて、必要なら context / type の受け皿を整える

---

## 2. 先に固定するべき前提

### 2.1 server 契約を正本とする
作業中に判断が割れたら、以下を正本にする。

- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- `server-modernized/src/test/java/open/dolphin/rest/WebXmlEndpointExposureTest.java`
- `phase2_manager_handoff_package_v1/02_SOURCE_DOCS/phase2a_a1_business_state_machine_design.md`
- `phase2_manager_handoff_package_v1/02_SOURCE_DOCS/phase2a_a3_orca_boundary_design_report.md`

### 2.2 このタスクで守る禁止事項
以下は **禁止**。

- blocked route を web-client に残すこと
- blocked route を定数化だけして “今は未使用” の状態で残すこと
- mocks / tests だけに blocked route を残すこと
- server bundle に存在しない新 endpoint を **推測で追加すること**
- local projection 用データに ORCA namespace の route 名を再利用すること
- `finish` をそのまま `bill` へ短絡マッピングすること
- “後方互換のため” として legacy route 互換レイヤを残すこと

### 2.3 今回のタスクで採る実装方針
- **後方互換は考慮しない**
- **production 前提で整理する**
- server 置換 endpoint が現 bundle に無い箇所は、**推測で埋めず fail-closed / local-only / placeholder** で収める
- task を止めない。server 側不足があっても、web-client 側で進められる契約追随は先に完了させる

---

## 3. 現在確認できている事実

### 3.1 server 側で blocked 扱いの route
少なくとも以下は blocked。

- `POST /api/orca/medical/outpatient`
- `POST /api/orca/local-medical/outpatient`
- `GET /api/orca/deptinfo`

### 3.2 server 側で現 bundle に存在する relevant route
少なくとも以下は存在。

- `GET /api/schedules/{scheduleKey}`
- `GET /api/encounters/{encounterKey}`
- `POST /api/encounters/{encounterKey}/transitions`
- `GET /api/local-summary/diagnoses/{patientId}`
- `POST /api/local-summary/diagnoses`

### 3.3 handoff / A1 / A3 から確定している境界
- `/api/orca/medical/outpatient` が local aggregated summary を返す設計は誤り
- local projection API は ORCA namespace を使わない
- ORCA live API は local fallback を返さない
- state transition は `/encounters/{encounterKey}/transitions` 系へ寄せるのが目標
- ただし billed trigger source は A1 調査段階で未確定であり、`finish -> bill` を今ここで固定してはいけない

### 3.4 現在の web-client に残っている blocked route 参照
#### `/api/orca/medical/outpatient`
- `src/features/charts/api.ts`
- `src/features/charts/ChartsActionBar.tsx`
- `src/features/charts/__tests__/chartsActionBar.test.tsx`
- `src/libs/http/httpClient.ts`
- `src/mocks/handlers/outpatient.ts`

#### `/api/orca/deptinfo`
- `src/features/reception/pages/ReceptionPage.tsx`
- `src/mocks/handlers/orcaDeptInfo.ts`

### 3.5 重要な実装上の現況
- `ChartsActionBar` の `finish` は、現在 **read 用 legacy summary route** を擬似的な完了 API のように叩いている
- `OrcaMedicalOutpatientResource` は read-only summary resource であり、business transition API ではない
- `ChartsPage` の summary query は現在 ORCA 名義の summary 取得に依存している
- `ReceptionPage` は `departmentCodeMap` を既に `appointmentQuery.data.raw` から作れているため、`deptinfo` 除去は web-client 単独で実施可能
- 現在の web-client には `scheduleKey` / `encounterKey` の型受け皿がほぼ無い
- 現 bundle の server 側には、local outpatient summary 用の明示 replacement route が **見当たらない**

---

## 4. 作業スコープ

### 4.1 このタスクに含めるもの
- blocked route 参照除去
- Charts / Reception の契約追随
- route 依存の mocks / tests / endpoint registry / audit 文言の更新
- 必要最小限の UI 文言・query 名・helper 名の中立化
- repo guard の追加（再混入防止）
- 必要なら `scheduleKey` / `encounterKey` の optional な受け皿追加

### 4.2 このタスクに含めないもの
- server 側に新 endpoint を実装すること
- encounter transition の最終仕様決定
- billed trigger の仕様決定
- ORCA upstream 仕様の再調査
- 実装担当の裁量で public contract を増やすこと

---

## 5. 作業前の開始チェック

- [ ] 作業ブランチを作成する
- [ ] baseline として以下 grep 結果を保存する  
  `grep -RInE "/api/orca/medical/outpatient|/api/orca/deptinfo|/api/orca/local-medical/outpatient|/api/orca/disease/" src`
- [ ] 変更対象ファイル一覧を作業メモへ転記する
- [ ] `server` bundle に local outpatient summary replacement route が無いことを再確認する
- [ ] `finish != bill` を作業メモへ明記する
- [ ] “推測 endpoint を追加しない” を作業メモへ明記する

---

## 6. 実装チェックリスト

# Workstream A. Reception から `/api/orca/deptinfo` を除去する

## A-1. 依存の削除
- [ ] `src/features/reception/pages/ReceptionPage.tsx` から `httpFetch('/api/orca/deptinfo')` 呼び出しを削除する
- [ ] `deptInfoOptions` state を削除する
- [ ] `parseDeptInfo()` を削除する
- [ ] `fetchDeptInfo()` effect を削除する
- [ ] 依存配列や未使用 import を整理する

## A-2. department option 生成ロジックを local data only に寄せる
- [ ] `departmentCodeMap` は残す
- [ ] `departmentOptions` は以下の source のみで再構成する  
  1. `appointmentQuery.data.raw` から作る `departmentCodeMap`  
  2. `visibleAppointmentEntries` から拾う coded/uncoded department 表現  
  3. 必要なら `selectedEntry` / 患者検索選択結果など現在 UI で保持済みの local data
- [ ] coded department 文字列（例: `01 内科`）は、現在の `leadingMatch` と同等の規則で code/name を抽出する
- [ ] code だけしか取れない場合は `code -> code` で保持する
- [ ] dedupe は code 単位で行う
- [ ] locale sort (`ja`) を維持する
- [ ] 上限 200 件を維持する
- [ ] source が空でも `01` fallback を維持する

## A-3. 既存の受診受付補助を壊さない
- [ ] `applyAcceptAutoFill()` の department 補完が引き続き動くことを確認する
- [ ] `selectedEntry.department` と `departmentCodeMap.get(entry.department)` の優先関係を壊さない
- [ ] 診療科 select が 1 件だけのときの auto select 挙動を維持する
- [ ] 診療科 select が複数件のときの表示を維持する

## A-4. mock / handler を削除する
- [ ] `src/mocks/handlers/orcaDeptInfo.ts` を削除する
- [ ] `src/mocks/handlers/index.ts` から `orcaDeptInfoHandlers` import / registration を削除する
- [ ] 参照切れがないことを確認する

## A-5. Reception テストを更新する
- [ ] `src/features/reception/__tests__/ReceptionPage.test.tsx` の関連テストを確認する
- [ ] `deptinfo` に依存しないことを保証するテストを追加または更新する
- [ ] 少なくとも以下を確認できるテストを持つ  
  - [ ] `appointmentQuery.data.raw` に code/name があると department option を構成できる  
  - [ ] visible entry の `01 内科` 形式から code/name を補完できる  
  - [ ] source が空でも `01` fallback になる  
  - [ ] accept workflow の department auto-fill が動く

## A-6. 完了条件
- [ ] `grep -RIn "/api/orca/deptinfo" src` が 0 件
- [ ] ReceptionPage が compile / test / build を通る
- [ ] 診療科 select が local data のみで成立する

---

# Workstream B. Charts summary から `/api/orca/medical/outpatient` を除去する

## B-1. 命名を中立化する
**必須**: route 除去と同時に、UI / audit / query の命名を ORCA read summary 固定から外す。

- [ ] `fetchOrcaOutpatientSummary` を中立名へ変更する  
  推奨: `fetchChartsMedicalSummary`
- [ ] `orcaSummaryQuery` / `orcaSummaryQueryKey` を中立名へ変更する  
  推奨: `medicalSummaryQuery`
- [ ] audit action `ORCA_MEDICAL_OUTPATIENT_FETCH` を中立名へ変更する  
  推奨: `CHARTS_MEDICAL_SUMMARY_FETCH`
- [ ] `description: 'medical_outpatient_summary'` を中立名へ変更する  
  推奨: `charts_medical_summary`
- [ ] route 名を落としたあとも ORCA 固定と誤解しやすい命名が残っていないか grep する

> 注: `OrcaOutpatientSummary` 型名の全面 rename は optional。  
> ただし function / query / audit 名は今回の task で中立化すること。

## B-2. blocked route 候補を除去する
- [ ] `src/features/charts/api.ts` から `/api/orca/medical/outpatient` 候補を削除する
- [ ] `fetchWithResolver` の candidate に guessed path を追加しない
- [ ] server bundle に存在しない local summary endpoint を追加しない

## B-3. replacement 不在時の安全な挙動を実装する
現 bundle には local outpatient summary replacement route が見当たらない。  
したがって、**この task では route を推測しない**。以下のどちらかで収める。

### 推奨案
- [ ] `buildUnavailableMedicalSummary()` のような pure helper を作る
- [ ] helper は少なくとも以下を返す  
  - [ ] `runId` は observability から解決できるようにする  
  - [ ] `recordsReturned: 0`  
  - [ ] `outcome: 'MISSING'` または同等の非エラー結果  
  - [ ] `sourcePath: 'contract_removed'` など route 非依存の識別子  
  - [ ] `payload: { outpatientList: [] }`
- [ ] panel 側が “取得中” で永遠に止まらず、**表示対象なし** として描画できることを確認する
- [ ] error 扱いにしない。contract replacement 不在は、ネットワーク障害ではなく **意図された route 撤去後の暫定状態** として扱う

### 非推奨
- [ ] guessed endpoint を追加する
- [ ] `summary` を永続的に `undefined` にして loading 表示のままにする
- [ ] blocked route string を comment / TODO にだけ残す

## B-4. ChartsPage の query / 参照を更新する
- [ ] `src/features/charts/pages/ChartsPage.tsx` の import を更新する
- [ ] query key を旧 route 由来の命名から外す
- [ ] `resolveOutpatientFlags()` に渡す source として新 summary object が安定して動くことを確認する
- [ ] `MedicalOutpatientRecordPanel` への props が崩れないことを確認する
- [ ] refresh (`handleRefreshSummary`) が新 query 名で動くことを確認する

## B-5. Charts 関連テストのモック更新
少なくとも以下の旧 symbol モックを更新する。

- [ ] `src/features/charts/__tests__/chartsMasterSourceCache.test.tsx`
- [ ] `src/features/charts/__tests__/chartsOrcaRecoveryAlert.test.tsx`
- [ ] `src/features/charts/__tests__/chartsOrderDockCoexistence.recovery-order.test.tsx`
- [ ] `src/features/charts/__tests__/chartsPageDirtyDot.test.tsx`

やること:
- [ ] import / mocked symbol 名を新関数名へ更新する
- [ ] summary object の shape が新 helper / 新 query 名でも成立するよう調整する
- [ ] 旧 route に依存した assertion が残っていないことを確認する

## B-6. endpoint registry を更新する
- [ ] `src/libs/http/httpClient.ts` の `OUTPATIENT_API_ENDPOINTS` から `medicalOutpatient` entry を削除する  
  もしくは、同一 branch で実在 replacement endpoint へ差し替える
- [ ] purpose / auditMetadata / sourceDocs だけを残して stale path を温存しない
- [ ] route 一覧 UI / docs 参照が壊れないことを確認する

## B-7. mock handler を更新する
- [ ] `src/mocks/handlers/outpatient.ts` から `/api/orca/medical/outpatient` handler を削除する
- [ ] handler 削除で未使用になった fixture builder があれば整理する
- [ ] `src/mocks/handlers/index.ts` に不要な registration が無いことを確認する

## B-8. summary 取得の完了条件
- [ ] `grep -RIn "/api/orca/medical/outpatient" src` が 0 件
- [ ] charts page が compile / test / build を通る
- [ ] `MedicalOutpatientRecordPanel` が loading 固着せず描画できる
- [ ] blocked route を使わずに summary query が成立する
- [ ] old route 依存の audit 文言が残っていない

---

# Workstream C. Charts `finish` アクションから legacy summary call を除去する

## C-1. 現状の誤用を解消する
現状の `finish` は read-only legacy summary route を“完了 API”のように使っている。  
これは今回必ず解消する。

- [ ] `src/features/charts/ChartsActionBar.tsx` から `const endpoint = '/api/orca/medical/outpatient'` を削除する
- [ ] `buildOutpatientPayload()` が旧 route 専用なら削除する
- [ ] old route response を前提にした `runId/traceId/requestId/outcome/apiResult` の受け取り処理を削除する
- [ ] old route 由来の success / error 文言を削除する

## C-2. `finish` の残すべき動きを整理する
`finish` で残すべきものだけを残す。

- [ ] `onBeforeAction('finish')` の guard は維持する
- [ ] `onAfterFinish()` は維持する
- [ ] `medicalmodv23` の post-finish 処理は、allowed route 側として必要なら維持する
- [ ] `medicalmodv23` の field guard (`Patient_ID`, `Department_Code`, `First_Calculation_Date`, `LastVisit_Date`) は維持する
- [ ] 成功 toast / warning banner / audit 記録が、**実際に実行した処理だけ** を表すように整理する

## C-3. `finish` を `bill` に結びつけない
A1 上、billed trigger は未確定。よって次はやらない。

- [ ] `finish -> /api/encounters/{encounterKey}/transitions` with `operation=bill` を実装しない
- [ ] `finish -> chart_open` のような不正マッピングをしない
- [ ] `encounterKey` が無い状態で transition 呼び出しへ進まない

## C-4. `finish` テストを更新する
- [ ] `src/features/charts/__tests__/chartsActionBar.test.tsx` の旧 assertion を更新する
- [ ] 少なくとも以下を確認するテストへ差し替える  
  - [ ] `finish` で `/api/orca/medical/outpatient` を叩かない  
  - [ ] `finish` 成功時に local after-finish フローが呼ばれる  
  - [ ] `medicalmodv23` の field 不足時に warning banner が出る  
  - [ ] old endpoint 名を含む audit detail が残らない

## C-5. 完了条件
- [ ] `finish` フロー内に blocked route が無い
- [ ] `finish` は local flow + allowed route のみで完結する
- [ ] `finish` 失敗時の原因表示が実処理に対応している

---

# Workstream D. 後続契約に備えた型 / context の受け皿を整える（条件付き）

この workstream は **mandatory ではない**。  
ただし同一タスク内で安全に入れられるなら実施する。

## D-1. optional field の受け皿追加
- [ ] `src/features/outpatient/types.ts` の `ReceptionEntry` に optional `scheduleKey` / `encounterKey` を追加検討する
- [ ] `src/features/charts/encounterContext.ts` の `OutpatientEncounterContext` に optional `scheduleKey` / `encounterKey` を追加検討する
- [ ] `src/features/outpatient/transformers.ts` で raw payload に key が存在する場合のみ parse する
- [ ] raw payload に key が無い場合は `undefined` のままでよい

## D-2. ただしこの task では無理に transition へ繋がない
- [ ] key 受け皿を入れても、server operation mapping が確定していない場合は呼び出しを追加しない
- [ ] `start` / `pause` / `finish` を EncounterResource に直結させるのは、`encounterKey` の供給と operation mapping が揃った場合のみ別 task で行う
- [ ] `start` を `chart_open` に結びつける案は、同一 branch で evidence が揃う場合のみ採用する

## D-3. 完了条件
- [ ] 追加した場合でも型追加だけで compile が壊れない
- [ ] key が未供給でも既存 UI が壊れない

---

# Workstream E. 再混入防止の guard を入れる

## E-1. guard の導入
- [ ] `scripts/verify-no-removed-routes.mjs` のような lightweight script を追加することを検討する
- [ ] 少なくとも `src/` 配下に以下が再出現したら fail する  
  - [ ] `/api/orca/medical/outpatient`
  - [ ] `/api/orca/deptinfo`
  - [ ] `/api/orca/local-medical/outpatient`
- [ ] scripts の書式は既存 verify script に合わせる
- [ ] `typecheck` / `test` / `build` のいずれかに guard を組み込む

## E-2. test guard の代替案
script を入れない場合でも、少なくともどちらかは入れる。

- [ ] repo guard test
- [ ] CI 用 grep step
- [ ] package script から呼ばれる verify step

## E-3. 完了条件
- [ ] blocked route が再混入したら CI で検知できる
- [ ] 人手 grep 依存で終わらない

---

## 7. 変更対象ファイル一覧（最低限）

### 必須変更
- [ ] `src/features/reception/pages/ReceptionPage.tsx`
- [ ] `src/mocks/handlers/index.ts`
- [ ] `src/mocks/handlers/orcaDeptInfo.ts`（削除）
- [ ] `src/features/charts/api.ts`
- [ ] `src/features/charts/pages/ChartsPage.tsx`
- [ ] `src/features/charts/ChartsActionBar.tsx`
- [ ] `src/libs/http/httpClient.ts`
- [ ] `src/mocks/handlers/outpatient.ts`
- [ ] `src/features/charts/__tests__/chartsActionBar.test.tsx`
- [ ] `src/features/reception/__tests__/ReceptionPage.test.tsx`

### ほぼ確実に更新が必要
- [ ] `src/features/charts/__tests__/chartsMasterSourceCache.test.tsx`
- [ ] `src/features/charts/__tests__/chartsOrcaRecoveryAlert.test.tsx`
- [ ] `src/features/charts/__tests__/chartsOrderDockCoexistence.recovery-order.test.tsx`
- [ ] `src/features/charts/__tests__/chartsPageDirtyDot.test.tsx`

### 条件付き
- [ ] `src/features/outpatient/types.ts`
- [ ] `src/features/outpatient/transformers.ts`
- [ ] `src/features/charts/encounterContext.ts`
- [ ] `scripts/verify-no-removed-routes.mjs`
- [ ] 受け皿 helper / pure function の新規ファイル

---

## 8. 実装時の判断ルール

### 8.1 判断に迷ったらこちらを優先
1. blocked route を残さない
2. guessed endpoint を作らない
3. local projection に ORCA namespace を使わない
4. finish を billed に結びつけない
5. build/test/grep で検証可能な形にする

### 8.2 作業が詰まりやすいポイント
- `ChartsPage` 側の query 名変更に伴う test mock の更新漏れ
- `ChartsActionBar` から旧 route 呼び出しを消した後の success / warning / audit の整合
- `ReceptionPage` の department option 生成を UI state に埋め込んだまま触るとテストが重い  
  → 必要なら pure helper 抽出を検討する
- `MedicalOutpatientRecordPanel` に `summary` を渡さないと loading 固着する  
  → placeholder summary で収める

### 8.3 やってはいけない shortcut
- old route の string を “コメントとしてだけ” 残す
- mocks だけ旧 route を残して source から消したつもりになる
- `finish` の代替として allowed route を適当に 1 本選んで叩く
- query 名だけ変えて実体の route 依存を残す
- コンパイルを通すために `as any` で押し切る

---

## 9. 検証チェックリスト

### 9.1 必須 grep
- [ ] `grep -RIn "/api/orca/medical/outpatient" src` が 0 件
- [ ] `grep -RIn "/api/orca/deptinfo" src` が 0 件
- [ ] `grep -RIn "/api/orca/local-medical/outpatient" src` が 0 件

### 9.2 必須コマンド
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`

### 9.3 推奨ピンポイント実行
- [ ] `npm run test -- src/features/charts/__tests__/chartsActionBar.test.tsx`
- [ ] `npm run test -- src/features/reception/__tests__/ReceptionPage.test.tsx`
- [ ] `npm run test -- src/features/charts/__tests__/medicalOutpatient.test.ts`
- [ ] summary query 名を変更した場合は関連 charts page test を個別実行する

### 9.4 手動スモーク
- [ ] Reception 画面で診療科候補が local data のみで出る
- [ ] accept workflow で診療科 auto-fill が効く
- [ ] Charts 画面で summary panel がクラッシュしない
- [ ] `finish` 実行で blocked route に飛ばない
- [ ] `send` 実行の route 群に旧 blocked route が混入していない
- [ ] network log / devtools 上で `/api/orca/medical/outpatient` と `/api/orca/deptinfo` が発生しない

---

## 10. Definition of Done

以下をすべて満たしたら完了。

- [ ] `src/` 配下に `/api/orca/medical/outpatient` が存在しない
- [ ] `src/` 配下に `/api/orca/deptinfo` が存在しない
- [ ] mocks / tests / endpoint registry / audit 文言まで契約が揃っている
- [ ] `finish` は blocked route に依存しない
- [ ] Reception の診療科選択は local data だけで成立する
- [ ] query / helper / audit 名が route 実態に対して誤解を招かない
- [ ] typecheck / test / build が通る
- [ ] 再混入防止 guard が入っている、または同等の CI 検知がある
- [ ] 未解決事項は “server 側 replacement route 不在” などの形で、**推測実装なし** に記録されている

---

## 11. 実装後に残すべきメモ

完了報告には必ず以下を書く。

- [ ] 除去した blocked route 一覧
- [ ] 更新したファイル一覧
- [ ] 追加した guard / verify の内容
- [ ] `finish` で何を残し、何を削ったか
- [ ] local outpatient summary replacement route は **未実装 / 未接続** であること
- [ ] `finish -> bill` を意図的に実装していない理由
- [ ] 実行したコマンドと結果
