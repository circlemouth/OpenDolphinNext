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
  - session がある状態で login route に入った場合は safe な `from` を優先し、無効時は reception fallback
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

## App Shell Surface
### Current Fact
- App shell の brand 表示は `OpenDolphinNext` です。
- 通常トップバーには session 操作として `ユーザー切替` と `ログアウト` を置き、admin 権限がある場合だけ `管理画面` を同じ session 操作群に置きます。
- 通常トップバーには施設IDと RUN_ID copy CTA を常時表示しません。RUN_ID / traceId は障害時や support surface の safe support ID として扱います。
- ORCA readiness は管理画面/運用監視を正本とし、App shell では warning/error の時だけ compact status を出します。正常時の `ORCA: readiness OK` は常時表示しません。
- `受付` / `患者管理` は workspace tab の固定導線で、現在画面は active tab の強調表示で示します。

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
- `ChartsPatientSummaryBar` は患者文脈を常時見せる encounter context band として扱います。
- page CTA の owner は `ChartsActionBar` で、`ORCA送信` の primary と `ドラフト保存` / `印刷/エクスポート` / `受付へ戻る` の visible secondary を disclosure 外に置きます。
- `PastHubPanel` は左列の historical reference / Do 補助 surface であり、comparison 専用主面ではありません。
- runtime right rail は `処方 / 注射 / 処置 / 検査 / 算定` の order-facing chooser-only surface です。`document` / `ORCA` / embedded editor は right rail に含めません。
- オーダー truth editor、`文書を編集` entry、`OrcaSummary` は center primary 側に置き、right rail は chooser source と handoff だけを担います。
- `latest-follow` は `SoapNotePanel` / `PastHubPanel` / `ChartsActionBar` の局所補助として存在し、独立 route はありません。
- `OrcaSummary` は Charts 内部の補助 panel です。
- `OrcaSummary` の `Workflow / 院内ローカル診療サマリ`、`Transmission / medical-mod-v2`、`ORCA収納情報` は must-visible 情報として closed disclosure の外に置き、page CTA owner を奪いません。
- `DocumentTimeline` と `MedicalOutpatientRecordPanel` は `showDebugUi` 有効時のみ表示される debug-only surface です。
- `MedicalOutpatientRecordPanel` は debug-only でも `院内ローカル診療サマリ詳細` の visible card として表示し、`ORCA収納情報` と混同する official 風 label や disclosure にはしません。

### Required State
- 患者文脈は `location.state` と揮発メモリのみで扱います。
- workspace patient tab は同一 SPA セッション内だけで保持し、reload/new tab 復元は行いません。
- deep link query は処理後に scrub します。
- reload 跨ぎの文脈復元は行いません。
- minimal encounter context を再解決できないときは editor を fail-close し、generic な `閉じる` ではなく `受付へ戻る` を named recovery CTA として出します。
- active patient の workspace tab switch/close は、未保存入力がある場合に save/discard/cancel guard を通します。
- ORCA 送信ボタンは canonical encounter context (`patientId`, `visitDate`, `departmentCode`, `physicianCode`, `insuranceCombinationNumber`, `voucherNumber`, `sequentialNumber`) が揃わない限り enable しません。
- `visitDate` の `today` fallback や display string parsing は ORCA 送信文脈に使いません。
- chart flow 後続の旧 follow-up route は current contract に含めません。chart send/finish の official outbound は `medicalmodv2` と `incomeinfv2` のみです。

### Terminology
- 「参照カルテ」と「参照パネル」は current docs 上で完全同義とは断定しません。
- 本文では umbrella term として「参照系 surface」を使います。

### Verification
- runtime smoke: `runtime-ready-smoke.mjs` が release 前 mandatory
- runtime smoke は主要 route / guard の確認根拠であり、debug-only surface の常時表示までは断定しません。
- manual: SoapNotePanel 中心の通常導線、Patients / Mobile Images / 管理画面 への遷移確認
- guard minimum:
  - right rail は chooser-only を維持し、`document` / `ORCA` tool や embedded editor を再混入させない
  - canonical encounter context 不足時は ORCA送信を fail-close
  - canonical encounter context 不足時は report print / incomeinfv2 取得も fail-close
  - ORCA収納情報は official income semantics (`未収金合計`, `請求金額`, `入金額`, `保険適用金額`, `自費金額`, `食事・生活療養負担金`) を表示
  - 院内ローカル診療サマリと ORCA収納情報の責務を混ぜない
