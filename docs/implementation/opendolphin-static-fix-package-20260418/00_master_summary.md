# 00. Master Summary

## static verdict を受けた実装目的
この package の目的は、**NO-GO FOR DYNAMIC TRIAL CHECK** を引き起こした静的 blocker を、repo 内 source/test/docs を根拠に最小の実装単位へ分解し、Codex が安全に着手できる工程へ落とすことです。

## いま閉じている area
- reception official flow は current source/test で大きく崩れていない
- administration / connection / manageusers は current source/test で大きく崩れていない
- charts の `send success != paid` 自体は守られている
- route taxonomy / pair release / direct probe の骨格は崩れていない

このため、今回の package は **PASS area を温存しつつ、blocker のみを潰す** 方針です。

## blocker summary
### C1 Critical
facility 解決が explicit defaultFacilityId で fail-close せず、runtime facility / runtime config fallback が残っている。

### C2 High
invalid host/baseUrl と malformed URL の path で、log / error body / audit / admin connection test response に raw host/baseUrl/URL が流れうる。

### C3 High
Charts が transmission evidence を row-local ではなく patientId latest cache で拾う経路を残している。same-day multi-encounter / multi-reception で誤帰属する。

### C4 High
OrcaSummary の must-visible 情報が closed details 配下にある。DADS と current QA 前提に反する。

### C5 Medium
Patients official create/update/import が canonical re-fetch failure を full success に畳んでいる。

### C6 Medium
OrcaSummary.semantics.test が must-visible/no-hidden-info 契約を lock していない。

### C7 Medium
QA scripts が `QA_MEDICAL_INFORMATION` 未指定時の未送信違反を自動 failure にしていない。

## execution decision
- C1 と C2 は server 側 transport/config/security として最優先で修正する
- C3 と C4 は Charts surface の 1 workstream でまとめて修正する
- C5 は Patients / chart patient edit / import flow を 1 workstream で修正する
- C6 と C7 は docs/test/QA alignment として最後に固める
- `acceptlstv2` surface ambiguity と single-row patient fallback ambiguity は **optional preflight** に分離し、blocker 修正の前提にはしない

## fixed non-goals
- admin connection UI の全面 redesign はしない
- reception flow は blocker の副作用防止に必要な guard 以外触らない
- ORCA dynamic test script の live 実行はしない
- mTLS の live handshake 成否はここで主張しない

## done の定義
この package 完了時点で必要なのは次です。
1. blocker cluster C1-C7 に対応する code/test/docs が current repo へ反映されている
2. targeted tests が green で、negative case が固定されている
3. OrcaSummary must-visible 契約と QA script gate が docs と code で一致している
4. main agent が「static fix complete / dynamic hold」報告を出せる

## まだ hold のまま残すもの
- live ORCA trial / WebORCA 到達性
- trial tenant の facility / principal / mTLS 実環境前提
- `acceptlstv2` standalone public surface の最終位置づけ
