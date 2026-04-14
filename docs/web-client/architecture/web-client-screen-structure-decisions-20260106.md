# Webクライアント画面構成 決定事項（RUN_ID=20260106T120500Z）

Status: reference-only
Canonical source: `docs/managerdocs/03_web_current_contract_summary.md`, `web-client/notes/ui-current-contract.md`

## 目的
Web クライアントの本番ナビ/ルーティング/ガードの確定内容を整理し、実装・UX・運用ドキュメントの基準点を明確化する。

## 参照
- [docs/managerdocs/03_web_current_contract_summary.md](../../managerdocs/03_web_current_contract_summary.md)
- [web-client/notes/ui-current-contract.md](../../../web-client/notes/ui-current-contract.md)
- [docs/web-client/ux/dads_app_ui_design_rules_20260411.md](../ux/dads_app_ui_design_rules_20260411.md)
- [docs/web-client/ux/web-client-ui-guideline.md](../ux/web-client-ui-guideline.md)

## 1. 本番ナビ（順序・名称・遷移）
本番ナビは **受付 → カルテ → 患者 → 管理** の順で固定し、英語/検証向け表記を本番表示から除外する。

| 順序 | 本番表示名 | ルート | 役割 | ガード |
| --- | --- | --- | --- | --- |
| 1 | 受付 | `/f/:facilityId/reception` | 受付リスト/トーン連携の入口 | セッション必須 + facilityId 一致 |
| 2 | カルテ | `/f/:facilityId/charts` | 診療カルテの中心画面 | セッション必須 + facilityId 一致 |
| 3 | 患者 | `/f/:facilityId/patients` | 患者管理/新患登録 | セッション必須 + facilityId 一致 |
| 4 | 管理 | `/f/:facilityId/administration` | 配信/管理系設定 | セッション必須 + facilityId 一致 + `system_admin` 系ロールのみ操作許可（閲覧は可能） |

## 2. 本番ルーティング
### ベースルート
- `/login`: 未ログイン時の入口。
- `/f/:facilityId/login`: 施設固定ログイン。未ログイン時のみ有効。
- `/f/:facilityId` (index): `/f/:facilityId/reception` へリダイレクト。

### 本番ナビ対象ルート
- `/f/:facilityId/reception`
- `/f/:facilityId/charts`
- `/f/:facilityId/patients`
- `/f/:facilityId/administration`

### 付随ルート（ナビ外・業務導線）
- `/f/:facilityId/charts/print/outpatient`（カルテ印刷/外来プレビュー）
- `/f/:facilityId/charts/print/document`（文書印刷プレビュー）

## 3. ガード/正規化ルール
- 未ログインは `/login` へ必ず誘導。
- 施設ID不一致は専用の拒否画面を表示し、現在施設へ戻る導線を提供。
- 旧ルート（`/reception` など）や未知ルートは施設付き URL へ正規化する。
- `/f/:facilityId/*` の未知ルートは `/f/:facilityId/reception` へフォールバック。

## 4. デバッグ/検証画面の扱い
- `/f/:facilityId/outpatient-mock` は **本番ナビから除外**。
- デバッグ用途は `/f/:facilityId/debug/*` へ隔離し、ENV + role 条件でのみ有効化する。

## 5. 未決事項
- 管理画面の「閲覧のみ許可」範囲と本番文言の最終確定。
- `Patients` での旧来患者検索の高度導線（右クリック導線など）の再現範囲。
