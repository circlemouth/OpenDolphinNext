# GUI Remediation Handoff

- RUN_ID: `20260513T225036Z`
- Scope: GUI 改修工程へ渡す UI / DADS / E2E / visual polish backlog
- Status: backend / contract / ops closeout handoff

この文書は GUI 改修チーム向けの backlog です。release-ready 判定ではありません。ここにある未完項目を current contract の達成済み事実として扱わず、GUI 改修後に `docs/runbooks/release-validation.md` の gate へ接続してください。

## 読む順番

1. [../architecture/ehr-orca-source-of-truth-boundary.md](../architecture/ehr-orca-source-of-truth-boundary.md)
2. [../architecture/ehr-chart-prescription-authority.md](../architecture/ehr-chart-prescription-authority.md)
3. [../architecture/orca-integration-safety-contract.md](../architecture/orca-integration-safety-contract.md)
4. [../operations/orca-unknown-state-runbook.md](../operations/orca-unknown-state-runbook.md)
5. [../web-client/ux/medical-safety-ui-rules.md](../web-client/ux/medical-safety-ui-rules.md)
6. [../web-client/ux/dads_app_ui_design_rules_20260411.md](../web-client/ux/dads_app_ui_design_rules_20260411.md)
7. [../web-client/ux/web-client-ui-guideline.md](../web-client/ux/web-client-ui-guideline.md)
8. [../../web-client/notes/ui-current-contract.md](../../web-client/notes/ui-current-contract.md)
9. [../../web-client/notes/patient-context-contract.md](../../web-client/notes/patient-context-contract.md)
10. [../testing/ehr-orca-required-test-matrix.md](../testing/ehr-orca-required-test-matrix.md)

## Safety Contract

- ORCA / WebORCA 正本: 患者基本情報、受付、保険、公費、保険組合せ、病名、診療行為、算定、会計、収納、領収、レセプト。GUI は表示 cache / snapshot / candidate / ledger summary を見せるだけで、local 正本化しない。
- OpenDolphinNext 正本: 診療録本文、SOAP、所見、医師判断、患者説明、処方指示、訂正・追記・取消履歴、処方 event。GUI は確定済み本文や確定済み処方指示を直接上書きする導線を作らない。
- cache / snapshot / candidate / audit log: UI では正本ではないこと、取得時刻、source、状態を明示する。snapshot は過去時点の説明可能性のために不変として扱う。
- UNKNOWN / warning / unmatch: 成功ではない。初期表示で見える位置へ出し、details / accordion の中だけに置かない。
- 患者文脈: URL、`localStorage`、`sessionStorage` に残さない。`location.state` と揮発メモリだけを使い、reload / new tab / bookmark をまたぐ復元をしない。
- 権限、ORCA送信可否、会計送信可否、監査、idempotency、二重送信防止は server-side enforcement が正本。UI の非表示、confirm、disabled は補助であり認可ではない。
- ORCA URL、Basic認証、証明書、証明書パスワード、raw ORCA body、内部 URL、患者氏名・住所・電話番号・保険記号番号を browser bundle、ログ、screenshot、HAR、trace、validation evidence に出さない。

## やってはいけない UI 実装

- 患者文脈、受付識別子、保険組合せ、voucher / sequential、facilityId、role、ownerId、storage URI、digest、objectKey を client state から authority として送る。
- ORCA 送信成功、診療録確定、処方確定、診察終了、会計済みを同じ表示状態にまとめる。
- `ORCA_UNKNOWN`、`WARNING_NEEDS_REVIEW`、`UNMATCHED`、`CONFLICT`、`PENDING`、`BLOCKED` を `登録済み`、`反映済み`、`会計済み`、`完了` に丸める。
- 重大警告、ORCA不一致、ORCA側のみ情報、再送停止理由を accordion / details / disabled ボタンだけに閉じ込める。
- 重大操作モーダルから患者番号、氏名、生年月日、性別、年齢、受付日、診療科、担当医、保険組合せ、ORCA受付IDの再掲を削る。
- placeholder を入力説明や業務判断の主役にする。
- native `disabled` だけで操作不能理由を表現する。二重実行防止など必要な場合も近傍に理由と有効化条件を出す。
- visual regression や screenshot evidence に実在患者情報、raw ORCA response、credential、内部 URL を残す。
- GUI 改修前または UI E2E / screenshot verification 未完了の状態で release-ready / GO 判定を出す。

## Backlog

