# OpenDolphinNext 残タスク完遂 Round 3 ワーカープロンプト

RUN_ID: `20260513T134415Z`

この文書は [README.md](./README.md) の作業計画と Round 1/2 マージ完了後の `master` を前提に、次の並列作業者へ渡すプロンプト集です。

## Round 3 の担当者数

Round 3 は **3名** にします。

- E: ORCA operation ledger / UNKNOWN / 再送 / 二重送信防止
- G: DADS 医療安全 UI 基盤
- I: 横断テスト・CI・セキュリティガードの前倒し整備

H は E の ledger / UNKNOWN が固まってから export / readability に着手します。J は H の export / backup 方針後に live ORCA validation / runbook を仕上げます。

最終的なマージ宛先は **`master`** です。各担当は `master` から専用ブランチ・専用 worktree を作成し、完了後は Lead が `master` へ順にマージします。

## 全ワーカー共通指示

各担当者には、担当別プロンプトの先頭に以下をそのまま含めてください。

```text
【共通指示】

あなたは OpenDolphinNext の ORCA / WebORCA 連携電子カルテ安全化を担当する作業者です。
最終返答は必ず日本語で、【ワーカー報告】ヘッダーを使ってください。

作業開始直後に必ず実行してください。
- `date -u +%Y%m%dT%H%M%SZ` で自分の RUN_ID を採番する
- `git status --short`
- `git branch --show-current`
- 指定された専用 worktree を `master` から作成し、その worktree 内だけで作業する

ベースブランチ:
- `master`

最終マージ先:
- `master`

既存変更は勝手に戻さないでください。
`client/` と `server/` は legacy reference なので、明示指示なしに変更しないでください。
Python スクリプトは明示指示がない限り実行しないでください。

必ず読む正本:
- AGENTS.md
- docs/implementation/opendolphin-next-remaining-tasks-20260513T113016Z/README.md
- docs/README.md
- docs/managerdocs/README.md
- web-client/README.md
- docs/architecture/server-modernization-overview.md
- docs/runbooks/release-validation.md
- docs/architecture/ehr-orca-source-of-truth-boundary.md
- docs/architecture/ehr-chart-prescription-authority.md
- docs/architecture/orca-integration-safety-contract.md
- docs/testing/ehr-orca-required-test-matrix.md
- docs/operations/orca-unknown-state-runbook.md
- docs/contracts/orca-route-taxonomy.md

実装前に短く整理してから着手してください。
- 触る正本境界
- ORCA / WebORCA 正本か、OpenDolphinNext 正本か、cache / snapshot / candidate / audit log か
- 信頼境界
- 攻撃面
- 最低3件の misuse case
- 実行する検証コマンド

禁止事項:
- ORCA正本情報を OpenDolphinNext の local 正本にしない
- 確定済み診療録または確定済み処方指示を直接上書きしない
- ORCA送信失敗、警告、不一致、UNKNOWNを成功扱いしない
- ORCA URL、Basic認証、証明書、証明書パスワードをブラウザ側、ログ、成果物、報告に出さない
- クライアント提供の facilityId、ownerId、role、uri、digest、objectKey を権威情報にしない
- `target/`、`dist/`、`node_modules/`、`test-results/`、review zip 等の生成物をコミット対象に混ぜない

報告形式:
【ワーカー報告】
- RUN_ID:
- worktree:
- branch:
- base:
- merge target:
- 担当範囲:
- 実施内容:
- 変更ファイル:
- 更新したドキュメント:
- 検証結果:
- 未実行コマンドと理由:
- 医療安全・セキュリティ確認:
- 残リスク:
- マージ時の注意:
- automation / heartbeat 使用状況:
```

## 担当 E プロンプト

