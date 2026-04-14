# Reviewer submission packet contract

## 絶対ルール

- 既存 `scripts/create-review-archive.sh` の logs-only 挙動は残さなくてよい
- backward compatibility は不要
- 必要なら既存スクリプトは削除して、新スクリプト / 新 skill に置き換える
- reviewer 提出物は **source archive** ではなく **review-checkout + closeout-packet + manifest** を同梱する
- review-checkout は `.git` を持つ clean checkout とする
- closeout-packet は同一 RUN_ID / 同一 HEAD の live evidence を含む
- report / manifest / evidence 内の path は **絶対パス禁止**。repo-relative か packet-relative のみ
- required file が 1 つでも欠けたら script は non-zero exit で fail する
- HEAD mismatch が 1 つでもあれば script は fail する

## 提出物レイアウト

submission-packet-<RUN_ID>/
  README_REVIEW.md
  manifest.json
  manifest.sha256
  review-checkout/
    .git/
    ...tracked source tree...
  closeout-packet/
    git/
      git-head-current.txt
      git-branch-current.txt
      git-status-short.txt
      git-merge-base-origin-master.txt
      git-diff-stat.txt
      git-log-oneline.txt
    reports/
      final-report.md
      command-log.md
      blocker-classification.md
    qa/
      acceptmodv2/
        accept-summary.json
        steps.log
        console.json
        page-errors.json
        screenshots/...
      fullflow/
        summary.json
        steps.log
        console.json
        page-errors.json
        network/
          network.json
          requests.json
        request-xml/
          medicalmodv2.xml   # send 到達時
        screenshots/...
    evidence/
      patients-import/
        import-summary.json
        raw-upstream-request.xml
        raw-upstream-response.xml
        server-stacktrace.log
        audit.log
      medical-information-probe/
        probe-summary.json
        raw-request.xml
        raw-response.xml
        route-response.json
        server-stacktrace.log
      runtime-blockers/
        blocker-summary.json
        selected-visit-row.json
        handoff-state.json
    docs/
      release-validation.md
      orca-remediation-cutover.md
      packet-skill.md

## review-checkout の要件

- `git status --short` が clean であること
- accepted branch の HEAD が packet manifest と一致すること
- `origin/master` ref が存在し、`git merge-base HEAD origin/master` が通ること
- node_modules / target / dist / build artifacts は含めない
- closeout artifacts は review-checkout の外側 `closeout-packet/` に置く

## closeout-packet の要件

- review-checkout HEAD と同じ HEAD から採取する
- final-report は packet 内 evidence だけで辿れるように書く
- `medicalmodv2.xml` が無い場合は `summary.json` と `blocker-classification.md` で未到達理由を説明する
- `qa/fullflow/summary.json` は blocker type, stop point, patient, route, request capture status を持つ
- `qa/acceptmodv2/accept-summary.json` は duplicate/reset 状態も記録する

## 新スクリプト / 新 skill に必須の機能

1. accepted HEAD / branch / RUN_ID の採番と検証
2. temp clean clone の作成
3. closeout evidence の required file 検証
4. packet-relative path へ report を正規化
5. manifest と SHA256 の生成
6. fail-fast validation
7. `--dry-run` と `--validate-only`
8. 完成 packet zip の生成
9. packet 自己検証テスト
