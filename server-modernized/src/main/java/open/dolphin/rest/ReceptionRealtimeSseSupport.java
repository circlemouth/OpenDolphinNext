package open.dolphin.rest;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.rest.orca.AbstractOrcaRestResource;

/**
 * Reception 向け SSE 配信サポート。
 */
@ApplicationScoped
public class ReceptionRealtimeSseSupport {

    public static final String EVENT_NAME = "reception.updated";
    public static final String REPLAY_GAP_EVENT_NAME = "reception.replay-gap";
    public static final String KEEP_ALIVE_EVENT_NAME = "reception.keepalive";

    private static final Logger LOGGER = Logger.getLogger(ReceptionRealtimeSseSupport.class.getName());
    private static final int HISTORY_LIMIT = 200;
    private static final long KEEP_ALIVE_INTERVAL_SECONDS = 20L;
    private static final long RECONNECT_DELAY_MILLIS = 2000L;
    private static final String REPLAY_GAP_PAYLOAD = "{\"requiredAction\":\"reload\"}";

    private final ConcurrentHashMap<String, FacilityContext> facilityContexts = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private final ObjectMapper mapper = AbstractResource.getSerializeMapper();

    @Resource(lookup = "java:jboss/ee/concurrency/scheduler/default")
    private ManagedScheduledExecutorService managedKeepAliveScheduler;

    private ScheduledExecutorService keepAliveScheduler;
    private ScheduledFuture<?> keepAliveTask;
    private boolean ownsKeepAliveScheduler;

