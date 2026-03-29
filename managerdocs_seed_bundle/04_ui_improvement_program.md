# 04. UI 改善統合計画

この文書は、UI 改善の相談結果を **release blocker ではない current-contract-friendly backlog** として整理したものです。

---

## 1. 統合エグゼクティブサマリー

UI/画面遷移の最大問題は、current contract 自体が不明瞭なことではありません。  
むしろ current contract はかなり明確です。

- auth-sensitive transition は `replace` 前提
- patient context は揮発のみ
- deep link は scrub
- debug-only surface は通常導線に入れない
- admin は `/api/admin/config` が正本

問題は、これが **中断・再入場・例外時の見え方** に十分翻訳されていないことです。  
ユーザーが知りたいのは「なぜ戻されたか」「次にどこへ行けばよいか」「いまどの患者文脈にいるか」ですが、その説明が contract 化されていません。

したがって、最大の UX 負債は壊れた遷移ではなく、**安全な遷移の説明不足**です。

---

## 2. 今回の分類

| 区分 | 今回の主対象 |
| --- | --- |
| すぐ着手できる UI 改善 | login/factor2 の段階表示、`/login` へ戻された理由表示、lost-context 文言、feedback 文言統一 |
| 設計見直しが必要 | patient/encounter bar、Charts 主従面、replace/push 体験方針、admin IA 単線化 |
| docs follow-up が先 | auth 例外マトリクス、surface 別 lost-context matrix、a11y 最小契約、route 別 minimal state |
| code 確認が必要 | guard 挙動、Patients / Mobile Images 入力 source 優先度、auto-sync / auto-action 現況、admin 現 UI detail |
| repo-external なので除外 | required checks、production secrets/config、backend deploy 順序、trusted proxies |

### manager メモ
この文書の内容は **release blocker の reopen ではありません**。  
repo-external sign-off と混線させず、改善バックログとして扱ってください。

---

## 3. 問題マップ

| ID | 画面/導線 | 現在の事実 | 問題 | 改善の方向 | code 確認要否 |
| --- | --- | --- | --- | --- | --- |
| PM-01 | login → factor2 | 1段階目 login の後、必要時のみ factor2。same-surface。reload 後に pending factor2 非復元 | 段階切替と「なぜ 2FA が出たか」が見えにくい | 段階表示、目的説明、expired/cancel/reload の見せ分け | 不要 |
| PM-02 | factor2 例外遷移 | cancel / expired / 試行上限で credentials step に戻る | 失敗・期限切れ・キャンセルの user copy が固定されていない | auth 例外 copy matrix を docs 先行で固定 | 不要 |
| PM-03 | unauthenticated / session expiry / logout | 認証感度の高い遷移は `replace`、未認証・session expiry・logout は `/login` へ `replace` | Back が壊れたように感じやすい | redirect 理由表示、replace/push 体験方針明文化 | 要 |
| PM-04 | 認証失敗 vs 設定失敗 | canonical copy 優先、CSRF は fail-closed | 「資格情報ミス」と「設定/安全性失敗」を区別しにくい | auth-failure / security-failure の文言分離 | 不要 |
| PM-05 | returnTo / deep link scrub | internal path のみ、query/hash scrub 前提、invalid/empty は reception | 着地が変わる理由に納得しにくい | scrub 後の説明 copy と着地案内 | 不要 |
| PM-06 | patient context 再開 | URL / storage 非保持、reload 復元なし | 再開摩擦が大きい | persistence ではなく再入場導線の明示と context 可視化 | 不要 |
| PM-07 | lost-context fallback | fallback は single route ではなく surface ごとの matrix | generic な「戻る」では誤誘導になる | surface 別 lost-context matrix と CTA を固定 | 不要 |
| PM-08 | patient/encounter bar | 最小 encounter context は docs 化済みだが route 別 schema は unknown | 揮発文脈の on-screen anchor がない | documented minimum keys ベースで bar を設計 | 要 |
| PM-09 | Charts 主面/補助面 | normal runtime は `SoapNotePanel` 中心、`OrcaSummary` 補助、DocumentTimeline と MORP は debug-only | 主従整理が UI 原則に落ちていないと drift しやすい | `SoapNotePanel` 主面固定、debug-only 非依存の IA | 不要 |
| PM-10 | comparison / latest-follow / auto-sync | current behavior は docs に固定されていない | productivity 向上と視点剥奪の線引きができない | code 確認後に visibility / override 方針を設計 | 要 |
| PM-11 | feedback / recovery | taxonomy と canonical copy 原則はある | state-loss / auth / fetch / save / logout partial success の copy が揺れやすい | cross-surface copy catalog を作る | 不要 |
| PM-12 | a11y / narrow layout | 最小契約は「色だけに依存しない」まで | focus / keyboard / narrow layout が unknown | a11y 最小契約を docs 先行で固定 | 不要 |
| PM-13 | Patients / Mobile Images | route と fallback はあるが current UI detail と入力 source 優先度細則は unknown | 細部の改善案を今 fix すると推測になる | まず unknown 解消タスクを切る | 要 |
| PM-14 | Administration | SoT は `/api/admin/config`、`/api/admin/delivery` 非復活、current UI detail は unknown | IA 次第で dual-source 誤解が再流入する | config-rooted IA に単線化 | 要 |
| PM-15 | guard inventory | guard 名は docs にあるが behavior は unknown | route ごとの戻し方を固定できない | guard matrix を code 確認で作る | 要 |

