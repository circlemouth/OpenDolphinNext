package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.time.Duration;
import java.time.Instant;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import open.dolphin.infomodel.ChartEventModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartEventSseSupportTest {

    private static final String FACILITY_ID = "facility-001";

    private ChartEventSseSupport support;
    private SimpleMeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        support = new ChartEventSseSupport();
        meterRegistry = new SimpleMeterRegistry();
        support.setMeterRegistry(meterRegistry);
    }

    @Test
    void gapDetectionEmitsWarnAndMetrics() {
        Sse bootstrapSse = mock(Sse.class);
        OutboundSseEvent.Builder bootstrapBuilder = mock(OutboundSseEvent.Builder.class, RETURNS_SELF);
        when(bootstrapSse.newEventBuilder()).thenReturn(bootstrapBuilder);
        when(bootstrapBuilder.build()).thenReturn(mock(OutboundSseEvent.class));
        when(bootstrapBuilder.mediaType(MediaType.APPLICATION_JSON_TYPE)).thenReturn(bootstrapBuilder);

        SseEventSink bootstrapSink = mock(SseEventSink.class);
        when(bootstrapSink.isClosed()).thenReturn(false);

        support.register(FACILITY_ID, "bootstrap-client", bootstrapSse, bootstrapSink, null);
        support.unregister(FACILITY_ID, bootstrapSink);

        for (int i = 0; i < 105; i++) {
            ChartEventModel event = new ChartEventModel();
            event.setFacilityId(FACILITY_ID);
            event.setIssuerUUID("issuer-" + i);
            event.setEventType(ChartEventModel.PVT_STATE);
            support.broadcast(event);
        }

        Sse gapSse = mock(Sse.class);
        OutboundSseEvent.Builder gapBuilder = mock(OutboundSseEvent.Builder.class, RETURNS_SELF);
        when(gapSse.newEventBuilder()).thenReturn(gapBuilder);
        OutboundSseEvent replayEvent = mock(OutboundSseEvent.class);
        when(gapBuilder.build()).thenReturn(replayEvent);
        when(gapBuilder.mediaType(MediaType.APPLICATION_JSON_TYPE)).thenReturn(gapBuilder);

        SseEventSink gapSink = mock(SseEventSink.class);
        when(gapSink.isClosed()).thenReturn(false);
        when(gapSink.send(any(OutboundSseEvent.class))).thenReturn(CompletableFuture.completedFuture(null));

        TestLogHandler handler = new TestLogHandler();
        Logger logger = Logger.getLogger(ChartEventSseSupport.class.getName());
        Level originalLevel = logger.getLevel();
        boolean originalUseParentHandlers = logger.getUseParentHandlers();
        logger.setLevel(Level.ALL);
        logger.setUseParentHandlers(false);
        logger.addHandler(handler);

        try {
            support.register(FACILITY_ID, "gap-client", gapSse, gapSink, "1");
        } finally {
            logger.removeHandler(handler);
            logger.setLevel(originalLevel);
            logger.setUseParentHandlers(originalUseParentHandlers);
        }

        assertTrue(handler.records().stream().anyMatch(record ->
                record.getLevel().intValue() >= Level.WARNING.intValue()
                        && record.getMessage().contains("SSE history gap detected")));

        double retained = meterRegistry.get("chartEvent.history.retained")
                .tag("facility", FACILITY_ID)
                .gauge()
                .value();
        assertEquals(99D, retained, 0.001);

        double gapCount = meterRegistry.get("chartEvent.history.gapDetected")
                .tag("facility", FACILITY_ID)
                .counter()
                .count();
        assertEquals(1D, gapCount, 0.001);
    }

    @Test
    void gapDetectionSendsReloadEvent() {
        Sse bootstrapSse = mock(Sse.class);
        OutboundSseEvent.Builder bootstrapBuilder = mock(OutboundSseEvent.Builder.class, RETURNS_SELF);
        when(bootstrapSse.newEventBuilder()).thenReturn(bootstrapBuilder);
        when(bootstrapBuilder.build()).thenReturn(mock(OutboundSseEvent.class));
        when(bootstrapBuilder.mediaType(MediaType.APPLICATION_JSON_TYPE)).thenReturn(bootstrapBuilder);

        SseEventSink bootstrapSink = mock(SseEventSink.class);
        when(bootstrapSink.isClosed()).thenReturn(false);

        support.register(FACILITY_ID, "bootstrap-client", bootstrapSse, bootstrapSink, null);
        support.unregister(FACILITY_ID, bootstrapSink);

        for (int i = 0; i < 105; i++) {
            ChartEventModel event = new ChartEventModel();
            event.setFacilityId(FACILITY_ID);
            event.setIssuerUUID("issuer-" + i);
            event.setEventType(ChartEventModel.PVT_STATE);
            support.broadcast(event);
        }

        Sse gapSse = mock(Sse.class);
        OutboundSseEvent.Builder reloadBuilder = mock(OutboundSseEvent.Builder.class, RETURNS_SELF);
        OutboundSseEvent reloadEvent = mock(OutboundSseEvent.class);
        when(reloadBuilder.build()).thenReturn(reloadEvent);
        when(reloadBuilder.mediaType(MediaType.APPLICATION_JSON_TYPE)).thenReturn(reloadBuilder);
        OutboundSseEvent.Builder replayBuilder = mock(OutboundSseEvent.Builder.class, RETURNS_SELF);
        when(replayBuilder.build()).thenReturn(mock(OutboundSseEvent.class));
        when(replayBuilder.mediaType(MediaType.APPLICATION_JSON_TYPE)).thenReturn(replayBuilder);

        AtomicInteger builderInvocation = new AtomicInteger();
        when(gapSse.newEventBuilder()).thenAnswer(invocation ->
                builderInvocation.getAndIncrement() == 0 ? reloadBuilder : replayBuilder);

        CopyOnWriteArrayList<OutboundSseEvent> sentEvents = new CopyOnWriteArrayList<>();
        SseEventSink gapSink = mock(SseEventSink.class);
        when(gapSink.isClosed()).thenReturn(false);
        when(gapSink.send(any(OutboundSseEvent.class))).thenAnswer(invocation -> {
            sentEvents.add(invocation.getArgument(0));
            return CompletableFuture.completedFuture(null);
        });

        TestLogHandler handler = new TestLogHandler();
        Logger logger = Logger.getLogger(ChartEventSseSupport.class.getName());
        Level originalLevel = logger.getLevel();
        boolean originalUseParentHandlers = logger.getUseParentHandlers();
        logger.setLevel(Level.ALL);
        logger.setUseParentHandlers(false);
        logger.addHandler(handler);

        try {
            support.register(FACILITY_ID, "gap-client", gapSse, gapSink, "1");
        } finally {
            logger.removeHandler(handler);
            logger.setLevel(originalLevel);
            logger.setUseParentHandlers(originalUseParentHandlers);
        }

        assertEquals(reloadEvent, sentEvents.get(0));
        assertTrue(handler.records().stream().anyMatch(record ->
                record.getLevel().intValue() >= Level.WARNING.intValue()
                        && record.getMessage().contains("SSE history gap detected")));

        verify(reloadBuilder).name("chart-events.replay-gap");
        verify(reloadBuilder).data(String.class, "{\"requiredAction\":\"reload\"}");

        double gapCount = meterRegistry.get("chartEvent.history.gapDetected")
                .tag("facility", FACILITY_ID)
                .counter()
                .count();
        assertEquals(1D, gapCount, 0.001);
    }

    @Test
    void broadcastPersistsHistoryAndSendsEvent() {
        RecordingHistoryRepository repository = new RecordingHistoryRepository();
        support.setHistoryRepository(repository);
        support.setHistorySettings(new ChartEventHistorySettings(200, 10000, Duration.ofHours(24)));

        RecordingSse sse = new RecordingSse();
        RecordingSseEventSink sink = new RecordingSseEventSink();
        support.register(FACILITY_ID, "client-1", sse, sink, null);

        ChartEventModel event = new ChartEventModel();
        event.setFacilityId(FACILITY_ID);
        event.setIssuerUUID("issuer-1");
        event.setEventType(ChartEventModel.PVT_STATE);
        support.broadcast(event);

        assertEquals(1, repository.history.get(FACILITY_ID).size());
        assertEquals(0, repository.purgeCallCount.get());
        assertFalse(sink.events.isEmpty());
        assertEquals("chart-event", sink.events.get(0).getName());
    }

    @Test
    void registerReplaysFromHistoryAndSkipsIssuer() {
        RecordingHistoryRepository repository = new RecordingHistoryRepository();
        repository.addRecord(FACILITY_ID, 1L, "issuer-1", "{\"id\":1}");
        repository.addRecord(FACILITY_ID, 2L, "issuer-2", "{\"id\":2}");
        repository.addRecord(FACILITY_ID, 3L, "client-1", "{\"id\":3}");

        support.setHistoryRepository(repository);
        support.setHistorySettings(new ChartEventHistorySettings(200, 10000, Duration.ofHours(24)));

        RecordingSse sse = new RecordingSse();
        RecordingSseEventSink sink = new RecordingSseEventSink();
        support.register(FACILITY_ID, "client-1", sse, sink, "1");

        assertEquals(1, sink.events.size());
        assertEquals("2", sink.events.get(0).getId());
        assertEquals("{\"id\":2}", sink.events.get(0).getData());
    }

    @Test
    void registerEmitsGapWhenHistoryTooOld() {
        RecordingHistoryRepository repository = new RecordingHistoryRepository();
        repository.addRecord(FACILITY_ID, 10L, "issuer-1", "{\"id\":10}");
        support.setHistoryRepository(repository);
        support.setHistorySettings(new ChartEventHistorySettings(200, 10000, Duration.ofHours(24)));

        RecordingSse sse = new RecordingSse();
        RecordingSseEventSink sink = new RecordingSseEventSink();
        support.register(FACILITY_ID, "client-1", sse, sink, "1");

        assertFalse(sink.events.isEmpty());
        assertEquals("chart-events.replay-gap", sink.events.get(0).getName());
    }

    @Test
    void broadcastContinuesStreamingWhenHistorySaveFails() {
        FailingHistoryRepository repository = new FailingHistoryRepository();
        support.setHistoryRepository(repository);
        support.setHistorySettings(new ChartEventHistorySettings(200, 10000, Duration.ofHours(24)));

        RecordingSse sse = new RecordingSse();
        RecordingSseEventSink sink = new RecordingSseEventSink();
        support.register(FACILITY_ID, "client-1", sse, sink, null);

        ChartEventModel event = new ChartEventModel();
        event.setFacilityId(FACILITY_ID);
        event.setIssuerUUID("issuer-1");
        event.setEventType(ChartEventModel.PVT_STATE);

        support.broadcast(event);

        assertTrue(repository.saveAttempted);
        assertEquals(2, sink.events.size());
        assertEquals("chart-events.replay-gap", sink.events.get(0).getName());
        assertEquals("chart-event", sink.events.get(1).getName());
        assertEquals("1", sink.events.get(1).getId());
        assertEquals(1D, meterRegistry.get("chartEvent.history.gapDetected")
                .tag("facility", FACILITY_ID)
                .counter()
                .count(), 0.001);
    }

    private static final class TestLogHandler extends Handler {

        private final List<LogRecord> records = new CopyOnWriteArrayList<>();

        @Override
        public void publish(LogRecord record) {
            records.add(record);
        }

        @Override
        public void flush() {
            // no-op
        }

        @Override
        public void close() {
            records.clear();
        }

        List<LogRecord> records() {
            return records;
        }
    }

    private static final class RecordingHistoryRepository implements ChartEventHistoryRepository {

        private final AtomicLong sequence = new AtomicLong();
        private final Map<String, List<ChartEventHistoryRecord>> history = new ConcurrentHashMap<>();
        private final AtomicInteger purgeCallCount = new AtomicInteger();

        @Override
        public long nextEventId() {
            return sequence.incrementAndGet();
        }

        @Override
        public void save(long eventId, ChartEventModel event, String payloadJson, Instant createdAt) {
            addRecord(event.getFacilityId(), eventId, event.getIssuerUUID(), payloadJson);
        }

        @Override
        public List<ChartEventHistoryRecord> fetchAfter(String facilityId, long lastEventId, int limit) {
            List<ChartEventHistoryRecord> records = history.getOrDefault(facilityId, List.of());
            return records.stream()
                    .filter(record -> record.eventId() > lastEventId)
                    .limit(limit)
                    .toList();
        }

        @Override
        public OptionalLong findOldestEventId(String facilityId) {
            List<ChartEventHistoryRecord> records = history.getOrDefault(facilityId, List.of());
            return records.stream().mapToLong(ChartEventHistoryRecord::eventId).min();
        }

        @Override
        public OptionalLong findLatestEventId() {
            return history.values().stream()
                    .flatMap(List::stream)
                    .mapToLong(ChartEventHistoryRecord::eventId)
                    .max();
        }

        @Override
        public void purge(String facilityId, int retentionCount, Duration retentionDuration, Instant now) {
            purgeCallCount.incrementAndGet();
        }

        @Override
        public void purgeAll(int retentionCount, Duration retentionDuration, Instant now) {
            purgeCallCount.incrementAndGet();
        }

        void addRecord(String facilityId, long eventId, String issuerUuid, String payloadJson) {
            history.computeIfAbsent(facilityId, key -> new CopyOnWriteArrayList<>())
                    .add(new ChartEventHistoryRecord(eventId, issuerUuid, payloadJson));
            sequence.updateAndGet(current -> Math.max(current, eventId));
        }
    }

    private static final class FailingHistoryRepository implements ChartEventHistoryRepository {

        private final AtomicLong sequence = new AtomicLong();
        private boolean saveAttempted;

        @Override
        public long nextEventId() {
            return sequence.incrementAndGet();
        }

        @Override
        public void save(long eventId, ChartEventModel event, String payloadJson, Instant createdAt) {
            saveAttempted = true;
            throw new IllegalStateException("history store unavailable");
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
            throw new IllegalStateException("not used");
        }

        @Override
        public void purgeAll(int retentionCount, Duration retentionDuration, Instant now) {
            throw new IllegalStateException("not used");
        }
    }

    private static final class RecordingSse implements Sse {
        @Override
        public OutboundSseEvent.Builder newEventBuilder() {
            return new RecordingOutboundSseEvent.Builder();
        }

        @Override
        public jakarta.ws.rs.sse.SseBroadcaster newBroadcaster() {
            throw new UnsupportedOperationException("not used in tests");
        }
    }

    private static final class RecordingSseEventSink implements SseEventSink {
        private final List<OutboundSseEvent> events = new CopyOnWriteArrayList<>();

        @Override
        public boolean isClosed() {
            return false;
        }

        @Override
        public java.util.concurrent.CompletionStage<?> send(OutboundSseEvent event) {
            events.add(event);
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public void close() {
            events.clear();
        }
    }

    private static final class RecordingOutboundSseEvent implements OutboundSseEvent {
        private final String id;
        private final String name;
        private final String comment;
        private final long reconnectDelay;
        private final boolean reconnectDelaySet;
        private final MediaType mediaType;
        private final Object data;
        private final Class<?> type;
        private final java.lang.reflect.Type genericType;

        private RecordingOutboundSseEvent(Builder builder) {
            this.id = builder.id;
            this.name = builder.name;
            this.comment = builder.comment;
            this.reconnectDelay = builder.reconnectDelay;
            this.reconnectDelaySet = builder.reconnectDelaySet;
            this.mediaType = builder.mediaType;
            this.data = builder.data;
            this.type = builder.type;
            this.genericType = builder.genericType;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public String getName() {
            return name;
        }

        @Override
        public String getComment() {
            return comment;
        }

        @Override
        public long getReconnectDelay() {
            return reconnectDelay;
        }

        @Override
        public boolean isReconnectDelaySet() {
            return reconnectDelaySet;
        }

        @Override
        public Class<?> getType() {
            return type;
        }

        @Override
        public java.lang.reflect.Type getGenericType() {
            return genericType;
        }

        @Override
        public MediaType getMediaType() {
            return mediaType;
        }

        @Override
        public Object getData() {
            return data;
        }

        private static final class Builder implements OutboundSseEvent.Builder {
            private String id;
            private String name;
            private String comment;
            private long reconnectDelay;
            private boolean reconnectDelaySet;
            private MediaType mediaType;
            private Object data;
            private Class<?> type;
            private java.lang.reflect.Type genericType;

            @Override
            public OutboundSseEvent.Builder id(String id) {
                this.id = id;
                return this;
            }

            @Override
            public OutboundSseEvent.Builder name(String name) {
                this.name = name;
                return this;
            }

            @Override
            public OutboundSseEvent.Builder reconnectDelay(long delay) {
                this.reconnectDelay = delay;
                this.reconnectDelaySet = true;
                return this;
            }

            @Override
            public OutboundSseEvent.Builder mediaType(MediaType mediaType) {
                this.mediaType = mediaType;
                return this;
            }

            @Override
            public OutboundSseEvent.Builder comment(String comment) {
                this.comment = comment;
                return this;
            }

            @Override
            public OutboundSseEvent.Builder data(Class type, Object data) {
                this.type = type;
                this.data = data;
                return this;
            }

            @Override
            public OutboundSseEvent.Builder data(jakarta.ws.rs.core.GenericType type, Object data) {
                this.genericType = type != null ? type.getType() : null;
                this.data = data;
                return this;
            }

            @Override
            public OutboundSseEvent.Builder data(Object data) {
                this.data = data;
                return this;
            }

            @Override
            public OutboundSseEvent build() {
                return new RecordingOutboundSseEvent(this);
            }
        }
    }
}
