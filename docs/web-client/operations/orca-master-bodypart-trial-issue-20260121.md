# ORCA Master (部位検索) Trial 失敗メモ - 2026-01-21

RUN_ID: 20260121T062542Z

## 概要
- Charts の部位検索（/orca/tensu/etensu?category=2）が Trial 環境で 503（ETENSU_UNAVAILABLE）となり、候補表示に到達できない。
- 事前にログイン周りの認証方式が噛み合わず 401 が続いたため、Web クライアント側の認証送出を調整して解消済み。

## 事象
- 症状: 部位検索キーワード入力後に候補が出ない。
- サーバ応答: `/openDolphin/resources/orca/tensu/etensu` が 503（ETENSU_UNAVAILABLE）。
- UI: 失敗時バナーが `aria-live=assertive` で表示されることは確認済み。
- 証跡: `artifacts/webclient/orca-e2e/20260120/bodypart/trial-bodypart-20260121T062542Z.png`

## 原因
1. **認証方式の不一致**  
   - `/orca/*` は LogFilter が Basic 認証必須。  
   - `/orca/tensu/etensu`（OrcaMasterResource）は `userName/password` ヘッダ認証必須。  
   - Basic だけ / ヘッダだけの片方だと 401 で拒否される。
2. **Trial データ不足**  
   - 認証を通した後も ORCA master（etensu）が 503 を返す。  
   - Trial 側データ欠落/未搭載が疑われるため、MSW 結果を成功根拠にする必要あり。

## 対応内容（コード）
- `web-client/src/features/charts/orderMasterSearchApi.ts`
  - ORCA master 用の `userName/password` を常時送信（デフォルトは server 既定値）。
- `setup-modernized-env.sh`
  - VITE_ORCA_MASTER_USER/PASSWORD を dev env に反映。
  - VITE_ENABLE_FACILITY_HEADER=1 を標準化（current session auth と ORCA 用 header の分離を維持する）。

## 再現/確認手順（後続向け）
1. 起動  
   - `WEB_CLIENT_MODE=npm ./setup-modernized-env.sh`
2. ログイン  
   - 施設ID: `1.3.6.1.4.1.9414.10.1`  
   - ユーザー: `dolphindev` / `dolphindev`
3. Charts → オーダー → 新規入力  
4. 対象 = 放射線 / 処置・検査・指示 を切替  
5. 部位検索（胸/膝）  
   - Trial: `/orca/tensu/etensu` が 503（ETENSU_UNAVAILABLE）
   - 失敗時 aria-live assertive バナーは表示される

## 現状の結論
- **Trial は etensu category=2 が空/未構成**（少なくとも 503）。  
- 成功系（候補表示/選択/保存）は **MSW + Unit** を根拠にする。
