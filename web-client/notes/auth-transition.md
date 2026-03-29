# Auth Transition

この文書は、docs で裏付けられる認証遷移の current contract を整理します。UI 実装詳細や未確認 route は補完しません。

## Entry
- 認証開始地点は `/login` です。
- 施設確定後の login route は `/f/:facilityId/login` です。
- 認証は 1 段階目ログインを先に行い、必要時のみ factor2(TOTP) を要求します。
- 1 段階目では `POST /session/login` を使用します。
- factor2 では `POST /session/login/factor2` に 6 桁コードを送ります。
- 成功時は session rotate を前提とします。
- 旧認証切替の env switch は current runtime の契約に含めません。

## Transition Rule
- auth-sensitive transition は `replace` を正とします。
- `returnTo` は sanitize 済み internal path のみを扱います。
- `returnTo` は保存・遷移前に query と hash を scrub する前提で扱います。
- `returnTo` の transport は query だけに限定せず、`location.state` と揮発文脈を併用します。
- invalid または empty の `returnTo` は default post-login landing に落とします。
- default post-login landing は `/f/:facilityId/reception` です。
- login 完了時の主な着地元は `location.state.from` です。
- unauthenticated access と session expiry は `/login` へ `replace` 遷移します。

## Factor2
- factor2 は TOTP 前提です。
- factor2 は必要時のみ要求されます。
- factor2 は `LoginScreen` 内の同一 surface 切替で扱います。
- pending session の期限切れ、試行上限到達、または cancel 時は credentials step に戻ります。
- reload 後は pending factor2 state を復元しません。

### Auth exception copy matrix
- credentials mismatch:
  - `ログインに失敗しました。施設ID・ユーザーID・パスワードを確認してください。`
- factor2 required:
  - `施設IDとユーザーIDの確認が完了しました。続けて二要素認証コードを入力してください。`
- factor2 retry:
  - `認証コードが一致しません。6桁コードを確認して再試行してください。`
- factor2 expired:
  - `二要素認証の確認時間が過ぎました。もう一度ログインしてください。`
- factor2 session missing:
  - `二要素認証の確認状態が見つかりませんでした。もう一度ログインしてください。`
- factor2 cancel:
  - `二要素認証をキャンセルしました。必要な場合はもう一度ログインしてください。`
- rate limit:
  - `ログイン試行回数が上限に達しました。...後に再試行してください。`

### Same-surface explanation
- factor2 は credentials step と同一 surface で段階表示します。
- factor2 step では「施設IDとユーザーIDの確認が完了した後の追加確認」であることだけを説明し、内部実装詳細は出しません。
- factor2 step へ進んだ後も password は client state / DOM に残しません。

## Logout
- logout は cleanup を優先し、`/login` へ `replace` 遷移します。
- security の正本にある logout 順序は次です。
  1. サーバ logout API を best-effort 実行
  2. クライアント側 storage cleanup
  3. shared auth cleanup
  4. `/login` へ replace 遷移

## Guard / ReturnTo Boundary
- `returnTo` は保存・遷移前に sanitize が必要です。
- internal path 以外を current contract に含めません。
- guard は認証遷移の補助境界として扱い、認可完了の根拠にはしません。
- guard の具体実装と遷移ブロック条件の詳細は `unknown` です。

## Unknown
- auth guard の screen 単位の挙動

## References
- [auth-check.md](./auth-check.md)
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
