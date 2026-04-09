# OpenDolphin web-client UI ブラッシュアップ 実装計画書（チェックボックス版）

## 0. この計画の前提

### 0-1. ゴール
- [ ] 機能を変えずに、web-client 全体の見た目を「高級感・信頼感・医療システムらしさ」のある方向へ引き上げる
- [ ] 全体テーマは **Clinical Premium Light** を基底にする
- [ ] **charts だけ Command Center Dense** を強めに適用する
- [ ] reception / patients / administration / mobile images / login は共通デザイン言語へ統合する
- [ ] 患者識別、現在地、主従、危険操作の見え方を強くする

### 0-2. 非ゴール
- [ ] API / データ構造変更をしない
- [ ] 画面遷移変更をしない
- [ ] auth / returnTo / patient context / admin contract を変えない
- [ ] dark mode を同時導入しない
- [ ] build artifact や dist を対象にしない
- [ ] 画像や写真を必須前提にしない

### 0-3. Source of Truth
- [ ] `README.md`
- [ ] `notes/ui-current-contract.md`
- [ ] `notes/patient-context-contract.md`
- [ ] 既存の `scripts/qa-*.mjs`
- [ ] 既存テスト群（特に Login / Reception / Patients / Charts / Administration / Mobile Images）
- [ ] これまでの統合レビュー結果と UI ブラッシュアップ計画

### 0-4. 守るべきデザイン原則
- [ ] active/current は **underline をやめる**
- [ ] selected は **淡い選択面 + 左 3px rail + 文字ウェイト増** に統一する
- [ ] radius は **8 / 12 / 16** の 3 段階に揃える
- [ ] pill は **status chip 系だけ** に限定する
- [ ] shadow は **soft / overlay** の 2 段階だけに絞る
- [ ] 影で浮かせず、surface / border / spacing で上質感を出す
- [ ] 患者識別帯は **patients / charts / mobile images** で共通骨格にする
- [ ] charts は **SOAP 主役** を最優先にする
- [ ] administration は **plain navigation / aria-current** の current contract を崩さない
- [ ] mobile images は **単一カラム 3 ステップ構成**を維持する

---

## 1. 実装前チェック
- [ ] 作業ブランチを作成する
- [ ] 変更対象を source only に限定する（`src/`, `notes/`, 必要最小限の `scripts/qa-*`）
- [ ] build 成果物 / dist / 画像生成物は無視する
- [ ] `npm ci` 実行可能な状態を確認する
- [ ] `npm run typecheck` がベースラインで通ることを確認する
- [ ] `npm run test -- src/__tests__/LoginScreen.test.tsx` がベースラインで通ることを確認する
- [ ] `npm run test -- src/features/reception/__tests__/ReceptionPage.test.tsx` がベースラインで通ることを確認する
- [ ] `npm run test -- src/features/patients/__tests__/PatientsPage.test.tsx` がベースラインで通ることを確認する
- [ ] `npm run test -- src/features/charts/__tests__/ChartsPatientSummaryBar.test.tsx src/features/charts/__tests__/chartsActionBar.test.tsx` がベースラインで通ることを確認する
- [ ] `npm run test -- src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx` がベースラインで通ることを確認する
- [ ] `npm run test -- src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx src/features/shared/__tests__/ReturnToBar.test.tsx` がベースラインで通ることを確認する

---

## 2. Phase 0: 共通トークンと UI 契約の固定

### 2-1. 変更対象
- [ ] `src/styles/global.css`
- [ ] `src/styles/app-shell.css`
- [ ] `src/features/shared/StatusPill.tsx`（必要時のみ）
- [ ] `src/features/shared/PatientMetaRow.tsx`（必要時のみ）

### 2-2. 実装タスク
- [ ] `global.css` に canonical token を明示する
  - [ ] `--ui-radius-sm: 8px`
  - [ ] `--ui-radius-md: 12px`
  - [ ] `--ui-radius-lg: 16px`
  - [ ] `--ui-shadow-soft`
  - [ ] `--ui-shadow-overlay`
  - [ ] `--ui-selected-bg`
  - [ ] `--ui-selected-rail`
  - [ ] `--ui-selected-border`
  - [ ] `--ui-surface-muted`
  - [ ] `--ui-border-subtle`
  - [ ] `--ui-border-strong`
