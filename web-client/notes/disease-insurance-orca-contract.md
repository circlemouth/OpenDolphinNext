# Disease Insurance / ORCA Contract

この文書は Charts の Disease を ORCA 正本として扱うための current contract を定義します。

## Scope
- `ORCA登録病名`: Charts の主病名一覧の source of truth。ORCA `diseasegetv2` の再取得結果だけを表示する。
- `診療録本文中の病名記載`: SOAP / カルテ本文の記載。OpenDolphinNext の診療録本文正本であり、ORCA登録病名ではない。
- `院内未送信`: 既存 local-only disease や ORCA 未送信の下書き。主病名一覧には混ぜず、対象がある場合だけ隔離枠を表示する。
- `候補`: master / order-set / 補助入力から来る candidate source
- `clinical`: 外部の臨床病名 source。未接続の間は current writable surface に昇格しない

## Fixed Boundary
- Charts の主病名一覧は `GET /api/local/diagnoses/{patientId}` が返す ORCA `diseasegetv2?class=01` projection だけを表示します。ORCA `Api_Result=21` は「対象病名なし」の正常 0 件として扱い、ORCA unavailable とは分離します。
- SOAP / カルテ本文から検出した病名らしい記載は「診療録本文中の病名記載」枠に表示し、ORCA登録病名一覧や `diseasev3` 送信 payload へ自動昇格しません。この枠には ORCA送信ボタンを置かず、病名登録は別途 `ORCAへ病名登録` の明示 confirm を必須にします。
- ORCA 取得不可時に local-only disease を主病名一覧へ fallback 表示しません。病名登録・更新・削除も disabled にします。
- ORCA 病名の create / update / delete は `/api/orca/official/chart-support/disease-mod-v3` だけを使い、成功後の `diseasegetv2` 再取得結果が UI truth です。
- `disease-mod-v3` response に `postMutationMirrorStatus=connected` と `postMutationMirror` が含まれる場合、Charts UI はその mirror projection を同一 query cache へ反映し、入力 payload や diseasev3 response だけで主一覧を楽観更新しません。`postMutationMirrorStatus=unavailable` の場合は ORCA accepted でも warning / 要確認として表示し、登録済み表示に昇格しません。
- ORCA 病名の正本データは表示文字列ではなく、`Disease_Single` 相当の順序付き component 列です。`displayName` は検索・表示用であり、更新・削除対象の同定や ORCA 送信の権威情報にしません。
- `院内未送信` は対象がある場合だけ隔離表示し、ORCAへ登録する明示 confirm がある場合だけ `diseasev3` へ送信します。
- 診察終了時の標準導線では、`POST /api/local/encounters/{encounterKey}/close-and-send-to-billing` が server-side snapshot を作成し、ORCA連携対象として明示された病名だけを `diseasev3` 連携候補にします。候補病名、臨床メモ、local-only disease は会計送信 snapshot に自動昇格しません。
- `候補` は truth ではありません。明示 confirm なしで ORCA 登録 payload に昇格させません。
- 病名マスター候補検索は server-side ORCA master datasource の `tbl_byomei` を参照し、画面日付は server で `yyyyMMdd` へ正規化する。`masterlastupdatev3` 由来の `disease_master` dataset を master update 状態に保存し、候補検索と病名一覧に `masterVersion` を含める。ローカル開発DBで master table が無い、または ORCA master datasource が未起動の場合だけ最小 bootstrap 候補を補助表示できるが、ORCA 登録済み truth にはせず、登録は confirm と `disease-mod-v3` を必須にする。
- 外部の臨床病名 source が未接続の間は fake list を出さず、boundary note で止めます。

## Canonical Notes
- `同期候補があります`
- `ORCA側と差分があります`
- `保険病名の確認が必要です`（`manual-resolution` の対象がある時だけ表示し、通常の ORCA mirror には初期表示しない）
- `ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。`
- `候補は自動反映されません。内容を確認してからORCAへ病名登録してください。`
- `院内未送信の病名があります。ORCAへ登録するまで主病名一覧には反映しません。`

