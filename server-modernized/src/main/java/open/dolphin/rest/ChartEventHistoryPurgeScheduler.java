package open.dolphin.rest;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infrastructure.concurrent.ConcurrencyResourceNames;
import open.dolphin.runtime.RuntimeConfigurationSupport;

@ApplicationScoped
public class ChartEventHistoryPurgeScheduler {

    private static final Logger LOGGER = Logger.getLogger(ChartEventHistoryPurgeScheduler.class.getName());

    private static final String ENV_ENABLED = "CHART_EVENT_HISTORY_PURGE_ENABLED";
    private static final String PROP_ENABLED = "chartEvent.history.purge.enabled";
    private static final String ENV_INTERVAL_MINUTES = "CHART_EVENT_HISTORY_PURGE_INTERVAL_MINUTES";
    private static final String PROP_INTERVAL_MINUTES = "chartEvent.history.purge.intervalMinutes";
    private static final int DEFAULT_INTERVAL_MINUTES = 5;

    @Resource(lookup = ConcurrencyResourceNames.DEFAULT_SCHEDULER)
    private ManagedScheduledExecutorService scheduler;

    @Inject
    private ChartEventHistoryMaintenanceService maintenanceService;

    private ScheduledFuture<?> scheduled;

    @PostConstruct
    public void start() {
        if (!resolveEnabled()) {
            LOGGER.info("Chart-event history purge scheduler is disabled.");
            return;
        }
        if (scheduler == null) {
            LOGGER.warning("ManagedScheduledExecutorService is not available. Chart-event history purge will not be scheduled.");
            return;
        }
        int intervalMinutes = resolveIntervalMinutes();
        long intervalMs = Duration.ofMinutes(intervalMinutes).toMillis();
        scheduled = scheduler.scheduleAtFixedRate(this::runSafely, 30_000L, intervalMs, TimeUnit.MILLISECONDS);
        LOGGER.log(Level.INFO, "Chart-event history purge scheduled. intervalMinutes={0}", intervalMinutes);
    }

    @PreDestroy
    public void stop() {
        if (scheduled != null) {
            scheduled.cancel(true);
        }
    }

    private void runSafely() {
        try {
            maintenanceService.purgeHistory();
        } catch (RuntimeException ex) {
            LOGGER.log(Level.WARNING, "Chart-event history purge failed: " + ex.getMessage(), ex);
        }
    }

    private boolean resolveEnabled() {
        return RuntimeConfigurationSupport.resolveBooleanFlag(PROP_ENABLED, ENV_ENABLED, false);
    }

    private int resolveIntervalMinutes() {
        return RuntimeConfigurationSupport.resolvePositiveInt(PROP_INTERVAL_MINUTES, ENV_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES);
    }
}
