# 残件スコープ

## いま reopen する area

- PR3: reception / charts live blocker
- PR6: closeout evidence / provenance / reviewer submission packet
- PR2: source 本体の大改修ではなく、新 RUN_ID で import success evidence を載せ直す範囲のみ

## reopen しない area

- PR0 route taxonomy
- PR1 chart send / income static semantics
- PR4 administration contract / wording
- PR5 chart support / naming
- G7 UI / DADS の広い見直し

## 今回必ず閉じること

1. accepted source of truth を 1 branch / 1 HEAD / 1 RUN_ID に固定する
2. `/appointments/medical-information` 502 を upstream blocker と決め打ちしない
3. live accept -> charts handoff を current contract で rerun し、send 到達または blocker classification を第三者が再読できるようにする
4. `/api/orca/official/patients/import` の success evidence を新 RUN_ID に載せる
5. reviewer submission packet を actual git checkout 付きで再設計する
