package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class RestOrcaTransportTest {

    private static final String FACILITY_ID = "F001";

    @Test
    void currentSettingsUsesExplicitFacilityAndReusesHttpClientWithinCacheTtl() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.listConfiguredFacilityIds()).thenReturn(List.of(FACILITY_ID));
        when(store.resolve(FACILITY_ID)).thenReturn(resolvedConnection(
                "https://default.example.orca",
                "default-user",
                "default-pass"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        OrcaTransportSettings first = transport.currentSettings(FACILITY_ID);
        HttpClient firstClient = transport.rawHttpClient(FACILITY_ID);

        OrcaTransportSettings second = transport.currentSettings(FACILITY_ID);
        HttpClient secondClient = transport.rawHttpClient(FACILITY_ID);

        assertEquals("https://default.example.orca/api/api01rv2/systeminfv2",
                transport.buildOrcaUrl(FACILITY_ID, "/api01rv2/systeminfv2"));
        assertEquals(basicAuthHeader("default-user", "default-pass"), transport.resolveBasicAuthHeader(FACILITY_ID));
        assertSame(first, second);
        assertSame(firstClient, secondClient);
        verify(store, times(1)).resolve(FACILITY_ID);
    }

    @Test
    void facilityScopedLookupUsesFacilitySpecificAdminConfig() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.listConfiguredFacilityIds()).thenReturn(List.of(FACILITY_ID));
        when(store.resolve(FACILITY_ID)).thenReturn(resolvedConnection(
                "https://facility.example.orca",
                "facility-user",
                "facility-pass"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        OrcaTransportSettings settings = transport.currentSettings(FACILITY_ID);

        assertEquals("https://facility.example.orca/api/api01rv2/patientlst1v2",
                transport.buildOrcaUrl(FACILITY_ID, "/api01rv2/patientlst1v2"));
        assertEquals(basicAuthHeader("facility-user", "facility-pass"),
                transport.resolveBasicAuthHeader(FACILITY_ID));
        assertEquals("https://facility.example.orca", settings.getBaseUrl());
        verify(store, times(1)).resolve(FACILITY_ID);
    }

    @Test
    void reloadSettingsReusesHttpClientWhenResolvedConfigUnchanged() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.listConfiguredFacilityIds()).thenReturn(List.of(FACILITY_ID));
        when(store.resolve(FACILITY_ID)).thenReturn(resolvedConnection(
                "https://same.example.orca",
                "same-user",
                "same-pass"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        transport.reloadSettings(FACILITY_ID);
        HttpClient firstClient = transport.rawHttpClient(FACILITY_ID);

        transport.reloadSettings(FACILITY_ID);
        HttpClient secondClient = transport.rawHttpClient(FACILITY_ID);

        assertSame(firstClient, secondClient);
        verify(store, times(2)).resolve(FACILITY_ID);
    }

    @Test
    void reloadSettingsReplacesHttpClientWhenResolvedConfigChanges() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.listConfiguredFacilityIds()).thenReturn(List.of(FACILITY_ID));
        when(store.resolve(FACILITY_ID))
                .thenReturn(resolvedConnection("https://first.example.orca", "user-a", "pass-a"))
                .thenReturn(resolvedConnection("https://second.example.orca", "user-b", "pass-b"));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        transport.reloadSettings(FACILITY_ID);
        HttpClient firstClient = transport.rawHttpClient(FACILITY_ID);

        transport.reloadSettings(FACILITY_ID);
        HttpClient secondClient = transport.rawHttpClient(FACILITY_ID);

        assertNotSame(firstClient, secondClient);
        assertEquals("https://second.example.orca/api/api01rv2/systeminfv2",
                transport.buildOrcaUrl(FACILITY_ID, "/api01rv2/systeminfv2"));
        assertEquals(basicAuthHeader("user-b", "pass-b"), transport.resolveBasicAuthHeader(FACILITY_ID));
        verify(store, times(2)).resolve(FACILITY_ID);
    }

    @Test
    void missingFacilityFailsFastForExplicitAccessorsAndInvoke() throws Exception {
        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", Mockito.mock(OrcaConnectionConfigStore.class));
        setField(transport, "configurationResolver", resolver());

        assertThrows(IllegalStateException.class, () -> transport.currentSettings(null));
        assertThrows(IllegalStateException.class, () -> transport.rawHttpClient(null));
        assertThrows(IllegalStateException.class, () -> transport.buildOrcaUrl(null, "/api01rv2/systeminfv2"));
        assertThrows(IllegalStateException.class, () -> transport.resolveBasicAuthHeader(null));
        assertThrows(IllegalStateException.class, () -> transport.auditSummary(null));
        assertThrows(IllegalStateException.class, () -> transport.reloadSettings(null));
        assertThrows(IllegalStateException.class, () ->
                transport.invoke(null, OrcaEndpoint.SYSTEM_INFO, OrcaTransportRequest.post("<request/>")));
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
