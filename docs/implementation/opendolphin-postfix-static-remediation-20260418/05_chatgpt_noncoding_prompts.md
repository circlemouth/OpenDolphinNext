# 05 ChatGPT non-coding prompts

以下は、コード変更不要の検討を ChatGPT に依頼するためのコピペ用プロンプトです。  
このプロジェクト内の資料と与えたプロンプトだけを参照し、外部サイトは参照しない前提です。

---

## Prompt 1: health/readiness contract policy

```text
あなたは OpenDolphinNext の static contract policy reviewer です。

作業はコード変更なしの検討のみです。patch、commit、修正案の作り込みは禁止です。外部サイトは禁止です。

対象:
- `docs/contracts/health-endpoints.md`
- `server-modernized/src/main/java/open/dolphin/rest/OperationsHealthResource.java`
- `server-modernized/src/test/java/open/dolphin/rest/OperationsHealthResourceTest.java`
- post-fix static review integrator の finding: DOC-02 health/readiness contract drift

検討課題:
Docs は anonymous readiness を `status` のみと説明している一方、source/test は public readiness route で detailed checks を返す前提になっている。この drift について、source を変えるべきか、docs を変えるべきか、または public/admin readiness を分離すべきかをコード変更なしで方針化せよ。

出力形式:
1. policy verdict: docs-update / source-update-needed / split-contract-needed / not enough evidence
2. accepted source truth
3. docs drift summary
4. ORCA trial communication risk
5. recommended invariant, 3行以内
6. Codex に渡す場合の短い実装指示, 5項目以内
7. unresolved unknowns

禁止:
- live ORCA success claim
- 外部仕様の引用
- 一般論だけの結論
```

---

## Prompt 2: route taxonomy communication wording

```text
あなたは OpenDolphinNext の route taxonomy communication reviewer です。

作業はコード変更なしの文言検討のみです。外部サイトは禁止です。

対象:
- `docs/contracts/orca-route-taxonomy.md`
- `web-client/scripts/verify-no-blocked-orca-route-strings.mjs`
- `web-client/scripts/runtime-ready-smoke.mjs`
- `web-client/src/features/outpatient/orcaQueueApi.ts`
- `web-client/src/mocks/handlers/orcaQueue.ts`
- `server-modernized/src/test/java/open/dolphin/rest/PublicRouteInventoryContractTest.java`
- post-fix finding: RT-01 guard/docs drift

検討課題:
ORCA trial communication で、次の3カテゴリを混同しない説明文を作る。
1. server public ORCA route surface
2. client production fail-close sentinel
3. mock/test-only route strings

出力形式:
1. one-paragraph official wording
2. allowed wording / forbidden wording table
3. docs/runbook に入れる注意文
4. guard success message と一致させるべき短文
5. remaining ambiguity

禁止:
- route が live で成功したという claim
- guard を実行したという claim
- 外部仕様参照
```

---

## Prompt 3: carried-forward docs cleanup policy

```text
あなたは OpenDolphinNext の carried-forward docs cleanup reviewer です。

作業はコード変更なしの文言方針検討のみです。外部サイトは禁止です。

対象:
- `docs/implementation/opendolphin-webclient-remaining-followup-package-20260417/20_CHARTS_CORRECTION_NOTE_PROMPT.md`
- `docs/implementation/opendolphin-webclient-followup-release-gate-package-20260417/00_MANAGER_PROMPT.md`
- `docs/implementation/opendolphin-webclient-followup-release-gate-package-20260417/50_RELEASE_GATE_CHECKLIST.md`
- `docs/implementation/opendolphin-webclient-remaining-followup-package-20260417/50_RELEASE_GATE_CHECKLIST.md`
- post-fix finding: older follow-up docs cleanup partial

検討課題:
旧 worker report / prior PASS / already closed 表現を current repo truth と誤読させないための文言ポリシーを作る。

出力形式:
1. cleanup verdict
2. forbidden phrases
3. allowed replacement phrases
4. per-file cleanup note
5. static exit report に載せる caveat

禁止:
- current source/test で未確認の PASS claim
- live ORCA success claim
- patch 作成
```

