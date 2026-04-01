# Web Product Evidence Pack

- RUN_ID: `20260330T064252Z`
- basis: current repo code / tests / docs only
- classification vocabulary: `MATCH / DOCS_UNDER_SPEC / DOCS_OVER_ASSERT / TRUE_REGRESSION / UNKNOWN`

## 1. BL-04 guard matrix

- overall classification:
  - `DOCS_UNDER_SPEC`
  - factor2 retry limit row は旧 docs が `DOCS_OVER_ASSERT`
- repo truth matrix:

| route / surface | guard | trigger | landing / behavior | classification | evidence |
| --- | --- | --- | --- | --- | --- |
| non-login route (`/reception`, `/charts`, `/patients`, `/m/images`, `/administration`) | `FacilityGate` | unauthenticated access | `/login` へ `replace`、`state.from` に現在地を保持 | `MATCH` | `web-client/src/AppRouter.tsx`, `web-client/src/__tests__/AppRouter.login-redirect.test.tsx` |
| facility-scoped route | `FacilityShell` | session 不在 | facility-scoped path を `state.from` に積んで `/login` へ `replace` | `MATCH` | `web-client/src/AppRouter.tsx`, `web-client/src/__tests__/AppRouter.login-redirect.test.tsx` |
| `/login` or `/f/:facilityId/login` | `FacilityGate` + `resolveLoginRedirect()` | authenticated access | safe な facility-scoped `from` を優先し、無効時は `/f/:facilityId/reception` へ `replace` | `MATCH` | `web-client/src/AppRouter.tsx`, `web-client/src/features/login/loginRedirect.ts`, `web-client/src/features/login/__tests__/loginRedirect.test.ts` |
| login surface | login notice helper | logout | `/f/:facilityId/login?reason=logout` に戻り、info copy を表示 | `MATCH` | `web-client/src/AppRouter.tsx`, `web-client/src/features/login/loginRedirect.ts`, `web-client/src/__tests__/AppRouter.login-redirect.test.tsx` |
| login surface | session expiry notice | `timeout / unauthorized / forbidden` | `/f/:facilityId/login` に戻り、理由を分けた notice copy を表示 | `MATCH` | `web-client/src/AppRouter.tsx`, `web-client/src/libs/session/sessionExpiry.ts`, `web-client/src/libs/session/sessionExpiry.test.ts`, `web-client/src/features/login/__tests__/loginRedirect.test.ts` |
| `LoginScreen` | same-surface factor2 flow | `cancel` | credentials step に戻る | `MATCH` | `web-client/src/LoginScreen.tsx`, `web-client/src/__tests__/LoginScreen.test.tsx` |
| `LoginScreen` | same-surface factor2 flow | `session missing / session expired` | credentials step に戻る | `MATCH` | `web-client/src/LoginScreen.tsx`, `web-client/src/__tests__/LoginScreen.test.tsx` |
| `LoginScreen` | same-surface factor2 flow | `invalid` | factor2 surface に残る | `MATCH` | `web-client/src/LoginScreen.tsx`, `web-client/src/__tests__/LoginScreen.test.tsx` |
| `LoginScreen` | same-surface factor2 flow | `429 / retry-after` | current step を維持し待機文言を表示 | `DOCS_OVER_ASSERT` | `web-client/src/features/login/loginErrorMessage.ts`, `web-client/src/features/login/__tests__/loginErrorMessage.test.ts` |
| sensitive routes (`/reception`, `/charts`, `/patients`, `/m/images`) | scrub effect | deep-link query arrival | route 到達後に `replace` で scrub し、state / volatile context へ移す | `MATCH` | `web-client/src/AppRouter.tsx`, `web-client/src/__tests__/AppRouter.login-redirect.test.tsx`, `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx` |
| `/administration` | `AdministrationGate` | non-system_admin | login へ飛ばさず denial surface + `Reception` CTA | `MATCH` | `web-client/src/AppRouter.tsx` |

- docs promotion:
  - `web-client/notes/auth-transition.md`
  - `web-client/notes/ui-current-contract.md`
  - `docs/managerdocs/03_web_current_contract_summary.md`
- remaining unknown:
  - `screenKey` 粒度を超える task-specific guard coverage
  - browser history / direct navigate 差分

## 2. BL-11 docs promotion

### 2-1. Patients input source priority
- classification: `MATCH`
- repo truth:
  - `patientId / appointmentId / receptionId / visitDate` は `location.state` top-level -> `location.state.encounter` -> scoped volatile encounter context の順で解決
  - route query の `patientId` は権威 source として読まない
  - `returnTo` は patient context ではなく戻り導線としてのみ使う
- evidence:
  - `web-client/src/features/patients/PatientsPage.tsx`
  - `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`

### 2-2. Mobile Images input source priority
- classification: `MATCH`
- repo truth:
  - `patientId` は query `patientId` -> `location.state.patientId` -> deep link volatile context の順
  - `openMobileImages()` は query / state / deep link volatile context を併用する
  - scrub 後でも deep link volatile context から復元できる test がある
- evidence:
  - `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`
  - `web-client/src/routes/useAppNavigation.ts`
  - `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx`