- [ ] 今後の修正対象画面で 20 / 22 / 24 / 999 の radius を新規追加しないルールを決める
- [ ] `status-pill` の tone を global token ベースに寄せる
- [ ] `patient-meta-row` の文字サイズ・色を current design language に合わせて軽く調整する
- [ ] focus-visible を削除しない
- [ ] hover で大きく浮かせる表現を増やさない

### 2-3. 受け入れ条件
- [ ] 共通 token が `global.css` から参照できる
- [ ] 今後の画面改修で直接色・影・角丸を増やさなくて済む
- [ ] `StatusPill` と `PatientMetaRow` が新しい見た目ルールの基礎として使える

### 2-4. 確認
- [ ] `npm run typecheck`
- [ ] `npm run test -- src/features/shared/__tests__/StatusPill.test.tsx`

---

## 3. Phase 1: app shell / navigation の統一

### 3-1. 変更対象
- [ ] `src/AppRouter.tsx`
- [ ] `src/styles/app-shell.css`
- [ ] `src/features/workspaceTabs/WorkspaceTabBar.tsx`
- [ ] `src/__tests__/WorkspaceTabBar.test.tsx`（必要時）

### 3-2. 実装タスク
- [ ] `AppRouter.tsx` の **「電子カルテデモシェル」** 文言を撤去する
- [ ] topbar の pill 群を「静かな info strip」に寄せる
- [ ] logout の常時赤強調を 1 段落とす
- [ ] admin / switch / logout の hierarchy を再設定する
- [ ] current page 表現から underline を除去する
- [ ] current page を **淡い選択面 + 左 rail + 文字ウェイト増** に統一する
- [ ] workspace tab の active を app-shell と同じ current 文法へ寄せる
- [ ] tooltip の見た目を clinical tone に保つ（浮きすぎない、黒ベタ過剰にしない）

### 3-3. 受け入れ条件
- [ ] app shell 上に製品の軽さを出すコピーが残っていない
- [ ] underline active が残っていない
- [ ] logout が危険操作として認識できるが、常時ノイズになっていない
- [ ] workspace tab / app shell / local navigation の現在地表現が揃っている

### 3-4. 確認
- [ ] `npm run test -- src/__tests__/AppRouter.login-redirect.test.tsx src/__tests__/WorkspaceTabBar.test.tsx`
- [ ] `npm run test -- src/AppRouter.navigation.test.tsx`

---

## 4. Phase 2: login の静かな高級化

### 4-1. 変更対象
- [ ] `src/LoginScreen.tsx`
- [ ] `src/__tests__/LoginScreen.test.tsx`
- [ ] `src/styles/global.css`（共通 token のみで足りない場合）

### 4-2. 実装タスク
- [ ] split layout は維持する
- [ ] 左ブランド面の radial / glow / gradient を弱める
- [ ] heading / accent text を LP 風の gradient text から solid ink 寄りにする
- [ ] `status-message` を quiet panel / step rail として整理する
- [ ] factor1 / factor2 の切り替えが同一 surface で自然に見えるよう余白と罫線を整理する
- [ ] `destinationSummary` は注意箱感を下げ、静かな補足にする
- [ ] facility lock は badge / meta strip 風に見せる
- [ ] factor2 の secondary action は ghost 寄りに落とす
- [ ] primary CTA の強さは維持し、周辺要素を静かにする
- [ ] auth / returnTo / factor2 の current contract を変えない

### 4-3. 受け入れ条件
- [ ] login は現行機能を変えず、入口として落ち着いた製品感が出ている
- [ ] factor2 の導線が視覚的に整理されている
- [ ] brand 面と業務画面の世界観の断絶が弱まっている

### 4-4. 確認
- [ ] `npm run test -- src/__tests__/LoginScreen.test.tsx`
- [ ] 手動で `/login` → factor2 必須 / 不要 の両ケースを確認する

---

## 5. Phase 3: 共通 Patient Identity Bar の導入

### 5-1. 変更対象
- [ ] 新規 shared component を作るか判断する
  - [ ] 候補: `src/features/shared/PatientIdentityBar.tsx`
  - [ ] 候補 CSS: `src/features/shared/patientIdentityBar.css` または既存 `app-shell.css` に追加
- [ ] `src/features/shared/PatientMetaRow.tsx` を再利用できるか確認する
- [ ] `src/features/shared/StatusPill.tsx` を warning / info / neutral chip に再利用する

### 5-2. 必須 props / 契約
- [ ] `patientId`
- [ ] `patientName`
- [ ] `patientKana`（あれば）
- [ ] `sex`
- [ ] `age`
- [ ] `visitDate` or contextual meta
- [ ] warning / blocked / unlinked / risk 系 chip slot
- [ ] optional photo slot
- [ ] optional action slot
- [ ] 写真がなくても崩れないこと

