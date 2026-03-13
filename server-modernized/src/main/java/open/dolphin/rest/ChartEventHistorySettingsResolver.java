package open.dolphin.rest;

import java.time.Duration;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.ConfigProvider;

final class ChartEventHistorySettingsResolver {

    private static final Logger LOGGER = Logger.getLogger(ChartEventHistorySettingsResolver.class.getName());

    static final int DEFAULT_REPLAY_LIMIT = 200;
    static final int DEFAULT_RETENTION_COUNT = 10000;
    static final Duration DEFAULT_RETENTION_DURATION = Duration.ofHours(24);

    private ChartEventHistorySettingsResolver() {
    }

    static ChartEventHistorySettings load() {
        Config config = null;
        try {
            config = ConfigProvider.getConfig();
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to load config; using default chart-event history settings", ex);
        }

        int replayLimit = resolveIntConfig(config, "chartEvent.history.replayLimit", DEFAULT_REPLAY_LIMIT, 1);
        int retentionCount = resolveIntConfig(config, "chartEvent.history.retentionCount", DEFAULT_RETENTION_COUNT, 0);
        int retentionHours = resolveIntConfig(
                config, "chartEvent.history.retentionHours", (int) DEFAULT_RETENTION_DURATION.toHours(), 0);
        Duration retentionDuration = retentionHours > 0 ? Duration.ofHours(retentionHours) : Duration.ZERO;
        return new ChartEventHistorySettings(replayLimit, retentionCount, retentionDuration);
    }

    private static int resolveIntConfig(Config config, String key, int defaultValue, int minValue) {
        if (config == null) {
            return defaultValue;
        }
        try {
            Integer value = config.getOptionalValue(key, Integer.class).orElse(defaultValue);
            return value >= minValue ? value : defaultValue;
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Invalid config for " + key + ", using default.", ex);
            return defaultValue;
        }
    }
}
