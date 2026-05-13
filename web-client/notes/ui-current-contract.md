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
- 通常トップバーの session 情報は、ユーザー名と権限を 1 つの compact summary にまとめ、session 操作群と可能な限り 1 行で表示します。ユーザー名と権限の詳細は accessible label / title で保持します。
- 通常トップバーには施設IDと RUN_ID copy CTA を常時表示しません。RUN_ID / traceId は障害時や support surface の safe support ID として扱います。
- ORCA readiness は管理画面/運用監視を正本とし、App shell では warning/error の時だけ全ロールに compact status を出します。正常時の `ORCA: readiness OK` は常時表示しません。ORCA check が `DOWN` または readiness 取得失敗の場合は `ORCA連携停止中` を表示し、URL、host、credential、raw error は表示しません。
- `受付` / `患者管理` は workspace tab の固定導線で、現在画面は active tab の強調表示で示します。
- Charts の患者 workspace tab は画面上では患者名だけを表示します。患者ID、受付/予約キー、診療日などは通常の tab label に出しません。

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
- `ChartsPatientSummaryBar` は患者文脈を常時見せる encounter context band として扱います。画面種別の装飾ラベル（例: `CHARTS`）は表示しません。
- 共通 `PatientIdentityBar` の医療安全患者ヘッダーは、患者識別情報に加えて、内部参照ID、受付日、診療科、担当医、保険組合せ、ORCA取得 source/fetched/cache status を同じ visible band に表示できる共通 component です。Charts の患者ヘッダーはこの共通 contract を使い、ORCA取得が未確認・暫定参照の場合は `stale` として見せ、警告を details 内へ隠しません。
- 共通 `CriticalOperationConfirmDialog` は重大操作の確認 surface として、実行操作名、患者名、患者ID、診療日などの患者識別情報、対象サマリ、cancel/confirm CTA を同一 modal 内に再掲します。Charts の低レベル ORCA 送信確認では title / operation を `診療行為ORCA送信`、confirm CTA を `ORCAへ送信する` とし、`DiagnosisEditPanel` の病名 ORCA 送信確認では operation を `病名ORCA送信`、title を各操作の確認、confirm CTA を `ORCAへ病名登録` / `ORCA病名を更新` / `ORCA病名を削除` / `削除病名を整理` とします。Charts の通常導線 `診察終了して会計へ送信` は未保存 guard と不足条件 guard を通過した後、共通 alertdialog で患者識別情報、終了対象サマリ、`会計済み確定ではありません` を再掲してから after-finish flow へ進みます。Charts の `その他 > キャンセル` は `診療録取消` として共通 alertdialog を通過し、患者識別情報、取消対象サマリ、`診療録取消の確定ではありません` を再掲してから UI の取消 intent を処理します。診療録確定、診療行為ORCA送信、会計済み確認、診療録取消確定の label と混同させません。共通 modal の action buttons は cancel を secondary、confirm を primary/danger として class contract を分け、DADS の 44px 以上の touch target を CSS と focused test で固定します。
- Charts の `署名確定解除` は共通 `CriticalOperationConfirmDialog` を使い、患者ID、診療日、受付ID、予約ID、署名状態、解除段階、影響範囲、`診療録確定や会計済み確定ではありません` を alertdialog 内に再掲します。既存の二段階確認は維持し、解除 callback は最終確認後だけ呼びます。署名確定解除の権限、履歴、再署名要否、監査 enforcement は server-side chart workflow の責務として残します。
- `PrescriptionOrderEditorPanel` の `処方確定` は保存操作と分離した common critical-operation alertdialog を通過してから `/api/local/prescription-orders/authority` draft 作成と `/api/local/prescription-orders/authority/{prescriptionId}/finalize` へ進みます。確認 modal には患者ID、診療日、来院参照、RP数、薬剤数、コード付き薬剤数、開始日、`ORCA送信や会計済み確定ではありません` を再掲します。client は server が返した `prescriptionId` だけで finalize route を呼び、client 側 hidden 値や local object key/digest を authority にしません。
- `RevisionHistoryDrawer` の診療録訂正（改訂版追加）/ 診療録復元は共通 `CriticalOperationConfirmDialog` を使い、患者ID、診療日、受付ID、予約ID、対象 revision、親 revision、版作成時刻、影響範囲を alertdialog 内に再掲してから revision write API へ進みます。この UI は対象確認の補助であり、確定済み診療録の訂正/復元権限、append-only event、content hash、監査 enforcement は server-side の chart revision workflow に残します。
- Charts の低レベル `ORCA 送信` と通常導線の `診察終了して会計へ送信` は送信前 precheck 理由だけでは native disabled にせず、`aria-disabled=true` と近傍 guard note で理由を示したうえで、押下時に同じ fail-closed precheck を実行して warning banner / audit に不足条件を出します。実行中など二重実行防止が必要な場合だけ native disabled を使います。
- `PrescriptionOrderEditorPanel` の `処方確定` が preview / 保存中 / 確定中で native disabled になる場合は、近傍 `charts-side-panel__block-reason` と `aria-describedby` で理由と有効化条件を表示します。この理由表示は二重実行防止と操作理解の UI 補助であり、処方確定の権限・状態遷移 enforcement ではありません。
- `OrderDockPanel` の quick-add / group-add / bundle edit / bundle copy / bundle delete / prescription-history import / recommendation apply は patient context 不足、read-only、missing master、fallback data だけでは native disabled にせず、`aria-disabled=true` と近傍 `order-dock-edit-block-reason` で理由を示したうえで、押下時に `オーダー追加を停止: ...`、`オーダー編集を停止: ...`、`オーダーコピーを停止: ...`、`オーダー削除を停止: ...`、`処方履歴取り込みを停止: ...`、`直近処方コピーを停止: ...`、`頻用オーダー反映を停止: ...` notice を出して editor / delete confirm を開きません。検索入力 / category select、pending/loading、二重実行防止、直近処方なしなど操作自体を受けられない状態は native disabled を維持し、検索入力 / category select には近傍 `order-dock-search-block-reason` と `aria-describedby` で理由を示します。
- `OrderRecommendationModal` のカテゴリ scope は default entity がない場合 native disabled を維持し、近傍 `order-recommend-category-scope-reason` と `aria-describedby` で理由と横断 scope の代替を示します。
- `OrderBundleEditPanel` embedded footer の `保存して閉じる` / `保存して続ける` / `保存して追加・更新` は read-only、missing master、fallback data だけでは native disabled にせず、`aria-disabled=true`、`data-disabled-reason=order_detail_submit_blocked`、近傍 edit block reason で理由を示し、押下時に `保存操作を停止: ...` notice と blocked audit を出して mutation へ進みません。保存中・禁忌チェック中など二重実行防止は native disabled を維持します。
- `DoCopyDialog` の `適用` は転記元なし / Do対象未選択では native disabled を維持し、近傍 `charts-do-copy-apply-block-reason` と `aria-describedby` で理由を示します。
- `PastHubPanel` の SOAP Do転記入口は転記可能 SOAP なし / セクション記載なしでは native disabled を維持し、近傍 `past-hub-do-copy-*` reason と `aria-describedby` で理由を示します。
- `PatientSummaryPanel` の `保存` は read-only / 保存中 / 変更なしでは native disabled を維持し、近傍 `charts-patient-summary-save-block-reason` と `aria-describedby` で理由を示します。
- `SoapNotePanel` の `保存` は read-only / 履歴表示 / 保存中では native disabled を維持し、近傍 `soap-note-save-block-reason` と `aria-describedby` で理由を示します。
- `SoapNotePanel` の利用者向け見出しは `カルテ本文` とし、内部向けの `Primary Workspace` や折りたたみの記載メタ情報は通常表示に置きません。
- page CTA の owner は `ChartsActionBar` です。通常 UI の primary は `診察終了して会計へ送信` で、`ドラフト保存` / `印刷/エクスポート` / `受付へ戻る` の visible secondary を disclosure 外に置きます。低レベル `ORCA送信` direct bridge は debug / QA / focused test 用に限定し、通常画面の初回会計送信導線には出しません。
- `PastHubPanel` は左列の historical reference / Do 補助 surface であり、comparison 専用主面ではありません。
- runtime right rail は `処方 / 注射 / 処置 / 検査 / 算定` の order-facing chooser-only surface です。`document` / `ORCA` / embedded editor は right rail に含めません。
- オーダー truth editor、`文書を編集` entry は center primary 側に置き、right rail は chooser source と handoff だけを担います。`OrcaSummary` は開発用表示時だけ center primary 側に追加します。
- `latest-follow` は `SoapNotePanel` / `PastHubPanel` / `ChartsActionBar` の局所補助として存在し、独立 route はありません。
- `OrcaSummary` は Charts 内部の開発/運用確認用 panel です。通常 UI では表示せず、`showDebugUi` 有効時のみ `ORCA確認（開発用）` として表示します。
- 通常 UI の ORCA 送信可否・印刷可否は `ChartsActionBar` の guard reason / action state で扱い、`OrcaSummary` の `Workflow / 院内ローカル診療サマリ`、`Transmission / medical-mod-v2`、`ORCA収納情報` は page CTA owner を奪いません。
- `DocumentTimeline` と `MedicalOutpatientRecordPanel` は `showDebugUi` 有効時のみ表示される debug-only surface です。
- `MedicalOutpatientRecordPanel` は debug-only でも `院内ローカル診療サマリ詳細` の visible card として表示し、`ORCA収納情報` と混同する official 風 label や disclosure にはしません。

