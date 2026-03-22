package open.dolphin.mbean;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.StringReader;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.logging.Level;
import java.util.logging.Logger;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;
import jakarta.enterprise.concurrent.ManagedThreadFactory;
import jakarta.inject.Inject;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.session.PVTServiceBean;
import open.dolphin.worker.pvt.PvtSocketWorker;

/**
 * PVT socket listener bootstrap.
 *
 * Socket accept/read loop is delegated to {@link PvtSocketWorker};
 * this bean only resolves configuration and handles domain mapping.
 */
@Singleton
@Startup
public class PvtService {
    public static final String REASON_CODE_PVT_QUEUE_OVER_CAPACITY = "pvt_queue_over_capacity";
    public static final String REASON_CODE_PVT_WORKER_UNAVAILABLE = "pvt_worker_unavailable";

    private static final String UTF8 = "UTF-8";
    private static final int DEFAULT_ACCEPT_TIMEOUT_MILLIS = 1000;
    private static final int DEFAULT_READ_TIMEOUT_MILLIS = 30000;
    private static final int DEFAULT_MAX_CONNECTION_THREADS = 32;
    private static final int DEFAULT_CONNECTION_QUEUE_CAPACITY = 256;
    private static final int DEFAULT_HANDLE_RETRY_MAX = 3;
    private static final int DEFAULT_HANDLE_RETRY_BACKOFF_MILLIS = 200;
    private static final long DEFAULT_IDEMPOTENCY_WINDOW_MILLIS = 5 * 60 * 1000L;
    private static final int DEFAULT_POISON_QUEUE_CAPACITY = 200;

    @Resource(lookup = "java:jboss/ee/concurrency/factory/default")
    private ManagedThreadFactory threadFactory;

    @Inject
    PVTServiceBean pvtServiceBean;

    @Inject
    private MeterRegistry meterRegistry;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    private String encoding = UTF8;
    private String FACILITY_ID;
    private boolean DEBUG;
    private boolean workerEnabled;
    private int acceptTimeoutMillis = DEFAULT_ACCEPT_TIMEOUT_MILLIS;
    private int readTimeoutMillis = DEFAULT_READ_TIMEOUT_MILLIS;
    private int maxConnectionThreads = DEFAULT_MAX_CONNECTION_THREADS;
    private int connectionQueueCapacity = DEFAULT_CONNECTION_QUEUE_CAPACITY;
    private int handleRetryMax = DEFAULT_HANDLE_RETRY_MAX;
    private int handleRetryBackoffMillis = DEFAULT_HANDLE_RETRY_BACKOFF_MILLIS;
    private long idempotencyWindowMillis = DEFAULT_IDEMPOTENCY_WINDOW_MILLIS;
    private int poisonQueueCapacity = DEFAULT_POISON_QUEUE_CAPACITY;
    private PvtSocketWorker socketWorker;
    private boolean workerMetricsRegistered;

    @PostConstruct
    public void register() {
        Logger appLogger = Logger.getLogger("open.dolphin");
        DEBUG = Level.FINE.equals(appLogger.getLevel()) || appLogger.isLoggable(Level.FINE);

        try {
            startService();

        } catch (FileNotFoundException e) {
            // keep legacy behavior
        } catch (Exception e) {
            warn(e.getMessage());
        }
    }

