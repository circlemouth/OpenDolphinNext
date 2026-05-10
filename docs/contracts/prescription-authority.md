# Prescription Authority Contract

## Purpose

OpenDolphinNext の処方指示は、診療録や ORCA 診療行為送信候補とは別の local authoritative record として扱う。ORCA 送信候補はこの正本から作るが、ORCA 正本そのものではない。

## Storage Boundary

- `prescription_order` は処方指示の現在状態を保持する。
- `prescription_order_revision` は DRAFT / FINAL / 変更後の revision を保持する。
- `prescription_order_item` は薬剤コード、薬剤名、規格、剤形、用法、用量、単位、日数、院内/院外、内服/外用/注射/頓用、一般名処方フラグ、医師コメントを構造化列として保持する。
- `prescription_order_event` は create / finalize / change / stop / cancel / reissue の append-only event として扱う。
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
- `FINAL` / `CHANGED` / `STOPPED` / `CANCELLED` / `REISSUED` の処方 order / revision / item は直接 UPDATE / DELETE できない。
- 確定後の変更、中止、取消、再発行は新 revision と `prescription_order_event` により表現する。
- `prescription_order_event` は append-only で、UPDATE / DELETE は DB trigger が拒否する。
- client 由来の facility / owner / role / voucher / sequential / insurance combination / storage key / digest / URL は処方正本の権威情報にしない。API 実装では認証 context、server-side encounter projection、DB 状態から再解決する。

## Misuse Cases Covered

- client が FINAL 済み処方の `patient_id` や内容を直接書き換える。
- DO import や local draft 保存経路が、会計待ち・閉鎖済み encounter の処方 payload を上書きする。
- client が event を UPDATE / DELETE して変更・取消履歴を消す。
- client が構造化 item ではなく payload JSON だけで ORCA candidate を作らせ、未解決薬剤や用法を隠す。

## Verification

Focused server verification:

```bash
mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=PrescriptionAuthoritySchemaTest,FreshSchemaBaselineTest test
```

Release guard context:

```bash
bash server-modernized/tools/ci/check-finalized-write-guards.sh --root "$(git rev-parse --show-toplevel)"
```
