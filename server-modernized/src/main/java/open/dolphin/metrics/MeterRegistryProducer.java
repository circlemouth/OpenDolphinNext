package open.dolphin.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Dependent;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * WildFly が提供する Micrometer MeterRegistry を CDI へ公開する。
 * JNDI 参照できない場合のみ global registry にフォールバックする。
 */
@ApplicationScoped
public class MeterRegistryProducer {

    private static final Logger LOGGER = LoggerFactory.getLogger(MeterRegistryProducer.class);
    private static final String DEFAULT_JNDI_NAME = "java:jboss/micrometer/registry";

    @Inject
    private ServerConfigurationResolver configurationResolver;

    MeterRegistryProducer(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    public MeterRegistryProducer() {
    }

    @Produces
    @Dependent
    public MeterRegistry produceMeterRegistry() {
        String jndiName = resolveJndiName();
        MeterRegistry registry = lookupRegistry(jndiName);
        if (registry != null) {
            return registry;
        }
        LOGGER.info("Micrometer registry not found under {}; falling back to global registry.", jndiName);
        return Metrics.globalRegistry;
    }

    private String resolveJndiName() {
        String configured = configurationResolver != null ? configurationResolver.metrics().registryJndi() : null;
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return DEFAULT_JNDI_NAME;
    }

    private MeterRegistry lookupRegistry(String jndiName) {
        try {
            InitialContext context = new InitialContext();
            Object lookedUp = context.lookup(jndiName);
            if (lookedUp instanceof MeterRegistry meterRegistry) {
                return meterRegistry;
            }
        } catch (NamingException ex) {
            LOGGER.debug("Micrometer registry lookup failed for {}: {}", jndiName, ex.getMessage());
        }
        return null;
    }
}
