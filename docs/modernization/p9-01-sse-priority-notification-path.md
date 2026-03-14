# P9-01 SSE 優先の通知経路

- 更新日: 2026-03-14
- RUN_ID: 20260314T110104Z

## 決定
- `ChartEventServiceBean.notifyEvent()` の主経路は `ChartEventStreamPublisher` による SSE 配信とする。
- `ServletContextHolder` の `AsyncContext` リストは、既存 long-poll 系クライアント向けの legacy fallback としてのみ保持する。

## コード上の扱い
- `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java`
  - `notifyEvent()` は最初に SSE broadcast を実行し、その後で legacy `AsyncContext` を補助 helper に閉じ込めて処理する。
- `server-modernized/src/main/java/open/dolphin/mbean/ServletContextHolder.java`
  - `AsyncContext` accessor は deprecated comment を付け、新規 realtime 実装では SSE を使うことを明記した。

## 今回あえて据え置いたもの
- 旧 long-poll 経路自体の物理削除は行っていない。
- 既存クライアント互換の判断が文書化されていないため、P9-01 では「主経路の明確化」と「新規利用の凍結」までに留めた。
