package open.dolphin.rest.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import open.dolphin.rest.AbstractResource;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.RuntimeStateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class AdminConfigStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(AdminConfigStore.class);
    private static final String STATE_CATEGORY = "admin_config";
    private static final String STATE_KEY = "default";

    private final ObjectMapper mapper = AbstractResource.getSerializeMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    @Inject
    private RuntimeStateRepository stateRepository;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    private AdminConfigSnapshot current;

    public AdminConfigStore() {
    }

    @PostConstruct
    public void init() {
        this.current = load();
        if (this.current == null) {
            this.current = defaultSnapshot();
        } else {
            this.current = applyDefaults(this.current);
        }
        persist(this.current);
    }

    public AdminConfigSnapshot getSnapshot() {
        lock.readLock().lock();
        try {
            return current.copy();
        } finally {
            lock.readLock().unlock();
        }
    }

    public AdminConfigSnapshot updateFromPayload(AdminConfigSnapshot incoming, String runId) {
        lock.writeLock().lock();
        try {
            AdminConfigSnapshot merged = current != null ? current.copy() : defaultSnapshot();
            if (incoming.getOrcaEndpoint() != null) merged.setOrcaEndpoint(incoming.getOrcaEndpoint());
            if (incoming.getVerifyAdminDelivery() != null) merged.setVerifyAdminDelivery(incoming.getVerifyAdminDelivery());
            if (incoming.getChartsDisplayEnabled() != null) merged.setChartsDisplayEnabled(incoming.getChartsDisplayEnabled());
            if (incoming.getChartsSendEnabled() != null) merged.setChartsSendEnabled(incoming.getChartsSendEnabled());
            if (incoming.getChartsMasterSource() != null) merged.setChartsMasterSource(incoming.getChartsMasterSource());
            if (incoming.getNote() != null) merged.setNote(incoming.getNote());
            if (incoming.getEnvironment() != null) merged.setEnvironment(incoming.getEnvironment());
            if (incoming.getDeliveryMode() != null) merged.setDeliveryMode(incoming.getDeliveryMode());

            merged = applyDefaults(merged);
            merged.setDeliveredAt(Instant.now().toString());
            if (merged.getDeliveryId() == null || merged.getDeliveryId().isBlank()) {
                merged.setDeliveryId(UUID.randomUUID().toString());
            }
            if (runId != null && !runId.isBlank()) {
                merged.setDeliveryVersion(runId);
                merged.setDeliveryEtag(runId);
            } else {
                String version = "v" + Instant.now().toEpochMilli();
                merged.setDeliveryVersion(version);
                merged.setDeliveryEtag(version);
            }
            merged.setSource("live");
            merged.setVerified(Boolean.TRUE.equals(merged.getVerifyAdminDelivery()));

            current = merged;
            persist(current);
            return current.copy();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private AdminConfigSnapshot load() {
        if (stateRepository == null) {
            LOGGER.warn("RuntimeStateRepository is unavailable. returning default admin config");
            return null;
        }
        return stateRepository.findPayload(STATE_CATEGORY, STATE_KEY)
                .map(json -> {
                    try {
                        return mapper.readValue(json, AdminConfigSnapshot.class);
                    } catch (IOException ex) {
                        LOGGER.warn("Failed to parse admin config payload from DB: {}", ex.getMessage());
                        return null;
                    }
                })
                .orElse(null);
    }

    private void persist(AdminConfigSnapshot snapshot) {
        if (snapshot == null || stateRepository == null) {
            return;
        }
        try {
            stateRepository.upsertPayload(STATE_CATEGORY, STATE_KEY, mapper.writeValueAsString(snapshot), Instant.now());
        } catch (IOException ex) {
            LOGGER.warn("Failed to serialize admin config for DB persistence: {}", ex.getMessage());
        } catch (RuntimeException ex) {
            LOGGER.warn("Failed to persist admin config in DB: {}", ex.getMessage());
        }
    }

    private AdminConfigSnapshot defaultSnapshot() {
        AdminConfigSnapshot snapshot = new AdminConfigSnapshot();
        snapshot.setOrcaEndpoint(resolveDefaultOrcaEndpoint());
        snapshot.setVerifyAdminDelivery(Boolean.FALSE);
        snapshot.setChartsDisplayEnabled(Boolean.TRUE);
        snapshot.setChartsSendEnabled(Boolean.TRUE);
        snapshot.setChartsMasterSource("auto");
        snapshot.setEnvironment(resolveEnvironment());
        snapshot.setDeliveryMode("manual");
        snapshot.setSource("live");
        snapshot.setVerified(Boolean.FALSE);
        return snapshot;
    }

    private AdminConfigSnapshot applyDefaults(AdminConfigSnapshot snapshot) {
        if (snapshot.getOrcaEndpoint() == null) snapshot.setOrcaEndpoint(resolveDefaultOrcaEndpoint());
        if (snapshot.getVerifyAdminDelivery() == null) snapshot.setVerifyAdminDelivery(Boolean.FALSE);
        if (snapshot.getChartsDisplayEnabled() == null) snapshot.setChartsDisplayEnabled(Boolean.TRUE);
        if (snapshot.getChartsSendEnabled() == null) snapshot.setChartsSendEnabled(Boolean.TRUE);
        if (snapshot.getChartsMasterSource() == null || snapshot.getChartsMasterSource().isBlank()) {
            snapshot.setChartsMasterSource("auto");
        }
        if (snapshot.getEnvironment() == null) snapshot.setEnvironment(resolveEnvironment());
        if (snapshot.getDeliveryMode() == null) snapshot.setDeliveryMode("manual");
        if (snapshot.getDeliveryId() == null || snapshot.getDeliveryId().isBlank()) {
            snapshot.setDeliveryId(UUID.randomUUID().toString());
        }
        if (snapshot.getDeliveredAt() == null || snapshot.getDeliveredAt().isBlank()) {
            snapshot.setDeliveredAt(Instant.now().toString());
        }
        if (snapshot.getDeliveryVersion() == null || snapshot.getDeliveryVersion().isBlank()) {
            snapshot.setDeliveryVersion("v" + Instant.now().toEpochMilli());
        }
        if (snapshot.getDeliveryEtag() == null || snapshot.getDeliveryEtag().isBlank()) {
            snapshot.setDeliveryEtag(snapshot.getDeliveryVersion());
        }
        if (snapshot.getSource() == null) snapshot.setSource("live");
        if (snapshot.getVerified() == null) {
            snapshot.setVerified(Boolean.TRUE.equals(snapshot.getVerifyAdminDelivery()));
        }
        return snapshot;
    }

    private String resolveDefaultOrcaEndpoint() {
        if (configurationResolver == null) {
            return null;
        }
        String scheme = configurationResolver.orcaApi().scheme();
        String host = configurationResolver.orcaApi().host();
        Integer port = configurationResolver.orcaApi().port();
        if (host == null || host.isBlank()) {
            return null;
        }
        String resolvedScheme = (scheme == null || scheme.isBlank()) ? "http" : scheme.trim();
        if (port == null) {
            return resolvedScheme + "://" + host.trim();
        }
        return resolvedScheme + "://" + host.trim() + ":" + port;
    }

    private String resolveEnvironment() {
        String value = configurationResolver != null ? configurationResolver.runtime().environment() : null;
        return value == null || value.isBlank() ? "dev" : value.trim();
    }
}
