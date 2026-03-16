# オーダー入力と ORCA マスタ連携の再検証（RUN_ID=20260120T091852Z）
更新: 2026-01-21（RUN_ID=20260121T134718Z）

## 目的
各オーダー項目が **ORCA サーバーから取得した薬剤名・処置名等のマスタ情報を基に入力できているか** を現行実装で確認し、不備があれば洗い出す。実環境への送信は行っていない（コードリーディングと既存フロー確認のみ）。

## 対象コード
- オーダー編集 UI: `web-client/src/features/charts/OrderBundleEditPanel.tsx`
- マスタ検索: `web-client/src/features/charts/orderMasterSearchApi.ts`
- オーダー送信: `web-client/src/features/charts/orderBundleApi.ts`

## 再検証結果
| 項目 | 実装状況 | 根拠 |
| --- | --- | --- |
| 薬剤検索（一般名/コード） | OK: `/api/orca/master/generic-class` で検索し、コード検索時は `medicationgetv2` で補正候補を提示。選択時に `code` と `name` をアイテムへ挿入。 | `OrderBundleEditPanel.tsx` L703-748, L2712-2755; `orderMasterSearchApi.ts` L200-260 |
| 用法検索 | OK: `/api/orca/master/youhou` から取得し、選択時に管理欄へコード+名称をセット。 | 同上 L715-737 / L2684-2748 |
| 材料検索 | OK: `material` 種別で `/api/orca/master/material` を検索。該当エンティティ（general/treatment/test/instraction）で利用可。 | `supportsMaterials` L540、クエリ L728-734 |
| 点数・検査区分 | OK: `/api/orca/master/kensa-sort`・`/api/orca/tensu/etensu` 検索を提供。選択でコード/名称を挿入。 | `masterSearchType` select とテーブル描画 L2580-2760 |
| 部位コード（radiology/general 用） | **OK（対応済み）**: `bodyPartSearchQuery` を有効化し、`/api/orca/tensu/etensu?category=2` に到達。候補選択で `code/name` を items へ保存。Trial 側の認証/503 には注意が必要。 | `OrderBundleEditPanel.tsx`, `orderMasterSearchApi.ts`, `artifacts/webclient/orca-e2e/20260120/bodypart/` |
| オーダー送信 payload | OK: 選択したマスタから `code`/`name` を items に保持し、そのまま `/api/orca/order/bundles` へ送信。 | `collectBundleItems` L1111-1120 → `mutateOrderBundles` L1047-1185 |

## 影響とリスク
- 部位コード検索は有効化済みだが、Trial では `/api/orca/tensu/etensu` が 503 となるケースがあるため、MSW か実環境での検証が必要。
- それ以外の薬剤・用法・材料・点数検索は ORCA マスタ経由で動作し、選択結果が送信 payload へ反映されることを確認。

## 対応済みメモ
- `bodyPartSearchQuery` を有効化し、`supportsBodyPartSearch` の場合のみ実 ORCA マスタへ問い合わせる構成に変更済み。
- Trial では認証経路により 503 が発生するため、MSW での回帰と実環境での再確認が必要。

## フォローアップ候補
1. Trial で 503 が出る場合は MSW で回帰を継続し、実環境で部位コード取得→オーダー送信の再確認を行う。
2. 注射オーダーで材料検索が必要か現場確認し、必要なら `supportsMaterials` に `injectionOrder` を追加。
3. マスタ未取得を防ぐため、アイテム保存時に `code` 未入力を警告するガードを検討（現状フリーテキスト許容）。

## 付記: 用法・投与量の入力/送信経路
- UI: 「用法」入力欄 + 用法マスタ検索（/api/orca/master/youhou）。選択時に `admin` に名称、`adminMemo` にコードをセット。`OrderBundleEditPanel.tsx` L2335-L2475, L703-L748。
- 投与量: 明細行の `quantity` `unit` を入力し、マスタ選択時に名称+コードを保持。`collectBundleItems` でまとめて送信 payload へ含める。
- バリデーション: medOrder では `requiresUsage=true` で用法未入力をブロック。`validateBundleForm` L438-L470。
- 送信: `/api/orca/order/bundles` に POST（items + admin/adminMemo + classCode）。`orderBundleApi.ts`。
- リスク: 投与量の単位コード・日数はフリーテキストで厳格チェックなし。必要ならサーバー側バリデーション/単位コードマスタ連携の強化を検討。
