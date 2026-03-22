package open.dolphin.system.license;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Path;
import java.util.Properties;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileLicenseRepositoryTest {

    @TempDir
    Path tempDir;

    @Test
    void storeAndLoadUseConfiguredLicenseDirectory() throws Exception {
        FileLicenseRepository repository = new FileLicenseRepository();
        repository.configurationResolver = new ServerConfigurationResolver(java.util.Map.of(
                ServerConfigurationResolver.KEY_LICENSE_DIR, tempDir.toString()));

        Properties expected = new Properties();
        expected.setProperty("licenseKey", "abc123");
        repository.store(expected);

        Properties actual = repository.load();
        assertEquals("abc123", actual.getProperty("licenseKey"));
    }
}