---

## 4. 改善原則

1. 面を増やさず、責務を濃くする
2. auth-sensitive transition は history を守る。混乱は Back 復元ではなく理由表示で解く
3. patient context は揮発が正。復元ではなく再入場を設計する
4. lost-context fallback は single route ではなく surface-aware に出し分ける
5. `SoapNotePanel` を主面、`OrcaSummary` を補助面、debug-only surface は debug-only のまま守る
6. canonical copy を優先し、raw backend/internal detail は user-visible に出さない
7. CTA は safe で決定的な次アクションがある時だけ付ける
8. a11y は色非依存だけで終えず、focus・keyboard・narrow layout を最小契約に含める
9. admin は `/api/admin/config` 一元化の mental model を崩さない
10. unknown は埋めない。docs で固めるものと code 確認に回すものを分ける

---

## 5. 工程表

| Phase | 目的 | 対象範囲 | 成果物 | 完了条件 | 先送りするもの |
| --- | --- | --- | --- | --- | --- |
| Phase 0 | contract / acceptance の整理 | auth 例外遷移、lost-context matrix、feedback copy、a11y minimum、Charts 主従面、route/guard matrix の確認項目 | decision memo、acceptance matrix、copy taxonomy、unknown list | quick win に着手する前提の docs が揃う | auto-sync の挙動変更、薄い画面の詳細 IA |
| Phase 1 | auth / patient-context / recovery 導線の改善 | login/factor2、logout/session expiry、returnTo、lost-context、patient/encounter bar の骨子 | flow 図、画面別 copy、CTA 条件、bar contract | 「なぜ戻されたか」「どこへ戻るか」「再選択が必要か」が user-visible で説明できる | Charts 深掘り、admin IA 詳細 |
| Phase 2 | Charts / reading workflow / feedback | `SoapNotePanel` 主面設計、参照系 surface の責務、comparison/latest-follow、auto-sync visibility、feedback 統一 | Charts IA、feedback catalog、a11y/narrow-layout 方針 | normal runtime が debug-only に依存せず、feedback と可読性が横断で揃う | Patients / Mobile Images / Admin の detail polish |
| Phase 3 | productivity 強化、unknown 解消、横断 polish | Patients / Mobile Images / Administration inventory、guard matrix、manual verification pack、narrow layout/keyboard polish | unknown 解消報告、route/task matrix、最終優先順位付き backlog | open unknown が intentional か repo-external に整理される | repo-external 作業、current contract を崩す案 |

