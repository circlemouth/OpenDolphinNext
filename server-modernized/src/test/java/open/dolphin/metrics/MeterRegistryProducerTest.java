package open.dolphin.metrics;

import static org.junit.jupiter.api.Assertions.assertSame;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import org.junit.jupiter.api.Test;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;

class MeterRegistryProducerTest {

    @Test
    void fallsBackToGlobalRegistryWhenJndiLookupFails() {
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_METRICS_REGISTRY_JNDI, "java:comp/env/does-not-exist");
        MeterRegistryProducer producer = new MeterRegistryProducer(resolver);
        MeterRegistry registry = producer.produceMeterRegistry();

        assertSame(Metrics.globalRegistry, registry);
    }
}
