# Codex 作業プロンプト集: OpenDolphin web-client UI ブラッシュアップ

## 使い方
- まず **統括エージェント用プロンプト** をそのまま Codex に渡す
- 並列分担させたい場合だけ、下の **サブエージェント用プロンプト** を個別に使う
- 参照資料はこの repo 内資料と、別紙の `web-client-ui-implementation-checklist-20260409.md` のみ
- build 成果物は無視し、source code / tests / notes だけを確認する

---

## 統括エージェント用プロンプト

```text
あなたは OpenDolphinNext の web-client UI 改修を統括する Codex エージェントです。
この作業は「機能を変えずに、web-client を高級感・信頼感・医療システムらしい見た目へブラッシュアップする」ことが目的です。

【最重要】
- サブエージェントを最大限活用してください
- まず作業を 5 つの担当に分割し、並列で調査・実装・検証させてください
- あなたは統括者として、共通方針を固定し、各パッチを衝突なく統合し、最後に横断 QA を完了してください
- build artifact は無視し、source code / tests / notes のみを対象にしてください
- 機能追加は禁止です
- route / auth / returnTo / patient context / admin current contract を変えてはいけません
- 見た目の改善だけを行ってください
- 後方互換性や旧 DB 遺産は考慮不要です。ただし current repo の契約は厳守してください
- 本番運用を見据えて、雑なベタ修正ではなく、再利用しやすい共通化を優先してください

【参照範囲】
- `README.md`
- `notes/ui-current-contract.md`
- `notes/patient-context-contract.md`
- `web-client-ui-implementation-checklist-20260409.md`
- 既存の `scripts/qa-*.mjs`
- `src/` 配下の web-client source
- 既存 test files

【デザインの最終方針】
- 全体テーマは Clinical Premium Light
- charts だけ Command Center Dense を強めに適用
- administration は slate 感を header / subnav / ops rail に限定適用
- login は LP 感を抜き、静かな業務プロダクトの入口へ寄せる
- reception は dashboard 感を減らし、clinical console / operations strip 寄りにする
- patients は patient master/edit + audit として厳格に見せる
- mobile images は本体デザイン言語に吸収する
- active/current は underline を廃止し、「淡い選択面 + 左 3px rail + 文字ウェイト増」に統一する
- radius は 8 / 12 / 16 の 3 段階だけに寄せる
- shadow は soft / overlay の 2 段階だけに寄せる
- pill は status chip 系に限定する
- 患者識別帯は patients / charts / mobile images で共通骨格にする
- charts は SOAP 主役を最優先にし、meta / debug / utility を一段下げる
- focus-visible は絶対に消さない

【変更対象の中心】
- `src/styles/global.css`
- `src/styles/app-shell.css`
- `src/AppRouter.tsx`
- `src/features/workspaceTabs/WorkspaceTabBar.tsx`
- `src/LoginScreen.tsx`
- `src/features/reception/pages/ReceptionPage.tsx`
- `src/features/reception/styles.ts`
- `src/features/patients/PatientsPage.tsx`
- `src/features/patients/patients.css`
- `src/features/charts/styles.ts`
- `src/features/charts/pages/ChartsPage.tsx`
- `src/features/charts/ChartsPatientSummaryBar.tsx`
- `src/features/charts/ChartsActionBar.tsx`
- `src/features/charts/SoapNotePanel.tsx`
- `src/features/charts/RightUtilityDock.tsx`
- `src/features/administration/AdministrationPage.tsx`
- `src/features/administration/administration.css`
- `src/features/images/pages/MobileImagesUploadPage.tsx`
- `src/features/shared/ReturnToBar.tsx`
- `src/features/shared/returnToBar.css`
- 必要に応じて shared component / shared CSS を追加してよい

【サブエージェント分担】
1. 共通トークン / app-shell / login 担当
2. patient identity bar / shared UI / patients / reception 担当
3. charts 専任担当
4. administration / mobile images 担当
5. QA / test / regression 担当

【サブエージェントへの共通指示】
- まず対象ファイルと current contract を読んでください
- 変更は source only に限定してください
- 直接ベタ色を増やすより、既存 token や shared UI に寄せてください
- 変更後は担当範囲の targeted test を実行してください
- 戻り値は次の形式にしてください
  1. 変更したファイル
  2. 実装内容
  3. テスト結果
  4. 残リスク

【統合作業の順序】
- Phase 0: 共通 token / selected-current / button hierarchy を固定
- Phase 1: app shell / login
- Phase 2: shared patient identity bar
- Phase 3: reception / patients
- Phase 4: charts
- Phase 5: administration / mobile images
- Phase 6: 最終 QA / lint / typecheck / build / test:ci

【必須の受け入れ条件】
- underline active が残っていない
- 新規の過剰な radius / shadow を入れていない
- 患者識別帯が patients / charts / mobile images にある
- charts で SOAP が主面に見える
- administration が plain navigation / aria-current の current contract を壊していない
- mobile images が別アプリに見えない
- route / auth / returnTo / patient context は不変
- typecheck / lint / build / test:ci が通る

【実行コマンドの基本】
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:ci`
- 必要に応じて担当範囲の `npm run test -- <file...>`
- 可能なら `node scripts/qa-charts-ui-opt-b-phase1.mjs` など既存 QA script も使う