    @PostConstruct
    void initialize() {
        keepAliveScheduler = resolveKeepAliveScheduler();
        keepAliveTask = keepAliveScheduler.scheduleAtFixedRate(this::broadcastKeepAlive, KEEP_ALIVE_INTERVAL_SECONDS,
                KEEP_ALIVE_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    @PreDestroy
    void shutdown() {
        if (keepAliveTask != null) {
            keepAliveTask.cancel(true);
            keepAliveTask = null;
        }
        if (keepAliveScheduler != null) {
            if (ownsKeepAliveScheduler) {
                keepAliveScheduler.shutdownNow();
            }
            keepAliveScheduler = null;
            ownsKeepAliveScheduler = false;
        }
        facilityContexts.forEach((facilityId, context) -> context.closeAll());
        facilityContexts.clear();
    }

    public void register(String facilityId, Sse sse, SseEventSink sink, String lastEventId) {
        Objects.requireNonNull(facilityId, "facilityId");
        Objects.requireNonNull(sse, "sse");
        Objects.requireNonNull(sink, "sink");
        if (sink.isClosed()) {
            return;
        }

        boolean contextExisted = facilityContexts.containsKey(facilityId);
        FacilityContext context = facilityContexts.computeIfAbsent(facilityId, ignored -> new FacilityContext());
        SseClient client = new SseClient(sink, sse);
        context.addClient(client);

        long replayAfter = parseEventId(lastEventId);
        if (replayAfter < 0) {
            return;
        }
        if (!contextExisted) {
            sendReplayGapEvent(facilityId, context, client);
            return;
        }
        if (context.isHistoryGap(replayAfter)) {
            sendReplayGapEvent(facilityId, context, client);
            return;
        }
        context.replayHistory(replayAfter, payload -> sendUpdateEvent(facilityId, context, payload, client));
    }

    public void unregister(String facilityId, SseEventSink sink) {
        if (facilityId == null || facilityId.isBlank() || sink == null) {
            return;
        }
        FacilityContext context = facilityContexts.get(facilityId);
        if (context != null) {
            removeClient(facilityId, context, sink);
        }
    }

    public void publishReceptionUpdate(
            String facilityId,
            String date,
            String patientId,
            String requestNumber,
            String runId) {
        if (facilityId == null || facilityId.isBlank()) {
            return;
        }
        FacilityContext context = facilityContexts.get(facilityId);
        if (context == null || context.hasNoClients()) {
            cleanupFacilityContextIfIdle(facilityId, context);
            return;
        }
        long revision = sequence.incrementAndGet();
        String effectiveRunId = AbstractOrcaRestResource.resolveRunIdValue(runId);
        String updatedAt = Instant.now().toString();
        String payloadJson = toJson(new ReceptionRealtimePayload(
                EVENT_NAME,
                facilityId,
                date,
                patientId,
                requestNumber,
                revision,
                updatedAt,
                effectiveRunId));
        if (payloadJson == null) {
            return;
        }
        SsePayload payload = new SsePayload(revision, payloadJson);
        context.appendHistory(payload);
        for (SseClient client : context.clients) {
            sendUpdateEvent(facilityId, context, payload, client);
        }
        cleanupFacilityContextIfIdle(facilityId, context);
    }

    private void broadcastKeepAlive() {
        try {
            facilityContexts.forEach((facilityId, context) -> {
                if (context.hasNoClients()) {
                    cleanupFacilityContextIfIdle(facilityId, context);
                    return;
                }
                for (SseClient client : context.clients) {
                    sendKeepAliveEvent(facilityId, context, client);
                }
            });
        } catch (RuntimeException ex) {
            LOGGER.log(Level.FINE, "Failed to broadcast reception keep-alive", ex);
        }
    }

    private void sendUpdateEvent(String facilityId, FacilityContext context, SsePayload payload, SseClient client) {
        if (client == null || client.sink.isClosed()) {
            return;
        }
        OutboundSseEvent event = client.sse.newEventBuilder()
                .name(EVENT_NAME)
                .id(Long.toString(payload.id()))
                .mediaType(MediaType.APPLICATION_JSON_TYPE)
                .reconnectDelay(RECONNECT_DELAY_MILLIS)
                .data(String.class, payload.data())
                .build();
        sendAsync(facilityId, context, client, event);
    }

    private void sendReplayGapEvent(String facilityId, FacilityContext context, SseClient client) {
        if (client == null || client.sink.isClosed()) {
            return;
        }
        OutboundSseEvent event = client.sse.newEventBuilder()
                .name(REPLAY_GAP_EVENT_NAME)
                .mediaType(MediaType.APPLICATION_JSON_TYPE)
                .reconnectDelay(RECONNECT_DELAY_MILLIS)
                .data(String.class, REPLAY_GAP_PAYLOAD)
                .build();
        sendAsync(facilityId, context, client, event);
    }

    private void sendKeepAliveEvent(String facilityId, FacilityContext context, SseClient client) {
        if (client == null || client.sink.isClosed()) {
            return;
        }
        OutboundSseEvent event = client.sse.newEventBuilder()
                .name(KEEP_ALIVE_EVENT_NAME)
                .comment("keep-alive")
                .reconnectDelay(RECONNECT_DELAY_MILLIS)
                .build();
        sendAsync(facilityId, context, client, event);
    }

    private void sendAsync(String facilityId, FacilityContext context, SseClient client, OutboundSseEvent event) {
        CompletionStage<?> stage = client.sink.send(event);
        stage.whenComplete((ignored, throwable) -> {
            if (throwable != null) {
                LOGGER.log(Level.FINE, "SSE sink send failed, removing client", throwable);
                removeClient(facilityId, context, client.sink);
            }
        });
    }

    private void removeClient(String facilityId, FacilityContext context, SseEventSink sink) {
        if (context == null || sink == null) {
            return;
        }
        context.removeClient(sink);
        cleanupFacilityContextIfIdle(facilityId, context);
    }

    private void cleanupFacilityContextIfIdle(String facilityId, FacilityContext context) {
        if (facilityId == null || facilityId.isBlank() || context == null || !context.hasNoClients()) {
            return;
        }
        if (facilityContexts.remove(facilityId, context)) {
            context.clearHistory();
        }
    }

    private String toJson(ReceptionRealtimePayload payload) {
        try {
            return mapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            LOGGER.log(Level.WARNING, "Failed to serialize reception realtime payload", ex);
            return null;
        }
    }

    private long parseEventId(String lastEventId) {
        if (lastEventId == null || lastEventId.isBlank()) {
            return -1L;
        }
        try {
            return Long.parseLong(lastEventId.trim());
        } catch (NumberFormatException ex) {
            LOGGER.log(Level.FINE, "Invalid Last-Event-ID: {0}", lastEventId);
            return -1L;
        }
    }

    private ScheduledExecutorService resolveKeepAliveScheduler() {
        if (managedKeepAliveScheduler != null) {
            ownsKeepAliveScheduler = false;
            return managedKeepAliveScheduler;
        }
        ownsKeepAliveScheduler = true;
        return Executors.newSingleThreadScheduledExecutor(new KeepAliveThreadFactory());
    }

    int facilityContextCount() {
        return facilityContexts.size();
    }

    boolean hasFacilityContext(String facilityId) {
        return facilityContexts.containsKey(facilityId);
    }

    int historySize(String facilityId) {
        FacilityContext context = facilityContexts.get(facilityId);
        return context != null ? context.historySize() : 0;
    }

    private static final class KeepAliveThreadFactory implements ThreadFactory {

        @Override
        public Thread newThread(Runnable runnable) {
            Thread thread = new Thread(runnable, "reception-realtime-keepalive");
            thread.setDaemon(true);
            return thread;
        }
    }

    private static final class FacilityContext {
        private final CopyOnWriteArrayList<SseClient> clients = new CopyOnWriteArrayList<>();
        private final ConcurrentLinkedDeque<SsePayload> history = new ConcurrentLinkedDeque<>();
        private final AtomicLong latestSequenceId = new AtomicLong(-1L);

        void addClient(SseClient client) {
            clients.add(client);
        }

        void removeClient(SseEventSink sink) {
            clients.removeIf(client -> client.sink.equals(sink));
            closeQuietly(sink);
        }

        boolean hasNoClients() {
            return clients.isEmpty();
        }

        void appendHistory(SsePayload payload) {
            history.addLast(payload);
            latestSequenceId.set(payload.id());
            while (history.size() > HISTORY_LIMIT) {
                history.pollFirst();
            }
        }

        void replayHistory(long afterId, Consumer<SsePayload> sender) {
            for (SsePayload payload : history) {
                if (payload.id() > afterId) {
                    sender.accept(payload);
                }
            }
        }

        boolean isHistoryGap(long lastEventId) {
            if (lastEventId < 0) {
                return false;
            }
            long oldest = getOldestHistoryId();
            return oldest >= 0 && lastEventId < oldest;
        }

        long getOldestHistoryId() {
            SsePayload oldest = history.peekFirst();
            if (oldest == null) {
                return latestSequenceId.get();
            }
            return oldest.id();
        }

        void closeAll() {
            for (SseClient client : clients) {
                closeQuietly(client.sink);
            }
            clients.clear();
            history.clear();
        }

        void clearHistory() {
            history.clear();
            latestSequenceId.set(-1L);
        }

        int historySize() {
            return history.size();
        }

        private void closeQuietly(SseEventSink sink) {
            try {
                sink.close();
            } catch (Exception ignore) {
                // ignore
            }
        }
    }

    private record SseClient(SseEventSink sink, Sse sse) {
    }

    private record SsePayload(long id, String data) {
    }

    private record ReceptionRealtimePayload(
            String type,
            String facilityId,
            String date,
            String patientId,
            String requestNumber,
            long revision,
            String updatedAt,
            String runId) {
    }
}
