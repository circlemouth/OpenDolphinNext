# 01. Final Fixed Decisions

## 1. 裁定ルール
- repo truth > recovery plan > reviewer proposal
- repo に証拠がないことは **unknown**
- unknown は無理に潰さず、gate と fail-close fallback を残す
- 本 package で fixed にするのは **repo truth と fixed premise を破らないものだけ**
- 新規 copy / state / layout rule は、既存挙動の破綻修正または fixed premise の実装に必要なものだけを採用する

## 2. fixed premise の最終確定
### 2-1. 画面責務
- **left pane**: 履歴・Do・患者補助・病名補助などの support/reference
- **center pane**: page primary、入力・保存・診察進行・文書編集の主面
- **right pane**: order-facing chooser only。chooser は候補選択と handoff まで。editor / document / ORCA summary の主面にしない

### 2-2. patient context
- patient context は URL / localStorage / sessionStorage に永続化しない
- Charts handoff は `scheduleKey` または `encounterKey` 必須
- patientId-only first-match を再導入しない
- missing context は named return + fail-close

### 2-3. finish と send
- `finish` = local progression / status update
- `send` = ORCA outbound action
- `finish` success は `会計待ち` まで
- `send` success は `送信済` slot まで。`会計済み` は confirmation source が出るまで表示しない

### 2-4. `送信済` と `会計済み`
- `送信済` は **billing transmission signal**
- `会計済み` は **workflow completion / confirmation result**
- `send success != paid`
- `応答済` も transmission / queue signal であり、paid の代用にしない

### 2-5. disease 3 層
1. **insurance-local authoring** — current writable surface。`/api/local/diagnoses*` を insurance-local authoring route として扱う
2. **ORCA mirror** — read-only mirror。local insurance truth を auto-merge / auto-delete / auto-overwrite しない
3. **candidate source** — order set / Do / history / master search からの候補。明示 confirm でしか insurance-local へ入れない

clinical disease は別 layer。source 未実装の間は fake list を出さず boundary note で止める。

### 2-6. document / image lifecycle
- **template source** と **patient-specific document snapshot** を混ぜない
- **odletter snapshot** を patient-specific document 正本とする
- **patient image asset** は `/patients/{patientId}/images`
- **attachment reference** は asset 参照。asset 実体と同一視しない
- **print preview** は snapshot 表示であり、route-state only
- **history delete** は reference remove only
- **hard delete** は gate が閉じるまで UI 非表示

### 2-7. setting dependency 分離
- `/api/admin/config` = charts delivery only
- `/api/admin/orca/connection` = facility connection only
- `/api/admin/orca/capabilities` = availability / testedScope / pushMode / local wrapper metadata
- `runtime-config` = runtime-owned flags (`orca.mode`, acceptance push suppress など)
- setting dependency は billing / disease の canonical meaning を変えない
- unknown setting は enabled/success ではなく feature-off/fail-close

### 2-8. visible-state / DADS
- important info を disclosure / accordion / selected-only detail に隠さない
- 1 screen 1 primary
- disabled/blocked には理由を近接表示する
- generic bottom navigation を新規導入しない
- color-only state を作らない
- static field error / disabled reason に `aria-live` を乱用しない

