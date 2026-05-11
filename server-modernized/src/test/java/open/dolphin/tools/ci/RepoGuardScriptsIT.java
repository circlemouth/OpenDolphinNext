package open.dolphin.tools.ci;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.junit.jupiter.api.Test;

class RepoGuardScriptsIT {

    @Test
    void allRepoGuardScriptsPassAgainstCurrentRepository() throws Exception {
        Path repoRoot = findRepoRoot();
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-doc-links.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-config-contract.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-no-direct-runtime-lookup.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-no-runtime-ddl.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-persistence-entities.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-no-generated-artifacts.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-backup-restore-runbook.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-live-orca-trial-harness.sh");
        assertScriptSucceeds(repoRoot, "server-modernized/tools/ci/check-sensitive-evidence-redaction.sh");
    }

    @Test
    void checkNoGeneratedArtifactsPassesForCleanCommittedRepository() throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-artifacts-clean-it");
        initializeGitRepository(repoRoot);
        commitFile(repoRoot, "server-modernized/README.md", "clean\n");

        CommandResult result = runScript("server-modernized/tools/ci/check-no-generated-artifacts.sh", repoRoot);

        assertThat(result.exitCode()).isZero();
    }

    @Test
    void checkNoGeneratedArtifactsFailsForCommittedTargetArtifact() throws Exception {
        assertCommittedGeneratedArtifactIsRejected("server-modernized/target/tmp.txt");
    }

    @Test
    void checkNoGeneratedArtifactsFailsForCommittedWarArtifact() throws Exception {
        assertCommittedGeneratedArtifactIsRejected("release/review.war");
    }

    @Test
    void checkNoGeneratedArtifactsFailsForCommittedMacOsMetadataDirectory() throws Exception {
        assertCommittedGeneratedArtifactIsRejected("__MACOSX/a/b.txt");
    }

    @Test
    void checkNoGeneratedArtifactsFailsForCommittedDsStoreFile() throws Exception {
        assertCommittedGeneratedArtifactIsRejected(".DS_Store");
    }

    @Test
    void checkNoGeneratedArtifactsFailsForCommittedThumbsDbFile() throws Exception {
        assertCommittedGeneratedArtifactIsRejected("assets/Thumbs.db");
    }

    @Test
    void packagedWarDoesNotContainInitialAccountMakerClass() throws Exception {
        Path repoRoot = findRepoRoot();
        CommandResult packageResult = runCommand(
                repoRoot,
                List.of("mvn", "-q", "-f", "pom.server-modernized.xml", "-pl", "server-modernized", "-am", "-DskipTests", "package"));

        assertThat(packageResult.exitCode()).isZero();

        Path warFile = findPackagedWar(repoRoot);
        assertThat(warFile).isNotNull();
        assertThat(warFile.toString()).endsWith(".war");

        try (ZipFile zipFile = new ZipFile(warFile.toFile())) {
            List<String> entries = new ArrayList<>();
            zipFile.stream().map(ZipEntry::getName).forEach(entries::add);
            assertThat(entries).doesNotContain("WEB-INF/classes/open/dolphin/mbean/InitialAccountMaker.class");
        }
    }

    private static void assertScriptSucceeds(Path repoRoot, String relativeScriptPath) throws Exception {
        Process process = new ProcessBuilder("bash", repoRoot.resolve(relativeScriptPath).toString(), "--root", repoRoot.toString())
                .directory(repoRoot.toFile())
                .redirectErrorStream(true)
                .start();
        String output;
        try (java.io.InputStream input = process.getInputStream()) {
            output = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        int exitCode = process.waitFor();
        assertThat(exitCode)
                .withFailMessage("script failed: %s%n%s", relativeScriptPath, output)
                .isZero();
    }

    private static void assertCommittedGeneratedArtifactIsRejected(String relativePath) throws Exception {
        Path repoRoot = Files.createTempDirectory("repo-guard-artifacts-ng");
        initializeGitRepository(repoRoot);
        commitFile(repoRoot, "server-modernized/README.md", "clean\n");
        commitFile(repoRoot, relativePath, "artifact\n");
        CommandResult status = runCommand(repoRoot, List.of("git", "status", "--short"));
        assertThat(status.output()).isBlank();

        CommandResult result = runScriptAllowFailure("server-modernized/tools/ci/check-no-generated-artifacts.sh", repoRoot);

        assertThat(result.exitCode()).isNotZero();
        assertThat(result.output()).contains("generated artifacts");
        assertThat(result.output()).contains(relativePath);
    }

    private static void commitFile(Path repoRoot, String relativePath, String contents) throws Exception {
        Path file = repoRoot.resolve(relativePath);
        Path parent = file.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Files.writeString(file, contents);
        runCommand(repoRoot, List.of("git", "add", "--", relativePath));
        runCommand(repoRoot, List.of("git", "commit", "-m", "add " + relativePath));
    }

    private static CommandResult runScript(String relativeScriptPath, Path repoRoot) throws Exception {
        Path scriptPath = findRepoRoot().resolve(relativeScriptPath);
        return runCommand(repoRoot, List.of("bash", scriptPath.toString(), "--root", repoRoot.toString()));
    }

    private static CommandResult runScriptAllowFailure(String relativeScriptPath, Path repoRoot) throws Exception {
        Path scriptPath = findRepoRoot().resolve(relativeScriptPath);
        return runCommandAllowFailure(repoRoot, List.of("bash", scriptPath.toString(), "--root", repoRoot.toString()));
    }

    private static CommandResult runCommand(Path workdir, List<String> command) throws Exception {
        Process process = new ProcessBuilder(command)
                .directory(workdir.toFile())
                .redirectErrorStream(true)
                .start();
        String output;
        try (java.io.InputStream input = process.getInputStream()) {
            output = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        int exitCode = process.waitFor();
        assertThat(exitCode)
                .withFailMessage("command failed: %s%n%s", command, output)
                .isZero();
        return new CommandResult(exitCode, output);
    }

    private static CommandResult runCommandAllowFailure(Path workdir, List<String> command) throws Exception {
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

    private static void initializeGitRepository(Path repoRoot) throws Exception {
        runCommand(repoRoot, List.of("git", "init"));
        runCommand(repoRoot, List.of("git", "config", "user.name", "Codex"));
        runCommand(repoRoot, List.of("git", "config", "user.email", "codex@example.invalid"));
        Path emptyExcludes = Files.createTempFile("repo-guard-global-excludes", ".txt");
        Files.writeString(emptyExcludes, "");
        runCommand(repoRoot, List.of("git", "config", "core.excludesFile", emptyExcludes.toString()));
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

    private static Path findPackagedWar(Path repoRoot) throws Exception {
        Path targetDir = repoRoot.resolve("server-modernized/target");
        try (var paths = Files.list(targetDir)) {
            return paths
                    .filter(path -> path.getFileName().toString().endsWith(".war"))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Packaged WAR not found in " + targetDir));
        }
    }

    private record CommandResult(int exitCode, String output) {
    }
}
