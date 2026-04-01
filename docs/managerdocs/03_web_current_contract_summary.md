# 03. Web current contract summary

この文書は、web-client の current contract を **manager が素早く把握できる粒度** でまとめた要約です。  
実装詳細まで断定しない方が安全なものは、明示的に `unknown` と書きます。

---

## 1. この文書で扱うもの

- auth / factor2 / logout
- patient context / deep link / returnTo
- feedback / recovery
- route / guard / surface の inventory
- release / verification の境界

この文書で扱わないもの:
- repo-external settings の現況
- server 側の実装詳細
- docs に証拠がない UI 詳細の推測

---

## 2. auth current contract

### 2-1. 入口
- 認証開始地点は `/login`
- 施設確定後の login route は `/f/:facilityId/login`

### 2-2. 1 段階目ログイン
- `POST /session/login`
- 送信項目: `facilityId`, `userId`, `password`, `clientUuid`
- 1 段階目成功後、password は client state / DOM から除去

### 2-3. factor2
- 必要時のみ factor2(TOTP) を要求
- `POST /session/login/factor2`
- 6 桁コードを送る
- factor2 は `LoginScreen` 内の同一 surface 切替
- pending session の期限切れ、session missing、cancel 時は credentials step に戻る
- `invalid` は factor2 surface に残る
- `429` は current step に留まり待機文言を出す
- reload 後に pending factor2 state は復元しない

### 2-4. 着地
- `returnTo` は sanitize 済み internal path のみ
- invalid / empty の `returnTo` は `/f/:facilityId/reception`
- login 完了時の主な着地元は `location.state.from`
- unauthenticated access と session expiry は `/login` に `replace`
- deep-link scrub は login 前ではなく sensitive route 到達後に行う
- admin 権限不足は `/login` へ飛ばさず facility-scoped denial surface に留める

### 2-5. logout
- logout は cleanup 優先
- `/login` へ `replace`
- 順序:
  1. サーバ logout API を best-effort 実行
  2. client storage cleanup
  3. shared auth cleanup
  4. `/login` へ `replace`

### 2-6. unknown
- unsaved-changes dialog を含む task-oriented guard matrix
- `clientUuid` の lifecycle 詳細
- 2FA の backup code / trusted device / recovery flow の有無

---

## 3. patient context current contract

### 3-1. privacy-first
- URL に患者文脈を残さない
- `localStorage` に患者文脈を残さない
- `sessionStorage` に患者文脈を残さない
- deep link query は入口専用で処理後に scrub
- reload / new tab / bookmark / session restart をまたぐ復元はしない

### 3-2. source of truth
- authoritative source は `location.state`
- route 別の解決順は current route 実装に従う
- Patients:
  `location.state` top-level -> `location.state.encounter` -> volatile encounter
- Mobile Images:
  `query patientId` -> `location.state.patientId` -> deep link volatile context

### 3-3. minimal encounter context
docs に置いてよい最小項目:
- `patientId`
- `appointmentId`
- `receptionId`
- `scheduleKey`
- `encounterKey`
- `visitDate`

Charts handoff では `scheduleKey` または `encounterKey` が必要
- Patients は `patientId` 中心で `appointmentId / receptionId / visitDate` を読む
- Mobile Images は `patientId` のみで成立する

### 3-4. fallback
- Charts: `/f/:facilityId/charts` に戻し、Reception から再選択を案内
- Patients: `from=reception` なら `/f/:facilityId/reception`、それ以外は `/f/:facilityId/charts`
- Mobile Images: `from=reception` / `from=patients` を優先し、既定は `/f/:facilityId/charts`

### 3-5. unknown
- print / administration を含む app-wide handoff state の詳細 schema

---

## 4. feedback / recovery current contract

### 4-1. 4 段 taxonomy
- `success`
- `info`
- `warn`
- `error`

