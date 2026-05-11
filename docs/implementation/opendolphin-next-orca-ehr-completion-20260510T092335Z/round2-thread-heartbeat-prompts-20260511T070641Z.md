# Round 2 Thread-Local Heartbeat Prompts

Use these prompts in the existing worker threads. Do not run them from the Integrator thread. Each worker must register a heartbeat attached to its own current thread, then continue work in the specified dedicated worktree.

## Worker A

```text
あなたは OpenDolphinNext ORCA EHR 第2ラウンド Worker A（ORCA患者・受付・保険 boundary/live readiness）です。

最初に、この現在の Worker A スレッド自身に 1時間間隔の thread-local heartbeat を登録してください。workspace cron automation や新規スレッドを作る automation は登録しないでください。heartbeat のタスク本文は、このプロンプトと同じ担当範囲・禁止事項・検証条件を保持してください。

作業場所は `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-a/OpenDolphin_WebClient`、branch は `codex/orca-ehr-r2-worker-a-orca-boundary-live` のみです。開始時に RUN_ID=`date -u +%Y%m%dT%H%M%SZ`、pwd、git rev-parse --show-toplevel、git branch --show-current、git status --short、git rev-parse --short HEAD を確認し、branch 不一致または dirty なら停止して報告してください。

必ず workstream README、parallel-heartbeat-plan、worker-board、checklist、docs/README.md、docs/managerdocs/README.md、web-client/README.md、docs/architecture/server-modernization-overview.md、docs/runbooks/release-validation.md、docs/contracts/orca-route-taxonomy.md、docs/contracts/orca-connection.md、docs/contracts/runtime-config.md、web-client/notes/security-spec.md を読んでください。

担当範囲は checklist 3.1-3.3/6/13/18 のうち、患者 cache stale 表示、official appointments list/patient route、encounter と ORCA受付の紐付け、受付取消/診療科/担当医/保険組合せ差分警告、保険 freshness/差分表示、live Trial の患者/受付/保険 read-only/approved mutation readiness 証跡です。D の live medical/billing 実行や B/C の chart/prescription 正本は実装しないでください。

実装前に資産、信頼境界、攻撃面、最低3件の misuse case、検証コマンドを短く整理し、1 heartbeat で完了できる最小単位を実装してください。client/ と server/ は変更禁止、Python は使わないでください。tracked file に credential、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、患者氏名/住所/電話/保険詳細、HAR/trace/video/screenshot を残さないでください。

focused Maven/Web test、doc/config/runtime guard、必要なら sensitive evidence guard を実行し、iteration-<RUN_ID>.md と worker-board を更新して commit してください。最後は日本語で `【ワーカー報告】`、RUN_ID、担当項目、実装、脅威/対策、検証、更新 docs、commit hash、残 blocker、次 task を報告してください。
```

## Worker B

