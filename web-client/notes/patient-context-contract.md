# Patient Context Contract

この文書は、患者文脈の current contract を privacy-first で整理します。route 実 path や詳細 schema は docs に証拠がない限り確定しません。

## Privacy-First Rule
- URL に患者文脈を残しません。
- `localStorage` に患者文脈を残しません。
- `sessionStorage` に患者文脈を残しません。
- deep link query は入口専用とし、処理後に scrub します。

## Authoritative Source
- authoritative source は `location.state` です。
- helper cache や module-scope の揮発メモリは implementation detail として扱います。
- 揮発メモリは補助であり、永続化や復元の根拠にしません。

## Non-Persistence
- reload をまたいだ復元はしません。
- new tab をまたいだ復元はしません。
- bookmark をまたいだ復元はしません。
- session restart をまたいだ復元はしません。

## Re-Entry
- 文脈喪失時は single re-entry route に戻します。
- その route の実 path は current docs だけでは `unknown` です。
- docs 上は「患者選択起点」という抽象名で扱います。

## URL Boundary
- query には患者関連キーと自由入力キーを残しません。
- `returnTo` の sanitize と同様に、URL は機微情報を残さない方向へ寄せます。

## Unknown
- route 別 minimal encounter context の具体 schema
- 「患者選択起点」の実 path
- patients surface の current route 名
- mobile images surface の current route 名

## References
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
