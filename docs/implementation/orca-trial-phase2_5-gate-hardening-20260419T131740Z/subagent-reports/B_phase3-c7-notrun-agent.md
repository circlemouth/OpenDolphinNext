# B phase3-c7-notrun-agent report

- RUN_ID: `20260419T131740Z`
- Branch: `codex/phase3-c7-notrun-20260419T131740Z`
- Worktree: `../OpenDolphin_WebClient-phase3-c7-notrun-20260419T131740Z`
- Scope: `web-client/scripts/qa-acceptmodv2-weborca.mjs`, `web-client/scripts/qa-lib/medical-information-gate.mjs`, `web-client/scripts/qa-lib/acceptmodv2-business-evidence.mjs`, `web-client/scripts/qa-lib/acceptmodv2-identity-gate.mjs`, and the three targeted test files.

## 実施内容

- `acceptmodv2` sanitized summary を fail-closed にし、C7 が未実行または evidence 不足のときは `not_verified` として扱うようにした。
- Phase 3 not-run summary に `phase3.ran=false`, `phase3.mutationSuccess=false`, `notRunBusinessEvidenceAbsent=true` を明示し、not-run が成功として読めない形にした。
- `targetMutationRequestCount=0` または `checkedRequests=0` の C7 summary を accepted にしないようにした。
- C7 accepted の条件を `targetMutationRequestCount>0`, `checkedRequests>0`, `violationCount=0`, preflight artifact path/hash present に固定した。
- `Request_Number=00` の診断応答は registration evidence があっても mutation success にしないようにした。
- `K1/K2/K3` は registration evidence がある場合だけ `businessAcceptedWithWarnings` として扱うよう、summary builder と runtime parser を hardening した。
- `medicalInformation` / `Medical_Information` は empty string, null, key-only JSON fragment でも key presence を violation として扱うテストを追加した。
- exact preflight gate のテストを追加し、runId/candidateId/input mismatch、discovery-only、`acceptedForPhase3Attempt` が boolean `true` 以外、selected/omitted medicalInformation mismatch を mutation 前に拒否することを固定した。
- not-run / preflight rejection wording は `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER` とし、公式初期患者 `00001`〜`00011` の不存在とは結論しない文面にした。

## 脅威と対策

- Misuse case 1: discovery summary を exact preflight と偽って Phase 3 mutation に進める。
  - 対策: `source=qa-weborca-readonly-preflight` と `flowMode=exact-readonly-preflight` を必須化済みの gate に、discovery-only claiming accepted の回帰テストを追加。
- Misuse case 2: C7 request count が 0 の not-run summary を success と誤読する。
  - 対策: C7 accepted 条件に request count / checked count / violation count / artifact evidence を入れ、not-run explicit evidence を summary に追加。
- Misuse case 3: `Request_Number=00` 診断や `K1/K2/K3` warning code だけを mutation success と扱う。
  - 対策: diagnostic request number を `notVerified` にし、warning success は registration evidence 必須にした。
- Misuse case 4: `medicalInformation` を未選択なのに empty/null/key-only で payload に混入させる。
  - 対策: key presence を violation として扱う gate とテストを追加。

## 検証結果

- `cd web-client && npx vitest run scripts/__tests__/medicalInformationGate.test.ts scripts/__tests__/acceptmodv2BusinessEvidence.test.ts scripts/__tests__/acceptmodv2IdentityGate.test.ts`
  - Pass: 3 files, 41 tests.
- `cd web-client && node --check scripts/qa-acceptmodv2-weborca.mjs scripts/qa-lib/medical-information-gate.mjs scripts/qa-lib/acceptmodv2-business-evidence.mjs scripts/qa-lib/acceptmodv2-identity-gate.mjs`
  - Pass.
- 追加確認: 対象 4 scripts を個別 `node --check`。
  - Pass.

## 実行していないこと

- Phase 3, Phase 4, fullflow, live mutation, mutation scripts は実行していない。
- Python は実行していない。
- `client/` と `server/` は編集していない。

## 補足

- 専用 worktree に `node_modules` が無かったため、検証前に `web-client` で `npm ci` を実行した。lockfile は変更していない。
- `npm ci` は既存依存に対する audit warning を出したが、本タスクで依存追加・更新は行っていない。
- WebORCA Trial 公式初期患者 `00001`〜`00011` は登録済みデータとして存在する前提。accepted evidence が揃わない場合も、原因は harness / API endpoint / auth / ID normalization / response parser / insurance readiness / appointment dependency / exact preflight criteria のいずれかにある read-only evidence 不足として扱う。

## 残課題

- なし。本担当範囲では gate hardening と対象テスト検証を完了。
