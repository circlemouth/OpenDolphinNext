package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

        assertThrows(IllegalStateException.class, () -> registry.currentTransport(null));
        assertThrows(IllegalStateException.class, () -> registry.currentTransport(""));
        assertThrows(IllegalStateException.class, () -> registry.currentTransport("default"));
        assertThrows(IllegalStateException.class, () -> registry.reloadSettings(null));
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

    private static ServerConfigurationResolver resolver() {
        return TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_TRANSPORT_CACHE_TTL_MS, "60000");
    }
}
