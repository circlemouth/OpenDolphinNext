# Web クライアント 次タスク指示書

## 判定
今回の報告は、主に `MATCH`、`DOCS_UNDER_SPEC`、`UNKNOWN` で構成されており、現時点では `TRUE_REGRESSION` は見えていません。
したがって次の波は、大きな再設計ではなく、unknown を証拠で閉じながら、docs を repo truth に昇格させる段階として進めます。

## 今回の主目的
quick win 実装の次として、今は次の 4 本に集中してください。

1. **BL-11 docs 昇格**
   - Patients の入力 source 優先度
   - Mobile Images の入力 source 優先度
   - route 別 minimal encounter context schema
   - admin current UI detail の inventory
   - 目的は、evidence pack にある `DOCS_UNDER_SPEC` を current docs に反映すること

2. **BL-04 guard matrix の確定**
   - route × guard × trigger × landing を code-confirm で棚卸しする
   - `/login` に戻るケース、session expiry、logout、unauthenticated access、deep-link scrub 後の landing を screen 単位で確定する
   - まず evidence pack を更新し、その後 docs へ昇格する

3. **BL-10 touched surfaces 限定の a11y minimum**
   - app-wide rule には広げない
   - 今回触った surface に限定して、`aria-live`、focus move、keyboard reachability、narrow layout の最小契約を確認する
   - regression があれば最小修正、なければ docs と manual verification pack だけ整える

4. **BL-08 auto-sync / auto-action 現況の inventory**
   - 挙動変更はしない
   - Patients / Charts / Mobile Images を跨いで、何が自動で起きるか、何が user-visible か、override があるかを code-confirm する
   - 結果は `MATCH / DOCS_UNDER_SPEC / DOCS_OVER_ASSERT / TRUE_REGRESSION / UNKNOWN` で分類する

## 今回はやらないこと
- patient/encounter bar の設計着手（BL-06）
- Charts 主従面の深掘り再設計（BL-07）
- admin IA の単線化実装（BL-12）
- task-oriented transition matrix の本設計（BL-13）
- repo-external の required checks / secrets / deploy / production config
- patient context の永続化
- `replace` 契約の緩和
- debug-only surface の主面化

## 実行順
### Step 1. Docs promotion first
BL-11 を先に進め、evidence pack で既に `DOCS_UNDER_SPEC` と判定できたものを current docs に昇格してください。
この step は、なるべく実装変更を増やさず、repo truth の明文化を優先します。

### Step 2. Guard evidence
BL-04 を code-confirm で進め、screen-level matrix を evidence pack に追加してください。
この段階では、仕様変更よりも現況確定を優先してください。

### Step 3. Touched-surface a11y
BL-10 は、今回触った surface に限定して確認してください。
app-wide contract は unknown のまま保持して構いません。
ただし touched surface に regression があるなら最小修正を許可します。

### Step 4. Auto behavior inventory
BL-08 は現況の見える化に留め、挙動変更や visibility policy の導入までは進めないでください。

## 成果物
最低限、次の 5 点を提出してください。

1. 更新済み evidence pack
2. docs 昇格差分
3. touched-surface a11y verification memo
4. auto-sync / auto-action inventory memo
5. manager 向け short report

## short report の必須項目
- 分類: `MATCH / DOCS_UNDER_SPEC / DOCS_OVER_ASSERT / TRUE_REGRESSION / UNKNOWN`
- 影響度: `P0 / P1 / P2`
- repo-local か repo-external か
- 今回変更したファイル
- 実行した tests / build / typecheck
- 未解消 unknown
- 次に切るべき issue

## 完了条件
- BL-11 の docs 昇格が終わっている
- BL-04 の guard matrix が evidence として確認できる
- BL-10 で touched surface の最小 a11y 契約が確認できる
- BL-08 の現況 inventory ができている
- `TRUE_REGRESSION` が見つからない限り、大きな設計変更や横断改修に広げていない

## 失敗条件
- unknown を推測で埋める
- repo-external 領域に踏み込む
- app-wide a11y を一気に fix しようとする
- auto-sync / auto-action の設計変更に進む
- BL-06 / BL-07 / BL-12 / BL-13 を前倒しで始める
