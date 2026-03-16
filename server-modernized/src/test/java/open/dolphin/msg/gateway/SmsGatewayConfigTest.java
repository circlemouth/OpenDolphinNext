package open.dolphin.msg.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SmsGatewayConfigTest {

    private final ServerConfigurationResolver resolver = new ServerConfigurationResolver();
    private final SmsGatewayConfig config = new SmsGatewayConfig(resolver);

    @AfterEach
    void tearDown() {
        clear(
                ServerConfigurationResolver.KEY_PLIVO_AUTH_ID,
                ServerConfigurationResolver.KEY_PLIVO_AUTH_TOKEN,
                ServerConfigurationResolver.KEY_PLIVO_SOURCE_NUMBER,
                ServerConfigurationResolver.KEY_PLIVO_BASE_URL,
                ServerConfigurationResolver.KEY_PLIVO_ENVIRONMENT,
                ServerConfigurationResolver.KEY_PLIVO_DEFAULT_COUNTRY,
                ServerConfigurationResolver.KEY_PLIVO_LOG_LEVEL,
                ServerConfigurationResolver.KEY_PLIVO_LOG_MESSAGE_CONTENT,
                ServerConfigurationResolver.KEY_PLIVO_HTTP_CONNECT_TIMEOUT,
                ServerConfigurationResolver.KEY_PLIVO_HTTP_READ_TIMEOUT,
                ServerConfigurationResolver.KEY_PLIVO_HTTP_WRITE_TIMEOUT,
                ServerConfigurationResolver.KEY_PLIVO_HTTP_CALL_TIMEOUT,
                ServerConfigurationResolver.KEY_PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE);
    }

    @Test
    void resolvesPlivoSettingsFromTypedConfigOnly() {
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_AUTH_ID, "auth-id");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_AUTH_TOKEN, "auth-token");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_SOURCE_NUMBER, "+819012345678");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_ENVIRONMENT, "sandbox");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_LOG_LEVEL, "body");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_LOG_MESSAGE_CONTENT, "true");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_DEFAULT_COUNTRY, "81");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_CONNECT_TIMEOUT, "PT12S");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_READ_TIMEOUT, "2500ms");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_WRITE_TIMEOUT, "31s");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_CALL_TIMEOUT, "1m");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE, "false");

        SmsGatewayConfig.PlivoSettings settings = config.reload();

        assertTrue(settings.isConfigured());
        assertEquals("https://api.sandbox.plivo.com/v1/", settings.baseUrl());
        assertEquals("sandbox", settings.environment());
        assertEquals("+81", settings.defaultCountryCode());
        assertEquals(Duration.ofSeconds(12), settings.connectTimeout());
        assertEquals(Duration.ofMillis(2500), settings.readTimeout());
        assertEquals(Duration.ofSeconds(31), settings.writeTimeout());
        assertEquals(Duration.ofMinutes(1), settings.callTimeout());
        assertFalse(settings.retryOnConnectionFailure());
    }

    @Test
    void rejectsNonHttpsBaseUrl() {
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_BASE_URL, "http://plivo.example.test");

        assertThrows(IllegalArgumentException.class, config::reload);
    }

    private void clear(String... keys) {
        for (String key : keys) {
            System.clearProperty(key);
        }
    }
}