### 5-3. 見た目ルール
- [ ] sticky
- [ ] 白面 + 下辺 border
- [ ] 左から photo(optional) / patient id block / name block / meta / warning / actions
- [ ] name は最も強く、runId や debug meta は載せない
- [ ] warning は status chip で処理し、面全体を赤くしない
- [ ] ID / 時刻 / 件数は tabular numerals で揃える

### 5-4. 受け入れ条件
- [ ] patients / charts / mobile images で同じ骨格に見える
- [ ] 写真がないケースでも十分に識別できる
- [ ] 既存 patient context contract を壊していない

### 5-5. 確認
- [ ] 必要なら shared component の unit test を追加する
- [ ] `npm run typecheck`

---

## 6. Phase 4: reception を clinical console 化

### 6-1. 変更対象
- [ ] `src/features/reception/pages/ReceptionPage.tsx`
- [ ] `src/features/reception/styles.ts`
- [ ] `src/features/reception/components/ToneBanner.tsx`
- [ ] `src/features/reception/components/ReceptionExceptionList.tsx`
- [ ] `src/features/reception/components/OrderConsole.tsx`（必要時）
- [ ] `src/features/reception/__tests__/ReceptionPage.test.tsx`
- [ ] `src/features/reception/__tests__/exceptionPresentation.test.ts`

### 6-2. 実装タスク
- [ ] board / table / card の表情差を縮める
- [ ] toolbar を 1 枚の **operations strip** として見せる
- [ ] 日付操作 / 検索 / 絞り込み / 例外 / 更新 / 表示切替の group を余白と divider で分ける
- [ ] selected row を全画面共通ルールへ寄せる
- [ ] section/header gradient を弱める
- [ ] count chip を小さく・中立化する
- [ ] exception indicator は通常時中立、閾値時のみ強調にする
- [ ] table header / sticky behavior は維持しつつフラットにする
- [ ] 状態の強調は row 全面着色ではなく、status chip / left rail / compact marker で処理する
- [ ] `PatientMetaRow` と `StatusPill` の見え方を patients / charts と揃える
- [ ] 運用メタや debug 的情報は通常運用の第一視線から外す

### 6-3. 受け入れ条件
- [ ] reception が dashboard というより受付運用盤に見える
- [ ] selected row / hover / warning の優先順位が明確
- [ ] card の浮きが減り、table/pane 優先の見え方になっている
- [ ] current contract の動線と状態表現を壊していない

### 6-4. 確認
- [ ] `npm run test -- src/features/reception/__tests__/ReceptionPage.test.tsx`
- [ ] `npm run test -- src/features/reception/__tests__/exceptionLogic.test.ts src/features/reception/__tests__/exceptionPresentation.test.ts`
- [ ] 可能なら `node scripts/qa-reception-charts-orca.mjs`

---

## 7. Phase 5: patients を master/edit + audit の厳格な画面へ寄せる

### 7-1. 変更対象
- [ ] `src/features/patients/PatientsPage.tsx`
- [ ] `src/features/patients/patients.css`
- [ ] `src/features/patients/PatientFormErrorAlert.tsx`（必要時）
- [ ] `src/features/patients/__tests__/PatientsPage.test.tsx`

### 7-2. 実装タスク
- [ ] search panel の丸みを 12–16px に落とす
- [ ] search area を fluffy card ではなく operator strip 寄りにする
- [ ] patient list row の selected を共通 current 文法へ揃える
- [ ] patient ID chip を neutral plate 化する
- [ ] detail 上部の「選択中の患者」を patient identity bar に昇格する
- [ ] detail tabs を pill から segmented strip へ寄せる
- [ ] save / cancel / delete の hierarchy をさらに明確化する
- [ ] unlinked / blocked / warning の色使いを整理する
- [ ] audit を card 群より log / trace 面へ寄せる
- [ ] list/detail split の境界を shadow より divider で見せる
- [ ] ORCA 由来補足情報は常時色面でなく meta strip で見せる

### 7-3. 受け入れ条件
- [ ] patients は「丸い SaaS」感が減り、「患者マスタ編集 + 監査」感が強まっている
- [ ] patient identity bar が detail 側の最上位に見える
- [ ] audit の読みやすさが落ちていない