### Required State
- 患者文脈は `location.state` と揮発メモリのみで扱います。
- workspace patient tab は同一 SPA セッション内だけで保持し、reload/new tab 復元は行いません。
- deep link query は処理後に scrub します。
- reload 跨ぎの文脈復元は行いません。
- minimal encounter context を再解決できないときは editor を fail-close し、generic な `閉じる` ではなく `受付へ戻る` を named recovery CTA として出します。
- active patient の workspace tab switch/close は、未保存入力がある場合に save/discard/cancel guard を通します。
- `診察終了して会計へ送信` は canonical encounter context (`patientId`, `visitDate`, `departmentCode`, `physicianCode`, `insuranceCombinationNumber`, `voucherNumber`, `sequentialNumber`) が揃わない限り進めません。未保存、来院文脈不足、ORCA unavailable、送信後変更などの理由は disabled だけにせず guard summary / visible note に出します。
- `visitDate` の `today` fallback や display string parsing は ORCA 送信文脈に使いません。
- chart flow 後続の旧 follow-up route は current contract に含めません。通常の初回会計送信は `/api/local/encounters/{encounterKey}/close-and-send-to-billing` を使い、server が encounter projection と保存済み order/disease から ORCA payload を導出します。低レベル official outbound は `medicalmodv2` / `diseasev3` / `incomeinfv2` の bridge として残します。
- `close-and-send-to-billing` が `ORCA_UNKNOWN`、`operationStatus=UNKNOWN`、`needsUserReview=true`、または `confirmationRequired=true` を返した場合、Charts は診察終了成功や会計待ち遷移に潰さず、患者タブを閉じずに要確認 banner を初期表示します。再送や状態確定は Reception 側 recovery / ORCA 連携一覧で `tmedicalgetv2` 再照合後に扱います。
- `診察終了して会計へ送信`、Charts `その他 > キャンセル`、`署名確定解除`、`処方確定`、共通重大操作 confirm の action priority / 44px touch target は患者取り違え防止と誤操作低減の UI 補助です。会計送信可否、encounter close、ORCA transmission、署名確定解除、処方確定の状態遷移、診療録取消の永続化、append-only event、監査、会計済み確定、操作権限の判断は server-side / owning workflow の enforcement に残し、UI confirm だけで安全性を満たした扱いにしません。
- Charts の処方由来 `orca_medical_candidate` 確認 surface は、患者、受付/予約、診療日、診療科、医師、保険組合せ、候補 status、処方 content hash 要約、候補行数、未解決 issue、RPごとの診療区分・用法・薬剤行を表示します。candidate API の `medicalInformation` は処方正本由来の `rpSequence` / `medicalClass` / `medicalClassNumber` / `usageCode` / `usageName` / 薬剤行（`itemSequence` 付き）を first-class に返します。この surface は candidate prepare と保存済み latest candidate の再確認だけを行い、ORCA 正本や請求 workflow の確定状態とは表示上も操作上も分離します。latest candidate が現在の処方 order id / revision id / hash と一致しない、または現在 status が候補化不能な場合は server が `prescription_candidate_source_stale` を返し、Charts は未解決 issue として扱います。client は candidate prepare / latest lookup に `chartRevisionId` 以外の patient / facility / insurance / voucher / sequential / URL / digest を送らず、表示中の受付・保険情報は確認用であって authority ではありません。

