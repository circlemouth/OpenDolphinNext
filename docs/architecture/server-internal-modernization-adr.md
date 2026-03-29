# サーバー内部仕様モダナイズ ADR

- 更新日: 2026-03-16
- RUN_ID: 20260316T000045Z
- 対象: `server-modernized`, `common`

## 1. 決定

server internal modernization では、後方互換よりも本番運用の明確性と保守性を優先し、以下を固定方針とする。

1. Flyway migration の著者管理ディレクトリは `server-modernized/tools/flyway/sql` の 1 つだけにする。
2. 公開 REST 入口は `/api/*` のみとし、`/resources/*` と `/orca/*` は段階的に削除する。
3. 本番設定は typed config を正規ルートとし、`custom.properties` と `jboss.home.dir` 依存は本番コードから除去する。
4. ORCA master は現行サポート対象スキーマに固定し、DatabaseMetaData probing や旧スキーマ吸収ロジックを残さない。
5. 本番コードでは fixture / stub / snapshot fallback を禁止し、必要な資材は test/dev 用配置へ隔離する。

## 2. 理由

- 旧実装との二重契約を残すと、修正時に「どちらが正本か」を毎回判断する必要が生じる。
- 互換 fallback は fail-fast を崩し、障害発見を遅らせる。
- 本番系の設定とテスト資材が混在すると、環境差分の切り分けが難しくなる。
- 現行スキーマ固定に寄せることで、運用・監視・障害対応の前提が単純になる。

## 3. 運用ルール

- 正本一本化後に classpath へ必要な資材を供給する場合は、source tree のミラーではなく build 生成物で行う。
- 旧ルートを消すことで影響範囲が広がる場合でも、互換層を残すのではなく、現行契約へ利用側を揃える。
- 例外的に旧仕様を参照する必要がある場合は、production path から切り離した文書または test fixture として扱う。
