# 09. CWP-01 worker report captured for integration gate

This is the worker report supplied before creating this Wave 1 docset. Treat it as reported evidence until the main Codex agent reruns the integration gate in the repository.

```text
ステータス: PASS
ブランチ: codex/cwp01-karte-order-persistence
最終 commit: f6121aa23 docs: finalize CWP-01 order persistence evidence
worktree: clean

実装・統合内容:

order module fixture 追加: CanonicalOrderDocumentFixture.java
save/readback test 拡張: KarteDocumentOrderModulePersistenceTest.java
revision / diff / restore / revise / integrity test 拡張:
KarteRevisionServiceBeanOrderModuleCloneTest.java,
KarteRevisionSnapshotContractTest.java,
DocumentIntegrityServiceTest.java
evidence docset 更新: README.md
artifact 作成: clinical-input-cwp01-karte-order-persistence-20260421.zip
SHA-256: bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2

Verified:

medOrder / treatmentOrder / radiologyOrder を含む canonical DocumentModel fixture。
KarteDocumentWriteService.addDocument 経由の equivalent server write path で beanJson encode、module metadata、parent backreference、integrity seal を確認。
detail readback で entity / stamp metadata / beanJson / decoded BundleDolphin / parent refs を確認。
revision snapshot、restore/revise clone path、diff digest、integrity tamper detection で order module preservation を確認。

Targeted commands:

mvn -f pom.server-modernized.xml -pl server-modernized -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=CanonicalOrderDocumentFixtureTest,KarteDocumentOrderModulePersistenceTest,KarteRevisionServiceBeanOrderModuleCloneTest,KarteRevisionSnapshotContractTest,KarteRevisionDocumentResponseJsonTest,KarteDocumentSnapshotContractTest,DocumentIntegrityServiceTest test
exit code 0
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
git diff --check: exit code 0
bash server-modernized/tools/ci/check-doc-links.sh: exit code 0
zip contents inspected with unzip -l: 11 source/test/docs files only, no build artifacts.

Not verified:

Playwright / e2e / runtime success: not run, not claimed.
Phase 3 / Phase 4 / fullflow: not run, not claimed.
live ORCA mutation / ORCA medicalmodv2 success: not run, not claimed.
HTTP-level revise/restore authorization/history-group full flow: next package if required.
ORCA claim field semantics (classCode, adminCode, claim item meanings): 要 ORCA 公式仕様確認。

ORCA boundary:
これは local chart/document persistence のテスト証跡であり、ORCA medicalmodv2 live mutation の成功証明ではありません。raw HAR / trace / video / screenshot / credentials / secrets は成果物に含めていません。
```

Docset creation check:

```text
observed uploaded artifact sha256: bb7d646646b474cb345e108f25dfa0e3fad2db5a13d55b7285d94d85096c26f2
```
