package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class OrcaTransportRegistryTest {

    @Test
    void currentTransportFailsClosedWhenFacilityIsMissingOrDefault() {
        OrcaTransportRegistry registry = new OrcaTransportRegistry(
                Mockito.mock(OrcaConnectionConfigStore.class),
                60_000L,
                resolver());

        assertMissingFacility(() -> registry.currentTransport(null));
        assertMissingFacility(() -> registry.currentTransport(""));
        assertMissingFacility(() -> registry.currentTransport("default"));
        assertMissingFacility(() -> registry.currentTransport("DeFaUlT"));
        assertMissingFacility(() -> registry.reloadSettings(null));
    }

    @Test
    void currentTransportUsesExplicitFacilityKeyWithoutDefaultFallback() {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.resolve("F001")).thenReturn(new OrcaConnectionConfigStore.ResolvedOrcaConnection(
                true,
                "https://facility.example.orca",
                "user",
                "pass",
                false,
                null,
                null,
                null));

        OrcaTransportRegistry registry = new OrcaTransportRegistry(store, 60_000L, resolver());

        assertNotNull(registry.currentTransport("F001"));
    }

    @Test
    void currentSettingsReflectsClientAuthTruthFromResolvedAdminConfig() {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.resolve("F001")).thenReturn(new OrcaConnectionConfigStore.ResolvedOrcaConnection(
                true,
                "https://facility.example.orca/secret-prefix",
                "user",
                "pass",
                true,
                null,
                null,
                null));

        OrcaTransportRegistry registry = new OrcaTransportRegistry(store, 60_000L, resolver());

        OrcaTransportSettings settings = registry.currentSettings("F001");
        assertNotNull(settings);
        assertTrue(settings.isClientAuthConfigured());
    }

    @Test
    void currentSettingsFailsClosedWhenStoreIsMissingEvenIfRuntimeConfigExists() {
        OrcaTransportRegistry registry = new OrcaTransportRegistry(
                null,
                60_000L,
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://runtime.example.orca",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "runtime-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "runtime-pass"));

        OrcaConnectionPolicyException ex = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> registry.currentSettings("F001"));
        assertEquals(OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING, ex.getErrorCategory());
    }

    @Test
    void currentSettingsFailsClosedWhenFacilityConfigIsMissing() {
        OrcaConnectionConfigStore store = Mockito.mock(OrcaConnectionConfigStore.class);
        when(store.resolve("F001")).thenThrow(new OrcaConnectionPolicyException(
                OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING,
                "ORCA facility configuration is not available"));

        OrcaTransportRegistry registry = new OrcaTransportRegistry(
                store,
                60_000L,
                TestServerConfigurationResolvers.resolver(
                        ServerConfigurationResolver.KEY_ORCA_API_BASE_URL, "https://runtime.example.orca",
                        ServerConfigurationResolver.KEY_ORCA_API_USER, "runtime-user",
                        ServerConfigurationResolver.KEY_ORCA_API_PASSWORD, "runtime-pass"));

        OrcaConnectionPolicyException ex = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> registry.currentSettings("F001"));
        assertEquals(OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING, ex.getErrorCategory());
    }

    private static ServerConfigurationResolver resolver() {
        return TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS, "60000");
    }

    private static void assertMissingFacility(Executable action) {
        OrcaConnectionPolicyException ex = assertThrows(OrcaConnectionPolicyException.class, action);
        assertEquals(OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING, ex.getErrorCategory());
    }

    @FunctionalInterface
    private interface Executable extends org.junit.jupiter.api.function.Executable {
    }
}
