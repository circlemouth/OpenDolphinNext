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

    private static void createDocLinkFixture(Path repoRoot, boolean includeTarget) throws IOException {
        Files.createDirectories(repoRoot.resolve("docs/development"));
        Files.createDirectories(repoRoot.resolve("docs/contracts"));
        Files.createDirectories(repoRoot.resolve("docs/runbooks"));
        Files.createDirectories(repoRoot.resolve("docs/server-modernization"));
        Files.createDirectories(repoRoot.resolve("server-modernized"));

        Files.writeString(repoRoot.resolve("README.md"), "[Docs](docs/README.md)\n");
        Files.writeString(repoRoot.resolve("docs/README.md"), "[Checklist](development/server-modernized-remediation-master-checklist.md)\n");
        Files.writeString(repoRoot.resolve("docs/development/server-modernized-remediation-master-checklist.md"), "# checklist\n");
        Files.writeString(repoRoot.resolve("docs/development/pull-request-checklist-template.md"), "# pr\n");
        Files.writeString(repoRoot.resolve("docs/development/execution-log.md"), "# log\n");
        Files.writeString(repoRoot.resolve("docs/contracts/document-integrity.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/health-endpoints.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/orca-connection.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/orca-master-api.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/patient-images.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/contracts/runtime-config.md"), "# contract\n");
        Files.writeString(repoRoot.resolve("docs/runbooks/release-validation.md"), "# runbook\n");
        String target = includeTarget ? "../README.md" : "../missing.md";
        Files.writeString(repoRoot.resolve("docs/server-modernization/README.md"), "[Root](" + target + ")\n");
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

    private static void initializeGitRepository(Path repoRoot) throws Exception {
        runCommand(repoRoot, "git", "init");
        runCommand(repoRoot, "git", "config", "user.name", "Codex");
        runCommand(repoRoot, "git", "config", "user.email", "codex@example.invalid");
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
