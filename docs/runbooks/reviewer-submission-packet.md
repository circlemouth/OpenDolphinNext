# Reviewer Submission Packet

## 目的

reviewer 提出物を logs-only archive ではなく、同一 `RUN_ID` / 同一 accepted `HEAD` に固定した `review-checkout/` と `closeout-packet/` の組として生成・検証する。

## 入口

- 生成: `./scripts/create-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <BRANCH>`
- 検証: `./scripts/validate-reviewer-submission-packet.sh --run-id <RUN_ID> --accepted-ref <BRANCH>`

既定の出力先は `artifacts/reviewer-submission-packets/`。必要なら `--output <DIR>` を付ける。

## Canonical Flow
- canonical: `docs/runbooks/reviewer-submission-packet.md` + `scripts/create-reviewer-submission-packet.sh` + `scripts/validate-reviewer-submission-packet.sh` + `tests/review-packet/`
- support: `scripts/create-review-package.sh` + `tests/review-package/` + `artifacts/review-bundles/`
- deprecated: `scripts/create-review-archive.sh`

この runbook でいう reviewer 提出物は常に `reviewer submission packet` を指す。`review package` は軽量 source bundle の補助用途としてのみ扱う。

## 必須オプション

- `--run-id`: closeout evidence の `RUN_ID`
- `--accepted-ref`: accepted source of truth とみなす branch/ref

## サポートオプション

- `--output`: packet 出力先ディレクトリ
- `--accepted-head`: accepted branch/ref が evidence freeze 後に進んだ場合に、packet を固定したい commit
- `--dry-run`: 入力検証と出力予定パスの表示だけを行い、書き込みしない
- `--validate-only`: 既に生成済み packet を再検証する

`--accepted-head` は通常不要だが、`git/accepted-branch.txt` の branch 名は固定しつつ、`git/git-head-current.txt` の accepted HEAD を明示したい場合に使う。

## 入力契約

- closeout evidence は `artifacts/orca-remediation/closeout/<RUN_ID>/` に揃っていること
- `git/run-id.txt`、`git/accepted-branch.txt`、`git/git-head-current.txt` が現在の `RUN_ID` / accepted ref / accepted HEAD と一致すること
- accepted branch/ref が既に別 commit を指している場合でも、`--accepted-head` を使って current accepted HEAD を固定できること
- `reports/final-report.md`、`reports/command-log.md`、`reports/blocker-classification.md` が存在すること
- `qa/acceptmodv2/`、`qa/fullflow/`、`evidence/patients-import/`、`evidence/medical-information-probe/`、`evidence/runtime-blockers/` の required file が欠けていないこと
- `qa/fullflow/summary.json` が send 到達を示す場合、`qa/fullflow/request-xml/medicalmodv2.xml` が存在すること

## 出力レイアウト

`submission-packet-<RUN_ID>/`

- `README_REVIEW.md`
- `manifest.json`
- `manifest.sha256`
- `review-checkout/`
  - `.git/`
  - accepted HEAD の clean checkout
- `closeout-packet/`
  - `git/`
  - `reports/`
  - `qa/`
  - `evidence/`
  - `docs/`

同じ出力先に `submission-packet-<RUN_ID>.zip` も生成する。

## 強制ルール

- `review-checkout/` の `git status --short` は空でなければならない
- `review-checkout/` には `origin/master` ref が存在しなければならない
- `review-checkout/HEAD`、`closeout-packet/git/git-head-current.txt`、`manifest.json` の HEAD はすべて一致しなければならない
- `node_modules`、`target`、`dist`、`coverage`、`artifacts`、`tmp` などの生成物は `review-checkout/` に入れない
- report / manifest / copied evidence 内に絶対ローカルパスが残っていたら fail する

## 旧方式

`scripts/create-review-archive.sh` は reviewer submission packet の正本ではない。実行すると fail し、新 tool へ誘導する。
