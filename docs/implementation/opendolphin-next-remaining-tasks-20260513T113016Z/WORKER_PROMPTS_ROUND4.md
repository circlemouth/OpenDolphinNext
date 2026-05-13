# OpenDolphinNext 残タスク完遂 Round 4 ワーカープロンプト

RUN_ID: `20260513T144029Z`

この文書は [README.md](./README.md) の作業計画と Round 1/2/3 マージ完了後の `master` を前提に、次の並列作業者へ渡すプロンプト集です。

## Round 4 の担当者数

Round 4 は **3名** にします。

- H: 診療録・処方・ORCA履歴の見読性 / export / 会計cache境界
- J: backup / restore / 障害運用 / ORCA live validation runbook
- I2: 最終ゲート・release validation・横断検証の仕上げ

H は E の ledger / UNKNOWN と B の snapshot を前提に export / readability を仕上げます。J は H の export 方針を参照しますが、runbook と validation 計画は並列に進められます。I2 は H/J の最終成果を最後に取り込むため、実装は並列で準備し、Lead マージ時は H → J → I2 の順にします。

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
- docs/contracts/orca-ledger-and-unknown-state.md

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
- export / PDF / CSV / JSON / validation evidence に秘密情報、実在患者情報、ORCA認証情報を含めない
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

## 担当 H プロンプト

```text
【担当H: 見読性 / export / 会計cache境界】

共通指示に従ってください。

この担当は作業量が大きく、PDF/print/export、ORCA ledger 要約、会計cache境界、テスト、docs を跨ぐため、作業開始時に自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: export / readability / accounting cache boundary の実装、テスト、ドキュメント更新、再検証を完了まで継続する
- 完了条件: 担当範囲の実装、テスト、必要なドキュメント更新、最終報告が終わり、やる作業がなくなったら自分で heartbeat を解除する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-readability-export-backup`
- 推奨ブランチ: `codex/readability-export-round4`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-readability-export-backup -b codex/readability-export-round4 master`

目的:
診療録・処方・ORCA連携履歴の見読性と export を完成させ、会計・収納・領収・帳票・レセプト関連は ORCA 正本由来の cache / snapshot / log として境界を明確化してください。export に秘密情報や ORCA 認証情報を含めないことが最重要です。

主対象:
- `server-modernized/`
- `domain/`
- `api-contract/`
- `reporting/`
- `web-client/`
- `docs/contracts/`
- `docs/runbooks/`
- export / PDF / print / accounting cache focused tests

作業:
- 現行 PDF / print / export endpoint を棚卸しする
- 患者単位 export に診療録本文、SOAP、所見、説明内容、添付文書を含める
- 診療日単位 export に当日の診療録、処方、ORCA送信候補、ORCAレスポンス、警告、不一致を含める
- 期間単位 export に訂正、追記、取消、無効化履歴を含める
- 処方指示の変更、中止、取消、再発行、再送信履歴を出力対象に含める
- ORCA operation ledger の要約を診療録 export に含める
- ORCA由来 cache と OpenDolphinNext 正本を見出し・ラベルで明確に分離する
- PDF/print で患者識別情報、診療日、ORCA受付ID、診療科、担当医、保険組合せを表示する
- export JSON には機械可読な snapshot、event、audit id を含める
- export CSV は監査・移行用として項目定義を文書化する
- export 対象に秘密情報、ORCA認証情報、証明書情報が含まれないことをテストする
- income/accounting/report/receipt 系の現行テーブル・APIを棚卸しする
- ORCA由来 cache に `sourceSystem`, `sourceApi`, `fetchedAt`, `acceptanceId`, `visitDate`, `department`, `insuranceCombination` を含める
- OpenDolphinNext 側では会計・収納・領収・レセプトを独立正本化しない
- ORCA会計済み情報を未送信候補で上書き・取消しない guard を追加する
- 会計情報表示 UI に ORCA由来・取得日時・受付ID を明示する
- ORCA側のみ存在する会計済み情報を warning として表示する
- `docs/contracts/export-readability.md` と `docs/contracts/accounting-cache-boundary.md` を作成または更新する
- `docs/runbooks/backup-restore-hash-verification.md` へ J が参照できる export / hash verification 前提を追記する

misuse case の最低例:
- export に ORCA Basic 認証、証明書情報、内部URL、raw secret が混入する
- ORCA由来会計情報を OpenDolphinNext 正本として上書き・取消できる
- 診療録 PDF/print で患者識別情報や確定時 snapshot が不足し、見読性・説明可能性を満たさない

最低検証:
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<追加または更新したTestClass> test`
- export security / PDF readability / accounting cache boundary focused tests
- Web変更がある場合: `cd web-client && npm run verify:web-guard && npm run typecheck`
- docs 更新がある場合: `bash server-modernized/tools/ci/check-doc-links.sh`
- 可能なら: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`

完了条件:
- 患者単位、診療日単位、期間単位で診療録・処方・ORCA連携履歴を出力できる
- PDF/printで診療録の見読性が確保される
- ORCA由来cacheと診療録正本が混同されない
- 会計・収納・領収・帳票・レセプト情報が ORCA 正本由来の cache / snapshot / log として扱われる
- export security test が通る
- 契約・runbook の必要更新が完了
- コミット済み
- heartbeat 解除済み
```

