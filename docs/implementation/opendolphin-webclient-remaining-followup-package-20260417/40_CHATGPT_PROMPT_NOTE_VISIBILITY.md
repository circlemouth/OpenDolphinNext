# ChatGPT worker prompt — correction note / setting note visibility decision memo

## タイトル
OpenDolphin WebClient — charts correction/setting note visibility contract memo

## 検討対象
OrcaSummary の correction note と setting note を、must-visible とみなすべきか、details/disclosure の内側に置いてよいかを、docs と現在の repo evidence だけで整理する。

## 使ってよい情報
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- `docs/implementation/opendolphin-webclient-implementation-package-20260416/`
- `artifacts/review-bundles/OpenDolphin_WebClient-review-package-curated-20260417T101132Z.zip`
- この prompt 本文
- 外部サイト、一般論、記憶補完は禁止

## 既知事実
- DADS 整理文書は、重要な情報を disclosure に隠さないとしている
- implementation package は correction note と setting note を separate slot / separate tone とし、important info を disclosure に入れないとしている
- 同じ implementation package では charts で correction note と setting note を常時 visible としている
- current review package の OrcaSummary 実装では correction / setting note cards が `<details>` の内側にある
- latest charts correction-note spec failure は setting-note 不在と text mismatch だった

## 判断基準
- must-visible と判断するための根拠の強さ
- current runtime と implementation docs が衝突したとき、どちらを release-gate contract として優先すべきか
- correction note / setting note が「重要情報」に当たるか
- Reception / Charts / DADS の固定前提と矛盾しないか

## 禁止事項
- repo にない route/state/schema/copy を invent しない
- current code をそのまま正として docs 側根拠を無視しない
- DADS の disclosure 原則を弱めて解釈しない
- `send success != paid` を崩す結論を出さない

## 期待する成果物
- visibility contract の裁定
- 根拠の優先順位
- Codex がそのまま実装に使える manager memo
- manual QA で必ず見るべき確認点

## 出力フォーマット
- decision
- evidence_priority_order
- why_notes_are_or_are_not_important_info
- implementation_implication_for_codex
- manual_QA_focus
- manager_memo
