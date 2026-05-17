# 07. Communication templates

この文書は、manager がそのまま貼って使える依頼文面と催促文をまとめたものです。

---

## 1. GitHub 管理者向けコメント（最短版）

repo-external sign-off のため、対象 branch の required checks を yes/no で確認してください。  
1. 対象 branch 名:  
2. required checks 一覧（画面表記そのまま）:  
3. 削除済みの `server-modernized-static-analysis-gate` または旧 static-analysis check 名が required に残っていますか。yes/no
4. Maven static-analysis verify は release 前 mandatory gate として別途実行する運用で問題ありませんか。yes/no
5. web-client CI は required ですか。yes/no。yes の場合は check 名を貼付してください。  
6. `runtime-ready-smoke` は every PR required にしますか。yes/no  
7. current repo で生成されない stale / 旧 check 名が required に残っていますか。yes/no  
8. 可能なら設定画面スクショ 1 枚も添付してください。  

---

## 2. インフラ/運用担当向けコメント（最短版）

repo-external sign-off 用です。各項目を `yes/no/unknown | 投入先 | 証跡種別` で返してください。  
DB 接続情報 |  
DB CA |  
ORCA credential 保護鍵 |  
2FA AES 鍵 |  
document integrity keyring |  
S3 bucket |  
S3 credential |  
trusted proxies |  
reporting signing keystore（必要時） |  
TSA 設定（必要時） |  

---

## 3. Release owner 向け sign-off コメント

repo-local の docs/code follow-up は完了、追加差分は不要です。  
raw runtime error details 修正済み、docs truth-sync 済みとして repo-local は閉じます。  
現時点の未完了は repo-external manual task のみです。  
required checks の現設定確認と production secrets/config 投入確認が閉じるまで、release-ready とは扱いません。  
repo-local merge ready と release-ready は同義ではありません。  
Go/No-Go: `[GO / NO-GO / PENDING]`  
根拠 / 残 unknown / 判定者 / 日付: `[記入]`  

---

## 4. 1ページの進捗表

| 項目 | owner | 状態 (yes/no/unknown) | blocking 度 | 次アクション |
| --- | --- | --- | --- | --- |
| stale static-analysis required check | GitHub 管理者 | unknown | 高 | branch protection から削除済み check 名を除去 |
| Maven static-analysis release gate | Release owner | unknown | 高 | release 前に authoritative command を実行する担当と証跡を決める |
| web-client CI required yes/no | GitHub 管理者 | unknown | 高 | actual check 名と required 状態を確認 |
| runtime-ready-smoke every PR yes/no | Release owner | unknown | 高 | every PR required にするか決定 |
| DB | インフラ/運用 | unknown | 最高 | 投入先と証跡種別を回答 |
| DB CA | インフラ/運用 | unknown | 最高 | 投入先と証跡種別を回答 |
| ORCA key | インフラ/運用 | unknown | 最高 | 投入先と証跡種別を回答 |
| 2FA key | インフラ/運用 | unknown | 最高 | 投入先と証跡種別を回答 |
| integrity keyring | インフラ/運用 | unknown | 最高 | 投入先と証跡種別を回答 |
| S3 bucket | インフラ/運用 | unknown | 最高 | bucket 有無と反映先を回答 |
| S3 credential | インフラ/運用 | unknown | 最高 | credential 有無と証跡種別を回答 |
| trusted proxies | インフラ/運用 | unknown | 高 | 設定値の所在と反映先を回答 |
| reporting signing keystore | インフラ/運用 / Release owner | unknown | 条件付き高 | 今回必要か判定し、必要なら投入確認 |
| TSA | インフラ/運用 / Release owner | unknown | 条件付き高 | 今回必要か判定し、必要なら投入確認 |
| go/no-go 記録 | Release owner | unknown | 高 | 判定欄を記入して記録を残す |

---

## 5. 回答を受けた後の判定ルール（短縮版）

### そのまま人手で閉じる
- stale static-analysis required check が残っていない
- Maven static-analysis verify の release 前実行方針が確定している
- `runtime-ready-smoke` の every PR yes/no が決まっている
- blocking secrets/config が yes、または reporting 系は今回不要と明記されている
- Release owner の GO / NO-GO / PENDING 記録が入っている

### release NO-GO
- blocking 項目に no または unknown が残る
- stale required check が残ったまま
- required checks / secrets/config の確認が未了
- GO / NO-GO / PENDING 記録が未記入

### Codex に戻す
- current repo の PR で想定 check が生成されない
- current repo の workflow / docs / 実際の check 名が矛盾する
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`、`cd web-client && npm run ci`、`cd web-client && node scripts/runtime-ready-smoke.mjs` が current repo で再現的に失敗する
- repo 外の設定不足や投入待ちだけなら Codex には戻さない

---

## 6. 回答待ち催促用の一文

### GitHub 管理者向け
release sign-off 整理のため、【3/30 12:00 JST】までに yes/no だけ先行でご回答いただけると助かります。詳細やスクショは後追いで大丈夫です。

### インフラ/運用担当向け
release sign-off 整理のため、【3/30 12:00 JST】までに各項目の yes/no/unknown だけ先行でご共有いただけると助かります。証跡種別は後追いで大丈夫です。

---

## 7. manager 向け短い status update テンプレ

### 進捗共有テンプレ
repo-local は closeout 済みです。  
現在の未完了は repo-external manual task のみです。  
- GitHub required checks: `[進捗]`
- production secrets/config: `[進捗]`
- Go/No-Go: `[GO / NO-GO / PENDING]`
- Codex 戻し要否: `[なし / あり（理由）]`

### escalation テンプレ
repo-external 確認の結果、current repo と GitHub / 運用実体の間に mismatch が見つかりました。  
内容: `[check 名 / workflow / gate / config 契約のどこが食い違うか]`  
これは repo 外設定だけでは閉じないため、Codex での repo-local 再確認が必要です。