## 担当 J プロンプト

```text
【担当J: backup / restore / 障害運用 / ORCA validation runbook】

共通指示に従ってください。

この担当は主にドキュメント・運用手順ですが範囲が広いため、作業が1時間を超える場合は自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: backup / restore / outage / ORCA validation runbook の作成、検証、再確認を完了まで継続する
- 完了条件: 担当範囲の docs / validation plan / checklist / 検証が終わり、やる作業がなくなったら自分で heartbeat を解除する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-orca-validation-runbook`
- 推奨ブランチ: `codex/orca-validation-runbook-round4`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-orca-validation-runbook -b codex/orca-validation-runbook-round4 master`

目的:
DB障害、ORCA障害、UNKNOWN発生、証明書・認証・通信障害、監査ログ保全、実ORCA検証を本番運用前に説明できる runbook / validation plan として整備してください。実ORCA接続情報や患者情報を raw に残さないことが最重要です。

主対象:
- `docs/runbooks/`
- `docs/operations/`
- `docs/validation/`
- `docs/testing/`
- `ops/`
- 必要に応じて thin runner / smoke docs

作業:
- DBバックアップ対象を定義する
- 診療録正本、処方正本、chart snapshot、prescription event、audit event、ORCA ledger を必須対象にする
- ORCA由来 cache と OpenDolphinNext 正本の復元優先度を分ける
- 復元手順を runbook 化する
- 復元後に hash chain を検証する手順を定義する
- ORCA停止時の診療録確定可否、処方指示、ORCA送信候補、会計待ちの扱いを定義する
- UNKNOWN発生時の担当者、確認期限、再送/手動照合手順を定義する
- 証明書期限切れ、認証失敗、通信断、他端末使用中の一次対応を定義する
- 監査ログの閲覧権限、保存期間、外部保全方針を定義する
- backup/restore rehearsal のチェックリストを作成する
- ORCA trial / 検証環境の接続情報は secret 管理から供給する前提を明記する
- patientgetv2、patientmodv2、acceptlst/acceptmod、diseasegetv2、diseasev3、medicalmodv2、tmedicalgetv2、income/accounting 系の live validation 計画を作る
- 通信断、認証失敗、証明書異常、他端末使用中、UNKNOWN解消フローの検証計画を作る
- 実試験ログに実在患者情報・秘密値を残さない sanitize ルールを明記する
- `docs/runbooks/backup-restore.md`、`docs/runbooks/orca-outage.md`、`docs/runbooks/orca-unknown-resolution.md`、`docs/validation/orca-live-validation.md` を作成または更新する

misuse case の最低例:
- 復元後に chart / prescription hash chain を検証せず、改ざんに気づけない
- ORCA停止時や UNKNOWN 中に会計済み・登録済みとして運用してしまう
- live validation evidence に ORCA Basic 認証や実在患者情報を残す

最低検証:
- `bash server-modernized/tools/ci/check-doc-links.sh`
- `bash server-modernized/tools/ci/check-config-contract.sh` が関連する場合は実行
- runbook 内のコマンドが既存 script / docs と矛盾していないことを `rg` で確認
- 可能なら ORCA smoke / runtime ready smoke の dry-run 手順だけ確認し、raw secret を出さない

完了条件:
- backup/restore runbook が存在する
- ORCA障害・DB障害・UNKNOWN発生時の業務継続手順が存在する
- 復元後の監査ログ・hash chain検証手順が存在する
- 実ORCA検証計画と sanitize ルールが存在する
- 本番前リハーサル項目が定義されている
- コミット済み
- heartbeat を作成した場合は解除済み
```

