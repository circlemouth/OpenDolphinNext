package open.dolphin.rest;

import java.time.Duration;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

final class ChartEventHistorySettingsResolver {

    private static final Logger LOGGER = Logger.getLogger(ChartEventHistorySettingsResolver.class.getName());

    static final int DEFAULT_REPLAY_LIMIT = 200;
    static final int DEFAULT_RETENTION_COUNT = 10000;
    static final Duration DEFAULT_RETENTION_DURATION = Duration.ofHours(24);

    private ChartEventHistorySettingsResolver() {
    }

    static ChartEventHistorySettings load() {
        return load(new ServerConfigurationResolver());
    }

    static ChartEventHistorySettings load(ServerConfigurationResolver resolver) {
        try {
            ServerConfigurationResolver activeResolver = resolver != null ? resolver : new ServerConfigurationResolver();
            ServerRuntimeConfiguration.ChartEventHistorySettings settings = activeResolver.chartEventHistory();
            int replayLimit = resolveOrDefault(settings.replayLimit(), DEFAULT_REPLAY_LIMIT, 1);
            int retentionCount = resolveOrDefault(settings.retentionCount(), DEFAULT_RETENTION_COUNT, 0);
            Duration retentionDuration = settings.retentionDuration() != null
                    ? settings.retentionDuration()
                    : DEFAULT_RETENTION_DURATION;
            if (retentionDuration.isNegative()) {
                retentionDuration = DEFAULT_RETENTION_DURATION;
            }
            return new ChartEventHistorySettings(replayLimit, retentionCount, retentionDuration);
        } catch (RuntimeException ex) {
            LOGGER.log(Level.FINE, "Failed to load config; using default chart-event history settings", ex);
            return new ChartEventHistorySettings(
                    DEFAULT_REPLAY_LIMIT,
                    DEFAULT_RETENTION_COUNT,
                    DEFAULT_RETENTION_DURATION);
        }
    }

    private static int resolveOrDefault(Integer value, int defaultValue, int minValue) {
        if (value == null) {
            return defaultValue;
        }
        return value >= minValue ? value : defaultValue;
    }
}
