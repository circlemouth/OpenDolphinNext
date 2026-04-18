package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
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

    @Test
    void loadDoesNotLogRawMalformedBaseUrl() {
        Logger logger = Logger.getLogger(OrcaTransportSettings.class.getName());
        CapturingHandler handler = new CapturingHandler();
        Level originalLevel = logger.getLevel();
        boolean originalUseParentHandlers = logger.getUseParentHandlers();
        logger.setUseParentHandlers(false);
        logger.setLevel(Level.ALL);
        logger.addHandler(handler);
        String rawBaseUrl = "https://admin:pass@bad host.example.invalid/secret-prefix";
        try {
            IllegalArgumentException ex = org.junit.jupiter.api.Assertions.assertThrows(
                    IllegalArgumentException.class,
                    () -> OrcaTransportSettings.load(TestServerConfigurationResolvers.resolver(
                            ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, rawBaseUrl,
                            ServerConfigurationResolver.KEY_ORCA_API_USER, "trial-user",
                            ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "trial-password",
                            ServerConfigurationResolver.KEY_ORCA_API_MODE, "weborca")));

            assertEquals("サーバURLが不正です。", ex.getMessage());
            String joined = String.join("\n", handler.messages);
            assertTrue(joined.contains("Invalid ORCA transport"));
            assertFalse(joined.contains(rawBaseUrl));
            assertFalse(joined.contains("admin:pass"));
            assertFalse(joined.contains("bad host.example.invalid"));
            assertFalse(joined.contains("secret-prefix"));
        } finally {
            logger.removeHandler(handler);
            logger.setLevel(originalLevel);
            logger.setUseParentHandlers(originalUseParentHandlers);
        }
    }

    private static final class CapturingHandler extends Handler {
        private final List<String> messages = new ArrayList<>();

        @Override
        public void publish(LogRecord record) {
            if (record != null && record.getMessage() != null) {
                Object[] params = record.getParameters();
                messages.add(params != null && params.length > 0
                        ? MessageFormat.format(record.getMessage(), params)
                        : record.getMessage());
            }
        }

        @Override
        public void flush() {
        }

        @Override
        public void close() {
        }
    }
}
