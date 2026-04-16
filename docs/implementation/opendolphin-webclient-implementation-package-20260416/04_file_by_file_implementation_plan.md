# 04. File-by-File Implementation Plan

以下は実装担当者が追加判断せずに着手できる粒度で固定した。各項目は **変更理由 / 変更後の振る舞い / state-copy-fallback / 依存 / 受け入れ条件** の順で記載する。

## 4-01. `web-client/notes/chart-domain-boundary.md`
- 変更理由: Charts の 3 ペイン責務と center/right/left の禁止事項が repo 正本に無い。WS-03 と WS-08 の基準面が不足している。
- 変更後の振る舞い: left = reference/support、center = primary editor/runtime main、right = order-facing chooser-only を明文化する。`PastHubPanel`・`SoapNotePanel`・right rail の責務境界、debug-only surface 非昇格、bottom nav 禁止を固定する。
- state / copy / fallback: user-visible copy は持たない。unknown asset / unknown surface は `right rail に出さない` を fail-close とする。
- 依存: `web-client/notes/ui-current-contract.md`, reviewer-03, reviewer-08
- 受け入れ条件: 文書だけで `right rail に何を置くか / 置かないか` が一意に読める。

## 4-02. `web-client/notes/reusable-assets-taxonomy.md`
- 変更理由: assist / set / template / generated artifact / truth object が current repo 内で混在している。
- 変更後の振る舞い: `患者候補 / 施設頻用 / ORCA入力セット / ORCA診療セット / 既存オーダー` を order-facing chooser source として固定し、Do / document template / findings template / consult set / cp-set / generated artifact を別扱いにする。
- state / copy / fallback: visible label 正本は `患者候補`, `施設頻用`, `ORCA入力セット`, `ORCA診療セット`, `既存オーダー`。unknown asset は非表示。
- 依存: `web-client/notes/chart-domain-boundary.md`, reviewer-03
- 受け入れ条件: order-facing chooser に document template や consult set が紛れない。

## 4-03. `web-client/notes/disease-insurance-orca-contract.md`
- 変更理由: Disease 3 層、candidate-not-truth、mirror 非 truth の repo 正本がない。
- 変更後の振る舞い: insurance-local authoring / ORCA mirror / candidate source / clinical layer の 4 区分、conflict matrix、manual-resolution fallback、open gates を固定する。
- state / copy / fallback: `同期候補があります`, `ORCA側と差分があります`, `保険病名の確認が必要です` を canonical note とし、stale exact wording は gate に残す。
- 依存: `web-client/notes/ui-current-contract.md`, `web-client/notes/feedback-spec.md`, reviewer-04
- 受け入れ条件: single list truth 禁止、ORCA mirror 非 truth、order-derived auto-confirm 禁止が明記される。

## 4-04. `web-client/notes/document-image-lifecycle.md`
- 変更理由: template / snapshot / attachment reference / patient image asset / print preview / generated artifact の語彙が current repo で分散している。
- 変更後の振る舞い: object taxonomy、source of truth、delete scope、print/mobile patient-context rule、open gates を 1 枚で固定する。
- state / copy / fallback: `文書履歴参照を削除`, `snapshot only`, `reference remove only`, `この画面だけでは再開できません` を fail-close 基準として残す。
- 依存: `web-client/notes/patient-context-contract.md`, `docs/contracts/patient-images.md`, `docs/contracts/document-integrity.md`, reviewer-05
- 受け入れ条件: 実装担当が attach/detach/edit/reuse/delete/print の scope を追加判断なしで読める。

## 4-05. `web-client/notes/billing-boundary-correction-scenarios.md`
- 変更理由: send / correction / paid / rebill の境界と scenario catalog が repo 正本に無い。
- 変更後の振る舞い: workflow state, transmission signal, correction signal, setting note の 4 層と correction scenario catalog を固定する。`send success != paid` と `correction required not workflow state` を明文化する。
- state / copy / fallback: `会計待ち + 送信済`, `ORCA補正要確認: {safe reason}`, `再計待: {safe reason}` を canonical fallback にする。
- 依存: `web-client/notes/ui-current-contract.md`, `web-client/notes/feedback-spec.md`, reviewer-06
- 受け入れ条件: Charts / Reception / tests が同じ state taxonomy を参照できる。

