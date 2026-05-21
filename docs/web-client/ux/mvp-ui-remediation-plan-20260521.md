# OpenDolphinNext WEBクライアント MVP UI改修計画とCodex実装プロンプト

作成日: 2026-05-21
対象: `OpenDolphinNext/web-client`
目的: WEBクライアントをMVPとして安全に動かすため、最低限必要なUI改修を分担実装できる計画と、Codexメインエージェントおよびサブエージェント向けプロンプトを定義する。

## 1. 前提

- 現行実装の主対象は `web-client/`。`client/` と `server/` は legacy reference とし、通常の変更対象にしない。
- UI/UXの基準は `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` および添付 `dads_app_ui_design_rules_20260411.md` とする。
- `web-client/notes/ui-current-contract.md` の safety contract を下回らない。
- 過去DB互換性は考慮しない。ただし今回の作業はUI改修を主対象とし、DB schema / persistence migration は扱わない。
- ビルド成果物や生成物がzip等に含まれていても無視し、ソースコードとcurrent docsだけを変更対象にする。
- Production運用を見据え、mock-only UI、raw ORCA body、trace/request id、RUN_ID、患者個人情報の不要露出を通常画面へ追加しない。

## 2. MVP UIの到達定義

MVP UIとしての合格条件は、「全画面を完全にDADS準拠へ作り直すこと」ではなく、以下の最低限を満たすこととする。

1. 認証後、受付・患者管理・Charts・モバイル画像・管理画面の主要導線が視覚的に破綻せず、キーボード操作でも最低限辿れる。
2. 重大操作、ORCA送信、受付登録、受付取消、診察終了、診療録保存、オーダー保存は、対象患者・診療日・操作名が再掲され、押せない/進めない理由が画面内に表示される。
3. `disabled` だけで利用者を止めず、MVP対象の主要CTAでは、押下時または直近説明で理由を示す。
4. placeholder依存の入力説明を、MVP対象フォームではlabel/support/error textへ移す。
5. 常時表示のフォームエラーに `aria-live` や `role="alert"` を乱用しない。非同期完了/失敗通知に限定する。
6. Dialog / alertdialog は backdrop click で閉じないことを既定にする。閉じる操作はdialog内に置く。
7. 未定義CSS custom propertyを解消し、角丸・選択状態・エレベーション・余白の最低限のトークンを統一する。
8. Debug/diagnostic UIは通常利用者に見せず、system_admin または明示debug条件に限定する。
9. `npm run verify:web-guard`、`npm run typecheck`、MVP対象のfocused tests、最終的な `npm run build` を通す。

## 3. MVPで扱う画面

| 画面 | MVPで保証する内容 | 非対象 |
|---|---|---|
| Login/Auth | `/login` と施設付きログインの入力説明、factor2、エラー表示、post-login fallback | 認証方式そのものの変更 |
| App shell | 受付/患者管理/Charts/画像/管理画面への移動、モバイル時の破綻回避 | グローバルメニューの大規模刷新 |
| Reception | 既存患者受付、患者検索、受付一覧、canonical handoff、受付取消、エラー導線 | 新患登録、debug consoleの通常表示 |
| Charts | 患者識別、SOAP保存、オーダー編集、ORCA送信、診察終了、重大操作確認 | 全オーダー分類の完全UI刷新 |
| Patients | 患者検索/詳細/編集の主要フォームと保存理由表示 | 患者マスタ運用全体の再設計 |
| Mobile Images | 患者選択、ファイル選択、選択ファイル要約、アップロード失敗表示 | カメラUXの高度化 |
| Administration | ORCA接続/設定/権限の状態表示と保存CTA整理 | 管理画面全体の情報設計刷新 |

## 4. 工程表

### Phase 0: 事前棚卸しと作業境界固定

- `web-client/README.md`
- `web-client/notes/ui-current-contract.md`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `web-client/package.json`
- `src/styles/global.css`
- `src/AppRouter.tsx`
- `src/components/modals/*`
- `src/features/shared/*`
- `src/features/reception/pages/ReceptionPage.tsx`
- `src/features/charts/pages/ChartsPage.tsx`
- `src/features/charts/OrderBundleEditPanel.tsx`
- `src/features/patients/PatientsPage.tsx`
- `src/features/images/pages/MobileImagesUploadPage.tsx`
- `src/features/administration/*`

