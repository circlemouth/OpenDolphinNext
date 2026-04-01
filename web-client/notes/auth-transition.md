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
- `returnTo` は保存・遷移前に query と hash を scrub した internal path だけを扱います。
- `returnTo` の transport は query だけに限定せず、`location.state` と揮発文脈を併用します。
- invalid または empty の `returnTo` は default post-login landing に落とします。
- default post-login landing は `/f/:facilityId/reception` です。
- login 完了時の主な着地元は `location.state.from` です。
- unauthenticated access と session expiry は `/login` へ `replace` 遷移します。

### Redirect reason taxonomy
- `logout`: 利用者が明示的にサインアウトした
- `timeout`: セッション有効期限が切れた
- `unauthorized`: ログイン状態を確認できなかった
- `forbidden`: 権限確認に失敗した

### Landing explanation
- `location.state.from` が facility-scoped internal path なら、login 後はその画面へ戻します。
- `location.state.from` の query/hash に機微な deep link 条件が含まれる場合、login surface では「前回の画面へ戻るが詳細条件は引き継がない」と説明します。
- 実際の scrub は login helper ではなく、到達先の sensitive route 側で行う current behavior を前提とします。
- `location.state.from` が無効、login 自身、または facility-scoped でない場合は `/f/:facilityId/reception` を fallback にします。

## Factor2
- factor2 は TOTP 前提です。
- factor2 は必要時のみ要求されます。
- factor2 は `LoginScreen` 内の同一 surface 切替で扱います。
- factor2 copy は `required / invalid / session missing / session expired / cancel` を見分けます。
- factor2 surface では、追加確認が必要な理由を user-visible に説明します。
- pending session の期限切れまたは cancel 時は credentials step に戻ります。
- factor2 の `invalid` は factor2 surface に残り、`retry-after / throttled` は current step を維持したまま待機文言を表示します。
- reload 後は pending factor2 state を復元しません。

### Auth exception copy matrix
- credentials denied:
  - `ログインに失敗しました。施設ID・ユーザーID・パスワードを確認してください。`
- factor2 required:
  - `本人確認のため二要素認証が必要です。認証アプリの6桁コードを入力してください。`
- factor2 invalid:
  - `認証コードが一致しません。6桁コードを確認して再試行してください。`
- factor2 session missing:
  - `二要素認証の続きが見つかりません。施設IDとパスワードからやり直してください。`
- factor2 session expired:
  - `二要素認証の有効期限が切れました。もう一度ログインしてください。`
- factor2 cancel:
  - `二要素認証を中止しました。もう一度ログインすると認証コード入力からやり直せます。`
- retry-after / throttled:
  - `ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。`

### Factor2 surface guidance
- same-surface step-up は維持します。
- factor2 を要求する理由は、内部実装詳細ではなく「追加確認が必要」という目的レベルで説明します。
- factor2 step では password を保持せず、認証コードだけを再入力対象として扱います。
- cancel / expired / retry は同一文言に潰さず、再入力と再ログインの違いが分かる copy を使います。

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

### Guard Matrix Minimum
- 未認証で非 login route に入った場合は `/login` へ `replace` し、`state.from` に現在地を保持します。
- facility-scoped route で session 不在の場合は、facility-scoped path を `state.from` に積んだうえで `/login` へ `replace` します。
- 認証済みで login route にいる場合は、facility-scoped かつ safe な `state.from` を優先し、無効または欠落時は `/f/:facilityId/reception` へ `replace` します。
- logout は cleanup 後に `/f/:facilityId/login?reason=logout` へ `replace` し、login surface で info copy を表示します。
- `timeout / unauthorized / forbidden` は login notice を伴って `/f/:facilityId/login` へ `replace` し、login surface で理由を分けて表示します。
- `AdministrationGate` の権限不足は `/login` へ戻さず、facility-scoped denial surface と `Reception` CTA を表示します。
- sensitive route の query scrub は login helper ではなく `/reception`, `/charts`, `/patients`, `/m/images` 到達後に `replace` で行います。
- `NavigationGuardProvider` は dirty source があり `screenKey` が変わる時だけ block し、`/charts` の外部パラメータ更新は同一 `chartsScreenId` なら通します。
- `useAppNavigation()` が組み立てる `patients / charts / charts/print / charts/order-sets / m/images / administration / debug` 遷移は `guardedNavigate()` を通します。
- dirty 状態で logout または switch account を要求した時は、auth redirect 前に session exit dialog で破棄確認を取ります。

## Unknown
- `NavigationGuardProvider` の `screenKey` 粒度を超える task-specific coverage

## References
- [auth-check.md](./auth-check.md)
- [security-spec.md](./security-spec.md)
- [README.md](../README.md)
