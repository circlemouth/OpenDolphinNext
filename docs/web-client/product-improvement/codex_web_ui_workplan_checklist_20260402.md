# Web UI 改修チェックボックス式作業計画書

## 0. この計画書の位置づけ
この計画書は、Web クライアント UI 監査の取りまとめ結果を、**Codex がそのまま実行計画として参照できる形**に落としたものです。

前提:
- current repo が正本
- repo に証拠がなければ unknown
- 後方互換性は考慮しない
- build 成果物、zip 展開ゴミ、`target/`、`dist/`、`coverage/`、`__MACOSX/` は無視する
- repo-external（GitHub required checks、branch protection、production secrets/config、運用証跡）は人手で閉じる
- unknown を想像で埋めない

この run は **release blocker の reopen ではなく、current-contract-friendly な repo-local 改修**として進める。

---

## 1. 固定する実装方針

### 1-1. 守る current contract
- auth-sensitive transition は `replace` 前提
- patient context は URL / `localStorage` / `sessionStorage` に永続化しない
- deep link の sensitive query は scrub 前提
- Charts の主面は `SoapNotePanel`
- `OrcaSummary` は補助面
- debug-only surface を normal runtime 主面に昇格させない
- admin の source of truth は `/api/admin/config`
- `/api/admin/delivery` を第2正本に戻さない

### 1-2. この run で Codex が決め打ちしてよい方針
- `WorkspaceTabBar` は **tab semantics を維持し、Arrow / Home / End を実装して完成させる**
- `AdministrationPage` の top-level tabs は **中途半端な tab pattern をやめ、plain navigation / section switcher として整理する**
- admin authz の canonical layer は **route-level** に寄せる
- admin denial copy は **要件 / 次 action / safe support ID** に絞る
- `AdminDeliveryStatusCard` は **比較表ではなく配信メタデータ表示** に寄せる
- `connection` が接続テストの実行面、`operations` は状態参照面に寄せる
- `ReturnToBar` への direct return は **safe return 候補だけ**を使う

### 1-3. 明示的な非目標
- patient context の reload/new-tab 復元を再導入しない
- history を増やして Back 問題を解かない
- Charts の広い再設計を始めない
- root docs や manager docs を推測で新造しない
- repo-external の未確認を repo defect と扱わない

---

## 2. ブロッカー停止条件
以下が起きたら、その場で止めて計画書末尾の「blocker 記録」に残すこと。

- 対象 source が current repo に存在しない
- current contract を裏づける repo-local 証拠が見つからない
- repo-external の確認が必要になった
- 変更範囲外の大規模 failing test を踏み、原因切り分け不能
- current contract を壊さないと進められない
- 変更のために absent docs の内容を想像する必要が出た

blocker 記録には必ず次を残す。
- blocker 内容
- 根拠ファイル / 不足情報
- なぜ止めるべきか
- 人間または次エージェントが判断すべきこと

---

## 3. 実行前チェック
- [ ] P0-01 実際の `web-client` 作業ディレクトリ、package manager、test runner を repo から確認する
- [ ] P0-02 `package.json`、workspace 定義、CI script を読み、最終 validation コマンド候補を確定する
- [ ] P0-03 build 成果物・zip 展開ゴミ・`target/`・`dist/`・`coverage/` を対象外にする
- [ ] P0-04 本計画書で対象にする主要ファイルの存在を確認する
  - `src/features/login/FacilityLoginResolver.tsx`
  - `src/LoginScreen.tsx`
  - `src/features/login/loginErrorMessage.ts`
  - `src/features/reception/pages/ReceptionPage.tsx`
  - `src/features/images/pages/MobileImagesUploadPage.tsx`
  - `src/routes/useAppNavigation.ts`
  - `src/components/modals/FocusTrapDialog.tsx`
  - `src/features/administration/components/ConfirmDialog.tsx`
  - `src/features/administration/AdministrationPage.tsx`
  - `src/features/administration/delivery/AdminDeliveryStatusCard.tsx`
  - `src/features/administration/delivery/AdminDeliveryConfigCard.tsx`
  - `src/features/administration/delivery/WebOrcaConnectionCard.tsx`
  - `src/features/administration/delivery/DeliverySubNav.tsx`
  - `src/features/workspaceTabs/WorkspaceTabBar.tsx`
  - `web-client/notes/auth-transition.md`
  - `web-client/notes/feedback-spec.md`
  - `web-client/notes/ui-current-contract.md`
  - `web-client/notes/patient-context-contract.md`
- [ ] P0-05 absent な `03_web_current_contract_summary.md` / `04_ui_improvement_program.md` は unknown のまま扱うと明記する

---

## 4. Phase A — current contract に対する repo-local regression / mismatch 修正