を確認し、変更しない範囲を明示する。

### Phase 1: UI基盤の最小整備

- `src/styles/global.css` に不足トークンを追加する。
  - `--ui-radius-sm/md/lg`
  - `--ui-selected-bg/border/rail`
  - `--ui-shadow-overlay`
  - `--ui-surface-elevated`
  - 必要なら `--ui-action-primary-*`, `--ui-danger-*`, `--ui-warning-*` など既存変数の上にsemantic aliasを置く。
- 共通CSSまたは共通コンポーネントとして以下を最小導入する。
  - `Button` または `.odn-button`
  - `ActionBar` または `.odn-action-bar`
  - `Field` または `.odn-field`
  - `InlineError` または `.odn-inline-error`
  - `PageBanner/SectionBanner` または `.odn-banner`
- `FocusTrapDialog` の `closeOnBackdrop` 既定値を `false` にする。既存挙動としてbackdrop closeが必要な箇所だけ明示的に `closeOnBackdrop={true}` を指定する。
- `CriticalOperationConfirmDialog` は `closeOnBackdrop={false}` を維持し、患者識別・操作名・distinct confirm labelを壊さない。
- Foundation 実装メモ:
  - `global.css` に `--ui-radius-sm=8px`, `--ui-radius-md=12px`, `--ui-radius-lg=16px`, `--ui-selected-bg`, `--ui-selected-border`, `--ui-selected-rail`, `--ui-shadow-overlay`, `--ui-surface-elevated` を追加し、Patients / Reception / Charts / app shell の未定義参照を解消する。
  - 後続が使う最小共通 class は `.odn-button`, `.odn-button--primary`, `.odn-button--secondary`, `.odn-button--ghost`, `.odn-button--danger`, `.odn-action-bar`, `.odn-action-bar--start`, `.odn-action-bar--between`, `.odn-field`, `.odn-field__label`, `.odn-field__control`, `.odn-field__support`, `.odn-inline-error`, `.odn-banner`, `.odn-banner--info`, `.odn-banner--warning`, `.odn-banner--danger` とする。
  - `FocusTrapDialog` は backdrop close 既定を禁止し、明示 caller だけ opt-in する。Foundation 時点の opt-in caller は `features/administration/components/ConfirmDialog.tsx` の pending 連動 confirm だけとする。
  - `CriticalOperationConfirmDialog` の action row は `odn-action-bar` と `odn-button` contract を併用し、重大操作 confirm の 44px target と primary/danger 階層を維持する。

### Phase 2: Reception MVP UI

- 受付日・検索・表示条件・ステータスタブ・表/カード切替を、既存contractに沿ってcompact control stripへ整理する。
- 患者検索/既存患者受付モーダルで、`PatientIdentityBar` を受付登録フォームより上に表示する。
- 受付登録CTAは、患者検索結果カード内または明確な患者文脈内に置き、患者未選択・診療科/担当医/保険未確定などの理由を近傍に出す。
- 受付取消は `CriticalOperationConfirmDialog` へ寄せる。RUN_ID、trace id、raw ORCA body、内部IDの通常露出をしない。
- Debug diagnostic panelsは通常UIから隠し、`VITE_ENABLE_DEBUG_UI=1` かつ system_admin/development debug route の条件に限定する。

### Phase 3: Charts MVP UI

- Charts画面上部と重大操作前で `PatientIdentityBar` または同等の患者識別を維持する。
- `ChartsActionBar` の ORCA送信/診察終了/保存/印刷系のCTAは、primary/secondary/dangerの意味を統一する。
- ORCA送信・診察終了・order bundle submitは、missing master / encounter不足 / read-only / fallback data でも、native disabledだけで止めず、押下時に理由を表示し、mutationへ進まない。
- `OrderBundleEditPanel` はMVPでは全面分割しない。footer submit、search/add、danger操作の理由表示とActionBar整理を優先する。
- `SoapNotePanel`、`PatientSummaryPanel`、revision/cancel系は既存の重大操作確認とblock reason表示を維持・補強する。

