package open.dolphin.runtime.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Base64;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ServerConfigurationValidatorTest {

    private final ServerConfigurationResolver resolver = new ServerConfigurationResolver();
    private final ServerConfigurationValidator validator = new ServerConfigurationValidator(resolver);

    @AfterEach
    void tearDown() {
        clear(
                ServerConfigurationResolver.KEY_ENVIRONMENT,
                ServerConfigurationResolver.KEY_TIMEZONE,
                ServerConfigurationResolver.KEY_DB_HOST,
                ServerConfigurationResolver.KEY_DB_NAME,
                ServerConfigurationResolver.KEY_DB_USER,
                ServerConfigurationResolver.KEY_DB_PASSWORD,
                ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64,
                ServerConfigurationResolver.KEY_FIDO2_RP_ID,
                ServerConfigurationResolver.KEY_FIDO2_RP_NAME,
                ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS);
    }

    @Test
    void rejectsMissingRequiredStartupConfiguration() {
        System.setProperty(ServerConfigurationResolver.KEY_ENVIRONMENT, "dev");

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("db.host"));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64));
        assertTrue(ex.getMessage().contains(ServerConfigurationResolver.KEY_FIDO2_RP_ID));
    }

    @Test
    void acceptsCompleteStartupConfiguration() {
        System.setProperty(ServerConfigurationResolver.KEY_ENVIRONMENT, "dev");
        System.setProperty(ServerConfigurationResolver.KEY_TIMEZONE, "Asia/Tokyo");
        System.setProperty(ServerConfigurationResolver.KEY_DB_HOST, "localhost");
        System.setProperty(ServerConfigurationResolver.KEY_DB_NAME, "opendolphin");
        System.setProperty(ServerConfigurationResolver.KEY_DB_USER, "app");
        System.setProperty(ServerConfigurationResolver.KEY_DB_PASSWORD, "secret");
        System.setProperty(ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64,
                Base64.getEncoder().encodeToString("0123456789abcdef0123456789abcdef".getBytes()));
        System.setProperty(ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost");
        System.setProperty(ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin");
        System.setProperty(ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443");

        assertDoesNotThrow(validator::validateOrThrow);
    }

    private void clear(String... keys) {
        for (String key : keys) {
            System.clearProperty(key);
        }
    }
}
