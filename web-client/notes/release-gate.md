# Release Gate

この文書は、repo-local の gate と release 前 mandatory gate を分けて扱うための current contract です。

## Repo-Local Status
- handoff の current state では、repo-local は merge ready とされています。
- これは release-ready を意味しません。
- repo-local の merge ready 判定は、repo 外 manual task が残っていても成立し得ます。

## Release-Ready Boundary
- release-ready は、repo-local だけで完結しない release 前確認を含む概念です。
- repo-local と repo-external の作業を混線させないことを current contract とします。

## Release 前 Mandatory Gate
release 前 mandatory gate の正本は次の 3 本です。

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

補足:
- `runtime-ready-smoke.mjs` は release 前 mandatory です。
- 毎 PR required かどうかは current repo の docs だけでは `unknown` です。

## Repo-Local Gate
repo-local の docs で断定できる内容は次です。

- minimal release gate は repo-visible docs に明記済みです。
- web / server / runtime smoke の主要 gate は local validation で green とされています。
- authoritative static-analysis entrypoint は `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` です。

## Repo-External Manual Task
repo 外 manual task として、handoff で current fact として扱えるものは次です。

### Branch Protection / Required Checks
- GitHub branch protection / required checks の最終設定確認
- restore 済み static-analysis workflow の実際の check 名の確認
- それを required にするかの判断
- `runtime-ready-smoke.mjs` を毎 PR required にするかの判断

### Production Config / Secrets
- 本番用 external config / secrets の投入

## Unknown
- GitHub 側の branch protection / required checks の現在設定
- `runtime-ready-smoke.mjs` が毎 PR required かどうか
- repo 外 manual task の運用完了状況

## References
- [phase3_handoff_current_state.md](../../docs/development/supporting/phase3_post_decision_prompt_pack/phase3_handoff_current_state.md)
- [README.md](../README.md)
