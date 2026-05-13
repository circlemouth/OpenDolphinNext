package open.dolphin.rest.orca;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@ApplicationScoped
public class PrescriptionOrderEventHashChainVerifier {

    public static final String GENESIS_HASH = "0".repeat(64);

    @PersistenceContext
    private EntityManager entityManager;

    List<HashChainError> verifyOrder(long prescriptionOrderId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                        SELECT prescription_order_event_id,
                               prescription_order_id,
                               prescription_order_revision_id,
                               event_type,
                               actor_user_id,
                               occurred_at,
                               before_summary_json::text,
                               after_summary_json::text,
                               previous_event_hash,
                               event_hash
                          FROM opendolphin.prescription_order_event
                         WHERE prescription_order_id = ?
                         ORDER BY occurred_at ASC, prescription_order_event_id ASC
                        """)
                .setParameter(1, prescriptionOrderId)
                .getResultList();
        List<EventRow> eventRows = rows.stream()
                .map(row -> new EventRow(
                        number(row[0]),
                        number(row[1]),
                        row[2] != null ? number(row[2]) : null,
                        text(row[3]),
                        text(row[4]),
                        instant(row[5]),
                        text(row[6]),
                        text(row[7]),
                        text(row[8]),
                        text(row[9])))
                .toList();
        return verify(eventRows);
    }

    public static List<HashChainError> verify(List<EventRow> rows) {
        List<HashChainError> errors = new ArrayList<>();
        String expectedPrevious = GENESIS_HASH;
        for (EventRow row : rows) {
            if (!expectedPrevious.equals(row.previousEventHash())) {
                errors.add(new HashChainError(row.eventId(), "previous_event_hash_mismatch"));
            }
            String expectedEventHash = computeEventHash(
                    row.orderId(),
                    row.revisionId(),
                    row.eventType(),
                    row.actorUserId(),
                    row.occurredAt(),
                    row.beforeSummaryJson(),
                    row.afterSummaryJson(),
                    row.previousEventHash());
            if (!expectedEventHash.equals(row.eventHash())) {
                errors.add(new HashChainError(row.eventId(), "event_hash_mismatch"));
            }
            expectedPrevious = row.eventHash();
        }
        return errors;
    }

    public static String computeEventHash(long orderId,
            Long revisionId,
            String eventType,
            String actorUserId,
            Instant occurredAt,
            String beforeSummaryJson,
            String afterSummaryJson,
            String previousEventHash) {
        String material = String.join("|",
                Long.toString(orderId),
                revisionId != null ? revisionId.toString() : "",
                nullToEmpty(eventType),
                nullToEmpty(actorUserId),
                occurredAt != null ? occurredAt.toString() : "",
                sha256(nullToEmpty(beforeSummaryJson)),
                sha256(nullToEmpty(afterSummaryJson)),
                nullToEmpty(previousEventHash));
        return sha256(material);
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("sha256_unavailable", ex);
        }
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private static long number(Object value) {
        return ((Number) value).longValue();
    }

    private static String text(Object value) {
        return value != null ? value.toString() : null;
    }

    private static Instant instant(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        return Instant.parse(value.toString());
    }

    public record EventRow(
            long eventId,
            long orderId,
            Long revisionId,
            String eventType,
            String actorUserId,
            Instant occurredAt,
            String beforeSummaryJson,
            String afterSummaryJson,
            String previousEventHash,
            String eventHash) {
    }

    public record HashChainError(long eventId, String reason) {
    }
}
