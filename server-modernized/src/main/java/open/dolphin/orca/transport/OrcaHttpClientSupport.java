package open.dolphin.orca.transport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.locks.LockSupport;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import open.dolphin.orca.model.OrcaApiResult;
import open.dolphin.rest.OrcaApiProxySupport;

final class OrcaHttpClientSupport {

    private static final ObjectMapper JSON = new ObjectMapper();

    OrcaApiResult extractApiResult(String body, String contentType) {
        if (body == null || body.isBlank()) {
            return null;
        }
        String normalized = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";
        if (normalized.contains("json") || body.trim().startsWith("{")) {
            return extractApiResultFromJson(body);
        }
        return extractApiResultFromXml(body);
    }

    private OrcaApiResult extractApiResultFromXml(String body) {
        String apiResult = extractTagValue(body, "Api_Result");
        String apiMessage = extractTagValue(body, "Api_Result_Message");
        List<String> warnings = extractWarningsFromXml(body);
        return OrcaApiResult.of(apiResult, apiMessage, warnings);
    }

    private OrcaApiResult extractApiResultFromJson(String body) {
        try {
            JsonNode root = JSON.readTree(body);
            Optional<JsonNode> resultNode = findJsonValue(root, "Api_Result");
            Optional<JsonNode> messageNode = findJsonValue(root, "Api_Result_Message");
            String apiResult = resultNode.map(JsonNode::asText).orElse(null);
            String apiMessage = messageNode.map(JsonNode::asText).orElse(null);
            List<String> warnings = extractWarningsFromJson(root);
            return OrcaApiResult.of(apiResult, apiMessage, warnings);
        } catch (IOException ex) {
            return null;
        }
    }

    private Optional<JsonNode> findJsonValue(JsonNode node, String key) {
        if (node == null || key == null) {
            return Optional.empty();
        }
        if (node.has(key)) {
            return Optional.ofNullable(node.get(key));
        }
        for (JsonNode child : node) {
            Optional<JsonNode> found = findJsonValue(child, key);
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private List<String> extractWarningsFromXml(String body) {
        List<String> warnings = new ArrayList<>();
        if (body == null || body.isBlank()) {
            return warnings;
        }
        Pattern pattern = Pattern.compile("<Api_Warning_Message\\b[^>]*>(.*?)</Api_Warning_Message>",
                Pattern.DOTALL);
        Matcher matcher = pattern.matcher(body);
        while (matcher.find()) {
            String value = matcher.group(1);
            if (value != null && !value.trim().isEmpty()) {
                warnings.add(value.trim());
            }
        }
        return warnings;
    }

    private List<String> extractWarningsFromJson(JsonNode node) {
        List<String> warnings = new ArrayList<>();
        if (node == null) {
            return warnings;
        }
        if (node.has("Api_Warning_Message")) {
            JsonNode value = node.get("Api_Warning_Message");
            if (value != null && !value.isNull()) {
                String text = value.asText(null);
                if (text != null && !text.isBlank()) {
                    warnings.add(text);
                }
            }
        }
        for (JsonNode child : node) {
            warnings.addAll(extractWarningsFromJson(child));
        }
        return warnings;
    }

    private String extractTagValue(String payload, String tag) {
        if (payload == null || tag == null) {
            return null;
        }
        Pattern pattern = Pattern.compile("<" + tag + "\\b[^>]*>(.*?)</" + tag + ">", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(payload);
        if (matcher.find()) {
            String value = matcher.group(1);
            return value != null ? value.trim() : null;
        }
        return null;
    }

    boolean isTransientOrcaError(OrcaApiResult result) {
        if (result == null || result.apiResult() == null) {
            return false;
        }
        if (OrcaApiProxySupport.isApiResultSuccess(result.apiResult())) {
            return false;
        }
        String message = result.message() != null ? result.message() : "";
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("排他")
                || normalized.contains("他端末")
                || normalized.contains("使用中")
                || normalized.contains("ロック")
                || normalized.contains("処理中")
                || normalized.contains("一時")
                || normalized.contains("timeout")
                || normalized.contains("タイムアウト")
                || normalized.contains("busy");
    }

    boolean sleepUntilDeadline(Instant deadline, long backoffMs) {
        if (backoffMs <= 0) {
            return !isDeadlineExceeded(deadline);
        }
        if (deadline == null) {
            return false;
        }
        long remainingMs = Duration.between(Instant.now(), deadline).toMillis();
        if (remainingMs <= 0) {
            return false;
        }
        long sleepMs = Math.min(backoffMs, remainingMs);
        long nanos = Duration.ofMillis(sleepMs).toNanos();
        LockSupport.parkNanos(nanos);
        if (Thread.currentThread().isInterrupted()) {
            Thread.currentThread().interrupt();
            return false;
        }
        return !isDeadlineExceeded(deadline);
    }

    int resolveIntConfig(Integer value, int fallback) {
        return value != null ? Math.max(0, value) : fallback;
    }

    long resolveLongConfig(Long value, long fallback) {
        return value != null ? Math.max(0L, value) : fallback;
    }

    Duration resolveDuration(Duration value, Duration fallback) {
        Duration resolved = value != null ? value : fallback;
        return resolved.isNegative() || resolved.isZero() ? fallback : resolved;
    }

    private boolean isDeadlineExceeded(Instant deadline) {
        return deadline == null || !Instant.now().isBefore(deadline);
    }
}
