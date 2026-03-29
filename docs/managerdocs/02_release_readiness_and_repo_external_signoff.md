# 02. Release Readiness と repo-external sign-off

この文書は、release-ready 判定に必要な **repo-external manual task** を manager が回すための実務文書です。

---

## 1. 前提

- repo-local は closeout 済み
- merge ready と release-ready は同義ではない
- release-ready には repo-external sign-off が必要
- repo 外の未確認は repo 内 defect と見なさない
- repo mismatch の証拠が出た時だけ Codex に戻す

---

## 2. repo-external で必ず閉じる項目

## 2-1. GitHub / required checks
1. 対象 branch の branch protection の現設定
2. required checks 一覧
3. `server-modernized-static-analysis-gate` の actual check 名
4. 上記 static-analysis check を required にするか
5. web-client CI を required にするか
6. `runtime-ready-smoke.mjs` を every PR required にするか
7. stale / 旧 check 名が required に残っていないか

## 2-2. production config / secrets
1. DB 接続情報
2. DB CA
3. ORCA credential 保護鍵
4. 2FA AES 鍵
5. document integrity keyring
6. S3 bucket
7. S3 credential
8. trusted proxies
9. reporting signing keystore（必要時）
10. TSA 設定（必要時）

---

## 3. repo-external blocking checklist

| ID | 項目 | なぜ必要か | 何を確認するか | 証拠として必要なもの | owner 候補 | blocking 度 | 完了条件 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GH-01 | branch protection 現設定の採取 | release-ready 判定に required checks の実効設定が必要 | 対象 branch の branch protection ルール名、required checks 一覧、required review 条件 | GitHub 設定画面スクショまたは設定文字列 | GitHub 管理者 | 高 | 対象 branch の現設定が文字列で残る |
| GH-02 | static-analysis workflow の actual check 名確認 | restore 済みでも actual check 名は GitHub 上でしか確定しない | completed run から exact check 名を特定 | PR run URL / スクショ / check 名原文 | GitHub 管理者 | 高 | exact check 名が採取される |
| GH-03 | static-analysis required yes/no 決定 | docs にある workflow restore と branch protection を接続する | required にするか、しないか、その理由 | 決定メモ + 設定証跡 | GitHub 管理者 / Release owner | 高 | yes/no が確定して記録される |
| GH-04 | web-client CI required 状態確認 | release gate の 1 本だが PR required かは repo 外 | actual check 名と required 状態 | check 名原文 + branch protection 証跡 | GitHub 管理者 | 高 | required / not required が明文化される |
| GH-05 | runtime-ready-smoke の扱い決定 | release 前 mandatory と every PR required は別 | every PR required にするかどうか | 決定メモ、必要なら設定証跡 | Release owner / GitHub 管理者 | 高 | yes/no が記録される |
| CFG-01 | DB 接続情報 / DB CA | 本番 DB 接続不可だと release 不可 | 接続先、認証情報、CA の投入先と反映先 | Secret Manager / manifest / 起動ログ / 疎通ログ | インフラ/運用 | 最高 | DB 接続情報と DB CA の所在と反映が確認済み |
| CFG-02 | ORCA credential 保護鍵 | ORCA 資格情報を安全に扱うため | 投入先、反映環境、責任者 | Secret 登録証跡または運用台帳 | インフラ/運用 / Security | 最高 | 本番有効値の所在と反映先が確認済み |
| CFG-03 | 2FA AES 鍵 | factor2 current contract を本番で成立させるため | 投入先、反映環境、責任者 | Secret 証跡または運用台帳 | インフラ/運用 / Security | 最高 | 本番有効値の所在が確認済み |
| CFG-04 | document integrity keyring | fail-closed 契約の前提 | 投入先、反映環境、整合確認方法 | secret/mount 証跡 + 起動確認 | インフラ/運用 | 最高 | keyring が本番反映済み |
| CFG-05 | S3 bucket / credential | attachment storage は s3 only | bucket 名、認証方式、権限境界、反映環境 | bucket 設定証跡、credential 証跡、疎通ログ | インフラ/運用 | 最高 | bucket と credential の両方が確認済み |
| CFG-06 | trusted proxies | proxy 配下での正しい client/proto 解決 | 値、設定先、反映先、LB/Ingress との整合 | manifest / env / 設定画面の証跡 | インフラ/運用 | 高 | 値が確定し反映済み |
| CFG-07 | reporting signing keystore / TSA | 署名付き reporting が必要な release で fail-closed 条件 | 今回必要か、必要なら投入済みか | 決定メモ + 設定証跡 | インフラ/運用 / reporting owner | 条件付き高 | 「不要」または「必要かつ投入済み」に確定 |
| GOV-01 | repo-local / repo-external の切り分け記録 | merge-ready と release-ready の混線防止 | sign-off 文に境界説明を残す | sign-off 記入済み文面 | Release owner | 高 | 境界説明が明文化される |
| GOV-02 | GO / NO-GO 記録 | 口頭合意だけだと追跡不能 | 判定日、判定者、残 unknown、理由 | sign-off メモ / ticket コメント | Release owner | 高 | GO / NO-GO / PENDING が書面で残る |