## Conflict Matrix
| 状態 | ORCA登録病名 | 診療録本文中の病名記載 | 院内未送信 | 候補 | UI / fallback |
| --- | --- | --- | --- | --- | --- |
| normal | truth | chart text truth | 隔離表示 | 補助入力 | ORCA 再取得結果を主一覧に表示 |
| chart text mentions disease | truth | ORCA未登録の本文記載 | 隔離表示 | 補助入力 | 本文記載枠に表示し、送信操作を置かない |
| candidate available | truth | chart text truth | 隔離表示 | truth ではない | `同期候補があります` を表示し、明示 confirm のみ許可 |
| local-only exists | truth | chart text truth | ORCA未送信 | 補助入力 | `院内未送信` 枠へ隔離し、主一覧に混ぜない |
| mirror unavailable | unavailable | chart text truth | 隔離表示 | 補助入力 | 主一覧は fallback せず、ORCA mutation を disabled |
| clinical unavailable | truth または unavailable | chart text truth | 隔離表示 | 補助入力 | clinical unavailable note を表示し fake list を出さない |

## Fallback Gates
- UG-04 解決: insurance-local は正本ではなく `院内未送信` 枠に隔離する。
- UG-05 解決: Charts は `/api/local/diagnoses/{patientId}` の server-side projection から ORCA `diseasegetv2` mirror を取得し、`ORCA登録病名` として主一覧に表示する。
- UG-06 解決: local-only と ORCA projection は auto-merge / auto-overwrite せず、local-only は `院内未送信` として明示登録まで隔離する。
- UG-07 未解決: outcome preset は input assist のみ

## Charts ORCA Mirror API
- Charts の病名欄は `GET /api/local/diagnoses/{patientId}?baseMonth=yyyyMM` を使用する。クライアントは `facilityId` / owner / storage key / ORCA URL を送らず、サーバーは認証済みセッションの施設で患者とカルテを解決してから ORCA mirror を取得する。`baseMonth` は server-side で `yyyyMM` として検証し、ORCA `Base_Date` と cache `base_month` の根拠にする。
- `POST /api/local/diagnoses` は使用しません。Web クライアントからの病名 create / update / delete は、確認後に `/api/orca/official/chart-support/disease-mod-v3` へ送信し、成功後の再取得結果だけを主一覧へ反映します。
- ORCA mirror の取得は server-side ORCA transport の allowlist / runtime config に従い、任意 URL は受け付けない。ORCA response は外部入力として XML secure parser で読み、allowlist 済みの病名名、`Disease_Single` component 列、補足コメント、開始日、転帰、診療科、保険組合せ番号だけを projection する。
- ORCA mirror の取得成功時は server が `orca_disease_cache` に `source_system=ORCA`、`diseasegetv2` source metadata、取得時刻、cache expiry、raw response hash、normalized payload を保存する。Web クライアントは cache の facility / patient / URL / digest を指定しない。cache 書き込み失敗時は主一覧を成功扱いせず、sanitized unavailable state として扱う。
- `includeEnded=true` の取得では server が `Select_Mode=All` を生成し、転帰済み病名も含めて ORCA から再取得する。client は ORCA query XML や `Select_Mode` raw value を送らない。
- response は `sourceOfTruth=orca`、`orcaMirrorStatus=connected|unavailable`、主一覧用 `diseases`、隔離表示用 `pendingLocalDiseases` を返す。`diseases` に local-only entry を混ぜません。
- Server-side persistence は ORCA 病名の current cache、診療時点 snapshot、diseasev3 operation、監査 event を分離する。Web クライアントは cache/snapshot/operation/audit table の ID や保存先を authority として送らず、患者・診療日・診療科・医師・保険組合せは server-side context で検証される。
- `diseases` の各行は `components[]`、`supplements[]`、`displayName`、`karteName`、`outcome`、`orcaOutcomeReceivedCode`、`syncStatus`、`orcaSnapshotHash` を持てる。`orcaSnapshotHash` は患者、診療科、入外、保険、開始日、転帰日、転帰、component 列、supplement 列から server が計算する。
- `connected` で ORCA mirror が空の場合は「ORCAに登録済みの病名はありません。」、`unavailable` の場合は「ORCA病名を取得できませんでした。ORCA正本を確認できないため、病名の登録・更新・削除はできません。」を表示する。
- 候補や local-only entry は明示操作なしに ORCA 登録 payload へ昇格しない。取得成功時に旧文言「ORCA病名の参照取得はこの画面ではまだ接続されていない」は表示しない。
- ORCA transport failure / parser failure / non-zero ORCA result は fail closed とし、内部 URL、資格情報、raw XML、stack trace、ORCA 詳細メッセージを API response / UI に出さない。