- unknown: pane geometry、最小 state schema

## Reception Surface
### Current Fact
- Reception は既存患者の受付導線です。新患登録や患者作成は current surface に含めません。
- `既存患者受付/患者検索` モーダルの患者 picker は `/api/local/patients/search` を使います。patientId / 氏名 / カナのローカル条件で絞り込み、official `patientlst3v2` はこの導線では使いません。
- official `patientlst3v2` + `WholeName` 必須の name-search は別の master search 導線の契約であり、accept workflow の患者 picker に混在させません。
- `InOut` 未選択はエラーではなく「未送信」を意味します。
- 受付登録時の `Medical_Information` は UI 選択時のみ送信し、未選択なら送信しません。
- 担当医コード、`Acceptance_Push`、診療内容コードは client 側で補完・正規化・抑止せず、選択値または未送信をそのまま official bridge に渡します。
- ただし一部 WebORCA 環境で `Acceptance_Push` suppress が必要な場合は、client ではなく server runtime config `ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH=true` で明示します。default は off です。
- 受付登録 response は `Api_Result=00` / `0000` / warning code だけでは成功扱いにしません。`acceptanceId` / `voucherNumber` / `scheduleKey` / `encounterKey` / `Acceptance_Info` などの受付登録証跡が同じ response にある場合だけ `businessAccepted` / `businessAcceptedWithWarnings` として一覧へ反映します。
- patient evidence だけの response は `notVerified` とし、患者ID・氏名などから受付行や canonical handoff を client 側で捏造しません。
- 会計送信や受付後続で使う visit context は `departmentCode` / `physicianCode` / `visitDate` の canonical 値だけを使い、display string 再解析・patientId first-match・`today` fallback を current contract に戻しません。
- accept 成功後に charts を開く handoff は、mutation response の `scheduleKey` / `encounterKey` を優先し、未返却時だけ同一受付を指す refreshed entry で補完します。`patientId` 単独一致では handoff を解決しません。
- patient search 結果から charts を開く導線は、直前 accept で確立した canonical handoff か、当日の active entry を一意に解決できる場合に限って有効化します。複数 active entry がある場合は fail-close します。
- Reception surface は常時表示の戻り導線を持たず、Charts 再開は受付行または受付/患者検索の canonical handoff が成立した場合の操作として出します。
- 受付ツールバーは正常時の `RT同期 接続済み` と `最終更新` を表示しません。自動更新停止や予約/来院データ不整合など、ユーザー対応が必要な状態だけを `エラー` 導線に集約します。
- `エラー` 導線は受付ツールバーではなく app shell のセッション領域に表示し、通常の検索・絞り込み操作から分離します。
- 予約/来院データ不整合は常時バナーではなく、`エラー` 導線を開いた詳細内に表示します。患者単位の送信エラー・遅延・未承認とは件数を分けて扱います。
- appointment/slot 行の不整合判定は旧 `appointmentId` 単独ではなく、`appointmentId` / `scheduleKey` / `encounterKey` のいずれかを予約識別子として扱います。projection 由来で ORCA 予約番号が未返却でも canonical key がある行は不整合扱いにしません。
- visit 行の不整合判定は旧 `receptionId` 単独ではなく、`encounterKey` / `scheduleKey` / `receptionId` のいずれかを受付識別子として扱います。canonical key がある visit 行は、受付番号表示が空でも不整合扱いにしません。
- ORCA 予約/来院 API の `slots` / `visits` に混在する診療科・医師などの selector option 行は、患者・予約・受付・時刻の業務 context を持たない場合は受付行へ変換しません。実患者行で患者 ID や canonical key が欠落している場合だけ不整合として扱います。
- 受付日、検索、再取得、詳細条件、既存患者受付/患者検索、表示切替、ステータスタブは、独立した上部 toolbar ではなく active status の一覧 header に compact controls として置きます。受付日の変更は date input に統一し、別個の `日次状態` カレンダーボタンは置きません。診療科/担当医、保険/自費、ソート、保存ビュー、ビュー保存/削除/クリアは同じ header 内の詳細条件で展開します。
- 受付一覧の `表` / `カード` 表示切替はステータスタブの右端に置き、検索条件操作とは別の list view 操作として扱います。
- 受付一覧の通常表示では予約IDを患者ID列に出さず、生年月日は `1957年12月10日生` 形式で表示します。性別は文字列ではなく、男性は青、女性は赤の左端ラインで区別します。
- 受付一覧の表表示は `支払` / `請求` / `直近` 列を通常列から外し、会計送信・ORCA状態・補正メモなど必要な操作情報だけを残します。
- 受付一覧の workflow state は `受付中 / 診療中 / 会計待ち / 再計待 / 会計済み / 予約` で扱い、`送信済` は transmission signal として別表示します。会計送信成功だけで `会計済み` へ遷移させません。
- `再計待` は会計済み後の編集を示す workflow state です。補足文は correction note として扱い、generic memo と混在させません。
- row-local key (`encounterKey` / `scheduleKey` / `receptionId` / `appointmentId`) を一意に解決できない場合、受付一覧に positive な `送信済` 表示を重ねません。
- Charts の transmission evidence / invoice / warning も同じ row-local key で解決し、`patientId` latest cache を positive source に戻しません。
- Reception の visible page title は workspace tab の active 表示へ統合し、重複する page header card は表示しません。screen reader 向け heading / description は維持します。