### 2-3. route 別 minimal encounter context schema
- classification: `MATCH`
- repo truth:
  - shared navigation state は `carryover`, `encounter`, top-level `patientId`, `appointmentId`, `receptionId`, `scheduleKey`, `encounterKey`, `visitDate`, `returnTo`, `from`
  - Charts handoff は `scheduleKey` または `encounterKey` 必須
  - Patients は `patientId`, `appointmentId`, `receptionId`, `visitDate` を読む
  - Mobile Images は `patientId` のみで成立する
- evidence:
  - `web-client/src/routes/useAppNavigation.ts`
  - `web-client/src/features/patients/PatientsPage.tsx`
  - `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`

### 2-4. admin current UI detail inventory
- classification: `MATCH`
- repo truth:
  - top-level tab は `delivery`, `orca-users`, `master-updates`
  - `delivery` 配下は `dashboard`, `connection`, `config`, `queue`, `operations`, `debug`
  - admin SoT は `/api/admin/config`
- evidence:
  - `web-client/src/features/administration/AdministrationPage.tsx`
  - `web-client/src/features/administration/delivery/types.ts`
  - `web-client/src/features/administration/api.ts`
  - `web-client/src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx`

- docs promotion:
  - `web-client/notes/patient-context-contract.md`
  - `web-client/notes/ui-current-contract.md`
  - `docs/managerdocs/03_web_current_contract_summary.md`
- remaining unknown:
  - print / administration を含む app-wide handoff state の全量 schema
  - admin IA の再設計要否

## 3. BL-10 touched-surface a11y minimum

- overall classification:
  - `TRUE_REGRESSION` fixed: `MobileImagesUploadPage` の file picker keyboard reachability
  - その他 touched surface は `MATCH`
- repo truth:
  - `LoginScreen` は step/status を live region で伝え、factor2 遷移時に認証コード入力へ focus を移す
  - `ReturnToBar` は named region + keyboard reachable link
  - `PatientsPage` は status bar / selection notice / API failure banner の live region を持つ
  - `ApiFailureBanner` は retry/share action group と disabled 理由の `aria-describedby` を持つ
  - `MobileImagesUploadPage` は status/alert、missing-patient alert、単一カラム layout を持ち、visible button 経由で picker を開くよう補正した
- evidence:
  - `web-client/src/LoginScreen.tsx`
  - `web-client/src/features/shared/ReturnToBar.tsx`
  - `web-client/src/features/shared/ApiFailureBanner.tsx`
  - `web-client/src/features/patients/PatientsPage.tsx`
  - `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`
  - `web-client/src/__tests__/LoginScreen.test.tsx`
  - `web-client/src/features/shared/__tests__/ReturnToBar.test.tsx`
  - `web-client/src/features/shared/__tests__/ApiFailureBanner.test.tsx`
  - `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx`
- docs promotion:
  - `web-client/notes/feedback-spec.md`
- remaining unknown:
  - app-wide live region / focus / keyboard rule
  - touched surface 以外の narrow layout policy

## 4. BL-08 auto-sync / auto-action inventory

- classification:
  - surface 単位 inventory は `DOCS_UNDER_SPEC`
  - 横断 visibility policy は `UNKNOWN`
- repo truth:
  - Patients:
    - 90 秒 `refetchInterval`
    - stale warning と user-visible `自動更新: 90秒`
    - ORCA import success 後の自動再取得と自動選択
  - Charts:
    - admin config / claim / medical summary は 120 秒 refetch
    - ORCA queue / push events は 30 秒 refetch
    - admin broadcast で config refetch
    - document print は `initialOutputMode` に応じた one-shot auto output がある
  - Mobile Images:
    - patient 解決時の一覧自動取得
    - upload success 後の一覧再取得
    - retry は user-triggered only
- evidence:
  - `web-client/src/features/patients/PatientsPage.tsx`
  - `web-client/src/features/shared/autoRefreshNotice.ts`
  - `web-client/src/features/charts/pages/ChartsPage.tsx`
  - `web-client/src/features/charts/DocumentTimeline.tsx`
  - `web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx`
  - `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`
- next action:
  - visibility policy の新設は今回やらない
  - cross-surface で user override を統一するかは次回 issue へ分離する

## 5. quick win / defer 判定

- code changed in scope:
  - `MobileImagesUploadPage` の file picker を visible button 化して keyboard reachability を回復
  - 同 surface の upload failure copy を canonical に寄せ、raw error detail を通常 runtime から外した
- docs/evidence-first:
  - Patients / Mobile Images / Admin inventory
  - auth guard matrix
  - touched-surface a11y minimum
  - auto behavior inventory
- defer:
  - app-wide a11y rule
  - auto-sync / auto-action visibility policy
  - admin IA 再設計

## 6. BL-04 follow-up / BL-13 prework

- classification:
  - overall `DOCS_UNDER_SPEC`