### Terminology
- 「参照カルテ」と「参照パネル」は current docs 上で完全同義とは断定しません。
- 本文では umbrella term として「参照系 surface」を使います。

### Verification
- runtime smoke: `runtime-ready-smoke.mjs` が release 前 mandatory
- runtime smoke は主要 route / guard の確認根拠であり、debug-only surface の常時表示までは断定しません。
- manual: SoapNotePanel 中心の通常導線、Patients / Mobile Images / 管理画面 への遷移確認
- guard minimum:
  - `PatientIdentityBar` の医療安全患者ヘッダーは患者ID、受付/診療日、診療科、担当医、保険組合せ、ORCA取得状態を同じ visible region に表示し、重大操作前の患者取り違え防止に使える状態を維持する
  - `CriticalOperationConfirmDialog` は backdrop click で閉じず、患者識別情報と実行操作名を alertdialog 内に再掲し、操作ごとに distinct な confirm label を使う
  - `RevisionHistoryDrawer` の診療録訂正/復元は共通重大操作 confirm を通過するまで revision write API を呼ばず、patientId/visitDate/revision を確認画面に再掲する
  - Charts `その他 > キャンセル` は共通重大操作 confirm を通過するまで取消 intent を実行せず、patientId/visitDate/reception/appointment と `診療録取消の確定ではありません` を確認画面に再掲する
  - Charts `ORCA 送信` と `診察終了して会計へ送信` は missing master / encounter context 不足などの precheck failure でも押下可能に見せ、押下時に理由を表示して確認 modal / finish hook / transport へ進まないこと
  - `OrderDockPanel` quick-add / group-add / bundle edit / bundle copy / bundle delete / prescription-history import / recommendation apply は patient context 不足、read-only、missing master、fallback data で押下時理由を表示し、editor / delete confirm を開かないこと。検索入力 / category select は native disabled 維持時に `order-dock-search-block-reason` で近傍理由を表示すること
  - `OrderRecommendationModal` category scope はカテゴリ未選択時に `order-recommend-category-scope-reason` で近傍理由と横断代替を表示すること
  - `OrderBundleEditPanel` embedded footer submit は read-only、missing master、fallback data で押下時理由を表示し、mutation へ進まないこと
  - `DoCopyDialog` apply は転記元なし / Do対象未選択で `charts-do-copy-apply-block-reason` による近傍理由を表示すること
  - `PastHubPanel` SOAP Do転記入口は転記可能SOAPなし / セクション記載なしで近傍理由を表示すること
  - `PatientSummaryPanel` save は read-only / 保存中 / 変更なしで `charts-patient-summary-save-block-reason` による近傍理由を表示すること
  - `SoapNotePanel` save は read-only / 履歴表示 / 保存中で `soap-note-save-block-reason` による近傍理由を表示すること
  - right rail は chooser-only を維持し、`document` / `ORCA` tool や embedded editor を再混入させない
  - canonical encounter context 不足時は `診察終了して会計へ送信` を fail-close
  - canonical encounter context 不足時は report print / incomeinfv2 取得も fail-close
  - ORCA収納情報は official income semantics (`未収金合計`, `請求金額`, `入金額`, `保険適用金額`, `自費金額`, `食事・生活療養負担金`) を表示
  - 院内ローカル診療サマリと ORCA収納情報の責務を混ぜない
  - 処方由来 `orca_medical_candidate` 作成・latest 確認 UI は `chartRevisionId` だけを API path に送り、patient / facility / insurance / voucher / sequential / raw ORCA body を request body に含めない
