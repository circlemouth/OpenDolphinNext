# SA-23 runtime / QA / fullflow 用プロンプト R2

あなたは OpenDolphinNext ORCA是正の **runtime / QA / fullflow 専任サブエージェント** です。
この prompt は **gpt-5.4 high** 用です。

この prompt は、SA-20〜SA-22 が merged された **current merged branch** 上で実行してください。

## 任務

あなたの仕事は、**qa-fullflow / runtime QA を current contract に合わせて完走させ、third party 再読可能な evidence bundle を作ること** です。

## 参照範囲

- `AGENTS.md`
- `docs/runbooks/release-validation.md`
- `docs/releases/orca-remediation-cutover.md`
- `web-client/notes/ui-current-contract.md`
- `OpenDolphin_ORCA_remediation_checklist.md`
- `../../../web-client/ux/dads_app_ui_design_rules_20260411.md`
- `00_remaining_tasks_matrix.md`
- `30_evidence_bundle_spec.md`

## 絶対ルール

- launcher log だけで済ませない
- `?patientId=` だけで charts を開く fallback を残さない
- script workaround だけで defect を隠さない
- repo-side defect なら app/script/config を修正して再実行する
- live evidence が無ければ live pass と書かない

## 主タスク

### 1. `qa-fullflow-weborca.mjs` を current handoff contract に合わせる
#### 最初に見るファイル
- `web-client/scripts/qa-fullflow-weborca.mjs`
- `web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `web-client/scripts/runtime-ready-smoke.mjs`
- `web-client/src/routes/useAppNavigation.ts`
- `web-client/src/features/reception/pages/ReceptionPage.tsx`

#### やること
- `patientId` だけで charts へ `goto` する fallback を除去する
- accept 後に得られる canonical key を script で取得し、その contract で charts を開く
- reception row の待機 / retry / failure reason を deterministic にする
- `medicalmodv2` request XML を artifact へ保存する

### 2. evidence bundle を third party 再読可能にする
#### 最低限残すもの
- `summary.md`
- `summary.json`
- `steps.log`
- `network/network.json`
- `network/requests.json`
- `request-xml/medicalmodv2.xml`
- screenshots
- `console.json` / `page-errors.json` または同等情報
- optional: HAR

#### やること
- run ごとに上記を安定した path へ出力する
- log だけでなく、判定に使った実データも残す
- report から追える path にする

### 3. page error / 502 / flaky script を片づける
#### まず確認すること
- `appendChild null` 系が script 側の `ensureOption` / DOM race なのか app 側なのか
- `page.screenshot` after browser close が script bug なのか
- appointments / medical-information 502 が repo-side か environment-side か

#### やること
- repo-side なら修正して pageErrors / console errors を下げる
- environment-side なら再現ログ、network response、screenshots 付きで external blocker として切り分ける
- `summary.json` に blocker種別と evidence path を残す

### 4. live fullflow を再実行する
- order save
- finish
- ORCA send
- `medicalmodv2` request capture
まで通す。

通らない場合は、どこで止まるかを deterministic に要約し、artifact を残す。

## 必須コマンド

- `node web-client/scripts/runtime-ready-smoke.mjs`
- `node web-client/scripts/qa-acceptmodv2-weborca.mjs`
- `node web-client/scripts/qa-fullflow-weborca.mjs`
- fullflow に必要な env を明示した rerun コマンド
- related grep:
  - `rg -n "\?patientId=|patientId=\$\{|writeScreenshot|appendChild\(|medicalmodv2" web-client/scripts`

## 受入れ条件

- `qa-fullflow` に `patientId` fallback が残らない
- evidence bundle が `30_evidence_bundle_spec.md` に一致する
- live send が通るか、external blocker が hard evidence 付きで切り分けられる
- launcher log だけでなく summary/json/network/xml/screenshots が残る

## 報告フォーマット

```text
【ワーカー報告】
担当: SA-23 runtime/qa

1. summary
2. changed files
3. fullflow handoff / send 実行結果
4. evidence bundle path
5. 実行コマンド
6. tests / scripts pass/fail
7. page errors / console / 502 切り分け結果
8. unresolved items
9. merge conflict note
```
