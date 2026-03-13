package open.dolphin.rest;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalLong;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.function.Consumer;
import open.dolphin.converter.ChartEventModelConverter;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.session.support.ChartEventSessionKeys;
import open.dolphin.session.support.ChartEventStreamPublisher;

/**
 * Support component that bridges {@link ChartEventResource} SSE subscriptions
 * with {@link ChartEventServiceBean} notifications.
 *
 * <p>The implementation keeps the legacy long-poll based dispatcher intact
 * while providing a dedicated Server-Sent Events channel. Facilities receive
 * an independent event history buffer so that reconnecting clients can request
 * missed events through the {@code Last-Event-ID} header.</p>
 */
@ApplicationScoped
public class ChartEventSseSupport implements ChartEventStreamPublisher {

    private static final Logger LOGGER = Logger.getLogger(ChartEventSseSupport.class.getName());

    private static final int HISTORY_LIMIT = 100;
    private static final String HISTORY_RETAINED_GAUGE = "chartEvent.history.retained";
    private static final String HISTORY_GAP_COUNTER = "chartEvent.history.gapDetected";

    private final Map<String, FacilityContext> facilityContexts = new ConcurrentHashMap<>();

    private final AtomicLong sequence = new AtomicLong();

    private final ObjectMapper mapper = AbstractResource.getSerializeMapper();

    private static final String REPLAY_GAP_RELOAD_PAYLOAD = "{\"requiredAction\":\"reload\"}";

    private MeterRegistry meterRegistry;

    @Inject
    private ChartEventHistoryRepository historyRepository;

    private ChartEventHistorySettings historySettings = new ChartEventHistorySettings(
            ChartEventHistorySettingsResolver.DEFAULT_REPLAY_LIMIT,
            ChartEventHistorySettingsResolver.DEFAULT_RETENTION_COUNT,
            ChartEventHistorySettingsResolver.DEFAULT_RETENTION_DURATION);

    @PostConstruct
    void initialize() {
        historySettings = ChartEventHistorySettingsResolver.load();
        initializeSequenceFromHistory();
    }

    @Inject
    void setMeterRegistry(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        facilityContexts.forEach(this::registerHistoryGauge);
    }

    void setHistoryRepository(ChartEventHistoryRepository historyRepository) {
        this.historyRepository = historyRepository;
        initializeSequenceFromHistory();
    }

    void setHistorySettings(ChartEventHistorySettings historySettings) {
        if (historySettings != null) {
            this.historySettings = historySettings;
        }
    }

    /**
     * Registers a new SSE subscription for the specified facility.
     *
     * @param facilityId  facility identifier resolved from the authenticated user
     * @param clientUuid  UUID representing the subscribing client
     * @param sse         SSE factory provided by Jakarta REST runtime
     * @param sink        active event sink to stream events to
     * @param lastEventId optional "Last-Event-ID" header for replay
     */
    public void register(String facilityId, String clientUuid, Sse sse, SseEventSink sink, String lastEventId) {
        Objects.requireNonNull(facilityId, "facilityId");
        Objects.requireNonNull(clientUuid, "clientUuid");
        Objects.requireNonNull(sink, "sink");
        if (sink.isClosed()) {
            return;
        }

        FacilityContext context = facilityContexts.computeIfAbsent(facilityId, id -> new FacilityContext());
        registerHistoryGauge(facilityId, context);
        SseClient client = new SseClient(clientUuid, sink, sse);
        context.addClient(client);

        long replayAfter = parseEventId(lastEventId);
        if (replayAfter >= 0) {
            boolean replayedFromHistory = false;
            if (historyRepository != null) {
                try {
                    OptionalLong oldest = historyRepository.findOldestEventId(facilityId);
                    if (oldest.isPresent() && replayAfter < oldest.getAsLong()) {
                        client.markHistoryGapDetected();
                        LOGGER.log(
                                Level.WARNING,
                                "SSE history gap detected for facility {0}, client {1}: lastEventId={2}, oldestHistoryId={3}",
                                new Object[]{facilityId, clientUuid, replayAfter, oldest.getAsLong()}
                        );
                        recordHistoryGapMetric(facilityId);
                        sendReplayGapEvent(context, client);
                    }
                    List<ChartEventHistoryRecord> records = historyRepository.fetchAfter(
                            facilityId, replayAfter, historySettings.getReplayLimit());
                    for (ChartEventHistoryRecord record : records) {
                        if (record.issuerUuid() != null && record.issuerUuid().equals(clientUuid)) {
                            continue;
                        }
                        sendEvent(context, new SsePayload(record.eventId(), record.issuerUuid(), record.payloadJson()), client);
                    }
                    replayedFromHistory = true;
                } catch (Exception ex) {
                    LOGGER.log(Level.WARNING, "Failed to replay chart-event history from DB", ex);
                    recordHistoryGapMetric(facilityId);
                    sendReplayGapEvent(context, client);
                }
            }
            if (!replayedFromHistory) {
                if (context.isHistoryGap(replayAfter)) {
                    client.markHistoryGapDetected();
                    long oldestHistoryId = context.getOldestHistoryId();
                    LOGGER.log(
                            Level.WARNING,
                            "SSE history gap detected for facility {0}, client {1}: lastEventId={2}, oldestHistoryId={3}",
                            new Object[]{facilityId, clientUuid, replayAfter, oldestHistoryId}
                    );
                    recordHistoryGapMetric(facilityId);
                    sendReplayGapEvent(context, client);
                }
                context.replayHistory(replayAfter, client, payload -> sendEvent(context, payload, client));
            }
        }
    }

