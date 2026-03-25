package open.dolphin.security.audit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.audit.AuditEventEnvelope.Outcome;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * AuditTrailService 経由で authoritative audit に append するディスパッチャ。
 */
@ApplicationScoped
public class SessionAuditDispatcher {

    private static final Logger LOGGER = LoggerFactory.getLogger(SessionAuditDispatcher.class);

    @Inject
    private AuditTrailService auditTrailService;

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public AuditEventEnvelope dispatch(AuditEventEnvelope envelope) {
        if (envelope == null) {
            throw new IllegalArgumentException("AuditEventEnvelope must not be null");
        }
        return auditTrailService.write(envelope);
    }

    public AuditEventEnvelope record(AuditEventPayload payload) {
        return record(payload, null, null, null);
    }

    public AuditEventEnvelope record(AuditEventPayload payload, Outcome overrideOutcome, String errorCode, String errorMessage) {
        if (payload == null) {
            throw new IllegalArgumentException("AuditEventPayload must not be null");
        }
        Map<String, Object> sanitizedDetails = AuditDetailSanitizer.sanitizeDetails(payload.getAction(), payload.getDetails());
        AuditEventEnvelope.Builder builder = buildEnvelopeFromPayload(payload, sanitizedDetails);
        Outcome normalized = normalizeOutcome(payload, sanitizedDetails, overrideOutcome);
        if (normalized != null) {
            builder.outcome(normalized);
        }
        if (errorCode != null || errorMessage != null) {
            builder.error(errorCode, errorMessage);
        }
        return dispatch(builder.build());
    }

    private AuditEventEnvelope.Builder buildEnvelopeFromPayload(AuditEventPayload payload, Map<String, Object> sanitizedDetails) {
        String action = optional(payload.getAction()).orElse("UNSPECIFIED_ACTION");
        String resource = optional(payload.getResource()).orElse("/api");
        String requestId = optional(payload.getRequestId()).orElseGet(() -> optional(payload.getTraceId()).orElse(UUID.randomUUID().toString()));
        String traceId = optional(payload.getTraceId()).orElse(requestId);

        Map<String, Object> details = sanitizedDetails;
        AuditEventEnvelope.Builder builder = AuditEventEnvelope.builder(action, resource)
                .requestId(requestId)
                .traceId(traceId)
                .runId(resolveRunId(payload, details))
                .screen(resolveScreen(payload, details))
                .uiAction(resolveUiAction(payload, details))
                .actorId(payload.getActorId())
                .actorDisplayName(payload.getActorDisplayName())
                .actorRole(payload.getActorRole())
                .ipAddress(payload.getIpAddress())
                .userAgent(payload.getUserAgent())
                .patientId(AuditDetailSanitizer.resolvePatientId(payload.getPatientId(), details))
                .details(cloneDetails(details));

        resolveFacility(details).ifPresent(builder::facilityId);
        resolveOperation(details).ifPresent(builder::operation);
        return builder;
    }

    private Outcome normalizeOutcome(AuditEventPayload payload, Map<String, Object> sanitizedDetails, Outcome overrideOutcome) {
        if (overrideOutcome == Outcome.FAILURE) {
            return Outcome.FAILURE;
        }
        Outcome detailOutcome = determineOutcome(payload, sanitizedDetails);
        if (detailOutcome != null && detailOutcome != Outcome.SUCCESS) {
            return detailOutcome;
        }
        if (overrideOutcome != null) {
            return overrideOutcome;
        }
        return detailOutcome;
    }

    private Outcome determineOutcome(AuditEventPayload payload, Map<String, Object> sanitizedDetails) {
        if (payload == null) {
            return null;
        }
        Outcome explicit = resolveOutcome(payload.getOutcome());
        if (explicit != null) {
            return explicit;
        }
        Map<String, Object> details = sanitizedDetails;
        if (details == null) {
            return null;
        }
        Outcome detailOutcome = resolveOutcome(optionalString(details.get("outcome")));
        if (detailOutcome != null) {
            return detailOutcome;
        }
        Object status = details.get("status");
        if (status instanceof String statusText && "failed".equalsIgnoreCase(statusText)) {
            return Outcome.FAILURE;
        }
        if (status instanceof String statusText && "blocked".equalsIgnoreCase(statusText)) {
            return Outcome.BLOCKED;
        }
        if (status instanceof String statusText && "success".equalsIgnoreCase(statusText)) {
            return Outcome.SUCCESS;
        }
        return null;
    }

    private Optional<String> resolveFacility(Map<String, Object> details) {
        if (details == null) {
            return Optional.empty();
        }
        Object facility = details.get("facilityId");
        if (facility instanceof String value && !value.isBlank()) {
            return Optional.of(value);
        }
        return Optional.empty();
    }

    private String resolveRunId(AuditEventPayload payload, Map<String, Object> details) {
        String runId = optional(payload.getRunId()).orElse(null);
        if (runId != null) {
            return runId;
        }
        return optionalString(details != null ? details.get("runId") : null);
    }

    private String resolveScreen(AuditEventPayload payload, Map<String, Object> details) {
        String screen = optional(payload.getScreen()).orElse(null);
        if (screen != null) {
            return screen;
        }
        return optionalString(details != null ? details.get("screen") : null);
    }

    private String resolveUiAction(AuditEventPayload payload, Map<String, Object> details) {
        String action = optional(payload.getUiAction()).orElse(null);
        if (action != null) {
            return action;
        }
        return optionalString(details != null ? details.get("uiAction") : null);
    }

    private Outcome resolveOutcome(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "SUCCESS" -> Outcome.SUCCESS;
            case "MISSING" -> Outcome.MISSING;
            case "BLOCKED" -> Outcome.BLOCKED;
            case "FAILURE", "FAILED", "ERROR" -> Outcome.FAILURE;
            default -> null;
        };
    }

    private String optionalString(Object value) {
        if (value instanceof String text && !text.isBlank()) {
            return text;
        }
        return null;
    }

    private Optional<String> resolveOperation(Map<String, Object> details) {
        if (details == null) {
            return Optional.empty();
        }
        Object operation = details.get("operation");
        if (operation instanceof String value && !value.isBlank()) {
            return Optional.of(value);
        }
        return Optional.empty();
    }

    private Map<String, Object> cloneDetails(Map<String, Object> details) {
        if (details == null) {
            return Collections.emptyMap();
        }
        return new HashMap<>(details);
    }

    private Optional<String> optional(String value) {
        return value == null || value.isBlank() ? Optional.empty() : Optional.of(value);
    }
}
