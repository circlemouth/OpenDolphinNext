# P9-05 静的解析必須ゲート

- 日付: 2026-03-12
- RUN_ID: 20260312T050136Z
- タスク: P9-05

## 目的
SpotBugs / Checkstyle / PMD を PR 時の必須チェックに組み込み、静的解析を「実行されるだけ」から「ゲートとして判定される」状態へ移行する。

## 実施内容

### 1. 解析プロファイルに強制フラグを導入
- 対象:
  - `server-modernized/pom.xml`
  - `common/pom.xml`
- 変更:
  - `static.analysis.enforce` プロパティを追加（既定 `false`）。
  - `spotbugs/checkstyle/pmd` の `failOn*` を `static.analysis.enforce` へ接続。
- 目的:
  - ローカルでは既定非強制（既存負債調査を継続可能）。
  - CI では `-Dstatic.analysis.enforce=true` を指定し、必須ゲートとして動作。

### 2. 解析設定パスの安定化
- 対象:
  - `server-modernized/pom.xml`
  - `common/pom.xml`
- 変更:
  - `static.analysis.config.dir` / `static.analysis.output.dir` を `${maven.multiModuleProjectDirectory}` 基準へ統一。
- 効果:
  - モジュール実行位置依存を減らし、CI とローカルで同一出力先を利用。

### 3. CI ワークフローを追加
- 対象: `.github/workflows/server-modernized-static-analysis-gate.yml`
- 仕様:
  - trigger: `pull_request`（`server-modernized/**`, `common/**`, `pom.server-modernized.xml` 変更時） + `workflow_dispatch`
  - 実行コマンド:
    - `mvn -B -ntp -f pom.server-modernized.xml -Pstatic-analysis -Dstatic.analysis.enforce=true -DskipTests -pl common,server-modernized -am verify`
  - 解析レポートを artifact へアップロード。

## 品質基準（この時点の運用）
- 新規/変更 PR は static analysis gate を通過すること。
- 既存コード負債は `config/static-analysis/*` の除外/ルールで管理し、必要時のみ明示更新する。

## 検証
- 実行:
  - `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -o -f pom.server-modernized.xml -pl common -am -Pstatic-analysis -Dstatic.analysis.enforce=false -DskipTests verify`
- 結果: PASS（SpotBugs/Checkstyle/PMD 実行・レポート出力確認）

## 2026-03-22 追記
- RUN_ID: `20260322T112849Z`
- `server-modernized/pom.xml` / `pom.server-modernized.xml` の SpotBugs plugin を `4.9.8.2` へ更新し、`spotbugs.skip` の既定値を解除した。
- 根本原因は、Maven が Java 25 で動作したときに SpotBugs 4.8.5.0 が JDK 標準クラスの class file major version 69 を読めなかったことだった。
- 修正後は Maven Java 25 で `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis -Dspotbugs.skip=false -Dcheckstyle.skip=true -Dpmd.skip=true -DskipTests verify` を実行し、SpotBugs 実行まで含めて BUILD SUCCESS を確認した。

## 2026-03-28 repo-local truth
- authoritative static-analysis entrypoint:
  - `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
- wrapper:
  - `scripts/server-modernized/verify-static-analysis.sh` は convenience wrapper として残すが、正本ではない。
- minimal release gate（mandatory）:
  1. `cd web-client && npm run ci`
  2. `mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify`
  3. `cd web-client && node scripts/runtime-ready-smoke.mjs`
- policy:
  - SpotBugs / FindSecBugs fail-on-error を維持する。
  - Checkstyle / PMD は skip のまま維持する。
  - branch protection / required checks は repo-external のため unknown とする。
