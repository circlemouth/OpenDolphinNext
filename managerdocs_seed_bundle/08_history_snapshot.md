# 08. History snapshot and source basis

この文書は、manager が「なぜ今こういう結論になっているか」を短時間で追えるようにするための履歴メモです。  
監査向けの完全な change history ではなく、**判断に必要な歴史だけ**を残しています。

---

## 1. この資料セットの source basis

この資料セットは、次の情報源を土台にしています。

### repo 内 current docs
- `web-client/README.md`
- `web-client/notes/auth-check.md`
- `web-client/notes/auth-transition.md`
- `web-client/notes/patient-context-contract.md`
- `web-client/notes/feedback-spec.md`
- `web-client/notes/release-gate.md`
- `web-client/notes/security-spec.md`
- `web-client/notes/ui-current-contract.md`
- `pom.server-modernized.xml`
- current repo に見える workflow / scripts / package / docs の情報

### manager review / worker report 由来の確定事項
- raw runtime error details の narrow reopen は修正済み
- docs truth-sync は完了済み
- repo-local の追加差分は不要
- repo-local で残る code task は none
- repo-external sign-off が次の主タスク
- UI 改善は release blocker ではなく改善バックログとして扱う

### intentionally source basis から外しているもの
- 古い会話だけに依存した判断
- partial snapshot 由来の欠落
- repo 外設定の推測
- “以前そうだった” という運用記憶

---

## 2. manager が知っておくべき流れ

### フェーズ A: repo-local closeout
- static-analysis baseline burn-down が完了
- authoritative static-analysis entrypoint を Maven 1 本に統一
- dedicated static-analysis PR workflow を restore
- minimal release gate を docs に明文化
- local validation で主要 gate を green 扱いに整理

### フェーズ B: docs freeze
- README を入口要約に縮退
- release gate、auth transition、patient context、feedback、UI current contract を notes に分離
- security の正本を `security-spec.md` に寄せた

### フェーズ C: full-repo 契約照合
- full repo を read-only で照合
- TRUE_REGRESSION は raw API / internal message 露出 1 件だけと判定
- 他は docs under-spec / over-assert に整理

### フェーズ D: narrow reopen
- raw runtime error details を除去
- Web クライアントの active runtime surface から raw detail 直表示を外した

### フェーズ E: docs truth-sync
- auth-transition / patient-context-contract / ui-current-contract / feedback-spec を repo truth に同期
- same-surface factor2、default landing、surface 別 lost-context、`SoapNotePanel` 主面、CTA 条件などを整理

### フェーズ F: repo-external sign-off へ移行
- repo-local は merge ready
- ただし release-ready ではない
- 次の主タスクを GitHub required checks と production secrets / config の確認に切り替えた

---

## 3. manager 報告ベースの既知コミット

### `e348fe94f`
目的:
- raw runtime error details の露出除去

manager 観点の意味:
- narrow reopen の code patch
- TRUE_REGRESSION への対処
- これ以外の repo-local コード修正は現時点で不要

### `5fd9c2a1c`
目的:
- docs truth-sync

manager 観点の意味:
- auth / patient-context / ui-current-contract / feedback を repo truth に同期
- docs under-spec / over-assert の主要部分を解消
- repo-local docs 側の追加差分は原則不要

---

## 4. 今の資料セットが置き換えるもの

このセットは、単一の `phase3_handoff_current_state.md` を読むだけでは足りなくなった情報を分解して置き換えています。

### 置き換えの考え方
- 旧 handoff の **current state / reopen ルール / release 境界** → `01`
- 旧 handoff の **repo-external manual task** → `02`
- web-client notes 群の **manager 向け要約** → `03`
- UI 相談結果の **統合計画** → `04`
- future reviewer / worker 指示 → `05`
- unknown / evidence gap 管理 → `06`
- 依頼文・sign-off 文面 → `07`

### 旧 handoff を削除してよい理由
- manager が必要な情報を単一ファイルから複数責務の docs へ分離した
- current contract と repo-external sign-off と UI backlog の混線を減らした
- 今後の更新箇所が明確になった

---

## 5. 次の manager が誤りやすい点

1. **repo-local closeout と release-ready を同じ意味にしないこと**
2. **UI backlog を release blocker として再拡大しないこと**
3. **required checks / secrets の未確認を repo defect と見なさないこと**
4. **DocumentTimeline を normal runtime の主面に戻さないこと**
5. **patient context の永続化を便利さ対策として持ち込まないこと**
6. **`/api/admin/delivery` を第 2 正本として復活させないこと**
7. **ChatGPT / Codex / 人手の境界を崩さないこと**

---

## 6. 使い方の最終メモ

新しい manager が最初にすべきことは、history を掘ることではありません。

1. `01` と `02` を読む
2. `07` の文面を送る
3. 回答を `02` に転記する
4. repo mismatch が出たら `05` に従って Codex へ戻す
5. UI 改善は `04` の順に backlog 化する

この 5 手順で十分です。