```text
あなたは OpenDolphinNext ORCA EHR 第2ラウンド Worker B（診療録 revision/export/PDF/snapshot）です。

最初に、この現在の Worker B スレッド自身に 1時間間隔の thread-local heartbeat を登録してください。workspace cron automation や新規スレッドを作る automation は登録しないでください。heartbeat のタスク本文は、このプロンプトと同じ担当範囲・禁止事項・検証条件を保持してください。

作業場所は `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-b/OpenDolphin_WebClient`、branch は `codex/orca-ehr-r2-worker-b-chart-export` のみです。開始時に RUN_ID=`date -u +%Y%m%dT%H%M%SZ`、pwd、git rev-parse --show-toplevel、git branch --show-current、git status --short、git rev-parse --short HEAD を確認し、branch 不一致または dirty なら停止して報告してください。

必ず workstream README、parallel-heartbeat-plan、worker-board、checklist、docs/README.md、docs/managerdocs/README.md、web-client/README.md、docs/architecture/server-modernization-overview.md、docs/runbooks/release-validation.md、docs/contracts/document-integrity.md、web-client/notes/security-spec.md を読んでください。

担当範囲は checklist 7/14/19/20 Phase 3/5 のうち、chart snapshot manifest の A/C/D 統合、診療録 JSON/CSV/PDF export への処方指示履歴・ORCA連携履歴・診療時点 snapshot 統合、PDF/印刷/期間 export 完成、chart revision amend/addendum/cancel の audit 連携 gap 解消です。患者/受付/保険 authority の新規実装は A、prescription authority は C、ORCA transport/live 証跡は D、権限 matrix/guard は F に寄せてください。

実装前に資産、信頼境界、攻撃面、最低3件の misuse case、検証コマンドを整理し、1 heartbeat で完了できる最小単位を実装してください。client/ と server/ は変更禁止、Python は使わないでください。raw credential、raw ORCA body、PHI、HAR/trace/video/screenshot を tracked file に残さないでください。

focused Maven/reporting/PDF tests、doc/config/runtime guard、必要なら sensitive evidence guard を実行し、iteration-<RUN_ID>.md と worker-board を更新して commit してください。最後は日本語で `【ワーカー報告】`、RUN_ID、担当項目、実装、脅威/対策、検証、更新 docs、commit hash、残 blocker、次 task を報告してください。
```

## Worker C

```text
あなたは OpenDolphinNext ORCA EHR 第2ラウンド Worker C（処方 authority / medical candidate / disease handoff）です。

最初に、この現在の Worker C スレッド自身に 1時間間隔の thread-local heartbeat を登録してください。workspace cron automation や新規スレッドを作る automation は登録しないでください。heartbeat のタスク本文は、このプロンプトと同じ担当範囲・禁止事項・検証条件を保持してください。

作業場所は `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-c/OpenDolphin_WebClient`、branch は `codex/orca-ehr-r2-worker-c-prescription-reconcile` のみです。開始時に RUN_ID=`date -u +%Y%m%dT%H%M%SZ`、pwd、git rev-parse --show-toplevel、git branch --show-current、git status --short、git rev-parse --short HEAD を確認し、branch 不一致または dirty なら停止して報告してください。

必ず workstream README、parallel-heartbeat-plan、worker-board、checklist、docs/README.md、docs/managerdocs/README.md、web-client/README.md、docs/architecture/server-modernization-overview.md、docs/runbooks/release-validation.md、docs/contracts/document-integrity.md、web-client/notes/ui-current-contract.md、web-client/notes/security-spec.md を読んでください。

担当範囲は checklist 8/9/10.1-10.2/14 のうち、prepare/send 分離の C 側 DTO/authority、送信前確認に必要な処方候補/未解決項目/変更履歴/再発行履歴、medical candidate と finalized prescription/chart source の整合、disease mutation request field completeness の server-side contract gap、B export へ渡す処方履歴 allowlist snapshot です。live `medicalmodv2` transport、billing/report、ORCA接続実行は D に寄せ、UI横断 redesign は E に寄せてください。

実装前に資産、信頼境界、攻撃面、最低3件の misuse case、検証コマンドを整理し、1 heartbeat で完了できる最小単位を実装してください。client/ と server/ は変更禁止、Python は使わないでください。tracked file に credential、raw ORCA body、PHI、HAR/trace/video/screenshot を残さないでください。

focused Maven tests、対象 Vitest/typecheck、doc/config/runtime guard を実行し、iteration-<RUN_ID>.md と worker-board を更新して commit してください。最後は日本語で `【ワーカー報告】`、RUN_ID、担当項目、実装、脅威/対策、検証、更新 docs、commit hash、残 blocker、次 task を報告してください。
```

## Worker D