### 4-2. CTA ルール
- safe で決定的な次アクションがある時だけ CTA を付ける
- `warn` / `error` の全 surface に一律必須とはしない
- `success` と `info` は CTA 任意

### 4-3. raw detail の扱い
- raw API message は docs に明示されるか user-safe 保証がある場合だけ
- それ以外は canonical copy を default にする
- `ApiFailureBanner`、route render error、Patients / Charts / Reception の current action-result surface は canonical copy を優先する
- active runtime 全面で app-wide 完了とは断定せず、残差は working note で管理する
- raw detail の代わりに `RUN_ID` / `traceId` のような安全な識別子を出すことがある

### 4-4. canonical principles
- logout: cleanup 優先
- CSRF: token 欠落や送信不可は安全側で失敗
- state-loss: surface ごとの safe fallback に戻す
- auth-failure: `/login` 起点で再認証
- fetch-failure: 安全で短い失敗文言
- save-failure: 安全で短い失敗文言 + 再試行 or 再入力

### 4-5. a11y minimum
- 色だけに依存して状態を伝えない
- touched surface では live region / focus / keyboard reachable CTA を個別に固定する
- app-wide ルールはまだ fixed にしない

### 4-6. unknown
- `aria-live` の運用細則
- focus 移動規則
- keyboard 操作の詳細
- timeout の詳細
- feedback surface ごとの見た目実装

---

## 5. route / surface inventory

## 5-1. route inventory
- `/login`
- `/f/:facilityId/login`
- `/f/:facilityId/reception`
- `/f/:facilityId/patients`
- `/f/:facilityId/charts`
- `/f/:facilityId/charts/order-sets`
- `/f/:facilityId/charts/print/outpatient`
- `/f/:facilityId/charts/print/document`
- `/f/:facilityId/m/images`
- `/f/:facilityId/administration`

## 5-2. guard inventory
- `FacilityGate`
- `FacilityShell`
- `AdministrationGate`
- `NavigationGuardProvider`

## 5-3. Charts surface
- normal runtime の中心 surface は `SoapNotePanel`
- `PastHubPanel` は historical reference の補助 surface
- `latest-follow` は `SoapNotePanel` / `PastHubPanel` / `ChartsActionBar` の局所補助で、独立 route はない
- `OrcaSummary` は補助 panel
- `DocumentTimeline` と `MedicalOutpatientRecordPanel` は debug-only surface
- deep link query は scrub
- reload 復元なし

### manager メモ
DocumentTimeline を通常の主画面として設計し直さないこと。  
normal runtime の中心は `SoapNotePanel` 側です。

## 5-4. Admin surface
- source of truth は `/api/admin/config`
- `/api/admin/delivery` を第 2 正本に戻さない
- top-level tab は `delivery / orca-users / master-updates`
- `delivery` 配下は `dashboard / connection / config / queue / operations / debug`

---

## 6. verification / release 境界

### 6-1. release 前 mandatory
- `cd web-client && npm run ci`
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
- `cd web-client && node scripts/runtime-ready-smoke.mjs`

### 6-2. verification 境界
- runtime smoke は release 前 mandatory
- ただし screen-level coverage を何でも担保するとまでは断定しない
- debug-only surface の常時表示までは runtime smoke の期待値に含めない

### 6-3. repo-external unknown
- GitHub required checks の現設定
- `runtime-ready-smoke.mjs` を every PR required にするか
- production secrets / config の投入状況

---

## 7. manager にとっての意味

この current contract から manager が読み取るべきことは次です。

1. auth-sensitive transition は安全寄りで、Back 復元ではなく `replace` と理由表示で解く
2. patient context は保持を増やして解決しない。再入場導線を設計する
3. Charts の通常主面は `SoapNotePanel`。debug-only surface に依存した設計へ戻さない
4. admin は `config` 単線化を崩さない
5. feedback は canonical copy 優先。raw internal detail は user-visible に出さない
6. repo-local の contract を変える前に、repo-external sign-off を先に閉じる
