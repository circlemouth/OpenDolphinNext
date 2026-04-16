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
            if (incoming.getChartsDisplayEnabled() != null) merged.setChartsDisplayEnabled(incoming.getChartsDisplayEnabled());
            if (incoming.getChartsSendEnabled() != null) merged.setChartsSendEnabled(incoming.getChartsSendEnabled());
            if (incoming.getChartsMasterSource() != null) merged.setChartsMasterSource(incoming.getChartsMasterSource());

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
        snapshot.setChartsDisplayEnabled(Boolean.TRUE);
        snapshot.setChartsSendEnabled(Boolean.TRUE);
        snapshot.setChartsMasterSource("auto");
        snapshot.setSource("live");
        return snapshot;
    }

    private AdminConfigSnapshot applyDefaults(AdminConfigSnapshot snapshot) {
        if (snapshot.getChartsDisplayEnabled() == null) snapshot.setChartsDisplayEnabled(Boolean.TRUE);
        if (snapshot.getChartsSendEnabled() == null) snapshot.setChartsSendEnabled(Boolean.TRUE);
        if (snapshot.getChartsMasterSource() == null || snapshot.getChartsMasterSource().isBlank()) {
            snapshot.setChartsMasterSource("auto");
        }
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
        return snapshot;
    }
}
