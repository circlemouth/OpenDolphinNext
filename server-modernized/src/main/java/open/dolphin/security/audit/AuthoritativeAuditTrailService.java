package open.dolphin.security.audit;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.AuditEvent;

@Transactional(Transactional.TxType.REQUIRES_NEW)
class AuthoritativeAuditTrailService implements open.dolphin.audit.AuditTrailService {

    @Inject
    private AuthoritativeAuditRepository authoritativeAuditRepository;

    @Inject
    private AuditHashService auditHashService;

    public AuditEvent record(AuditEventPayload payload) {
        AuditCommand auditCommand = buildCommand(payload);
        AuthoritativeAuditRepository.AuditWriteResult result = authoritativeAuditRepository.append(auditCommand.command());
        AuditEvent event = new AuditEvent();
        event.setEventTime(auditCommand.eventTime());
        event.setActorId(auditCommand.command().actorId());
        event.setActorDisplayName(payload != null ? payload.getActorDisplayName() : null);
        event.setActorRole(auditCommand.command().actorRole());
        event.setAction(auditCommand.command().action());
        event.setResource(auditCommand.command().resource());
        event.setPatientId(auditCommand.patientId());
        event.setRequestId(auditCommand.command().requestId());
        event.setTraceId(auditCommand.command().traceId());
        event.setRunId(payload != null ? payload.getRunId() : null);
        event.setScreen(payload != null ? payload.getScreen() : null);
        event.setUiAction(payload != null ? payload.getUiAction() : null);
        event.setIpAddress(auditCommand.command().ipAddress());
        event.setUserAgent(payload != null ? payload.getUserAgent() : null);
        event.setOutcome(auditCommand.command().outcome());
        event.setPayload(auditCommand.payloadJson());
        event.setPayloadHash(result.payloadHash());
        event.setPreviousHash(result.previousHash());
        event.setEventHash(result.eventHash());
        return event;
    }

    @Override
    public AuditEventEnvelope write(AuditEventEnvelope envelope) {
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(envelope.getAction());
        payload.setResource(envelope.getResource());
        payload.setActorId(envelope.getActorId());
        payload.setActorDisplayName(envelope.getActorDisplayName());
        payload.setActorRole(envelope.getActorRole());
        payload.setPatientId(envelope.getPatientId());
        payload.setRequestId(determineRequestId(envelope));
        payload.setTraceId(determineTraceId(envelope));
        payload.setRunId(envelope.getRunId());
        payload.setScreen(envelope.getScreen());
        payload.setUiAction(envelope.getUiAction());
        payload.setOutcome(envelope.getOutcome() != null ? envelope.getOutcome().name() : null);
        payload.setIpAddress(envelope.getIpAddress());
        payload.setUserAgent(envelope.getUserAgent());
        payload.setDetails(envelope.getDetails());
        payload.setDetails(envelope.getDetails());
        record(payload);
        return envelope;
    }

    private AuditCommand buildCommand(AuditEventPayload payload) {
        Instant eventTime = Instant.now();
        String patientId = resolvePatientSubject(payload);
        Map<String, Object> sanitizedDetails =
                AuditDetailSanitizer.sanitizeDetails(payload != null ? payload.getAction() : null,
                        payload != null ? payload.getDetails() : null);
        String subjectType = resolveSubjectType(sanitizedDetails, patientId);
        String subjectId = resolveSubjectId(sanitizedDetails, patientId);
        String payloadJson = auditHashService.canonicalizePayload(sanitizedDetails);
        return new AuditCommand(
                eventTime,
                patientId,
                payloadJson,
                new AuthoritativeAuditRepository.AuditWriteCommand(
                        eventTime,
                        requiredText(payload != null ? payload.getAction() : null, "UNSPECIFIED_ACTION"),
                        requiredText(payload != null ? payload.getResource() : null, "/api"),
                        trimToNull(payload != null ? payload.getActorId() : null),
                        trimToNull(payload != null ? payload.getActorRole() : null),
                        extractFacilityId(sanitizedDetails),
                        subjectType,
                        subjectId,
                        resolveOutcome(payload, sanitizedDetails),
                        resolveHttpStatus(sanitizedDetails),
                        determineTraceId(payload),
                        determineRequestId(payload),
                        trimToNull(payload != null ? payload.getIpAddress() : null),
                        trimToNull(payload != null ? payload.getUserAgent() : null),
                        sanitizedDetails));
    }

