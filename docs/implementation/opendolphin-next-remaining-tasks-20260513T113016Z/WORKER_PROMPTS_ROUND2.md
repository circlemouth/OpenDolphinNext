# OpenDolphinNext 残タスク完遂 Round 2 ワーカープロンプト

RUN_ID: `20260513T124815Z`

この文書は [README.md](./README.md) の作業計画と Round 1 の A/C/D マージ完了後の `master` を前提に、次の並列作業者へ渡すプロンプト集です。

## Round 2 の担当者数

Round 2 は **2名** に限定します。

- F: 病名 local 候補と ORCA 正本病名の分離
- B: 診療録確定時の完全 ORCA snapshot

E は B/F の識別子、snapshot、病名分類、処方 authority 状態を参照するため Round 2 では開始しません。G/H/I/J も API 状態名、UNKNOWN 分類、snapshot/ledger 仕様の確定後に開始します。

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
- `git fetch --all --prune` は必要な場合のみ実行する
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

## 担当 F プロンプト

```text
【担当F: 病名境界・local候補整理】

共通指示に従ってください。

この担当は作業量が中規模なので、通常は automation / heartbeat を作成しなくて構いません。
ただし、作業が1時間を超える、または検証失敗の修正が複数ラウンドに分かれる場合は、自分の Codex スレッドに heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: 担当タスクが完了するまで、実装・テスト・修正・再検証を継続する
- 完了条件: 担当範囲の実装、テスト、必要なドキュメント更新、最終報告が終わり、やる作業がなくなったら自分で heartbeat を解除する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-disease-boundary`
- 推奨ブランチ: `codex/disease-boundary-round2`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-disease-boundary -b codex/disease-boundary-round2 master`

目的:
local 病名候補と ORCA 正本病名を明確に分離してください。local 候補を ORCA 登録済み病名に見せないこと、ORCA 側のみ病名・warning・unmatch を UI と監査上で誤認させないことが最重要です。

主対象:
- `server-modernized/`
- `api-contract/`
- `web-client/`
- `web-client/notes/`
- `docs/contracts/`
- disease focused tests / UI tests

必ず確認するファイル・概念:
- `LocalDiagnosisResource`
- `DiagnosisEditPanel`
- `httpClient.ts`
- diseasegetv2 / diseasev3 の API wrapper / DTO
- `web-client/notes/disease-insurance-orca-contract.md`
- `docs/contracts/orca-route-taxonomy.md`
- `docs/architecture/ehr-orca-source-of-truth-boundary.md`

作業:
- `LocalDiagnosisResource` の `pendingLocalDiseases` を棚卸しする
- `pendingLocalDiseases` を `candidate` または `draftCandidate` として再定義する
- local 候補は `readOnly=false` ではなく、ORCA 未登録・送信候補であることを明示する
- `httpClient.ts` metadata から local diagnosis CRUD と誤読される表現を削除する
- metadata を `official diseasegetv2`、`official diseasev3`、`local candidate` の3分類に整理する
- `DiagnosisEditPanel` で ORCA 登録病名、ORCA 側のみ病名、送信候補、自由記述病名を視覚的に分離する
- ORCA 送信失敗時に local 候補を登録済み表示しない
- ORCA 側のみ病名、warning、unmatch の表示テストを拡充する
- 病名自由記述は診療録本文正本であり、ORCA 病名正本ではないことを UI 文言または補助説明に残す
- `docs/contracts/disease-boundary.md` を作成または更新する
- `web-client/notes/disease-insurance-orca-contract.md` を必要に応じて更新する

misuse case の最低例:
- local 候補を ORCA 登録済み病名として表示してしまう
- diseasev3 失敗後も UI が「登録済み」扱いになる
- ORCA 側のみ存在する病名を local 候補で上書き・隠蔽してしまう

最低検証:
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<追加または更新したTestClass> test`
- Web変更がある場合: `cd web-client && npm run verify:web-guard && npm run typecheck`
- 対象 UI test がある場合: `cd web-client && npm test -- --run <test-file>`
- doc/config 影響がある場合: `bash server-modernized/tools/ci/check-doc-links.sh`

