# WS9: Post-merge verification / CI hardening

## 背景
WS1〜WS8 が merged 済みの作業ブランチを前提にする。
目的は、新しい機能追加ではなく、今回削った legacy surface と contract drift を CI で再発させないこと。

## 方針
- 後方互換性は考慮しない
- current repo を正本とする
- broad な整理ではなく、今回の変更点に直結する guard だけ追加する
- 失敗時は fail-closed を優先する
- 既存の test / verify script / grep を再利用し、必要最小限の wrapper を追加する

## タスク
- [ ] web-client の blocked ORCA route string verify を CI で常時実行する
- [ ] product runtime に `/api/orca/.../mock` surface が再流入しない zero-hit check を CI に追加する
- [ ] server 側に AsyncContext fallback が再流入しない zero-hit check を CI に追加する
- [ ] legacy auth env/doc/devPasswordMd5 が再流入しない zero-hit check を CI に追加する
- [ ] admin config 契約の主要テストを CI の安定した入口へまとめる
- [ ] server/reporting の release-critical test を CI の安定した入口へまとめる
- [ ] 可能なら SpotBugs / FindSecBugs の static-analysis profile を reporting + server-modernized に対して verify で回す
- [ ] CI 導線追加に伴い、README / scripts 名称変更が必要なら最小限だけ更新する

## 受け入れ条件
- [ ] ローカルまたは CI 相当で guard 一式が実行できる
- [ ] blocked ORCA route string / mock surface / AsyncContext / legacy auth drift の 4 種が機械的に検出される
- [ ] reporting / server-modernized の release-critical test 実行入口が明確
- [ ] static-analysis profile を有効化した場合、fail-on-error で安定して通る
- [ ] 不要な大規模リファクタは入っていない

## 禁止事項
- [ ] 新しい feature を追加しない
- [ ] unrelated cleanup を混ぜない
- [ ] closed 済みの Phase2 論点を reopen しない
- [ ] broad な linter 導入や repo-wide style 修正に広げない