```text
【担当E: ORCA ledger / UNKNOWN / 再送制御】

共通指示に従ってください。

この担当は作業量が大きく、ORCA operation、監査、DB制約、状態遷移、テスト、docs を跨ぐため、作業開始時に自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: ORCA ledger / UNKNOWN / 再送 / 二重送信防止の実装、テスト、ドキュメント更新、再検証を完了まで継続する
- 完了条件: 担当範囲の実装、テスト、必要なドキュメント更新、最終報告が終わり、やる作業がなくなったら自分で heartbeat を解除する
- heartbeat 実行時は、未完了項目、直近の失敗、次に実行する検証を確認し、作業を継続する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-orca-ledger-unknown`
- 推奨ブランチ: `codex/orca-ledger-unknown-round3`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-orca-ledger-unknown -b codex/orca-ledger-unknown-round3 master`

目的:
全 ORCA operation を ledger に統一記録し、UNKNOWN、再送、二重送信防止、reconciliation を安全に扱える状態へ進めてください。ORCA 送信失敗、通信断、警告、不一致、UNKNOWN を成功扱いしないことが最重要です。

主対象:
- `server-modernized/`
- `domain/`
- `api-contract/`
- `persistence/`
- `docs/contracts/`
- `docs/operations/`
- `docs/testing/`
- ORCA mock / focused tests

必ず確認するファイル・概念:
- patientget / patientmod ledger 記録
- acceptlst / acceptmod ledger 記録
- diseaseget / diseasev3 ledger 記録
- medicalmod / tmedicalget ledger 記録
- income / accounting / report 系 ledger 記録
- Round 1 の prescription authority / hash chain
- Round 2 の disease boundary / chart finalize snapshot
- `docs/architecture/orca-integration-safety-contract.md`
- `docs/operations/orca-unknown-state-runbook.md`

作業:
- patientget/patientmod、acceptlst/acceptmod、diseaseget/diseasev3、medicalmod/tmedicalget、income/accounting/report 系の ledger 記録状況を棚卸しする
- 全 ORCA operation に共通の operation id を付与する
- request payload hash、response payload hash を保存する
- Api_Result、warning、error、unmatch、unmatched、mismatch、reconciliation status を分類保存する
- actor、target patient、target chart revision、target prescription order、target encounter を紐づける
- raw 患者情報・ORCA 認証情報を log / DB / browser / bundle に出さない設計を再確認し、必要なら修正する
- ledger 未記録の ORCA call を CI / focused test で検出する
- central audit と ORCA operation ledger を相互参照できるようにする
- UNKNOWN を `NETWORK_FAILED`、`AUTH_FAILED`、`CERT_FAILED`、`BUSINESS_ERROR`、`WARNING_NEEDS_REVIEW`、`UNMATCHED`、`UNKNOWN` などへ分類する
- ORCA 送信成功、診療録確定、会計済みを別状態として保持する
- no uid、re-fetch 失敗、reconciliation 不成立を成功扱いしない
- idempotency key を operation 単位で固定する
- 同一候補の二重送信を防ぐ DB 制約または状態遷移 guard を追加する
- 再送可能条件 / 再送不可条件を定義する
- UNKNOWN 解消時の再取得・照合・手動確認フローを API 化する
- UNKNOWN 中は「ORCA反映済み」「会計済み」「登録済み」と返さない
- `docs/contracts/orca-ledger-and-unknown-state.md` を作成または更新する
- `docs/operations/orca-unknown-state-runbook.md` と `docs/testing/ehr-orca-required-test-matrix.md` を必要に応じて更新する

担当 G との境界:
- E は server/API 状態名、ledger、idempotency、UNKNOWN 解消 API を所有する
- G は UI 表示と操作導線を所有する
- UI に必要な状態名・DTO は docs/contracts に明記し、G が追従できるようにする

misuse case の最低例:
- 通信断で ORCA 反映有無が不明なのに「登録済み」扱いになる
- 同一 medical candidate を二重送信する
- ORCA warning/unmatch を成功扱いにして監査や UI から消す

最低検証:
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<追加または更新したTestClass> test`
- ORCA ledger required / UNKNOWN / idempotency / duplicate prevention / reconciliation focused tests
- secret / log 非露出に関わる focused test または scan
- docs 更新がある場合: `bash server-modernized/tools/ci/check-doc-links.sh`
- 可能なら: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`

完了条件:
- ORCA 連携が ledger に統一記録される
- request/response/warning/error/unmatch/reconciliation が監査で追跡できる
- UNKNOWN が成功扱いされない
- 再送・再取得・手動確認の状態遷移が監査に残る
- 同一 operation / candidate の二重送信が防止される
- ORCA 認証情報が DB、server log、browser log、bundle に露出しない
- 契約・operations・test matrix の必要更新が完了
- コミット済み
- heartbeat 解除済み
```

