package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.OptionalLong;
import open.dolphin.infomodel.ChartEventModel;
import org.junit.jupiter.api.Test;

class ChartEventHistoryMaintenanceServiceTest {

    @Test
    void purgeHistoryDelegatesToRepositoryWithConfiguredSettings() {
        RecordingHistoryRepository repository = new RecordingHistoryRepository();
        ChartEventHistoryMaintenanceService service = new ChartEventHistoryMaintenanceService();
        service.setHistoryRepository(repository);
        service.setSettingsSupplier(() -> new ChartEventHistorySettings(200, 321, Duration.ofHours(12)));

        Instant now = Instant.parse("2026-02-21T03:27:45Z");
        service.purgeHistory(now);

        assertEquals(321, repository.retentionCount);
        assertEquals(Duration.ofHours(12), repository.retentionDuration);
        assertEquals(now, repository.now);
    }

    @Test
    void purgeHistorySkipsWhenRetentionDisabled() {
        RecordingHistoryRepository repository = new RecordingHistoryRepository();
        ChartEventHistoryMaintenanceService service = new ChartEventHistoryMaintenanceService();
        service.setHistoryRepository(repository);
        service.setSettingsSupplier(() -> new ChartEventHistorySettings(200, 0, Duration.ZERO));

        service.purgeHistory(Instant.parse("2026-02-21T03:27:45Z"));

        assertNull(repository.now);
    }

    private static final class RecordingHistoryRepository implements ChartEventHistoryRepository {

        private Integer retentionCount;
        private Duration retentionDuration;
        private Instant now;

        @Override
        public long nextEventId() {
            return 0;
        }

        @Override
        public void save(long eventId, ChartEventModel event, String payloadJson, Instant createdAt) {
            throw new UnsupportedOperationException("not used");
        }

        @Override
        public List<ChartEventHistoryRecord> fetchAfter(String facilityId, long lastEventId, int limit) {
            return List.of();
        }

        @Override
        public OptionalLong findOldestEventId(String facilityId) {
            return OptionalLong.empty();
        }

        @Override
        public OptionalLong findLatestEventId() {
            return OptionalLong.empty();
        }

        @Override
        public void purge(String facilityId, int retentionCount, Duration retentionDuration, Instant now) {
            throw new UnsupportedOperationException("not used");
        }

        @Override
        public void purgeAll(int retentionCount, Duration retentionDuration, Instant now) {
            this.retentionCount = retentionCount;
            this.retentionDuration = retentionDuration;
            this.now = now;
        }
    }
}
