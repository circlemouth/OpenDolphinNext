# Phase 0 Product Contract And Copy

作成日: 2026-03-30  
対象: OpenDolphinNext / `web-client`

## 1. Executive summary

このメモは、`web-client` の product improvement を quick win 実装へ進める前に、current docs の範囲で contract / acceptance / copy を固定するための Phase 0 成果物です。

今回 fix する前提は次のとおりです。

- auth-sensitive transition は `replace` 前提で扱う
- patient context は URL / `localStorage` / `sessionStorage` に保存しない
- deep link query と `returnTo` は scrub/sanitize 前提で扱う
- Charts の通常主面は `SoapNotePanel` のまま維持する
- `DocumentTimeline` / `MedicalOutpatientRecordPanel` は debug-only のまま維持する
- admin の source of truth は `/api/admin/config` のまま維持する
- raw backend/internal detail は user-facing copy に出さない
- repo-external の required checks / secrets / deploy は本メモの対象外とする

この Phase 0 で固定するのは、実装前に必要な最小 contract です。  
screen-level guard behavior、Patients / Mobile Images の source priority、admin current UI detail、a11y の細則は evidence pack を先行させます。

## 2. auth 例外 copy matrix

| trigger | user-facing message | tone | CTA | 画面遷移 | notes |
| --- | --- | --- | --- | --- | --- |
| credentials failure | ログイン情報を確認して、もう一度入力してください。 | `error` | もう一度入力する | `/login` または `/f/:facilityId/login` の credentials step に留まる | 資格情報誤りと security failure を混同しない。内部理由は出さない。 |
| factor2 required | 追加の確認が必要です。認証アプリの 6 桁コードを入力してください。 | `info` | コードを入力する | 同一 `LoginScreen` 内で factor2 step に切り替える | same-surface step-up を維持する。パスワードは credentials 成功後に保持しない。 |
| factor2 invalid | 確認コードが一致しません。最新の 6 桁コードを入力してください。 | `error` | もう一度入力する | factor2 step に留まる | 「期限切れ」と文言を混同しない。 |
| factor2 session missing | 認証の続きが見つからなかったため、はじめからやり直してください。 | `warn` | ログインからやり直す | credentials step に戻す | reload 後は factor2 state を復元しない current contract に合わせる。 |
| factor2 session expired | 確認コードの入力期限が切れたため、もう一度ログインしてください。 | `warn` | ログインからやり直す | credentials step に戻す | expired と invalid を分離する。 |
| too many requests / lockout | 試行回数が上限に達しました。少し時間をおいてから、もう一度お試しください。 | `warn` | 時間をおいて再試行 | credentials step に戻す | lockout の内部閾値や残り時間は docs に証拠がないため出さない。 |
| authentication_failed | 認証を完了できませんでした。はじめからやり直してください。 | `error` | ログインからやり直す | credentials step に戻す、または `/login` を維持する | credentials failure より広い包括エラー。詳細不明時の canonical copy。 |
| header auth mismatch / security-failure 相当 | 安全な確認ができなかったため、この操作を続けられません。ログイン画面からやり直してください。 | `error` | ログイン画面へ戻る | `/login` へ `replace`、または login surface を安全側に初期化 | CSRF / security failure / header mismatch は fail-closed を優先し、実装詳細は見せない。 |

## 3. redirect reason taxonomy

| reason key | where it appears | user-visible label | detail text | CTA | replace/push 方針 |
| --- | --- | --- | --- | --- | --- |
| `logout` | `/login` 到達時の説明、または logout 完了 banner | サインアウトしました | 安全のため、この端末の作業状態を消去してログイン画面へ戻りました。 | もう一度ログインする | `/login` へ `replace` |
| `session_expired` | `/login` 到達時の説明 | セッションの有効期限が切れました | 作業を続けるには、もう一度ログインしてください。 | ログインし直す | `/login` へ `replace` |
| `unauthorized` | `/login` 到達時、または auth guard 後の説明 | ログインが必要です | この画面を開くには認証が必要です。ログイン後に安全な画面へ移動します。 | ログインする | `/login` へ `replace` |
| `forbidden` | `/login` 到達時、または denied surface の説明 | この操作は許可されていません | 現在の権限ではこの画面を続けられません。必要な範囲からやり直してください。 | 利用可能な画面へ戻る | auth-sensitive transition は `replace` を維持 |
| `switch_account` | `/login` 到達時の説明 | 別のアカウントで続行します | いまの作業状態を閉じて、別のアカウントでログインし直してください。 | 別アカウントでログインする | `/login` へ `replace` |
| `invalid_return_to` | post-login landing 後の説明 | 元の移動先は開けませんでした | 安全のため、指定された移動先を開かず既定の画面へ移動しました。 | 既定の画面から続ける | landing は `replace` のまま、理由表示で補う |
| `empty_return_to` | post-login landing 後の説明 | 移動先が指定されていませんでした | 移動先が空だったため、既定の画面を開きました。 | 既定の画面から続ける | landing は `replace` のまま、理由表示で補う |
| `deep_link_scrub_fallback` | scrub 後の landing、または context loss 後の案内 | 共有用の情報は安全のため除外しました | URL に残せない情報を削除したため、必要な項目は画面上で選び直してください。 | 安全な画面から選び直す | scrub は `replace` を維持 |