### A-01 AUTH-WEB-01 `/login` auto-resolve の `replace` 回復
- [ ] `FacilityLoginResolver` の `/login` → `/f/:facilityId/login` auto-resolve を一律 `replace` に寄せる
- [ ] `push` 前提になっていた test があれば `replace` 前提に更新する
- [ ] Back 問題は history ではなく visible reason / destination copy で解く方針へ統一する
- Done when:
  - auto-resolve 後に余計な login history が増えない
  - test で `replace` が固定される

### A-02 PC-01 safe return gating の統一
- [ ] `ReceptionPage` の `ReturnToBar` 入力を `safeReturnToCandidate` 基準へ寄せる
- [ ] `MobileImagesUploadPage` の `ReturnToBar` 入力を `safeReturnToCandidate` 基準へ寄せる
- [ ] unsafe 候補は surface fallback に落とす
- [ ] direct return は safe 候補だけ、という contract を code / tests に反映する
- Done when:
  - Reception / Mobile Images / Patients で safe return gating が揃う
  - unsafe path が direct return に使われない

### A-03 auth landing path と docs/test の整合化
- [ ] logout / timeout 系 landing path を現行 code に揃えて docs を修正する
- [ ] facility が分かる時は `/f/:facilityId/login`、不明時は `/login` という整理で test も exact path を持つようにする
- Done when:
  - docs の over-assert が消える
  - landing path が test で固定される

### A-04 login notice precedence の canonical 化
- [ ] `loginNotice` と `sessionExpiryNotice` の優先順位を 1 箇所に寄せる
- [ ] timeout / unauthorized / forbidden / logout の visible copy 優先順位を明文化する
- [ ] AppRouter 経由の integration test を追加する
- Done when:
  - auth reason の最終表示が helper ではなく surface integration でも固定される

### A-05 factor2 429 / throttled の UI 固定
- [ ] `LoginScreen` integration test で factor2 submit → 429 を固定する
- [ ] step 2 に残ること、待機文言が見えることを確認する
- Done when:
  - helper 単体ではなく screen integration で 429 contract が保護される

### A-06 dirty logout / switch account の route-level test 固定
- [ ] dirty 状態の logout で `cancel` / `discard` 分岐を route-level で固定する
- [ ] dirty 状態の switch account でも同様に固定する
- Done when:
  - session exit dialog の最低 contract が route-level で守られる

---

## 5. Phase B — feedback / copy / support disclosure の単線化

### B-01 LoginScreen 1段目失敗 copy の canonical 化
- [ ] credentials step の catch で generic つぶしをやめ、canonical message を正しく出す
- [ ] 401 / 403 / 404 / 429 / 5xx の integration test を追加または更新する
- Done when:
  - 1段目 login error が helper の意図どおり surface に出る

### B-02 auth notice matrix の共有 helper 化
- [ ] logout / timeout / unauthorized / forbidden の文言と CTA を 1 つの resolver に寄せる
- [ ] `loginRedirect` / `sessionExpiry` / `LoginScreen` の wording drift をなくす
- Done when:
  - auth notice の source が実質 1 本になる

### B-03 `FeedbackTone = success | info | warn | error` の shared 実装化
- [ ] shared enum / type を定義または既存 shared 定義へ統合する
- [ ] `ToneBanner` を `warning` ではなく `warn` ベースへ寄せる
- [ ] `AuditSummaryInline` を同 enum に寄せる
- [ ] `MobileImagesUploadPage` の tone 判定も shared taxonomy に寄せる
- Done when:
  - 4段 taxonomy が shared 実装で表現される

### B-04 state-loss / missing-patient copy の共通パターン化
- [ ] 「何が引き継がれないか」「どこで何を選び直すか」を surface 横断で揃える
- [ ] Patients mismatch / charts arrival copy を 1 文だけ強化する
- [ ] Mobile Images missing-patient と矛盾しない wording に寄せる
- Done when:
  - state-loss copy が ReturnToBar 契約に沿って揃う

### B-05 Patients の raw detail を support disclosure へ隔離
- [ ] `最新 auditEvent` の生 dump をやめる
- [ ] default 表示は `action / outcome / 時刻 / RUN_ID` などの要約へ寄せる
- [ ] endpoint / internal key は default から外し、必要なら diagnostics disclosure に隔離する
- Done when:
  - Patients default UI から raw dump が消える

### B-06 Administration の raw detail を support disclosure へ隔離
- [ ] `AdministrationPage` の `data.error` / `Error.message` 直埋め込みをやめる
- [ ] debug / operator-safe 領域を除き、通常 surface では canonical copy + safe support ID に寄せる
- Done when:
  - 通常 admin surface から raw internal detail が消える

