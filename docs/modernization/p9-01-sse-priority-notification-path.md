# P9-01 SSE 優先の通知経路

- 更新日: 2026-03-14
- RUN_ID: 20260314T110104Z

## 決定
- `ChartEventServiceBean.notifyEvent()` の主経路は `ChartEventStreamPublisher` による SSE 配信とする。
- 旧 `AsyncContext` ベースの long-poll fallback は削除済みとし、新規 realtime 経路は SSE のみに統一する。

## コード上の扱い
- `server-modernized/src/main/java/open/dolphin/session/ChartEventServiceBean.java`
  - `notifyEvent()` は SSE broadcast のみを行う。
- `server-modernized/src/main/java/open/dolphin/mbean/ServletContextHolder.java`
  - `AsyncContext` 関連 API と legacy list を削除した。

## 今回あえて据え置いたもの
- chart-event の他 realtime 機構には踏み込んでいない。
