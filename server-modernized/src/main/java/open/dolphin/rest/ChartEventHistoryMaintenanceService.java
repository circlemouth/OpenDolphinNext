package open.dolphin.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;

@ApplicationScoped
public class ChartEventHistoryMaintenanceService {

    @Inject
    private ChartEventHistoryRepository historyRepository;

    private Supplier<ChartEventHistorySettings> settingsSupplier = ChartEventHistorySettingsResolver::load;

    public void purgeHistory() {
        purgeHistory(Instant.now());
    }

    void setHistoryRepository(ChartEventHistoryRepository historyRepository) {
        this.historyRepository = historyRepository;
    }

    void setSettingsSupplier(Supplier<ChartEventHistorySettings> settingsSupplier) {
        this.settingsSupplier = settingsSupplier != null ? settingsSupplier : ChartEventHistorySettingsResolver::load;
    }

    void purgeHistory(Instant now) {
        if (historyRepository == null) {
            return;
        }
        ChartEventHistorySettings settings = settingsSupplier.get();
        Duration retentionDuration = settings.getRetentionDuration();
        boolean retentionByAge = retentionDuration != null
                && !retentionDuration.isZero()
                && !retentionDuration.isNegative();
        if (!retentionByAge && settings.getRetentionCount() <= 0) {
            return;
        }
        historyRepository.purgeAll(settings.getRetentionCount(), retentionDuration, now);
    }
}