    private String resolvePatientSubject(AuditEventPayload payload) {
        String explicitPatientId = trimToNull(payload != null ? payload.getPatientId() : null);
        if (explicitPatientId != null) {
            return explicitPatientId;
        }
        Object detailPatientId = payload != null && payload.getDetails() != null ? payload.getDetails().get("patientId") : null;
        if (detailPatientId instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        return null;
    }

    private String determineRequestId(AuditEventEnvelope envelope) {
        return trimToNull(envelope.getRequestId()) != null ? envelope.getRequestId() : envelope.getTraceId();
    }

    private String determineTraceId(AuditEventEnvelope envelope) {
        return trimToNull(envelope.getTraceId()) != null ? envelope.getTraceId() : envelope.getRequestId();
    }

    private String determineRequestId(AuditEventPayload payload) {
        String requestId = trimToNull(payload != null ? payload.getRequestId() : null);
        return requestId != null ? requestId : determineTraceId(payload);
    }

    private String determineTraceId(AuditEventPayload payload) {
        String traceId = trimToNull(payload != null ? payload.getTraceId() : null);
        return traceId != null ? traceId : trimToNull(payload != null ? payload.getRequestId() : null);
    }

    private String extractFacilityId(Map<String, Object> details) {
        Object facilityId = details != null ? details.get("facilityId") : null;
        return facilityId instanceof String value && !value.isBlank() ? value.trim() : null;
    }

    private Integer resolveHttpStatus(Map<String, Object> details) {
        Object value = details != null ? details.get("httpStatus") : null;
        if (value instanceof Integer integer) {
            return integer;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return null;
    }

    private String resolveSubjectType(Map<String, Object> details, String patientId) {
        Object value = details != null ? details.get("subjectType") : null;
        if (value instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        return patientId != null ? "patient" : null;
    }

    private String resolveSubjectId(Map<String, Object> details, String patientId) {
        Object value = details != null ? details.get("subjectId") : null;
        if (value instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        return patientId;
    }

    private String resolveOutcome(AuditEventPayload payload, Map<String, Object> details) {
        String payloadOutcome = normalizeOutcome(payload != null ? payload.getOutcome() : null);
        if (payloadOutcome != null) {
            return payloadOutcome;
        }
        Object detailOutcome = details != null ? details.get("outcome") : null;
        if (detailOutcome instanceof String text) {
            String normalized = normalizeOutcome(text);
            if (normalized != null) {
                return normalized;
            }
        }
        Object status = details != null ? details.get("status") : null;
        if (status instanceof String text) {
            return switch (text.trim().toUpperCase(Locale.ROOT)) {
                case "FAILED", "FAILURE", "ERROR" -> "FAILURE";
                case "BLOCKED" -> "BLOCKED";
                default -> "SUCCESS";
            };
        }
        return "SUCCESS";
    }

    private String normalizeOutcome(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "SUCCESS" -> "SUCCESS";
            case "MISSING" -> "MISSING";
            case "BLOCKED" -> "BLOCKED";
            case "FAILURE", "FAILED", "ERROR" -> "FAILURE";
            default -> null;
        };
    }

    private String requiredText(String value, String fallback) {
        String normalized = trimToNull(value);
        return normalized != null ? normalized : fallback;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record AuditCommand(
            Instant eventTime,
            String patientId,
            String payloadJson,
            AuthoritativeAuditRepository.AuditWriteCommand command) {
    }
}