## 担当 I2 プロンプト

```text
【担当I2: 最終ゲート / release validation / 横断検証仕上げ】

共通指示に従ってください。

この担当は Round 4 では最終 release gate の検査入口と validation report 雛形を仕上げます。通常は automation / heartbeat を作成しなくて構いません。
ただし、作業が1時間を超える、または検証失敗の修正が複数ラウンドに分かれる場合は、自分の Codex スレッドに heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: final gate / release validation / 横断検証の整備、修正、再検証を完了まで継続する
- 完了条件: 担当範囲の実装、docs、検証、最終報告が終わり、やる作業がなくなったら自分で heartbeat を解除する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-final-gate`
- 推奨ブランチ: `codex/final-gate-round4`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-final-gate -b codex/final-gate-round4 master`

目的:
Round 1-4 の成果を release validation に載せるため、route inventory、secret scan、DADS検査、export security、ORCA ledger / UNKNOWN、backup/restore / live validation の検査入口と報告テンプレートを仕上げてください。H/J の成果を直接先取りせず、最後に Lead が統合後に通せる形へ整えます。

主対象:
- `docs/runbooks/release-validation.md`
- `docs/testing/ehr-orca-required-test-matrix.md`
- `docs/validation/`
- `scripts/`
- `tests/`
- `web-client/`
- `server-modernized/` test / ci tool

作業:
- Round 1-3 の route inventory / bundle secret scan / DADS / ledger / UNKNOWN / snapshot / disease / prescription hash chain の検査入口を確認する
- H の export security / readability test を組み込める validation entry を用意する
- J の backup/restore / ORCA live validation runbook を参照する release validation checklist を用意する
- `docs/validation/release-validation-report.md` を作成または更新し、GO / NO-GO / PENDING、未実行理由、残リスクを記録できる形にする
- `docs/runbooks/release-validation.md` を更新し、最終 gate の順序を明確化する
- web-client / server-modernized / docs / security scan の標準コマンドを現行 repo と整合させる
- release gate が raw ORCA secret、患者情報、内部URLを出力しないことを確認する
- H/J マージ後に Lead が追加確認すべき項目を「Round 4 マージ時の注意」として報告する

misuse case の最低例:
- release validation が export secret 漏えいを検査しない
- live ORCA evidence の sanitize 漏れを gate で検出しない
- route / DADS / UNKNOWN / hash chain の focused tests が存在しても final gate で実行されない

最低検証:
- `bash server-modernized/tools/ci/check-doc-links.sh`
- `cd web-client && npm run verify:web-guard`
- 可能なら `cd web-client && npm run typecheck`
- route inventory / bundle secret scan focused command
- 変更した validation script / runner の dry-run

完了条件:
- release validation report の雛形または現行版が存在する
- final gate の順序と標準コマンドが current repo と一致している
- H/J の成果を統合後に検査できる entry がある
- secret / patient info / internal URL 非露出の確認項目がある
- コミット済み
- heartbeat を作成した場合は解除済み
```