### Verification
- test: reception accept/cancel の `Api_Result=21` を保険不一致、`Api_Result=60` を受付なしとして統一
- test: accept workflow の patient search request が `/api/local/patients/search` を使い、current local search 条件に一致すること
- test: visit list request が `Department_Code` を送ること
- test: `Medical_Information` 未選択時に送信しないこと
- test: master search 導線では `WholeName` 未入力で official patient search を送らず、`InOut` 未選択時は official payload から省くこと
- test: claim-send / visit context で patientId first-match / display string reparsing / `today` fallback を使わないこと
- test: accept 成功後の charts handoff は `scheduleKey` / `encounterKey` を持つ canonical context だけで成立し、mutation response または refreshed entry のどちらでも同じ contract を使うこと
- test: 会計送信成功が workflow `会計済み` を直ちに意味せず、`送信済` は transmission signal として別表示されること
- test: 会計済み後の編集は `再計待` へ移り、correction note を generic memo と分離して表示すること
- manual: Reception 画面文言が既存患者受付限定で、新患は Patients へ誘導すること

## Patients Surface
### Current Fact
- 初期 patient context は `location.state` top-level -> `location.state.encounter` -> scoped volatile encounter context の順で解決します。
- Patients が読む minimal context は `patientId`, `appointmentId`, `receptionId`, `visitDate` です。
- `returnTo` は safe な候補だけを direct return に使い、fallback は `from=reception` なら reception、それ以外は charts です。
- `patients:returnTo` の sessionStorage seam は current repo に reader / writer を持たず、戻り導線は `useAppNavigation().safeReturnToCandidate` を正とします。
- 通常 UI の監査表示は summary を正とし、raw endpoint dump は default から外します。
- Patients 一覧検索は local search と明示し、氏名・カナ・患者番号・電話・郵便番号の local 条件だけを current UI に残します。
- local search の `searchType` は client/server で同じ判定に揃え、明示指定が無い場合も `name` / `kana` / `patient-id` / `telephone` / `zipcode` のどれかへ解決します。
- 患者基本情報の official create/update/import は単一路線に混ぜず、`create` / `update` / `import` を別導線として扱います。
- official create/update/import 成功後は canonical source を再取得し、その canonical record で local sync を確定します。
- chart の患者基本情報編集 dialog も Patients と同じ official update route を使います。
- chart support では、patient-aware な official `contraindicationcheckv2` と、ORCA master を使う static interaction check を UI copy で明確に分離します。
- SOAP 補助入力、chart summary、Patients の diff/review は local-only surface として表示し、official ORCA write と誤認させる copy を残しません。
- local-only wording は `症状詳記（院内ローカル）`、`院内ローカル診療サマリ`、`院内メモはローカル編集のみ` に寄せ、official write surface と見分けられる状態を current contract とします。
- Disease は single list truth に戻さず、`保険病名` / `ORCA mirror` / `候補` を visible unit で分離します。manual-resolution note は default visible とし、mirror unavailable 時も fake list を出しません。

