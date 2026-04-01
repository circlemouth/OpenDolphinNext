# Web Product Feedback / Security Inventory

- RUN_ID: `20260330T064252Z`
- basis: current repo code / tests / docs only
- scope: active user-visible runtime surface の raw backend/internal detail inventory

## Classification Summary

- canonical copy / support-id へ寄せられている surface:
  - `MATCH`
- docs が app-wide 完了と読める箇所:
  - `DOCS_OVER_ASSERT`
- 今回の patch で修正した raw-detail surface:
  - `TRUE_REGRESSION` fixed

## Inventory

| surface | current behavior | classification | evidence |
| --- | --- | --- | --- |
| route render error boundary | `RUN_ID` / `traceId` を見せ、raw exception text は画面に出さない | `MATCH` | `web-client/src/AppRouter.tsx`, `web-client/src/AppRouter.navigation.test.tsx` |
| `ApiFailureBanner` 系 | status/error から canonical copy を生成し raw backend message を直表示しない | `MATCH` | `web-client/src/features/shared/apiError.ts`, `web-client/src/features/shared/__tests__/ApiFailureBanner.test.tsx` |
| `LoginScreen` expected auth failures | `resolveLoginFailure()` 経由で credentials / factor2 / retry-after copy を分岐 | `MATCH` | `web-client/src/features/login/loginErrorMessage.ts`, `web-client/src/__tests__/LoginScreen.test.tsx` |
| `LoginScreen` unexpected fetch / generic HTTP failure | raw `error.message` / `statusText` / body `message` を出せる経路があったため canonical copy に修正 | `TRUE_REGRESSION` fixed | `web-client/src/LoginScreen.tsx`, `web-client/src/features/login/loginErrorMessage.ts`, `web-client/src/__tests__/LoginScreen.test.tsx`, `web-client/src/features/login/__tests__/loginErrorMessage.test.ts` |
| Charts fetch failure surfaces (`PastHubPanel`, `OrderSummaryPane`, `OrderDockPanel`, `RightUtilityDrawer`, `PatientSummaryPanel`, `DocumentCreatePanel`, `ChartsDocumentPrintPage`) | user-safe helper で canonical copy へ寄せ、raw route/stack/detail を通常 runtime から外した | `TRUE_REGRESSION` fixed | `web-client/src/features/charts/userSafeErrorCopy.ts`, `web-client/src/features/charts/PastHubPanel.tsx`, `web-client/src/features/charts/OrderSummaryPane.tsx`, `web-client/src/features/charts/OrderDockPanel.tsx`, `web-client/src/features/charts/RightUtilityDrawer.tsx`, `web-client/src/features/charts/PatientSummaryPanel.tsx`, `web-client/src/features/charts/DocumentCreatePanel.tsx`, `web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx` |
| `PatientsPage` edit / audit summary | internal flags (`missingMaster=true`, `fallbackUsed=true`, `dataSourceTransition=...`, `status=...`, `endpoint=...`) を user-visible copy へ出していたが canonical copy に修正 | `TRUE_REGRESSION` fixed | `web-client/src/features/patients/PatientsPage.tsx`, `web-client/src/features/patients/__tests__/PatientsPage.test.tsx` |
| shared tone helper (`PatientsTab`, `OrcaSummary` など) | missing-master / cache-hit の raw tag 風 copy を shared helper が返していたが canonical copy に修正 | `TRUE_REGRESSION` fixed | `web-client/src/ux/charts/tones.ts`, `web-client/src/features/charts/PatientsTab.tsx`, `web-client/src/features/charts/OrcaSummary.tsx` |
| `ChartsActionBar` action/result feedback | success/warn/error toast と guard summary が internal IDs や raw flag 名を見せていたが、通常 runtime は canonical copy + support-id に修正 | `TRUE_REGRESSION` fixed | `web-client/src/features/charts/ChartsActionBar.tsx`, `web-client/src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx`, `web-client/src/features/charts/__tests__/chartsAccessibility.test.tsx` |
| `ReceptionPage` accept/cancel/claim-send action feedback | result / toast detail に raw `apiResultMessage` や `Invoice_Number` / `Data_Id` を混在させていたが canonical copy に修正 | `TRUE_REGRESSION` fixed | `web-client/src/features/reception/pages/ReceptionPage.tsx`, `web-client/src/features/reception/__tests__/ReceptionPage.test.tsx` |
| `ChartsPage` order-set save/apply notice | raw exception text を notice message に連結する経路が残る | `TRUE_REGRESSION` | `web-client/src/features/charts/pages/ChartsPage.tsx` |
| `ReceptionPage` patient/master search notice | search/master 系 notice detail に raw backend/internal detail を載せる経路が残る | `TRUE_REGRESSION` | `web-client/src/features/reception/pages/ReceptionPage.tsx` |
| administration update / ORCA-user actions | admin runtime でも raw detail toast が残る。debug-only ではないが operator surface として分離して扱う | `TRUE_REGRESSION` | `web-client/src/features/administration/MasterUpdatesPanel.tsx`, `web-client/src/features/administration/OrcaUserManagementPanel.tsx`, `web-client/src/features/administration/AccessManagementPanel.tsx`, `web-client/src/features/administration/AdministrationPage.tsx` |

## Current Reading

- current repo は app-wide 完了ではなく、canonical copy に寄せられた surface と residual raw-detail surface が混在します。
- debug-only / developer-only を通常 runtime と混同していないことは code-confirm できました。
- 今回の最小修正は、Patients / Charts / Reception の active normal runtime surface と shared tone helper に限定しました。

## Next Backlog

- `ChartsPage` order-set notice の canonical copy 化
- `ReceptionPage` patient/master search notice の canonical copy 化
- administration operator surface の raw detail 棚卸しと support-id 化

## References

- [web-product-evidence-pack.md](./web-product-evidence-pack.md)
- [feedback-spec.md](../../web-client/notes/feedback-spec.md)