## Round 4 マージ担当 Lead プロンプト

```text
【Lead: Round 4 マージ】

あなたは OpenDolphinNext 残タスク完遂計画の統括・Round 4 マージ担当です。
最終返答は必ず日本語で、【ワーカー報告】ヘッダーを使ってください。

Round 4 のマージ宛先は必ず `master` です。
別の統合ブランチを最終宛先にしないでください。

このマージ作業は、H/J/I2 の完了報告を確認して順に統合する作業です。通常は automation / heartbeat は不要です。
ただし、コンフリクト解消または検証が1時間を超える場合は、自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: H/J/I2 の `master` へのマージ、コンフリクト解消、横断検証、Round 4 報告まで継続する
- 完了条件: H/J/I2 の `master` へのマージ、必要な統合修正、横断検証、報告が終わり、やる作業がなくなったら自分で heartbeat を解除する

作業開始直後に必ず実行してください。
- `date -u +%Y%m%dT%H%M%SZ`
- `git status --short`
- `git branch --show-current`
- 現在ブランチが `master` であることを確認する

読む正本:
- AGENTS.md
- docs/implementation/opendolphin-next-remaining-tasks-20260513T113016Z/README.md
- docs/implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND4.md
- docs/README.md
- docs/managerdocs/README.md
- docs/runbooks/release-validation.md
- docs/architecture/ehr-orca-source-of-truth-boundary.md
- docs/architecture/ehr-chart-prescription-authority.md
- docs/architecture/orca-integration-safety-contract.md
- docs/testing/ehr-orca-required-test-matrix.md

マージ対象:
1. H: `codex/readability-export-round4`
2. J: `codex/orca-validation-runbook-round4`
3. I2: `codex/final-gate-round4`

マージ順:
1. H を `master` にマージする
2. J を `master` にマージする
3. I2 を `master` にマージする

理由:
- H が export / readability / accounting cache boundary を確定する
- J が H の export / restore 前提を参照して runbook / validation を整合させる
- I2 が最後に final gate / release validation を最終状態へ合わせる

進め方:
- 各担当の【ワーカー報告】を確認し、RUN_ID、worktree、branch、base、merge target、変更ファイル、検証結果、未実行コマンド、残リスクを読む
- H は heartbeat 解除済みであることを確認する
- J/I2 が heartbeat を作成した場合は解除済みであることを確認する
- 各担当ブランチで未コミット差分がないことを確認する
- `master` がクリーンであることを確認する
- H/J/I2 の順で `master` にマージする
- docs/runbooks、docs/testing、docs/validation、export contract の重複・矛盾を重点確認する
- export / validation evidence に secret / patient info / internal URL を残す経路がないことを確認する

最低検証:
- H/J/I2 が追加した focused tests / guards
- `bash server-modernized/tools/ci/check-doc-links.sh`
- `cd web-client && npm run verify:web-guard && npm run typecheck`
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<H/I2関連TestClass> test` を可能な範囲で実行
- route inventory / bundle secret scan focused command
- 可能なら `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
- 可能なら `cd web-client && npm run test:ci`

Round 4 マージ完了条件:
- H/J/I2 の変更が `master` に統合済み
- export / PDF / print の見読性と secret 非露出が検証済み
- 会計・収納・領収・帳票・レセプト情報が ORCA 正本由来の cache / snapshot / log として扱われる
- backup/restore、ORCA outage、UNKNOWN resolution、live validation の runbook が整合している
- release validation report / final gate が最終状態に追従している
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
- 最終 closeout 前の注意:
- automation / heartbeat 使用状況:
```