### B-07 Mobile Images copy / supportability の改善
- [ ] 413 / 415 から code 表示を外す
- [ ] `再試行（Retry）` を日本語化する
- [ ] RUN_ID の copy 導線を追加する
- Done when:
  - Mobile Images の error / retry / supportability が app-wide 方針に揃う

### B-08 English / internal term drift の解消
- [ ] `Reception` → `受付`
- [ ] `Administration` → `管理画面`
- [ ] `system_admin` → `システム管理者`
- [ ] `readOnly` → `閲覧のみ`
- [ ] `actor=` など機械表現は allowlist 化された microcopy に寄せる
- Done when:
  - 日本語 UI から機械語 drift が目立たなくなる

---

## 6. Phase C — a11y minimum contract の実装

### C-01 `FocusTrapDialog` fallback focus
- [ ] focusable 0 件でも dialog panel に fallback focus を持たせる
- [ ] restore focus / tab loop / no-focusable の test を追加する
- Done when:
  - dialog 内 focus trap が 0 focusable でも破綻しない

### C-02 `ConfirmDialog` pending close affordance の整合化
- [ ] pending 中は close button / Esc / backdrop / cancel の扱いを一貫させる
- [ ] 見えているが閉じられない inert affordance を残さない
- [ ] pending の test を追加する
- Done when:
  - pending dialog の close semantics が perceivable かつ一貫する

### C-03 `LoginScreen` field-level validation の programmatic association
- [ ] `facilityId` / `userId` / `password` / `factor2Code` に `aria-invalid` を付ける
- [ ] inline error を `aria-describedby` で input と結ぶ
- [ ] validation failure test を追加する
- Done when:
  - LoginScreen の field error が programmatic に辿れる

### C-04 `ReturnToBar` narrow layout / CTA description
- [ ] narrow で hint を切り捨てない方向に CSS / layout を見直す
- [ ] 必要なら primary CTA と hint を `aria-describedby` で結ぶ
- [ ] narrow width test を追加する
- Done when:
  - essential recovery hint が narrow でも失われない

### C-05 `MobileImagesUploadPage` recovery focus / link name
- [ ] retry 後の focus relocation を実装する
- [ ] 複数 download link の accessible name を一意にする
- [ ] retry / success 後 focus の test を追加する
- Done when:
  - retry 直後の focus が宙に浮かない
  - link name が重複しない

### C-06 `WorkspaceTabBar` keyboard contract の完成
- [ ] `tablist/tab` semantics を維持したまま Arrow / Home / End を実装する
- [ ] keyboard navigation test を追加する
- [ ] docs も keyboard contract に追従させる
- Done when:
  - app-shell tabs が semantics と keyboard 実装の両方で揃う

### C-07 `AdministrationPage` top-level tabs の semantics 整理
- [ ] half-implemented tab pattern をやめ、plain navigation / section switcher に戻す
- [ ] route / query 同期と `aria-current` ベースの分かりやすい nav に寄せる
- [ ] test を update する
- Done when:
  - semantics と実挙動が矛盾しない

### C-08 Administration async feedback の live region 化
- [ ] save / test / refetch の feedback を `AdminAlert` か同等の live region へ寄せる
- [ ] tone ごとの `status` / `alert` を整理する
- [ ] test を追加する
- Done when:
  - async result feedback が announce される

### C-09 `OrcaQueueCard` disabled reason の関連付け
- [ ] retry 不可理由を button から programmatic に辿れるようにする
- Done when:
  - disabled CTA の理由が分かる

---

## 7. Phase D — Administration IA の軽量整理

### D-01 admin authz layer の単線化
- [ ] route-level guard を canonical として採用する
- [ ] page-level の user-visible duplicate guard を削除、または unreachable assert / test harness 限定へ落とす
- Done when:
  - authz layer が 1 本に見える

### D-02 admin denial copy の軽量化
- [ ] denial 本文から actor/session tuple を外す
- [ ] 要件 / 次 action / safe support ID に寄せる
- [ ] `再ログイン` を主 CTA にしない
- Done when:
  - admin forbidden copy が他 surface と同水準になる

### D-03 `DeliverySubNav` の regroup
- [ ] sub-nav に `[設定] / [状態確認] / [調査]` の見出しを追加する
- [ ] section 自体は維持する
- Done when:
  - delivery 内で「どこで設定 / 見る / 調査するか」が一目で分かる

### D-04 `AdminDeliveryStatusCard` の metadata card 化
- [ ] `config値 vs delivery値` の比較表をやめる
- [ ] `現在値 + deliveryId/version/etag/deliveredAt/verified` へ寄せる
- [ ] `verified` には `configQuery.data?.verified` を使い、`verifyAdminDelivery` と混線させない
- Done when:
  - 第2正本があるような見え方が消える

