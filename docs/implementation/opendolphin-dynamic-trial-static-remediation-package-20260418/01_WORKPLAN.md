# Workplan

## ゴール
final static verdict で残った blocker / gaps を閉じ、**dynamic ORCA trial check に進める静的品質**まで引き上げる。

## blocker-first order
1. **C7** release-gate truth restoration  
   `medicalInformation` omission gate を actual browser payload shape に合わせ、docs と scripts を一致させる。
2. **C5** patient import success semantics  
   HTTP 200 と business success を分離し、full success を business success + canonical readback success に限定する。
3. **C3 + C6** charts static closure  
   row-local negative net を report / order panels / timeline まで拡張し、OrcaSummary must-visible visibility を `visible + details外` で lock する。
4. **R-OBS-01 + T-NEG-01** transport observability / sanitize net  
   `clientAuthConfigured` truthfulness を戻し、sanitize negative tests を rendered surfaces まで強化する。
5. **RT-01 + docs drift** release docs cleanup  
   route taxonomy guard と carried-forward pass claims を current truth に揃える。

## workstream map
| workstream | owner | primary target |
|---|---|---|
| WS-Q1 | SA-01 | C7, RT-01, docs drift |
| WS-P1 | SA-02 | C5 |
| WS-W1 | SA-03 | C3, C6 |
| WS-S1 | SA-04 | R-OBS-01, T-NEG-01 |
| WS-M1 | main agent | merge, guard rerun, final handoff |

## dependency notes
- SA-01 は他 stream と file overlap が少ないので first merge に向く
- SA-02 は patients area に閉じており独立度が高い
- SA-03 は charts tests と Playwright rerun を伴うため third merge に置く
- SA-04 は server-only で独立しているが、final gate の前に入れる
- main agent は older follow-up docs の最終整合と final handoff を持つ

## merge order
1. SA-01
2. SA-02
3. SA-03
4. SA-04
5. main agent final reconciliation

## stop conditions
次のどれかが起きたら、その stream は止めて main agent report に戻す。

- new public route / DTO / state owner が必要になる
- hidden info / second primary / send=paid へ戻る
- reception omission gate や administration pass area を壊す
- business success rulesを repo evidence なしに新設しないと進めない
- live ORCA 実行を前提にしないと acceptance を閉じられない

## static exit definition
static exit は次をすべて満たしたときだけ成立する。

1. C7, C5, C3, C6, R-OBS-01, T-NEG-01, RT-01, docs drift が code/test/docs で閉じている
2. focused tests が green
3. `npm run verify:web-guard`, `npm run typecheck`, `npm run ci`, `server-modernized verify` が green
4. pass area guard が clean
5. final report が unknown / not verified を success 扱いしていない

## dynamic でしか閉じられないもの
- actual WebORCA 到達性 / auth / mTLS
- live captured request での omission evidence
- live ORCA partial / full success の実挙動
- same-day multi-encounter 実データでの overlay integrity

これは static exit 後の別フェーズに渡す。
