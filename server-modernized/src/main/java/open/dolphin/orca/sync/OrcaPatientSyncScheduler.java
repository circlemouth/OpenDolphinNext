package open.dolphin.orca.sync;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infrastructure.concurrent.ConcurrencyResourceNames;
import open.dolphin.runtime.config.ServerConfigurationResolver;

/**
 * Periodic ORCA patient sync scheduler (patientlst1v2 -> patientlst2v2 -> upsert local DB).
 */
@ApplicationScoped
public class OrcaPatientSyncScheduler {

    private static final Logger LOGGER = Logger.getLogger(OrcaPatientSyncScheduler.class.getName());

    private static final String ENV_ENABLED = "ORCA_PATIENT_SYNC_ENABLED";
    private static final String PROP_ENABLED = "opendolphin.orca.patient.sync.enabled";
    private static final String ENV_INTERVAL_MINUTES = "ORCA_PATIENT_SYNC_INTERVAL_MINUTES";
    private static final String ENV_LOOKBACK_DAYS = "ORCA_PATIENT_SYNC_INITIAL_LOOKBACK_DAYS";
    private static final String ENV_INCLUDE_TEST_PATIENT = "ORCA_PATIENT_SYNC_INCLUDE_TEST_PATIENT";
    private static final String ENV_INCLUDE_INSURANCE = "ORCA_PATIENT_SYNC_INCLUDE_INSURANCE";
    private static final ZoneId SYNC_ZONE = defaultSyncZone();

    @Resource(lookup = ConcurrencyResourceNames.DEFAULT_SCHEDULER)
    private ManagedScheduledExecutorService scheduler;

    @Inject
    private OrcaPatientSyncPlanner syncPlanner;

    @Inject
    private OrcaPatientSyncRunner syncRunner;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    private ScheduledFuture<?> scheduled;

    @PostConstruct
    public void start() {
        if (!resolveEnabled()) {
            LOGGER.info("ORCA patient sync scheduler is disabled. Set ORCA_PATIENT_SYNC_ENABLED=true to enable.");
            return;
        }
        if (scheduler == null) {
            LOGGER.warning("ManagedScheduledExecutorService is not available. ORCA patient sync will not be scheduled.");
            return;
        }
        int intervalMinutes = resolveIntervalMinutes();
        if (intervalMinutes < 1) {
            intervalMinutes = 1;
        }
        long intervalMs = Duration.ofMinutes(intervalMinutes).toMillis();
        long initialDelayMs = 10_000L;
        scheduled = scheduler.scheduleAtFixedRate(this::runSyncSafely, initialDelayMs, intervalMs, TimeUnit.MILLISECONDS);
        LOGGER.log(Level.INFO, "ORCA patient sync scheduled. intervalMinutes={0} timezone={1}",
                new Object[]{intervalMinutes, SYNC_ZONE.getId()});
    }

    @PreDestroy
    public void stop() {
        if (scheduled != null) {
            scheduled.cancel(true);
        }
    }

    private void runSyncSafely() {
        List<OrcaPatientSyncPlanner.PlannedSync> plans = syncPlanner.planDueRuns(LocalDate.now(SYNC_ZONE), Instant.now());
        for (OrcaPatientSyncPlanner.PlannedSync plan : plans) {
            Instant started = Instant.now();
            try {
                var response = syncRunner.run(plan.facilityId(), plan.request(), "scheduler", plan.runId());
                long elapsedMs = Duration.between(started, Instant.now()).toMillis();
                String apiResult = response.getApiResult();
                int createdCount = response.getCreatedCount();
                int updatedCount = response.getUpdatedCount();
                int fetchedCount = response.getFetchedCount();
                LOGGER.log(Level.INFO,
                        "ORCA patient sync finished. facilityId={0} startDate={1} endDate={2} apiResult={3} created={4} updated={5} fetched={6} elapsedMs={7}",
                        new Object[]{
                                plan.facilityId(),
                                plan.request().getStartDate(),
                                plan.request().getEndDate(),
                                apiResult,
                                createdCount,
                                updatedCount,
                                fetchedCount,
                                elapsedMs
                        });
            } catch (Exception ex) {
                LOGGER.log(Level.WARNING, "ORCA patient sync failed. facilityId=" + plan.facilityId() + " err=" + ex.getMessage(), ex);
            }
        }
    }

    private boolean resolveEnabled() {
        return resolveEnabledFromEnvironment();
    }

    public static boolean resolveEnabledFromEnvironment() {
        return new ServerConfigurationResolver().orcaPatientSync().enabled();
    }

    private int resolveIntervalMinutes() {
        Integer configured = configurationResolver != null ? configurationResolver.orcaPatientSync().intervalMinutes() : null;
        return configured != null && configured > 0 ? configured : 5;
    }

    private static ZoneId defaultSyncZone() {
        ZoneId configured = new ServerConfigurationResolver().runtime().timezone();
        return configured != null ? configured : ZoneId.of("Asia/Tokyo");
    }
}