## 4-06. `web-client/notes/management-setting-dependent-behavior.md`
- 変更理由: setting dependency inventory と authoritative source inventory が repo に無い。
- 変更後の振る舞い: setting を `admin config`, `connection`, `capability`, `runtime-owned`, `unknown` に分け、source of truth / owner / fallback / touched surface を表で固定する。
- state / copy / fallback: `設定依存: {reason}` を correction note と別カテゴリにし、unknown setting は feature-off / fail-close に倒す。
- 依存: `docs/contracts/runtime-config.md`, `docs/contracts/orca-connection.md`, reviewer-07
- 受け入れ条件: `/api/admin/config` の bulk expansion が禁止され、unknown setting が success 扱いされない。

## 4-07. `web-client/notes/ui-current-contract.md`; `web-client/notes/patient-context-contract.md`; `web-client/notes/feedback-spec.md`
- 変更理由: reviewer 提案の大半が current contract docs に着地していない。docs 間で cross-link が不足している。
- 変更後の振る舞い: Reception / Charts / Orders / Disease / Document / Billing / Setting の boundary note へ cross-link を追加し、fixed premise を current contract に落とす。patient-context note には named return / no persistence / canonical key fail-close を追記し、feedback-spec には action/result copy, correction note, setting note, missing-context copy を追加する。
- state / copy / fallback: `受付へ戻る`, `会計送信を完了。会計済みは収納確認後に反映します。`, `来院文脈を復元できませんでした。受付から対象患者を選び直してください。`, `設定依存: {reason}` を固定する。
- 依存: new domain notes 6 本
- 受け入れ条件: docs だけで surface owner / state owner / fallback owner を追跡できる。

## 4-08. `web-client/notes/release-gate.md`; `docs/runbooks/release-validation.md`; `docs/web-client/ux/web-client-ui-guideline.md`; `docs/contracts/runtime-config.md`; `docs/contracts/orca-connection.md`; `docs/contracts/patient-images.md`; `docs/contracts/document-integrity.md`; `docs/web-client/architecture/document-embedded-attachment-policy.md`; `web-client/notes/README.md`
- 変更理由: release gate と architecture/contract docs が recovery package の fixed decision に追随していない。
- 変更後の振る舞い: stop-ship 条件、manual QA、runtime/config scope、patient images mainline、document integrity、embedded attachment policy を current repo truth ベースで更新する。ui-guideline は DADS 再掲ではなく project-local adaptation と must-visible checklist に限定する。
- state / copy / fallback: unknown は docs 内でも unknown と表記し、推測で UI 文言を増やさない。
- 依存: TASK-001〜003
- 受け入れ条件: runbook / release gate / architecture note / contract docs 間で矛盾がない。

## 4-09. `web-client/src/features/outpatient/types.ts`
- 変更理由: current 型では `再計待` が存在せず、workflow と transmission を型で分離できない。
- 変更後の振る舞い: `ReceptionStatus` に `再計待` を追加し、transmission signal と correction signal を row model で別保持できる最小型へ更新する。
- state / copy / fallback: `送信済` を workflow enum に入れない。authority 未確定時は `会計待ち + 送信済` を fallback とする。
- 依存: UG-01, UG-02, reviewer-01, reviewer-06
- 受け入れ条件: compile-time で `送信済` と `会計済み` を混同しにくい構造になる。

## 4-10. `web-client/src/features/reception/receptionDailyState.ts`
- 変更理由: current override は `statusByPatientId` で same-day multi-reception に誤貼りする。
- 変更後の振る舞い: override key を row-local にし、`再計待` rank/source を追加する。paid 後 edit 時だけ demotion を許可し、send signal は workflow override と分離する。
- state / copy / fallback: UG-01 未解決時は local override で `会計済み` を立てない。UG-02 未解決時は paid 後編集を `再計待` に倒す。
- 依存: `web-client/src/features/outpatient/types.ts`, `web-client/src/features/charts/orcaClaimSendCache.ts`
- 受け入れ条件: same-day multi-reception で誤行更新せず、send success だけで paid へ上がらない。

