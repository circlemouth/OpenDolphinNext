package open.dolphin.encounter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import open.dolphin.reconciliation.ReconciliationTaskRepository;

@ApplicationScoped
public class EncounterTransitionService {

    @Inject
    EncounterProjectionRepository encounterProjectionRepository;

    @Inject
    EncounterTransitionLogRepository encounterTransitionLogRepository;

    @Inject
    ReconciliationTaskRepository reconciliationTaskRepository;

    @Inject
    ObjectMapper objectMapper;

    public TransitionResult transition(TransitionCommand command) {
        require(command.encounterKey(), "encounterKey");
        require(command.facilityId(), "facilityId");
        require(command.patientId(), "patientId");
        if (command.karteId() == null || command.karteId() <= 0) {
            throw new IllegalArgumentException("karteId is required");
        }
        require(command.requestId(), "requestId");
        require(command.traceId(), "traceId");
        require(command.idempotencyKey(), "idempotencyKey");
        String operation = normalizeOperation(command.operation());
        EncounterProjectionRepository.EncounterRow row =
                encounterProjectionRepository.findByEncounterKey(command.encounterKey());
        if (row == null) {
            throw new IllegalArgumentException("encounter_not_found");
        }
        if (!command.facilityId().trim().equals(row.facilityId())
                || !command.patientId().trim().equals(row.patientId())
                || !command.karteId().equals(row.karteId())) {
            throw new IllegalArgumentException("encounter_scope_mismatch");
        }

        String targetState = mapTargetState(operation, row.businessState());
        Instant now = Instant.now();
        encounterTransitionLogRepository.insertAttempt(
                row.facilityId(),
                row.encounterKey(),
                operation,
                row.businessState(),
                targetState,
                command.requestId(),
                command.traceId(),
                command.idempotencyKey(),
                null,
                false);
        try {
            encounterProjectionRepository.transitionState(
                    row.encounterKey(),
                    targetState,
                    "chart_open".equals(operation) ? now : null,
                    "bill".equals(operation) ? now : null,
                    "cancel".equals(operation) ? now : null,
                    normalize(command.ownerUserId()),
                    normalize(command.memo()),
                    serializeFlags(command.worklistFlags()),
                    null,
                    now);
            return new TransitionResult(
                    row.encounterKey(),
                    row.scheduleKey(),
                    row.facilityId(),
                    row.patientId(),
                    row.karteId(),
                    row.businessState(),
                    targetState,
                    command.requestId(),
                    command.traceId(),
                    command.idempotencyKey(),
                    now);
        } catch (RuntimeException ex) {
            encounterTransitionLogRepository.markReconciliationRequired(
                    row.facilityId(), row.encounterKey(), command.idempotencyKey(), ex.getMessage());
            reconciliationTaskRepository.openTask(
                    row.facilityId(),
                    "encounter",
                    row.encounterKey(),
                    "transition_failed",
                    "open",
                    "high",
                    serializePayload(Map.of(
                            "requestId", command.requestId(),
                            "traceId", command.traceId(),
                            "idempotencyKey", command.idempotencyKey(),
                            "operation", operation)));
            throw ex;
        }
    }

    private static String mapTargetState(String operation, String currentState) {
        return switch (operation) {
            case "check_in" -> "checked_in";
            case "chart_open" -> "chart_opened";
            case "bill" -> "billed";
            case "cancel" -> "cancelled";
            default -> throw new IllegalArgumentException("invalid_operation");
        };
    }

    private String serializeFlags(Map<String, Object> worklistFlags) {
        return serializePayload(worklistFlags != null ? worklistFlags : Map.of());
    }

    private String serializePayload(Map<String, ?> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("invalid_payload", ex);
        }
    }

    private static String normalizeOperation(String operation) {
        String normalized = require(operation, "operation").toLowerCase(Locale.ROOT);
        if (!normalized.equals("check_in")
                && !normalized.equals("chart_open")
                && !normalized.equals("bill")
                && !normalized.equals("cancel")) {
            throw new IllegalArgumentException("invalid_operation");
        }
        return normalized;
    }

    private static String require(String value, String label) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record TransitionCommand(
            String operation,
            String facilityId,
            String patientId,
            Long karteId,
            String encounterKey,
            String requestId,
            String traceId,
            String idempotencyKey,
            String ownerUserId,
            String memo,
            Map<String, Object> worklistFlags
    ) {
    }

    public record TransitionResult(
            String encounterKey,
            String scheduleKey,
            String facilityId,
            String patientId,
            Long karteId,
            String fromState,
            String toState,
            String requestId,
            String traceId,
            String idempotencyKey,
            Instant transitionedAt
    ) {
    }
}
