# Web クライアント プロダクト改善 実行計画

作成日: 2026-03-29
対象: OpenDolphinNext / web-client

## 1. この計画の目的

この計画は、WEB クライアントのプロダクト改善を **release blocker と混線させず**、かつ **current contract を壊さず** に前進させるための実行順序を固定するものです。

この作業では、以下を優先します。

1. 安全な遷移の説明不足を減らす
2. lost-context / auth / logout / session expiry の納得感を上げる
3. unknown を推測で埋めず、証拠取りと実装を分離する
4. 変更は docs・copy・UI・tests をまとめた小さな slice で進める

## 2. 前提

- repo-local の closeout は済んでいる。新しい repo-local cleanup wave は切らない。
- UI 改善は non-blocking backlog として扱う。
- ただし、プロダクト改善トラック自体は独立して前進してよい。
- repo-external sign-off は別 lane で継続し、UI backlog と混ぜない。

## 3. 進め方の原則

### 3-1. 先に contract を決める
いきなり UI 実装に入らず、まず Phase 0 の docs / acceptance を固める。
特に以下は先行確定する。

- auth 例外 copy matrix
- redirect reason taxonomy
- surface 別 lost-context matrix
- CTA 付与条件
- feedback copy catalog の骨子
- a11y minimum の最小契約

### 3-2. unknown は evidence pack を出してから扱う
次は即実装しない。

- auth guard screen-level behavior
- Patients / Mobile Images の source priority
- route 別 minimal encounter context schema
- admin current UI detail
- auto-sync / auto-action 現況
- narrow layout / keyboard / aria-live 細則

unknown は先に Codex で code-confirmation を取り、
`MATCH / DOCS_UNDER_SPEC / DOCS_OVER_ASSERT / TRUE_REGRESSION / UNKNOWN`
へ分類してから設計・実装へ進む。

### 3-3. 1 slice 1 論点で小さく進める
各 slice は次を必須にする。

- docs 更新または docs 整合確認
- UI 実装
- tests 更新
- acceptance の明文化
- 次 slice への未解決事項の整理

### 3-4. 守るべき guardrail
- patient context を URL / localStorage / sessionStorage に永続化しない
- auth-sensitive transition の `replace` 前提を勝手に崩さない
- `DocumentTimeline` / `MedicalOutpatientRecordPanel` を通常主面へ昇格しない
- admin の SoT を `/api/admin/config` からずらさない
- raw backend/internal detail を user-visible copy に出さない
- repo-external の required checks / secrets / deploy order を UI backlog に混ぜない

## 4. 優先順位

### 最優先 quick win
1. BL-01 auth/2FA 例外 copy matrix
2. BL-05 lost-context fallback UX matrix
3. BL-02 login → factor2 視線設計
4. BL-03 returnTo / guard / logout 後導線

### 次点
5. BL-09 feedback / recovery 一貫化
6. BL-10 a11y / narrow layout / keyboard minimum

### 証拠取り先行
7. BL-04 guard matrix
8. BL-11 Patients / Mobile Images unknown 解消
9. BL-12 admin IA 単線化の前提 inventory
10. BL-08 auto-sync / auto-action 可視化

### 後続
11. BL-06 patient/encounter bar
12. BL-07 Charts 主従面設計
13. BL-13 route inventory / productivity
14. BL-14 deep link scrub の納得感 microcopy

## 5. 実行フェーズ

## Phase A: Contract / copy freeze（ChatGPT）
### 目的
実装前に acceptance と文言を固定する。

### 成果物
- auth exception copy matrix
- redirect reason taxonomy
- lost-context surface matrix
- CTA 付与条件
- feedback copy catalog v1
- a11y minimum memo
- unresolved unknown list

### 完了条件
- BL-01 / BL-05 / BL-02 / BL-03 / BL-09 / BL-10 の実装前提が markdown で確定している
- unknown を推測で埋めていない

## Phase B: Evidence pack（Codex, read-first）
### 目的
unknown を repo truth で確認し、以後の実装可否を分類する。

### 調査対象
- auth guard / redirect matrix
- Patients source priority
- Mobile Images source priority
- route 別 minimal encounter context schema
- admin current UI detail
- auto-sync / auto-action 現況
- a11y / focus / keyboard / narrow layout の現況

### 成果物
- evidence matrix
- classification sheet
- 実装してよい範囲 / まだ止める範囲

### 完了条件
- BL-04 / BL-11 / BL-12 / BL-08 / BL-10 の前提が repo evidence で確認済み
- 未確定は `UNKNOWN` のまま残し、根拠付きで保留されている

## Phase C: Quick win implementation（Codex, code changes）

### Slice 1: BL-01 + BL-02
対象:
- auth 例外 copy matrix
- login → factor2 の段階表示
- factor2 目的説明
- cancel / expired / retry の見せ分け

変更候補 touchpoint:
- `web-client/notes/auth-transition.md`
- `web-client/notes/feedback-spec.md`
- `web-client/src/LoginScreen.tsx`
- `web-client/src/features/login/loginErrorMessage.ts`
- `web-client/src/__tests__/LoginScreen.test.tsx`
- `web-client/src/features/login/__tests__/loginErrorMessage.test.ts`