### 7-4. 確認
- [ ] `npm run test -- src/features/patients/__tests__/PatientsPage.test.tsx`
- [ ] 手動で reception 由来 / charts 由来 / patient 未選択開始を確認する

---

## 8. Phase 6: charts を本命改修する

### 8-1. 変更対象
- [ ] `src/features/charts/styles.ts`
- [ ] `src/features/charts/pages/ChartsPage.tsx`
- [ ] `src/features/charts/ChartsPatientSummaryBar.tsx`
- [ ] `src/features/charts/ChartsActionBar.tsx`
- [ ] `src/features/charts/SoapNotePanel.tsx`
- [ ] `src/features/charts/RightUtilityDock.tsx`
- [ ] `src/features/charts/PatientsTab.tsx`（一覧の selected/pill 整理が必要なら）
- [ ] 対応テスト各種

### 8-2. 実装タスク
- [ ] `compact-ui` / `compact-header` / `ui-opt-b` の既存方向を壊さずに延長する
- [ ] patient summary を **patient identity strip** として再設計する
- [ ] patient identity strip を sticky 化する
- [ ] 主アクション群を **主・従・従** の hierarchy に再編する
- [ ] header meta / delivery meta / runId / debug を 1 段下げる
- [ ] SOAP を最も白く、最も静かな面にする
- [ ] PastHub / Diagnosis / utility は pane / divider 中心に整理する
- [ ] cyan gradient や soft tint を弱める
- [ ] utility dock を「補助装置」に見える程度に抑制する
- [ ] row / chip / badge の selected / current 表現を共通化する
- [ ] charts 内の status 色は danger / warning / info の優先度を整理し、常時多色化しない
- [ ] `PatientsTab` が存在する一覧行も共通 row 選択ルールへ寄せる
- [ ] debug-only surface は通常運用面より一段下げる

### 8-3. 受け入れ条件
- [ ] 初見で SOAP が最主面だと分かる
- [ ] patient identity strip が charts の最上位コンテキストとして成立している
- [ ] meta pill 群が主役面と競合していない
- [ ] utility dock は便利だが派手ではない
- [ ] current contract（SoapNotePanel 中心、debug-only surface の扱い）を壊していない

