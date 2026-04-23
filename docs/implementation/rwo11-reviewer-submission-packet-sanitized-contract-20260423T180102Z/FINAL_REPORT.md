# RWO-11 Reviewer Submission Packet Sanitized Contract Hardening

RUN_ID: `20260423T180102Z`

## Scope

- Work Order: `RWO-11`
- Branch / HEAD: `master` / `4ec2bd324883632723a7c91412a627155988ea98`
- Active handoff prompt: `docs/implementation/automation-handoff/NEXT_WORKER_PROMPT.md` (`status: completed`)

## Misuse Cases Considered

1. reviewer packet が raw XML / HAR / request XML / stacktrace を同梱して、credential・患者情報・内部実装を再流出させる。
2. sanitized summary を装った file が raw artifact path を参照し、reviewer が packet から raw evidence を再探索できてしまう。
3. support bundle と canonical reviewer packet の境界が曖昧なまま、raw artifact 前提の旧 closeout を final gate の根拠に使ってしまう。

## What Changed

1. `scripts/reviewer-submission-packet.mjs` を sanitized extracted subset 前提へ変更し、raw XML・stacktrace・HAR・request XML・raw network dump を required file から除外した。
2. packet 生成時の `closeout-packet/` は closeout 全体の複製ではなく、allowlist 済み subset だけをコピーする fail-closed 実装へ変更した。
3. packet validate で report / QA / evidence 内の raw artifact path 参照を検知して fail するようにした。
4. `tests/review-packet/reviewer-submission-packet.test.mjs` を更新し、sanitized summary に request XML が残るケースと、report に raw artifact path が残るケースを回帰テスト化した。
5. `docs/runbooks/reviewer-submission-packet.md`、`docs/runbooks/release-validation.md`、`docs/releases/orca-remediation-cutover.md`、`scripts/tools/README.md` を同じ安全境界へ同期した。

## Verification

| Check | Result |
| --- | --- |
| `node --test tests/review-packet/reviewer-submission-packet.test.mjs` | PASS (`7/7`) |
| `bash server-modernized/tools/ci/check-doc-links.sh` | PASS |
| `git diff --check` | PASS |
| `node scripts/reviewer-submission-packet.mjs --run-id 20260414T010624Z --accepted-ref <historical-closeout-ref> --accepted-head <historical-closeout-head> --dry-run` | EXPECTED FAIL (`qa/acceptmodv2/accept-summary.sanitized.json` missing) |

## Result Classification

- Result: `RWO11_REVIEWER_SUBMISSION_PACKET_SANITIZED_CONTRACT_HARDENED_NO_PACKET`
- Business effect: canonical reviewer packet flow no longer permits raw-artifact-backed extracted subsets.
- Current blocker: historical closeout `artifacts/orca-remediation/closeout/20260414T010624Z/` does not satisfy the new sanitized contract and cannot be used as-is for packet generation.

## Claim Boundary

This run hardened the reviewer submission packet contract only. It did not generate a canonical reviewer submission packet, did not run runtime-ready smoke, did not run fullflow, did not execute live ORCA, did not change production ORCA scope, and did not change S3/object-storage scope.

## Recommended Next Action

Generate a current RUN_ID sanitized closeout subset that includes `accept-summary.sanitized.json` and packet-safe fullflow/diagnostic summaries, then create/validate the canonical reviewer submission packet after accepted ref/head are frozen.

## Safety

- credentials captured: no
- raw artifacts captured: no