## 4. lost-context matrix

| surface | lost-context 条件 | fallback | user-visible explanation | CTA | unresolved unknown |
| --- | --- | --- | --- | --- | --- |
| Charts | 患者文脈や encounter context が揮発し、Charts handoff に必要な `scheduleKey` または `encounterKey` を満たせない | `/f/:facilityId/charts` | 患者情報をこの画面に残さないため、対象をもう一度選び直してください。 | Reception から選び直す | route 別 minimal encounter context schema、guard behavior |
| Patients | 患者文脈が失われ、一覧から安全に再開する必要がある | `from=reception` なら `/f/:facilityId/reception`、それ以外は `/f/:facilityId/charts` | 直前の患者情報を保持しないため、元の導線に戻って選び直してください。 | 元の画面へ戻る | Patients の入力 source priority、detail UI |
| Mobile Images | 患者文脈または導線情報が失われ、アップロード対象を確定できない | `from=reception` / `from=patients` を優先し、既定は `/f/:facilityId/charts` | 画像の対象患者を安全に特定できなかったため、元の画面から選び直してください。 | 元の画面へ戻る | Mobile Images の入力 source priority、detail UI |
| Administration | auth / facility / section context を安全に継続できない、または derived view だけでは続行できない | admin root、または必要に応じて `/login` | 設定の正本は管理画面の開始地点から確認してください。必要ならログインからやり直します。 | 管理画面の先頭へ戻る | admin current UI detail、guard behavior、section hierarchy |

## 5. feedback copy catalog

### auth

| canonical copy | tone | CTA の有無 | raw detail を出さない理由 |
| --- | --- | --- | --- |
| ログイン情報を確認して、もう一度入力してください。 | `error` | あり | 資格情報エラーの内部理由を露出すると、安全性と運用詳細を不必要に漏らすため。 |
| 追加の確認が必要です。認証アプリの 6 桁コードを入力してください。 | `info` | あり | step-up の目的だけを伝えれば十分で、判定ロジックの詳細は不要なため。 |
| 認証を完了できませんでした。はじめからやり直してください。 | `error` | あり | error の内訳が未確定な場合でも、安全な再開手順を案内できるため。 |
| 安全な確認ができなかったため、この操作を続けられません。ログイン画面からやり直してください。 | `error` | あり | CSRF や security failure の詳細は攻撃面と実装面の情報になり得るため。 |

### state-loss

| canonical copy | tone | CTA の有無 | raw detail を出さない理由 |
| --- | --- | --- | --- |
| この画面では前の患者情報を保持しないため、もう一度選び直してください。 | `warn` | あり | 揮発文脈の仕組みや内部 state 名を出さずに、再開手順だけ伝えれば足りるため。 |
| URL に残せない情報を除外したため、必要な項目を画面上で選び直してください。 | `info` | あり | scrub 対象キーや sanitize 処理の内部仕様を露出する必要がないため。 |

### fetch-failure

| canonical copy | tone | CTA の有無 | raw detail を出さない理由 |
| --- | --- | --- | --- |
| 情報を読み込めませんでした。時間をおいて、もう一度お試しください。 | `error` | あり | backend 名、URL、例外内容を出さなくても再試行案内は成立するため。 |
| 必要な情報を安全に確認できませんでした。前の画面からやり直してください。 | `warn` | あり | fetch failure と state mismatch が混ざる場合でも安全側の誘導を優先するため。 |

### save-failure

| canonical copy | tone | CTA の有無 | raw detail を出さない理由 |
| --- | --- | --- | --- |
| 保存できませんでした。内容を確認して、もう一度お試しください。 | `error` | あり | validation 詳細や内部例外をそのまま出すと user-safe でない可能性があるため。 |
| 保存を完了できませんでした。必要なら入力し直して、再度保存してください。 | `error` | あり | 保存失敗の内部種別が未整理でも、次の安全な操作は一定にできるため。 |

### logout partial success

| canonical copy | tone | CTA の有無 | raw detail を出さない理由 |
| --- | --- | --- | --- |
| サインアウトしました。この端末の作業状態は削除しました。 | `info` | あり | logout API の unsupported / failure を user に説明しすぎる必要がないため。 |
| サインアウトは完了しました。必要に応じて、もう一度ログインしてください。 | `info` | あり | server-side logout 実装差や監査ログの都合は user-facing copy に含めないため。 |

### feature disabled

| canonical copy | tone | CTA の有無 | raw detail を出さない理由 |
| --- | --- | --- | --- |
| この機能は現在利用できません。利用可能な画面から続けてください。 | `warn` | あり | feature flag や server capability の内部条件を出す必要がないため。 |
| この画面は現在の設定では使用しません。別の導線から続けてください。 | `info` | あり | deprecated / debug-only / blocked route の内部事情を user-facing に露出しないため。 |