    public void startService() throws FileNotFoundException, Exception {
        ServerRuntimeConfiguration.OrcaRuntimeSettings runtime = configurationResolver.orcaRuntime();
        ServerRuntimeConfiguration.PvtListenerSettings pvt = runtime.pvtListener();
        FACILITY_ID = runtime.facilityId();
        boolean useAsPVTServer = pvt.enabled();

        if (!useAsPVTServer) {
            workerEnabled = false;
            return;
        }
        workerEnabled = true;

        String bindIP = pvt.bindIp();
        Integer port = pvt.port();
        if (bindIP == null || bindIP.isBlank() || port == null) {
            throw new IllegalStateException("PVT listener is enabled but opendolphin.pvt.bind-ip/port is not configured.");
        }

        encoding = pvt.encoding() != null ? pvt.encoding() : UTF8;
        acceptTimeoutMillis = parsePositiveInt(stringValue(pvt.acceptTimeoutMillis()),
                DEFAULT_ACCEPT_TIMEOUT_MILLIS);
        readTimeoutMillis = parsePositiveInt(stringValue(pvt.readTimeoutMillis()),
                DEFAULT_READ_TIMEOUT_MILLIS);
        maxConnectionThreads = parsePositiveInt(stringValue(pvt.maxThreads()),
                DEFAULT_MAX_CONNECTION_THREADS);
        connectionQueueCapacity = parsePositiveInt(stringValue(pvt.queueCapacity()),
                DEFAULT_CONNECTION_QUEUE_CAPACITY);
        handleRetryMax = parsePositiveInt(stringValue(pvt.retryMax()),
                DEFAULT_HANDLE_RETRY_MAX);
        handleRetryBackoffMillis = parsePositiveInt(stringValue(pvt.retryBackoffMillis()),
                DEFAULT_HANDLE_RETRY_BACKOFF_MILLIS);
        idempotencyWindowMillis = parsePositiveLong(stringValue(pvt.idempotencyWindowMillis()),
                DEFAULT_IDEMPOTENCY_WINDOW_MILLIS);
        poisonQueueCapacity = parsePositiveInt(stringValue(pvt.poisonQueueCapacity()),
                DEFAULT_POISON_QUEUE_CAPACITY);

        InetAddress addr = InetAddress.getByName(bindIP);
        InetSocketAddress socketAddress = new InetSocketAddress(addr, port);

        socketWorker = new PvtSocketWorker(
                resolveThreadFactory(),
                socketAddress,
                encoding,
                acceptTimeoutMillis,
                readTimeoutMillis,
                maxConnectionThreads,
                connectionQueueCapacity,
                DEBUG,
                handleRetryMax,
                handleRetryBackoffMillis,
                idempotencyWindowMillis,
                poisonQueueCapacity,
                this::parseAndSend,
                this::log,
                this::warn,
                this::debug);
        socketWorker.start();
        registerWorkerMetrics();
    }

    @PreDestroy
    public void stopService() {
        log("PreDestroy did call");
        if (socketWorker != null) {
            socketWorker.stop();
            socketWorker = null;
        }
        workerEnabled = false;
    }

    public boolean isWorkerEnabled() {
        return workerEnabled;
    }

    public PvtSocketWorker.RuntimeSnapshot workerSnapshot() {
        if (socketWorker == null) {
            return PvtSocketWorker.RuntimeSnapshot.disabled();
        }
        return socketWorker.snapshotRuntime();
    }

    public Map<String, Object> workerThresholds() {
        Map<String, Object> thresholds = new LinkedHashMap<>();
        thresholds.put("staleSuccessSeconds", staleSuccessThresholdSeconds());
        thresholds.put("failureStreak", Math.max(2, handleRetryMax));
        thresholds.put("maxProcessingMillis", maxProcessingThresholdMillis());
        return thresholds;
    }

