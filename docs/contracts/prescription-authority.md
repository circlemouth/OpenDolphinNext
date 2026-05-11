# Prescription Authority Contract

## Purpose

OpenDolphinNext の処方指示は、診療録や ORCA 診療行為送信候補とは別の local authoritative record として扱う。ORCA 送信候補はこの正本から作るが、ORCA 正本そのものではない。

## Storage Boundary

- `prescription_order` は処方指示の現在状態を保持する。
- `prescription_order_revision` は DRAFT / FINAL / 変更後の revision を保持する。
- `prescription_order_item` は薬剤コード、薬剤名、規格、剤形、用法、用量、単位、日数、院内/院外、内服/外用/注射/頓用、一般名処方フラグ、医師コメント、server-side 入力者、作成日時を構造化列として保持する。
- `prescription_order_event` は create / finalize / change / stop / cancel / reissue の append-only event として扱う。
- `orca_medical_candidate` は処方正本から作った ORCA 診療行為送信候補を保持する。candidate は明示的に非正本であり、ORCA 送信前確認・未解決項目レビュー用の prepare 結果に限定する。
- `prescription_orca_transmission` は ORCA 送信準備・送信・照合の状態を保持する。raw ORCA body、資格情報、患者詳細、保険詳細は保存しない。

## Status Contract

処方状態は以下だけを許可する。

- `DRAFT`
- `FINAL`
- `CHANGED`
- `STOPPED`
- `CANCELLED`
- `REISSUED`

ORCA transmission status は ORCA operation family と同じ fail-closed status set を使う。

## Mutation Boundary

- `DRAFT` から `FINAL` などへの遷移は server-side authority API だけが行う。
- `POST /api/prescriptions` は server-side facility と patient existence を検証し、診療録リビジョンに紐付く `DRAFT` 処方を `prescription_order` / `prescription_order_revision` / `prescription_order_item` / `prescription_order_event` に保存する。
- `POST /api/prescriptions/{prescriptionId}/finalize` は保存済み current revision の server-side summary から `content_hash` を計算し、`FINALIZE` event を追加する。client 提供 digest は権威値にしない。
- `POST /api/prescriptions/{prescriptionId}/change|stop|cancel|reissue` は理由必須とし、`CHANGE` / `STOP` / `CANCEL` / `REISSUE` event を append-only で追加する。`change` / `reissue` は新しい構造化 item を持つ revision を要求する。
- 構造化 item は first-class DTO の `standardName` / `dosageForm` / `days` / `prescriptionLocation` / `medicationRoute` を保存する。client hint が欠落している場合でも、server は `medicalClass` / `medicalClassNumber` から院内外・内服/頓服/外用・日数を再解決し、未知または不正な値は fail-open せず null / unresolved に落とす。
- `created_by` は認証済み actor から保存し、client payload の owner / role / facility 相当値は採用しない。
- `FINAL` / `CHANGED` / `STOPPED` / `CANCELLED` / `REISSUED` の処方 order / revision / item は直接 UPDATE / DELETE できない。
- 確定後の変更、中止、取消、再発行は新 revision と `prescription_order_event` により表現する。
- `prescription_order_event` は append-only で、UPDATE / DELETE は DB trigger が拒否する。
- client 由来の facility / owner / role / voucher / sequential / insurance combination / storage key / digest / URL は処方正本の権威情報にしない。API 実装では認証 context、server-side encounter projection、DB 状態から再解決する。

## ORCA Medical Candidate Boundary