### Phase 4: Login / Patients / Mobile Images / Administration MVP UI

- Loginはplaceholder依存をlabel/support textへ移す。factor2 6桁説明とエラー文を静的に見える形へ整理する。
- Patientsは主要保存CTA・検索・ORCA参照のdisabled理由を近傍表示する。fieldset全体の無効化だけで止めない。
- Mobile Imagesはinline styleをCSSへ移す。患者未選択、ファイル未選択、アップロード中、失敗、選択ファイル要約を表示する。
- AdministrationはAdmin系コンポーネントを既存のUIトークンに寄せ、保存・接続確認・危険操作のbutton階層を揃える。

### Phase 5: UI MVPガードと検証

- 可能なら `scripts/verify-ui-mvp-contract.mjs` を追加し、最低限以下を検出する。
  - 未定義CSS custom property
  - `FocusTrapDialog` の `closeOnBackdrop=true` 既定化の再混入
  - MVP対象主要ファイルでのplaceholder説明の新規過剰追加
  - 通常UIでのraw ORCA body / request id / trace id表示の再混入
- focused testsを追加/更新する。
  - `FocusTrapDialog` backdrop default
  - Reception compact header / debug-only / patient identity
  - Charts ORCA送信・診察終了・order submitのblock reason
  - Mobile Images file summary / blocked reason
  - Login placeholder依存排除
- 最終検証。
  - `npm run verify:web-guard`
  - `npm run typecheck`
  - `npm run test:ci` または対象focused vitest
  - `npm run build`
  - 必要に応じて `npm run test:e2e:no-artifacts`

## 5. マージ順

1. `ui-mvp-foundation`
2. `ui-mvp-reception`
3. `ui-mvp-charts`
4. `ui-mvp-edge-surfaces`
5. `ui-mvp-validation-docs`

Foundationを先にmainへ取り込み、その上でReception/Charts/Edgeを個別worktreeで進める。Validation/Docsは最後に統合し、最終的なevidence zipを作る。

## 6. 最終成果物