## 4-11. `web-client/src/features/charts/orcaClaimSendCache.ts`
- 変更理由: current cache key が patientId 単位で row-local transmission signal に使えない。
- 変更後の振る舞い: cache key / match signature を row-local key へ変更し、曖昧な row には positive signal を貼らない。
- state / copy / fallback: row match が曖昧なら `送信済` を出さず `未確認` に倒す。
- 依存: WS01-G1, `web-client/src/features/reception/receptionDailyState.ts`
- 受け入れ条件: 同一 patientId の別受付に `送信済` / `送信失敗` が誤貼りされない。

## 4-12. `web-client/src/features/reception/pages/ReceptionPage.tsx`
- 変更理由: send success 後に `会計済み` へ上げる current bug、correction slot 不在、collapsed card must-visible 不足がある。
- 変更後の振る舞い: `handleSendBilling` success で workflow を進めず transmission signal だけ更新する。table / card ともに workflow / transmission / correction / primary action を always-visible にする。`entry.note` は generic memo のまま残し correction 専用 slot を追加する。
- state / copy / fallback: `会計待ち + 送信済`, `要確認: {safe reason}`, `再計待: {safe reason}`。blocked-send は CTA 直下。authority 未確定時は paid を出さない。
- 依存: `types.ts`, `receptionDailyState.ts`, `orcaClaimSendCache.ts`, DADS visible-state rule
- 受け入れ条件: collapsed card でも must-visible が見え、`会計済み` 早出しが消える。

## 4-13. `web-client/src/features/charts/ChartsPatientSummaryBar.tsx`
- 変更理由: current summary bar は patient-only で encounter 文脈と billing/send slot を表示しない。CTA owner も分散している。
- 変更後の振る舞い: encounter context band へ責務変更し、患者 / 来院 / send / 会計の最小情報を常時表示する。main CTA button は持たない。
- state / copy / fallback: field labels = `来院日`, `診療科`, `担当医`, `状態`, `受付ID`, `予約ID`, `送信`, `会計`。conditional line = `正式送信条件不足: <field labels>`。
- 依存: `ChartsPage.tsx`, `OrcaSummary.tsx`, reviewer-02
- 受け入れ条件: band だけで患者と encounter と send/billing 概況が読める。

## 4-14. `web-client/src/features/charts/ChartsActionBar.tsx`
- 変更理由: summary bar と action bar に CTA ownership が分散し、`保存/印刷/戻る` が disclosure に隠れる。
- 変更後の振る舞い: page CTA owner を一本化し primary を 1 本に限定する。`保存`, `印刷`, `受付へ戻る` を disclosure 外へ出し、`診察中断` は support action に降格する。
- state / copy / fallback: `保存`, `診察終了`, `ORCA送信`, `印刷`, `受付へ戻る` を visible に保つ。`ORCA送信` / `印刷` disabled 時は近接 note を維持する。
- 依存: `ChartsPage.tsx`, `feedback-spec.md`, reviewer-02
- 受け入れ条件: 1280/1024/768 で required action が hidden disclosure に落ちず、single primary を守る。

## 4-15. `web-client/src/features/charts/pages/ChartsPage.tsx`; `web-client/src/features/charts/styles.ts`; `src/AppRouter.tsx`; `src/styles/app-shell.css`; `src/features/workspaceTabs/WorkspaceTabBar.tsx`
- 変更理由: lost-context fail-close が page-level action と結びついておらず、width rule も未固定。
- 変更後の振る舞い: encounter band props を組み立て、minimal context loss では editor/action bar を fail-close して `受付へ戻る` を primary recovery CTA にする。shell / styles で 1280/1024/768 の center-first 再配置を固定する。
- state / copy / fallback: `来院文脈を復元できませんでした。受付から対象患者を選び直してください。` / `受付へ戻る`。canonical ORCA context only missing のときは editor は残し send/print だけ block。
- 依存: `ChartsPatientSummaryBar.tsx`, `ChartsActionBar.tsx`, `patient-context-contract.md`, UG-16
- 受け入れ条件: minimal context loss で unsafe editor continuation ができず、band -> action -> SOAP の読解順が保たれる。