---

## Prompt 4: DADS-only C6 interpretation

```text
あなたは OpenDolphinNext の DADS-only UI reviewer です。

作業はコード変更なしの検討のみです。参照基準は `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` のみです。外部サイトは禁止です。

対象:
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `web-client/src/features/charts/OrcaSummary.tsx`
- `web-client/src/features/charts/__tests__/OrcaSummary.semantics.test.tsx`
- `tests/charts/e2e-orca-billing-status.spec.ts`
- post-fix finding: C6 income-label visibility lock

検討課題:
ORCA収納情報の見出し、labels、説明、対象日、保険、preview、未収情報を DADS の「重要な情報は隠さない」「ディスクロージャーは補足用途」「1画面1 primary」原則に照らして、どこまで visibility lock が必要か定義せよ。

出力形式:
1. DADS verdict: accepted / partial / rejected / not verified
2. important information list
3. supplemental information list
4. must be visible assertions
5. details-out assertions
6. 1 primary / CTA owner risk
7. Codex に渡す test invariant, 5項目以内

禁止:
- DADS 文書外のデザイン一般論
- source を読まずに accepted と書くこと
- patch 作成
```

---

## Prompt 5: worker report and test evidence policy

```text
あなたは OpenDolphinNext の worker report evidence policy reviewer です。

作業はコード変更なしです。外部サイトは禁止です。

対象:
- post-fix static review integrator verdict
- review package manifest
- prior worker report claim list:
  - RUN_ID 20260418T075457Z
  - tests_run claim
  - pass_area_guard_status
  - residual_unknowns
  - static_exit_status
  - dynamic_handoff_readiness

検討課題:
今後の worker report で、source evidence / unit test / integration test / e2e / docs-only / rerun result / not verified を混同しない report format を作る。

出力形式:
1. accepted evidence definition
2. not verified definition
3. test run table template
4. claim verification matrix template
5. forbidden wording
6. final verdict wording examples
7. dynamic handoff wording examples

禁止:
- 実行していない test を passed と書くこと
- live ORCA success を混ぜること
- worker report を truth として扱うこと
```

---

## Prompt 6: dynamic trial handoff checklist after static closure

```text
あなたは OpenDolphinNext の dynamic trial handoff planner です。

作業はコード変更なしの計画のみです。外部サイトは禁止です。この prompt では dynamic/live 実行はしません。

前提:
static blockers C7/C5/C3/C2/RT-01 が Codex 作業で閉じた後に、dynamic ORCA trial を開始できるかを判定するための handoff checklist を作る。

検討課題:
static exit と dynamic trial success を混同しない handoff checklist を作る。

出力形式:
1. pre-dynamic static prerequisites
2. dynamic trial evidence to collect
3. payload evidence table
4. route/network evidence table
5. ORCA import/readback evidence table
6. chart/invoice row-local evidence table
7. what must remain `not verified` until live run
8. final handoff wording

禁止:
- live ORCA success claim
- URL/API 外部仕様調査
- code patch
```

---

## Prompt 7: pass area regression guard wording

```text
あなたは OpenDolphinNext の pass-area regression guard reviewer です。

作業はコード変更なしです。外部サイトは禁止です。

対象 areas:
- reception official flow
- administration / manageusers / connection wording
- C1/C2 core fail-close / sanitize
- C4 current OrcaSummary direction
- send success != paid
- route taxonomy public surface

検討課題:
post-fix static review で preserved / regressed / not fully verified となった area を、次回 worker report で誤解なく表現する wording を作る。

出力形式:
1. area-by-area verdict wording
2. accepted wording examples
3. partial wording examples
4. forbidden overclaims
5. source/test evidence labels to require
6. final one-paragraph summary

禁止:
- code patch
- external browsing
- live success claim
```
