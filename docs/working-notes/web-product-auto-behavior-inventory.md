# Web Product Auto Behavior Inventory

- RUN_ID: `20260330T060311Z`
- scope: Patients / Charts / Mobile Images
- rule: current behavior の棚卸しのみ。visibility policy は新設しない

## Inventory

| surface | auto behavior | user-visible | user override | classification | evidence |
| --- | --- | --- | --- | --- | --- |
| Patients | 90 秒 `refetchInterval` で一覧再取得 | status bar に `自動更新: 90秒`、stale warning | `再取得` button / query refetch | `DOCS_UNDER_SPEC` | `web-client/src/features/patients/PatientsPage.tsx`, `web-client/src/features/shared/autoRefreshNotice.ts` |
| Patients | ORCA import success 後に一覧再取得し、対象患者が見つかれば自動選択 | success/warning notice | import 自体は user-triggered | `DOCS_UNDER_SPEC` | `web-client/src/features/patients/PatientsPage.tsx` |
| Charts | admin config を 120 秒で再取得 | delivery impact banner / flags 反映 | manual refresh ではなく poll + broadcast | `DOCS_UNDER_SPEC` | `web-client/src/features/charts/pages/ChartsPage.tsx` |
| Charts | claim / medical summary を 120 秒で再取得 | queue / fallback / retry UI に反映 | claim retry button あり | `DOCS_UNDER_SPEC` | `web-client/src/features/charts/pages/ChartsPage.tsx`, `web-client/src/features/charts/DocumentTimeline.tsx` |
| Charts | ORCA queue / push events を 30 秒で再取得 | queue badge / retry UI / push summary | queue retry は system_admin のみ | `DOCS_UNDER_SPEC` | `web-client/src/features/charts/pages/ChartsPage.tsx`, `web-client/src/features/charts/DocumentTimeline.tsx` |
| Charts | document print は `initialOutputMode` がある時に one-shot auto output | print/pdf output 実行 | close / retry button あり | `DOCS_UNDER_SPEC` | `web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx` |
| Mobile Images | patient 解決時に画像一覧を自動取得 | status text / list 表示 | patient 再選択で上書き | `DOCS_UNDER_SPEC` | `web-client/src/features/images/pages/MobileImagesUploadPage.tsx` |
| Mobile Images | upload success 後に一覧を再取得 | success status と更新済み list | retry は user-triggered only | `DOCS_UNDER_SPEC` | `web-client/src/features/images/pages/MobileImagesUploadPage.tsx` |

## Current Classification

- surface 単位の current behavior は code-confirm できるため `DOCS_UNDER_SPEC`
- 「横断で 1 本化された auto-sync / auto-action contract」は current repo だけでは `UNKNOWN`
- user-visible policy を cross-surface で統一する根拠は今回不足している

## Next Issues

- Patients / Charts / Mobile Images を跨ぐ auto behavior の visibility policy を定義するか
- user override を surface ごとに揃えるか、それとも route-specific のまま維持するか
- poll / broadcast / one-shot auto output を manager 向け current contract へどこまで昇格するか