- unknown: pane geometry、最小 state schema

## Reception Surface
### Debug Diagnostics
- Reception diagnostic panels (official master search panel, order console, and audit history panel) are debug-only surfaces. They must stay hidden unless `VITE_ENABLE_DEBUG_UI=1` is set and the viewer is either system_admin or using the development `?debug=1` route.

### Current Fact
- `ChartsPatientSummaryBar` は患者に紐づく識別子を ORCA 患者IDに集約し、受付ID / 予約IDは上部サマリーに表示しません。性別・年齢は受付と同じ患者アイコンと compact meta に集約し、診療科 / 担当医は ORCA selector options または ORCA 由来の表示名を優先して表示します。
- Charts の患者基本表示（氏名、カナ、生年月日、性別、年齢）は ORCA official canonical patient batch を最優先にし、local seed/fallback 患者が同じ patientId で存在しても ORCA 値を上書きしてはいけません。住所やメモなど ORCA batch に含まれない補助項目だけ local fallback を使います。
- Reception は既存患者の受付導線です。新患登録や患者作成は current surface に含めません。
- `既存患者受付/患者検索` モーダルの患者 picker は ORCA official を使います。患者ID検索は `/api/orca/official/patients/batch`、氏名検索は `/api/orca/official/patients/name-search` を使い、受付導線の検索結果に `/api/local/patients/search` の seed/local 患者を混在させません。カナは official 氏名検索結果の画面内絞り込みとして扱い、カナ単独検索は受付導線では送信しません。
- official `patientlst3v2` + `WholeName` 必須の name-search は受付 workflow の氏名検索でも使います。患者ID指定時は exact lookup を優先し、氏名検索結果に対してだけカナの画面内絞り込みを適用します。
- 既存患者受付/患者検索モーダルの患者ID入力は ORCA 患者番号として数字のみ 8 桁までを受け付けます。WebORCA Trial の初期患者は 5 桁 ID なので、6 桁未満および過剰ゼロ埋めされた入力は送信前に 5 桁へ正規化し、例として `1` / `000001` は `00001` として official lookup に渡します。6 桁以上の非ゼロ始まり ID は桁を落とさず exact lookup に渡します。
- 既存患者受付/患者検索モーダルで official lookup が正常に完了して 0 件だった場合、または ORCA が `患者番号がありません` 等の not-found placeholder を返した場合は、患者カードとして表示せず「検索は完了したが該当患者が見つからない」旨を warning として表示します。
- 既存患者受付/患者検索モーダルの受付登録では、診療科 select に空の `選択してください` option を置かず、ORCA selector / 受付一覧から得た診療科候補の先頭を初期選択します。受付実行ボタンは右ペイン下部ではなく、選択中の患者検索結果カード内に表示し、患者選択・ORCA 受付対象確認・必須項目が揃った場合だけ有効化します。患者検索結果カード内の `カルテを開く` は置きません。
- `InOut` 未選択はエラーではなく「未送信」を意味します。
- 受付登録時の `Medical_Information` は UI 選択時のみ送信し、未選択なら送信しません。
- 担当医コード、`Acceptance_Push`、診療内容コードは client 側で補完・正規化・抑止せず、選択値または未送信をそのまま official bridge に渡します。
- ただし一部 WebORCA 環境で `Acceptance_Push` suppress が必要な場合は、client ではなく server runtime config `ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH=true` で明示します。default は off です。
- 受付登録 response は `Api_Result=00` / `0000` / warning code だけでは成功扱いにしません。`acceptanceId` / `voucherNumber` / `scheduleKey` / `encounterKey` / `Acceptance_Info` などの受付登録証跡が同じ response にある場合だけ `businessAccepted` / `businessAcceptedWithWarnings` として一覧へ反映します。
- patient evidence だけの response は `notVerified` とし、患者ID・氏名などから受付行や canonical handoff を client 側で捏造しません。
- 会計送信や受付後続で使う visit context は `departmentCode` / `physicianCode` / `visitDate` の canonical 値だけを使い、display string 再解析・patientId first-match・`today` fallback を current contract に戻しません。
- accept 成功後に charts を開く handoff は、mutation response の `scheduleKey` / `encounterKey` を優先し、未返却時だけ同一受付を指す refreshed entry で補完します。`patientId` 単独一致では handoff を解決しません。
- patient search 結果から charts を開く導線は置きません。Charts 再開は受付一覧の row/card action など、既に受付行の canonical handoff が成立している導線に限定します。
- 既存患者受付/患者検索モーダルの患者ID/氏名/カナ検索は、送信時の form value を正とし、受付行 auto-fill や未反映 state でユーザーが入力した患者IDを上書きしません。検索結果未選択時の右ペインは、既存の受付行選択を「選択患者」として表示しません。
- 既存患者受付/患者検索モーダルの受付登録ペインは、右側のスクロール可能なフォーム区画を境界・scrollbar・陰影で明示します。患者サマリは性別/小児区分アイコン、ふりがな、氏名、年齢だけを表示し、上部で示す患者IDや内部名 `受付登録モーダル`、`Medical_Information` などの実装説明は visible copy に出しません。右ペイン下部に「受付内容を確認して...」「必須項目を入力すると...」のような補助文は置きません。
- 既存患者受付/患者検索モーダルの受付登録ペインは、共通 `PatientIdentityBar` の医療安全患者ヘッダーをフォームより先に表示し、患者ID、氏名/カナ、性別/年齢、受付日、診療科、担当医、保険/保険組合せ context、ORCA受付対象確認 status を同じ visible region に再掲します。保険が初期選択されていて ORCA 保険組合せ番号が未確定の場合は `保険（組合せ未確定）` と表示し、client 側で ORCA 組合せ番号や受付成立を捏造しません。このヘッダーは患者取り違え防止の UI 補助であり、受付登録・権限・永続化の server-side enforcement を代替しません。
- 受付取消確認モーダルは、取消対象の同定に必要な氏名・年齢・性別/小児区分アイコン・現在状態だけを表示します。RUN_ID、患者ID/受付ID/予約ID、性別コード、ふりがな、重複した氏名/状態文、取消理由入力、内部説明文は visible copy に出しません。取消実行は破壊的操作として赤系の danger CTA で表示します。
- 過去カルテモーダルは利用者向けの履歴情報だけを表示し、RUN_ID copy CTA や ORCA 内部の連番/状態コードを visible copy に出しません。
- Reception surface は常時表示の戻り導線を持たず、Charts 再開は受付行または受付/患者検索の canonical handoff が成立した場合の操作として出します。
- 受付ツールバーは正常時の `RT同期 接続済み` と `最終更新` を表示しません。自動更新停止や予約/来院データ不整合など、ユーザー対応が必要な状態だけを `エラー` 導線に集約します。
- `エラー` 導線は受付ツールバーではなく app shell のセッション領域に表示し、通常の検索・絞り込み操作から分離します。
- 予約/来院データ不整合は常時バナーではなく、`エラー` 導線を開いた詳細内に表示します。患者単位の送信エラー・遅延・未承認とは件数を分けて扱います。
- appointment/slot 行の不整合判定は旧 `appointmentId` 単独ではなく、`appointmentId` / `scheduleKey` / `encounterKey` のいずれかを予約識別子として扱います。projection 由来で ORCA 予約番号が未返却でも canonical key がある行は不整合扱いにしません。
- visit 行の不整合判定は旧 `receptionId` 単独ではなく、`encounterKey` / `scheduleKey` / `receptionId` のいずれかを受付識別子として扱います。canonical key がある visit 行は、受付番号表示が空でも不整合扱いにしません。
- ORCA 予約/来院 API の `slots` / `visits` に混在する診療科・医師などの selector option 行は、患者・予約・受付・時刻の業務 context を持たない場合は受付行へ変換しません。受付一覧に表示する実患者行は ORCA 患者IDと氏名を必須とし、患者IDだけの projection/local 行は表示しません。
- 受付日、受付患者検索、表示条件変更、表示切替、ステータスタブは、独立した上部 toolbar ではなく active status の一覧 header に compact controls として置きます。標準表示は受付日の変更と現行範囲の受付患者検索（患者ID/氏名/カナ）に絞ります。受付日の変更は `受付日` label の右側に date input を置き、前後 1 日移動は date input の左右にある小さな三角矢印で行います。テキストの `前日` / `翌日` / `今日` ボタンや別個の `日次状態` カレンダーボタンは置きません。受付患者検索の `検索` ボタンは検索文字入力欄の右側へ置き、検索説明は別行 text ではなく input placeholder に入れます。`表示条件変更` は患者検索グループ内に置き、`一覧操作` の折りたたみボタンは置きません。`患者を受付する` は下段ステータスタブ行で `会計済み` / `予約` の右側へ置きます。再取得はステータスタブ行右端の `表` / `カード` 表示切替の右横に置きます。診療科/担当医、保険/自費、ソート、保存ビュー、ビュー保存/削除は同じ header 内の `表示条件変更` で展開します。絞り込み条件のクリアは独立カードにせず、`絞り込み` カード内の `条件をクリア` ボタンで表示します。
- Reception header の受付日・患者検索・補助操作は個別カードに分けず、1 つの compact control strip 内で区切り線だけを使って統一表示します。
- Reception header の compact control strip は親カード内で左揃えにし、`表示条件変更` は患者検索グループ内、`患者を受付する` はステータスタブ行の `会計済み` / `予約` の右側に配置します。
- 既存患者受付の `保険/自費` は患者選択時に `保険` を初期選択し、担当医は server-authoritative selector の先頭候補を初期選択します。ユーザーが変更した値を優先し、患者情報だけから受付文脈や canonical handoff を捏造してはいけません。
- App shell の `受付` / `患者管理` タブバーと受付一覧カードの間は、受付画面本体の上余白を小さく保ち、操作できない大きな空白帯を作りません。
- 受付一覧 header 内の `受付日` と `患者検索` の compact control は同一行では高さを揃え、片方だけが低く見える配置にしません。
- 受付一覧の `表` / `カード` 表示切替はステータスタブ行の右端に小さく右揃えで置き、`再取得` と同じ list view 操作群として扱います。`表` / `カード` は同一 segmented switch として見せ、`再取得` は別操作と分かる控えめな補助色で表示します。
- 受付一覧の active status と件数はステータスタブの active tab へ統合し、別の大きな `診察待ち 6件` 見出しを重複表示しません。ステータスタブは `患者ID` / `氏名` などの結果 table header のすぐ上に左揃えで置き、日付・検索 control より上の中央見出しとしては扱いません。screen reader 向け heading / live status は維持します。
- 受付一覧の通常表示では患者ID列に ORCA 患者IDの値だけを表示し、行内で `患者ID` ラベルは繰り返しません。受付ID/予約IDは通常列に出しません。受付ID/予約IDは取消・handoff・debug/meta 用の row-local key として扱い、患者IDの代替表示にしません。氏名列はふりがなを患者名の上に置き、生年月日は表示せず、受付日時点の年齢は独立した `年齢` 列に表示します。診療科は canonical `departmentCode` を保持しつつ、表示では ORCA selector / raw visit data 由来の診療科名を優先し、`01` や `01 内科` のようなコード主導表示に戻しません。性別と小児/成人区分は、男性/女性/未登録の色と小児/成人の形状が分かるプロフィールバッジ型の患者アイコンで表示します。
- 受付一覧の右端は `カルテ` と `その他` の行操作に使います。各ボタンの label が操作内容を示すため、画面上の列見出し `操作` は表示しません。支援技術向けには `行操作` の列名を維持します。
- 受付一覧の表表示は `支払` / `請求` / `直近` 列を通常列から外し、ORCA状態・補正メモなど必要な操作情報だけを残します。標準の初回 `会計送信` 操作は Reception から出さず、医師画面の `診察終了して会計へ送信` を起点にします。Reception 側は再送・確認・明示的追加送信など recovery 操作の owner です。
- Reception は `GET /api/local/encounters/orca-transmissions/review` の server-side facility scoped 一覧を初期表示し、`ORCA_UNKNOWN` / `ORCA_FAILED` / `CORRECTION_REQUIRED` を重要警告として折りたたまず出します。この recovery 一覧は初回会計送信ボタンを復活させません。画面表示は患者ID、encounter / schedule key、operation status、Api_Result、開始時刻、次アクションに限定し、idempotency key、request ID、trace ID、ORCA raw body、保険組合せ、伝票番号、連番を表示しません。`ORCA状態を再照合` は `POST /api/local/encounters/orca-transmissions/{transmissionId}/reconcile-temporary-medical` へ transmission ID だけを渡し、照合結果は一致件数、総件数、`Medical_Uid` 存在有無、要確認状態の sanitized summary として表示します。`Medical_Uid` 値、保険組合せ、raw ORCA body、患者氏名、住所、電話番号は表示しません。照合成功は再送成功や会計済みを意味せず、引き続き要確認として扱います。server が `resendBlocked=true` を返した場合は、ORCA側で会計済みまたは展開済みの可能性として再送停止と管理者確認を初期表示し、client 側で解除判定を作りません。
- 受付一覧の通常表では ORCA 連携を専用列にしません。ORCA 連携は成立している前提のため `—` などの正常プレースホルダーを出さず、queue / error などユーザー対応が必要な状態だけメモ/参照列に補助情報として出します。
- ORCA 公式来院一覧に runtime projection を補完表示する場合は、server-derived `Voucher_Number` / `Sequential_Number` / `Insurance_Combination_Number` 相当が projection に揃った行だけを扱います。旧 local smoke seed など ORCA 正式識別子の無い projection や、`0000001 / スモーク 患者` の legacy local smoke seed は受付一覧の official row として表示しません。
- 受付一覧の workflow state は `受付中 / 診療中 / 会計待ち / 再計待 / 会計済み / 予約` で扱い、ORCA workflow 表示は `診察中 / 送信待ち / ORCA送信中 / 会計可 / 要確認 / 送信後変更あり / ORCA側展開済み` に寄せます。`送信済` は transmission signal として別表示します。会計送信成功だけで `会計済み` へ遷移させません。
- `再計待` は会計済み後の編集を示す workflow state です。補足文は correction note として扱い、generic memo と混在させません。
- row-local key (`encounterKey` / `scheduleKey` / `receptionId` / `appointmentId`) を一意に解決できない場合、受付一覧に positive な `送信済` 表示を重ねません。
- Charts の transmission evidence / invoice / warning も同じ row-local key で解決し、`patientId` latest cache を positive source に戻しません。
- Reception の visible page title は workspace tab の active 表示へ統合し、重複する page header card は表示しません。screen reader 向け heading / description は維持します。
- 業務固有アイコンは文字ラベルの補助として使い、画像アイコンは accessible name を置換しません。`ORCA送信`、`会計送信`、`受付取消`、`診察終了`、`ロック解除` など主要・危険操作は icon-only にしません。