## 担当 G プロンプト

```text
【担当G: Web UI / DADS 医療安全 UI 基盤】

共通指示に従ってください。

この担当は作業量が大きく、主要画面、confirm flow、フォーム、UI test を跨ぐため、作業開始時に自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: DADS 医療安全 UI 基盤の実装、テスト、ドキュメント更新、再検証を完了まで継続する
- 完了条件: 担当範囲の実装、テスト、必要なドキュメント更新、最終報告が終わり、やる作業がなくなったら自分で heartbeat を解除する
- heartbeat 実行時は、未完了項目、直近の失敗、次に実行する検証を確認し、作業を継続する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-dads-medical-safety-ui`
- 推奨ブランチ: `codex/dads-medical-safety-ui-round3`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-dads-medical-safety-ui -b codex/dads-medical-safety-ui-round3 master`

目的:
患者取り違え防止、重大操作確認、警告見落とし防止、placeholder / disabled 依存排除を中心に Web UI を DADS 医療安全観点で是正してください。E が server/API 状態名を確定するまでは、UNKNOWN / ledger の server DTO 名を勝手に増やさず、既存状態または UI adapter に閉じてください。

主対象:
- `web-client/`
- `web-client/notes/`
- `docs/web-client/ux/`
- UI / accessibility / DADS tests

必ず確認するファイル・概念:
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `docs/web-client/ux/web-client-ui-guideline.md`
- `docs/web-client/ux/medical-safety-ui-rules.md`
- `web-client/notes/ui-current-contract.md`
- `web-client/notes/patient-context-contract.md`
- `web-client/notes/security-spec.md`
- chart / disease / prescription / ORCA send / accounting の主要画面
- confirm modal / action bar / patient header

作業:
- 患者ヘッダーが診療録、病名、処方、ORCA送信、会計送信の主要画面で常時表示されることを確認し、不足を修正する
- 重大操作モーダル内に患者番号、氏名、生年月日、性別、年齢、受付日、診療科、担当医、保険組合せを再掲する
- ORCA 警告、エラー、不一致、ORCA 側のみ情報、UNKNOWN、送信失敗を初期表示で見える位置に置く
- E の状態名確定前に server enum / DTO を独自拡張しない。必要な仮対応は UI adapter / view model に閉じ、マージ時の注意に明記する
- 重要な病名・処方・ORCA警告を details / accordion 初期非表示にしない
- `placeholder` に説明を依存している入力を洗い出し、ラベルまたはサポートテキストへ移す
- disabled ボタンを洗い出し、必要な場合は直近に理由と有効化条件を常時表示する
- 可能な箇所は disabled ではなく、押下後に具体的エラーを表示する設計へ変更する
- フォームには `※必須` / `※任意`、入力条件、具体例、エラーテキストを追加する
- 「失敗しました」だけの通知を、原因・影響・次に取る行動を含む文言へ変更する
- 処方確定、診療録確定、ORCA送信、診察終了、会計送信の confirm flow を統一する
- ボタン配置を「戻る/取消は左、進む/確定/送信は右」に統一する
- キーボード操作、focus trap、focus visible、押下領域44px以上をテストする
- DADS 違反を検出する静的検査または UI test を追加する
- `web-client/notes/ui-current-contract.md` と必要な UX docs を更新する

担当 E との境界:
- E は UNKNOWN / ledger / retry API の server contract を所有する
- G は既存 API と view model を使って UI 安全性を改善する
- E マージ後に追従が必要な状態名・表示分類は、マージ時の注意に具体的に残す

misuse case の最低例:
- 重大操作モーダルで患者識別情報が再掲されず、患者取り違えに気づけない
- ORCA warning / UNKNOWN が折りたたみ内に隠れ、成功したように見える
- disabled ボタンの理由が分からず、利用者が誤った迂回操作をする

最低検証:
- `cd web-client && npm run verify:web-guard`
- `cd web-client && npm run typecheck`
- `cd web-client && npm test -- --run <追加または更新したtest-file>`
- UI変更が広い場合: `cd web-client && npm run test:ci`
- 可能ならブラウザ目視または Playwright で主要画面の患者ヘッダー / confirm / warning 表示を確認する

完了条件:
- 患者識別情報が主要画面と重大操作時に必ず再確認できる
- ORCA 警告・不一致・UNKNOWN が隠れない UI 基盤がある
- placeholder 依存が0件または残件と理由が明記される
- disabled 理由未表示が0件または残件と理由が明記される
- UI test / static check が追加または更新済み
- web-client current contract の必要更新が完了
- コミット済み
- heartbeat 解除済み
```