---

## 6. 統合バックログ

| ID | テーマ | 施策 | 種別 | 優先度 | 依存関係 |
| --- | --- | --- | --- | --- | --- |
| BL-01 | auth/2FA 例外遷移 | auth 例外 copy matrix を docs で固定 | docs | P0 | なし |
| BL-02 | login → factor2 視線設計 | 段階表示、目的説明、cancel/expired 表現整理 | quick win | P0 | BL-01 |
| BL-03 | returnTo / guard / logout 後導線 | `replace` 理由と次アクション表示 | design | P0 | BL-01 |
| BL-04 | guard matrix | route×guard×trigger×landing の matrix 作成 | code-confirmation | P0 | BL-03 |
| BL-05 | lost-context fallback UX | surface 別 lost-context matrix と CTA を固定 | design | P0 | なし |
| BL-06 | patient/encounter bar | documented keys ベースで bar 契約を作る | design | P1 | BL-05, BL-11 |
| BL-07 | Charts 主従面設計 | `SoapNotePanel` 主面、`OrcaSummary` 補助、debug-only 非依存 IA | design | P1 | なし |
| BL-08 | auto-sync / auto-action 可視化 | 現況確認と visibility / override 方針決定 | code-confirmation | P1 | BL-07 |
| BL-09 | feedback / recovery 一貫化 | cross-surface copy catalog を作る | quick win | P1 | BL-01, BL-05 |
| BL-10 | a11y / narrow layout / keyboard | 最小契約を docs で固定 | docs | P1 | BL-09 |
| BL-11 | Patients / Mobile Images unknown 解消 | entry point、入力 source、minimal state、fallback を棚卸し | code-confirmation | P1 | なし |
| BL-12 | admin IA 単線化 | `/api/admin/config` 軸の section hierarchy / naming | design | P1 | BL-11 |
| BL-13 | route inventory / productivity | task-oriented transition matrix を作る | docs | P2 | BL-04, BL-11 |
| BL-14 | deep link scrub の納得感 | scrub 後の microcopy を定義 | quick win | P2 | BL-03, BL-05 |

---

## 7. まず着手すべき上位10件

1. **BL-01 auth 例外 copy matrix**  
   architecture を触らず confusion を減らせる。docs follow-up 先行。

2. **BL-05 lost-context fallback UX matrix**  
   patient context は復元しない契約なので、摩擦を減らす主戦場は fallback の見せ方。

3. **BL-02 login → factor2 視線設計**  
   same-surface step-up の quick win。current contract を壊さない。

4. **BL-03 returnTo / replace / logout 後導線**  
   Back を戻すのではなく、replace の意味を user が理解できるようにする。

5. **BL-04 guard matrix**  
   auth guard の screen-level behavior は docs では unknown。推測で固めない。

6. **BL-06 patient/encounter bar**  
   揮発文脈でも、現在の文脈が見えるだけで再入場 friction はかなり下がる。

7. **BL-09 feedback / recovery 一貫化**  
   既存の原則を copy catalog 化する。quick win 寄り。

8. **BL-07 Charts 主従面設計**  
   `SoapNotePanel` 主面と debug-only 非依存を guardrail にする。

9. **BL-10 a11y / narrow layout / keyboard 契約**  
   後から横断修正になりやすいので docs 先行で固定。

10. **BL-11 + BL-12 Patients / Mobile Images / Administration の inventory 解消**  
    薄い画面は推測で埋めない。まず inventory。

---

## 8. screen / route ごとの改善方針

## Login / factor2
### 現在の役割
- `/login` と `/f/:facilityId/login`
- 1 段階目 login → 必要時のみ factor2(TOTP)
- factor2 は same-surface step-up
- reload 後に pending factor2 非復元

### 改善後の目標体験
- credentials step と factor2 step が一目で分かる
- factor2 がなぜ出たか分かる
- expired/cancel/retry の違いが分かる