- `POST /api/local/orca/medical-candidates/from-chart/{chartRevisionId}` は chart revision に紐付く current prescription revision から候補を作る。
- candidate 生成時の facility は認証済み request context から解決し、patient / encounter / prescription revision は DB 上の処方正本から解決する。
- candidate 生成時は `prescription_order` row の patient / encounter と revision summary 内の patient / encounter が一致することを server-side で検証し、不一致または欠落時は `prescription_source_context_mismatch` で fail-closed にする。
- candidate source にできる処方状態は `FINAL` / `CHANGED` / `REISSUED` のみとする。`DRAFT` / `STOPPED` / `CANCELLED` は ORCA 送信候補化を 409 で拒否し、payload を保存しない。
- candidate response は `nonAuthoritative=true`、`candidateStatus=READY_TO_SEND|NEEDS_REVIEW`、`sendable`、server-generated `prescriptionContentHash` を返す。`prescriptionContentHash` が欠落する candidate は `NEEDS_REVIEW` / `sendable=false` とし、client 提供 digest で補完しない。
- candidate `medicalInformation` は処方正本 revision から `rpSequence` / `medicalClass` / `medicalClassNumber` / `usageCode` / `usageName` / 薬剤行を再構成し、薬剤行には `itemSequence` を付ける。live `medicalmodv2` 送信側はこの candidate を送信前確認材料として扱い、patient / encounter / voucher / sequential / insurance combination は server-side encounter context から別途解決する。
- 薬剤コード、用法コード、medical class、薬剤行が未解決の場合は `NEEDS_REVIEW` / `sendable=false` とし、live `medicalmodv2` 送信へ進めない。
- candidate と audit details に raw ORCA body、credential、患者氏名・住所・電話番号、保険詳細、voucher / sequential の client 提供値を保存しない。
- Web client の候補確認 surface は patient / acceptance / department / physician / insurance combination を確認表示にだけ使い、candidate response の処方 content hash 要約、RP / 診療区分 / 用法 / 薬剤行を送信前確認材料として表示する。candidate prepare request は `chartRevisionId` だけを route path として送り、facility / patient / insurance / voucher / sequential / URL / digest を body や query として送らない。
- 候補確認 surface は candidate を ORCA 正本または送信完了として表示しない。live `medicalmodv2` 送信、送信後再取得、差分照合は別 workflow の責務とする。

## Misuse Cases Covered

- client が FINAL 済み処方の `patient_id` や内容を直接書き換える。
- DO import や local draft 保存経路が、会計待ち・閉鎖済み encounter の処方 payload を上書きする。
- client が event を UPDATE / DELETE して変更・取消履歴を消す。
- client が構造化 item ではなく payload JSON だけで ORCA candidate を作らせ、未解決薬剤や用法を隠す。
- client が change/reissue payload の `patientId` / `encounterId` を別患者・別受付へ改ざんし、確定済み処方を横展開する。
- client が finalize 時に偽 digest を送信し、保存済み処方内容とは異なる hash を正本化する。
- client が candidate prepare に別患者・別施設・保険組合せ・voucher / sequential を混入させて ORCA 送信候補の authority を乗っ取る。
- client が偽 digest を送って候補と異なる処方 revision を後続 workflow へ結び付ける。
- revision summary に別患者または別 encounter の context が混入し、chart revision 経由で横展開 candidate が保存される。
- candidate handoff から `usageCode` / `usageName` が欠落し、live send 側で client payload や display text から用法を再推測する。
- client が DRAFT / STOPPED / CANCELLED の処方を chart revision 経由で candidate 化し、未確定または中止済み指示を送信前確認へ進める。
- candidate handoff の行識別子が表示順だけになり、送信前確認・送信後差分照合で RP/薬剤行を取り違える。

## Verification

Focused server verification:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PrescriptionAuthorityResourceTest,LocalOrcaMedicalCandidateResourceTest,PrescriptionAuthoritySchemaTest,FreshSchemaBaselineTest test
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PrescriptionAuthorityStructuredItemTest,PrescriptionAuthorityResourceTest,PrescriptionAuthoritySchemaTest test
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=LocalOrcaMedicalCandidateResourceTest test
```

Focused web verification:

```bash
cd web-client && npm test -- --run src/features/charts/__tests__/orcaMedicalCandidateApi.test.ts src/features/charts/__tests__/OrcaMedicalCandidatePanel.test.tsx src/features/charts/__tests__/chartsActionBar.test.tsx
cd web-client && npm test -- --run src/features/charts/__tests__/prescriptionOrderApi.test.ts
cd web-client && npm run typecheck
```

Release guard context:

```bash
bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"
```
