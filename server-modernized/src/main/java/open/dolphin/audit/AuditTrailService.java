package open.dolphin.audit;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

/**
 * セッション層から監査ログ永続化／ディスパッチ処理を抽象化するための API。
 */
@FunctionalInterface
public interface AuditTrailService {

    /**
     * 監査イベントを書き込み、連鎖するディスパッチャーがあれば起動する。
     *
     * @param envelope 監査イベントの内容
     * @return 書き込み済みのエンベロープ（チェーン処理で利用するために返却）
     */
    AuditEventEnvelope write(AuditEventEnvelope envelope);

    default AuditEventEnvelope writeSuccess(String action, String resource, Map<String, Object> details) {
        return write(systemEnvelope(action, resource, details, null));
    }

    default AuditEventEnvelope writeFailure(String action, String resource, Map<String, Object> details, Throwable error) {
        return write(systemEnvelope(action, resource, details, error));
    }

    default AuditEventEnvelope systemEnvelope(String action, String resource, Map<String, Object> details, Throwable error) {
        String safeAction = requireNonBlank(action, "action");
        String safeResource = requireNonBlank(resource, "resource");
        Map<String, Object> safeDetails = details == null ? Collections.emptyMap() : details;
        String actorId = requireNonBlank("system", "actorId");
        String requestId = UUID.randomUUID().toString();
        String traceId = requireNonBlank(requestId, "traceId");
        AuditEventEnvelope.Builder builder = AuditEventEnvelope.builder(safeAction, safeResource)
                .actorId(actorId)
                .actorDisplayName("system")
                .requestId(requestId)
                .traceId(traceId)
                .patientId("N/A")
                .details(safeDetails);
        if (error != null) {
            builder.failure(error);
        }
        return builder.build();
    }

    static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(fieldName + " must not be blank");
        }
        return value;
    }
}
