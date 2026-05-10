# Billing Boundary Correction Scenarios

正本 docset: SA-06

## 目的
- Charts の billing 表示を `workflow` / `transmission` / `correction` / `setting` の 4 層で扱う。
- `medical-mod-v2` の送信成功を `paid` と同義にしない。
- `incomeinfv2` と `medical-mod-v2` の責務を混線させない。

## 層定義
### workflow
- 院内ローカル診療サマリの状態。
- source は local claim summary。
- correction required を workflow state に昇格させない。

### transmission
- `medical-mod-v2` の送達状態。
- `送信済` / `送信失敗` / `未送信` を扱う。
- 送信成功だけでは `会計済み` にしない。

### correction
- `medical-mod-v2` warning の補正メモ。
- 画面上では note として見せる。
- workflow state や rebill clear を自動変更しない。
- official bridge response の `operationStatus=ORCA_WARNING` または `needsUserReview=true` は、送達成功とは別の要確認として banner / toast / correction note に出す。

### setting
- `incomeinfv2` 未確認、もしくは paid source 未確定時の確認条件メモ。
- `medical-mod-v2` の送信結果とは別に扱う。

## 判定ルール
- confirmation source は `incomeinfv2` のみ。
- transmission source は `medical-mod-v2` のみ。
- `paid=true` は invoice と `incomeinfv2` の照合でのみ成立する。
- `medical-mod-v2` warning は correction note に留める。
- `medical-mod-v2` warning を成功通知だけに潰さない。ただし `Api_Result` 正常で送達済みの場合、transmission は `送信済` として保持し、会計確定は `incomeinfv2` 照合まで未判定にする。
- setting note と correction note は別 card / 別文言で表示する。

## Fallback
- UG-01 未解決: `会計待ち+送信済`
- UG-02 未解決: rebill clear は自動解除しない
- UG-12 未解決: correction note 表示のみ

## 期待表示
- transmission 成功かつ paid 未確認:
  - confirmation: `会計待ち+送信済`
  - correction note が無ければ setting note のみ表示
- transmission 成功かつ warning あり:
  - correction note を表示
  - workflow state は変更しない
- incomeinfv2 で invoice 一致:
  - confirmation: `会計済み`
  - queue は `ack`
