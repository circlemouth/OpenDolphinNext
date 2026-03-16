package open.dolphin.runtime.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

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
                ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS);
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

    private void clear(String... keys) {
        for (String key : keys) {
            System.clearProperty(key);
        }
    }
}
