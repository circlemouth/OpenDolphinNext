# UI Current Contract

この文書は、docs-only で確定できる current screen / route / required state / verification を棚卸しします。docs にない route 名や UI 詳細は補完しません。

## Scope
- Auth
- Reception
- Charts
- Patients
- Mobile Images
- Administration

## Auth Surface
### Current Fact
- 認証開始地点は `/login` です。
- 施設付き login route は `/f/:facilityId/login` です。
- 1 段階目ログイン後、必要時のみ factor2(TOTP) に進みます。
- factor2 は 6 桁コード入力を前提とします。
- factor2 は `LoginScreen` 同一 surface で切り替えます。
- 認証成功時は session rotate を前提とします。
- logout は cleanup 優先で `/login` へ replace 遷移します。

### Required State
- 認証後遷移では sanitize 済み internal `returnTo` だけを扱います。
- invalid または empty の `returnTo` は default post-login landing に落とします。
- default post-login landing は `/f/:facilityId/reception` です。

### Verification
- manual: `/login` 起点の 1 段階目ログインと factor2 要求有無の確認
- unknown: auth guard の screen 単位の挙動

## Route Inventory
- `/login`
- `/f/:facilityId/login`
- `/f/:facilityId/reception`
- `/f/:facilityId/patients`
- `/f/:facilityId/charts`
- `/f/:facilityId/charts/order-sets`
- `/f/:facilityId/charts/print/outpatient`
- `/f/:facilityId/charts/print/document`
- `/f/:facilityId/m/images`
- `/f/:facilityId/administration`

## Guard Inventory
- `FacilityGate`
- `FacilityShell`
- `AdministrationGate`
- `NavigationGuardProvider`

## Charts Surface
### Current Fact
- normal runtime の中心 surface は `SoapNotePanel` です。
- `OrcaSummary` は Charts 内部の補助 panel です。
- `DocumentTimeline` と `MedicalOutpatientRecordPanel` は `showDebugUi` 有効時のみ表示される debug-only surface です。

### Required State
- 患者文脈は `location.state` と揮発メモリのみで扱います。
- deep link query は処理後に scrub します。
- reload 跨ぎの文脈復元は行いません。

### Terminology
- 「参照カルテ」と「参照パネル」は current docs 上で完全同義とは断定しません。
- 本文では umbrella term として「参照系 surface」を使います。

### Verification
- runtime smoke: `runtime-ready-smoke.mjs` が release 前 mandatory
- runtime smoke は主要 route / guard の確認根拠であり、debug-only surface の常時表示までは断定しません。
- manual: SoapNotePanel 中心の通常導線、Patients / Mobile Images / Administration への遷移確認
- unknown: pane geometry、最小 state schema

## Admin Surface
### Current Fact
- admin current contract の source of truth は `/api/admin/config` です。
- `/api/admin/delivery` を第 2 正本として復活させません。

### Unknown
- admin screen の current UI detail

## Explicit Unknown
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
- [docs/managerdocs/03_web_current_contract_summary.md](../../docs/managerdocs/03_web_current_contract_summary.md)
