# Feedback Spec

この文書は、docs で裏付けられるユーザー向けフィードバックの current contract を定義します。細かな UI 実装や timing は `unknown` を維持します。

## Levels
- `success`: 完了を示す通知
- `info`: 状態変化や補助情報を示す通知
- `warn`: 注意喚起。必要なら次アクションを伴う
- `error`: 失敗通知。必要なら次アクションを伴う
- shared helper では `warn` を canonical とし、既存 component が受ける `warning` は adapter で吸収します。

## CTA Rule
- safe で決定的な次アクションがある場合に CTA を付けます。
- `warn` / `error` の全 surface に一律必須とはしません。
- `success` と `info` は CTA 任意です。

## Message Source
- raw API message は、docs に明示されるか user-safe 保証がある場合だけ表示対象にします。
- それ以外は canonical copy に寄せます。
- client に内部詳細や安全性未確認の文字列を露出しません。
- `PatientsPage` の edit/audit summary、`ChartsActionBar` の action/result feedback、`ReceptionPage` の accept/cancel/claim-send result は canonical copy を current contract とします。
- `ReceptionPage` の ORCA official response では、safe な `Api_Result_Message` がある場合にそれを最優先表示し、client 側の補助文言で上書きしません。
- `ReceptionPage` の accept result は `Api_Result=00` でも受付登録証跡がない場合は `notVerified` とし、`受付登録の完了証跡を確認できませんでした` を表示します。
- `ReceptionPage` の accept/cancel result は `Api_Result=21` を保険不一致、`Api_Result=60` を受付なしとして扱い、`Api_Result_Message` が空の時だけ安全な fallback copy を補います。
- `ReceptionPage` の accept/cancel result では `Api_Result=21/60` のとき受付日時・診療科・担当医などの成功コンテキストを client 側で捏造しません。
- `ReceptionPage` の claim-send success は transmission 完了だけを伝え、収納確認前に `会計済み` を示す copy へ寄せません。
- `ReceptionPage` の `再計待` 補足は correction note として独立表示し、generic memo と混在させません。
- `PatientsPage` と `AdministrationPage` の通常 surface では `endpoint`, `Api_Result_Message`, `Error.message` のような raw detail を default 表示しません。
- `PatientsPage` の保存履歴で `traceId` / `requestId` / internal status を出す場合は、default 表示ではなく support disclosure に隔離します。
- `DiagnosisEditPanel` の disease conflict/sync/manual-resolution note は canonical copy を使い、candidate や mirror の raw payload を通常面へ露出しません。
- Charts の SOAP / 文書 / オーダー保存失敗は phase と対象領域を明示し、他領域の成功状態と混同させません。SOAP は `SOAPのみ未保存`、文書は `カルテ文書保存失敗` / `紹介状モジュール保存失敗` / `設定不足` を区別し、raw backend/internal detail は通常面へ出しません。
- safe support ID として `RUN_ID` / `traceId` を出すことがあります。
- current runtime の active surface 全体が app-wide に統一済みとは断定せず、residual inventory は working note で追跡します。

## Canonical Copy Principles
- logout: logout 自体は継続し、cleanup を優先する
- CSRF: token 欠落や送信不可は安全側で失敗させる
- state-loss: 文脈喪失時は surface ごとの safe fallback に戻す
- auth-failure: `/login` 起点で再認証させる
- fetch-failure: 安全で短い失敗文言を使う
- save-failure: 安全で短い失敗文言を使い、再試行または再入力へ導く
- safe-support-id: raw detail の代わりに `RUN_ID` / `traceId` のような安全な識別子を出すことがある

## Auth Copy Matrix Minimum
- factor2 required: 本人確認のため追加確認が必要であることを説明して同一 surface の次段へ進める
- factor2 invalid: retry を促し、credentials failure と混同させない
- factor2 session missing: pending state が残っていないため login からやり直す
- factor2 session expired: 期限切れのため login からやり直す
- factor2 cancel: user が中止したことを示し、再開時は login からやり直す

