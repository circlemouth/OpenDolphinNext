# Patient Context Contract

この文書は、患者文脈の current contract を privacy-first で整理します。route 実 path や詳細 schema は docs に証拠がない限り確定しません。

## Privacy-First Rule
- URL に患者文脈を残しません。
- `localStorage` に患者文脈を残しません。
- `sessionStorage` に患者文脈を残しません。
- deep link query は入口専用とし、処理後に scrub します。

## Authoritative Source
- authoritative source は `location.state` です。
- 実際の解決順は `location.state -> URL scrub 後に残る情報 -> returnTo 由来 -> volatile` です。
- helper cache や module-scope の揮発メモリは implementation detail として扱います。
- 揮発メモリは補助であり、永続化や復元の根拠にしません。

## Minimal Encounter Context
- docs に置いてよい最小項目は `patientId`, `appointmentId`, `receptionId`, `scheduleKey`, `encounterKey`, `visitDate` です。
- Charts handoff では `scheduleKey` または `encounterKey` が必要です。

## Non-Persistence
- reload をまたいだ復元はしません。
- new tab をまたいだ復元はしません。
- bookmark をまたいだ復元はしません。
- session restart をまたいだ復元はしません。

## Re-Entry Fallback
- 文脈喪失時の fallback は single route ではなく surface ごとに異なります。
- Charts は `/f/:facilityId/charts` へ戻し、Reception から再選択を案内します。
- Patients は `from=reception` なら `/f/:facilityId/reception`、それ以外は `/f/:facilityId/charts` を使います。
- Mobile Images は `from=reception` / `from=patients` を優先し、既定は `/f/:facilityId/charts` です。

## URL Boundary
- query には患者関連キーと自由入力キーを残しません。
- `returnTo` の sanitize と同様に、URL は機微情報を残さない方向へ寄せます。

## Unknown
- route 別 handoff state の詳細 schema
- Patients / Mobile Images の全入力 source の優先度細則

## References
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