    public Map<String, Object> workerHealthBody() {
        PvtSocketWorker.RuntimeSnapshot snapshot = workerSnapshot();
        long nowMillis = System.currentTimeMillis();
        long staleThresholdSeconds = staleSuccessThresholdSeconds();
        long maxProcessingThresholdMillis = maxProcessingThresholdMillis();
        long secondsSinceLastSuccess = secondsSince(snapshot.lastSuccessEpochMillis(), nowMillis);

        List<String> reasonCodes = new java.util.ArrayList<>();
        String status = "UP";
        if (!workerEnabled) {
            status = "DISABLED";
        } else if (!snapshot.running()) {
            status = "DOWN";
            addReasonCode(reasonCodes, REASON_CODE_PVT_WORKER_UNAVAILABLE);
        } else {
            if (snapshot.lastSuccessEpochMillis() > 0L && secondsSinceLastSuccess > staleThresholdSeconds) {
                status = "DEGRADED";
                addReasonCode(reasonCodes, REASON_CODE_PVT_WORKER_UNAVAILABLE);
            }
            if (snapshot.consecutiveFailureCount() >= Math.max(2, snapshot.maxHandleAttempts())) {
                status = "DEGRADED";
                addReasonCode(reasonCodes, REASON_CODE_PVT_WORKER_UNAVAILABLE);
            }
            if (snapshot.processingCount() > 0 && snapshot.maxProcessingMillis() > maxProcessingThresholdMillis) {
                status = "DEGRADED";
                addReasonCode(reasonCodes, REASON_CODE_PVT_WORKER_UNAVAILABLE);
            }
            if (snapshot.poisonQueueSize() > 0) {
                status = "DEGRADED";
                addReasonCode(reasonCodes, REASON_CODE_PVT_QUEUE_OVER_CAPACITY);
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        body.put("checkedAt", formatInstant(nowMillis));
        body.put("workerEnabled", workerEnabled);
        body.put("running", snapshot.running());
        body.put("reasonCodes", reasonCodes);
        body.put("metrics", workerMetricsMap(snapshot, nowMillis));
        body.put("thresholds", workerThresholds());
        return body;
    }

    private void addReasonCode(List<String> reasonCodes, String code) {
        if (!reasonCodes.contains(code)) {
            reasonCodes.add(code);
        }
    }

    private void log(String msg) {
        Logger.getLogger("open.dolphin").info(msg);
    }

    private void warn(String msg) {
        Logger.getLogger("open.dolphin").warning(msg);
    }

    private void debug(String msg) {
        if (DEBUG) {
            Logger.getLogger("open.dolphin").fine(msg);
        }
    }

    private ThreadFactory resolveThreadFactory() {
        return threadFactory != null ? threadFactory : Executors.defaultThreadFactory();
    }

    private int parsePositiveInt(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(value.trim());
            return parsed > 0 ? parsed : defaultValue;
        } catch (NumberFormatException ex) {
            warn("Invalid integer value '" + value + "', fallback to " + defaultValue);
            return defaultValue;
        }
    }

    private long parsePositiveLong(String value, long defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            long parsed = Long.parseLong(value.trim());
            return parsed > 0L ? parsed : defaultValue;
        } catch (NumberFormatException ex) {
            warn("Invalid long value '" + value + "', fallback to " + defaultValue);
            return defaultValue;
        }
    }

    private int parseAndSend(String pvtXml) throws Exception {

        BufferedReader r = new BufferedReader(new StringReader(pvtXml));
        PVTBuilder builder = new PVTBuilder();
        builder.parse(r);
        PatientVisitModel model = builder.getProduct();

        if (model == null) {
            return -1;
        }

        model.setFacilityId(FACILITY_ID);
        model.getPatientModel().setFacilityId(FACILITY_ID);

        Collection<HealthInsuranceModel> c = model.getPatientModel().getHealthInsurances();
        if (c != null && c.size() > 0) {
            for (HealthInsuranceModel hm : c) {
                hm.setPatient(model.getPatientModel());
            }
        }

        return pvtServiceBean.addPvt(model);
    }

