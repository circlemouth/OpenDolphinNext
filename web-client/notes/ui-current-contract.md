# UI Current Contract

この文書は、docs-only で確定できる current screen / route / required state / verification を棚卸しします。docs にない route 名や UI 詳細は補完しません。

## Scope
- Auth
- 受付
- Charts
- Patients
- Mobile Images
- 管理画面

## Auth Surface
### Current Fact
- 認証開始地点は `/login` です。
- 施設付き login route は `/f/:facilityId/login` です。
- `/login` から facility 付き login route への auto-resolve は `replace` です。
- 1 段階目ログイン後、必要時のみ factor2(TOTP) に進みます。
- factor2 は 6 桁コード入力を前提とします。
- factor2 は `LoginScreen` 同一 surface で切り替えます。
- 認証成功時は session rotate を前提とします。
- logout は cleanup 優先で `/login` へ replace 遷移します。
- facility が分かる logout は `/f/:facilityId/login?reason=logout` へ `replace` し、timeout / unauthorized / forbidden は `/f/:facilityId/login` へ寄せます。
- login notice は `sessionExpiryNotice` -> `loginNotice` -> `initialNotice` の優先順位で表示します。

### Required State
- 認証後遷移では sanitize 済み internal `returnTo` だけを扱います。
- invalid または empty の `returnTo` は default post-login landing に落とします。
- default post-login landing は `/f/:facilityId/reception` です。

### Verification
- manual: `/login` 起点の 1 段階目ログインと factor2 要求有無の確認
- guard minimum:
  - 未認証の非 login route は `/login` へ `replace`
  - 認証済み login route は safe な `from` 優先、無効時は reception fallback
  - `timeout / unauthorized / forbidden / logout` は login surface で理由を分ける
  - factor2 `cancel / session expired / session missing` は route 遷移せず credentials step に戻る
  - factor2 `429` は current step を維持して待機文言に寄せる

## Route Inventory
- `/login`
- `/outpatient-mock` (`LegacyOutpatientMockNotFound`, disabled legacy route)
- `/f/:facilityId/login`
- `/f/:facilityId/reception`
- `/f/:facilityId/patients`
- `/f/:facilityId/charts`
- `/f/:facilityId/charts/order-sets`
- `/f/:facilityId/charts/print/outpatient`
- `/f/:facilityId/charts/print/document`
- `/f/:facilityId/m/images`
- `/f/:facilityId/administration`
- `/f/:facilityId/debug` (`DEBUG_PAGES_ENABLED` 時のみ)
- `/f/:facilityId/debug/outpatient-mock` (`DEBUG_PAGES_ENABLED` 時のみ)
- `/f/:facilityId/debug/mobile-patient-picker` (`DEBUG_PAGES_ENABLED` 時のみ)
- `/f/:facilityId/debug/orca-api` (`DEBUG_PAGES_ENABLED` 時のみ)

## Guard Inventory
- `FacilityGate`
- `FacilityShell`
- `AdministrationGate`
- `NavigationGuardProvider`

### Guard Behavior Minimum
- `FacilityGate` は未認証の非 login route を `/login` へ `replace` し、`state.from` を保持します。
- `FacilityShell` は facility-scoped route で session 不在なら facility-scoped path を `state.from` に積み直して `/login` へ戻します。
- `AdministrationGate` は権限不足を facility-scoped denial surface で処理し、`受付` CTA を表示します。
- `NavigationGuardProvider` は dirty source がある時、`screenKey` が変わる遷移だけを block します。
- `NavigationGuardProvider` は `/charts` 同一路線で `chartsScreenId` が同一なら、外部パラメータ更新を同一画面として許可します。
- dirty 状態で logout / switch account が要求された場合、silent redirect せず app-shell の session exit dialog を挟みます。

## Charts Surface
### Current Fact
- normal runtime の中心 surface は `SoapNotePanel` です。
- `PastHubPanel` は左列の historical reference / Do 補助 surface であり、comparison 専用主面ではありません。
- `latest-follow` は `SoapNotePanel` / `PastHubPanel` / `ChartsActionBar` の局所補助として存在し、独立 route はありません。
- `OrcaSummary` は Charts 内部の補助 panel です。
- `DocumentTimeline` と `MedicalOutpatientRecordPanel` は `showDebugUi` 有効時のみ表示される debug-only surface です。