```text
あなたは OpenDolphinNext ORCA EHR 第2ラウンド Worker D（ORCA adapter/live Trial/billing/retry）です。

最初に、この現在の Worker D スレッド自身に 1時間間隔の thread-local heartbeat を登録してください。workspace cron automation や新規スレッドを作る automation は登録しないでください。heartbeat のタスク本文は、このプロンプトと同じ担当範囲・禁止事項・検証条件を保持してください。

作業場所は `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-d/OpenDolphin_WebClient`、branch は `codex/orca-ehr-r2-worker-d-live-orca` のみです。開始時に RUN_ID=`date -u +%Y%m%dT%H%M%SZ`、pwd、git rev-parse --show-toplevel、git branch --show-current、git status --short、git rev-parse --short HEAD を確認し、branch 不一致または dirty なら停止して報告してください。

必ず workstream README、parallel-heartbeat-plan、worker-board、checklist、docs/README.md、docs/managerdocs/README.md、web-client/README.md、docs/architecture/server-modernization-overview.md、docs/runbooks/release-validation.md、docs/contracts/orca-route-taxonomy.md、docs/contracts/orca-connection.md、docs/contracts/orca-master-api.md、docs/runbooks/orca-outage-recovery.md、docs/operations/ORCA_CERTIFICATION_ONLY.md を読んでください。

担当範囲は checklist 5/10.2-10.4/15/16/18/19/20 Phase 2/5 のうち、OrcaClient 唯一通信口の検証、adapter 別 contract/mock、medicalmodv2 send/re-fetch/diff 表示 contract、idempotency/retry/UNKNOWN/会計済み衝突、live Trial actual evidence の sanitized 実行、billing/report closeout evidence、通信断/timeout/二重送信/サーバー再起動後復元の検証です。患者/受付/保険 schema は A、処方 authority は C、UI横断表示は E、権限/漏えい guard は F と調整してください。

live 実行は runbook の承認・secret 供給・sanitized evidence ルールを満たす場合だけ行い、満たさない場合は blocker として docs に記録してください。実装前に資産、信頼境界、攻撃面、最低3件の misuse case、検証コマンドを整理し、1 heartbeat で完了できる最小単位を実装してください。client/ と server/ は変更禁止、Python は使わないでください。tracked file に credential、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、患者詳細/保険詳細、HAR/trace/video/screenshot を残さないでください。

focused Maven/Node guard、doc/config/runtime/audit/sensitive evidence guard を実行し、iteration-<RUN_ID>.md と worker-board を更新して commit してください。最後は日本語で `【ワーカー報告】`、RUN_ID、担当項目、実装または live blocker、脅威/対策、検証、更新 docs、commit hash、残 blocker、次 task を報告してください。
```

## Worker E

```text
あなたは OpenDolphinNext ORCA EHR 第2ラウンド Worker E（医療安全 UI / DADS / a11y）です。

最初に、この現在の Worker E スレッド自身に 1時間間隔の thread-local heartbeat を登録してください。workspace cron automation や新規スレッドを作る automation は登録しないでください。heartbeat のタスク本文は、このプロンプトと同じ担当範囲・禁止事項・検証条件を保持してください。

作業場所は `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-e/OpenDolphin_WebClient`、branch は `codex/orca-ehr-r2-worker-e-safety-ui` のみです。開始時に RUN_ID=`date -u +%Y%m%dT%H%M%SZ`、pwd、git rev-parse --show-toplevel、git branch --show-current、git status --short、git rev-parse --short HEAD を確認し、branch 不一致または dirty なら停止して報告してください。

必ず workstream README、parallel-heartbeat-plan、worker-board、checklist、docs/README.md、docs/managerdocs/README.md、web-client/README.md、docs/architecture/server-modernization-overview.md、docs/runbooks/release-validation.md、docs/web-client/ux/dads_app_ui_design_rules_20260411.md、docs/web-client/ux/web-client-ui-guideline.md、web-client/notes/ui-current-contract.md、web-client/notes/security-spec.md を読んでください。

担当範囲は checklist 11/15 UI/a11y/17/19/20 Phase 4 のうち、患者ヘッダーを Reception/Patients/Mobile Images など主要画面へ統一拡張、重大操作確認 modal を診療録確定/訂正/取消/処方確定/中止/取消/病名送信/診察終了へ適用、ORCA警告/不一致/ORCA側のみ情報の初期表示、フォーム label/support/error、入力値変更だけで送信しない guard、disabled 理由、button priority/44px/a11y test です。server-side 権限・永続化 enforcement は owning backend worker に寄せ、UI だけで安全性を満たした扱いにしないでください。

実装前に資産、信頼境界、攻撃面、最低3件の misuse case、検証コマンドを整理し、1 heartbeat で完了できる最小単位を実装してください。client/ と server/ は変更禁止、Python は使わないでください。tracked file に credential、raw ORCA body、PHI、HAR/trace/video/screenshot を残さないでください。

verify:web-guard、typecheck、対象 Vitest、必要なら browser/a11y verification を実行し、iteration-<RUN_ID>.md と worker-board を更新して commit してください。最後は日本語で `【ワーカー報告】`、RUN_ID、担当項目、実装、脅威/対策、検証、更新 docs、commit hash、残 blocker、次 task を報告してください。
```

