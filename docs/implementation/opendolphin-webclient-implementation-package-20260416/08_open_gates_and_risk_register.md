# 08. Open Gates and Risk Register

## 1. open gate 一覧
| gate_id | theme | severity | owner | fallback | decision_needed_by | blocking_scope |
| --- | --- | --- | --- | --- | --- | --- |
| UG-01 | billing confirmation authoritative owner | high | billing + product owner | `会計待ち + 送信済` のまま止め、client send だけで `会計済み` にしない | before PR-06a merge | WS-01, WS-06, WS-09 |
| UG-02 | rebilling / `再計待` clear rule | high | billing + product owner | paid 後編集は `再計待` に倒し、clear 条件は paid confirmation source が決まるまで自動解除しない | before PR-06b merge | WS-01, WS-06 |
| UG-03 | send 後の canonical accounting handoff owner | medium | billing + reception owner | workflow を進めず transmission signal だけ更新する | before PR-06a merge | WS-06 |
| WS01-G1 | row-local billing signal key | high | reception owner | patientId-only overlay を multi-reception row に適用しない。曖昧なら positive signal を出さない | before PR-01 merge | WS-01 |
| WS02-G1 | docs と code の encounter context source order 差 | medium | charts-shell + docs owner | non-persistence を維持したまま gap を docs に明記し、source order 変更は別裁定に回す | before PR-02 merge | WS-02 |
| WS02-G2 | safe direct return label mapping | low | charts-shell + product owner | Charts main では `受付へ戻る` のみ fixed label とし、他 surface への generic 戻りは出さない | before PR-02 merge | WS-02 |
| UG-04 | clinical disease primary write owner | high | disease + product owner | current writable surface は insurance-local のみ。clinical は fake list を出さず boundary note で止める | before PR-04 merge | WS-04 |
| UG-05 | insurance disease ↔ ORCA mirror sync direction | high | disease + ORCA owner | auto merge しない。mirror は read-only。route は taxonomy 固定まで追加しない | before PR-04 merge | WS-04 |
| UG-06 | ORCA-only row / diff resolution rule | medium | disease + operations owner | visible diff note + manual resolution。silent delete しない | before PR-04 merge | WS-04 |
| UG-07 | disease outcome / end-date / stale semantics | medium | disease owner | current local preset は input assist に留め、canonical enum / freshness threshold と断定しない | before PR-04 merge | WS-04 |
| WS04-G1 | `diagnosisCode` persistence semantics | high | disease + server owner | candidate 表示は両方見せても persist は exact server-guaranteed field または user-confirm に限定 | before PR-04 merge | WS-04 |
| WS04-G2 | local diagnosis list vs summary date semantics | medium | disease + server owner | client 側 heuristic で sync state を推定しない | before PR-04 merge | WS-04 |
| UG-08 | document hydration source | high | document-image + product owner | snapshot-only。runtime hydration を匂わせず、missing-state は fail-close | before PR-05 merge | WS-05 |
| UG-09 | delete scope (`reference remove` vs `hard delete`) | high | document-image + product owner | UI は `文書履歴参照を削除` のみ。hard delete は gate 閉鎖まで非表示 | before PR-05 merge | WS-05 |
| WS05-G1 | `/karte/document` reference-only payload real backend contract | high | document-image + server owner | server 未対応なら document attach action を feature-off にし、patient image upload / SOAP insert のみ残す | before PR-05 merge | WS-05 |
| WS05-G2 | attachment-linked saved document edit / rehydrate | high | document-image owner | `編集` を block し、silent drop を防ぐ | before PR-05 merge | WS-05 |
| UG-11 | cp-set / consult-set reusable asset rule | medium | orders + product owner | multi-domain asset は right rail に入れない | before PR-03 merge | WS-03 |
| UG-12 | same-day same-test correction automation scope | medium | billing + operations owner | correction note 表示のみ。client 完全自動化はしない | before PR-06a merge | WS-06 |
| UG-14 | management-setting inventory / authoritative source owner | high | admin-runtime + product owner | unknown setting は feature-off。fake toggle / success badge を出さない | before PR-07 merge | WS-07 |
| UG-16 | responsive compression exact thresholds / 390 target | medium | ui integrator + product owner | 情報削減ではなく center-first 再配置。390 fixed target は Mobile Images のみ | before PR-08 / PR-09 | WS-02, WS-03, WS-08 |
| UG-17 | concurrent edit final UX | medium | charts-shell + product owner | first-save-wins + explicit error を維持し、optimistic merge をしない | before PR-08 / PR-09 | WS-02, WS-04, WS-05 |

