package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class RestOrcaTransportTest {

    @Test
    void currentSettingsUsesAdminConfigAndReusesDefaultHttpClientWithinCacheTtl() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.resolve(null)).thenReturn(resolvedConnection(
                "https://default.example.orca",
                "default-user",
                "default-pass"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        OrcaTransportSettings first = transport.currentSettingsInstance();
        HttpClient firstClient = transport.rawHttpClient();

        OrcaTransportSettings second = transport.currentSettingsInstance();
        HttpClient secondClient = transport.rawHttpClient();

        assertEquals("https://default.example.orca/api/api01rv2/systeminfv2",
                transport.buildOrcaUrl("/api01rv2/systeminfv2"));
        assertEquals(basicAuthHeader("default-user", "default-pass"), transport.resolveBasicAuthHeader());
        assertSame(first, second);
        assertSame(firstClient, secondClient);
        verify(store, times(1)).resolve(null);
    }

    @Test
    void facilityScopedLookupUsesFacilitySpecificAdminConfig() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.resolve("F001")).thenReturn(resolvedConnection(
                "https://facility.example.orca",
                "facility-user",
                "facility-pass"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        OrcaTransportSettings settings = transport.currentSettingsInstance("F001");

        assertEquals("https://facility.example.orca/api/api01rv2/patientlst1v2",
                transport.buildOrcaUrl("F001", "/api01rv2/patientlst1v2"));
        assertEquals(basicAuthHeader("facility-user", "facility-pass"),
                transport.resolveBasicAuthHeader("F001"));
        assertEquals("https://facility.example.orca", settings.getBaseUrl());
        verify(store, times(1)).resolve("F001");
    }

    @Test
    void reloadSettingsReusesHttpClientWhenResolvedConfigUnchanged() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.resolve(null)).thenReturn(resolvedConnection(
                "https://same.example.orca",
                "same-user",
                "same-pass"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        transport.reloadSettings();
        HttpClient firstClient = transport.rawHttpClient();

        transport.reloadSettings();
        HttpClient secondClient = transport.rawHttpClient();

        assertSame(firstClient, secondClient);
        verify(store, times(2)).resolve(null);
    }

    @Test
    void reloadSettingsReplacesHttpClientWhenResolvedConfigChanges() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.resolve(null))
                .thenReturn(resolvedConnection("https://first.example.orca", "user-a", "pass-a"))
                .thenReturn(resolvedConnection("https://second.example.orca", "user-b", "pass-b"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        transport.reloadSettings();
        HttpClient firstClient = transport.rawHttpClient();

        transport.reloadSettings();
        HttpClient secondClient = transport.rawHttpClient();

        assertNotSame(firstClient, secondClient);
        assertEquals("https://second.example.orca/api/api01rv2/systeminfv2",
                transport.buildOrcaUrl("/api01rv2/systeminfv2"));
        assertEquals(basicAuthHeader("user-b", "pass-b"), transport.resolveBasicAuthHeader());
        verify(store, times(2)).resolve(null);
    }

    private static OrcaConnectionConfigStore.ResolvedOrcaConnection resolvedConnection(
            String baseUrl,
            String username,
            String password) {
        return new OrcaConnectionConfigStore.ResolvedOrcaConnection(
                true,
                baseUrl,
                username,
                password,
                false,
                null,
                null,
                null);
    }

    private static String basicAuthHeader(String username, String password) {
        String credentials = username + ":" + password;
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private static ServerConfigurationResolver resolver() {
        return TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS, "60000");
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