    private void registerWorkerMetrics() {
        if (meterRegistry == null || workerMetricsRegistered) {
            return;
        }
        workerMetricsRegistered = true;
        registerGauge("opendolphin_pvt_worker_running", snapshot -> snapshot.running() ? 1.0 : 0.0);
        registerGauge("opendolphin_pvt_worker_received_total", snapshot -> snapshot.receivedCount());
        registerGauge("opendolphin_pvt_worker_failed_total", snapshot -> snapshot.failedCount());
        registerGauge("opendolphin_pvt_worker_ack_total", snapshot -> snapshot.acknowledgedCount());
        registerGauge("opendolphin_pvt_worker_retry_attempt_total", snapshot -> snapshot.retryAttemptCount());
        registerGauge("opendolphin_pvt_worker_poison_total", snapshot -> snapshot.poisonTotalCount());
        registerGauge("opendolphin_pvt_worker_poison_queue_depth", snapshot -> snapshot.poisonQueueSize());
        registerGauge("opendolphin_pvt_worker_last_success_epoch_seconds",
                snapshot -> snapshot.lastSuccessEpochMillis() / 1000.0);
        registerGauge("opendolphin_pvt_worker_last_failure_epoch_seconds",
                snapshot -> snapshot.lastFailureEpochMillis() / 1000.0);
        registerGauge("opendolphin_pvt_worker_max_processing_millis",
                snapshot -> snapshot.maxProcessingMillis());
    }

    private void registerGauge(String name, java.util.function.ToDoubleFunction<PvtSocketWorker.RuntimeSnapshot> valueFunction) {
        if (meterRegistry.find(name).gauge() != null) {
            return;
        }
        Gauge.builder(name, this, service -> valueFunction.applyAsDouble(service.workerSnapshot()))
                .description("PVT worker runtime metric")
                .register(meterRegistry);
    }

    private Map<String, Object> workerMetricsMap(PvtSocketWorker.RuntimeSnapshot snapshot, long nowMillis) {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("receivedCount", snapshot.receivedCount());
        metrics.put("acknowledgedCount", snapshot.acknowledgedCount());
        metrics.put("failedCount", snapshot.failedCount());
        metrics.put("duplicateCount", snapshot.duplicateCount());
        metrics.put("retryAttemptCount", snapshot.retryAttemptCount());
        metrics.put("poisonTotalCount", snapshot.poisonTotalCount());
        metrics.put("poisonQueueSize", snapshot.poisonQueueSize());
        metrics.put("processingCount", snapshot.processingCount());
        metrics.put("consecutiveFailureCount", snapshot.consecutiveFailureCount());
        metrics.put("lastSuccessAt", formatInstant(snapshot.lastSuccessEpochMillis()));
        metrics.put("lastFailureAt", formatInstant(snapshot.lastFailureEpochMillis()));
        metrics.put("lastReceivedAt", formatInstant(snapshot.lastReceivedEpochMillis()));
        metrics.put("secondsSinceLastSuccess", secondsSince(snapshot.lastSuccessEpochMillis(), nowMillis));
        metrics.put("secondsSinceLastFailure", secondsSince(snapshot.lastFailureEpochMillis(), nowMillis));
        metrics.put("maxProcessingMillis", snapshot.maxProcessingMillis());
        metrics.put("totalProcessingMillis", snapshot.totalProcessingMillis());
        metrics.put("lastFailureReason", snapshot.lastFailureReason());
        return metrics;
    }

    private long staleSuccessThresholdSeconds() {
        Long configured = configurationResolver != null
                ? configurationResolver.pvtWorkerHealth().staleSuccessSeconds()
                : null;
        return configured != null && configured > 0L ? configured : 180L;
    }

    private long maxProcessingThresholdMillis() {
        Long configured = configurationResolver != null
                ? configurationResolver.pvtWorkerHealth().maxProcessingMillis()
                : null;
        return configured != null && configured > 0L ? configured : 30_000L;
    }

    private long secondsSince(long timestampMillis, long nowMillis) {
        if (timestampMillis <= 0L) {
            return -1L;
        }
        return Math.max(0L, (nowMillis - timestampMillis) / 1000L);
    }

    private String formatInstant(long epochMillis) {
        if (epochMillis <= 0L) {
            return null;
        }
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(Instant.ofEpochMilli(epochMillis).atOffset(ZoneOffset.UTC));
    }

    private static String stringValue(Object value) {
        return value != null ? String.valueOf(value) : null;
    }
}
