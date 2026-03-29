# Feedback Spec

この文書は、docs で裏付けられるユーザー向けフィードバックの current contract を定義します。細かな UI 実装や timing は `unknown` を維持します。

## Levels
- `success`: 完了を示す通知
- `info`: 状態変化や補助情報を示す通知
- `warn`: 注意喚起。必要なら次アクションを伴う
- `error`: 失敗通知。必要なら次アクションを伴う

## CTA Rule
- safe で決定的な次アクションがある場合に CTA を付けます。
- `warn` / `error` の全 surface に一律必須とはしません。
- `success` と `info` は CTA 任意です。

## Message Source
- raw API message は、docs に明示されるか user-safe 保証がある場合だけ表示対象にします。
- それ以外は canonical copy に寄せます。
- client に内部詳細や安全性未確認の文字列を露出しません。

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
- login/factor2 は `ステップ 1/2` と `ステップ 2/2` を user-visible に区別します。
- factor2 では「なぜ追加確認が出たか」を目的レベルで説明し、内部実装詳細は出しません。
- cancel / expired / retry は同一失敗文言に潰さず、再入力・再ログイン・待機の違いが分かる copy を使います。
- factor2 step では password を保持しない前提を明示します。

### Auth exception copy
- factor2 required は「追加確認が必要」であることを示し、秘密情報や内部 reason を出さない
- factor2 retry は「コード確認と再試行」を示す
- factor2 expired / session missing / cancel は同一文言に潰さず、再ログインが必要な理由を分ける
- logout / session expiry / unauthorized / forbidden は同じ「ログインしてください」だけに潰さず、 user-visible reason を分ける

## Accessibility Minimum
- 色だけに依存して状態を伝えないことを最小契約とします。
- `warn` / `error` は CTA の有無に依らず状態を判別できる必要があります。

## Terminology
- `success` / `info` / `warn` / `error` の 4 段で統一します。
- current docs 上、「参照カルテ」と「参照パネル」は偽統合せず、「参照系 surface」を umbrella term として扱います。

## Unknown
- `aria-live` の運用細則
- focus 移動規則
- keyboard 操作の詳細
- timeout の詳細
- feedback surface ごとの見た目実装

## References
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
