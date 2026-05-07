# Patient Context Contract

この文書は、患者文脈の current contract を privacy-first で整理します。route 実 path や詳細 schema は docs に証拠がない限り確定しません。

## Privacy-First Rule
- URL に患者文脈を残しません。
- `localStorage` に患者文脈を残しません。
- `sessionStorage` に患者文脈を残しません。
- deep link query は入口専用とし、処理後に scrub します。

## Authoritative Source
- authoritative source は `location.state` です。
- route ごとの入力 source 優先度は current route 実装に従い、この文書の route 別 schema に限定して明文化します。
- helper cache や module-scope の揮発メモリは implementation detail として扱います。
- 揮発メモリは補助であり、永続化や復元の根拠にしません。

## Minimal Encounter Context
- docs に置いてよい最小項目は `patientId`, `appointmentId`, `receptionId`, `scheduleKey`, `encounterKey`, `visitDate`, `departmentCode`, `physicianCode`, `insuranceCombinationNumber` です。
- ORCA chart send で authoritative に使う canonical context は別扱いで、`patientId`, `visitDate`, `departmentCode`, `physicianCode`, `insuranceCombinationNumber`, `voucherNumber`, `sequentialNumber` の 7 項目です。
- canonical context は display string や row id から再推測しません。Patients / Charts の選択結果に含まれる structured field だけを採用し、不足時は fail-close します。
- route ごとの minimal schema は次です。
  - Charts:
    - handoff には `scheduleKey` または `encounterKey` が必要です。
    - `patientId`, `appointmentId`, `receptionId`, `visitDate`, `departmentCode`, `physicianCode`, `insuranceCombinationNumber` は location state と揮発 encounter context で補助的に carry します。
    - `scheduleKey`, `encounterKey`, `departmentCode`, `physicianCode`, `insuranceCombinationNumber` は URL query に戻しません。
    - ORCA 送信は canonical context が全項目揃った時だけ有効化します。
  - Patients:
    - 読み取り対象は `patientId`, `appointmentId`, `receptionId`, `visitDate` です。
    - 入力 source 優先度は `location.state` top-level -> `location.state.encounter` -> scoped volatile encounter context です。
    - Patients 画面は route query の `patientId` を権威入力として読みません。
    - 患者選択の補助 UI でも row id を患者 ID の代替に使いません。
    - current repo では `patients:returnTo` の reader / writer を持たず、戻り導線は `useAppNavigation().safeReturnToCandidate` を正とします。
  - Mobile Images:
    - 現行の minimal schema は `patientId` のみです。
    - 入力 source 優先度は query `patientId` -> `location.state.patientId` -> deep link volatile context です。
    - query `patientId` は入口専用で、sensitive route 到達後に scrub されます。
  - 受付:
    - `visitDate` は handoff 時に正規化して carry することがありますが、単独では権威入力にしません。
    - charts handoff や row overlay の確定には `scheduleKey` / `encounterKey` を優先し、無い場合も `receptionId` / `appointmentId` を含む row-local key が一意な時だけ補助的に使います。
    - `patientId` 単独では handoff も transmission overlay も確定しません。
    - 受付登録後の一覧反映は、`acceptanceId` / `voucherNumber` / `scheduleKey` / `encounterKey` などの受付識別子がある場合だけ行います。患者情報だけの success-like response から受付文脈を生成しません。
    - 既存患者受付は ORCA official 患者として確認できた対象だけを受付可能に表示します。local search の結果だけでは `officialReadiness=unverified` とし、Patients の ORCA 取込/同期へ誘導します。

## App-Wide Navigation / Handoff Minimum
- app-wide に docs 化してよい handoff key は `from` と sanitize 済み `returnTo` です。
- `returnTo` の safe route allowlist は `reception`, `charts`, `charts/order-sets`, `charts/print/document`, `charts/print/outpatient`, `patients`, `m/images`, `administration`, `debug` を含みます。
- current repo の navigation helper が認識する screen 名は `reception`, `charts`, `orderSets`, `print`, `patients`, `admin`, `debug`, `mobileImages` です。
- safe でない `returnTo` は direct return に使わず、surface-aware fallback に落とします。
- patient context schema を app-wide に拡張せず、print / administration / debug では route 別 minimal schema が docs 未確定のままです。

## Non-Persistence
- Charts の workspace patient tabs は同一 SPA セッション内の揮発状態だけで扱います。
- document / report print preview は `location.state` のみで開き、browser storage restore を行いません。
- reload をまたいだ復元はしません。
- new tab をまたいだ復元はしません。
- bookmark をまたいだ復元はしません。
- session restart をまたいだ復元はしません。

## Re-Entry Fallback
- 文脈喪失時の fallback は single route ではなく surface ごとに異なります。
- Charts は `/f/:facilityId/charts` へ戻し、受付から再選択を案内します。
- Patients は `from=reception` なら `/f/:facilityId/reception`、それ以外は `/f/:facilityId/charts` を使います。
- Mobile Images は `from=reception` / `from=patients` を優先し、既定は `/f/:facilityId/charts` です。
- generic な「戻る」は使わず、surface-aware CTA で戻り先を明示します。
- safe な `returnTo` がある時だけ direct return を出し、無い時は surface ごとの fallback を primary CTA にします。

## URL Boundary
- query には患者関連キーと自由入力キーを残しません。
- `returnTo` の sanitize と同様に、URL は機微情報を残さない方向へ寄せます。
- scrub により deep link query を落とした時は、戻り先の画面本体へ移動することを user-visible に説明します。

## Unknown
- print / administration / debug を含む app-wide handoff state の全量 schema
- route 別 handoff state の detail UI まで含む inventory

## References
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
