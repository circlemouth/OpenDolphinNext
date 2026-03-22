package open.dolphin.orca.push;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

@ApplicationScoped
public class OrcaPushClientRegistry {

    @Inject
    ServerConfigurationResolver configurationResolver;

    @Inject
    OrcaConnectionConfigStore connectionConfigStore;

    @Inject
    OrcaPushSocketFactory socketFactory;

    @Inject
    OrcaPushEventRouter router;

    @Inject
    OrcaPushStateStore stateStore;

    @Inject
    OrcaPushRecoveryService recoveryService;

    @Inject
    open.dolphin.metrics.OrcaPushMetricsRegistrar metricsRegistrar;

    private final Map<String, OrcaPushClient> clients = new ConcurrentHashMap<>();
    private final Map<String, String> fingerprints = new ConcurrentHashMap<>();
    private ScheduledExecutorService scheduler;

    @PostConstruct
    void initialize() {
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread thread = new Thread(r, "orca-push-registry");
            thread.setDaemon(true);
            return thread;
        });
    }

    public void start() {
        if (!settings().enabled()) {
            return;
        }
        refreshNow();
        scheduler.scheduleAtFixedRate(this::refreshNow, 60L, 60L, TimeUnit.SECONDS);
    }

    public void refreshNow() {
        if (!settings().enabled()) {
            closeAll();
            return;
        }
        Map<String, String> nextFingerprints = new LinkedHashMap<>();
        for (String facilityId : connectionConfigStore.listConfiguredFacilityIds()) {
            OrcaConnectionConfigStore.ResolvedOrcaConnection resolved;
            try {
                resolved = connectionConfigStore.resolve(facilityId);
            } catch (RuntimeException ex) {
                continue;
            }
            if (resolved.pushUrl() == null || resolved.pushUrl().isBlank()) {
                continue;
            }
            String fingerprint = fingerprint(resolved);
            nextFingerprints.put(facilityId, fingerprint);
            if (!Objects.equals(fingerprint, fingerprints.get(facilityId))) {
                replaceClient(facilityId, resolved, fingerprint);
            }
        }
        for (String facilityId : java.util.Set.copyOf(clients.keySet())) {
            if (!nextFingerprints.containsKey(facilityId)) {
                OrcaPushClient client = clients.remove(facilityId);
                fingerprints.remove(facilityId);
                if (client != null) {
                    client.close();
                }
            }
        }
    }

    public boolean isConnected() {
        return !stateStore.listStates().isEmpty() && stateStore.listStates().stream()
                .allMatch(state -> OrcaPushStateStore.STATUS_CONNECTED.equals(state.connectionStatus()));
    }

    public int facilityCount() {
        return stateStore.listStates().size();
    }

    @PreDestroy
    public void closeAll() {
        for (OrcaPushClient client : clients.values()) {
            client.close();
        }
        clients.clear();
        fingerprints.clear();
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
    }

    private void replaceClient(String facilityId, OrcaConnectionConfigStore.ResolvedOrcaConnection resolved, String fingerprint) {
        OrcaPushClient existing = clients.remove(facilityId);
        if (existing != null) {
            existing.close();
        }
        OrcaPushClient client = new OrcaPushClient(
                facilityId,
                resolved,
                settings(),
                socketFactory,
                router,
                stateStore,
                recoveryService,
                metricsRegistrar);
        clients.put(facilityId, client);
        fingerprints.put(facilityId, fingerprint);
        client.start();
    }

    private ServerRuntimeConfiguration.OrcaPushSettings settings() {
        return configurationResolver != null ? configurationResolver.orcaPush() : new ServerConfigurationResolver().orcaPush();
    }

    private String fingerprint(OrcaConnectionConfigStore.ResolvedOrcaConnection resolved) {
        return resolved.pushUrl()
                + "|" + resolved.pushTenantId()
                + "|" + resolved.baseUrl()
                + "|" + java.util.Arrays.hashCode(resolved.clientCertificateP12())
                + "|" + java.util.Arrays.hashCode(resolved.caCertificate());
    }
}
