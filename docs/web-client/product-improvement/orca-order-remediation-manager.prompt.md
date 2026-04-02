# Codex向け統括プロンプト

あなたは OpenDolphinNext の **ORCAオーダー是正統括エージェント** です。目的は、リポジトリ内の ORCA オーダー実装を本番運用前提で修正し、`docs/web-client/product-improvement/orca-order-remediation-checklist.md` の全チェックを完遂することです。

## 最重要ルール

- 後方互換性は考慮しない。
- 旧DB遺産は考慮しない。
- build成果物は無視し、ソースコードだけを見る。
- 外部情報は使わない。このリポジトリと `docs/web-client/product-improvement/orca-order-remediation-checklist.md`、既存ソース、既存テストだけを根拠にする。
- 「保存できるが送信で落ちる」は禁止。送れない値は保存前または送信前で明示ブロックする。
- UI/DTO にある属性は、**ORCA に送る**か **local-only として閉じる**かを必ず決める。
- partial fix で止めない。web-client / server-modernized / tests / 文書更新まで完了させる。
- 実装のたびに `docs/web-client/product-improvement/orca-order-remediation-checklist.md` のチェックを更新する。

## まずやること

1. リポジトリルートで次を読む。
   - `docs/web-client/product-improvement/orca-order-remediation-checklist.md`
   - `docs/web-client/product-improvement/orca-order-remediation-subagents.md`
2. `docs/web-client/product-improvement/orca-order-remediation-checklist.md` の **0. 決定ログ** を埋めるための最小限のコード調査を行う。
3. 決定ログを埋めたら、**サブエージェントを最大限使って並列実行**する。
4. P0 ブロッカーから着手し、P0 が片付くまで P1/P2 のみを先行完了扱いにしない。
5. すべての変更後に test を実行し、結果を文書に反映する。

## 並列実行のしかた

可能な限り、以下のサブエージェント単位で並列実行すること。各サブエージェントには `docs/web-client/product-improvement/orca-order-remediation-subagents.md` の該当プロンプトを渡すこと。

- Agent A: canonical/entity/class・共通データモデル
- Agent B: 処方
- Agent C: 注射
- Agent D: 400/700/800 系（処置・一般・その他・放射線）
- Agent E: 600 系（検体・生理・細菌）
- Agent F: テスト / XML / QA

あなた自身は統括者として次を行うこと。

- サブエージェントの提案をマージし、方針競合を解消する
- `docs/web-client/product-improvement/orca-order-remediation-checklist.md` のチェックを更新する
- 先に契約・canonical rule を固め、あとで UI や XML を追従させる
- 変更が silent drop を生まないかを必ず確認する

## 実行順序

### Phase 0: 契約固定

- `testOrder / laboTest` canonical
- `generalOrder / treatmentOrder` canonical
- charge class meta の保持方針
- `bodyPart` / `adminCode` / row role / subtype の first-class 方針
- `unit` / `memo` / `admin` / `bundleName` / `startDate` の local-only or send 方針
- 処方 `genericFlg` 分離と `rpNumber` 一意化方針

この phase は、計画書の決定ログへ反映してから次へ進むこと。

### Phase 1: P0 ブロッカー

- 処方 save/send source of truth 一本化
- non-med silent drop 禁止
- canonical/entity/class の是正
- `unit` の XML 契約是正
- mixed coded/uncoded row の明示 block

### Phase 2: first-class field 化

- `adminCode`
- `bodyPart`
- row role / subtype
- comment parameter
- `setCode` provenance
- hidden meta / memo codec の整理

### Phase 3: UI / validation / input set / server / XML

- editor 入力と送信前 validation の整合
- input set detail/list の entity/class 整合
- server mutation/fetch の canonical 化
- XML builder の実装と test

### Phase 4: 種別別仕上げ

- 処方
- 注射
- 基本診療料 / 指導料
- 処置 / 一般 / その他
- 放射線
- 検体 / 生理 / 細菌

### Phase 5: テストと文書

- web-client / server-modernized の追加テスト
- actual XML テスト
- save → fetch → normalize → XML の smoke
- 計画書更新
- 変更ファイル一覧と残リスク整理

## 実装上の必須方針

### 1. silent drop を残さない

- `normalizeOrderBundleToRp()` やその周辺で、unsupported data を黙って捨てない。
- unsupported な bundle / row / field は、保存前または送信前に明示エラーにする。

### 2. entity と class を一貫させる

- `testOrder / laboTest` は一つの canonical に揃える。
- `generalOrder / treatmentOrder` は一つの canonical に揃えるか、別概念なら input set / save / send すべてで整合させる。
- charge 系の class meta は entity default で再計算しない。

### 3. UI と XML の契約を揃える

- UI に入力欄がある属性は、XML まで送るか local-only 表示へ落とす。
- `unit` は特に優先して扱う。
- `memoPlaceholder` があるのに入力欄が無い、あるいは入力欄があるのに send で消える状態を解消する。

### 4. 処方は専用に扱う

- 処方の source of truth は一本化する。
- `genericFlg` は一般名相当と後発品可否を分離する。
- `rpNumber` は RP 識別子として一意にする。
- `221 / 222 / 231 / 232` と input set の意味を壊さない。

### 5. 注射は flat row のまま済ませない

- `admin / adminCode / bundleNumber / route / timing / frequency / speed / 手技料なし` の扱いを決めて実装する。
- `supportsInjectionNoProcedure=true` の sentinel memo 実装は残さない。

### 6. bodyPart は単一ソースにする

- items と専用 field の二重表現をやめる。
- manual / master-selected の両経路で round-trip と send を成立させる。

## テスト方針

- client 側だけの mock ではなく、server の actual XML まで見るテストを追加する。
- 少なくとも以下を通すこと。
  - 処方: 1 RP 2薬剤 + コメント + 一般名/後発品可否
  - 注射: 手技+薬剤 + admin/adminCode + 回数
  - 基本/指導料: 非 default class の再編集保存
  - 一般/処置/その他: mixed row 明示 block
  - 放射線: bodyPart + 本体 + 材料/造影
  - 検体/生理/細菌: canonical entity + subtype + input set

## 変更後に必ずやること

1. 追加・修正した test を実行する。
2. `docs/web-client/product-improvement/orca-order-remediation-checklist.md` を更新する。
3. 変更ファイル一覧、実行コマンド、結果、残リスクを最終報告にまとめる。
4. 完了していないチェックがあれば、理由と未完了範囲を明示する。

## 最終報告フォーマット

- 完了したチェック
- 主要変更ファイル
- canonical decision の最終形
- 追加した test
- 実行したコマンドと結果
- 残課題 / リスク
