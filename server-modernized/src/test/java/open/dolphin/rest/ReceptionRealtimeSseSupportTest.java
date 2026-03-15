package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ReceptionRealtimeSseSupportTest {

    private ReceptionRealtimeSseSupport support;

    @BeforeEach
    void setUp() {
        support = new ReceptionRealtimeSseSupport();
        support.initialize();
    }

    @AfterEach
    void tearDown() {
        support.shutdown();
    }

    @Test
    void publishReceptionUpdateSendsEvent() {
        RecordingSse sse = new RecordingSse();
        RecordingSseEventSink sink = new RecordingSseEventSink();
        support.register("F001", sse, sink, null);

        support.publishReceptionUpdate("F001", "2026-02-19", "000001", "02", "RUN-REALTIME-001");

        assertFalse(sink.events.isEmpty());
        OutboundSseEvent event = sink.events.get(0);
        assertEquals("reception.updated", event.getName());
        assertEquals("1", event.getId());
        String data = String.valueOf(event.getData());
        assertTrue(data.contains("\"facilityId\":\"F001\""));
        assertTrue(data.contains("\"date\":\"2026-02-19\""));
        assertTrue(data.contains("\"patientId\":\"000001\""));
        assertTrue(data.contains("\"revision\":1"));
    }

    @Test
    void publishReceptionUpdateWithoutSubscribersDoesNotCreateContext() {
        support.publishReceptionUpdate("F001", "2026-02-19", "000001", "02", "RUN-REALTIME-001");

        assertFalse(support.hasFacilityContext("F001"));
        assertEquals(0, support.facilityContextCount());
    }

    @Test
    void registerWithHistoryGapEmitsReplayGapEvent() {
        RecordingSse bootstrapSse = new RecordingSse();
        RecordingSseEventSink bootstrapSink = new RecordingSseEventSink();
        support.register("F001", bootstrapSse, bootstrapSink, null);

        for (int index = 0; index < 205; index++) {
            support.publishReceptionUpdate("F001", "2026-02-19", "P-" + index, "01", "RUN-" + index);
        }

        RecordingSse reconnectSse = new RecordingSse();
        RecordingSseEventSink reconnectSink = new RecordingSseEventSink();
        support.register("F001", reconnectSse, reconnectSink, "1");

        assertFalse(reconnectSink.events.isEmpty());
        assertEquals("reception.replay-gap", reconnectSink.events.get(0).getName());
    }

    @Test
    void registerReplaysInMemoryHistoryWhileClientContextIsActive() {
        RecordingSse bootstrapSse = new RecordingSse();
        RecordingSseEventSink bootstrapSink = new RecordingSseEventSink();
        support.register("F001", bootstrapSse, bootstrapSink, null);

        support.publishReceptionUpdate("F001", "2026-02-19", "000001", "01", "RUN-REALTIME-001");
        support.publishReceptionUpdate("F001", "2026-02-19", "000002", "02", "RUN-REALTIME-002");

        assertEquals(2, support.historySize("F001"));

        RecordingSse reconnectSse = new RecordingSse();
        RecordingSseEventSink reconnectSink = new RecordingSseEventSink();
        support.register("F001", reconnectSse, reconnectSink, "1");

        assertFalse(reconnectSink.events.isEmpty());
        assertEquals("reception.updated", reconnectSink.events.get(0).getName());
        assertEquals("2", reconnectSink.events.get(0).getId());
        assertTrue(String.valueOf(reconnectSink.events.get(0).getData()).contains("\"patientId\":\"000002\""));
    }

    @Test
    void reconnectAfterZeroClientCleanupAlwaysEmitsReplayGap() {
        RecordingSse bootstrapSse = new RecordingSse();
        RecordingSseEventSink bootstrapSink = new RecordingSseEventSink();
        support.register("F001", bootstrapSse, bootstrapSink, null);
        support.publishReceptionUpdate("F001", "2026-02-19", "000001", "02", "RUN-REALTIME-001");
        assertEquals(1, support.historySize("F001"));
        support.unregister("F001", bootstrapSink);

        assertFalse(support.hasFacilityContext("F001"));
        assertEquals(0, support.historySize("F001"));

        RecordingSse reconnectSse = new RecordingSse();
        RecordingSseEventSink reconnectSink = new RecordingSseEventSink();
        support.register("F001", reconnectSse, reconnectSink, "1");

        assertFalse(reconnectSink.events.isEmpty());
        assertEquals("reception.replay-gap", reconnectSink.events.get(0).getName());
        assertTrue(support.hasFacilityContext("F001"));
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