### 8-4. 確認
- [ ] `npm run test -- src/features/charts/__tests__/ChartsPatientSummaryBar.test.tsx`
- [ ] `npm run test -- src/features/charts/__tests__/chartsActionBar.test.tsx src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
- [ ] `npm run test -- src/features/charts/__tests__/SoapNotePanel.test.tsx src/features/charts/__tests__/soapNoteDirtyState.test.tsx`
- [ ] `npm run test -- src/features/charts/__tests__/chartsAccessibility.test.tsx`
- [ ] `npm run test -- src/features/charts/__tests__/chartsPageDirtyDot.test.tsx src/features/charts/__tests__/soapNoteRightDockDrawer.test.tsx`
- [ ] 可能なら `node scripts/qa-charts-compact-ui-phasea.mjs`
- [ ] 可能なら `node scripts/qa-charts-ui-opt-b-phase1.mjs`
- [ ] 可能なら `node scripts/qa-charts-ui-opt-b-regression.mjs`

---

## 9. Phase 7: administration を運用盤として締める

### 9-1. 変更対象
- [ ] `src/features/administration/AdministrationPage.tsx`
- [ ] `src/features/administration/administration.css`
- [ ] `src/features/administration/delivery/DeliverySubNav.tsx`
- [ ] `src/features/administration/components/AdminStatusPill.tsx`（必要時）
- [ ] `src/features/administration/delivery/*.tsx`（必要時）

### 9-2. 実装タスク
- [ ] top nav を丸 tab ではなく flat rail 寄りにする
- [ ] plain navigation / `aria-current` の current contract を維持する
- [ ] KPI strip を tile + identifier strip に整理する
- [ ] `delivery / orca-users / master-updates` の現在地を過度な fill でなく構造で見せる
- [ ] `delivery` 配下の subnav は group 感を強める
- [ ] `config / queue / operations / debug` を色でなく構造で分離する
- [ ] connection / queue / operations は white pane + section header 化する
- [ ] debug は通常運用と同格に見せない
- [ ] AdminStatusPill の tone を shared status language に合わせる
- [ ] monospaced area は raw data / code-like surface に限定する

### 9-3. 受け入れ条件
- [ ] administration が設定ページより運用盤に見える
- [ ] top-level / sub-level nav が current contract に沿っている
- [ ] 主要情報と debug 情報の視覚階層が分かれている

### 9-4. 確認
- [ ] `npm run test -- src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx`
- [ ] `npm run test -- src/features/administration/__tests__/AdminDeliveryConfigCard.test.tsx src/features/administration/__tests__/OrcaQueueCard.test.tsx`
- [ ] 必要なら delivery card 系のスナップショット相当を目視確認する

---

## 10. Phase 8: mobile images を本体へ吸収する

### 10-1. 変更対象
- [ ] `src/features/images/pages/MobileImagesUploadPage.tsx`
- [ ] `src/features/images/components/mobile-patient-picker.css`
- [ ] `src/features/shared/ReturnToBar.tsx`
- [ ] `src/features/shared/returnToBar.css`
- [ ] `src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx`
- [ ] `src/features/shared/__tests__/ReturnToBar.test.tsx`

### 10-2. 実装タスク
- [ ] current contract の **単一カラム 3 ステップ構成**は維持する
- [ ] `ReturnToBar` の glass / blur を撤去し、solid surface にする
- [ ] Mobile Images の inline color を shared token へ寄せる
- [ ] black secondary CTA を neutral outline / muted fill に変更する
- [ ] patient 特定後の上部に patient identity bar を導入する
- [ ] step 見出しを quiet section header に寄せる
- [ ] delivered / pending / failed badge を global state tone に統一する
- [ ] preview / upload / completion card を global surface language に揃える
- [ ] file picker / upload / retry / return CTA の current behavior を変えない

### 10-3. 受け入れ条件
- [ ] mobile images が別アプリに見えない
- [ ] return 導線と patient context が今まで通り機能する
- [ ] 送信成功後の focus restore など current contract を壊していない

### 10-4. 確認
- [ ] `npm run test -- src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx`
- [ ] `npm run test -- src/features/images/__tests__/mobileApi.featureHeader.test.ts`
- [ ] `npm run test -- src/features/shared/__tests__/ReturnToBar.test.tsx`
- [ ] 可能なら `node scripts/qa-mobile-images-ui-phase1.mjs`
- [ ] 可能なら `node scripts/qa-images-phaseA-web.mjs`

---

## 11. Phase 9: 最終横断 QA / 回帰確認

### 11-1. 必須コマンド
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:ci`

### 11-2. 重点回帰テスト
- [ ] login → reception 基本導線
- [ ] reception → patients 再入場
- [ ] reception / charts / patients の selected/current 表現の統一確認
- [ ] charts の dirty state / close guard / right utility 操作
- [ ] administration の top-level / sub-level navigation
- [ ] mobile images の deep link / return / retry / success focus restore

### 11-3. 目視チェック
- [ ] underline active が残っていない
- [ ] 新規の 20 / 24 radius が入っていない
- [ ] 影が過剰な新規要素がない
- [ ] patient identity bar が patients / charts / mobile images で同じ設計言語に見える
- [ ] logout / cancel / delete / close の hierarchy が崩れていない
- [ ] charts で SOAP が最主面に見える
- [ ] administration が運用盤に見える
- [ ] mobile images が別アプリに見えない

---

## 12. Definition of Done
- [ ] 機能は変えていない
- [ ] route / auth / returnTo / patient context / admin contract は維持されている
- [ ] 共通 token と selected/current ルールが全画面で使われている
- [ ] patient identity bar が patients / charts / mobile images に入っている
- [ ] charts の主従が整理されている
- [ ] reception / patients / administration / mobile images が全体テーマに揃っている
- [ ] typecheck / lint / build / test:ci が通っている
- [ ] 変更ファイル一覧、実行コマンド、スクリーン別の改善点、残リスクが最終報告にまとまっている

---

## 13. 禁止事項
- [ ] 機能追加をしない
- [ ] API 契約を変えない
- [ ] route を変えない
- [ ] patient context の保持先を増やさない
- [ ] focus-visible を消さない
- [ ] glassmorphism / 強い glow / 派手な gradient を増やさない
- [ ] charts に warm / cute な雰囲気を持ち込まない
- [ ] destructives を primary と同格にしない
- [ ] debug 情報を通常運用と同じ強さで見せない

---

## 14. 最終報告テンプレート
- [ ] 変更概要（3〜8行）
- [ ] 変更ファイル一覧
- [ ] 画面別の改善内容
- [ ] 共通 token / shared component の変更点
- [ ] 実行したコマンドと結果
- [ ] 追加・更新したテスト
- [ ] 残課題 / 既知リスク