    /**
     * Removes the specified sink from the facility context.
     */
    public void unregister(String facilityId, SseEventSink sink) {
        FacilityContext context = facilityContexts.get(facilityId);
        if (context != null) {
            context.removeClient(sink);
        }
    }

    /**
     * Broadcasts the chart event to SSE subscribers that belong to the same
     * facility but are not the issuer of the event.
     */
    @Override
    public void broadcast(ChartEventModel event) {
        String facilityId = event.getFacilityId();
        if (facilityId == null) {
            return;
        }
        FacilityContext context = facilityContexts.computeIfAbsent(facilityId, id -> new FacilityContext());
        registerHistoryGauge(facilityId, context);

        String json = toJson(event);
        if (json == null) {
            return;
        }

        Instant now = Instant.now();
        Long eventId = null;
        boolean persisted = false;
        if (historyRepository != null) {
            try {
                long id = historyRepository.nextEventId();
                historyRepository.save(id, event, json, now);
                eventId = id;
                persisted = true;
            } catch (Exception ex) {
                LOGGER.log(Level.WARNING, "Failed to persist chart-event history", ex);
            }
        }

        long assignedEventId;
        if (eventId == null) {
            assignedEventId = sequence.incrementAndGet();
        } else {
            assignedEventId = eventId;
            sequence.updateAndGet(current -> Math.max(current, assignedEventId));
        }

        SsePayload payload = new SsePayload(assignedEventId, event.getIssuerUUID(), json);
        context.appendHistory(payload);

        if (!persisted && historyRepository != null && context.markHistoryGapNotified()) {
            recordHistoryGapMetric(facilityId);
            for (SseClient client : context.clients) {
                sendReplayGapEvent(context, client);
            }
        } else if (persisted) {
            context.resetHistoryGapNotified();
        }

        for (SseClient client : context.clients) {
            if (client.sink.isClosed()) {
                context.removeClient(client.sink);
                continue;
            }
            if (payload.issuerUuid != null && payload.issuerUuid.equals(client.clientUuid)) {
                continue;
            }
            sendEvent(context, payload, client);
        }
    }

    private void registerHistoryGauge(String facilityId, FacilityContext context) {
        context.registerGaugeIfNecessary(meterRegistry, facilityId);
    }

    private void recordHistoryGapMetric(String facilityId) {
        if (meterRegistry == null) {
            return;
        }
        meterRegistry.counter(HISTORY_GAP_COUNTER, "facility", facilityId).increment();
    }

    private void sendEvent(FacilityContext context, SsePayload payload, SseClient client) {
        if (client == null || client.sink.isClosed()) {
            return;
        }

        OutboundSseEvent event = client.sse.newEventBuilder()
                .name(ChartEventSessionKeys.SSE_EVENT_NAME)
                .id(Long.toString(payload.id))
                .mediaType(MediaType.APPLICATION_JSON_TYPE)
                .data(String.class, payload.data)
                .build();

        CompletionStage<?> stage = client.sink.send(event);
        stage.whenComplete((ignored, throwable) -> {
            if (throwable != null) {
                LOGGER.log(Level.FINE, "SSE sink send failed, removing client", throwable);
                context.removeClient(client.sink);
            }
        });
    }

    private void sendReplayGapEvent(FacilityContext context, SseClient client) {
        if (client == null || client.sink.isClosed()) {
            return;
        }

        OutboundSseEvent event = client.sse.newEventBuilder()
                .name(ChartEventSessionKeys.SSE_REPLAY_GAP_EVENT_NAME)
                .mediaType(MediaType.APPLICATION_JSON_TYPE)
                .data(String.class, REPLAY_GAP_RELOAD_PAYLOAD)
                .build();

        CompletionStage<?> stage = client.sink.send(event);
        stage.whenComplete((ignored, throwable) -> {
            if (throwable != null) {
                LOGGER.log(Level.FINE, "SSE sink send failed, removing client", throwable);
                context.removeClient(client.sink);
            }
        });
    }

