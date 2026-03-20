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
import java.util.Locale;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infrastructure.concurrent.ConcurrencyResourceNames;
import open.dolphin.runtime.RuntimeConfigurationSupport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.rest.dto.orca.PatientSyncRequest;
import open.dolphin.rest.orca.AbstractOrcaRestResource;

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
    private static final String ENV_FACILITY_ID = "ORCA_PATIENT_SYNC_FACILITY_ID";
    private static final java.time.ZoneId SYNC_ZONE = RuntimeConfigurationSupport.resolveTimezone();

    @Resource(lookup = ConcurrencyResourceNames.DEFAULT_SCHEDULER)
    private ManagedScheduledExecutorService scheduler;

    @Inject
    private OrcaPatientSyncService syncService;

    @Inject
    private OrcaPatientSyncStateStore stateStore;

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
        int intervalMinutes = resolveIntEnv(ENV_INTERVAL_MINUTES, 5);
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
        String facilityId = resolveFacilityId();
        if (facilityId == null || facilityId.isBlank()) {
            LOGGER.warning("ORCA patient sync skipped: facilityId is not configured.");
            return;
        }
        LocalDate today = LocalDate.now(SYNC_ZONE);
        LocalDate startDate = resolveStartDate(facilityId, today);
        boolean includeTestPatient = resolveBooleanEnv(ENV_INCLUDE_TEST_PATIENT, false);
        boolean includeInsurance = resolveBooleanEnv(ENV_INCLUDE_INSURANCE, false);
        String runId = AbstractOrcaRestResource.resolveRunIdValue((String) null);

        PatientSyncRequest request = new PatientSyncRequest();
        request.setStartDate(startDate);
        request.setEndDate(today);
        request.setClassCode("01");
        request.setIncludeTestPatient(includeTestPatient);
        request.setIncludeInsurance(includeInsurance);

        Instant started = Instant.now();
        try {
            var response = syncService.syncPatients(facilityId, request, runId);
            long elapsedMs = Duration.between(started, Instant.now()).toMillis();
            LOGGER.log(Level.INFO,
                    "ORCA patient sync finished. facilityId={0} startDate={1} endDate={2} apiResult={3} created={4} updated={5} fetched={6} elapsedMs={7}",
                    new Object[]{
                            facilityId,
                            startDate,
                            today,
                            response != null ? response.getApiResult() : null,
                            response != null ? response.getCreatedCount() : 0,
                            response != null ? response.getUpdatedCount() : 0,
                            response != null ? response.getFetchedCount() : 0,
                            elapsedMs
                    });
        } catch (Exception ex) {
            LOGGER.log(Level.WARNING, "ORCA patient sync failed. facilityId=" + facilityId + " err=" + ex.getMessage(), ex);
        }
    }

    private LocalDate resolveStartDate(String facilityId, LocalDate today) {
        int lookbackDays = resolveIntEnv(ENV_LOOKBACK_DAYS, 7);
        if (lookbackDays < 0) {
            lookbackDays = 0;
        }
        if (stateStore == null) {
            return today.minusDays(lookbackDays);
        }
        OrcaPatientSyncStateStore.FacilityState state = stateStore.loadFacilityState(facilityId);
        if (state == null || state.lastSyncDate == null || state.lastSyncDate.isBlank()) {
            return today.minusDays(lookbackDays);
        }
        try {
            return LocalDate.parse(state.lastSyncDate.trim());
        } catch (Exception ex) {
            return today.minusDays(lookbackDays);
        }
    }

    private boolean resolveEnabled() {
        return resolveEnabledFromEnvironment();
    }

    public static boolean resolveEnabledFromEnvironment() {
        return RuntimeConfigurationSupport.resolveBooleanFlag(PROP_ENABLED, ENV_ENABLED, false);
    }

    private static boolean resolveBooleanEnv(String key, boolean fallback) {
        return RuntimeConfigurationSupport.resolveBooleanFlag(null, key, fallback);
    }

    private static int resolveIntEnv(String key, int fallback) {
        return RuntimeConfigurationSupport.resolvePositiveInt(null, key, fallback);
    }

    private String resolveFacilityId() {
        String explicit = RuntimeConfigurationSupport.firstNonBlank(
                RuntimeConfigurationSupport.resolveFacilityId(ENV_FACILITY_ID));
        if (explicit != null) {
            return explicit;
        }
        if (configurationResolver != null) {
            String value = configurationResolver.orcaRuntime().facilityId();
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
