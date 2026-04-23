package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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

        assertMissingFacility(() -> transport.currentSettings(null));
        assertMissingFacility(() -> transport.rawHttpClient(null));
        assertMissingFacility(() -> transport.buildOrcaUrl(null, "/api01rv2/systeminfv2"));
        assertMissingFacility(() -> transport.resolveBasicAuthHeader(null));
        assertMissingFacility(() -> transport.auditSummary(null));
        assertMissingFacility(() -> transport.reloadSettings(null));
        assertMissingFacility(() ->
                transport.invoke(null, OrcaEndpoint.SYSTEM_INFO, OrcaTransportRequest.post("<request/>")));
    }

    @Test
    void auditSummaryReflectsClientAuthTruthWithoutLeakingTargetMaterial() throws Exception {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        String rawBaseUrl = "https://facility.example.orca/secret-prefix";
        when(store.resolve(FACILITY_ID)).thenReturn(new OrcaConnectionConfigStore.ResolvedOrcaConnection(
                true,
                rawBaseUrl,
                null,
                null,
                true,
                null,
                null,
                null));

        RestOrcaTransport transport = new RestOrcaTransport();
        setField(transport, "orcaConnectionConfigStore", store);
        setField(transport, "configurationResolver", resolver());

        OrcaTransportSettings settings = transport.currentSettings(FACILITY_ID);
        String auditSummary = transport.auditSummary(FACILITY_ID);

        assertTrue(settings.isClientAuthConfigured());
        assertTrue(auditSummary.contains("clientAuthConfigured=true"));
        assertFalse(auditSummary.contains("facility.example.orca"));
        assertFalse(auditSummary.contains("secret-prefix"));
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

    private static void assertMissingFacility(Executable action) {
        OrcaConnectionPolicyException ex = assertThrows(OrcaConnectionPolicyException.class, action);
        assertEquals(OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING, ex.getErrorCategory());
    }

    @FunctionalInterface
    private interface Executable extends org.junit.jupiter.api.function.Executable {
    }
}
