# 05. Screen State Copy Spec

## 共通ルール
- copy は **current repo truth** と fixed premise に揃える
- unknown source を success / enabled 側へ倒さない
- `送信済` と `会計済み` は別 slot
- correction note と setting note は別 slot / 別 tone
- important info を disclosure に入れない
- 1 screen 1 primary を原則とする

---

## 1. Reception

### visible information
- 氏名
- patientId
- encounter anchor（受付時刻または予約時刻）
- 診療科
- workflow badge
- billing transmission signal
- correction signal / `再計待` reason
- primary action

### primary CTA
- `カルテ`

### secondary CTA
- `受付取消`
- `予約`
- `会計送信`（claim send を row action に残す場合も primary にはしない）

### state labels
- workflow: `予約`, `受付中`, `診療中`, `会計待ち`, `再計待`, `会計済み`
- transmission: `未送信`, `送信済`, `再送待ち`, `保留`, `失敗`, `応答済`
- correction: `要確認`, `要再計`
- setting: `設定依存`

### note / warning / error / info
- send success detail:
  - `会計送信を完了。会計済みは収納確認後に反映します。`
- correction note:
  - `ORCA補正要確認: {safe reason}`
- rebill note:
  - `再計待: {safe reason}`
- setting note:
  - `設定依存: {reason}`
- blocked-send note:
  - `会計送信不可: {reason}`

### narrow layout で残すもの
- workflow badge
- transmission signal
- correction / rebill note
- primary action
- patient identity
- encounter anchor

---

## 2. Charts

### visible information
- encounter context band:
  - 患者名
  - 患者ID
  - 来院日
  - 診療科
  - 担当医
  - 現在ステータス
  - 受付ID
  - 予約ID
  - `送信` slot
  - `会計` slot
- action row:
  - primary CTA
  - `保存`
  - `印刷`
  - `受付へ戻る`
- main center:
  - `SoapNotePanel`

### primary CTA
phase 別に 1 本だけ:
- `診察開始`
- `診察終了`
- `ORCA送信`

### secondary CTA
- `保存`
- `印刷`
- `受付へ戻る`

### state labels
- send slot:
  - `未送信`
  - `送信済`
  - `再送待ち`
  - `保留`
  - `失敗`
  - `応答済`
- billing slot:
  - `会計待ち`
  - `会計済み`
  - `未確認`
  - `再計待`
- context state:
  - `来院文脈不足`
  - `正式送信条件不足`
  - `設定依存`

### note / warning / error / info
- canonical context missing:
  - `正式送信条件不足: {不足 field labels}`
- minimal context lost:
  - `来院文脈を復元できませんでした。受付から対象患者を選び直してください。`
- correction:
  - `ORCA補正要確認: {safe reason}`
- setting dependency:
  - `設定依存: {reason}`
- send success:
  - `ORCA送信結果を確認し、必要なら一覧を再取得してください。`
- finish success:
  - `会計待ちへの反映を確認してください。`

### narrow layout で残すもの
- encounter context band
- primary CTA
- `保存`
- `印刷`
- `受付へ戻る`
- blocked reason / correction note / setting note
- `SoapNotePanel`

---

## 3. Right rail

### visible information
- category buttons:
  - `処方`
  - `注射`
  - `処置`
  - `検査`
  - `算定`
- source sections:
  - `既存オーダー`
  - `患者候補`
  - `施設頻用`
  - `ORCA入力セット`
  - `ORCA診療セット`
  - `検索して追加`

### primary CTA
- なし（page primary は center が持つ）

### secondary CTA
- `反映`
- `編集面で開く`
- `新規作成を開く`
- `閉じる`

### state labels
- `候補なし`
- `取得失敗`
- `未対応`
- `展開専用`

### note / warning / error / info
- patient candidate note:
  - `患者候補はこの患者の既存入力から出します。`
- facility frequent note:
  - `施設頻用は施設全体の頻用候補です。`
- ORCA set note:
  - `setCode は展開専用です。反映後の編集内容には保持しません。`
- unsupported category:
  - `このカテゴリではこの候補を使いません。`
- fetch failure:
  - `候補取得に失敗しました。再試行してください。`

### narrow layout で残すもの
- category buttons
- source section 見出し
- `反映` / `編集面で開く`
- failure note
- close control

---

## 4. Disease

### visible information
- `保険病名`
- `ORCA mirror`
- `候補`
- clinical source が実装済みの場合のみ `clinical`

### primary CTA
- `保険病名に追加`（candidate confirm）
- disease editor 主面内の save は local operation primary だが page primary ではない

### secondary CTA
- `候補を閉じる`
- `差分を確認`
- `編集`
- `削除`

### state labels
- `同期候補があります`
- `ORCA側と差分があります`
- `保険病名の確認が必要です`
- `mirror unavailable`
- `clinical unavailable`