## 2. risk register
| risk_id | risk | severity | mitigation | fallback | release への影響 |
| --- | --- | --- | --- | --- | --- |
| R-01 | Reception billing signal が row-local でなく multi-reception に誤貼りされる | high | WS01-G1 を gate として残し、row-local key が入るまで positive signal を出さない | Reception で `送信済` / `失敗` を positive に見せる row を限定する | release blocker if unresolved |
| R-02 | send success と paid が再統合される | high | UI / docs / tests の 3 面で `send success != paid` を固定する | Reception / Charts 双方で transmission と billing slot を分離する | stop-ship |
| R-03 | right rail chooser-only が editor 再混入で崩れる | high | tool taxonomy test と drawer DOM test で editor form 不在を固定する | center primary を維持し、document/orca を rail から外す | stop-ship |
| R-04 | disease diff が silent merge/delete される | high | manual-resolution note と conflict matrix を docs/test に落とす | mirror read-only / candidate-not-truth / no auto-merge | stop-ship |
| R-05 | document attachment reference が mock only で real backend 非対応 | high | server contract test を先に置き、未証明なら feature-off に倒す | `/karte/document` reference-only payload を gate に残す | release blocker if attach feature depends on it |
| R-06 | patient-specific preview state が storage に残り fixed premise を破る | high | route-state only に戻し、missing-state fail-close を実装する | print preview restore を廃止する | stop-ship |
| R-07 | unknown setting を enabled/success と誤表示する | high | authoritative source inventory と admin scope note を実装し、unknown は feature-off | `/api/admin/config` bulk expansion を禁止する | stop-ship |
| R-08 | responsive 修正で must-visible が disclosure へ押し込まれる | medium | width matrix test と manual screenshot gate を入れる | owner PR 吸収方針で domain owner が visibility まで責任を持つ | release blocker if visible-state broken |
| R-09 | docs と code の context/source order 差が将来 drift する | medium | WS02-G1 を gate とし docs に gap 明記、実装差分は別裁定に回す | non-persistence を優先して behavior drift を避ける | packet note required |
| R-10 | repo-external required checks / secrets / ORCA seed mismatch が release readiness に影響する | medium | packet で blocker を defect と区別し記録する | repo-local merge ready と release-ready を分ける | packet note required |

## 3. 誰が決めるべきか
- product owner / operations owner: billing confirmation, rebill clear, disease sync direction, delete scope, setting inventory
- server owner: route / DTO / support contract / reference-only payload / runtime config source
- ui integrator: width matrix / compression threshold / focus/live-region adaptation
- qa-release: fallback 実装後の release-ready 判定

## 4. release への影響
- high severity gate で fallback 未実装: merge も止める
- high severity gate で fallback 実装済み: merge 可、release packet に明記
- medium severity gate: owner PR merge 可、release owner が packet で受領
- low severity gate: docs note で追跡し、owner PR に持ち込まない

## 5. fail-close fallback 原則
1. source 未確定 = success/enable に倒さない
2. route 未証明 = feature-off or read-only
3. copy 未確定 = generic note で止め、強い意味の wording を使わない
4. mobile / narrow 未確定 = hidden ではなく center-first 再配置
5. delete scope 未確定 = smaller scope (`reference remove only`) に倒す