- 変更済みソースコード
- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`
- `deliverables/codex-ui-mvp-20260521/README.md`
- `deliverables/codex-ui-mvp-20260521/subagent-prompts/*.md`
- `deliverables/codex-ui-mvp-20260521/validation-report.md`
- `deliverables/codex-ui-mvp-20260521.zip`

---

# Codexメインエージェント向けプロンプト

以下をCodexメインエージェントに渡す。

```text
あなたは OpenDolphinNext のWEBクライアントMVP UI改修を統括するメインエージェントです。モデルは gpt 5.4 high を使用してください。

# 目的
OpenDolphinNext リポジトリの `web-client/` を、MVPとして安全に動かせるUI状態へ改修してください。全画面の完全リデザインではなく、認証・受付・Charts・患者管理・モバイル画像・管理画面の主要導線で、患者取り違え防止、重大操作確認、押せない/進めない理由表示、DADSベースの最低限の一貫性を満たすことを目的にしてください。

# 重要前提
- 現行変更対象は原則 `web-client/` です。`client/` と `server/` は legacy reference なので通常は変更しないでください。
- 必要なcurrent docsは `web-client/notes/` と `docs/web-client/` を参照してください。
- UI/UX基準は `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` です。添付資料がある場合は `dads_app_ui_design_rules_20260411.md` も同等の基準として扱ってください。
- `web-client/notes/ui-current-contract.md` のsafety contractを下回らないでください。
- 後方互換性は考慮不要です。過去DB遺産はない前提でよいですが、今回の主対象はUIでありDB schema/migrationには踏み込まないでください。
- zipやリポジトリにビルド成果物があっても無視し、コードとcurrent docsだけを確認してください。
- Production運用を見据えて、raw ORCA body、trace id、request id、RUN_ID、内部route名、feature flag名を通常利用者向けUIへ追加しないでください。必要ならdebug/admin/support disclosureへ隔離してください。
- 患者文脈をURLやbrowser storageに戻す実装を追加しないでください。
- ORCA送信失敗・警告・不一致・UNKNOWNを成功扱いする文言を追加しないでください。
- 通常画面でdebug-only surfaceを見せないでください。

# ORCA参照・接続テスト条件
ORCA API等の仕様が必要な場合は、以下を起点に確認してください。
- https://www.orca.med.or.jp/receipt/users/tec/api/overview.html
WebORCA Trial接続が必要な場合は、既存QAスクリプトと安全なread-only/preflightを優先し、以下を使ってください。
- URL: `https://weborca-trial.orca.med.or.jp/`
- credential: `ORCA_API_USER` / `ORCA_API_PASSWORD` またはローカル secret store から実行時に供給する。raw Basic 値は repo、成果物、summary、test fixture へ保存しない。
詳細が必要な場合: https://www.orca.med.or.jp/receipt/considering/trialsite/index.html
副作用のあるmutation系ライブテストは、既存runbook/QA scriptが安全性を保証している範囲に限定してください。

# 作業方式
この作業は複数サブエージェントで行います。各サブエージェントは必ず個別のgit worktreeで作業させ、全て gpt 5.4 high で起動してください。メインエージェントは、サブエージェントへの橋渡し、マージ順番の統括、コンフリクト解消、最終検証、報告、成果物zip作成を担当してください。

# 最初に作るドキュメントセット
作業開始直後に以下を作成または更新してください。
- `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md`
- `deliverables/codex-ui-mvp-20260521/README.md`
- `deliverables/codex-ui-mvp-20260521/subagent-prompts/01-foundation.md`
- `deliverables/codex-ui-mvp-20260521/subagent-prompts/02-reception.md`
- `deliverables/codex-ui-mvp-20260521/subagent-prompts/03-charts.md`
- `deliverables/codex-ui-mvp-20260521/subagent-prompts/04-edge-surfaces.md`
- `deliverables/codex-ui-mvp-20260521/subagent-prompts/05-validation-docs.md`

このプロンプト内のサブエージェント向けプロンプトを、上記ファイルへ保存してください。

# MVP UI改修スコープ
## Foundation
- `src/styles/global.css` などで未定義CSS custom propertyを解消する。
  - `--ui-radius-sm`, `--ui-radius-md`, `--ui-radius-lg`
  - `--ui-selected-bg`, `--ui-selected-border`, `--ui-selected-rail`
  - `--ui-shadow-overlay`
  - `--ui-surface-elevated`
  - 必要に応じて既存semantic color/spacing/elevation tokenにaliasを足す。
- 最小共通UI基盤を導入または既存部品へ寄せる。
  - Button / ActionBar / Field / InlineError / PageBanner / SectionBanner相当
- `FocusTrapDialog` は `closeOnBackdrop` の既定値を `false` にする。
  - backdrop clickで閉じる必要がある既存callerだけ明示的に `closeOnBackdrop={true}` を渡す。
  - 重大操作confirmではbackdrop closeを許可しない。
- Foundation 実装では `features/administration/components/ConfirmDialog.tsx` を backdrop close opt-in caller として維持し、それ以外は dialog 内 close control または Escape を正規 close 導線にする。
- DADS方針に沿い、primary/secondary/tertiary/dangerの意味と配置を最低限統一する。

## Reception
- `src/features/reception/pages/ReceptionPage.tsx` と `src/features/reception/styles.ts` を対象に、MVP主要導線を整理する。
- 受付日、患者検索、表示条件、ステータスタブ、表/カード切替、再取得をcompact control stripとして破綻なく表示する。
- 患者検索/既存患者受付では `PatientIdentityBar` をフォームより先に表示する。
- 受付登録CTAは患者文脈が明確な場所に置き、患者未選択/必須項目不足/ORCA受付対象未確認等の理由を近傍または押下時に表示する。
- 受付取消は `CriticalOperationConfirmDialog` へ寄せる。通常UIにRUN_ID、trace id、raw ORCA body、内部IDを出さない。
- Debug diagnostic panelsは `VITE_ENABLE_DEBUG_UI=1` かつ適切なdebug/admin条件のときだけ表示する。

## Charts
- `src/features/charts/pages/ChartsPage.tsx`, `src/features/charts/ChartsActionBar.tsx`, `src/features/charts/OrderBundleEditPanel.tsx`, `src/features/charts/SoapNotePanel.tsx`, `src/features/charts/PatientSummaryPanel.tsx` を中心に、MVP上必要な安全UIを整える。
- 患者識別は `PatientIdentityBar` または既存同等部品で、患者ID、氏名、性別/年齢、診療日/受付日、診療科、担当医、保険/ORCA取得状態を見える位置に保つ。
- ORCA送信、診察終了して会計へ送信、order bundle submit、SOAP保存、患者サマリ保存は、native disabledだけで止めず、read-only/missing master/fallback data/encounter不足/保存中/変更なし等の理由を表示し、条件未達時にmutationへ進まない。
- 重大操作は `CriticalOperationConfirmDialog` を使い、患者識別と操作名を再掲する。
- `OrderBundleEditPanel` は全面分割しない。MVPではfooter submit、検索/追加、danger操作、block reasonの可視化を優先する。

## Login / Patients / Mobile Images / Administration
- `src/LoginScreen.tsx` とlogin featureでplaceholder依存を減らし、label/support/error textへ移す。factor2 6桁入力の説明も明示する。
- `src/features/patients/PatientsPage.tsx` では検索/保存/ORCA参照の理由表示を整理し、fieldset全体のdisabledだけで止めない。
- `src/features/images/pages/MobileImagesUploadPage.tsx` はinline styleをCSSへ移し、患者未選択、ファイル未選択、選択ファイル要約、アップロード中、失敗を明確に表示する。
- `src/features/administration/*` は既存Admin UIを崩さず、ボタン階層、保存/接続確認/危険操作、alert/banner表示をFoundationに寄せる。

## Validation / Docs
- 可能なら `scripts/verify-ui-mvp-contract.mjs` を追加し、未定義CSS custom property、`FocusTrapDialog` backdrop close既定再混入、通常UIへのraw ORCA body/trace id/request id露出を検出する。
- 既存 `verify:web-guard` に安全に組み込めるなら組み込む。重すぎる場合は独立scriptとして残し、CI候補として記録する。
- focused testsを追加/更新する。
- 最終レポート `deliverables/codex-ui-mvp-20260521/validation-report.md` を作成する。
- 最後に `deliverables/codex-ui-mvp-20260521.zip` を作成する。

# サブエージェント起動とworktree
以下の順序で進めてください。

1. Foundationサブエージェントを個別worktree `../worktrees/opendolphin-ui-mvp-foundation` で起動し、完了後メインへマージする。
2. Foundationマージ後のブランチから、Reception/Charts/Edge Surfacesの3サブエージェントをそれぞれ個別worktreeで起動する。
   - `../worktrees/opendolphin-ui-mvp-reception`
   - `../worktrees/opendolphin-ui-mvp-charts`
   - `../worktrees/opendolphin-ui-mvp-edge-surfaces`
3. メインが差分をレビューし、Reception -> Charts -> Edge Surfaces の順にマージする。
4. Validation/Docsサブエージェントを `../worktrees/opendolphin-ui-mvp-validation-docs` で起動する。
5. 最終マージ、コンフリクト解消、全検証、成果物zip作成、報告を行う。

# 最低限実行する検証
メインエージェントは最終的に以下を実行してください。
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test:ci`
- `cd web-client && npm run build`
必要に応じて以下も実行してください。
- `cd web-client && npm run test:e2e:no-artifacts`
- WebORCA Trial preflight/read-only QA scripts

# 完了報告
最終報告には以下を含めてください。
- 変更概要
- MVP到達条件ごとの合否
- 変更ファイル一覧
- 残した非MVP課題
- 実行した検証コマンドと結果
- ORCA live/preflightを実行した場合は環境、範囲、副作用有無
- 作成したzipのpath

# サブエージェント向けプロンプト
以下を各subagent prompt fileに保存し、gpt 5.4 highで起動してください。

--- 01-foundation.md ---
あなたは OpenDolphinNext WEBクライアントMVP UI改修のFoundationサブエージェントです。必ず個別worktree `../worktrees/opendolphin-ui-mvp-foundation` で作業してください。モデルは gpt 5.4 high です。

目的は、MVP UI改修の土台を作ることです。`web-client/` 以外は原則変更しないでください。`client/` と `server/` はlegacy referenceとして扱ってください。ビルド成果物は無視してください。

参照資料:
- `web-client/notes/ui-current-contract.md`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `web-client/README.md`
- `web-client/package.json`

実施内容:
1. `src/styles/global.css` などで未定義CSS custom propertyを解消してください。最低限、`--ui-radius-sm/md/lg`, `--ui-selected-bg/border/rail`, `--ui-shadow-overlay`, `--ui-surface-elevated` を定義してください。
2. 既存CSSに大きな破壊を入れず、button/actionbar/field/banner/inline-errorの最小共通classまたはcomponentを追加してください。既存部品を大規模置換しないでください。後続サブエージェントが使えるAPIとCSS classをREADMEまたはdocsに記録してください。
3. `FocusTrapDialog` の `closeOnBackdrop` 既定値を `false` にしてください。backdrop click closeが必要なcallerだけ明示的に `closeOnBackdrop={true}` を指定してください。`CriticalOperationConfirmDialog` の重大操作confirmはbackdrop close不可を維持してください。
4. FocusTrapDialogとCriticalOperationConfirmDialogの既存テストを更新/追加してください。
5. `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md` のFoundation節に、追加したtoken/component APIを追記してください。

禁止事項:
- 通常UIへraw ORCA body, trace id, request id, RUN_IDを追加しない。
- 患者文脈をURL/browser storageへ戻さない。
- ORCA失敗/警告/UNKNOWNを成功扱いする文言を追加しない。

検証:
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- FocusTrapDialog CriticalOperationConfirmDialog` あるいは該当focused vitest

完了時は、変更ファイル、検証結果、後続サブエージェントが使うclass/component名を報告してください。

--- 02-reception.md ---
あなたは OpenDolphinNext WEBクライアントMVP UI改修のReceptionサブエージェントです。必ず個別worktree `../worktrees/opendolphin-ui-mvp-reception` で作業してください。モデルは gpt 5.4 high です。Foundationマージ後のブランチから開始してください。

目的は、受付画面をMVPとして安全に操作できるUIへ整えることです。`web-client/` 以外は原則変更しないでください。

参照資料:
- `web-client/notes/ui-current-contract.md` の Reception Surface
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- Foundationサブエージェントが追加したtoken/component docs

主対象:
- `src/features/reception/pages/ReceptionPage.tsx`
- `src/features/reception/styles.ts`
- `src/features/reception/components/*`
- `src/features/shared/PatientIdentityBar.tsx`
- 関連テスト

実施内容:
1. 受付日、患者検索、表示条件、ステータスタブ、表/カード切替、再取得をcompact control stripとして破綻なく表示してください。既存contractの配置方針を下回らないでください。
2. 患者検索/既存患者受付モーダルの受付登録フォームより先に `PatientIdentityBar` または同等の医療安全患者ヘッダーを表示してください。
3. 受付登録CTAは患者文脈が明確な場所に置き、患者未選択、ORCA受付対象未確認、診療科/担当医/保険未確定などの理由を近傍または押下時に表示してください。native disabledだけで止めないでください。
4. 受付取消は `CriticalOperationConfirmDialog` を使い、氏名・年齢・性別/小児区分・現在状態・実行操作名を再掲してください。通常UIにRUN_ID、trace id、raw ORCA body、内部IDを出さないでください。
5. Debug diagnostic panelsは `VITE_ENABLE_DEBUG_UI=1` かつsystem_admin/development debug routeなど既存条件に限定してください。
6. 表/カード表示の主要行操作は、カルテ/handoffがcanonical成立している場合に限定し、patientIdだけでChartsを開く導線を復活させないでください。
7. focused testsを追加/更新してください。

禁止事項:
- 新患登録や患者作成を受付MVPへ混ぜない。
- local seed/fallback患者をofficial受付検索結果へ混在させない。
- ORCA受付成立証跡なしに受付成功表示を捏造しない。
- debug/internal情報を通常visible copyへ出さない。

検証:
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- ReceptionPage`

完了時は、変更ファイル、スクリーン上のMVP改善点、検証結果、残課題を報告してください。

--- 03-charts.md ---
あなたは OpenDolphinNext WEBクライアントMVP UI改修のChartsサブエージェントです。必ず個別worktree `../worktrees/opendolphin-ui-mvp-charts` で作業してください。モデルは gpt 5.4 high です。Foundationマージ後のブランチから開始してください。

目的は、Charts画面をMVPとして安全に操作できるUIへ整えることです。大規模な全面再設計ではなく、患者識別、重大操作、ORCA送信/診察終了、オーダー保存、SOAP/患者サマリ保存の安全UIを完成させてください。

参照資料:
- `web-client/notes/ui-current-contract.md` の Charts Surface
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- Foundationサブエージェントが追加したtoken/component docs

主対象:
- `src/features/charts/pages/ChartsPage.tsx`
- `src/features/charts/ChartsActionBar.tsx`
- `src/features/charts/OrderBundleEditPanel.tsx`
- `src/features/charts/OrderDockPanel.tsx`
- `src/features/charts/SoapNotePanel.tsx`
- `src/features/charts/PatientSummaryPanel.tsx`
- `src/features/charts/styles.ts`
- 関連テスト

実施内容:
1. Charts画面上部と重大操作前で、患者ID、氏名、性別/年齢、診療日/受付日、診療科、担当医、保険/ORCA取得状態を見える位置に保ってください。
2. `ChartsActionBar` の ORCA送信、診察終了して会計へ送信、保存、印刷、補助操作のprimary/secondary/danger/tertiaryを整理してください。primary濫用を避け、危険操作はdangerにしてください。
3. ORCA送信・診察終了・order bundle submitは、read-only、missing master、fallback data、encounter context不足、保存中などでnative disabledだけに頼らず、押下時または近傍に理由を表示し、mutationへ進まないようにしてください。
4. `OrderBundleEditPanel` は全面分割しないでください。MVPではfooter submit、検索/追加、danger操作、block reason表示、action footerの整理を優先してください。
5. `SoapNotePanel` と `PatientSummaryPanel` は保存不可理由を近傍に表示し、保存中/変更なし/read-only/履歴表示の区別を保ってください。
6. 重大操作は `CriticalOperationConfirmDialog` を使い、患者識別と操作名、distinct confirm labelを再掲してください。
7. focused testsを追加/更新してください。

禁止事項:
- patient/facility/insurance/voucher/sequential/raw ORCA bodyを不要にrequest bodyやvisible UIへ混ぜない。
- canonical encounter不足時にORCA送信やincome/report printへ進めない。
- ORCA送信の失敗・警告・UNKNOWNを成功扱いにしない。
- right railに削除済みの重複導線を再混入させない。

検証:
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- ChartsActionBar OrderBundleEditPanel SoapNotePanel PatientSummaryPanel`

完了時は、変更ファイル、改善した安全UI、検証結果、残課題を報告してください。

--- 04-edge-surfaces.md ---
あなたは OpenDolphinNext WEBクライアントMVP UI改修のEdge Surfacesサブエージェントです。必ず個別worktree `../worktrees/opendolphin-ui-mvp-edge-surfaces` で作業してください。モデルは gpt 5.4 high です。Foundationマージ後のブランチから開始してください。

目的は、Login、Patients、Mobile Images、Administrationを、MVPとして最低限破綻なく使えるUIへ整えることです。大規模刷新ではなく、入力説明、理由表示、inline style整理、button/alert階層統一を優先してください。

参照資料:
- `web-client/notes/ui-current-contract.md`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- Foundationサブエージェントが追加したtoken/component docs

主対象:
- `src/LoginScreen.tsx`
- `src/features/login/*`
- `src/features/patients/PatientsPage.tsx`
- `src/features/patients/patients.css`
- `src/features/images/pages/MobileImagesUploadPage.tsx`
- `src/features/images/components/*`
- `src/features/administration/*`
- `src/styles/app-shell.css`
- 関連テスト

実施内容:
1. Loginのplaceholder依存を減らし、label/support/error textへ移してください。factor2 6桁入力の説明とエラー文を明示してください。
2. Login/Patientsの主要CTAは、native disabledだけでなく理由表示を持たせてください。DADS方針に沿って、未入力のまま押された場合に不足項目を案内する設計を優先してください。
3. Patientsは検索、保存、ORCA参照、official/local境界のUI説明を整理し、患者文脈と内部/debug情報を混ぜないでください。
4. Mobile Imagesはinline styleをCSSへ移し、患者未選択、ファイル未選択、選択ファイル要約、個別エラー、アップロード中、失敗を見えるようにしてください。
5. Administrationは既存AdminCard/AdminAlert/AdminFieldをFoundation tokenへ寄せ、保存/接続確認/危険操作のbutton階層を整理してください。
6. App shell/mobile表示で、ナビゲーションが大きく破綻しないように最低限のresponsive調整をしてください。DADS上、bottom navigationは使わないでください。
7. focused testsを追加/更新してください。

禁止事項:
- 認証フローやsession storage規約を壊さない。
- 患者文脈をURL/browser storageへ戻さない。
- Mobile Imagesで患者未確定のアップロードを可能にしない。
- Administrationでsecretや生credentialをvisible UIへ追加しない。

検証:
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test -- LoginScreen PatientsPage MobileImagesUploadPage AdministrationPage`

完了時は、変更ファイル、改善点、検証結果、残課題を報告してください。

--- 05-validation-docs.md ---
あなたは OpenDolphinNext WEBクライアントMVP UI改修のValidation/Docsサブエージェントです。必ず個別worktree `../worktrees/opendolphin-ui-mvp-validation-docs` で作業してください。モデルは gpt 5.4 high です。Foundation、Reception、Charts、Edge Surfacesのマージ後に開始してください。

目的は、MVP UI改修のガード、テスト、文書、成果物zipを完成させることです。`web-client/` と `docs/` と `deliverables/` を主対象にしてください。

参照資料:
- `web-client/notes/ui-current-contract.md`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- 各サブエージェントの報告

実施内容:
1. `docs/web-client/ux/mvp-ui-remediation-plan-20260521.md` を最終状態へ更新してください。実装済み内容、未実装だが非MVPとした内容、検証結果を整理してください。
2. 可能なら `web-client/scripts/verify-ui-mvp-contract.mjs` を追加してください。最低限、未定義CSS custom property、`FocusTrapDialog` backdrop close既定再混入、通常UIへのraw ORCA body/trace id/request id露出を検出してください。
3. 既存 `verify:web-guard` に安全に組み込めるなら組み込んでください。過度に不安定なら独立scriptにし、validation reportに理由を書いてください。
4. focused testの穴を確認し、必要な最小テストを追加してください。
5. `deliverables/codex-ui-mvp-20260521/validation-report.md` を作成してください。
6. `deliverables/codex-ui-mvp-20260521.zip` を作成してください。zipには、plan doc、subagent prompts、validation report、必要なevidenceだけを入れてください。node_modules、dist、test-resultsの巨大生成物は含めないでください。

検証:
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm run test:ci`
- `cd web-client && npm run build`
- 必要に応じて `cd web-client && npm run test:e2e:no-artifacts`

ORCA live/preflightを行う場合:
- URL: `https://weborca-trial.orca.med.or.jp/`
- credential: `ORCA_API_USER` / `ORCA_API_PASSWORD` またはローカル secret store から実行時に供給する。raw Basic 値は repo、成果物、summary、test fixture へ保存しない。
- read-only/preflight優先。副作用のある操作は既存runbookで安全性が明示されている範囲のみ。

完了時は、検証コマンド結果、未解決事項、作成zip pathを報告してください。
```