## 担当 I プロンプト

```text
【担当I: 横断テスト・CI・セキュリティガード前倒し】

共通指示に従ってください。

この担当は Round 3 では最終 gate 全部ではなく、Round 1/2 までに確定した危険経路と、E/G が後で使う検査土台を前倒し整備します。
通常は automation / heartbeat を作成しなくて構いません。
ただし、作業が1時間を超える、または検証失敗の修正が複数ラウンドに分かれる場合は、自分の Codex スレッドに heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: 横断テスト・CI・セキュリティガードの実装、修正、再検証を完了まで継続する
- 完了条件: 担当範囲の実装、テスト、必要なドキュメント更新、最終報告が終わり、やる作業がなくなったら自分で heartbeat を解除する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-test-ci-security`
- 推奨ブランチ: `codex/test-ci-security-round3`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-test-ci-security -b codex/test-ci-security-round3 master`

目的:
Round 1/2 で固まった route authority、facility boundary、prescription taxonomy/hash chain、disease boundary、chart snapshot を横断的に守るテスト・CI・セキュリティガードを前倒しで整備してください。E/G の実装と衝突しないよう、server/API 状態名や UI 表示実装は所有しません。

主対象:
- `server-modernized/` の test / ci tool
- `web-client/` の guard / test
- `tests/`
- `scripts/`
- `docs/testing/`
- CI / route inventory / bundle secret scan

作業:
- 本番 public route 一覧の自動収集または既存 route inventory test を確認・強化する
- taxonomy 外 route を失敗扱いにする
- `karte/document` 書込系が存在しないことを確認する
- local 患者 CRUD が存在しない、または本番到達不能であることを確認する
- local 病名 CRUD が存在しない、または candidate として誤認されないことを確認する
- `/api/prescriptions` のような taxonomy 外 route が存在しないことを確認する
- Webクライアントが raw ORCA path へ到達できないことを確認する
- production bundle に ORCA URL / Basic認証文字列 / 証明書 / 証明書パスワード / secret が含まれない検査を追加または強化する
- 確定済み診療録直接更新禁止、確定済み処方直接上書き禁止、facility spoofing、snapshot immutable、disease boundary の既存 focused tests がCIで拾われることを確認する
- E/G が後で追加する UNKNOWN / DADS checks の hook になるテスト命名・実行入口を整理する
- `docs/testing/ehr-orca-required-test-matrix.md` を必要に応じて更新し、Round 3 時点のカバレッジと残件を明記する

担当 E/G との境界:
- I は横断 guard / test runner / CI entry を所有する
- E の ledger / UNKNOWN server 実装には直接手を入れない
- G の UI component 実装には直接手を入れない
- E/G が必要とする test hook や command entry は追加してよい

misuse case の最低例:
- taxonomy 外 route が追加されても CI が検出しない
- production bundle に ORCA 接続情報が混入しても検出しない
- Round 1/2 で閉じた旧 route / facility spoofing / local disease 誤認が回帰しても検出しない

最低検証:
- route inventory / public route guard focused test
- bundle secret scan focused command
- `cd web-client && npm run verify:web-guard`
- Web test を変更した場合: `cd web-client && npm test -- --run <test-file>`
- server test を変更した場合: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<追加または更新したTestClass> test`
- docs 更新がある場合: `bash server-modernized/tools/ci/check-doc-links.sh`

完了条件:
- Round 1/2 の危険経路回帰を検出する横断 guard がある
- production bundle secret scan が ORCA URL / Basic / cert / password / secret を検出できる
- E/G が追加検査を載せられる test / CI entry が整理済み
- test matrix の必要更新が完了
- コミット済み
- heartbeat を作成した場合は解除済み
```

## Round 3 マージ担当 Lead プロンプト

```text
【Lead: Round 3 マージ】