### D-05 ORCA 接続テストの実行面を `connection` に寄せる
- [ ] `connection` を接続テスト実行面にする
- [ ] `operations` は直近結果の参照と設定面への導線に寄せる
- Done when:
  - 設定面と状態面の責務が分かれる

### D-06 debug の通常運用導線からの距離を離す
- [ ] `config` の debug toggle は既定で閉じるか read-only 注記に寄せる
- [ ] `dashboard` の primary CTA 群から debug を外す
- Done when:
  - debug が first-class ではなくなる

### D-07 tab-specific KPI への整理
- [ ] 非 delivery タブでは delivery KPI を折りたたむか別要約へ差し替える
- Done when:
  - context bleed が減る

### D-08 naming cleanup
- [ ] `設定配信` → `配信・運用`
- [ ] `概要` → `状態概要`
- [ ] `接続` → `接続設定`
- [ ] `deliveryMode` → `配信モード`
- [ ] `配信ステータス` → `配信メタデータ` などへ整理
- Done when:
  - delivery まわりの用語が揃う

---

## 8. Phase E — visible repo docs / tests の truth-sync

### E-01 auth docs の更新
- [ ] `returnTo` と `state.from` を明確に分けて記述する
- [ ] scrub の時点を transport ごとに明文化する
- [ ] landing path を code に合わせて一本化する
- [ ] auth notice precedence を docs に明記する
- Done when:
  - auth docs の under-spec / over-assert が減る

### E-02 route inventory docs の更新
- [ ] `legacy disabled` route と explicit debug child routes を inventory に追記する
- Done when:
  - route inventory が repo-visible topology と揃う

### E-03 `feedback-spec.md` の更新
- [ ] 4段 taxonomy を明文化する
- [ ] dialog primitive 契約を追記する
- [ ] field-level validation 契約を追記する
- [ ] return / recovery CTA 契約を追記する
- [ ] recovery focus 契約を追記する
- [ ] Administration async feedback 契約を追記する
- Done when:
  - 変更した surface の docs が実装に追従する

### E-04 `patient-context-contract.md` の更新
- [ ] safe return gating を明記する
- [ ] Patients / Mobile Images の source priority を明記する
- [ ] Reception の `visitDate` hint-only を明記する
- [ ] `patients:returnTo` seam を残す場合は implementation detail と明記する
- Done when:
  - patient context docs が current code を正しく表す

### E-05 admin docs の更新
- [ ] `/api/admin/config` 単一路線を明記する
- [ ] `delivery` の役割を `設定 / 状態確認 / 調査` の観点で整理する
- [ ] debug の位置づけを通常導線より下げた形で記述する
- Done when:
  - admin mental model が docs と UI で揃う

### E-06 `patients:returnTo` seam の決着
- [ ] writer が current repo に無ければ reader を削除する
- [ ] writer があるなら source を docs に明記する
- [ ] test を現実に合わせて更新する
- Done when:
  - legacy seam が dead code か documented seam のどちらかに閉じる

---

## 9. Phase F — validation / self-review
- [ ] F-01 変更ファイルごとの targeted test を回す
- [ ] F-02 `web-client` の広め validation（例: `npm run test`, `npm run ci`, repo の canonical CI 相当）を、repo の実コマンドに従って回す
- [ ] F-03 失敗したら変更範囲起因か既存失敗かを切り分けて記録する
- [ ] F-04 docs / code / tests の 3 点が揃ったことを最終確認する
- [ ] F-05 本計画書の checkbox を更新し、実行ログを追記する

---

## 10. この run ではやらないこと
- [ ] N-01 patient context の永続化
- [ ] N-02 auth-sensitive transition を `replace` 以外へ戻すこと
- [ ] N-03 `SoapNotePanel` 以外を Charts 主面へ再定義すること
- [ ] N-04 debug-only surface の通常 runtime 露出
- [ ] N-05 `/api/admin/delivery` の復権
- [ ] N-06 repo-external sign-off 項目の代行確認
- [ ] N-07 absent docs の推測補完

---

## 11. 人手 / 別担当に残す項目（この Codex run の参考）
- [ ] H-01 `01_current_state_and_decision_rules.md` ほか root docs 群の可視化または参照張り替え
- [ ] H-02 `docs/managerdocs/*` の可視化または repo-local docs への参照切替
- [ ] H-03 GitHub required checks / branch protection の現況確認
- [ ] H-04 production secrets / config / sign-off 証跡の回収

---

## 12. 実行ログ
### run header
- 実行日:
- 着手コミット:
- 作業ディレクトリ:
- package manager / test runner:

### 完了チェック
- 完了タスク:
- 未完タスク:
- blocker:
- 主な変更ファイル:
- 実施テスト:
- 次に人間が見るべき点:

### blocker 記録
- blocker 内容:
- 根拠ファイル / 不足情報:
- その場で止める理由:
- 次に必要な判断:
