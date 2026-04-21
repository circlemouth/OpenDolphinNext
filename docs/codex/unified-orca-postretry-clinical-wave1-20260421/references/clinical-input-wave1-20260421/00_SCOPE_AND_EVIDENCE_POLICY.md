# 00. Scope and evidence policy

## Scope

この Wave 1 は、OpenDolphinNext Web client の clinical input coverage hardening を行うための Codex 作業指示です。

対象:

- 病名入力 / disease / diagnosis の local persistence と readback
- SOAP / free text の canonical server reload
- 処方オーダーの local full flow
- generic order bundle の local matrix と static ORCA boundary
- 文書保存の two-phase failure と free document 最低限 coverage

対象外:

- 受付登録 Phase 3 / Phase 4
- fullflow
- live ORCA mutation
- ORCA 公式仕様への最終適合 claim
- Playwright / e2e / runtime success の未実行 claim
- raw HAR / trace / video / screenshot の成果物同梱

## Evidence taxonomy

| evidence type | 扱い |
|---|---|
| source evidence | 実装・テスト・docs の静的存在。runtime success ではない。 |
| targeted command evidence | Codex 実端末で実行した command、exit code、test count、failure count。sanitized summary のみ採用。 |
| package hygiene evidence | zip / secret scan / artifact content check。機能成功 evidence ではない。 |
| dynamic evidence | browser/server/Playwright/CI 実行結果。今回実行しない限り not verified。 |
| live ORCA evidence | live mutation gate 専用。Wave 1 では禁止。 |

## Current package constraints inherited from audit

- original review package mode: `extracted_review_subset`
- dynamic review evidence: not applicable / missing
- `worktree_clean=not_verified` in original package summary
- `full_source_secret_scan_claim=not_claimed`
- package source-scope secret scan pass is hygiene evidence only

## Claim rules

最終報告では、次の表現を守ること。

| OK | NG |
|---|---|
| `local chart/document persistence verified by targeted tests` | `ORCA registration verified` |
| `MSW scenario passed` | `live ORCA passed` |
| `static medicalmodv2 payload snapshot prepared` | `medicalmodv2 official spec compatible` |
| `runtime not verified` | `probably works at runtime` |
| `要 ORCA 公式仕様確認` | 未確認の仕様適合を断定 |

## DADS basis allowed in Wave 1

DADS/UI 評価で使ってよい根拠は次に限定する。

- important information not hidden
- label/support text/error text
- placeholder not used as substitute
- disabled avoided or reason/enabling condition nearby
- one primary action per screen/context
- button order and hierarchy
- date input guidance
- error text concrete and static
- accessibility/focus/contrast if source supports checking
