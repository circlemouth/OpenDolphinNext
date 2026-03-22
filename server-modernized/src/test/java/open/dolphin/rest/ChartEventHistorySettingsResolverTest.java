package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;

class ChartEventHistorySettingsResolverTest {

    @Test
    void loadUsesTypedResolverValues() {
        ChartEventHistorySettings settings = ChartEventHistorySettingsResolver.load(
                TestServerConfigurationResolvers.resolver(
                        "chartEvent.history.replayLimit", "50",
                        "chartEvent.history.retentionCount", "500",
                        "chartEvent.history.retentionHours", "6"));

        assertEquals(50, settings.getReplayLimit());
        assertEquals(500, settings.getRetentionCount());
        assertEquals(Duration.ofHours(6), settings.getRetentionDuration());
    }

    @Test
    void loadFallsBackToDefaultsWhenValuesAreMissing() {
        ChartEventHistorySettings settings = ChartEventHistorySettingsResolver.load(
                TestServerConfigurationResolvers.resolver());

        assertEquals(ChartEventHistorySettingsResolver.DEFAULT_REPLAY_LIMIT, settings.getReplayLimit());
        assertEquals(ChartEventHistorySettingsResolver.DEFAULT_RETENTION_COUNT, settings.getRetentionCount());
        assertEquals(ChartEventHistorySettingsResolver.DEFAULT_RETENTION_DURATION, settings.getRetentionDuration());
    }
}