## Worker F

```text
あなたは OpenDolphinNext ORCA EHR 第2ラウンド Worker F（監査・権限・security/release gates）です。

最初に、この現在の Worker F スレッド自身に 1時間間隔の thread-local heartbeat を登録してください。workspace cron automation や新規スレッドを作る automation は登録しないでください。heartbeat のタスク本文は、このプロンプトと同じ担当範囲・禁止事項・検証条件を保持してください。

作業場所は `/Users/Hayato/.codex/worktrees/opendolphinnext-orca-ehr-r2-worker-f/OpenDolphin_WebClient`、branch は `codex/orca-ehr-r2-worker-f-security-gates` のみです。開始時に RUN_ID=`date -u +%Y%m%dT%H%M%SZ`、pwd、git rev-parse --show-toplevel、git branch --show-current、git status --short、git rev-parse --short HEAD を確認し、branch 不一致または dirty なら停止して報告してください。

必ず workstream README、parallel-heartbeat-plan、worker-board、checklist、docs/README.md、docs/managerdocs/README.md、web-client/README.md、docs/architecture/server-modernization-overview.md、docs/runbooks/release-validation.md、docs/contracts/health-endpoints.md、docs/contracts/runtime-config.md、docs/contracts/orca-connection.md、docs/runbooks/reviewer-submission-packet.md、web-client/notes/security-spec.md を読んでください。

担当範囲は checklist 12/13/14.3/15/16/18/19/20 Phase 5 のうち、audit event coverage と hash-chain batch/restore verification、一般/管理者の監査改ざん不可、PHI/PDF/export/attachment authorization matrix、ORCA secret store/config/log exposure gates、server/browser/error/audit PHI minimization、full release gate (`web-client npm run ci`, Maven static-analysis verify) の blocker 記録、reviewer packet/sensitive evidence guard 強化、本番運用手順の抜け確認です。A-D の業務機能実装や E の UI redesign は所有しないでください。

実装前に資産、信頼境界、攻撃面、最低3件の misuse case、検証コマンドを整理し、1 heartbeat で完了できる最小単位を実装してください。client/ と server/ は変更禁止、Python は使わないでください。tracked file に credential、Cookie、Authorization、JSESSIONID、CSRF、raw ORCA body、患者詳細/保険詳細、HAR/trace/video/screenshot を残さないでください。

doc/config/runtime/audit/sensitive evidence guards、focused Maven/Node tests、可能なら full gate を実行し、iteration-<RUN_ID>.md と worker-board を更新して commit してください。最後は日本語で `【ワーカー報告】`、RUN_ID、担当項目、実装、脅威/対策、検証、更新 docs、commit hash、残 blocker、次 task を報告してください。
```
