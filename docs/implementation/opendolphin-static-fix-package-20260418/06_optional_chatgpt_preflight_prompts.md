# 06. Optional ChatGPT Preflight Prompts

## 重要
この preflight は **任意** です。
C1〜C7 の blocker 修正は、これを待たずに着手してかまいません。
ただし、未解決 ambiguity を先に整理したい場合だけ使ってください。

ChatGPT 側の作業では、**このプロジェクト内の source / tests / docs / notes / prompts だけを参照**し、外部サイトは参照しないでください。

---

## optional prompt A: `acceptlstv2` surface ambiguity を閉じる
```text
あなたは OpenDolphinNext の planning reviewer です。

目的:
- current repo truth だけを使って、reception official current public surface に standalone `acceptlstv2` を含めるべきかを判定する
- `appointments/list + visits/list + acceptmodv2` に正規化済みなのか、`acceptlstv2` も still-supported public surface なのかを 1 本にまとめる

制約:
- このプロジェクト内の source / tests / docs / notes / implementation package だけを参照する
- 外部サイト禁止
- source/test negative を doc-only positive で覆さない
- unknown は unknown のまま残す

出力:
1. verdict: normalized / still-public / not verified
2. evidence matrix
   - docs
   - public resource
   - transport enum / gateway support
   - tests
3. implementation impact
   - static fix package に影響するか
   - 影響するならどの task を止めるか
4. recommendation
   - 今回の blocker 修正を待つ必要があるか
```

## optional prompt B: transmission overlay の single-row patient fallback owner を閉じる
```text
あなたは OpenDolphinNext の planning reviewer です。

目的:
- current repo truth だけを使って、transmission overlay / claim send cache で single-row patient fallback を current contract として残すべきかを判定する
- reception と charts を分けて判断し、row-local key requirement の owner を明確にする

制約:
- このプロジェクト内の source / tests / docs / notes / implementation package だけを参照する
- 外部サイト禁止
- より厳しい verdict を採る
- unknown は成功扱いしない

出力:
1. area別 verdict
   - reception row overlay
   - charts transmission overlay
2. evidence matrix
   - source
   - tests
   - docs/notes
3. immediate impact
   - static fix package の C3 に追加判断が必要か
4. recommendation
   - 今回の blocker 修正を待つ必要があるか
```

## optional prompt C: changed screens の DADS 例外棚卸し
```text
あなたは OpenDolphinNext の UI contract reviewer です。

目的:
- current repo truth だけを使って、今回変更される screen の `readOnly` / `disabled` / disclosure 例外を棚卸しする
- DADS ルールと current docs の例外メモが揃っているかを確認する

対象:
- Charts / OrcaSummary
- Patients / PatientInfoEditDialog
- Administration の関連 screen は guard 観点のみ

制約:
- このプロジェクト内の source / tests / docs / notes だけを参照する
- 外部サイト禁止
- broad redesign 提案は禁止

出力:
1. exception inventory
2. docs不足箇所
3. static fix package の C4/C6/C7 に追加すべき最小 docs/test 差分
```