## 3. reviewer 間で衝突した論点の裁定
| 論点 | 衝突内容 | 裁定 | 実装上の帰結 |
| --- | --- | --- | --- |
| Reception send success | current ReceptionPage は send success で `会計済み` override。Charts は paid confirmation を別 source に分離。 | Charts 側 current truth + fixed premise `send success != paid` を優先し、Reception auto-promotion を撤去する。 | workflow と transmission を分離し、`会計待ち + 送信済` を fallback にする。 |
| Right rail scope | current runtime right rail は `document` / `orca` と embedded editor を持つ。fixed premise は chooser-only。 | fixed premise と reviewer WS-03 を優先。runtime rail は order-facing chooser only。 | document/orca/editor は center / dedicated flow に戻す。 |
| Disease single list | current UI は `保険病名` single list。recovery/reviewer は 3 層分離を提案。 | repo truth を認めつつ、改善対象として 3 層分離を fixed now にする。 | clinical source 未実装時は boundary note で止める。 |
| Document print preview | current code は sessionStorage preview restore。patient context 非永続 fixed premise と衝突。 | fixed premise を優先し、route-state only + fail-close に変更。 | missing-state は safe return CTA で戻す。 |
| Admin config scope | recovery 候補には setting inventory 拡張があるが、repo truth 上 `/api/admin/config` は charts delivery only。 | repo truth を優先。bulk expansion 禁止。 | source 未確定 setting は gate + feature-off。 |
| PR strategy | recovery には docs-only / responsive standalone PR がある。reviewer-09 は current repo に合わないと指摘。 | reviewer-09 の裁定を採用。docs/tests/code は owner PR に同梱。 | residual stabilization PR は non-contract fix に限定。 |
| 390 mobile target | reviewer-08 は 390 を横断観点に入れるが、current repo truth で production target 固定は Mobile Images のみ。 | repo truth を優先。390 fixed target は Mobile Images のみ。 | Charts/Reception の 390 は gate + fail-close / no bottom nav。 |

## 4. fixed now
### 4-1. Reception / billing taxonomy
- workflow state = `予約 / 受付中 / 診療中 / 会計待ち / 再計待 / 会計済み`
- transmission signal = `未送信 / 送信済 / 再送待ち / 保留 / 失敗 / 応答済`
- correction signal = `要確認: {reason}` / `要再計: {reason}`
- setting note = `設定依存: {reason}`
- `entry.note` は generic memo のまま。correction slot ではない

### 4-2. Charts main
- `ChartsPatientSummaryBar` は encounter context band
- `ChartsActionBar` が page CTA owner
- visible secondary = `保存` / `印刷` / `受付へ戻る`
- `診察中断` は support only
- `閉じる` は workspace action。route return 代替に使わない
- minimal context loss は editor ごと fail-close
- canonical ORCA context only missing のときは editor を残し、send/print だけ disable

### 4-3. Right rail chooser-only
- runtime rail labels = `処方 / 注射 / 処置 / 検査 / 算定`
- source labels = `患者候補 / 施設頻用 / ORCA入力セット / ORCA診療セット / 既存オーダー`
- picker note は provenance / expand-only copy のみ
- sendability note は editor / summary 側に残す
- Do browse は `PastHubPanel` に残す

### 4-4. Disease
- `保険病名` / `ORCA mirror` / `候補` を 1 list に潰さない
- sync / stale / conflict / manual resolution は default visible
- outcome/date/stale exact semantics が未確定の間は canonical enum と断定しない
- order set の disease payload は candidate-only として扱う

### 4-5. Document / image
- attach 不可理由は image card / document action の近傍に出す
- attachment-linked saved document の `編集` は gate 閉鎖まで block
- print missing-state は fail-close
- patient context 非永続を print/document/image に横断適用する

### 4-6. Settings / admin
- admin page は scope note を出し、global facility setting 正本に見せない
- WebORCA access / config / testedScope / push settings は別 line のまま
- unknown setting の toggle / badge / success copy を出さない

## 5. non-goal
- `client/` / `server/` legacy の変更
- `DocumentTimeline` / `MedicalOutpatientRecordPanel` の主面昇格
- `/api/admin/delivery` を第 2 正本として復活
- generic bottom nav
- right rail への second editor / document editor / disease editor 混在
- ORCA mirror の truth 化
- patient context 永続化
- hard delete UI の先行実装
- responsive/a11y broad rewrite を 1 PR に詰め込むこと
- repo に証拠がない route / schema / copy を guessed field で埋めること

## 6. redline
- `send success` を `paid` と同義で見せた時点で stop-ship
- correction / rebill / setting dependency を同一 chip / banner / slot に混ぜた時点で stop-ship
- important info を disclosure に落とした時点で stop-ship
- patientId-only handoff / overlay を復活させた時点で stop-ship
- attachment-linked document の existing reference が silent drop した時点で stop-ship
- disease diff を silent merge / silent delete した時点で stop-ship
