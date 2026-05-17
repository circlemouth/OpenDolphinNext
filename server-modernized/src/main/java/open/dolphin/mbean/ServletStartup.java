package open.dolphin.mbean;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infrastructure.concurrent.ConcurrencyResourceNames;
import open.dolphin.orca.transport.OrcaTransportSettings;
import open.dolphin.orca.sync.OrcaPatientSyncScheduler;
import open.dolphin.security.integrity.DocumentIntegrityConfig;
import open.dolphin.session.ChartEventServiceBean;
import open.dolphin.session.SystemServiceBean;
import open.dolphin.rest.masterupdate.MasterUpdateScheduler;
import open.dolphin.runtime.config.ServerConfigurationValidator;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.StoragePersistenceContractValidator;
import open.dolphin.runtime.RuntimeConfigurationSupport;

/**
 * サーバー起動時の初期化と定期ジョブの実行を Jakarta Concurrency へ移行したライフサイクル管理コンポーネント。
 */
@ApplicationScoped
public class ServletStartup {

    private static final Logger LOGGER = Logger.getLogger(ServletStartup.class.getSimpleName());
    private static final Logger DOLPHIN_LOGGER = Logger.getLogger("open.dolphin");
    private static final ZoneId DEFAULT_ZONE = defaultZone();
    static final String ORCA_MASTER_BASIC_USER_KEY = "ORCA_MASTER_BASIC_USER";
    static final String ORCA_MASTER_BASIC_PASSWORD_KEY = "ORCA_MASTER_BASIC_PASSWORD";

    @Resource(lookup = ConcurrencyResourceNames.DEFAULT_SCHEDULER)
    private ManagedScheduledExecutorService scheduler;

    @Inject
    private ChartEventServiceBean eventServiceBean;

    @Inject
    private ServletContextHolder contextHolder;

    @Inject
    private SystemServiceBean systemServiceBean;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    @Inject
    private ServerConfigurationValidator configurationValidator;

    @Inject
    private StoragePersistenceContractValidator storagePersistenceContractValidator;

    private ScheduledFuture<?> midnightRefreshTask;
    private ScheduledFuture<?> monthlyActivityTask;

    @PostConstruct
    public void init() {
        contextHolder.ensureDateInitialized();
        eventServiceBean.ensureInitialized();
        configurationValidator.validateOrThrow();
        storagePersistenceContractValidator.validateOrThrow();
        enforceStartupSecurityGuards();
        logRuntimeConfigurationSummary();
        if (scheduler == null) {
            LOGGER.warning("ManagedScheduledExecutorService is not available. Timed jobs will not be executed.");
            return;
        }
        scheduleMidnightRefresh();
        scheduleMonthlyActivityReport();
    }

    @PreDestroy
    public void stop() {
        cancelTask(midnightRefreshTask);
        cancelTask(monthlyActivityTask);
    }

    private void scheduleMidnightRefresh() {
        Duration delay = Duration.between(Instant.now(), nextMidnight());
        if (delay.isNegative()) {
            delay = delay.plusDays(1);
        }
        midnightRefreshTask = scheduler.scheduleAtFixedRate(this::renewPatientVisitListSafely,
                delay.toMillis(), Duration.ofDays(1).toMillis(), TimeUnit.MILLISECONDS);
    }

    private void renewPatientVisitListSafely() {
        try {
            DOLPHIN_LOGGER.info("Renew pvtlist.");
            eventServiceBean.renewPvtList();
        } catch (Exception ex) {
            LOGGER.log(Level.SEVERE, "Failed to renew patient visit list", ex);
        }
    }

    private void scheduleMonthlyActivityReport() {
        scheduleNextMonthlyReport();
    }

    private void scheduleNextMonthlyReport() {
        Duration delay = Duration.between(Instant.now(), nextMonthlyExecution());
        if (delay.isNegative()) {
            delay = Duration.ZERO;
        }
        monthlyActivityTask = scheduler.schedule(() -> {
            runMonthlyActivityReportSafely();
            scheduleNextMonthlyReport();
        }, delay.toMillis(), TimeUnit.MILLISECONDS);
    }

    private void runMonthlyActivityReportSafely() {
        try {
            if (configurationResolver.orcaRuntime().cloudZero()) {
                ZonedDateTime targetMonth = ZonedDateTime.now(DEFAULT_ZONE).minusMonths(1);
                int year = targetMonth.getYear();
                // Legacy SystemServiceBean expects Calendar-style month index (0-11).
                int month = targetMonth.getMonthValue() - 1;
                DOLPHIN_LOGGER.info("Send monthly Activities.");
                systemServiceBean.sendMonthlyActivities(year, month);
            }
        } catch (Exception ex) {
            LOGGER.log(Level.SEVERE, "Failed to send monthly activity report", ex);
        }
    }

    private void cancelTask(ScheduledFuture<?> future) {
        if (future != null) {
            future.cancel(true);
        }
    }

