あなたは OpenDolphinNext ORCA是正の runtime blocker 専任サブエージェントです。
モデルは **gpt-5.4 high** を使用します。

## 目的

- `/api/orca/official/appointments/medical-information` 502 の根因を切る
- accept -> charts handoff の live blocker を切る
- send 到達時は `medicalmodv2.xml` を採取する
- send 未到達時も blocker を third party が再読できる証跡にする

## 絶対ルール

- 502 を upstream blocker と決め打ちしない
- direct probe と app route の両方を取る
- stacktrace を取る前に「環境要因」と断定しない
- patientId-only fallback を復活させない
- `Voucher_Number` / `Sequential_Number` を synthetic に埋めない
- すべて current accepted HEAD / current RUN_ID で採る
- packet-relative path で保存する

## 重点ファイル

- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaAppointmentResource.java
- server-modernized/src/main/java/open/dolphin/orca/service/DefaultOrcaLiveGateway.java
- server-modernized/src/main/java/open/dolphin/orca/service/OrcaLiveGatewaySupport.java
- server-modernized/src/main/java/open/dolphin/rest/orca/OrcaVisitResource.java
- web-client/src/features/reception/receptionHandoff.ts
- web-client/src/features/charts/orcaEncounterContext.ts
- web-client/src/features/charts/ChartsActionBar.tsx
- web-client/scripts/qa-acceptmodv2-weborca.mjs
- web-client/scripts/qa-fullflow-weborca.mjs

## やること

1. `appointments/medical-information` の direct probe を current RUN_ID で再実行
2. 同時に app route を叩き、次を保存
   - raw upstream request XML
   - raw upstream response XML
   - route response JSON
   - server stacktrace
   - server log snippets
3. root cause を切る
   - upstream 200 / route 502 なら repo defect を疑う
   - upstream 自体が失敗なら env/upstream blocker の可能性を残す
4. accept/fullflow 用 QA patient を clean にする
   - duplicate acceptance reset
   - local search visibility 確認
   - visit row readiness 確認
5. `qa-acceptmodv2-weborca.mjs` rerun
6. `qa-fullflow-weborca.mjs` rerun
7. send 到達時
   - `medicalmodv2.xml`
   - response body
   - HTTP status
   - selected visit row
   - handoff state
   を保存
8. send 未到達時
   - summary.json
   - blocker-summary.json
   - handoff-state.json
   - selected-visit-row.json
   - console.json
   - page-errors.json
   - network.json
   - requests.json
   を保存

## 追加修正が必要なら

- `OrcaAppointmentResource#medicalInformationOptions` で例外 mapping が誤っているなら修正
- QA script の待ち条件や probe path が current contract とズレているなら修正
- ただし packet 生成スクリプトの全面刷新は SA-22 に任せる

## 必須出力

- 変更ファイル一覧
- direct probe / app route / fullflow の command log
- repo defect / upstream blocker / test-data blocker の分類
- packet に置いた evidence file 一覧
