# Web Product A11y Minimum Verification

- RUN_ID: `20260330T060311Z`
- scope: `LoginScreen`, redirect reason / login recovery surface, `ReturnToBar`, `PatientsPage`, `MobileImagesUploadPage`, `ApiFailureBanner`
- rule: touched surface only。app-wide rule は fixed にしない

## Results

| surface | current behavior | classification | evidence |
| --- | --- | --- | --- |
| `LoginScreen` | step banner / destination summary は `role=status`、error feedback は `role=alert`、factor2 遷移時に認証コード入力へ focus | `MATCH` | `web-client/src/LoginScreen.tsx`, `web-client/src/__tests__/LoginScreen.test.tsx` |
| redirect reason / login recovery | logout / timeout / unauthorized / forbidden は login surface で理由を分ける。scrub explanation は destination summary で案内 | `MATCH` | `web-client/src/features/login/loginRedirect.ts`, `web-client/src/features/login/__tests__/loginRedirect.test.ts`, `web-client/src/__tests__/AppRouter.login-redirect.test.tsx` |
| `ReturnToBar` | named region 内で primary / fallback CTA を link として提供 | `MATCH` | `web-client/src/features/shared/ReturnToBar.tsx`, `web-client/src/features/shared/__tests__/ReturnToBar.test.tsx` |
| `PatientsPage` | status bar / selection notice / API failure banner の live region があり、narrow layout rule は既存 CSS に従う | `MATCH` | `web-client/src/features/patients/PatientsPage.tsx` |
| `MobileImagesUploadPage` | status/alert と missing-patient alert は既存維持。file picker は hidden input 依存だったため、visible button 経由へ最小修正 | `TRUE_REGRESSION` fixed | `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`, `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx` |
| `ApiFailureBanner` | retry/share action group、ID 未取得時の disabled reason、canonical copy を維持 | `MATCH` | `web-client/src/features/shared/ApiFailureBanner.tsx`, `web-client/src/features/shared/__tests__/ApiFailureBanner.test.tsx` |

## Verification Notes

- `aria-live`:
  - error tone は assertive、info/status は polite を surface ごとに使い分けている
  - app-wide の厳密 rule はまだ固定しない
- focus:
  - `LoginScreen` の factor2 遷移だけ current contract として固定できる
  - その他 surface は focus retention を壊す証拠なし
- keyboard reachability:
  - `ReturnToBar` / `ApiFailureBanner` / `LoginScreen` は既存の button / link で到達可能
  - `MobileImagesUploadPage` は今回 visible button を追加して picker 起動導線を確保した
- narrow layout:
  - `MobileImagesUploadPage` は単一カラム
  - `PatientsPage` は既存 CSS の narrow layout に依存
  - app-wide stacking order は依然 `UNKNOWN`

## Remaining Unknown

- touched surface 以外を含む app-wide keyboard rule
- pane geometry / narrow layout の全体優先順
- `NavigationGuardProvider` を含む task-oriented a11y rule
