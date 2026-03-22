package open.dolphin.msg.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;

class SmsGatewayConfigTest {

    @Test
    void resolvesPlivoSettingsFromTypedConfigOnly() {
        SmsGatewayConfig.PlivoSettings settings = new SmsGatewayConfig(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_PLIVO_AUTH_ID, "auth-id",
                ServerConfigurationResolver.KEY_PLIVO_AUTH_TOKEN, "auth-token",
                ServerConfigurationResolver.KEY_PLIVO_SOURCE_NUMBER, "+819012345678",
                ServerConfigurationResolver.KEY_PLIVO_ENVIRONMENT, "sandbox",
                ServerConfigurationResolver.KEY_PLIVO_LOG_LEVEL, "body",
                ServerConfigurationResolver.KEY_PLIVO_LOG_MESSAGE_CONTENT, "true",
                ServerConfigurationResolver.KEY_PLIVO_DEFAULT_COUNTRY, "81",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_CONNECT_TIMEOUT, "PT12S",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_READ_TIMEOUT, "2500ms",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_WRITE_TIMEOUT, "31s",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_CALL_TIMEOUT, "1m",
                ServerConfigurationResolver.KEY_PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE, "false"))
                .reload();

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
        SmsGatewayConfig config = new SmsGatewayConfig(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_PLIVO_BASE_URL, "http://plivo.example.test"));
        assertThrows(IllegalArgumentException.class, config::reload);
    }
}
