# 10. Handoff to Dynamic Check

## この package の完了地点
この package の完了は、**dynamic ORCA trial check を実行してよい** ことそのものではありません。
完了地点は、
- static blocker C1〜C7 が閉じている
- docs/tests/scripts が current code と一致している
- live 未確認事項が明示されている
という状態です。

## dynamic phase に渡す前提
- facility resolution が explicit default / fail-close で統一されている
- sanitize 経路に raw URL/host/baseUrl 漏えいがない
- Charts の transmission evidence が row-local で fail-close する
- OrcaSummary must-visible 情報が初期表示で見える
- Patients official mutation/import の full success が canonical re-fetch success を含む
- QA scripts が `Medical_Information` omission contract を自動で落とせる

## dynamic phase で別途確認すべきこと
- trial tenant での facility / principal / mTLS 実前提
- live network reachability
- same-day multi-encounter 実データでの overlay 挙動
- patient write/import 後の actual canonical readback behavior

## deferred live target
human が後続で dynamic ORCA trial check を明示したときのみ、次を使う。
- URL: `https://weborca-trial.orca.med.or.jp/`
- user: `trial`
- password: `weborcatrial`

## dynamic へ渡す report template
1. static fix completed clusters
2. changed files summary
3. targeted tests executed
4. remaining unknown / live-only items
5. recommended dynamic test order
   - facility resolution
   - sanitize failure path
   - charts multi-encounter overlay
   - patient write/import readback
   - `Medical_Information` omitted / present raw artifact cases