### note / warning / error / info
- sync note:
  - `同期候補があります`
- conflict note:
  - `ORCA側と差分があります`
- manual resolution:
  - `保険病名の確認が必要です`
- clinical unavailable:
  - `clinical source が未実装のため、この画面では保険病名だけを扱います。`
- mirror unavailable:
  - `ORCA mirror を取得できないため、同期状態は未確認です。`

### narrow layout で残すもの
- layer 見出し
- conflict / sync / manual-resolution note
- candidate confirm action
- explicit state labels（色だけにしない）

---

## 5. Document / Image

### visible information
- template selector
- attachment summary
- attachability reason
- delete impact
- output block reason
- print preview state
- patient image asset state

### primary CTA
- document create flow: `文書作成`
- document editor local action: `保存`
- mobile images stage:
  - file 未選択: `撮影して送る`
  - file 選択後: `送信`

### secondary CTA
- `文書雛形`
- `文書履歴参照を削除`
- `SOAPに挿入`
- `Chartsへ戻る`

### state labels
- `画像参照 {n}件`
- `snapshot only`
- `attach unavailable`
- `print preview unavailable`
- `feature_disabled`

### note / warning / error / info
- delete dialog title:
  - `文書履歴参照を削除しますか？`
- delete impact:
  - `odletter の履歴から削除します。患者画像実体は削除しません。`
- attachment-linked edit blocked:
  - `画像参照付き文書は現契約では安全に再編集できません。新規作成で画像を選び直してください。`
- attachability:
  - `患者画像としては保存済みですが、文書には添付できません。`
- print missing-state:
  - `この画面は一時プレビューのため、再開できません。Charts へ戻って開き直してください。`

### narrow layout で残すもの
- attachment summary
- attachability / delete impact / print missing-state note
- primary stage CTA
- patient identification（mobile images）

---

## 6. Billing

### visible information
- workflow state
- transmission signal
- correction note
- setting note

### primary CTA
- `ORCA送信`

### secondary CTA
- `保存`
- `印刷`
- `受付へ戻る`

### state labels
- workflow: `会計待ち`, `再計待`, `会計済み`
- transmission: `送信済`, `再送待ち`, `保留`, `失敗`, `応答済`
- correction: `ORCA補正要確認`
- setting: `設定依存`

### note / warning / error / info
- send success:
  - `会計送信を完了。会計済みは収納確認後に反映します。`
- correction:
  - `ORCA補正要確認: {safe reason}`
- rebill:
  - `再計待: 会計済み後に変更があったため再会計が必要です。`
- setting:
  - `設定依存: {reason}`

### narrow layout で残すもの
- workflow
- transmission
- correction / rebill note
- primary action

---

## 7. Missing-context

### visible information
- reason
- blocked surface
- safe next action

### primary CTA
- `受付へ戻る`
- surface が Mobile Images / Patients の場合は named return を使う

### secondary CTA
- `再試行`
- `閉じる`

### state labels
- `来院文脈不足`
- `復元不可`
- `未選択患者`
- `ambiguous_active_entries`

### note / warning / error / info
- Charts:
  - `来院文脈を復元できませんでした。受付から対象患者を選び直してください。`
- Mobile Images:
  - `患者情報が見つからないため、この画面では続行できません。`
- Patients:
  - `対象患者を特定できません。Patients から患者を選び直してください。`

### narrow layout で残すもの
- reason
- primary return
- surface name

---

## 8. Narrow layout / compression

### 1440
- support / center / chooser の 3 役割が同時に読める
- hidden で意味を補わない

### 1280
- action row は 2 段化可
- primary CTA、encounter context、send guard、correction note、setting note は常時 visible

### 1024
- center-first 再配置
- 読み順: `encounter context → action bar → SOAP → billing/correction → disease/document/support`
- utility は overlay/drawer 可だが chooser-only 維持

### 768
- single-column leaning
- important info を accordion / disclosure に落とさない
- bottom nav を作らない

### 390
- fixed production target は Mobile Images
- Reception / Charts で 390 対応を理由に generic bottom nav を新設しない

---

## 9. Mobile Images

### visible information
- patient identification
- stage banner
- file summary
- progress
- success link

### primary CTA
- 未選択時: `撮影して送る`
- 選択後: `送信`

### secondary CTA
- `写真を選んで送る`
- `キャンセル`
- named return

### state labels
- `送信準備中`
- `送信中`
- `送信完了`
- `feature_disabled`
- `missing patient`

### note / warning / error / info
- missing patient:
  - `患者情報が見つからないため、この画面では続行できません。`
- feature off:
  - `患者画像機能はサーバーで無効化されています。`
- retry:
  - `送信に失敗しました。内容を確認して再試行してください。`

### narrow layout で残すもの
- patient identification
- stage banner
- primary CTA
- retry/success focus target
