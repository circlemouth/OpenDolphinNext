# 01. CWP-01 integration gate

## Status received

CWP-01 worker report:

```text
status: PASS
branch: codex/cwp01-karte-order-persistence
commit: f6121aa23 docs: finalize CWP-01 order persistence evidence
artifact: clinical-input-cwp01-karte-order-persistence-20260421.zip
sha256: bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2
```

Docset 作成時に添付 artifact の SHA-256 が報告値と一致することは確認済みです。

```text
observed_sha256: bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2
```

ただし、Codex 実端末で branch / commit / targeted tests / worktree clean を再確認するまで、CWP-01 は integration base として未受入扱いです。

## Integration gate commands

リポジトリで次を実行する。

```bash
git fetch --all --prune
git checkout codex/cwp01-karte-order-persistence
git rev-parse HEAD
git status --short
sha256sum artifacts/codex/clinical-input-cwp01-karte-order-persistence-20260421.zip || true
unzip -l artifacts/codex/clinical-input-cwp01-karte-order-persistence-20260421.zip || true

git diff --check
bash server-modernized/tools/ci/check-doc-links.sh
mvn -f pom.server-modernized.xml -pl server-modernized -am \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=CanonicalOrderDocumentFixtureTest,KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest,KarteRevisionSnapshotContractTest,KarteRevisionDocumentResponseJsonTest,KarteDocumentSnapshotContractTest,DocumentIntegrityServiceTest test
```

artifact zip が repository に置かれていない場合は、ワーカー提出 artifact を `artifacts/codex/` に配置してから SHA-256 を検証するか、artifact check を `not available` として記録する。

## Accepted only if

- branch and commit match or intentional rebase is documented
- targeted Maven command exits 0
- test count and failure count are recorded
- `git diff --check` exits 0
- doc link check exits 0 or documented as not applicable with reason
- artifact SHA-256 matches if artifact is present
- artifact contains source/test/docs/sanitized logs only; no build artifacts
- live ORCA mutation was not performed
- Playwright/e2e/runtime browser was not claimed unless actually executed

## Gate decision labels

- `ACCEPTED FOR WAVE 1 BASE`
- `PARTIAL / ACCEPT WITH NOT VERIFIED ITEMS`
- `BLOCKED`

## Required gate report

Use `templates/INTEGRATION_GATE_REPORT_TEMPLATE.md`.
