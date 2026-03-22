package open.dolphin.tools.ci;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
}
