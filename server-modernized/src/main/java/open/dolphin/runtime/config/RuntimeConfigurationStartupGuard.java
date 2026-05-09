package open.dolphin.runtime.config;

import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;
import jakarta.ejb.TransactionAttribute;
import jakarta.ejb.TransactionAttributeType;
import jakarta.inject.Inject;

/**
 * Eager runtime configuration guard. This keeps missing required runtime
 * settings from becoming only a later readiness failure.
 */
@Singleton
@Startup
@TransactionAttribute(TransactionAttributeType.NOT_SUPPORTED)
public class RuntimeConfigurationStartupGuard {

    @Inject
    ServerConfigurationValidator configurationValidator;

    @PostConstruct
    public void validate() {
        configurationValidator.validateOrThrow();
    }
}
