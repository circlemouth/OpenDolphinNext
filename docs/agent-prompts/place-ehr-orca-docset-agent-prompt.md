# Agent Prompt: EHR / ORCA Documentation Set Placement

以下を、OpenDolphinNext リポジトリでドキュメントセットを配置するエージェントへ渡す。

```text
【ワーカー指示】

あなたは OpenDolphinNext の AGENTS.md / docs 整備を担当するエージェントです。

このタスクはコード変更ではなく、電子カルテ・ORCA連携安全仕様ドキュメントセットを適切な場所へ配置し、既存AGENTS.mdへ追記する作業です。
ただし、AGENTS.md と docs は今後の全エージェントの作業品質に影響するため、本番運用レベルの慎重さで扱ってください。

## 最重要

- 必ず専用worktreeを作成し、そのworktree内だけで作業してください。
- 他worktree、他エージェントの成果物、他コンテナを操作しないでください。
- モデル指定が可能な場合は gpt-5.4 high を使用してください。
- 日本語ファイルは UTF-8 BOMなし、LF改行で保存してください。
- 既存AGENTS.mdを全文置換しないでください。
- `client/` と `server/` legacy領域は変更しないでください。
- ORCA TrialのBasic認証値、患者個人情報、証明書情報、秘密情報をdocs、ログ、報告にrawで残さないでください。

## 入力

ユーザーから受け取った `opendolphinnext_ehr_orca_docset_20260512.zip` を展開し、同梱の `README.md` と `AGENTS_PATCH_PLACEMENT_GUIDE.md` を読んでください。

## 目的

次をリポジトリへ適切に配置する。

- AGENTS.mdへの電子カルテ・ORCA連携安全仕様の追記
- `docs/architecture/ehr-orca-source-of-truth-boundary.md`
- `docs/architecture/ehr-chart-prescription-authority.md`
- `docs/architecture/orca-integration-safety-contract.md`
- `docs/testing/ehr-orca-required-test-matrix.md`
- `docs/operations/orca-unknown-state-runbook.md`
- `docs/web-client/ux/medical-safety-ui-rules.md`
- `docs/agent-prompts/*.md`

## 作業手順

1. RUN_IDを `date -u +%Y%m%dT%H%M%SZ` で採番する。
2. `git status --short` と `git branch --show-current` を確認する。
3. 専用worktreeを作成する。
4. AGENTS.mdを読む。
5. `docs/README.md`、`docs/managerdocs/README.md`、`docs/contracts/orca-route-taxonomy.md`、`docs/web-client/ux/dads_app_ui_design_rules_20260411.md` が存在する場合は読む。
6. ZIPを一時ディレクトリへ展開する。
7. 同梱 `AGENTS_PATCH_PLACEMENT_GUIDE.md` に従い、AGENTS.mdへ追記する。
8. 同梱 `docs/` 配下の文書をリポジトリの同名pathへ配置する。
9. 同名ファイルが既に存在する場合は、上書き前に差分を比較し、既存内容を壊さない形で統合する。
10. 必要に応じて `docs/README.md` または関連索引に新規ドキュメントへのリンクを追加する。
11. Markdown link、grep guard、秘密情報混入確認を行う。
12. 変更をコミットする。

## AGENTS.md 追記位置

- `## ⚠️ 最重要: 遂行責任` の直後に、電子カルテ・ORCA連携の安全境界を追加。
- `## 0. 現状把握クイックスタート` に `### 0.1 医療安全プリフライト` を追加。
- `### 1.2 変更種別ごとの主な読み先` の表に、電子カルテ・ORCA関連行を追加。
- `## 11. サブエージェントルール` の章末に、追加仕様を追記。
- AGENTS.md末尾の締め文直前に、`## 13. 電子カルテ・ORCA連携 最上位仕様` と `## 14. レビュー・実装時の必須ゲート` を追加。

## 検証コマンド

最低限、次を実行してください。

```bash
git status --short
git diff -- AGENTS.md docs/architecture docs/testing docs/operations docs/web-client/ux docs/agent-prompts
rg -n "ehr-orca-source-of-truth-boundary|orca-integration-safety-contract|medical-safety-ui-rules|UNKNOWNは成功ではない" AGENTS.md docs
rg -n "ORCA_API_PASSWORD|ORCA_API_USER|Basic [A-Za-z0-9+/=]+" AGENTS.md docs || true
```

存在する場合は次も実行してください。

```bash
bash server-modernized/tools/ci/check-doc-links.sh
```

## 完了条件

- AGENTS.mdに追記が反映されている。
- 新規docsが正しいpathに配置されている。
- docs索引から辿れる。
- 秘密情報・患者情報がrawで混入していない。
- 既存AGENTS.mdの遂行責任、Security First、worktree、Docker、DADS、ORCA Trial運用ルールを壊していない。
- git diffで意図したdoc変更だけが出ている。
- コミット済みである。

## 報告形式

【ワーカー報告】
- RUN_ID:
- worktree:
- branch:
- 配置したファイル:
- AGENTS.md変更概要:
- docs索引更新:
- 検証コマンドと結果:
- 未実行コマンドと理由:
- 秘密情報・患者情報混入確認:
- 既存AGENTS.mdとの競合と解消:
- 残リスク:
- commit:
- 最終 `git status --short`:
```
```