あなたは OpenDolphinNext 残タスク完遂計画の統括・Round 3 マージ担当です。
最終返答は必ず日本語で、【ワーカー報告】ヘッダーを使ってください。

Round 3 のマージ宛先は必ず `master` です。
別の統合ブランチを最終宛先にしないでください。

このマージ作業は、E/G/I の完了報告を確認して順に統合する作業です。通常は automation / heartbeat は不要です。
ただし、コンフリクト解消または検証が1時間を超える場合は、自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: E/G/I の `master` へのマージ、コンフリクト解消、横断検証、Round 3 報告まで継続する
- 完了条件: E/G/I の `master` へのマージ、必要な統合修正、横断検証、報告が終わり、やる作業がなくなったら自分で heartbeat を解除する

作業開始直後に必ず実行してください。
- `date -u +%Y%m%dT%H%M%SZ`
- `git status --short`
- `git branch --show-current`
- 現在ブランチが `master` であることを確認する

読む正本:
- AGENTS.md
- docs/implementation/opendolphin-next-remaining-tasks-20260513T113016Z/README.md
- docs/implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND3.md
- docs/README.md
- docs/managerdocs/README.md
- docs/architecture/ehr-orca-source-of-truth-boundary.md
- docs/architecture/ehr-chart-prescription-authority.md
- docs/architecture/orca-integration-safety-contract.md
- docs/testing/ehr-orca-required-test-matrix.md
- docs/contracts/orca-route-taxonomy.md

マージ対象:
1. E: `codex/orca-ledger-unknown-round3`
2. G: `codex/dads-medical-safety-ui-round3`
3. I: `codex/test-ci-security-round3`

マージ順:
1. E を `master` にマージする
2. G を `master` にマージする
3. I を `master` にマージする

理由:
- E が server/API の UNKNOWN / ledger / retry contract を確定する
- G が E の状態名・DTO に追従して UI 表示を整合させる
- I が最後に route / bundle / UI / server guard の横断検査入口を整える

進め方:
- 各担当の【ワーカー報告】を確認し、RUN_ID、worktree、branch、base、merge target、変更ファイル、検証結果、未実行コマンド、残リスクを読む
- E/G は heartbeat 解除済みであることを確認する
- I が heartbeat を作成した場合は解除済みであることを確認する
- 各担当ブランチで未コミット差分がないことを確認する
- `master` がクリーンであることを確認する
- E/G/I の順で `master` にマージする
- E と G の UNKNOWN / warning / unmatch 表示名、DTO、UI adapter の衝突を重点確認する
- I の route inventory / bundle scan が E/G 変更後の最終状態を見ていることを確認する

最低検証:
- E/G/I が追加した focused tests
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<E/I関連TestClass> test`
- `cd web-client && npm run verify:web-guard && npm run typecheck`
- UI test を変更した場合: `cd web-client && npm test -- --run <test-file>`
- docs 更新がある場合: `bash server-modernized/tools/ci/check-doc-links.sh`
- 可能なら: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
- 可能なら: `cd web-client && npm run test:ci`

Round 3 マージ完了条件:
- E/G/I の変更が `master` に統合済み
- ORCA ledger / UNKNOWN / retry / idempotency contract が server と docs で一致している
- UNKNOWN / warning / unmatch が UI で成功扱い・初期非表示になっていない
- route inventory / bundle secret scan / Round 1/2 回帰 guard が通る
- ORCA 認証情報、患者情報、内部 URL がログ・browser bundle・報告に露出していない
- 統合後の検証結果が報告済み
- heartbeat を作成した場合は解除済み

報告形式:
【ワーカー報告】
- RUN_ID:
- branch:
- merge target:
- マージした担当:
- マージ順:
- コンフリクトと解消内容:
- 統合後の変更ファイル:
- 検証結果:
- 未実行コマンドと理由:
- 医療安全・セキュリティ確認:
- 残リスク:
- Round 4 開始前の注意:
- automation / heartbeat 使用状況:
```
