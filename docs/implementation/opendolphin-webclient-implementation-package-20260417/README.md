# OpenDolphin WebClient 残ブロッカー解消 package 2026-04-17

## 目的
この package は **planning-only** の統合物です。Codex 実装担当は、この package と repo 内の source / tests / docs / notes / route / DTO / QA script だけを参照して着手してください。
この package 自体は **コード変更、コミット、PR 作成を含みません**。
ただし、後続の Codex 実装が追加判断なしで開始できる粒度まで decision / gate / touchpoint / tests / prompts を固定しています。

## 正本の優先順位
1. current repo truth: `source / tests / docs / notes / route / DTO / QA script`
2. recovery plan: 追加設計候補
3. reviewer 01〜09: integration payload
4. この package の fixed decision

repo truth と reviewer / recovery plan が衝突した場合は repo truth を優先します。
repo に証拠がないものは **unknown** とし、gate + fail-close fallback を残しています。

## 固定前提
- 3 ペイン責務固定
- patient context 非永続
- `finish` と `send` の分離
- right rail chooser-only
- `送信済` と `会計済み` の非統合
- `send success != paid`
- generic bottom navigation の新規導入禁止
- 重要情報を disclosure に隠さない
- 1 画面 1 primary
- unknown は gate として残し、fail-close fallback を添える

## 読む順番
1. `00_MANAGER_DOCSET.yaml`
2. `00_MANAGER_PROMPT.md`
3. `01_WORKPLAN.md`
4. `10_RECEPTION_TRANSMISSION_DOCSET.yaml`
5. `10_RECEPTION_TRANSMISSION_PROMPT.md`
6. `20_ORCASUMMARY_MOUNT_DOCSET.yaml`
7. `20_ORCASUMMARY_MOUNT_PROMPT.md`
8. `30_PRINT_HARNESS_FIRST_DOCSET.yaml`
9. `30_PRINT_HARNESS_FIRST_PROMPT.md`
10. `31_PRINT_APP_ESCALATION_CONDITIONAL_DOCSET.yaml`
11. `31_PRINT_APP_ESCALATION_CONDITIONAL_PROMPT.md`

## package の使い方
- `00_MANAGER_DOCSET.yaml` を全体の前提とする
- 各 task の docset にある acceptance と required_tests をセットで扱う
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md` を UI reference として参照する
- build artifacts / logs / screenshots / generated output は repo truth 判定に使わない

## package 外でやらないこと
- 外部サイト参照
- repo に証拠がない route/state/schema/copy の推測補完
- TODO 追加
- 暫定 shim 追加
- format-only 変更
- 後方互換維持のための unsafe workaround
