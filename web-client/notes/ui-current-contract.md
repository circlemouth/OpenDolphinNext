# UI Current Contract

この文書は、docs-only で確定できる current screen / route / required state / verification を棚卸しします。docs にない route 名や UI 詳細は補完しません。

## Scope
- Auth
- ChartsPage
- DocumentTimeline 周辺

## Auth Surface
### Current Fact
- 認証開始地点は `/login` です。
- 1 段階目ログイン後、必要時のみ factor2(TOTP) に進みます。
- factor2 は 6 桁コード入力を前提とします。
- 認証成功時は session rotate を前提とします。
- logout は cleanup 優先で `/login` へ replace 遷移します。

### Required State
- 認証後遷移では sanitize 済み internal `returnTo` だけを扱います。
- invalid または empty の `returnTo` は default post-login landing に落とします。
- default post-login landing の実 path は `unknown` です。

### Verification
- manual: `/login` 起点の 1 段階目ログインと factor2 要求有無の確認
- unknown: auth guard の screen 単位の挙動

## ChartsPage / DocumentTimeline Surface
### Current Fact
- current docs では `ChartsPage` と `DocumentTimeline` が active surface として扱われています。
- DocumentTimeline 周辺ではカテゴリトグル、詳細ペイン、参照系 surface の同期確認が手動確認ポイントとして記載されています。
- ドキュメントイベント選択時の更新成功/失敗に対するフィードバック契約が存在します。

### Required State
- 患者文脈は `location.state` と揮発メモリのみで扱います。
- deep link query は処理後に scrub します。
- reload 跨ぎの文脈復元は行いません。

### Terminology
- 「参照カルテ」と「参照パネル」は current docs 上で完全同義とは断定しません。
- 本文では umbrella term として「参照系 surface」を使います。

### Verification
- runtime smoke: `runtime-ready-smoke.mjs` が release 前 mandatory
- manual: DocumentTimeline 周辺の同期、取得失敗時の通知、更新成功/失敗時の通知
- unknown: route 名、pane geometry、最小 state schema

## Admin Surface
### Current Fact
- admin current contract の source of truth は `/api/admin/config` です。
- `/api/admin/delivery` を第 2 正本として復活させません。

### Unknown
- admin route の実 path
- admin screen の current UI detail

## Explicit Unknown
- patients surface の current route / screen 契約
- mobile images surface の current route / screen 契約
- pane geometry
- route 別 minimal encounter context schema

## References
- [README.md](../README.md)
- [auth-check.md](./auth-check.md)
- [auth-transition.md](./auth-transition.md)
- [patient-context-contract.md](./patient-context-contract.md)
- [feedback-spec.md](./feedback-spec.md)
- [release-gate.md](./release-gate.md)
- [security-spec.md](./security-spec.md)
- [phase3_handoff_current_state.md](../../docs/development/supporting/phase3_post_decision_prompt_pack/phase3_handoff_current_state.md)