## 6. a11y minimum

### 色だけに依存しない
- `success` / `info` / `warn` / `error` は色だけでなく、見出し文言または明示的ラベルで判別できること。
- CTA の有無に関係なく、状態の意味がテキストで伝わること。

### live region をどこで使うか
- route 遷移を伴わない auth / state-loss / fetch/save failure の通知は、ページ内の共通 feedback 領域で読み上げ可能にする。
- credentials step から factor2 step への同一 surface 切替時は、段階変更が伝わる読み上げ対象を 1 か所に絞る。
- 同じ意味の通知を複数 live region で重複送出しない。

### focus をどこで移すか
- `/login` へ `replace` 遷移した直後は、理由説明またはページ見出しに最初の focus を移す。
- same-surface の factor2 step 切替時は、factor2 見出しまたはコード入力欄に focus を移す。
- save/fetch failure で入力継続が必要な場合は、先に失敗通知を認識できる位置へ寄せ、その後に再入力対象へ移動できること。

### keyboard 操作で最低限守ること
- login credentials step と factor2 step は、キーボードだけで入力、送信、キャンセル、再試行ができること。
- fallback CTA は Tab 移動順で到達でき、文脈喪失時に pointer 依存にならないこと。
- feedback 表示によって主要フォームや主要 CTA が keyboard trap にならないこと。

### narrow layout で崩してはいけない順序
- 1. 状態説明
- 2. 現在の task に必要な primary action
- 3. 補助説明
- 4. secondary action
- narrow layout でも、理由説明より CTA が先に来て意味が逆転しないこと。
- Charts 系では主面の説明より debug-only / 補助面を先頭に出さないこと。

## 7. unresolved unknowns

| 論点 | なぜ今は決めないか | 誰が証拠を取るべきか | 実装に進む条件 |
| --- | --- | --- | --- |
| auth guard の screen-level 挙動 | docs は inventory のみで behavior を固定していないため | Codex | route × guard × trigger × landing の evidence matrix が取れること |
| route 別 minimal encounter context schema | docs は minimal keys までで止まっているため | Codex | Charts / Patients / Mobile Images ごとの required state が repo truth で確認できること |
| Patients の入力 source 優先度 | docs が unknown と明記しているため | Codex | source 一覧と優先度が code-confirmation で取れること |
| Mobile Images の入力 source 優先度 | docs が unknown と明記しているため | Codex | source 一覧と優先度が code-confirmation で取れること |
| admin current UI detail | `/api/admin/config` SoT 以外は intentionally thin なため | Codex | section hierarchy / naming / sub-navigation の inventory が揃うこと |
| auto-sync / auto-action current behavior | docs に current behavior の契約がないため | Codex | 発火条件、visible state、user control の evidence が揃うこと |
| comparison / latest-follow current behavior | Charts 主従面の詳細判断に必要だが docs で未固定のため | Codex | 比較系 UI が主面か補助面か repo truth で分類できること |
| `aria-live` / focus / keyboard の詳細実装 | Phase 0 では minimum だけ固定し、widget 単位の実装詳細は evidence 不足のため | Codex | current repo の実装監査と narrow layout / keyboard audit が揃うこと |
| pane geometry / narrow layout order の細部 | current docs では unknown のまま維持されているため | Codex | screenshot audit と route ごとの stacking evidence が揃うこと |
| logout partial success の現行表現 | copy は固定できても、現実装との差分確認が未了のため | Codex | 現行 copy と logout failure path の behavior が確認できること |

## 8. implementation handoff notes

### 今すぐ実装に入ってよい項目
- BL-01 auth/2FA 例外 copy matrix の docs 反映
- BL-02 login → factor2 の段階表示と目的説明
- BL-03 `/login` へ戻された理由表示の基本 taxonomy
- BL-05 surface-aware lost-context copy の基本整備
- BL-09 feedback / recovery copy の canonical 化
- BL-10 のうち、色非依存・見出し付き状態表現・最低限の live/focus 方針

### 先に evidence pack が必要な項目
- guard matrix を前提にした route ごとの redirect acceptance の固定
- Patients / Mobile Images の source priority を前提にした細かな CTA 分岐
- patient/encounter bar の route 別 required state 固定
- admin IA の detail 設計
- auto-sync / auto-action / comparison / latest-follow を含む Charts 深掘り
- narrow layout / keyboard / aria-live の widget 単位詳細

### 今回 intentionally 決めない項目
- patient context の永続化や復元を前提にした UX
- `replace` を `push` へ変える前提の解決策
- `DocumentTimeline` / `MedicalOutpatientRecordPanel` を通常主面へ戻す案
- `/api/admin/delivery` を第 2 正本に戻す案
- repo-external の required checks / secrets / deploy order
- Patients / Mobile Images / Administration の detail UI を docs だけで断定すること
