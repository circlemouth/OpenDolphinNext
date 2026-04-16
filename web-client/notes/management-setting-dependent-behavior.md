# Management Setting 依存インベントリ

この note は、管理画面で見える setting dependency の source of truth を固定します。`/api/admin/config` を facility setting 全体の正本として拡張せず、owner が未証明の項目は feature-off / fail-close で扱います。

## 固定方針
- `/api/admin/config` は charts delivery only。
- `/api/admin/orca/connection` は施設別 ORCA 接続設定 only。
- `/api/admin/orca/capabilities` は capability / testedScope only。
- runtime-owned setting は `docs/contracts/runtime-config.md` と server runtime を正本とし、client は補完しない。
- ORCA correction note と setting note は同じ slot に混ぜない。
- UG-14 未解決項目は `unknown` のまま残し、UI に toggle / success badge を出さない。

## Authoritative Source Inventory
| category | source of truth | owner | current examples | fallback |
| --- | --- | --- | --- | --- |
| admin config | `/api/admin/config` | admin config store | `chartsDisplayEnabled`, `chartsSendEnabled`, `chartsMasterSource` | charts delivery 以外は受け付けず reject |
| connection | `/api/admin/orca/connection` | facility ORCA connection owner | `serverUrl`, `port`, `username`, `pushUrl`, `pushTenantId`, mTLS material presence | 接続設定未取得時は read-only / 再取得案内 |
| capability | `/api/admin/orca/capabilities` | admin capability owner | `testedScope`, internal wrapper visibility | 未証明なら success 扱いせず `このテストでは未検証` |
| runtime-owned | [`docs/contracts/runtime-config.md`](../../docs/contracts/runtime-config.md) | runtime / deploy owner | `orca.mode`, `orca.acceptmod.suppress-acceptance-push`, optional module visibility owner が runtime の場合 | client は toggle を出さず runtime note へ誘導 |
| unknown | repo truth に source が無い項目 | UG-14 gate | optional module visibility owner 不明、general-name owner、disease auto-send owner | UI 非表示 / feature-off / fail-close |

## 管理画面への反映
- `config` section:
  - charts delivery のみ表示・保存する。
  - connection / capability / runtime-owned setting はここへ混ぜない。
- `connection` section:
  - access verified / ORCA connected / testedScope / Push 保存状態を別 line で扱う。
  - testedScope は capability の説明であり、Push 保存状態の代用品にしない。
- `debug` section:
  - capability が無い wrapper は表示しない。
  - testedScope 未証明の optional 項目を success と表示しない。

## Unknown Handling
- owner 不明の setting は default-on にしない。
- server response に field が無くても、client は guessed toggle を増やさない。
- docs に source が無い optional module は visible action ではなく gate として扱う。

## References
- [ui-current-contract.md](./ui-current-contract.md)
- [docs/contracts/runtime-config.md](../../docs/contracts/runtime-config.md)
- [docs/contracts/orca-connection.md](../../docs/contracts/orca-connection.md)