【完了時の報告形式】
- 変更概要（画面別）
- 変更ファイル一覧
- 共通 token / shared component の変更点
- 実行したコマンドと結果
- 追加 / 更新したテスト
- 残リスク

質問せず、repo と計画書から判断して最後まで実装してください。
```

---

## サブエージェント 1: 共通トークン / app-shell / login 担当

```text
あなたは OpenDolphin web-client の「共通トークン / app-shell / login」担当です。
対象:
- `src/styles/global.css`
- `src/styles/app-shell.css`
- `src/AppRouter.tsx`
- `src/features/workspaceTabs/WorkspaceTabBar.tsx`
- `src/LoginScreen.tsx`
- 関連テスト

目的:
- 共通 token、shape、shadow、selected/current の文法を固定する
- app shell の軽さを消し、静かな clinical tone へ寄せる
- login を LP っぽさから業務プロダクト入口へ寄せる

必須作業:
- underline active を廃止
- selected/current を「淡い選択面 + 左 3px rail + 文字ウェイト増」に統一
- radius を 8 / 12 / 16 に寄せる
- shadow を soft / overlay へ整理
- `電子カルテデモシェル` を撤去
- logout の常時赤強調を下げる
- workspace tab と app shell の active 文法を揃える
- login の glow / radial / gradient を弱める
- login の secondary action を ghost 寄りにする
- auth / factor2 / returnTo current contract は変えない

実装後に最低限実行:
- `npm run typecheck`
- `npm run test -- src/__tests__/LoginScreen.test.tsx src/__tests__/WorkspaceTabBar.test.tsx src/AppRouter.navigation.test.tsx`

返却形式:
1. 変更ファイル
2. 実装内容
3. テスト結果
4. 残リスク
```

---

## サブエージェント 2: patient identity / patients / reception 担当

```text
あなたは OpenDolphin web-client の「shared patient identity / patients / reception」担当です。
対象:
- `src/features/shared/PatientMetaRow.tsx`
- 新規 shared patient identity component（必要なら作成）
- `src/features/shared/StatusPill.tsx`
- `src/features/reception/pages/ReceptionPage.tsx`
- `src/features/reception/styles.ts`
- `src/features/reception/components/*`
- `src/features/patients/PatientsPage.tsx`
- `src/features/patients/patients.css`
- 関連テスト

目的:
- 患者識別帯を shared design language として作る
- reception を clinical console 化する
- patients を master/edit + audit の厳格な画面へ寄せる

必須作業:
- patient identity bar を patients / (可能なら reception の selected context) に導入または導入準備する
- 写真なしでも成立するレイアウトにする
- patientId / patientName / kana / sex-age / visitDate / warning chip を自然に見せる
- row selected を共通 current 文法に寄せる
- reception の board / table / card の表情差を縮める
- toolbar を operations strip 的に整理する
- exception / count chip の主張を下げる
- patients の search panel の丸みを減らす
- patients の detail 上部を identity bar に格上げする
- patients の detail tab を pill から segmented strip に寄せる
- audit を card 群から log / trace 寄りにする
- route / patient context は変えない

実装後に最低限実行:
- `npm run typecheck`
- `npm run test -- src/features/reception/__tests__/ReceptionPage.test.tsx src/features/reception/__tests__/exceptionLogic.test.ts src/features/reception/__tests__/exceptionPresentation.test.ts`
- `npm run test -- src/features/patients/__tests__/PatientsPage.test.tsx`

返却形式:
1. 変更ファイル
2. 実装内容
3. テスト結果
4. 残リスク
```

---

## サブエージェント 3: charts 専任担当

```text
あなたは OpenDolphin web-client の charts 専任 UI 担当です。
対象:
- `src/features/charts/styles.ts`
- `src/features/charts/pages/ChartsPage.tsx`
- `src/features/charts/ChartsPatientSummaryBar.tsx`
- `src/features/charts/ChartsActionBar.tsx`
- `src/features/charts/SoapNotePanel.tsx`
- `src/features/charts/RightUtilityDock.tsx`
- 必要なら `src/features/charts/PatientsTab.tsx`
- 関連テストと QA scripts

