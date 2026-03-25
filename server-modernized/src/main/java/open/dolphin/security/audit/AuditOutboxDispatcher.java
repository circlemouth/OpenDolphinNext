package open.dolphin.security.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.jms.ConnectionFactory;
import jakarta.jms.JMSContext;
import jakarta.jms.Queue;
import jakarta.jms.TextMessage;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.msg.dto.JmsEnvelopeMessage;
import open.dolphin.msg.gateway.MessagingHeaders;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class AuditOutboxDispatcher {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuditOutboxDispatcher.class);
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private static final String PAYLOAD_TYPE_AUDIT = "AUDIT_EVENT";
    private static final long INTERVAL_SECONDS = 10L;
    private static final int BATCH_SIZE = 100;

    @Inject
    private AuditOutboxRepository auditOutboxRepository;

    @Inject
    private AuthoritativeAuditRepository authoritativeAuditRepository;

    @Inject
    private AuditHashService auditHashService;

    @Resource
    private ManagedScheduledExecutorService scheduler;

    @Resource(lookup = "java:/JmsXA")
    private ConnectionFactory connectionFactory;

    @Resource(lookup = "java:/queue/dolphin")
    private Queue dolphinQueue;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private ScheduledFuture<?> scheduled;

    @PostConstruct
    void start() {
        if (scheduler == null) {
            LOGGER.warn("ManagedScheduledExecutorService is not available. Audit outbox dispatcher is disabled.");
            return;
        }
        scheduled = scheduler.scheduleAtFixedRate(this::runSafely, INTERVAL_SECONDS, INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stop() {
        if (scheduled != null) {
            scheduled.cancel(false);
        }
    }

    public void dispatchPending() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        try {
            List<AuditOutboxRepository.OutboxRow> rows =
                    auditOutboxRepository.claimPending(AuditOutboxRepository.DESTINATION_JMS_DOLPHIN, BATCH_SIZE, java.time.Instant.now());
            for (AuditOutboxRepository.OutboxRow row : rows) {
                dispatchRow(row);
            }
        } finally {
            running.set(false);
        }
    }

    private void runSafely() {
        try {
            dispatchPending();
        } catch (RuntimeException ex) {
            LOGGER.warn("Audit outbox dispatch failed", ex);
        }
    }

    private void dispatchRow(AuditOutboxRepository.OutboxRow row) {
        try {
            publishToJms(buildEnvelope(row.eventId()));
            auditOutboxRepository.markDelivered(row.eventId(), row.destination(), java.time.Instant.now());
        } catch (Exception ex) {
            auditOutboxRepository.markFailed(row.eventId(), row.destination(), java.time.Instant.now(), ex.getMessage());
        }
    }

    AuditEventEnvelope buildEnvelope(long eventId) {
        AuthoritativeAuditRepository.EventRow event = authoritativeAuditRepository.loadEvent(eventId);
        if (event == null) {
            throw new IllegalStateException("Audit event not found for outbox row: " + eventId);
        }
        Map<String, Object> details = hashService().parseCanonicalPayload(event.payloadJson());
        AuditEventEnvelope.Builder builder = AuditEventEnvelope.builder(event.action(), event.resource())
                .requestId(event.requestId())
                .traceId(event.traceId())
                .actorId(event.actorId())
                .actorRole(event.actorRole())
                .facilityId(event.facilityId())
                .ipAddress(event.ipAddress())
                .details(details)
                .occurredAt(event.eventTime());
        if ("FAILURE".equalsIgnoreCase(event.outcome())) {
            builder.outcome(AuditEventEnvelope.Outcome.FAILURE);
        } else if ("MISSING".equalsIgnoreCase(event.outcome())) {
            builder.outcome(AuditEventEnvelope.Outcome.MISSING);
        } else if ("BLOCKED".equalsIgnoreCase(event.outcome())) {
            builder.outcome(AuditEventEnvelope.Outcome.BLOCKED);
        } else {
            builder.outcome(AuditEventEnvelope.Outcome.SUCCESS);
        }
        return builder.build();
    }

    void publishToJms(AuditEventEnvelope envelope) throws Exception {
        if (connectionFactory == null || dolphinQueue == null) {
            throw new IllegalStateException("JMS resources unavailable");
        }
        try (JMSContext context = connectionFactory.createContext(JMSContext.AUTO_ACKNOWLEDGE)) {
            String body = JSON.writeValueAsString(JmsEnvelopeMessage.forAudit(envelope));
            TextMessage message = context.createTextMessage(body);
            if (envelope.getTraceId() != null && !envelope.getTraceId().isBlank()) {
                message.setStringProperty(MessagingHeaders.TRACE_ID, envelope.getTraceId());
            }
            message.setStringProperty(MessagingHeaders.PAYLOAD_TYPE, PAYLOAD_TYPE_AUDIT);
            context.createProducer().send(dolphinQueue, message);
        }
    }

    private AuditHashService hashService() {
        return auditHashService != null ? auditHashService : new AuditHashService();
    }
}
