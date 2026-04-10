# OpenDolphinNext マネージャー引き継ぎ資料セット

最終更新: 2026-03-29  
対象: 次のマネージャー業務担当者  
この資料セットは **旧 single-file handoff を置き換えるための新しい正本セット** です。  
以後の判断は、**この資料セット + current repo 現物 + repo-external の現物確認** で進めてください。

---

## 1. この資料セットの目的

この資料セットは、次の 4 つを一つにまとめるために作成しています。

1. **repo-local の current state を、Phase3+ handoff なしで理解できるようにする**
2. **release-ready 判定に必要な repo-external manual task を漏れなく回収できるようにする**
3. **Web クライアントの current contract を、manager 目線で読める形に整理する**
4. **UI 改善の相談結果を、release blocker と混線しない改善バックログとして残す**

このセットだけで、
- 何が終わっているか
- 何が未完了か
- どこまでが repo-local で、どこからが repo-external か
- 次に人間 / ChatGPT / Codex の誰を使うべきか
が分かる構成にしています。

---

## 2. いまの一言要約

### repo-local
repo-local の実装フェーズは **closeout 済み** です。  
追加の repo-local code task は、**current repo に新しい矛盾証拠が出るまで不要**です。

### release 判定
repo-local は **merge ready** ですが、**release-ready ではありません**。  
release-ready までに必要なのは、**GitHub required checks / branch protection の現物確認** と、**production secrets / config の投入確認**です。

### UI 改善
UI 改善の相談結果は、**release blocker の reopen ではなく、current contract を壊さない改善バックログ**として扱います。  
quick win はありますが、repo-external sign-off より先にやる必須作業ではありません。

---

## 3. まず読む順番

### 最初の 15 分
1. [01_current_state_and_decision_rules.md](./01_current_state_and_decision_rules.md)
2. [02_release_readiness_and_repo_external_signoff.md](./02_release_readiness_and_repo_external_signoff.md)

### Web クライアントの現状を知りたいとき
3. [03_web_current_contract_summary.md](./03_web_current_contract_summary.md)

### UI 改善を進めたいとき
4. [04_ui_improvement_program.md](./04_ui_improvement_program.md)

### 実際に判断・依頼を回したいとき
5. [05_manager_operating_playbook.md](./05_manager_operating_playbook.md)
6. [06_open_unknowns_and_evidence_gaps.md](./06_open_unknowns_and_evidence_gaps.md)
7. [07_communication_templates.md](./07_communication_templates.md)

---

## 4. この資料セットに含まれるもの

| ファイル | 役割 | いつ使うか |
| --- | --- | --- |
| `01_current_state_and_decision_rules.md` | repo-local の current state、判断ルール、reopen 条件 | まず現状をつかむ時 |
| `02_release_readiness_and_repo_external_signoff.md` | release-ready に必要な repo-external manual task | sign-off を回す時 |
| `03_web_current_contract_summary.md` | web-client の current contract 要約 | auth / patient context / feedback / route を確認したい時 |
| `04_ui_improvement_program.md` | UI 改善の統合計画、工程表、バックログ | UI 改善を計画する時 |
| `05_manager_operating_playbook.md` | manager 向け運用手順、ChatGPT / Codex / 人手の使い分け | 新しい報告をさばく時 |
| `06_open_unknowns_and_evidence_gaps.md` | unknown と証拠不足の一覧 | 推測で進めそうになった時 |
| `07_communication_templates.md` | そのまま送れる依頼文、催促文、sign-off 文 | GitHub 管理者 / インフラ / Release owner に依頼する時 |

---

## 5. このセットで固定している大前提

- **current repo が正本**
- repo に証拠がなければ **unknown**
- **merge ready と release-ready は同義ではない**
- repo-local の closeout 済み論点は、**current repo の矛盾証拠が出た時だけ** reopen する
- repo-external の確認不足だけでは Codex に戻さない
- UI 改善バックログは **non-blocking** として管理する
- 患者文脈を URL / `localStorage` / `sessionStorage` に残す案は採らない
- `runtime-ready-smoke.mjs` は **release 前 mandatory** だが、**every PR required かどうかは未確定**

---

## 6. manager の最初の実務

### 今日やること
- repo-local の state を `01` で確認する
- sign-off の残件を `02` で確認する
- GitHub 管理者、インフラ/運用担当、Release owner に `07` の文面を送る

### 今週やること
- repo-external の yes/no/unknown を埋める
- GO / NO-GO / PENDING を Release owner に記録させる
- UI 改善は `04` の quick win と code-confirmation を切り分けて backlog 化する

### やらないこと
- 新しい cleanup wave を自動で始める
- required checks や secrets の未確認を repo 内 defect と見なす
- Patients / Mobile Images / Administration の unknown を推測で埋める
- 旧 single-file handoff の内容を暗黙前提として持ち続ける

---

## 7. 更新ルール

この資料セットを今後更新する時は、必ず次のどちらかに分類してください。

1. **repo truth の更新**
   - current repo の docs / code / tests / scripts / workflow に新しい証拠が出た
2. **repo-external truth の更新**
   - GitHub settings、secrets/config 投入、運用証跡が更新された

会話メモや一時的な報告だけでは、この資料の正本は更新しません。

---

## 8. 関連する既知の参照コミット

この handoff 作成時点で、manager 報告ベースの重要参照コミットは次のとおりです。

- `e348fe94f`  
  `fix(web-client): hide raw runtime error details`
- `5fd9c2a1c`  
  `docs(web-client): sync runtime truth notes`

これらは「何が変わったか」を追う参考情報です。  
release-ready 判定そのものは、**current repo 現物と repo-external sign-off** で行ってください。
