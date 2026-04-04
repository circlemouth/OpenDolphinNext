package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;

final class OrcaOrderBundleItemMemoSupport {

    private static final String META_PREFIX = "__orca_meta__:";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private OrcaOrderBundleItemMemoSupport() {
    }

    static ParsedItem parse(String memo) {
        String raw = memo == null ? "" : memo;
        if (!raw.startsWith(META_PREFIX)) {
            return new ParsedItem(null, null, null, null, null, raw);
        }
        String[] lines = raw.split("\\n", -1);
        String firstLine = lines.length > 0 ? lines[0] : "";
        String jsonPart = firstLine.substring(META_PREFIX.length()).trim();
        String memoText = lines.length <= 1 ? "" : String.join("\n", java.util.Arrays.copyOfRange(lines, 1, lines.length));
        if (jsonPart.isEmpty()) {
            return new ParsedItem(null, null, null, null, null, memoText);
        }
        try {
            Map<String, Object> parsed = OBJECT_MAPPER.readValue(jsonPart, new TypeReference<Map<String, Object>>() {
            });
            return new ParsedItem(
                    normalizeGenericFlg(parsed.get("genericFlg")),
                    normalizeUserComment(parsed.get("userComment")),
                    normalizeMasterCategory(parsed.get("masterCategory")),
                    normalizeMetaText(parsed.get("itemNumber")),
                    normalizeMetaText(parsed.get("itemNumberBranch")),
                    memoText);
        } catch (Exception error) {
            return new ParsedItem(null, null, null, null, null, raw);
        }
    }

    static String format(
            String genericFlg,
            String userComment,
            String masterCategory,
            String itemNumber,
            String itemNumberBranch,
            String memoText) {
        String normalizedGenericFlg = normalizeGenericFlg(genericFlg);
        String normalizedUserComment = normalizeUserComment(userComment);
        String normalizedMasterCategory = normalizeMasterCategory(masterCategory);
        String normalizedItemNumber = normalizeMetaText(itemNumber);
        String normalizedItemNumberBranch = normalizeMetaText(itemNumberBranch);
        String body = memoText == null ? "" : memoText;
        if (normalizedGenericFlg == null
                && normalizedUserComment == null
                && normalizedMasterCategory == null
                && normalizedItemNumber == null
                && normalizedItemNumberBranch == null) {
            return body;
        }
        Map<String, String> payload = new LinkedHashMap<>();
        if (normalizedGenericFlg != null) {
            payload.put("genericFlg", normalizedGenericFlg);
        }
        if (normalizedUserComment != null) {
            payload.put("userComment", normalizedUserComment);
        }
        if (normalizedMasterCategory != null) {
            payload.put("masterCategory", normalizedMasterCategory);
        }
        if (normalizedItemNumber != null) {
            payload.put("itemNumber", normalizedItemNumber);
        }
        if (normalizedItemNumberBranch != null) {
            payload.put("itemNumberBranch", normalizedItemNumberBranch);
        }
        try {
            String metaLine = META_PREFIX + OBJECT_MAPPER.writeValueAsString(payload);
            return body.isBlank() ? metaLine : metaLine + "\n" + body;
        } catch (Exception error) {
            return body;
        }
    }

    static String normalizeGenericFlg(Object value) {
        if (value instanceof String stringValue) {
            String normalized = stringValue.trim();
            if ("yes".equals(normalized) || "no".equals(normalized)) {
                return normalized;
            }
        }
        return null;
    }

    static String normalizeUserComment(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        return stringValue.isBlank() ? null : stringValue;
    }

    static String normalizeMasterCategory(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        String normalized = stringValue.trim();
        return normalized.matches("\\d{3}") ? normalized : null;
    }

    static String normalizeMetaText(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        String normalized = stringValue.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    record ParsedItem(
            String genericFlg,
            String userComment,
            String masterCategory,
            String itemNumber,
            String itemNumberBranch,
            String memoText) {
    }
}
