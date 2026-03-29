# Web Product Evidence Pack

- RUN_ID: `20260329T232932Z`
- basis: current repo code / tests / docs only
- classification vocabulary: `MATCH / DOCS_UNDER_SPEC / DOCS_OVER_ASSERT / TRUE_REGRESSION / UNKNOWN`

## 1. auth guard / redirect matrix

- classification: `DOCS_UNDER_SPEC`
- repo truth:
  - `FacilityGate` は未認証かつ非 login route を `/login` へ `replace` し、`state.from` を保持する: `web-client/src/AppRouter.tsx:709-724`
  - login route で認証済みなら `resolveLoginRedirect()` の結果、または `/f/:facilityId/reception` へ `replace` する: `web-client/src/AppRouter.tsx:721-724`, `web-client/src/AppRouter.tsx:1211-1230`
  - `/f/:facilityId/*` で session 不在なら facility-scoped path を `/login` の `state.from` に詰め直す: `web-client/src/AppRouter.tsx:745-753`
  - `resolveLoginRedirect()` は facility-scoped path だけを許可し、`/login` 自身や root-level arbitrary path は fallback へ落とす: `web-client/src/AppRouter.tsx:1213-1230`
  - session expiry は `SESSION_EXPIRED_EVENT` 経由で logout cleanup を実行する: `web-client/src/AppRouter.tsx:651-677`, `web-client/src/libs/session/sessionExpiry.ts:149-179`
  - login redirect の説明 copy は query scrub を案内するが、実際の scrub は login helper ではなく sensitive route 到達後に行う: `web-client/src/features/login/loginRedirect.ts:124-151`, `web-client/src/AppRouter.tsx:588-640`
- evidence:
  - `web-client/src/__tests__/AppRouter.login-redirect.test.tsx:167-319`
  - `web-client/src/libs/session/sessionExpiry.test.ts:51-154`
- next action:
  - Slice 2 で redirect reason taxonomy を helper に寄せ、`/login` surface で理由表示を追加する
  - docs は「最終的に scrub される」説明に留め、redirect 前 scrub を断定しない

## 2. Patients の入力 source 優先度

- classification: `DOCS_UNDER_SPEC`
- repo truth:
  - `patientId` / `appointmentId` / `receptionId` / `visitDate` は `location.state` top-level -> `location.state.encounter` -> volatile stored encounter の順で解決する: `web-client/src/features/patients/PatientsPage.tsx:268-306`
  - Patients 画面は route query から `patientId` を直接読まない
  - `returnTo` は選択元 patient context ではなく戻り導線のためにのみ使う: `web-client/src/features/patients/PatientsPage.tsx:309-349`
- evidence:
  - `web-client/src/features/patients/__tests__/PatientsPage.test.tsx:394-430`
  - `web-client/src/routes/useAppNavigation.ts:325-378`
- next action:
  - Slice 3 では source priority を前提にし過ぎず、Patients 用 CTA は `from` / fallback を中心に構成する

## 3. Mobile Images の入力 source 優先度

- classification: `DOCS_UNDER_SPEC`
- repo truth:
  - `patientId` は query `patientId` -> `location.state.patientId` -> deepLinkContext の順で解決する: `web-client/src/features/images/pages/MobileImagesUploadPage.tsx:54-66`
  - `useAppNavigation.openMobileImages()` は `patientId` を URL query と `location.state` に積み、さらに deep link volatile context に保存する: `web-client/src/routes/useAppNavigation.ts:483-512`
  - scrub 後でも deepLinkContext から復元できる test がある: `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx:55-108`
- evidence:
  - `web-client/src/features/images/pages/MobileImagesUploadPage.tsx:54-71`
  - `web-client/src/features/images/pages/__tests__/MobileImagesUploadPage.deeplink.test.tsx:55-108`
- next action:
  - Slice 3 では Mobile Images 用 copy を「患者導線から再入場」に寄せ、route-specific priority を docs に追記する

## 4. route 別 minimal encounter context schema