完了条件:
- credentials step と factor2 step の区別が視覚的に分かる
- factor2 failure / expired / reset の copy が matrix と一致する
- tests が新 contract を固定する

### Slice 2: BL-03 + BL-14
対象:
- `/login` へ戻された理由表示
- logout / session expiry / unauthorized / forbidden の理由出し分け
- scrub 後の着地説明
- `replace` の納得感を補う microcopy

変更候補 touchpoint:
- `web-client/src/AppRouter.tsx`
- `web-client/src/libs/session/sessionExpiry.ts`
- `web-client/src/routes/useAppNavigation.ts`
- `web-client/src/__tests__/AppRouter.login-redirect.test.tsx`
- `web-client/src/AppRouter.navigation.test.tsx`
- `web-client/notes/auth-transition.md`
- `web-client/notes/patient-context-contract.md`

完了条件:
- `/login` 到達時に「なぜ戻ったか」が user-visible で説明される
- invalid / empty `returnTo` や scrub の結果が納得できる copy になる
- `replace` を `push` に変えずに confusion を下げる

### Slice 3: BL-05 + BL-09
対象:
- surface 別 lost-context CTA
- recovery / feedback 文言統一
- shared return guidance の実体化

変更候補 touchpoint:
- `web-client/src/features/shared/ReturnToBar.tsx`
- `web-client/src/features/shared/__tests__/ReturnToBar.test.tsx`
- `web-client/src/features/images/pages/MobileImagesUploadPage.tsx`
- `web-client/src/features/patients/PatientsPage.tsx`
- 必要に応じて shared banner / error helper 群
- `web-client/notes/feedback-spec.md`
- `web-client/notes/patient-context-contract.md`

完了条件:
- generic な「戻る」ではなく surface-aware CTA が出る
- auth / state-loss / fetch / save の copy が catalog と整合する
- raw detail を出さずに次アクションが分かる

### Slice 4: BL-10（必要なら）
対象:
- aria-live / focus / keyboard / narrow layout の最小契約を docs と実装で合わせる

変更候補 touchpoint:
- `web-client/notes/feedback-spec.md`
- `web-client/notes/ui-current-contract.md`
- `web-client/src/LoginScreen.tsx`
- `web-client/src/features/shared/*`
- `web-client/src/routes/NavigationGuardProvider.tsx`
- 関連 test 群

完了条件:
- 「色だけに依存しない」から一歩進み、最小の focus/live rule が固定される

## Phase D: Evidence-driven design backlog
以下は quick win の後に進める。

- BL-06 patient/encounter bar
- BL-07 Charts 主従面設計
- BL-08 auto-sync / auto-action 可視化
- BL-11 Patients / Mobile Images inventory
- BL-12 admin IA 単線化
- BL-13 task-oriented transition matrix

## 6. 週次運用

### 今週の指示
1. ChatGPT で Phase A を先に完了させる
2. Codex で Phase B の evidence pack を取る
3. evidence が揃った範囲だけ Slice 1 に入る
4. Slice 1 完了後に Slice 2、Slice 3 の順で進む
5. BL-06 以降は evidence pack 前に着手しない

### 週内の期待アウトプット
- 月: Phase A ドラフト
- 火: Phase A 確定
- 水: Phase B evidence pack
- 木: Slice 1 実装開始
- 金: Slice 1 review / Slice 2 着手判断

## 7. Issue / PR の切り方

### Epic A: Auth / redirect recovery quick wins
- Issue A1: auth exception copy matrix
- Issue A2: login → factor2 step UX
- Issue A3: login redirect reason taxonomy
- Issue A4: session expiry / logout message alignment

### Epic B: Lost-context / feedback quick wins
- Issue B1: lost-context surface matrix
- Issue B2: ReturnToBar shared component 実装
- Issue B3: recovery copy catalog
- Issue B4: scrub-after-landing microcopy

### Epic C: Evidence pack
- Issue C1: guard matrix
- Issue C2: Patients / Mobile Images source priority inventory
- Issue C3: admin current UI inventory
- Issue C4: a11y / focus / narrow layout current behavior audit

## 8. Stop / Go ルール

### Go
- current contract と矛盾しない
- unknown を evidence で確認済み
- docs / tests まで一緒に更新する
- 1 slice の変更範囲が明確

### Stop
- patient context persistence を入れたくなった
- `replace` を `push` に変えたくなった
- debug-only surface を通常導線へ昇格したくなった
- admin を dual-source に戻したくなった
- unknown を「自然だから」で埋めたくなった

## 9. manager 向け最終指示

- product 改善トラックは前進してよい
- ただし repo-external sign-off と混線させない
- quick win は BL-01 → BL-05 → BL-02 → BL-03 の順で固定
- code-confirmation が必要なものは Phase B を通す
- 実装は Codex、spec/copy 固めは ChatGPT で分ける
- 変更は docs + UI + tests を 1 セットで出す
