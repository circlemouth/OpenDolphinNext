# Auth Transition

この文書は、docs で裏付けられる認証遷移の current contract を整理します。UI 実装詳細や未確認 route は補完しません。

## Entry
- 認証開始地点は `/login` です。
- 認証は 1 段階目ログインを先に行い、必要時のみ factor2(TOTP) を要求します。
- 1 段階目では `POST /session/login` を使用します。
- factor2 では `POST /session/login/factor2` に 6 桁コードを送ります。
- 成功時は session rotate を前提とします。
- 旧認証切替の env switch は current runtime の契約に含めません。

## Transition Rule
- auth-sensitive transition は `replace` を正とします。
- `returnTo` は sanitize 済み internal path のみを扱います。
- `returnTo` は保存・遷移前に query と hash を scrub する前提で扱います。
- invalid または empty の `returnTo` は default post-login landing に落とします。
- default post-login landing の実 path は current docs だけでは `unknown` です。

## Factor2
- factor2 は TOTP 前提です。
- factor2 は必要時のみ要求されます。
- pending session の期限切れ、試行上限到達、または cancel 時は `/login` からやり直します。
- same-surface 2FA は improvement 案として扱い、current fact には含めません。

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
- guard の具体実装、遷移ブロック条件、default post-login landing の実 path は `unknown` です。

## Unknown
- default post-login landing の実 path
- auth guard の screen 単位の挙動
- factor2 画面の surface 分離有無

## References
- [auth-check.md](./auth-check.md)
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
