package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
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
            return new ParsedItem(null, null, null, null, null, null, null, null, raw);
        }
        String[] lines = raw.split("\\n", -1);
        String firstLine = lines.length > 0 ? lines[0] : "";
        String jsonPart = firstLine.substring(META_PREFIX.length()).trim();
        String memoText = lines.length <= 1 ? "" : String.join("\n", java.util.Arrays.copyOfRange(lines, 1, lines.length));
        if (jsonPart.isEmpty()) {
            return new ParsedItem(null, null, null, null, null, null, null, null, memoText);
        }
        try {
            Map<String, Object> parsed = OBJECT_MAPPER.readValue(jsonPart, new TypeReference<Map<String, Object>>() {
            });
            return new ParsedItem(
                    normalizeGenericFlg(parsed.get("genericFlg")),
                    normalizeUserComment(parsed.get("userComment")),
                    OrcaOrderBundleRecommendationSupport.normalizeRowRole(parsed.get("rowRole")),
                    OrcaOrderBundleRecommendationSupport.normalizeRowSubtype(parsed.get("rowSubtype")),
                    normalizeCategory(parsed.get("category")),
                    normalizeMasterCategory(parsed.get("masterCategory")),
                    normalizeText(parsed.get("itemNumber")),
                    normalizeText(parsed.get("itemNumberBranch")),
                    memoText);
        } catch (JsonProcessingException error) {
            return new ParsedItem(null, null, null, null, null, null, null, null, raw);
        }
    }

    static String format(
            String genericFlg,
            String userComment,
            String rowRole,
            String rowSubtype,
            String category,
            String masterCategory,
            String itemNumber,
            String itemNumberBranch,
            String memoText) {
        String normalizedGenericFlg = normalizeGenericFlg(genericFlg);
        String normalizedUserComment = normalizeUserComment(userComment);
        String normalizedRowRole = OrcaOrderBundleRecommendationSupport.normalizeRowRole(rowRole);
        String normalizedRowSubtype = OrcaOrderBundleRecommendationSupport.normalizeRowSubtype(rowSubtype);
        String normalizedCategory = normalizeCategory(category);
        String normalizedMasterCategory = normalizeMasterCategory(masterCategory);
        String normalizedItemNumber = normalizeText(itemNumber);
        String normalizedItemNumberBranch = normalizeText(itemNumberBranch);
        String body = memoText == null ? "" : memoText;
        if (normalizedGenericFlg == null && normalizedUserComment == null
                && normalizedRowRole == null && normalizedRowSubtype == null
                && normalizedCategory == null && normalizedMasterCategory == null
                && normalizedItemNumber == null && normalizedItemNumberBranch == null) {
            return body;
        }
        Map<String, String> payload = new LinkedHashMap<>();
        if (normalizedGenericFlg != null) {
            payload.put("genericFlg", normalizedGenericFlg);
        }
        if (normalizedUserComment != null) {
            payload.put("userComment", normalizedUserComment);
        }
        if (normalizedRowRole != null) {
            payload.put("rowRole", normalizedRowRole);
        }
        if (normalizedRowSubtype != null) {
            payload.put("rowSubtype", normalizedRowSubtype);
        }
        if (normalizedCategory != null) {
            payload.put("category", normalizedCategory);
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

    static String normalizeCategory(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        String trimmed = stringValue.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String normalizeMasterCategory(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        String trimmed = stringValue.trim();
        return trimmed.matches("\\d{3}") ? trimmed : null;
    }

    static String normalizeText(Object value) {
        if (!(value instanceof String stringValue)) {
            return null;
        }
        String trimmed = stringValue.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    record ParsedItem(
            String genericFlg,
            String userComment,
            String rowRole,
            String rowSubtype,
            String category,
            String masterCategory,
            String itemNumber,
            String itemNumberBranch,
            String memoText) {
    }
}
