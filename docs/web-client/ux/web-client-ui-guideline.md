# Webクライアント UIガイドライン

- Status: reference-only
- Base reference: [docs/web-client/ux/dads_app_ui_design_rules_20260411.md](./dads_app_ui_design_rules_20260411.md)
- Canonical source: `docs/managerdocs/04_ui_improvement_program.md`, `web-client/notes/ui-current-contract.md`
- 位置づけ: project-local adaptation

この文書は DADS の再要約ではなく、このプロジェクトで採用した判断だけを残す。DADS 本文の規則や準備中項目に独自の見た目・振る舞いを追加しない。

## このプロジェクト固有の採用判断
- current fact は `web-client/notes/ui-current-contract.md` を正本とし、この文書では固定事実を再掲しない。
- screen structure / route / attachment policy は `docs/web-client/architecture/` を参照し、この文書では UI token や visual rule の採用判断だけを扱う。
- 画面固有の一時案や dated mock review は `artifacts/` に置き、この文書へ昇格させない。
- DADS で準備中の項目は「準備中のため project-local rule を増やさない」で統一する。

## Project-Local Adaptation Rules
- UI 実装では DADS 準拠を前提にしつつ、医療業務画面として情報優先度を崩さない。
- トークンやコンポーネントの追加は「この repo 固有で必要な理由」がある時だけ行う。
- local-only / official / debug-only の区別は wording と情報設計で行い、見た目の装飾でごまかさない。
- Accessibility / contrast / keyboard operability は DADS と current contract の両方に反しないことをレビュー条件にする。
- 業務画面の通常表示では、説明文を「安全・判断・復旧に必要な情報」へ限定する。DADS の support text / help text は、全画面に常時説明文を置く根拠にしない。
- 空状態、画面構成、正常時の安心表示、操作方法の説明、教育的な原則説明は、原則として visible copy から外す。必要なら tooltip / help / details / screen-reader-only へ退避し、通常の視線を診療判断、未入力、警告、送信可否、患者識別へ戻す。
- 例外として、患者取り違え防止、重大操作確認、ORCA UNKNOWN / warning / unmatch、必須不足、禁忌・相互作用、送信ブロック理由、単位・上限・日数など誤入力に直結する条件は初期表示または近傍表示を維持する。

## Review Checklist
- DADS 本文を別文書へ焼き直していないか
- DADS 準備中項目に独自ルールを追加していないか
- project-local adaptation だけを書いているか
- current fact は `ui-current-contract.md` に寄せているか
- 業務上の行動に結び付かない説明文が、カードやバナーとして常時表示されていないか
- 正常時の「問題なし」説明が、警告や必須不足と同じ強さで視線を奪っていないか
- 説明文を削る代わりに、医療安全上の警告・患者識別・重大操作確認まで消していないか