## 4-16. `web-client/src/features/charts/rightUtilityTools.ts`; `web-client/src/features/charts/RightUtilityDock.tsx`
- 変更理由: runtime dock が `document` / `orca` を含む generic 補助ドックになっている。
- 変更後の振る舞い: tool taxonomy を `処方 / 注射 / 処置 / 検査 / 算定` に限定し、label / aria / title を chooser semantics に寄せる。
- state / copy / fallback: `オーダー候補`、`処方候補を開く` などの copy を使う。patient/context 未整備時は reason を近接表示する。
- 依存: `chart-domain-boundary.md`, `reusable-assets-taxonomy.md`, reviewer-03
- 受け入れ条件: dock 定義から `document` / `orca` が消える。

## 4-17. `web-client/src/features/charts/RightUtilityDrawer.tsx`; `web-client/src/features/charts/orderChooserSources.ts`
- 変更理由: mounted drawer が embedded editor と `documentPanel` / `orcaPanel` を持つ second editor になっている。
- 変更後の振る舞い: drawer を chooser-only にし、editor mount を除去する。source section を `既存オーダー / 患者候補 / 施設頻用 / ORCA入力セット or ORCA診療セット / 検索して追加` に分け、source copy を shared module へ集約する。
- state / copy / fallback: `編集面で開く`, `新規作成を開く`, `このカテゴリの候補はありません`, `候補取得に失敗しました。再試行してください。`。
- 依存: `rightUtilityTools.ts`, `reusable-assets-taxonomy.md`
- 受け入れ条件: drawer DOM 内に order editor form が render されない。

## 4-18. `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`; `web-client/src/features/charts/OrderBundleEditPanel.tsx`; `web-client/src/features/charts/OrderSummaryPane.tsx`; `web-client/src/features/charts/SoapNotePanel.tsx`
- 変更理由: chooser source UI と truth object editor が editor 内に混在している。document entry も right rail 依存に寄りやすい。
- 変更後の振る舞い: editor から chooser source UI を除去し、sendability / validation / save semantics だけを残す。`文書を編集` は center/document flow の entry として維持する。
- state / copy / fallback: editor copy は `local-only`, `import-only`, `blocked` など sendability note に限定する。document entry は center 側に残す。
- 依存: `RightUtilityDrawer.tsx`, `orcaSendabilityPolicy.ts`, reviewer-03
- 受け入れ条件: chooser source copy が editor 内に残らず、right rail を閉じても document entry が消えない。

## 4-19. `web-client/src/features/charts/DiagnosisEditPanel.tsx`; `web-client/src/features/charts/diseaseApi.ts`; `web-client/src/features/charts/chartOrderSetStorage.ts`; `web-client/src/features/charts/pages/OrderSetEditorPage.tsx`
- 変更理由: single list `保険病名`、candidate 直結、order-set disease auto-apply、icdTen persistence ambiguity がある。
- 変更後の振る舞い: UI を `保険病名 / ORCA mirror / 候補` の visible unit に分け、candidate は explicit confirm でのみ insurance-local へ入る。order-set `diagnoses` は candidate-only semantics に変更する。`diseaseApi.ts` は insurance / mirror / candidate の型を分ける。
- state / copy / fallback: `同期候補があります`, `ORCA側と差分があります`, `保険病名の確認が必要です`, mirror unavailable note。clinical source unavailable は fake empty list ではなく boundary note。
- 依存: `disease-insurance-orca-contract.md`, UG-04〜07, WS04-G1, WS04-G2
- 受け入れ条件: single combined list と order-derived auto-create が消える。

