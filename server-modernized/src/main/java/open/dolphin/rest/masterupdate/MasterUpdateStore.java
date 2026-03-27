package open.dolphin.rest.masterupdate;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Function;
import open.dolphin.rest.AbstractResource;
import open.dolphin.runtime.RuntimeStateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Persistence store for master update metadata and versions.
 */
@ApplicationScoped
public class MasterUpdateStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(MasterUpdateStore.class);
    private static final String STATE_CATEGORY = "master_update";
    private static final String STATE_KEY = "default";

    private final ObjectMapper mapper = AbstractResource.getSerializeMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    @Inject
    private RuntimeStateRepository stateRepository;

    private Snapshot current;

    public MasterUpdateStore() {
    }

    @PostConstruct
    public void init() {
        this.current = load();
        if (this.current == null) {
            this.current = defaultSnapshot();
            persist(this.current);
        } else {
            this.current = applyDefaults(this.current);
            persist(this.current);
        }
    }

    public Snapshot getSnapshot() {
        lock.readLock().lock();
        try {
            return deepCopy(current);
        } finally {
            lock.readLock().unlock();
        }
    }

    public <T> T update(Function<Snapshot, T> updater) {
        lock.writeLock().lock();
        try {
            T value = updater.apply(current);
            current.updatedAt = Instant.now().toString();
            persist(current);
            return value;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public static DatasetState findDataset(Snapshot snapshot, String datasetCode) {
        if (snapshot == null || snapshot.datasets == null || datasetCode == null) {
            return null;
        }
        return snapshot.datasets.get(datasetCode);
    }

    private Snapshot deepCopy(Snapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        return mapper.convertValue(snapshot, Snapshot.class);
    }

    private Snapshot load() {
        if (stateRepository == null) {
            LOGGER.warn("RuntimeStateRepository is unavailable. returning default master update snapshot");
            return null;
        }
        return stateRepository.findPayload(STATE_CATEGORY, STATE_KEY)
                .map(payload -> {
                    try {
                        return mapper.readValue(payload, Snapshot.class);
                    } catch (IOException ex) {
                        LOGGER.warn("Failed to parse master update payload from DB: {}", ex.getMessage());
                        return null;
                    }
                })
                .orElse(null);
    }

    private void persist(Snapshot snapshot) {
        if (snapshot == null || stateRepository == null) {
            return;
        }
        try {
            stateRepository.upsertPayload(STATE_CATEGORY, STATE_KEY, mapper.writeValueAsString(snapshot), Instant.now());
        } catch (IOException ex) {
            LOGGER.warn("Failed to serialize master update state for DB persistence: {}", ex.getMessage());
        } catch (RuntimeException ex) {
            LOGGER.warn("Failed to persist master update state in DB: {}", ex.getMessage());
        }
    }

    private Snapshot defaultSnapshot() {
        Snapshot snapshot = new Snapshot();
        snapshot.datasets = new LinkedHashMap<>();
        for (MasterUpdateCatalog.DatasetDefinition definition : MasterUpdateCatalog.defaultDefinitions()) {
            snapshot.datasets.put(definition.getCode(), toDatasetState(definition));
        }
        snapshot.schedule = ScheduleConfig.defaults();
        snapshot.updatedAt = Instant.now().toString();
        return snapshot;
    }

    private Snapshot applyDefaults(Snapshot snapshot) {
        if (snapshot.datasets == null) {
            snapshot.datasets = new LinkedHashMap<>();
        }
        for (MasterUpdateCatalog.DatasetDefinition definition : MasterUpdateCatalog.defaultDefinitions()) {
            DatasetState currentState = snapshot.datasets.get(definition.getCode());
            if (currentState == null) {
                snapshot.datasets.put(definition.getCode(), toDatasetState(definition));
                continue;
            }
            currentState.code = definition.getCode();
            currentState.name = defaultString(currentState.name, definition.getName());
            currentState.sourceUrl = defaultString(currentState.sourceUrl, definition.getSourceUrl());
            currentState.updateFrequency = defaultString(currentState.updateFrequency, definition.getUpdateFrequency());
            currentState.format = defaultString(currentState.format, definition.getFormat());
            currentState.usageNotes = defaultString(currentState.usageNotes, definition.getUsageNotes());
            currentState.status = defaultString(currentState.status, "idle");
            if (currentState.versions == null) {
                currentState.versions = new ArrayList<>();
            }
            if (currentState.defaultIntervalMinutes <= 0) {
                currentState.defaultIntervalMinutes = definition.getDefaultIntervalMinutes();
            }
        }
        if (snapshot.schedule == null) {
            snapshot.schedule = ScheduleConfig.defaults();
        } else {
            snapshot.schedule = ScheduleConfig.applyDefaults(snapshot.schedule);
        }
        snapshot.updatedAt = defaultString(snapshot.updatedAt, Instant.now().toString());
        return snapshot;
    }

    private static String defaultString(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static DatasetState toDatasetState(MasterUpdateCatalog.DatasetDefinition definition) {
        DatasetState state = new DatasetState();
        state.code = definition.getCode();
        state.name = definition.getName();
        state.sourceUrl = definition.getSourceUrl();
        state.updateFrequency = definition.getUpdateFrequency();
        state.format = definition.getFormat();
        state.usageNotes = definition.getUsageNotes();
        state.active = true;
        state.autoEnabled = definition.isAutoEnabled();
        state.manualUploadAllowed = definition.isManualUploadAllowed();
        state.defaultIntervalMinutes = definition.getDefaultIntervalMinutes();
        state.status = "idle";
        state.versions = new ArrayList<>();
        return state;
    }

    public static final class Snapshot {
        public Map<String, DatasetState> datasets = new LinkedHashMap<>();
        public ScheduleConfig schedule = ScheduleConfig.defaults();
        public String updatedAt;
    }

    public static final class DatasetState {
        public String code;
        public String name;
        public String sourceUrl;
        public String updateFrequency;
        public String format;
        public String usageNotes;
        public boolean active = true;
        public boolean autoEnabled = true;
        public boolean manualUploadAllowed = true;
        public int defaultIntervalMinutes = 1440;
        public String status = "idle";
        public String lastCheckedAt;
        public String lastSuccessfulAt;
        public String lastFailureAt;
        public String lastFailureReason;
        public String latestRunId;
        public String latestJobMessage;
        public String currentVersionId;
        public long currentRecordCount;
        public boolean updateDetected;
        public String lastAutoRunAt;
        public String lastPolledAt;
        public String lockJobId;
        public List<DatasetVersion> versions = new ArrayList<>();

        public DatasetVersion currentVersion() {
            if (versions == null || versions.isEmpty()) {
                return null;
            }
            if (currentVersionId != null && !currentVersionId.isBlank()) {
                for (DatasetVersion version : versions) {
                    if (Objects.equals(currentVersionId, version.versionId)) {
                        return version;
                    }
                }
            }
            for (DatasetVersion version : versions) {
                if (version.current) {
                    return version;
                }
            }
            return versions.get(0);
        }
    }

    public static final class DatasetVersion {
        public String versionId;
        public String capturedAt;
        public String status;
        public String hash;
        public long recordCount;
        public String artifactPath;
        public String sourceUrl;
        public String summary;
        public String triggerType;
        public String requestedBy;
        public String runId;
        public long addedCount;
        public long removedCount;
        public long changedCount;
        public String note;
        public boolean current;
    }

    public static final class ScheduleConfig {
        public String autoUpdateTime;
        public int retryCount;
        public int timeoutSeconds;
        public int maxConcurrency;
        public int orcaPollIntervalMinutes;
        public Map<String, Boolean> datasetAutoEnabledOverrides = new LinkedHashMap<>();

        public static ScheduleConfig defaults() {
            ScheduleConfig config = new ScheduleConfig();
            config.autoUpdateTime = "03:00";
            config.retryCount = 2;
            config.timeoutSeconds = 300;
            config.maxConcurrency = 2;
            config.orcaPollIntervalMinutes = 15;
            config.datasetAutoEnabledOverrides = new LinkedHashMap<>();
            return config;
        }

        public static ScheduleConfig applyDefaults(ScheduleConfig source) {
            ScheduleConfig config = source != null ? source : defaults();
            if (config.autoUpdateTime == null || config.autoUpdateTime.isBlank()) {
                config.autoUpdateTime = "03:00";
            }
            if (config.retryCount < 0) {
                config.retryCount = 0;
            }
            if (config.timeoutSeconds <= 0) {
                config.timeoutSeconds = 300;
            }
            if (config.maxConcurrency <= 0) {
                config.maxConcurrency = 2;
            }
            if (config.orcaPollIntervalMinutes <= 0) {
                config.orcaPollIntervalMinutes = 15;
            }
            if (config.datasetAutoEnabledOverrides == null) {
                config.datasetAutoEnabledOverrides = new LinkedHashMap<>();
            }
            return config;
        }
    }
}
