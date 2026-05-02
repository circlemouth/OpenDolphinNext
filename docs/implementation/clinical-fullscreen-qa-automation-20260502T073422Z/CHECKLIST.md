# Clinical Full-Screen QA Checklist

RUN_ID: `20260502T073422Z`

## Status Legend

| Status | Meaning |
| --- | --- |
| `todo` | 未確認 |
| `pass` | 成功 |
| `repo-defect` | repo 修正が必要 |
| `security-blocker` | セキュリティ修正が必要 |
| `test-data-blocker` | Trial/local seed 等の検証データ不足 |
| `environment-blocker` | 資格情報、外部 Trial、起動環境等の問題 |
| `not-applicable` | feature flag や権限により対象外 |

## Login / Session / Navigation

| ID | Scenario | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| L-01 | `/login` 表示 | 施設、ユーザー、パスワード入力と安全なエラー表示が機能する | Browser DOM `20260502T104853Z` + `LoginScreen.test.tsx` | pass |
| L-02 | 正常ログイン | `/f/:facilityId/reception` へ遷移し session/me が server authority になる | Browser DOM `20260502T104853Z` + AppRouter login tests | pass |
| L-03 | 未認証 access | 業務 route は login に redirect し、元 path は sanitize される | AppRouter login redirect tests | pass |
| L-04 | logout / session expired | browser storage を消し、再利用できない | Browser DOM `20260502T104853Z` + `LoginScreen.test.tsx` | pass |
| L-05 | dirty navigation | 未保存 SOAP / order 編集中に画面遷移を確認する | `AppRouter.navigation.test.tsx` `20260502T113104Z` | pass |

## Reception

| ID | Scenario | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| R-01 | 受付一覧 | 予約、受付済み、会計待ち、再計待ちが該当 tab で表示される | Browser | todo |
| R-02 | 患者検索受付 | 患者検索後、明示選択まで受付設定を出さない | Browser DOM `20260502T104853Z` + `ReceptionPage.test.tsx` | pass |
| R-03 | 必須項目制御 | 診療科、医師、来院区分、保険/自費が揃うまで受付できない | `ReceptionPage.test.tsx` `20260502T111805Z` | pass |
| R-04 | `Medical_Information` 未選択 | request body に field 自体を送らない | `ReceptionPage.test.tsx` `20260502T111805Z` | pass |
| R-05 | `Medical_Information` 選択 | UI 選択時だけ server へ送る | `ReceptionPage.test.tsx` `20260502T111805Z` | pass |
| R-06 | local-only patient | ORCA 受付を fail closed で不可にする | `ReceptionPage.test.tsx` `20260502T111805Z` | pass |
| R-07 | duplicate acceptance | active 受付が filter 外でも重複受付を block する | `ReceptionPage.test.tsx` `20260502T111805Z` | pass |
| R-08 | canonical handoff | accept success 後に canonical handoff で charts を開く | Browser DOM `20260502T104853Z` + focused test | pass |
| R-09 | cancel / accounting | cancel、会計送信、再計待ち projection が表示される | Browser + focused test | todo |

## Charts Core

| ID | Scenario | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| C-01 | context missing | 最小文脈喪失時は fail closed し受付へ戻せる | safe e2e `20260502T111805Z` | pass |
| C-02 | reception to charts | 受付行から volatile encounter context だけで charts を開く | Browser DOM `20260502T104853Z` + safe e2e | pass |
| C-03 | patient summary | 患者情報、受付情報、ORCA summary が過剰情報なしで表示される | Browser | todo |
| C-04 | SOAP S/O/A/P | 保存、再読込、dirty indicator、監査メタが機能する | Browser DOM `20260502T104853Z` + safe e2e | pass |
| C-05 | disease | local disease create/update/delete、ORCA mirror read-only が成立する | Browser DOM `20260502T104853Z` + safe e2e | pass |
| C-06 | patient info edit | official update route と canonical refresh が成立する | `PatientInfoEditDialog.test.tsx` `20260502T113104Z` | pass |
| C-07 | patients tab | 患者管理連携、下書き、保険参照が破綻しない | `PatientsPage.test.tsx` `20260502T113104Z` | pass |

## Prescription RP