- classification: `DOCS_UNDER_SPEC`
- repo truth:
  - navigation 共通 state schema は `carryover`, `encounter`, top-level `patientId`, `appointmentId`, `receptionId`, `scheduleKey`, `encounterKey`, `visitDate`, `returnTo`, `from` を持つ: `web-client/src/routes/useAppNavigation.ts:45-59`
  - Patients が実際に読むのは `patientId`, `appointmentId`, `receptionId`, `visitDate` まで: `web-client/src/features/patients/PatientsPage.tsx:268-306`
  - Mobile Images が読むのは `patientId` だけ: `web-client/src/features/images/pages/MobileImagesUploadPage.tsx:16-18`, `web-client/src/features/images/pages/MobileImagesUploadPage.tsx:54-66`
  - Charts handoff は `scheduleKey` または `encounterKey` 必須: `web-client/src/routes/useAppNavigation.ts:388-423`
- evidence:
  - `web-client/src/routes/useAppNavigation.ts:45-59`
  - `web-client/src/routes/useAppNavigation.ts:169-179`
  - `web-client/src/features/patients/PatientsPage.tsx:268-306`
  - `web-client/src/features/images/pages/MobileImagesUploadPage.tsx:54-66`
- next action:
  - Stage 2 では Patients / Mobile Images の docs を route-specific minimal schema で薄く補足する

## 5. admin current UI detail

- classification: `DOCS_UNDER_SPEC`
- repo truth:
  - admin page は query を正規化し、`delivery` / `orca-users` / `master-updates` の 3 タブを持つ: `web-client/src/features/administration/AdministrationPage.tsx:69-85`, `web-client/src/features/administration/AdministrationPage.tsx:161-185`
  - `delivery` タブ配下は `section` で `dashboard` などの sub-navigation を持つ: `web-client/src/features/administration/AdministrationPage.tsx:156-185`
  - API SoT は `/api/admin/config`: `web-client/src/features/administration/api.ts:77`, `web-client/src/features/administration/api.ts:191-272`
- evidence:
  - `web-client/src/features/administration/__tests__/AdministrationPage.searchParams.test.tsx:240-260`
- next action:
  - 今回の slice では admin IA を変更しない。docs は evidence pack への記録までに留める

## 6. auto-sync / auto-action current behavior

- classification: `UNKNOWN`
- repo truth:
  - Patients には `autoRefreshNotice` による stale warning と `自動更新: 90秒` 表示がある: `web-client/src/features/shared/autoRefreshNotice.ts:5-68`, `web-client/src/features/patients/PatientsPage.tsx:723-731`, `web-client/src/features/patients/PatientsPage.tsx:1943-1953`
  - ただし Charts / Mobile Images / Administration を横断した `auto-sync / auto-action` contract は repo 上で 1 本化されていない
- reason:
  - repo truth は Patients の自動更新表示までで止まり、改善対象として想定される「横断挙動」までは current contract を確定できない
- next action:
  - deferred backlog (BL-08) に残し、Charts まで含む code-confirmation を別 slice に切る

## 7. a11y / focus / keyboard / narrow layout current behavior

- classification: `UNKNOWN`
- repo truth (partial):
  - グローバル focus ring は `global.css` にある: `web-client/src/styles/global.css:48-90`
  - `FocusTrapDialog` は Esc close / tab trap / focus restore を持つ: `web-client/src/components/modals/FocusTrapDialog.tsx:45-169`
  - `NavigationGuardProvider` は `alertdialog` と focus-trapped dialog を使う: `web-client/src/routes/NavigationGuardProvider.tsx:268-311`
  - `LoginScreen`, `PatientsPage`, `MobileImagesUploadPage`, `ToneBanner` などに `role` / `aria-live` はある
- reason:
  - narrow layout の stacking order と app-wide keyboard rule は repo truth が点在しており、最低契約としてまだ固定できない
- next action:
  - Slice 4 は optional とし、今回触る surface の最低限 (`role`, `aria-live`, focus order, keyboard reachable CTA`) だけ実装で揃える

## quick win 判定

- code-ready:
  - auth exception copy matrix
  - factor2 step copy / stage affordance
  - `/login` redirect reason copy
  - scrub explanation microcopy
  - `ReturnToBar` 実装
  - canonical feedback copy への寄せ
- evidence-first / defer:
  - auto-sync / auto-action の横断仕様
  - app-wide narrow layout rule
  - admin IA の再設計
