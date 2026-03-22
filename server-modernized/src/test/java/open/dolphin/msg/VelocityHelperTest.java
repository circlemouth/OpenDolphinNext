package open.dolphin.msg;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class VelocityHelperTest {

    @TempDir
    Path tempDir;

    @Test
    void resolveTemplatePathsPrefersConfiguredAndDataDirectories() throws Exception {
        Path configured = tempDir.resolve("configured-templates");
        Files.createDirectories(configured);
        Path dataDir = tempDir.resolve("data");
        Files.createDirectories(dataDir.resolve("templates"));

        List<String> paths = VelocityHelper.resolveTemplatePaths(
                new ServerConfigurationResolver(java.util.Map.of(
                        ServerConfigurationResolver.KEY_TEMPLATES_DIR, configured.toString(),
                        ServerConfigurationResolver.KEY_SERVER_DATA_DIR, dataDir.toString())),
                tempDir);

        assertEquals(configured.toString(), paths.get(0));
        assertEquals(dataDir.resolve("templates").toString(), paths.get(1));
    }

    @Test
    void resolveTemplatePathsFallsBackToLocalTemplatesWhenNoConfigExists() {
        List<String> paths = VelocityHelper.resolveTemplatePaths(
                new ServerConfigurationResolver(java.util.Map.of()),
                tempDir);

        assertEquals(1, paths.size());
        assertTrue(paths.get(0).endsWith("/templates"));
    }
}