---

## 4. GitHub required checks 確認シート

| 確認項目 | 現在値 | 確認先 | 期待値 | 不一致時の扱い |
| --- | --- | --- | --- | --- |
| static-analysis workflow は restore 済みか | docs 上 yes | current repo docs / GitHub Actions | GitHub 上でも存在し completed run がある | 見当たらなければ repo mismatch 候補 |
| static-analysis workflow の actual check 名 | unknown | completed PR run 詳細 | exact check 名が採取できる | 名が採れない / current repo PR で生成されない → repo mismatch 候補 |
| branch protection で static-analysis が required か | unknown | GitHub branch protection | yes/no のどちらかに確定 | 未設定なら repo 外設定作業。存在しない check 名が required なら repo mismatch 候補 |
| web-client CI の actual check 名 | unknown | completed PR run 詳細 | exact check 名が採取できる | 名が不明ならまず GitHub 確認 |
| web-client CI が required か | unknown | GitHub branch protection | yes/no のどちらかに確定 | 未設定なら repo 外設定作業 |
| runtime-ready-smoke を every PR required にするか | unknown | Release owner 判断 + GitHub branch protection | yes/no のどちらでもよいが未決定不可 | 未決定なら sign-off 未完了 |
| stale / deprecated check 名が required に残っていないか | unknown | GitHub branch protection | 0 件 | 残っているだけなら repo 外設定修正。現行 workflow が check を出せないなら repo mismatch 候補 |

### manager メモ
- `runtime-ready-smoke.mjs` は **release 前 mandatory**
- `runtime-ready-smoke.mjs` を **every PR required** にするかは運用判断
- Checkstyle / PMD が skip なのは current policy であり、required checks 不足とは別の話

---

## 5. production config / secrets 投入確認シート

| 項目 | 用途 | repo 内根拠 | repo 外確認方法 | 未投入時の影響 | release blocking か |
| --- | --- | --- | --- | --- | --- |
| DB 接続情報 | 本番 DB 接続 | repo-external manual task 列挙 | Secret Manager / manifest / 起動時設定 / 疎通ログ | アプリ起動不可または DB 未接続 | yes |
| DB CA | DB TLS 信頼鎖 | repo-external manual task 列挙 | CA ファイル / secret mount / 接続ログ | TLS 接続失敗または安全性未達 | yes |
| ORCA credential 保護鍵 | ORCA 接続資格情報の保護 | repo-external manual task 列挙 | Secret Manager / 起動設定 / 運用台帳 | ORCA credential を安全に扱えない | yes |
| 2FA AES 鍵 | factor2 / TOTP 周辺の本番暗号鍵 | repo-external manual task 列挙 | Secret Manager / 起動設定 / 運用台帳 | 2FA 機能不全または安全性未達 | yes |
| document integrity keyring | fail-closed 文書整合性 | `DOCUMENT_INTEGRITY_MODE=enforce` | keyring secret/mount/起動ログ | 契約違反または fail-closed | yes |
| S3 bucket | 添付保存先 | attachment storage は s3 only | bucket 設定証跡 | 添付保存不可 | yes |
| S3 credential | S3 認証 | repo-external manual task 列挙 | IAM/secret/role 設定と疎通ログ | 添付保存不可または認証エラー | yes |
| trusted proxies | proxy 配下の正しい解決 | explicit 設定前提 | Ingress/LB 設定とアプリ設定照合 | client IP / scheme / URL 解決誤り | yes |
| reporting signing keystore | 署名付き reporting 用鍵 | config が渡された場合のみ実施 | release scope 確認 + 設定証跡 | 署名必須 release で署名不可 | conditional yes |
| TSA 設定 | 署名時刻保証 | repo-external manual task 列挙 | release scope 確認 + 設定証跡 | 署名必須 release で TSA 失敗 | conditional yes |

