【ワーカー報告】

runId: `20260419T220346Z`
worktree/cwd: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z`
branch: `codex/orca-readonly-investigation-20260419T220346Z` from `b9c59c882`
commit: `c643190ac` (`Add ORCA readonly investigation artifacts`)

実行コマンド:

```bash
cd /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient.worktrees/orca-readonly-investigation-20260419T220346Z/web-client
RUN_ID=20260419T220346Z QA_BASE_URL=https://localhost:5173 QA_WEBORCA_CANDIDATES=00001,00002,00003,00004,00005,00006,00007,00008,00009,00010,00011 node scripts/qa-weborca-candidate-discovery.mjs
```

- start: `2026-04-19T22:26:15.029Z`
- end: `2026-04-19T22:28:19.104Z`
- exit_code: `1`
- exit code 1 は accepted candidate 0 件時の read-only 停止結果です。

結果:
- accepted count: `0 / 11`
- `candidateDiscoveryAloneAuthorizesPhase3=false`
- `mutationPolicy.prohibited=true`
- blocked request count: `0`
- verdict: `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER`
- blocker: `phase3_mutation_ready_readonly_evidence_missing`
- exact selected-candidate preflight: 未実行 (`acceptedCandidateCount=0`)
- Phase 3 / Phase 4 / fullflow / mutation: 未実行

候補別 failure dimensions:
- `00001`, `00005`: official patientget は accepted (`200/apiResult=00/exact match`)。insurance `403/blank/ambiguous_readiness_failure`、appointment `403/blank/ambiguous_readiness_failure`、local selectable は accepted、selector は rejected（department/physician desired value 不一致）。
- `00002`, `00003`, `00004`, `00006`〜`00011`: official patientget は accepted。insurance/appointment は同じく `403/blank/ambiguous_readiness_failure`、local は `local_exact_match_missing`、selector は not_verified。

主要成果物:
- `readonly-investigation-summary.json` sha256=`3d40e5e5a243a016caac62c04f8c13c97e1f16fefdcb2b182473aac6061daa98`
- `candidate summary.json` sha256=`d3bdaa53a547ae82ddbe9618da89857f4be67158c8cf3b33be9cab39c68a91aa`
- `candidate-rows.json` sha256=`b30a9c2942c11ec196efe586912d6583dac67172a25d14712b2c74d837c312f3`
- `preflight not-run summary.json` sha256=`23e6c1289aa7b38f1423873cd834613d82f25cf42958b633caaf3ec7002fbd24`
- `command-log.md` sha256=`3a9087456431cd7f21aa3c93ea2e2f4ab0fa86e0ed34a466d5feb24846388e41`
- `artifact-sha256.txt`

Secret scan:
- `secret-scan.log`
- `status=pass`, `findings=0`, `rawSensitiveFieldsExcluded=true`

ブロッカーは「公式初期患者の不存在」ではなく、current harness / endpoint / auth / parser / readiness / local sync / selector 条件の mutation-ready read-only evidence 不足です。

Main agent note:
- D の worktree commit は `artifacts/.../network/*.json` を含むため、その commit 全体は統合しない。review package には sanitized summary/report/hash/secret-scan のみを入れる。