| 分類 | GUI 改修へ渡す項目 | 最低受入れ条件 |
| --- | --- | --- |
| 患者ヘッダー | Charts / Reception / Patients / Mobile Images の共通 `PatientIdentityBar` 表示を実画面で確認し、診療録、病名、処方、ORCA送信、会計送信の主要 surface で患者識別情報と ORCA取得状態を初期表示する。 | 患者番号、氏名、生年月日、性別、年齢、受付日、診療科、担当医、保険組合せ、ORCA受付IDまたは未確認状態が同じ visible region にある。 |
| 重大操作モーダル | 診療録確定/訂正/取消、処方確定/変更/中止/取消、ORCA送信/再送、診察終了、会計送信で `CriticalOperationConfirmDialog` を統一し、操作名と患者識別情報を再掲する。 | alertdialog、backdrop click 不可、cancel/confirm の優先度分離、44px以上 touch target、操作ごとの distinct confirm label。 |
| UNKNOWN / warning / unmatch | Charts の `close-and-send-to-billing` 結果、Reception の ORCA送信要確認一覧、病名/処方/会計関連の warning を初期表示へ置く。 | UNKNOWN は成功ではないこと、最終送信日時、対象API、対象患者、対象受付、次アクションを表示し、患者タブを閉じない。 |
| placeholder 依存排除 | 主要医療安全フォームの `placeholder=` 残件を棚卸しし、説明を label / support text / helper copy へ移す。 | `verify:medical-safety-ui-copy` の cap を増やさない。新規 placeholder 依存は不可。 |
| disabled 理由表示 | ORCA送信、診察終了、処方確定、病名操作、order dock、print/export の block reason を近傍に出す。 | `aria-disabled` + 押下時 fail-closed notice を優先し、native disabled は二重実行防止・未ロード等に限定する。 |
| focus / keyboard / contrast / 44px target | 共通 modal、action bar、reception controls、patient picker、print/export controls を keyboard と focus trap で確認する。 | keyboard only で到達可能、focus visible、modal focus trap、文字コントラスト 4.5:1 以上、非文字 3:1 以上、主要 target 44px 以上。 |
| PDF / print visual polish | 診療録 PDF / print / chart print preview で患者識別情報、診療日、診療科、担当医、ORCA受付ID、保険組合せ、snapshot / ledger summary の見読性を確認する。 | ORCA由来 cache と診療録正本を見出しで分離し、credential、raw ORCA body、内部 URL、実在患者情報を evidence に含めない。 |
| visual regression / screenshot verification | GUI改修後に desktop / mobile の主要画面 screenshot を sanitized test data で取得する。 | screenshot / trace / video は reviewer packet に含めず、sanitized summary と差分分類だけを evidence にする。 |
| UI E2E | patient context scrub、重大操作 confirm、UNKNOWN 初期表示、disabled reason、print/export fail-close を E2E または focused Vitest へ接続する。 | URL / storage に患者文脈が残らず、UNKNOWN / warning が成功表示へ戻らないことを自動確認する。 |

## Misuse Cases

1. GUI 改修で患者文脈を URL / `localStorage` / `sessionStorage` に保存し、別患者画面や reload 後に誤った患者 context を復元する。
   - 対策: `patient-context-contract.md` に従い `location.state` と揮発メモリだけを使う。E2E で URL / storage scrub を確認する。
2. UNKNOWN / ORCA失敗 / warning / unmatch を見た目上 `登録済み`、`反映済み`、`会計済み` に戻し、二重送信または確認漏れを起こす。
   - 対策: `medical-safety-ui-rules.md` と `orca-unknown-state-runbook.md` に従い、初期表示 banner と recovery 導線を出す。`verify:medical-safety-ui-copy` と targeted tests で退行を拒否する。
3. disabled や accordion で重大警告を隠し、操作者が理由を理解できず別導線で迂回する。
   - 対策: native disabled は限定し、近傍理由・有効化条件・押下時 fail-closed notice を出す。重要警告は disclosure の外にも summary を置く。
4. visual regression の screenshot / trace / video に実在患者情報や ORCA credential が混入する。
   - 対策: sanitized fixture のみを使い、raw artifact は local-only とし、reviewer packet には summary/hash/count だけを含める。

## GUI 改修後に必ず実行する検証

```bash
cd web-client && npm run verify:web-guard
cd web-client && npm run typecheck
cd web-client && npm run test:ci
cd web-client && npm run build
cd web-client && npm run verify:prod-bundle-secrets
bash server-modernized/tools/ci/check-doc-links.sh
bash server-modernized/tools/ci/check-sensitive-evidence-redaction.sh --root "$(git rev-parse --show-toplevel)"
```

Focused UI / E2E 候補:

```bash
cd web-client && npm test -- --run \
  src/features/charts/__tests__/dadsOrderContract.test.ts \
  src/features/charts/__tests__/dadsClinicalInputContract.test.tsx \
  src/features/charts/__tests__/chartsActionBar.test.tsx \
  src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx \
  src/features/reception/__tests__/ReceptionPage.test.tsx \
  src/features/patients/__tests__/PatientsPage.test.tsx
```

GUI 改修で screenshot / visual regression を追加した場合は、sanitized fixture、artifact-free wrapper、または local-only ignored output を使い、raw screenshot / HAR / trace / video を release evidence にしないこと。

## この closeout で省く検証

- UI E2E / screenshot 全面検証: この工程は backend / contract / ops closeout handoff であり、大規模 UI 実装を行っていないため省く。GUI 改修後の visual / E2E gate として上記へ記録した。
- ブラウザ目視確認: UI 実装差分がないため省く。GUI 改修後に患者ヘッダー、重大操作モーダル、UNKNOWN 初期表示、PDF/print を対象に実施する。
- release-ready / GO 判定: GUI 改修前であり、この文書は backlog のため判定しない。