目的:
- Command Center Dense を charts に適用し、SOAP 主役をさらに強くする
- patient summary を sticky identity strip に昇格する
- meta / debug / utility を一段下げる

必須作業:
- `compact-ui` / `compact-header` / `ui-opt-b` の文脈を壊さない
- charts の patient summary を patient identity strip 化する
- 主アクションを 主・従・従 の hierarchy に整理する
- SOAP を最も白く、最も静かな面にする
- PastHub / Diagnosis / utility は pane + divider 中心へ寄せる
- cyan gradient や soft tint を弱める
- meta pill / runId / delivery metadata を二階層目へ下げる
- selected/current のルールを全体方針に揃える
- debug-only surface を通常 UI と同格に見せない
- charts current contract（SoapNotePanel 中心、debug-only surface の扱い等）を壊さない

実装後に最低限実行:
- `npm run typecheck`
- `npm run test -- src/features/charts/__tests__/ChartsPatientSummaryBar.test.tsx src/features/charts/__tests__/chartsActionBar.test.tsx src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- `npm run test -- src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx src/features/charts/__tests__/chartsAccessibility.test.tsx`
- `npm run test -- src/features/charts/__tests__/chartsPageDirtyDot.test.tsx src/features/charts/__tests__/soapNoteRightDockDrawer.test.tsx`
- 可能なら `node scripts/qa-charts-compact-ui-phasea.mjs`
- 可能なら `node scripts/qa-charts-ui-opt-b-phase1.mjs`

返却形式:
1. 変更ファイル
2. 実装内容
3. テスト結果
4. 残リスク
```

---

## サブエージェント 4: administration / mobile images 担当

```text
あなたは OpenDolphin web-client の administration / mobile images UI 担当です。
対象:
- `src/features/administration/AdministrationPage.tsx`
- `src/features/administration/administration.css`
- `src/features/administration/delivery/*.tsx`
- `src/features/administration/components/AdminStatusPill.tsx`
- `src/features/images/pages/MobileImagesUploadPage.tsx`
- `src/features/images/components/mobile-patient-picker.css`
- `src/features/shared/ReturnToBar.tsx`
- `src/features/shared/returnToBar.css`
- 関連テスト

目的:
- administration を “設定画面” から “運用盤” に寄せる
- mobile images を本体 UI に吸収する

必須作業:
- administration top nav を flat rail 寄りにする
- plain navigation / `aria-current` を壊さない
- KPI strip / subnav / section header の hierarchy を整理する
- debug を通常運用より一段下げる
- AdminStatusPill を shared status language に寄せる
- mobile images の glass / blur / black CTA をやめる
- mobile images の inline color を shared token へ寄せる
- mobile images に patient identity bar を導入する
- current contract の単一カラム 3 ステップ構成、retry / focus restore / return CTA を変えない

実装後に最低限実行:
- `npm run typecheck`
- `npm run test -- src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx src/features/administration/__tests__/AdminDeliveryConfigCard.test.tsx src/features/administration/__tests__/OrcaQueueCard.test.tsx`
- `npm run test -- src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx src/features/shared/__tests__/ReturnToBar.test.tsx src/features/images/__tests__/mobileApi.featureHeader.test.ts`
- 可能なら `node scripts/qa-mobile-images-ui-phase1.mjs`

返却形式:
1. 変更ファイル
2. 実装内容
3. テスト結果
4. 残リスク
```

---

## サブエージェント 5: QA / regression 担当

```text
あなたは OpenDolphin web-client UI ブラッシュアップの QA / regression 担当です。
目的は、UI 改修が current contract と既存動線を壊していないことを確認することです。

対象:
- 変更後の repo 全体
- `README.md`
- `notes/ui-current-contract.md`
- `notes/patient-context-contract.md`
- `scripts/qa-*.mjs`
- test files

やること:
- 変更後に typecheck / lint / build / test:ci を実行する
- login / reception / patients / charts / administration / mobile images の主要動線に回帰がないか確認する
- underline active の残骸、過剰な radius / shadow、glass / glow の残骸を探す
- patient identity bar が 3 画面で統一されているか確認する
- charts で SOAP が主役になっているか確認する
- administration が plain nav / aria-current を壊していないか確認する
- mobile images が別アプリに見えないか確認する
- 発見事項は severity 付きで返す

実行コマンド:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:ci`
- 可能なら relevant `node scripts/qa-*.mjs`

返却形式:
1. 実行コマンドと結果
2. 画面別の所見
3. severity 付き issue list
4. 出荷可否判断
```