完了条件:
- local 病名候補が ORCA 登録済み病名に見えない
- local 病名 CRUD を示す metadata が消える
- `diseasegetv2?class=01` 取得病名と `diseasev3` 更新結果が ORCA 正本として扱われる
- 警告・不一致・ORCA 側のみ病名の UI / 監査テストが通る
- 契約ドキュメントが更新済み
- コミット済み
- heartbeat を作成した場合は解除済み
```

## 担当 B プロンプト

```text
【担当B: 診療録確定時の完全ORCA snapshot】

共通指示に従ってください。

この担当は作業量が大きく、schema/API/test/docs を跨ぐため、作業開始時に自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: 診療録確定 snapshot の設計、実装、テスト、ドキュメント更新、再検証を完了まで継続する
- 完了条件: 担当範囲の実装、テスト、必要なドキュメント更新、最終報告が終わり、やる作業がなくなったら自分で heartbeat を解除する
- heartbeat 実行時は、未完了項目、直近の失敗、次に実行する検証を確認し、作業を継続する

専用 worktree:
- 推奨パス: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-chart-orca-snapshot`
- 推奨ブランチ: `codex/chart-orca-snapshot-round2`
- 作成例: `git worktree add /Users/Hayato/Documents/GitHub/OpenDolphin_WebClient-wt-chart-orca-snapshot -b codex/chart-orca-snapshot-round2 master`

目的:
診療録確定時に、当時参照した ORCA 患者、受付、保険、公費、保険組合せ、病名、処方指示、ORCA 送信候補、算定候補、warning/unmatch/ORCA 側のみ情報を説明可能な snapshot として保存してください。確定済み snapshot は後日 ORCA 側情報が変わっても上書きしないことが最重要です。

主対象:
- `server-modernized/`
- `domain/`
- `api-contract/`
- `persistence/`
- `docs/contracts/`
- `docs/architecture/`
- chart finalize focused tests

必ず確認するファイル・概念:
- `ChartRevisionFinalizeService`
- `chart_revision`
- chart snapshot schema / DTO
- patient snapshot status
- acceptance / insurance / disease / prescription / medical candidate 取得経路
- ORCA warning / unmatch / mismatch 分類
- Round 1 で統合済みの chart authority 変更
- 担当Fの disease boundary 変更予定と衝突しやすい DTO / 用語

作業:
- `ChartRevisionFinalizeService` の現行 snapshot 項目を棚卸しする
- `patientSnapshotStatus=IDENTIFIER_ONLY` を廃止する方針で schema / API を整理する
- 確定時に ORCA 患者基本情報 snapshot を保存する
- 確定時に ORCA 受付 snapshot を保存する
- 確定時に ORCA 保険・公費・保険組合せ snapshot を保存する
- 確定時に ORCA 病名 snapshot を保存する
- 確定時に処方指示 snapshot を保存する
- 確定時に ORCA 送信候補、算定候補、medical candidate snapshot を保存する
- 確定時に ORCA 警告、不一致、ORCA 側のみ存在する情報の要約 snapshot を保存する
- snapshot には `sourceSystem`, `sourceApi`, `fetchedAt`, `orcaPatientId`, `acceptanceId`, `visitDate`, `department`, `physician`, `insuranceCombination` を含める
- ORCA 取得不能時の扱いを `NO_ACCEPTANCE_REASON` とは別に定義する
- snapshot 欠落時に確定を許す条件を API 上で明確化する
- snapshot 完全性テストを追加する
- 確定済み診療録 snapshot が後日 ORCA 変更で上書きされないテストを追加する
- 既存の `PENDING_WORKER_INTEGRATION` 表示・状態を削除または本番禁止にする
- `docs/contracts/chart-finalize-snapshot.md` を作成または更新する
- `docs/architecture/ehr-chart-prescription-authority.md` と `docs/testing/ehr-orca-required-test-matrix.md` を必要に応じて更新する

misuse case の最低例:
- ORCA 患者IDだけ保存し、確定時点の患者・保険・受付情報を後から説明できない
- ORCA 取得不能や UNKNOWN を成功扱いにして完全 snapshot があるように見せる
- 確定済み診療録の snapshot が後日 re-fetch で上書きされる

最低検証:
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<追加または更新したTestClass> test`
- chart finalize snapshot completeness / missing snapshot / immutable snapshot focused tests
- doc/config 影響がある場合: `bash server-modernized/tools/ci/check-doc-links.sh`
- 可能なら: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`

完了条件:
- 診療録確定時に完全 snapshot が保存される
- 確定済み診療録から、当時参照した患者・受付・保険・病名・処方候補・算定候補を再現できる
- ORCA 側情報が後日変更されても、確定済み診療録 snapshot は上書きされない
- snapshot 完全性テストが通る
- 契約・architecture・test matrix の必要更新が完了
- コミット済み
- heartbeat 解除済み
```