| ID | Scenario | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| P-01 | drug search autocomplete | 3文字以上は自動検索、2文字以下は手動検索 | prescription focused tests `20260502T104257Z` | pass |
| P-02 | usage search | 用法候補を選択し effective date が YYYY-MM-DD になる | prescription focused tests `20260502T104257Z` | pass |
| P-03 | multiple RP | `+RP` で複数 RP を作成、切替、保存、再編集できる | `orderDockPanel.state-compat-and-rp-regression.test.tsx` `20260502T111805Z` | pass |
| P-04 | add/remove drug | RP 内で薬剤追加、数量、単位、削除が機能する | prescription focused tests `20260502T104257Z` | pass |
| P-05 | days bulk update | 内服/頓服にだけ反映し、外用には反映しない | prescription focused tests `20260502T104257Z` | pass |
| P-06 | claim comment | RP-level / drug-level コメント、Shift+Enter、削除が機能する | prescription focused tests `20260502T104257Z` | pass |
| P-07 | structured comments | 830/842/831/8501/8511/8521 系を保存前 validation する | prescription focused tests `20260502T104257Z` | pass |
| P-08 | ORCA input set | 入力セットを末尾 RP に追加し既存 RP を保持する | prescription focused tests `20260502T104257Z` | pass |
| P-09 | local persistence | save/reload/edit/delete/copy が local-only で成立する | safe e2e `20260502T111805Z` | pass |

## Order Prediction / Representative Orders

| ID | Scenario | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| O-01 | treatment | 処置候補検索、予測入力、保存、読戻し、更新、削除 | `orderBundleMasterSearch.test.tsx` + safe e2e `20260502T111805Z` | pass |
| O-02 | surgery | 手術候補検索は etensu category 5 を使う | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-03 | test | 検査候補検索は kensa-sort と category 6 を使う | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-04 | physiology | 生理検査候補検索が category 6 を使う | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-05 | bacteria | 細菌検査候補検索と metadata が保持される | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-06 | radiology | 画像診断の body part / material / drug / etensu が機能する | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-07 | injection | 注射専用フォームと drug / etensu category 3 が機能する | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-08 | charge | 基本料、指導料の候補範囲が過剰に広がらない | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-09 | other | その他オーダーは local-only 契約どおり etensu 検索のみ | `orderBundleMasterSearch.test.tsx` `20260502T111805Z` | pass |
| O-10 | recommendation | 頻用オーダーのカテゴリ/横断、検索、反映が機能する | `orderDockPanel.state-compat-and-rp-regression.test.tsx` `20260502T111805Z` | pass |

## Patients / Images / Reports / Administration

| ID | Scenario | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| B-01 | patients search | 受付からの filter 引き継ぎと患者選択が機能する | Browser DOM `20260502T104853Z` + `PatientsPage.test.tsx` | pass |
| B-02 | patient create/update/import | official/local 境界と canonical sync が成立する | `PatientsPage.test.tsx` + `PatientInfoEditDialog.test.tsx` `20260502T113104Z` | pass |
| B-03 | outpatient print | 外来印刷 preview と audit が機能する | `chartsOutpatientPrintPage.test.tsx` `20260502T113104Z` | pass |
| B-04 | document print | 文書印刷 preview と storage boundary が機能する | `chartsDocumentPrintPage.test.tsx` `20260502T113104Z` | pass |
| B-05 | report print | prescription/report preview が required fields を fail closed する | print focused tests `20260502T113104Z` | pass |
| B-06 | mobile images disabled | feature flag off では安全な案内だけを表示する | Browser | todo |
| B-07 | mobile images enabled | upload size/MIME/permission error を安全に処理する | image focused tests `20260502T113104Z` | pass |
| B-08 | administration access | 非 admin は拒否、admin は必要 panel だけ表示 | Browser DOM `20260502T104853Z` + admin focused tests | pass |
| B-09 | ORCA connection admin | 任意 URL 接続を許容せず sanitized result だけ表示 | `AdministrationPage.connection.test.tsx` `20260502T113104Z` | pass |
| B-10 | access management | password reset / role change 後に対象 session を失効させる | `AccessManagementPanel.passwordReset.test.tsx` + linked-only tests `20260502T113104Z` | pass |

## Final Gates

| ID | Command | Expected | Status |
| --- | --- | --- | --- |
| G-01 | `cd web-client && npm run verify:web-guard` | blocked route / secret / auth drift なし | pass |
| G-02 | `cd web-client && npm run ci` | verify, typecheck, test, build 成功 | todo |
| G-03 | `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` | server static-analysis verify 成功 | todo |
| G-04 | `cd web-client && node scripts/runtime-ready-smoke.mjs` | sanitized runtime smoke 成功 | todo |
| G-05 | `git status --short` | 期待する docs/code 差分だけ | todo |
