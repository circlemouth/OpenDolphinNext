package open.dolphin.tools.ci;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class RepoGuardScriptsTest {

    @Test
    void checkDocLinksPassesForConsistentFixture() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-doc-links-ok");
        createDocLinkFixture(repoRoot, true);

        CommandResult result = runScript("server-modernized/tools/ci/check-doc-links.sh", repoRoot);

        assertThat(result.exitCode()).isZero();
    }

    @Test
    void checkDocLinksFailsForBrokenFixture() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-doc-links-ng");
        createDocLinkFixture(repoRoot, false);

        CommandResult result = runScript("server-modernized/tools/ci/check-doc-links.sh", repoRoot);

        assertThat(result.exitCode()).isNotZero();
        assertThat(result.output()).contains("broken link");
    }

    @Test
    void checkConfigContractPassesWhenSampleContainsResolverKeys() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-config-ok");
        createConfigFixture(repoRoot, true);

        CommandResult result = runScript("server-modernized/tools/ci/check-config-contract.sh", repoRoot);

        assertThat(result.exitCode()).isZero();
    }

    @Test
    void checkConfigContractFailsWhenSampleMissesResolverKey() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-config-ng");
        createConfigFixture(repoRoot, false);

        CommandResult result = runScript("server-modernized/tools/ci/check-config-contract.sh", repoRoot);

        assertThat(result.exitCode()).isNotZero();
        assertThat(result.output()).contains("missing sample env key");
    }

    @Test
    void checkNoGeneratedArtifactsPassesWhenReviewTargetIsClean() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-artifacts-ok");
        initializeGitRepository(repoRoot);
        Files.createDirectories(repoRoot.resolve("server-modernized"));
        Files.writeString(repoRoot.resolve("server-modernized/README.md"), "clean\n");
        runCommand(repoRoot, "git", "add", "server-modernized/README.md");
        runCommand(repoRoot, "git", "commit", "-m", "init");

        CommandResult result = runScript("server-modernized/tools/ci/check-no-generated-artifacts.sh", repoRoot);

        assertThat(result.exitCode()).isZero();
    }

    @Test
    void checkNoGeneratedArtifactsFailsWhenTargetIsInReviewTarget() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-artifacts-ng");
        initializeGitRepository(repoRoot);
        Files.createDirectories(repoRoot.resolve("server-modernized"));
        Files.writeString(repoRoot.resolve("server-modernized/README.md"), "clean\n");
        runCommand(repoRoot, "git", "add", "server-modernized/README.md");
        runCommand(repoRoot, "git", "commit", "-m", "init");
        Files.createDirectories(repoRoot.resolve("server-modernized/target"));
        Files.writeString(repoRoot.resolve("server-modernized/target/generated.txt"), "artifact\n");

        CommandResult result = runScript("server-modernized/tools/ci/check-no-generated-artifacts.sh", repoRoot);

        assertThat(result.exitCode()).isNotZero();
        assertThat(result.output()).contains("generated artifacts");
    }

    @Test
    void checkAuditAppendOnlyPassesForAppendOnlyFixture() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-audit-ok");
        createAuditAppendOnlyFixture(repoRoot, false);

        CommandResult result = runScript("server-modernized/tools/ci/check-audit-append-only.sh", repoRoot);

        assertThat(result.exitCode()).isZero();
    }

    @Test
    void checkAuditAppendOnlyFailsWhenProductionCodeMutatesAuditEvent() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-audit-ng");
        createAuditAppendOnlyFixture(repoRoot, true);

        CommandResult result = runScript("server-modernized/tools/ci/check-audit-append-only.sh", repoRoot);

        assertThat(result.exitCode()).isNotZero();
        assertThat(result.output()).contains("audit_event must remain append-only");
    }

    @Test
    void checkSensitiveEvidenceRedactionPassesForSanitizedSnapshot() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-sensitive-evidence-ok");
        initializeGitRepository(repoRoot);
        Files.createDirectories(repoRoot.resolve("web-client/src/features/reception/__tests__/__snapshots__"));
        Files.writeString(
                repoRoot.resolve("web-client/src/features/reception/__tests__/__snapshots__/safe.snap"),
                "credentialConfigured=true rawSensitiveFieldsExcluded=true patientInformationPresent=true\n");
        runCommand(repoRoot, "git", "add", "web-client/src/features/reception/__tests__/__snapshots__/safe.snap");
        runCommand(repoRoot, "git", "commit", "-m", "add sanitized snapshot");

        CommandResult result = runScript("server-modernized/tools/ci/check-sensitive-evidence-redaction.sh", repoRoot);

        assertThat(result.exitCode()).isZero();
    }

    @Test
    void checkSensitiveEvidenceRedactionFailsForCredentialInTestResult() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-sensitive-evidence-credential-ng");
        initializeGitRepository(repoRoot);
        Files.createDirectories(repoRoot.resolve("test-results"));
        Files.writeString(repoRoot.resolve("test-results/output.txt"), "Authorization: Basic dXNlcjpwYXNzd29yZA==\n");

        CommandResult result = runScript("server-modernized/tools/ci/check-sensitive-evidence-redaction.sh", repoRoot);

        assertThat(result.exitCode()).isNotZero();
        assertThat(result.output()).contains("credential/PHI/raw ORCA markers");
    }

    @Test
    void checkSensitiveEvidenceRedactionFailsForHarArtifact() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-sensitive-evidence-har-ng");
        initializeGitRepository(repoRoot);
        Files.createDirectories(repoRoot.resolve("web-client/test-results"));
        Files.writeString(repoRoot.resolve("web-client/test-results/network.har"), "{}\n");

        CommandResult result = runScript("server-modernized/tools/ci/check-sensitive-evidence-redaction.sh", repoRoot);

        assertThat(result.exitCode()).isNotZero();
        assertThat(result.output()).contains("raw browser/test artifact files");
    }

    private static void createDocLinkFixture(Path repoRoot, boolean includeTarget) throws IOException {
        Files.createDirectories(repoRoot.resolve("docs/managerdocs"));
        Files.createDirectories(repoRoot.resolve("docs/architecture"));
        Files.createDirectories(repoRoot.resolve("docs/contracts"));
        Files.createDirectories(repoRoot.resolve("docs/runbooks"));
        Files.createDirectories(repoRoot.resolve("docs/operations"));
        Files.createDirectories(repoRoot.resolve("server-modernized"));

        Files.writeString(repoRoot.resolve("README.md"), "[Docs](docs/README.md)\n");
        Files.writeString(repoRoot.resolve("docs/README.md"), "[Manager](managerdocs/README.md)\n");
        Files.writeString(repoRoot.resolve("docs/managerdocs/README.md"), "# manager\n");
        Files.writeString(repoRoot.resolve("docs/architecture/server-modernization-overview.md"), "# server\n");
        Files.writeString(repoRoot.resolve("docs/architecture/web-client-overview.md"), "# web\n");
        Files.writeString(repoRoot.resolve("docs/contracts/document-integrity.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/health-endpoints.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/orca-connection.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/orca-master-api.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/patient-images.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/runtime-config.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/runbooks/release-validation.md"), "# runbook\n");
        Files.writeString(repoRoot.resolve("docs/runbooks/pull-request-checklist.md"), "# pr\n");
        Files.writeString(repoRoot.resolve("docs/operations/ORCA_CERTIFICATION_ONLY.md"), "# orca\n");
        String target = includeTarget ? "../README.md" : "../missing.md";
        Files.writeString(repoRoot.resolve("docs/managerdocs/README.md"), "[Root](" + target + ")\n");
        Files.writeString(repoRoot.resolve("server-modernized/README.md"), "[Docs](../docs/README.md)\n");
    }

    private static void createConfigFixture(Path repoRoot, boolean includeRequiredKey) throws IOException {
        Path resolverDir = repoRoot.resolve("server-modernized/src/main/java/open/dolphin/runtime/config");
        Files.createDirectories(resolverDir);
        Files.createDirectories(repoRoot.resolve("server-modernized/config"));
        Files.writeString(
                resolverDir.resolve("ServerConfigurationResolver.java"),
                """
                package open.dolphin.runtime.config;

                public class ServerConfigurationResolver {
                    public static final String KEY_ENVIRONMENT = "opendolphin.environment";
                    public static final String KEY_TIMEZONE = "opendolphin.timezone";
                }
                """);
        String sample = includeRequiredKey
                ? "OPENDOLPHIN_ENVIRONMENT=dev\nOPENDOLPHIN_TIMEZONE=Asia/Tokyo\n"
                : "OPENDOLPHIN_ENVIRONMENT=dev\n";
        Files.writeString(repoRoot.resolve("server-modernized/config/server-modernized.env.sample"), sample);
    }

    private static void createAuditAppendOnlyFixture(Path repoRoot, boolean includeForbiddenMutation) throws IOException {
        Path auditDir = repoRoot.resolve("server-modernized/src/main/java/open/dolphin/security/audit");
        Files.createDirectories(auditDir);
        Files.createDirectories(repoRoot.resolve("domain/src/main/java"));
        Files.writeString(
                auditDir.resolve("AuthoritativeAuditRepository.java"),
                """
                package open.dolphin.security.audit;

                public class AuthoritativeAuditRepository {
                    public AuditWriteResult append(AuditWriteCommand command) {
                        return null;
                    }

                    private void updateChainHead() {
                    }

                    public record AuditWriteCommand() {
                    }

                    public record AuditWriteResult() {
                    }
                }
                """);
        Files.writeString(
                auditDir.resolve("AuditChainVerifier.java"),
                """
                package open.dolphin.security.audit;

                public class AuditChainVerifier {
                    public VerificationResult verifyAll() {
                        return null;
                    }

                    public record VerificationResult() {
                    }
                }
                """);
        if (includeForbiddenMutation) {
            Files.writeString(
                    repoRoot.resolve("domain/src/main/java/UnsafeAuditMutation.java"),
                    """
                    class UnsafeAuditMutation {
                        static final String SQL = "update opendolphin.audit_event set event_hash = ?";
                    }
                    """);
        }
    }

    private static void initializeGitRepository(Path repoRoot) throws Exception {
        runCommand(repoRoot, "git", "init");
        runCommand(repoRoot, "git", "config", "user.name", "Codex");
        runCommand(repoRoot, "git", "config", "user.email", "codex@example.invalid");
        Path emptyExcludes = Files.createTempFile("repo-guard-global-excludes", ".txt");
        Files.writeString(emptyExcludes, "");
        runCommand(repoRoot, "git", "config", "core.excludesFile", emptyExcludes.toString());
    }

    private static CommandResult runScript(String relativeScriptPath, Path repoRoot) throws Exception {
        Path scriptPath = findRepoRoot().resolve(relativeScriptPath);
        return runCommand(repoRoot, "bash", scriptPath.toString(), "--root", repoRoot.toString());
    }

    private static CommandResult runCommand(Path workdir, String... command) throws Exception {
        Process process = new ProcessBuilder(command)
                .directory(workdir.toFile())
                .redirectErrorStream(true)
                .start();
        String output;
        try (java.io.InputStream input = process.getInputStream()) {
            output = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        int exitCode = process.waitFor();
        return new CommandResult(exitCode, output);
    }

    private static Path findRepoRoot() {
        Path cursor = Path.of("").toAbsolutePath().normalize();
        while (cursor != null) {
            if (Files.exists(cursor.resolve("pom.server-modernized.xml"))) {
                return cursor;
            }
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("Repository root not found");
    }

    private record CommandResult(int exitCode, String output) {
    }
}