## Round 2 マージ担当 Lead プロンプト

```text
【Lead: Round 2 マージ】

あなたは OpenDolphinNext 残タスク完遂計画の統括・Round 2 マージ担当です。
最終返答は必ず日本語で、【ワーカー報告】ヘッダーを使ってください。

Round 2 のマージ宛先は必ず `master` です。
別の統合ブランチを最終宛先にしないでください。

このマージ作業は、F/B の完了報告を確認して順に統合する作業です。通常は automation / heartbeat は不要です。
ただし、コンフリクト解消または検証が1時間を超える場合は、自分の Codex スレッドで heartbeat を作成してください。
- 種別: 現在のスレッドに紐づく heartbeat
- 間隔: 30分ごと
- 目的: F/B のマージ、コンフリクト解消、横断検証、Round 2 報告まで継続する
- 完了条件: F/B の `master` へのマージ、必要な統合修正、横断検証、報告が終わり、やる作業がなくなったら自分で heartbeat を解除する

作業開始直後に必ず実行してください。
- `date -u +%Y%m%dT%H%M%SZ`
- `git status --short`
- `git branch --show-current`
- 現在ブランチが `master` であることを確認する

読む正本:
- AGENTS.md
- docs/implementation/opendolphin-next-remaining-tasks-20260513T113016Z/README.md
- docs/implementation/opendolphin-next-remaining-tasks-20260513T113016Z/WORKER_PROMPTS_ROUND2.md
- docs/README.md
- docs/managerdocs/README.md
- docs/architecture/ehr-orca-source-of-truth-boundary.md
- docs/architecture/ehr-chart-prescription-authority.md
- docs/architecture/orca-integration-safety-contract.md
- docs/testing/ehr-orca-required-test-matrix.md
- docs/contracts/orca-route-taxonomy.md

マージ対象:
1. F: `codex/disease-boundary-round2`
2. B: `codex/chart-orca-snapshot-round2`

マージ順:
1. F を `master` にマージする
2. B を `master` にマージする

理由:
- B の snapshot は病名分類を含むため、F の terminology / DTO / UI 表示契約を先に取り込む
- B の snapshot schema が確定した後に E の ORCA ledger / UNKNOWN へ進む

進め方:
- 各担当の【ワーカー報告】を確認し、RUN_ID、worktree、branch、base、merge target、変更ファイル、検証結果、未実行コマンド、残リスクを読む
- 各担当ブランチで未コミット差分がないことを確認する
- 各担当が heartbeat を作成した場合は解除済みであることを確認する
- `master` がクリーンであることを確認する
- F/B の順で `master` にマージする
- disease DTO / chart snapshot DTO / docs 用語 / test fixture の衝突を重点確認する
- ORCA 正本病名、local candidate、chart snapshot 病名の意味が混線していないことを確認する
- snapshot が ORCA re-fetch で上書きされる経路がないことを確認する

最低検証:
- F/B が追加した focused Maven tests
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Dtest=<F/B関連TestClass> test`
- Web変更がある場合: `cd web-client && npm run verify:web-guard && npm run typecheck`
- 対象 UI test がある場合: `cd web-client && npm test -- --run <test-file>`
- docs 更新がある場合: `bash server-modernized/tools/ci/check-doc-links.sh`
- 可能なら: `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`

Round 2 マージ完了条件:
- F/B の変更が `master` に統合済み
- local 病名候補が ORCA 登録済み病名に見えない
- diagnosis metadata が official diseasegetv2 / official diseasev3 / local candidate に整理済み
- 診療録確定 snapshot が患者・受付・保険・病名・処方候補・算定候補・警告/不一致を保持する
- 確定済み snapshot が後日 ORCA 変更で上書きされない
- 契約ドキュメントと test matrix の必要更新が統合済み
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
- Round 3 開始前の注意:
- automation / heartbeat 使用状況:
```
