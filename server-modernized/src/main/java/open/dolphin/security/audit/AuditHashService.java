package open.dolphin.security.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.apache.commons.codec.digest.DigestUtils;

@ApplicationScoped
public class AuditHashService {

    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public AuditHashService() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        this.objectMapper = mapper;
    }

    public String canonicalizePayload(Map<String, Object> payload) {
        Map<String, Object> safePayload = payload != null ? new LinkedHashMap<>(payload) : Map.of();
        try {
            return objectMapper.writeValueAsString(safePayload);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize authoritative audit payload", ex);
        }
    }

    public Map<String, Object> parseCanonicalPayload(String payloadJson) {
        String safeJson = payloadJson == null || payloadJson.isBlank() ? "{}" : payloadJson;
        try {
            return objectMapper.readValue(safeJson, MAP_TYPE);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to parse authoritative audit payload", ex);
        }
    }

    public String hashPayload(Map<String, Object> payload) {
        return sha256Hex(canonicalizePayload(payload));
    }

    public String hashPayloadJson(String payloadJson) {
        return sha256Hex(canonicalizePayload(parseCanonicalPayload(payloadJson)));
    }

    public String computeEventHash(EventHashInput input) {
        StringBuilder builder = new StringBuilder(512);
        append(builder, input.eventTime());
        append(builder, input.action());
        append(builder, input.resource());
        append(builder, input.actorId());
        append(builder, input.facilityId());
        append(builder, input.subjectType());
        append(builder, input.subjectId());
        append(builder, input.outcome());
        append(builder, input.httpStatus());
        append(builder, input.traceId());
        append(builder, input.requestId());
        append(builder, input.payloadHash());
        append(builder, input.previousEventId());
        append(builder, input.previousHash());
        return sha256Hex(builder.toString());
    }

    public String sha256Hex(String value) {
        String safeValue = value != null ? value : "";
        return DigestUtils.sha256Hex(safeValue.getBytes(StandardCharsets.UTF_8));
    }

    private void append(StringBuilder builder, Object value) {
        builder.append(value == null ? "" : value).append('\n');
    }

    public record EventHashInput(
            String eventTime,
            String action,
            String resource,
            String actorId,
            String facilityId,
            String subjectType,
            String subjectId,
            String outcome,
            String httpStatus,
            String traceId,
            String requestId,
            String payloadHash,
            String previousEventId,
            String previousHash) {
    }
}
