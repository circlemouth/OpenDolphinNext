# correction-note / setting-note contract verification runbook

## 目的
report では `e2e-billing-correction-note.spec.ts` が touched された一方で targeted retest 対象外だった。
そのため、この spec の actual path を repo で特定し、単体再実行して setting-note 系 contract に drift がないことを確認する。

## 既知事実
- known filename: `e2e-billing-correction-note.spec.ts`
- actual path は report に書かれていない
- touched されたのに targeted retest されていないため verification gap がある
- worker report では「setting-note 系の契約確認が別途必要」とされている

## 手順
1. repo 検索で actual spec path を特定する
2. report で使われたものと同じ `PLAYWRIGHT_WEB_PORT` / `RUN_ID` conventions を踏襲できるなら踏襲する
3. spec を単体再実行する
4. pass した場合
   - contract verification 完了として記録する
5. fail した場合
   - failure を独立 follow-up blocker として切り出す
   - 既存の Reception / OrcaSummary / Print blocker に無理に混ぜない

## 禁止事項
- spec path を推測で書くこと
- fail を隠すために assertion を弱めること
- fixed premise を崩すことで pass させること

## 記録フォーマット
- actual_spec_path
- run_command_used
- result
- follow_up_needed_or_not
- follow_up_owner_if_needed