    private Instant nextMidnight() {
        ZonedDateTime now = ZonedDateTime.now(DEFAULT_ZONE);
        ZonedDateTime next = now.plusDays(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        return next.toInstant();
    }

    private Instant nextMonthlyExecution() {
        ZonedDateTime now = ZonedDateTime.now(DEFAULT_ZONE);
        ZonedDateTime next = now.withDayOfMonth(1).withHour(5).withMinute(0).withSecond(0).withNano(0);
        if (!now.isBefore(next)) {
            next = next.plusMonths(1).withDayOfMonth(1);
        }
        return next.toInstant();
    }

    private void logRuntimeConfigurationSummary() {
        var runtime = configurationResolver.runtime();
        String environment = runtime.environment();
        boolean orcaPatientSyncEnabled = OrcaPatientSyncScheduler.resolveEnabledFromEnvironment();
        boolean masterUpdateSchedulerEnabled = configurationResolver.masterUpdateScheduler().enabled();
        String dataDir = runtime.serverDataDirectory();
        if (dataDir == null || dataDir.isBlank()) {
            dataDir = "MISSING(" + ServerConfigurationResolver.KEY_SERVER_DATA_DIR + ")";
        }
        String configStorePath = dataDir.startsWith("MISSING(")
                ? dataDir
                : Path.of(dataDir, "opendolphin").toString();
        LOGGER.info(() -> "Runtime config summary: environment=" + safe(environment)
                + ", timezone=" + DEFAULT_ZONE.getId()
                + ", schedulers={orcaPatientSync:" + (orcaPatientSyncEnabled ? "on" : "off")
                + ",masterUpdate:" + (masterUpdateSchedulerEnabled ? "on" : "off") + "}"
                + ", configStorePath=" + configStorePath);
    }

    static void enforceStartupSecurityGuards() {
        ServerConfigurationResolver resolver = new ServerConfigurationResolver();
        String environment = resolver.runtime().environment();
        if (!RuntimeConfigurationSupport.isProductionLikeEnvironment(environment)) {
            return;
        }
        failIfConfigured(ORCA_MASTER_BASIC_USER_KEY,
                "ORCA master legacy credential is configured in a production-like environment. Remove the leaked value before startup.");
        failIfConfigured(ORCA_MASTER_BASIC_PASSWORD_KEY,
                "ORCA master legacy credential is configured in a production-like environment. Remove the leaked value before startup.");
        failIfEnabled(ServerConfigurationResolver.KEY_ORCA_PUSH_ENABLED, resolver.orcaPush().enabled());
        failIfEnabled(ServerConfigurationResolver.KEY_ORCA_PUSH_SHADOW_MODE, resolver.orcaPush().shadowMode());
        failIfEnabled(ServerConfigurationResolver.KEY_ORCA_PUSH_RECOVERY_ENABLED, resolver.orcaPush().recoveryEnabled());
        failIfEnabled(ServerConfigurationResolver.KEY_ORCA_PATIENT_SYNC_ENABLED, resolver.orcaPatientSync().enabled());
        requireConfigured(resolver, ServerConfigurationResolver.KEY_SECURITY_TRUSTED_PROXIES);
        requireConfigured(resolver, ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64);
        requireEnforcedDocumentIntegrity(resolver);
        requireS3AttachmentStorage(resolver);
        // AdminAccessPasswordResetResource remains unregistered until truthful session revoke is implemented.
        OrcaTransportSettings.load();
    }

    private static void failIfConfigured(String key, String message) {
        if (RuntimeConfigurationSupport.firstNonBlank(resolveSetting(key)) != null) {
            throw new IllegalStateException(message + " key=" + key);
        }
    }

    private static void failIfEnabled(String key, boolean enabled) {
        if (enabled) {
            throw new IllegalStateException("production-like startup rejected: " + key + " must be false key=" + key);
        }
    }

    private static void requireConfigured(ServerConfigurationResolver resolver, String key) {
        if (resolver.raw(key) == null) {
            throw new IllegalStateException("production-like startup rejected: " + key + " is required key=" + key);
        }
    }

    private static void requireEnforcedDocumentIntegrity(ServerConfigurationResolver resolver) {
        String rawMode = resolver.raw(ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE);
        if (rawMode == null) {
            throw new IllegalStateException("production-like startup rejected: "
                    + ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE
                    + " must be enforce key=" + ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE);
        }
        String normalizedMode = rawMode.trim().toLowerCase();
        if (!"enforce".equals(normalizedMode)) {
            throw new IllegalStateException("production-like startup rejected: "
                    + ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE
                    + " must be enforce key=" + ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE);
        }
        DocumentIntegrityConfig.validateKeyring(DocumentIntegrityConfig.requireAbsolutePath(
                resolver.documentIntegrity().keyringPath(),
                ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH));
    }

    private static void requireS3AttachmentStorage(ServerConfigurationResolver resolver) {
        String rawMode = resolver.raw(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE);
        if (rawMode == null || !"s3".equalsIgnoreCase(rawMode.trim())) {
            throw new IllegalStateException("production-like startup rejected: "
                    + ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE
                    + " must be s3 key=" + ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE);
        }
        if (resolver.raw(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE) != null) {
            throw new IllegalStateException("production-like startup rejected: "
                    + ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE
                    + " must not be configured key=" + ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE);
        }
    }

    private static String resolveSetting(String key) {
        return new ServerConfigurationResolver().raw(key);
    }

    private static String safe(String value) {
        return value == null || value.isBlank() ? "unset" : value.trim();
    }

    private static ZoneId defaultZone() {
        ZoneId configured = new ServerConfigurationResolver().runtime().timezone();
        return configured != null ? configured : ZoneId.of("Asia/Tokyo");
    }
}