- repo truth:
  - `NavigationGuardProvider` は `screenKey` 差分がある dirty 遷移だけを block する
  - `/charts` 同一路線で `chartsScreenId` が同一なら外部パラメータ更新は同一画面として許可する
  - `useAppNavigation()` が組み立てる `patients / charts / charts/print / charts/order-sets / m/images / administration / debug` 遷移は `guardedNavigate()` を通す
  - dirty 状態の logout / switch account は auth redirect 前に app-shell の session exit dialog を挟む
  - admin denial / debug denial は `/login` へ戻さず facility-scoped denial surface + `Reception` CTA に留める
- evidence:
  - `web-client/src/routes/NavigationGuardProvider.tsx`
  - `web-client/src/routes/__tests__/NavigationGuardProvider.test.tsx`
  - `web-client/src/routes/useAppNavigation.ts`
  - `web-client/src/routes/appNavigation.ts`
  - `web-client/src/routes/__tests__/useAppNavigation.test.tsx`
  - `web-client/src/AppRouter.tsx`
  - `web-client/src/AppRouter.navigation.test.tsx`
- docs sync:
  - `web-client/notes/auth-transition.md`
  - `web-client/notes/ui-current-contract.md`
  - `web-client/notes/patient-context-contract.md`
- remaining unknown:
  - `screenKey` 粒度を超える task-specific coverage
  - app-wide handoff state の全量 schema

## 7. comparison / latest-follow inventory

- classification:
  - overall `DOCS_UNDER_SPEC`
  - dedicated normal-runtime comparison surface 不在は `MATCH`
- repo truth:
  - `SoapNotePanel` は normal runtime 主面で、latest SOAP / latest bundle を既定値や drawer open の補助に使う
  - `PastHubPanel` は supplemental/historical reference hub であり、主面 comparison 専用 surface ではない
  - `ChartsActionBar` の `最新を再読込` は supplemental recovery action であり comparison ではない
  - `PatientsTab` の `DocumentTimeline へ` は補助導線だが comparison policy の source of truth ではない
  - `DocumentTimeline` / `MedicalOutpatientRecordPanel` は debug-only のまま
- evidence:
  - `web-client/src/features/charts/SoapNotePanel.tsx`
  - `web-client/src/features/charts/PastHubPanel.tsx`
  - `web-client/src/features/charts/ChartsActionBar.tsx`
  - `web-client/src/features/charts/PatientsTab.tsx`
  - `web-client/src/features/charts/pages/ChartsPage.tsx`
  - `web-client/src/features/charts/orderDetailDisplayViewModel.ts`
  - `docs/working-notes/web-product-comparison-latest-follow-inventory.md`
- remaining unknown:
  - comparison/latest-follow の将来 IA
  - auto behavior と結び付く visibility / override policy

## 8. feedback / security follow-up

- classification:
  - app-wide 完了の docs 読みは `DOCS_OVER_ASSERT`
  - Patients / Charts / Reception の current runtime action/result feedback は `TRUE_REGRESSION` fixed
- repo truth:
  - route render error boundary と `ApiFailureBanner` は canonical copy / support-id を優先する
  - `LoginScreen` は unexpected fetch / generic HTTP failure を canonical copy に寄せた
  - Charts fetch failure surface は `resolveUserSafeFetchFailure()`、action failure は `resolveUserSafeOperationFailure()` で通常 runtime の raw detail を抑制した
  - `PatientsPage` は edit block / ORCA status / audit summary の internal flag / endpoint 表示を canonical copy へ寄せた
  - shared tone helper は `PatientsTab` / `OrcaSummary` 等の通常 runtime copy を canonical に寄せた
  - `ReceptionPage` は accept/cancel/claim-send の action/result feedback を canonical copy に寄せた
  - `ChartsPage` order-set notice、`ReceptionPage` search/master notice、admin operator surface には residual raw-detail exposure が残る
- evidence:
  - `web-client/src/AppRouter.tsx`
  - `web-client/src/LoginScreen.tsx`
  - `web-client/src/features/login/loginErrorMessage.ts`
  - `web-client/src/features/charts/userSafeErrorCopy.ts`
  - `web-client/src/features/charts/PastHubPanel.tsx`
  - `web-client/src/features/charts/OrderSummaryPane.tsx`
  - `web-client/src/features/charts/OrderDockPanel.tsx`
  - `web-client/src/features/charts/RightUtilityDrawer.tsx`
  - `web-client/src/features/charts/PatientSummaryPanel.tsx`
  - `web-client/src/features/charts/DocumentCreatePanel.tsx`
  - `web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx`
  - `web-client/src/features/charts/ChartsActionBar.tsx`
  - `web-client/src/features/patients/PatientsPage.tsx`
  - `web-client/src/features/reception/pages/ReceptionPage.tsx`
  - `web-client/src/ux/charts/tones.ts`
  - `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`
  - `web-client/src/features/charts/__tests__/chartsAccessibility.test.tsx`
  - `web-client/src/features/patients/__tests__/PatientsPage.test.tsx`
  - `web-client/src/features/reception/__tests__/ReceptionPage.test.tsx`
  - `docs/working-notes/web-product-feedback-security-inventory.md`
- docs sync:
  - `docs/managerdocs/03_web_current_contract_summary.md`
  - `web-client/notes/feedback-spec.md`