### Verification
- test: reception accept/cancel の `Api_Result=21` を保険不一致、`Api_Result=60` を受付なしとして統一
- test: accept workflow の patient search request が ORCA official patient lookup 用の form filters を保持し、患者ID検索で local seed patient を混在させないこと
- test: visit list request が `Department_Code` を送ること
- test: `Medical_Information` 未選択時に送信しないこと
- test: master search 導線では `WholeName` 未入力で official patient search を送らず、`InOut` 未選択時は official payload から省くこと
- test: accept workflow の受付登録ペインは共通 `PatientIdentityBar` で患者ID、氏名、受付日、診療科、担当医、保険 context、ORCA受付対象確認 status を visible 表示し、未確定の保険組合せを確定番号として見せないこと
- test: claim-send / visit context で patientId first-match / display string reparsing / `today` fallback を使わないこと
- test: accept 成功後の charts handoff は `scheduleKey` / `encounterKey` を持つ canonical context だけで成立し、mutation response または refreshed entry のどちらでも同じ contract を使うこと
- test: Reception は標準の初回 `会計送信` direct button を出さず、医師画面から送信する案内と recovery-only surface に寄せること
- test: Reception の ORCA送信要確認一覧は `ORCA_UNKNOWN` を初期表示し、idempotency key / request ID / trace ID を visible text に出さず、初回 `会計送信` direct button を出さないこと
- test: Reception の ORCA送信要確認一覧から `ORCA状態を再照合` を押しても client は transmission ID だけを送り、patient / facility / insurance / voucher / sequential / `Medical_Uid` / raw ORCA body を送らず、結果表示にも秘密系識別子を出さないこと
- test: Reception の ORCA送信再照合で `resendBlocked=true` が返った場合は再送停止と管理者確認を表示し、`Medical_Uid` 値や保険組合せを表示しないこと
- test: 会計送信成功が workflow `会計済み` を直ちに意味せず、`送信済` は transmission signal として別表示されること
- test: 会計済み後の編集は `再計待` へ移り、correction note を generic memo と分離して表示すること
- guard: `verify:medical-safety-ui-copy` は production UI/current docs 上の ORCA送信を単純成功・反映・登録完了として見せる visible copy、送信完了と診療録確定/会計済みを結び付ける copy、および重要警告を初期表示から外す記述を拒否します。
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
- Patients 詳細ペインの共通 `PatientIdentityBar` は、選択患者と `location.state.encounter` / volatile encounter context の patientId が一致する場合だけ、内部参照ID、受付/診療日、診療科、担当医、保険組合せ、`患者管理同期状態` を医療安全患者ヘッダーへ表示します。patientId が一致しない encounter context は表示文脈へ混ぜず、Patients 側の表示は患者基本情報と同期状態の UI 補助に限定し、ORCA受付・保険・権限・永続化の server-side authority を代替しません。
- chart support では、patient-aware な official `contraindicationcheckv2` と、ORCA master を使う static interaction check を UI copy で明確に分離します。
- SOAP 補助入力、chart summary、Patients の diff/review は local-only surface として表示し、official ORCA write と誤認させる copy を残しません。
- local-only wording は `症状詳記（院内ローカル）`、`院内ローカル診療サマリ`、`院内メモはローカル編集のみ` に寄せ、official write surface と見分けられる状態を current contract とします。
- Disease は ORCA 正本です。Charts の主病名一覧は `/api/local/diagnoses/{patientId}?baseMonth=yyyyMM` が返す ORCA `diseasegetv2?class=01` 再取得結果だけを `ORCA登録病名` として表示します。`baseMonth` は診療日から導出して送信し、server-side 検証後に ORCA `Base_Date` と cache `base_month` の根拠になります。既存 local-only disease は `送信候補` 枠に `layer=candidate` / `candidateKind=draftCandidate` として隔離し、主一覧へ混ぜません。`送信候補` 枠は対象がある場合だけ表示し、ORCA登録済みではないことを明示します。ORCA `Api_Result=21` は「対象病名なし」の正常 0 件として扱います。
- SOAP / カルテ本文中の病名らしい記載は `診療録本文中の病名記載` 枠に表示し、`ORCA登録病名` と混ぜません。この枠はカルテ本文正本の参照であり、ORCA送信ボタンを置かず、明示 confirm なしに `diseasev3` payload へ昇格しません。
- 病名マスター候補は補助入力です。`/api/orca/official/disease-master/name/{param}/` は server-side ORCA master datasource を参照し、日付を `yyyyMMdd` に正規化します。ローカル開発DBで `tbl_byomei` が無い、または ORCA master datasource が未起動の場合だけ最小 bootstrap 候補を返せますが、明示 confirm なしに ORCA 登録 payload や主一覧へ昇格しません。
- ORCA unavailable 時は local-only disease を fallback 表示せず、「ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。」を表示し、ORCA 病名操作を disabled にします。
- `DiagnosisEditPanel` の quick ORCA病名登録ボタンは、read-only / ORCA mirror unavailable などの理由だけでは native disabled にせず、`aria-disabled=true` と `diagnosis-mutation-block-reason` で近傍理由を関連付け、押下時に `ORCA病名操作を停止: ...` を表示して confirm / mutation へ進みません。ORCA mirror 取得中や mutation pending など二重操作防止が必要な状態は native disabled を維持します。
- ORCA 病名操作は `ORCAへ病名登録` / `ORCA病名を更新` / `ORCA病名を削除` / `削除病名を整理` に分け、いずれも共通 `CriticalOperationConfirmDialog` の alertdialog で ORCA患者番号、診療日、診療科、保険組合せ、操作、病名、属性、ORCA送信コード、再取得待ちを再掲してから `/api/orca/official/chart-support/disease-mod-v3` へ送ります。成功後は楽観更新せず、再取得した ORCA `diseasegetv2` 結果だけを表示します。この確認 modal は患者取り違え防止の UI 補助であり、病名送信の認可、ORCA request number、永続化、監査の server-side enforcement を代替しません。
- `diseasev3` operation は `create|update|delete|organizeDeletedDiseases` に限定します。`Request_Number=01` は `削除病名を整理` だけで使い、通常 create/update/delete には混ぜません。client は `Request_Number` を送らず、server-owned value として扱います。