---

## 6. GO / NO-GO decision matrix

| 論点 | repo-local 条件 | repo-external 条件 | GO 条件 | NO-GO 条件 | 備考 |
| --- | --- | --- | --- | --- | --- |
| repo-local closeout | repo-local code task が none、主要 gate は green | 追加の repo-local reopen 証拠なし | current repo に矛盾証拠なし | current repo の regression 証拠あり | merge-ready と release-ready は別 |
| required checks 現設定 | workflow / docs / release gate は repo にある | GitHub 現設定が採取済み | actual check 名と required 状態が記録済み | 現設定が unknown のまま | まず現物確認 |
| static-analysis governance | authoritative entrypoint と workflow restore が docs にある | actual check 名が採取済み、required yes/no 決定済み | 名と required 状態が整合 | exact 名が不明、または stale required check が残る | repo mismatch の可能性あり |
| web-client CI governance | `npm run ci` は release gate に含まれる | actual check 名と required 状態が確定 | 名と required 状態が明文化 | unknown のまま | required/no 自体は運用判断でもよいが未決定不可 |
| runtime-ready-smoke の位置づけ | release 前 mandatory と docs にある | every PR required にするか明示決定 | yes/no のどちらかが決定済み | 未決定 | yes/no 自体より決定と記録が重要 |
| production secrets/config | repo 内では external task として列挙済み | 必須項目の投入証跡がそろう | blocking 項目が全て確認済み | 1 項目でも未確認 / 未投入 / unknown | unknown のままは NO-GO |
| reporting signing | 署名は config が渡された場合のみ | 今回の release で必要か判定済み | 不要、または必要かつ投入済み | 必要なのに未投入 | conditional |
| sign-off 文書化 | merge-ready と release-ready の区別が docs にある | 判定者・日付・根拠が残る | GO / NO-GO / PENDING が記録済み | 口頭のみ | 監査用 |
| Codex 返却要否 | repo-local 追加差分は不要 | repo mismatch が出た時だけ | repo 外だけの宿題は人手で閉じる | repo mismatch を repo 外作業として放置 | 境界管理が目的 |

---

## 7. repo-external 確認で Codex に戻す条件

Codex に戻す条件は **repo mismatch が出た時だけ** です。

### 戻す条件
- static-analysis の actual check 名が current repo の PR で生成されない
- restore 済みのはずの workflow が current repo の想定 trigger/path で動かない
- `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify` が current repo で再現性を持って失敗する
- `cd web-client && npm run ci` が current repo で再現性を持って失敗する
- `cd web-client && node scripts/runtime-ready-smoke.mjs` が current repo で再現性を持って失敗する
- GitHub 上の actual check 名や job 構成が repo docs の期待と噛み合わず、branch protection 設定変更だけでは解消しない
- 運用側の実測ログが、repo docs の current contract では起動 / 接続できないことを示す

### 戻さない条件
- branch protection がまだ更新されていないだけ
- secrets / config が未投入なだけ
- keystore / TSA / bucket / trusted proxies の運用準備待ち
- GitHub 管理者や運用担当の確認待ち
- repo 外だけで閉じる設定反映・証跡回収・承認記録の不足

---

## 8. manager の実行順序

1. `07_communication_templates.md` の文面で依頼を出す
2. yes/no/unknown をこの文書の表に転記する
3. Release owner に GO / NO-GO / PENDING を記録させる
4. repo mismatch の証拠が出た時だけ Codex に戻す
5. それ以外は repo-external manual task として人手で閉じる
