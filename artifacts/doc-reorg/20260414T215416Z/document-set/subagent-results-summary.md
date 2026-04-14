# Subagent Results Summary

## Merge Rule Applied
- canonical / inventory は Subagent A を優先
- lifecycle は Subagent B を優先
- boundary / deferred structural findings は Subagent C を優先
- final link integrity と UI reference consistency は Subagent D を優先

## Integrated Decisions
- `docs/README.md` を primary doc entry に固定
- ORCA packet / prompt / closeout / recovery / review docs を current entry から排除
- `docs/implementation/` は workstream index のみ保持
- `src/discovery/` を `docs/reference/repository-history/` へ移動
- DADS を唯一の enduring UI reference とし、UI guideline と current contract を別層に整理
- `artifacts/` を evidence / generated と明記