    private String toJson(ChartEventModel event) {
        ChartEventModelConverter converter = new ChartEventModelConverter();
        converter.setModel(event);
        try {
            return mapper.writeValueAsString(converter);
        } catch (JsonProcessingException e) {
            LOGGER.log(Level.WARNING, "Failed to serialize chart event", e);
            return null;
        }
    }

    private long parseEventId(String lastEventId) {
        if (lastEventId == null || lastEventId.isBlank()) {
            return -1L;
        }
        try {
            return Long.parseLong(lastEventId.trim());
        } catch (NumberFormatException e) {
            LOGGER.log(Level.FINE, "Invalid Last-Event-ID header: {0}", lastEventId);
            return -1L;
        }
    }

    private void initializeSequenceFromHistory() {
        if (historyRepository == null) {
            return;
        }
        try {
            OptionalLong latest = historyRepository.findLatestEventId();
            if (latest.isPresent()) {
                sequence.set(latest.getAsLong());
            }
        } catch (Exception ex) {
            LOGGER.log(Level.WARNING, "Failed to initialize chart-event sequence from history", ex);
        }
    }

    private static final class FacilityContext {

        private final CopyOnWriteArrayList<SseClient> clients = new CopyOnWriteArrayList<>();
        private final ConcurrentLinkedDeque<SsePayload> history = new ConcurrentLinkedDeque<>();
        private final AtomicLong latestSequenceId = new AtomicLong(-1L);
        private final AtomicBoolean gaugeRegistered = new AtomicBoolean();
        private final AtomicBoolean historyGapNotified = new AtomicBoolean();

        void addClient(SseClient client) {
            clients.add(client);
        }

        void removeClient(SseEventSink sink) {
            clients.removeIf(client -> client.sink.equals(sink));
            closeQuietly(sink);
        }

        void appendHistory(SsePayload payload) {
            history.addLast(payload);
            latestSequenceId.set(payload.id);
            while (history.size() > HISTORY_LIMIT) {
                history.pollFirst();
            }
        }

        void replayHistory(long afterId, SseClient client, Consumer<SsePayload> sender) {
            for (SsePayload payload : history) {
                if (payload.id > afterId && !client.clientUuid.equals(payload.issuerUuid)) {
                    sender.accept(payload);
                }
            }
        }

        long getOldestHistoryId() {
            SsePayload oldest = history.peekFirst();
            if (oldest == null) {
                long latest = latestSequenceId.get();
                return latest >= 0 ? latest : -1L;
            }
            return oldest.id;
        }

        long getLatestSequenceId() {
            return latestSequenceId.get();
        }

        double getRetainedSpan() {
            long latest = getLatestSequenceId();
            long oldest = getOldestHistoryId();
            if (latest < 0 || oldest < 0) {
                return 0D;
            }
            long span = latest - oldest;
            return span < 0 ? 0D : (double) span;
        }

        boolean isHistoryGap(long lastEventId) {
            if (lastEventId < 0) {
                return false;
            }
            long oldest = getOldestHistoryId();
            return oldest >= 0 && lastEventId < oldest;
        }

        void registerGaugeIfNecessary(MeterRegistry registry, String facilityId) {
            if (registry == null) {
                return;
            }
            if (!gaugeRegistered.compareAndSet(false, true)) {
                return;
            }
            Gauge.builder(HISTORY_RETAINED_GAUGE, this, FacilityContext::getRetainedSpan)
                    .description("Difference between latest and oldest SSE chart-event history IDs")
                    .tag("facility", facilityId)
                    .strongReference(true)
                    .register(registry);
        }

        boolean markHistoryGapNotified() {
            return historyGapNotified.compareAndSet(false, true);
        }

        void resetHistoryGapNotified() {
            historyGapNotified.set(false);
        }

        private void closeQuietly(SseEventSink sink) {
            try {
                sink.close();
            } catch (Exception ignore) {
                // ignore
            }
        }
    }

    private static final class SseClient {
        private final String clientUuid;
        private final SseEventSink sink;
        private final Sse sse;
        private final Map<String, Object> attributes = new ConcurrentHashMap<>();

        private SseClient(String clientUuid, SseEventSink sink, Sse sse) {
            this.clientUuid = clientUuid;
            this.sink = sink;
            this.sse = sse;
        }

        private void markHistoryGapDetected() {
            attributes.put(ChartEventSessionKeys.HISTORY_GAP_ATTRIBUTE, Boolean.TRUE);
        }
    }

    private static final class SsePayload {
        private final long id;
        private final String issuerUuid;
        private final String data;

        private SsePayload(long id, String issuerUuid, String data) {
            this.id = id;
            this.issuerUuid = issuerUuid;
            this.data = data;
        }
    }
}
