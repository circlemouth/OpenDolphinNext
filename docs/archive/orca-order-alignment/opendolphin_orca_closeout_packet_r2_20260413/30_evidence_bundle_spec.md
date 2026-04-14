# evidence bundle spec R2

closeout 提出物は、**third party が rerun なしで読める** ことを条件とする。
launcher log だけでは不可。

## 1. 推奨ディレクトリ

`artifacts/orca-remediation/closeout/<RUN_ID>/`

最低限、次を持つこと。

```text
artifacts/orca-remediation/closeout/<RUN_ID>/
  git/
    git-status.txt
    git-head.txt
    git-branch.txt
    git-remote-origin.txt
    git-merge-base.txt
    git-diff-stat.txt
  tests/
    server-verify.log
    web-ci.log
    web-targeted.log
    server-targeted.log
    runtime-ready-smoke.log
    qa-acceptmodv2-weborca.log
    qa-fullflow-weborca.log
  qa/fullflow/
    summary.md
    summary.json
    steps.log
    console.json
    page-errors.json
    screenshots/
      01-*.png
      02-*.png
      ...
    network/
      network.json
      requests.json
    request-xml/
      medicalmodv2.xml
    har/
      network.har        # optional
  qa/acceptmodv2/
    accept-summary.md   # optional but recommended
    accept-summary.json
    steps.log
    console.json
    page-errors.json
    network/
      network.json
      requests.json
    screenshots/
      *.png
  reports/
    final-report.md
```

## 2. summary.json に最低限入れるもの

- runId
- traceId
- executedAt
- git head / branch / merge-base
- environment summary
- receptionRowStatus
- charts handoff status
- orderResult
- sendResult
- validation of captured `medicalmodv2` XML
- blocker classification
  - `none`
  - `repo-defect`
  - `environment-blocker`
  - `test-data-blocker`
- evidence paths

## 3. summary.md に最低限書くこと

- 何が通ったか
- どこで止まったか
- その理由は repo-side か external か
- 参照すべき screenshot / network / xml path
- rerun command

## 4. medicalmodv2 request XML

live fullflow で ORCA send に到達した場合、`medicalmodv2` request XML は必ず別ファイルにも切り出す。

- `qa/fullflow/request-xml/medicalmodv2.xml`

## 5. page errors / console

- `console.json` と `page-errors.json` を別ファイルで残す
- 0 件なら 0 件と分かる JSON を残す
- error を無視して summary だけ成功扱いにしない

## 6. 不可とする提出形態

- launcher log だけ
- summary path を report に書くだけで、実ファイルを同梱しない
- request XML を log の一部にしか残さない
- browser close 後 screenshot error で artifact を欠損させる
