# P9-03 共有リスト構造見直し

- 日付: 2026-03-15
- RUN_ID: 20260315T000000Z
- タスク: P9-03（`codex_automation_workplan_revised.md` 基準）

## 背景
- `ServletContextHolder` の facility 別 `pvtList` は `CopyOnWriteArrayList` で保持されていた。
- `PVTServiceBean.addPvt()` / `mergeTodayVisit()` / `removePvtForFacility()`、`ChartEventServiceBean.initializePvtList()` / `processPvtDeleteEvent()` / `renewPvtList()` が同じリストへ頻繁に add / set / remove / clear を行うため、Copy-On-Write のコピーコストがホットパスに乗っていた。
- SSE の `clients` リストは読取優位なので据え置き、今回は PVT キャッシュだけを変更対象に絞った。

## 実装
1. `ServletContextHolder` の PVT リスト管理を変更
- `CopyOnWriteArrayList` をやめ、内部保持を `Collections.synchronizedList(new ArrayList<>())` へ変更した。
- 読取は `getPvtList(fid)` の snapshot 返却に寄せ、外部が返却値を変更しても内部キャッシュへ影響しない形にした。
- 構造変更は `addPvt` / `replaceOrAddPvt` / `removePvtById` / `clearPvtList` / `removePvtIf` に集約した。

2. PVT ホットパスを helper 経由へ載せ替え
- `ChartEventServiceBean` の初期ロード、削除、日次更新で holder helper を使うよう変更した。
- `PVTServiceBean` の当日追加、重複 merge、削除で holder helper を使うよう変更した。
- `PatientServiceBean` は snapshot 読取のみなので構造変更は不要だった。

## テスト
- `server-modernized/src/test/java/open/dolphin/mbean/ServletContextHolderTest.java`
  - snapshot 返却で外部構造変更を遮断できること
  - replace/add/remove helper が内部リストへ反映されること
- `server-modernized/src/test/java/open/dolphin/session/PVTServiceBeanAddPvtTest.java`
  - 追加・merge 時に holder 経由の PVT キャッシュ更新が行われること

## 参考資料との矛盾
- `docs/server-modernization/planning/server_modernization_wbs_detailed.md` の `P9-03` は「認証・セッション方式の整理」を指している。
- `docs/server-modernization/README.md` も `P9-03` として `p9-03-auth-session-unification.md` を案内している。
- 一方、`codex_automation_workplan_revised.md` の `P9-03` は本タスク「共有リスト構造見直し」であり、番号対応が一致していない。
- 今回の実行では progress 判定を revised workplan に従い、この矛盾は記録のみ行った。