## 4-20. `server-modernized/src/main/java/open/dolphin/rest/LocalDiagnosisResource.java`; `server-modernized/src/main/java/open/dolphin/orca/service/DiseaseProjectionService.java`; `server-modernized/src/main/java/open/orca/rest/OrcaDiseaseQuerySupport.java`; `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaLiveDiseaseMasterResource.java`; `server-modernized/src/main/java/open/dolphin/orca/read/OrcaLiveDiseaseMasterReadService.java`
- 変更理由: server 側で insurance-local authoring route と mirror support の境界が明文化されていない。
- 変更後の振る舞い: `/api/local/diagnoses*` を insurance-local authoring として扱い、mirror/clinical field を混ぜない。mirror support は read-only のまま維持し、必要 route は gate closure 後にのみ追加する。
- state / copy / fallback: user-visible copy は持たない。route 未確定時は mirror unavailable fallback を前提にする。
- 依存: UG-04〜07, reviewer-04
- 受け入れ条件: mirror truth 化や guessed field が server contract に混ざらない。

## 4-21. `web-client/src/features/charts/DocumentCreatePanel.tsx`
- 変更理由: history delete / hard delete scope が曖昧で、attachment-linked edit 時の existing reference rehydrate も無い。
- 変更後の振る舞い: delete copy を `文書履歴参照を削除` ベースへ更新し、impact に `患者画像実体は削除しません` を明記する。attachment-linked document の `編集` は fail-close で block する。success copy は `画像参照 n 件を関連付けました` に寄せる。
- state / copy / fallback: `文書履歴参照を削除しますか？`, `画像参照付き文書は現契約では安全に再編集できません。新規作成で画像を選び直してください。`。
- 依存: `document-image-lifecycle.md`, UG-09, WS05-G2
- 受け入れ条件: attachment-linked edit/save で existing reference が silent drop しない。

## 4-22. `web-client/src/features/charts/print/documentPrintPreviewStorage.ts`; `web-client/src/features/charts/pages/ChartsDocumentPrintPage.tsx`
- 変更理由: patient-specific preview state を sessionStorage に保持しており fixed premise と衝突する。
- 変更後の振る舞い: print route は `location.state` のみで開き、preview storage 書込み/復元を document preview 用から外す。missing-state では safe return CTA を出す。
- state / copy / fallback: `文書プレビューの状態が見つかりません`, `この画面は一時プレビューのため、再開できません。Charts へ戻って開き直してください。`。
- 依存: `patient-context-contract.md`, UG-08, reviewer-05
- 受け入れ条件: reload/new tab で patient-specific preview が復元されない。

## 4-23. `web-client/src/features/images/components/ImageDockedPanel.tsx`; `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`; `web-client/src/features/images/patientImagesApi.ts`
- 変更理由: asset upload と document attachability が UI 上で混ざり、attach 不可理由が save-time surprise になる。
- 変更後の振る舞い: image card 単位で `文書に添付` 可否理由を visible に出し、`SOAPに挿入` は別 action として維持する。Mobile Images では stage 別 one-primary を固定する。
- state / copy / fallback: `患者画像としては保存済みですが、文書には添付できません`, `患者画像機能はサーバーで無効化されています。`, `撮影して送る`, `写真を選んで送る`, `送信`。
- 依存: `document-image-lifecycle.md`, `patient-context-contract.md`, reviewer-05, reviewer-08
- 受け入れ条件: oversize / feature-off / missing patient を save 後ではなく action 近傍で読める。

## 4-24. `server-modernized/src/main/java/open/dolphin/rest/KarteDocumentWriteResource.java`; `server-modernized/src/main/java/open/dolphin/rest/PatientImagesResource.java`; `server-modernized/src/main/java/open/dolphin/storage/attachment/AttachmentStorageManager.java`; `server-modernized/src/main/java/open/dolphin/security/integrity/DocumentIntegrityService.java`
- 変更理由: `/karte/document` reference-only payload の real backend 契約が薄く、snapshot / asset / integrity の削除境界も test で弱い。
- 変更後の振る舞い: 先に tests で contract を固定し、supported なら existing asset metadata を安全に解決して persist する。unsupported なら explicit 4xx/409 に倒し、web-client は feature-off fallback を使う。
- state / copy / fallback: server 直出し copy は持たない。client 側 fallback は `文書への画像関連付けは未対応です。患者画像保存またはSOAP挿入を利用してください。`。
- 依存: WS05-G1, `document-integrity.md`, reviewer-05
- 受け入れ条件: mock だけ通る attach ではなく、real backend contract の有無が test で分かる。

