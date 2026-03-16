package open.dolphin.runtime.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ServerConfigurationResolverTest {

    private final ServerConfigurationResolver resolver = new ServerConfigurationResolver();

    @AfterEach
    void tearDown() {
        clear(
                ServerConfigurationResolver.KEY_ENVIRONMENT,
                ServerConfigurationResolver.KEY_TIMEZONE,
                ServerConfigurationResolver.KEY_FACILITY_ID,
                ServerConfigurationResolver.KEY_CLOUD_ZERO,
                ServerConfigurationResolver.KEY_PVT_ENABLED,
                ServerConfigurationResolver.KEY_PVT_BIND_IP,
                ServerConfigurationResolver.KEY_PVT_PORT,
                ServerConfigurationResolver.KEY_DB_HOST,
                ServerConfigurationResolver.KEY_DB_PORT,
                ServerConfigurationResolver.KEY_DB_NAME,
                ServerConfigurationResolver.KEY_DB_USER,
                ServerConfigurationResolver.KEY_DB_PASSWORD,
                ServerConfigurationResolver.KEY_ORCA_DB_HOST,
                ServerConfigurationResolver.KEY_ORCA_DB_PORT,
                ServerConfigurationResolver.KEY_ORCA_DB_NAME,
                ServerConfigurationResolver.KEY_ORCA_DB_USER,
                ServerConfigurationResolver.KEY_ORCA_DB_PASSWORD,
                ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64,
                ServerConfigurationResolver.KEY_FIDO2_RP_ID,
                ServerConfigurationResolver.KEY_FIDO2_RP_NAME,
                ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS,
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
    void resolvesOrcaSpecificDatasourceNamespaceWhenPresent() {
        System.setProperty(ServerConfigurationResolver.KEY_ORCA_DB_HOST, "orca-db");
        System.setProperty(ServerConfigurationResolver.KEY_ORCA_DB_PORT, "5432");
        System.setProperty(ServerConfigurationResolver.KEY_ORCA_DB_NAME, "orca");
        System.setProperty(ServerConfigurationResolver.KEY_ORCA_DB_USER, "orca_user");
        System.setProperty(ServerConfigurationResolver.KEY_ORCA_DB_PASSWORD, "secret");

        ServerRuntimeConfiguration.DatasourceSettings settings = resolver.orcaDatasource();

        assertEquals("orca.db", settings.namespace());
        assertEquals("orca-db", settings.host());
        assertEquals(5432, settings.port());
        assertEquals("orca", settings.database());
        assertEquals("orca_user", settings.user());
    }

    @Test
    void fallsBackToGenericDatasourceNamespaceWhenOrcaSpecificKeysAreAbsent() {
        System.setProperty(ServerConfigurationResolver.KEY_DB_HOST, "shared-db");
        System.setProperty(ServerConfigurationResolver.KEY_DB_NAME, "opendolphin");
        System.setProperty(ServerConfigurationResolver.KEY_DB_USER, "app");
        System.setProperty(ServerConfigurationResolver.KEY_DB_PASSWORD, "pw");

        ServerRuntimeConfiguration.DatasourceSettings settings = resolver.orcaDatasource();

        assertEquals("db", settings.namespace());
        assertEquals("shared-db", settings.host());
        assertNull(settings.port());
        assertEquals("opendolphin", settings.database());
    }

    @Test
    void resolvesFido2OriginsAsList() {
        System.setProperty(ServerConfigurationResolver.KEY_FIDO2_RP_ID, "example.local");
        System.setProperty(ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin");
        System.setProperty(ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS,
                "https://example.local, http://localhost:8080");

        ServerRuntimeConfiguration.Fido2Settings settings = resolver.fido2();

        assertEquals("example.local", settings.relyingPartyId());
        assertEquals("OpenDolphin", settings.relyingPartyName());
        assertEquals(2, settings.allowedOrigins().size());
        assertEquals("https://example.local", settings.allowedOrigins().get(0));
    }

    @Test
    void resolvesOrcaRuntimeSettingsAsTypedValues() {
        System.setProperty(ServerConfigurationResolver.KEY_FACILITY_ID, "facility01");
        System.setProperty(ServerConfigurationResolver.KEY_CLOUD_ZERO, "true");
        System.setProperty(ServerConfigurationResolver.KEY_PVT_ENABLED, "true");
        System.setProperty(ServerConfigurationResolver.KEY_PVT_BIND_IP, "127.0.0.1");
        System.setProperty(ServerConfigurationResolver.KEY_PVT_PORT, "5001");

        ServerRuntimeConfiguration.OrcaRuntimeSettings settings = resolver.orcaRuntime();

        assertEquals("facility01", settings.facilityId());
        assertEquals(true, settings.cloudZero());
        assertEquals(true, settings.pvtListener().enabled());
        assertEquals("127.0.0.1", settings.pvtListener().bindIp());
        assertEquals(5001, settings.pvtListener().port());
    }

    @Test
    void resolvesPlivoSettingsAsTypedValues() {
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_AUTH_ID, "auth-id");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_AUTH_TOKEN, "auth-token");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_SOURCE_NUMBER, "+819012345678");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_ENVIRONMENT, "sandbox");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_LOG_LEVEL, "headers");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_LOG_MESSAGE_CONTENT, "true");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_CONNECT_TIMEOUT, "1500ms");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_READ_TIMEOUT, "PT40S");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_WRITE_TIMEOUT, "45s");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_CALL_TIMEOUT, "2m");
        System.setProperty(ServerConfigurationResolver.KEY_PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE, "false");

        ServerRuntimeConfiguration.PlivoSettings settings = resolver.plivo();

        assertEquals("auth-id", settings.authId());
        assertEquals("sandbox", settings.environment());
        assertEquals("headers", settings.logLevel());
        assertEquals(Boolean.TRUE, settings.logMessageContent());
        assertEquals(Duration.ofMillis(1500), settings.connectTimeout());
        assertEquals(Duration.ofSeconds(40), settings.readTimeout());
        assertEquals(Duration.ofSeconds(45), settings.writeTimeout());
        assertEquals(Duration.ofMinutes(2), settings.callTimeout());
        assertEquals(Boolean.FALSE, settings.retryOnConnectionFailure());
    }

    private void clear(String... keys) {
        for (String key : keys) {
            System.clearProperty(key);
        }
    }
}
