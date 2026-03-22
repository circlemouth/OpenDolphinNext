package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class OrcaTransportSettingsExternalConfigTest {

    @TempDir
    Path tempDir;

    @AfterEach
    void tearDown() {
        System.clearProperty("jboss.home.dir");
    }

    @Test
    void loadUsesResolverBackedTypedConfiguration() {
        OrcaTransportSettings settings = OrcaTransportSettings.load(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_API_HOST, "weborca-trial.orca.med.or.jp",
                ServerConfigurationResolver.KEY_ORCA_API_PORT, "443",
                ServerConfigurationResolver.KEY_ORCA_API_SCHEME, "https",
                ServerConfigurationResolver.KEY_ORCA_API_USER, "trial-user",
                ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "trial-password",
                ServerConfigurationResolver.KEY_ORCA_API_PATH_PREFIX, "/api",
                ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca"));

        assertTrue(settings.isReady());
        assertEquals("https://weborca-trial.orca.med.or.jp/api/orca11/appointmodv2",
                settings.buildOrcaUrl("/orca11/appointmodv2"));
    }

    @Test
    void loadIgnoresLegacyCustomPropertiesFile() throws Exception {
        System.setProperty("jboss.home.dir", tempDir.toString());
        Files.writeString(tempDir.resolve("custom.properties"), String.join("\n",
                "orca.orcaapi.ip=legacy-host",
                "orca.orcaapi.port=8000",
                "orca.id=legacy-user",
                "orca.password=legacy-password"));

        OrcaTransportSettings settings = OrcaTransportSettings.load();

        assertFalse(settings.isReady());
    }
}