## 4-25. `web-client/src/features/charts/orcaBillingStatus.ts`; `web-client/src/features/charts/OrcaSummary.tsx`; `web-client/src/features/charts/orcaIncomeInfoCache.ts`
- 変更理由: Charts 側はおおむね正しいが correction note catalog と rebill fallback が不足する。
- 変更後の振る舞い: `resolveBillingStatusFromInvoice()` は keep しつつ、send / paid / correction / rebill を別 slot へ出す resolver を追加する。`orcaIncomeInfoCache.ts` は invoiceNumbers 非永続を維持する。
- state / copy / fallback: `送信済`, `会計待ち/未確認`, `会計済み`, `再計待: {safe reason}`, `ORCA補正要確認: {safe reason}`。paid は confirmation source がある時だけ。
- 依存: `billing-boundary-correction-scenarios.md`, UG-01, UG-02, UG-12
- 受け入れ条件: invoice mismatch では send success でも `会計待ち` のままで、correction note は hidden にならない。

## 4-26. `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportResource.java`; `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`; `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java`; `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java`
- 変更理由: send/confirm boundary と correction normalization owner を server 側で再混線させない必要がある。
- 変更後の振る舞い: `OrcaChartSupport*` を official send/confirmation boundary として維持し、Visit/Appointment へ paid promotion logic を入れない。structured correction reason を server で返すと決まった場合だけ support へ追加する。
- state / copy / fallback: user-visible copy は client owner。server は safe field だけ返す。
- 依存: UG-01, UG-12, reviewer-06
- 受け入れ条件: `medical-mod-v2` と `income-info` の意味分離が崩れない。

## 4-27. `web-client/src/features/administration/AdministrationPage.tsx`; `web-client/src/features/administration/delivery/WebOrcaConnectionCard.tsx`; `web-client/src/features/administration/api.ts`
- 変更理由: current admin page は scope split を持つが、section scope note と unknown setting feature-off を visible にしていない。
- 変更後の振る舞い: `config` section は charts delivery only、`connection` section は facility ORCA connection only を visible note で示す。WebORCA access / config / testedScope / push settings を別 line のまま維持し、unknown setting toggle を出さない。
- state / copy / fallback: `この section が正本なのは charts delivery のみです`, `この section が正本なのは施設別 ORCA 接続のみです`, `このテストでは未検証`。
- 依存: `management-setting-dependent-behavior.md`, reviewer-07
- 受け入れ条件: administration page を見ただけで global facility setting 正本に誤認しない。

## 4-28. `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigSnapshot.java`; `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigStore.java`; `server-modernized/src/main/java/open/dolphin/rest/admin/AdminConfigResource.java`; `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaConnectionResource.java`; `server-modernized/src/main/java/open/dolphin/rest/AdminOrcaCapabilitiesResource.java`; `server-modernized/src/main/java/open/dolphin/runtime/config/ServerConfigurationResolver.java`
- 変更理由: admin/config, connection, capability, runtime の owner 境界を server 側でも固定する必要がある。
- 変更後の振る舞い: Phase 0 では docs-first。source 未確定 setting の bulk expansion は行わない。connection/capability/runtime は current contract を維持し、optional feature visibility を追加する場合も source が確定した項目だけに限定する。
- state / copy / fallback: user-visible copy は持たない。unknown setting 用 guessed field は作らない。
- 依存: UG-14, reviewer-07, reviewer-09
- 受け入れ条件: `/api/admin/config` に未証明 field が入らない。