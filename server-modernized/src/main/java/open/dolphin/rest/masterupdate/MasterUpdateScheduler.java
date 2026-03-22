package open.dolphin.rest.masterupdate;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infrastructure.concurrent.ConcurrencyResourceNames;
import open.dolphin.runtime.config.ServerConfigurationResolver;

/**
 * Auto scheduler for dataset updates.
 */
@ApplicationScoped
public class MasterUpdateScheduler {

    private static final Logger LOGGER = Logger.getLogger(MasterUpdateScheduler.class.getName());
    @Resource(lookup = ConcurrencyResourceNames.DEFAULT_SCHEDULER)
    private ManagedScheduledExecutorService scheduler;

    @Inject
    private MasterUpdateService masterUpdateService;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    private ScheduledFuture<?> scheduled;

    @PostConstruct
    public void start() {
        if (!resolveEnabled()) {
            LOGGER.info("Master update scheduler is disabled. Set MASTER_UPDATE_SCHEDULER_ENABLED=true to enable.");
            return;
        }
        if (scheduler == null) {
            LOGGER.warning("ManagedScheduledExecutorService is not available. master update scheduler is disabled.");
            return;
        }
        // 1分周期で実行可否を判定。
        scheduled = scheduler.scheduleAtFixedRate(this::runSafely, 15_000L, 60_000L, TimeUnit.MILLISECONDS);
        LOGGER.info("Master update scheduler started.");
    }

    @PreDestroy
    public void stop() {
        if (scheduled != null) {
            scheduled.cancel(true);
        }
    }

    private void runSafely() {
        try {
            List<String> dueDatasets = masterUpdateService.resolveDueDatasets();
            for (String datasetCode : dueDatasets) {
                try {
                    masterUpdateService.runAutoDatasetIfDue(datasetCode);
                } catch (RuntimeException ex) {
                    LOGGER.log(Level.WARNING,
                            "Auto dataset update failed. dataset=" + datasetCode + " err=" + ex.getMessage(),
                            ex);
                }
            }
        } catch (RuntimeException ex) {
            LOGGER.log(Level.WARNING, "Master update scheduler tick failed: " + ex.getMessage(), ex);
        }
    }

    private boolean resolveEnabled() {
        return configurationResolver != null && configurationResolver.masterUpdateScheduler().enabled();
    }
}