## Charts ORCA Disease Mutation API
- ORCA 病名 mutation は `/api/orca/official/chart-support/disease-mod-v3` を使用する。
- client は `operation=create|update|delete|organizeDeletedDiseases` と入力内容だけを送る。`Request_Number`、raw XML、任意 URL、facilityId は受け付けない。
- `create|update` は `components[]` を必須にする。各 component は `seq=1..21`、`componentType=PREFIX|SITE|BODY|SUFFIX|UNKNOWN`、ORCA master 由来の `code` と `name` を持つ。server は code 形式、順序、BODY component の存在、転帰送信値を再検証し、client 提供の component 種別・表示名・保険組合せを権威情報にしない。
- 未コード化病名は最後の例外です。`uncodedAccepted=true` と登録前確認がある場合だけ許可し、通常の自由文字列登録は拒否する。未コード化送信時も server が `0000999` 相当の未コード化コードを補完し、警告を伴う。
- 補足説明は `supplements[]` から `Disease_Supplement_Single` へ送る。部位、接頭語、接尾語、傷病名本体は supplement に逃がさず `components[]` に置く。
- server は `Request_Number` を server-owned にする。通常 `create|update|delete` は `Request_Number` を送らず、`delete` は `Disease_OutCome=O` を server が生成する。
- `operation=organizeDeletedDiseases` の場合だけ server が `Request_Number=01` を生成する。`Request_Number=01` を通常削除へ混入させない。
- `Request_Number=02/03/04` は今回の UI/API からは送らず、client provided value は 400 で拒否する。
- 転帰 UI/API は `ACTIVE`, `CURED`, `DEATH`, `DISCONTINUED`, `TRANSFERRED`, `DELETED` を canonical state とする。ORCA 送信値は `ACTIVE=` 空、`CURED=F`、`DEATH=D`、`DISCONTINUED=P`、`DELETED=O` に固定し、`C` と `S` は送らない。`TRANSFERRED` は WebORCA Trial で実送信仕様を確認するまで ORCA 送信を block する。
- `update|delete` は mutation 前に ORCA `diseasegetv2` を再取得して target が存在することを server-side で確認し、drift 時は fail closed にする。
- target 照合は表示名だけで行わない。診療科、開始日、入外、保険組合せ、現在転帰、component code 列、supplement 列、snapshot hash を使い、drift 時は fail closed にする。
- `diseasev3` の `Disease_Warning_Info` と `Disease_Unmatch_Information` は固定フィールドだけを `warnings[]` / `unmatchInformation[]` に normalize し、患者情報、内部 URL、raw XML、資格情報、stack trace、ORCA 内部詳細は API/UI に露出しない。公式 `Disease_Unmatch_Info` は ORCA 側にだけ存在する未照合病名として code/name、補足名、入外、主病、疑い、開始日、転帰日、転帰、overflow flag を返す。`Organize_Information` は連番付け替え結果の sanitized summary として診療科と開始日だけを返す。
- server は diseasev3 request XML から server-generated idempotency key を作り、同一 facility の同一 request を ORCA transport 前に拒否する。`orca_disease_operation` は request / response hash と固定 summary だけを保存し、raw XML、任意 URL、資格情報、患者詳細、保険詳細を保存しない。ORCA transport が通信例外で終了した場合も、raw response body なしの `NETWORK_FAILED` / `needsUserReview=true` として保存し、登録済みまたは成功として表示しない。
- mutation 成功後は楽観更新せず、server が直後に `diseasegetv2` を再取得し、`postMutationMirrorStatus=connected` の `postMutationMirror` だけで Charts の主病名一覧を更新する。mutation が ORCA accepted でも再取得できない場合は `NEEDS_REVIEW` とし、入力 payload や diseasev3 response だけで登録済み表示にしない。Web client はこの状態を warning として初期表示し、既存 mirror を残したまま ORCA正本の再取得を促す。
- 会計送信 workflow から病名を送る場合も client は `patientId` / `facilityId` / 診療科 / 保険組合せ / `Request_Number` を指定しない。server が encounter projection、保存済み病名、ORCA mirror 差分から送信対象を導出し、未確定・候補・院内メモは除外する。

## Order Set Rule
- order-set の disease は candidate-only semantics です。
- order-set 適用時に disease candidate を silent create しません。
- candidate を保険病名へ反映する責務は `DiagnosisEditPanel` の explicit confirm に限定します。

## References
- [ui-current-contract.md](./ui-current-contract.md)
- [feedback-spec.md](./feedback-spec.md)
- [README.md](./README.md)