## Auth Copy Minimum
- login の credentials surface はユーザーIDとパスワード入力を簡潔に案内し、factor2 surface は `ステップ 2/2` として user-visible に区別します。
- factor2 では「なぜ追加確認が出たか」を目的レベルで説明し、内部実装詳細は出しません。
- cancel / expired / retry は同一失敗文言に潰さず、再入力・再ログイン・待機の違いが分かる copy を使います。
- factor2 step では password を保持しない前提を明示します。

### Auth exception copy
- factor2 required は「追加確認が必要」であることを示し、秘密情報や内部 reason を出さない
- factor2 retry は「コード確認と再試行」を示す
- factor2 expired / session missing / cancel は同一文言に潰さず、再ログインが必要な理由を分ける
- logout / session expiry / unauthorized / forbidden は同じ「ログインしてください」だけに潰さず、 user-visible reason を分ける

## Lost-context Recovery Minimum
- lost-context の primary CTA は generic な「戻る」ではなく、`受付へ戻る` / `患者管理へ戻る` / `カルテへ戻る` のように surface 名を含めます。
- safe な `returnTo` がある場合だけ direct return を出し、fallback shortcut は補助導線として出します。
- canonical copy は「戻ったあと何を選び直すか」を 1 文で説明し、 raw backend/internal detail は使いません。
- `ReturnToBar` の direct return は safe return candidate のみを使います。
- Reception は通常業務画面として常時の `ReturnToBar` を出しません。患者文脈が成立した Charts 再開は行操作または受付/患者検索の handoff から行います。
- Reception の正常状態はツールバーに逐次表示せず、ユーザー対応が必要な状態だけ `エラー` 導線へ集約します。
- Reception の `エラー` 導線は app shell のセッション領域に置き、画面固有の検索・絞り込み操作と混在させません。

## Accessibility Minimum
- 色だけに依存して状態を伝えないことを最小契約とします。
- `warn` / `error` は CTA の有無に依らず状態を判別できる必要があります。
- touched surface の minimum は次です。
  - `LoginScreen`:
    - step banner と destination summary は `role=status` / `aria-live=polite`
    - error feedback は `role=alert` / `aria-live=assertive`
    - factor2 へ遷移したら認証コード入力へ focus を移します。
  - `ReturnToBar`:
    - recovery CTA は named `region` 内の keyboard reachable link で提供します。
    - narrow layout でも recovery hint を切り捨てず、primary CTA と `aria-describedby` で関連づけます。
  - `PatientsPage`:
    - status bar は live region で更新状態を伝え、warning note は tone に応じて assertive を使います。
    - `ApiFailureBanner` は患者一覧/検索文脈の直近に置きます。
  - `MobileImagesUploadPage`:
    - page status は stage に応じて `status` / `alert` を切り替えます。
    - missing-patient は `role=alert` で示します。
    - file picker の入口は visible button とし、narrow layout でも単一カラムの意味順を崩しません。
    - retry 後は送信ボタンへ、送信成功後は最初の参照リンクへ focus を戻します。
    - 複数の参照リンクは file 名付きの一意な accessible name を持ちます。
  - `ApiFailureBanner`:
    - retry/share は action group でまとめ、ID 未取得時の disabled 理由は `aria-describedby` で補足します。
  - `ConfirmDialog` / `FocusTrapDialog`:
    - focusable が 0 件でも dialog panel に fallback focus を持たせます。
    - pending 中は close button / Esc / backdrop / cancel を一貫して停止し、閉じられそうに見える affordance を残しません。
  - `AdministrationPage`:
    - save / test / refetch の async feedback は live region (`AdminAlert`) に集約します。
  - `LoginScreen`:
    - field validation は `aria-invalid` / `aria-describedby` で input と結びます。

## Terminology
- `success` / `info` / `warn` / `error` の 4 段で統一します。
- current docs 上、「参照カルテ」と「参照パネル」は偽統合せず、「参照系 surface」を umbrella term として扱います。

## Unknown
- app-wide `aria-live` の運用細則
- touched surface 以外の focus 移動規則
- keyboard 操作の詳細
- timeout の詳細
- feedback surface ごとの見た目実装
- residual raw-detail inventory の app-wide 完了時点

## References
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