### Verification
- code-confirm: `PatientsPage` の初期選択、warning copy、fallback CTA
- code-confirm: `PatientsPage` の詳細患者ヘッダーは一致する encounter context だけを医療安全メタへ表示し、不一致 patientId の encounter / schedule / 診療科 / 担当医 / 保険組合せを表示しないこと
- code-confirm: `PatientsPage` の local search 明示、official create/update/import の分岐、成功後 canonical re-fetch/local sync
- code-confirm: `PatientInfoEditDialog` の official update route 呼び出しと、成功後 callback による canonical/local sync refresh
- code-confirm: `DiagnosisEditPanel` の `保険病名` / `ORCA mirror` / `候補` 分離、candidate-not-truth、manual-resolution は対象病名がある時だけ visible
- code-confirm: `DiagnosisEditPanel` quick disease create は ORCA mirror unavailable / read-only 時に押下時理由を表示し、confirm / mutation へ進まない
- manual: reception / charts 由来の再入場と patient 未選択開始

## Mobile Images Surface
### Current Fact
- `patientId` は query `patientId` -> `location.state.patientId` -> deep link volatile context の順で解決します。
- current screen は `ReturnToBar`、患者特定、アップロード、完了/参照の単一カラム構成です。
- `MobileImagesUploadPage` は共通 `PatientIdentityBar` を使い、router state の `encounter` に診療日、診療科コード、担当医コード、保険組合せ、encounter/schedule key がある場合は同じ visible 医療安全患者ヘッダーへ表示します。Mobile Images 側では ORCA 正本再取得を行わないため、ORCA取得状態は `遷移文脈 / unverified` として表示し、アップロード完了や画像参照を ORCA 同期済みとは表示しません。
- fallback は `from=reception` なら reception、`from=patients` なら patients、既定は charts です。
- retry 後は送信ボタンへ、送信成功後は最初の参照リンクへ focus を戻します。
- document/image lifecycle は `web-client/notes/document-image-lifecycle.md` を正本とし、print preview restore と attachment-linked saved document の再編集は fail-close します。

### Verification
- code-confirm: deep link scrub 後の patient 復元、missing-patient error、feature-disabled message
- code-confirm: router state encounter がある場合、Mobile Images の共通患者ヘッダーに診療日、診療科、担当医、保険組合せ、内部参照ID、ORCA取得状態が visible に出ること
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