### 先に決めること
- auth 例外 copy matrix
- destination summary をいつ出すか
- credentials失敗 / factor2失敗 / factor2期限切れ / cancel の見せ分け

---

## logout / session expiry / auth guard
### 現在の役割
- unauthenticated access と session expiry は `/login` へ `replace`
- logout も cleanup 優先で `/login` へ `replace`

### 改善後の目標体験
- `/login` に戻った理由が分かる
- 「サインアウト済み」「セッション期限切れ」「再ログイン必要」の違いが分かる
- Back が戻れないのが自然に理解できる

### 先に決めること
- replace/push 体験方針
- redirect reason taxonomy
- logout partial success の user-facing copy

---

## Patients
### 現在の役割
- lost-context 時は `from=reception` なら reception、それ以外は charts
- 詳細 handoff schema と全入力 source 優先度は unknown

### 改善後の目標体験
- どこから来たか分かる
- context がない場合も safe fallback が明快
- 再選択が必要な理由が説明される

### 先に決めること
- minimal context
- context なし時の canonical copy
- `from=reception` 以外の説明規則

---

## Charts
### 現在の役割
- normal runtime の中心は `SoapNotePanel`
- `OrcaSummary` は補助
- `DocumentTimeline` と `MedicalOutpatientRecordPanel` は debug-only

### 改善後の目標体験
- `SoapNotePanel` を中心に読めば通常業務が完結する
- 参照系 surface は補助として使われる
- debug-only surface を知らなくても迷わない
- auto-sync / auto-action は productivity に効く時だけ前に出る

### 先に決めること
- 主面/補助面/参照面の階層
- comparison/latest-follow の責務
- feedback の置き場
- narrow layout 時の優先順

---

## Mobile Images
### 現在の役割
- lost-context 時は `from=reception` / `from=patients` を優先し、既定は charts
- source 優先度の細則は unknown

### 改善後の目標体験
- どの source から来たか分かる
- context があるか分かる
- 失われた場合どこに戻るかが一目で分かる

---

## Administration
### 現在の役割
- SoT は `/api/admin/config`
- `/api/admin/delivery` を第 2 正本に戻さない
- current UI detail は unknown

### 改善後の目標体験
- config が正本で迷わない
- delivery/health 相当の情報は derived view として理解できる
- section hierarchy と naming が一貫している

---

## 9. やらないこと

- 患者文脈を URL / `localStorage` / `sessionStorage` に残す案
- reload / new tab / bookmark / session restart をまたぐ patient context 復元案
- login → factor2 の単線契約を崩す案
- `replace` 前提の auth-sensitive transition を根拠なく `push` に変える案
- `DocumentTimeline` や `MedicalOutpatientRecordPanel` を normal runtime の主面へ昇格する案
- `/api/admin/delivery` を第 2 正本として復活させる案
- raw backend/internal detail を user-visible copy にそのまま出す案
- repo-external の required checks / secrets / backend deploy 順序を UI backlog に混ぜること
- current docs に矛盾証拠がない close 済み legacy を reopen すること
- Patients / Mobile Images / Administration の detail を推測で埋めること

---

## 10. 実行順序の提案

1. **Phase 0 で contract を決める**  
   auth 例外 copy matrix、surface 別 lost-context matrix、Charts 主従面、a11y 最小契約

2. **Phase 1 で auth と lost-context の quick win を先出し**  
   login/factor2 段階表示、`/login` 理由表示、lost-context 文言、feedback 用語統一

3. **Phase 2 で Charts と feedback を整理**  
   `SoapNotePanel` 主面、参照系 surface の責務、auto-sync visibility、copy catalog

4. **Phase 3 で薄い画面の unknown を解消**  
   Patients / Mobile Images / Administration、guard matrix、narrow layout / keyboard polish

### manager メモ
release 直前に回さない方がよいもの:
- guard/back-stack の横断変更
- auto-sync visibility の調整
- focus / keyboard / narrow layout の横断 polish