### Verification
- code-confirm: `PatientsPage` の初期選択、warning copy、fallback CTA
- code-confirm: `PatientsPage` の local search 明示、official create/update/import の分岐、成功後 canonical re-fetch/local sync
- code-confirm: `PatientInfoEditDialog` の official update route 呼び出しと、成功後 callback による canonical/local sync refresh
- code-confirm: `DiagnosisEditPanel` の `保険病名` / `ORCA mirror` / `候補` 分離、candidate-not-truth、manual-resolution default visible
- manual: reception / charts 由来の再入場と patient 未選択開始

## Mobile Images Surface
### Current Fact
- `patientId` は query `patientId` -> `location.state.patientId` -> deep link volatile context の順で解決します。
- current screen は `ReturnToBar`、患者特定、アップロード、完了/参照の単一カラム構成です。
- fallback は `from=reception` なら reception、`from=patients` なら patients、既定は charts です。
- retry 後は送信ボタンへ、送信成功後は最初の参照リンクへ focus を戻します。
- document/image lifecycle は `web-client/notes/document-image-lifecycle.md` を正本とし、print preview restore と attachment-linked saved document の再編集は fail-close します。

### Verification
- code-confirm: deep link scrub 後の patient 復元、missing-patient error、feature-disabled message
- manual: file picker、upload、retry、return CTA

## Admin Surface
### Current Fact
- admin current contract の source of truth は `/api/admin/config` です。
- `/api/admin/config` の正本範囲は charts delivery only です。
- `/api/admin/delivery` を第 2 正本として復活させません。
- top-level navigation は `delivery`, `orca-users`, `master-updates` の 3 本で、tab pattern ではなく plain navigation / `aria-current` を使います。
- `delivery` 配下は `dashboard`, `connection`, `config`, `queue`, `operations`, `debug` の section sub-navigation を持ちます。
- sub-navigation は `設定 / 状態確認 / 調査` に regroup します。
- authz の canonical layer は `AdministrationGate` の route-level guard です。
- `connection` は接続テストの実行面、`operations` は状態参照面です。
- `config` section は charts delivery toggle だけを表示し、diagnostic / correction / runtime-owned setting を混ぜません。
- `AdminDeliveryStatusCard` は配信メタデータ card として `deliveryId / version / etag / deliveredAt` を表示します。
- `connection` section は施設別 ORCA 接続設定 only、`testedScope` は capability note、runtime-owned setting は docs note を正本とします。
- UG-14 未解決項目や optional module visibility owner 不明項目は UI に toggle を出さず、feature-off / fail-close で扱います。

## Explicit Unknown
- pane geometry
- print / debug / administration を含む app-wide handoff state detail
- `NavigationGuardProvider` の `screenKey` 粒度を超える task-level coverage

## References
- [notes/README.md](./README.md)
- [web-client/README.md](../README.md)
- [auth-check.md](./auth-check.md)
- [auth-transition.md](./auth-transition.md)
- [patient-context-contract.md](./patient-context-contract.md)
- [disease-insurance-orca-contract.md](./disease-insurance-orca-contract.md)
- [feedback-spec.md](./feedback-spec.md)
- [release-gate.md](./release-gate.md)
- [security-spec.md](./security-spec.md)
- [docs/managerdocs/03_web_current_contract_summary.md](../../docs/managerdocs/03_web_current_contract_summary.md)
- [docs/web-client/ux/dads_app_ui_design_rules_20260411.md](../../docs/web-client/ux/dads_app_ui_design_rules_20260411.md)
- [docs/web-client/ux/web-client-ui-guideline.md](../../docs/web-client/ux/web-client-ui-guideline.md)
- [docs/web-client/architecture/document-embedded-attachment-policy.md](../../docs/web-client/architecture/document-embedded-attachment-policy.md)
- [docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md](../../docs/web-client/architecture/web-client-screen-structure-decisions-20260106.md)