### Required State
- 患者文脈は `location.state` と揮発メモリのみで扱います。
- workspace patient tab は同一 SPA セッション内だけで保持し、reload/new tab 復元は行いません。
- deep link query は処理後に scrub します。
- reload 跨ぎの文脈復元は行いません。
- active patient の workspace tab switch/close は、未保存入力がある場合に save/discard/cancel guard を通します。
- ORCA 送信ボタンは canonical encounter context (`patientId`, `visitDate`, `departmentCode`, `physicianCode`, `insuranceCombinationNumber`, `voucherNumber`, `sequentialNumber`) が揃わない限り enable しません。
- `visitDate` の `today` fallback や display string parsing は ORCA 送信文脈に使いません。
- `medicalmodv23` の chart flow 後続呼び出しは current contract に含めません。chart send/finish の official outbound は `medicalmodv2` と `incomeinfv2` のみです。

### Terminology
- 「参照カルテ」と「参照パネル」は current docs 上で完全同義とは断定しません。
- 本文では umbrella term として「参照系 surface」を使います。

### Verification
- runtime smoke: `runtime-ready-smoke.mjs` が release 前 mandatory
- runtime smoke は主要 route / guard の確認根拠であり、debug-only surface の常時表示までは断定しません。
- manual: SoapNotePanel 中心の通常導線、Patients / Mobile Images / 管理画面 への遷移確認
- guard minimum:
  - canonical encounter context 不足時は ORCA送信を fail-close
  - ORCA収納情報は official income semantics (`未収`, `請求`, `入金`, `保険適用`, `自費`) を表示
  - ローカル診療サマリと ORCA収納情報の責務を混ぜない
- unknown: pane geometry、最小 state schema

## Patients Surface
### Current Fact
- 初期 patient context は `location.state` top-level -> `location.state.encounter` -> scoped volatile encounter context の順で解決します。
- Patients が読む minimal context は `patientId`, `appointmentId`, `receptionId`, `visitDate` です。
- `returnTo` は safe な候補だけを direct return に使い、fallback は `from=reception` なら reception、それ以外は charts です。
- `patients:returnTo` の sessionStorage seam は current repo に reader / writer を持たず、戻り導線は `useAppNavigation().safeReturnToCandidate` を正とします。
- 通常 UI の監査表示は summary を正とし、raw endpoint dump は default から外します。

### Verification
- code-confirm: `PatientsPage` の初期選択、warning copy、fallback CTA
- manual: reception / charts 由来の再入場と patient 未選択開始

## Mobile Images Surface
### Current Fact
- `patientId` は query `patientId` -> `location.state.patientId` -> deep link volatile context の順で解決します。
- current screen は `ReturnToBar`、患者特定、アップロード、完了/参照の単一カラム構成です。
- fallback は `from=reception` なら reception、`from=patients` なら patients、既定は charts です。
- retry 後は送信ボタンへ、送信成功後は最初の参照リンクへ focus を戻します。

### Verification
- code-confirm: deep link scrub 後の patient 復元、missing-patient error、feature-disabled message
- manual: file picker、upload、retry、return CTA

## Admin Surface
### Current Fact
- admin current contract の source of truth は `/api/admin/config` です。
- `/api/admin/delivery` を第 2 正本として復活させません。
- top-level navigation は `delivery`, `orca-users`, `master-updates` の 3 本で、tab pattern ではなく plain navigation / `aria-current` を使います。
- `delivery` 配下は `dashboard`, `connection`, `config`, `queue`, `operations`, `debug` の section sub-navigation を持ちます。
- sub-navigation は `設定 / 状態確認 / 調査` に regroup します。
- authz の canonical layer は `AdministrationGate` の route-level guard です。
- `connection` は接続テストの実行面、`operations` は状態参照面です。
- `config` の診断用トグルは既定で閉じ、通常運用導線より一段下げて扱います。
- `AdminDeliveryStatusCard` は配信メタデータ card として `deliveryId / version / etag / deliveredAt / verified` を表示します。

## Explicit Unknown
- pane geometry
- print / debug / administration を含む app-wide handoff state detail
- `NavigationGuardProvider` の `screenKey` 粒度を超える task-level coverage

## References
- [README.md](../README.md)
- [auth-check.md](./auth-check.md)
- [auth-transition.md](./auth-transition.md)
- [patient-context-contract.md](./patient-context-contract.md)
- [feedback-spec.md](./feedback-spec.md)
- [release-gate.md](./release-gate.md)
- [security-spec.md](./security-spec.md)
- [docs/managerdocs/03_web_current_contract_summary.md](../../docs/managerdocs/03_web_current_contract_summary.md)
