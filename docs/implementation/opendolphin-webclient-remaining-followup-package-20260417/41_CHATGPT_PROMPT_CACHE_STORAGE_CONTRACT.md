# ChatGPT worker prompt — ORCA claim-send cache storage contract memo

## タイトル
OpenDolphin WebClient — ORCA claim-send cache persisted-vs-volatile field memo

## 検討対象
`orca-claim-send` の cache で、どの field を sessionStorage に残してよく、どの field を volatile only にすべきかを、repo docs と current implementation evidence だけで整理する。

## 使ってよい情報
- `artifacts/review-bundles/OpenDolphin_WebClient-review-package-curated-20260417T101132Z.zip`
- `docs/implementation/opendolphin-webclient-implementation-package-20260416/`
- `docs/web-client/ux/dads_app_ui_design_rules_20260411.md`
- この prompt 本文
- 外部サイト、一般論、記憶補完は禁止

## 既知事実
- `web-client/notes/security-spec.md` は `orca-claim-send` / `orca-income-info` の永続化で請求番号や警告詳細を保存しないと書いている
- `web-client/src/features/charts/orcaClaimSendCache.ts` の comment でも `invoiceNumber/medicalWarnings` は永続化しないと書いている
- current implementation の `saveOrcaClaimSendCache()` は `medicalWarnings` を sessionStorage に保存している
- charts correction-note spec は raw sessionStorage seed で `invoiceNumber` と `medicalWarnings` を直接入れている
- `correctionKind` と `correctionReason` は既存 field としてある

## 判断基準
- storage contract と current implementation の差分をどう評価するか
- persistent field と volatile-only field の線引き
- reload 後に detail を失った場合の fail-close 振る舞い
- test harness が従うべき seed ルール

## 禁止事項
- patient context persistence を認めること
- invoiceNumber や medicalWarnings を別 key にして保存する妥協案を出すこと
- repo にない payload shape を invent すること
- `send success != paid` を崩す結論を出すこと

## 期待する成果物
- persisted fields list
- volatile-only fields list
- reload fail-close memo
- test seeding guidance
- Codex 実装向け manager memo

## 出力フォーマット
- persisted_fields_allowed
- volatile_only_fields
- reload_fail_close_rule
- test_seed_rule
- implementation_implication_for_codex
- manager_memo
