package open.dolphin.orca.push;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.runtime.config.ServerConfigurationResolver;

@ApplicationScoped
public class OrcaPushLifecycleService {

    @Inject
    ServerConfigurationResolver configurationResolver;

    @Inject
    OrcaPushClientRegistry registry;

    @Inject
    OrcaPushRecoveryService recoveryService;

    @Inject
    OrcaConnectionConfigStore connectionConfigStore;

    @PostConstruct
    void initialize() {
        if (configurationResolver == null || !configurationResolver.orcaPush().enabled()) {
            return;
        }
        registry.start();
        for (String facilityId : connectionConfigStore.listConfiguredFacilityIds()) {
            OrcaConnectionConfigStore.ResolvedOrcaConnection resolved = connectionConfigStore.resolve(facilityId);
            if (resolved.pushUrl() != null && !resolved.pushUrl().isBlank()) {
                recoveryService.recoverStartup(facilityId, resolved.pushUrl());
            }
        }
    }

    @PreDestroy
    void shutdown() {
        if (registry != null) {
            registry.closeAll();
        }
    }
}
