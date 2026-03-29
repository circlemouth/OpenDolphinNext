# Feedback Spec

この文書は、docs で裏付けられるユーザー向けフィードバックの current contract を定義します。細かな UI 実装や timing は `unknown` を維持します。

## Levels
- `success`: 完了を示す通知
- `info`: 状態変化や補助情報を示す通知
- `warn`: 注意喚起。ユーザーが次に取るべき行動を伴う
- `error`: 失敗通知。ユーザーが次に取るべき行動を伴う

## CTA Rule
- `warn` は CTA 必須です。
- `error` は CTA 必須です。
- `success` と `info` は CTA 任意です。

## Message Source
- raw API message は、docs に明示されるか user-safe 保証がある場合だけ表示対象にします。
- それ以外は canonical copy に寄せます。
- client に内部詳細や安全性未確認の文字列を露出しません。

## Canonical Copy Principles
- logout: logout 自体は継続し、cleanup を優先する
- CSRF: token 欠落や送信不可は安全側で失敗させる
- state-loss: 文脈喪失時は single re-entry route に戻す
- auth-failure: `/login` 起点で再認証させる
- fetch-failure: 安全で短い失敗文言を使う
- save-failure: 安全で短い失敗文言を使い、再試行または再入力へ導く

## Accessibility Minimum
- 色だけに依存して状態を伝えないことを最小契約とします。
- `warn` / `error` は CTA と併せて状態を判別できる必要があります。

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
