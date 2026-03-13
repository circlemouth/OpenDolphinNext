package open.dolphin.rest;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.OptionalLong;
import open.dolphin.infomodel.ChartEventModel;

public interface ChartEventHistoryRepository {

    long nextEventId();

    void save(long eventId, ChartEventModel event, String payloadJson, Instant createdAt);

    List<ChartEventHistoryRecord> fetchAfter(String facilityId, long lastEventId, int limit);

    OptionalLong findOldestEventId(String facilityId);

    OptionalLong findLatestEventId();

    void purge(String facilityId, int retentionCount, Duration retentionDuration, Instant now);

    void purgeAll(int retentionCount, Duration retentionDuration, Instant now);
}
