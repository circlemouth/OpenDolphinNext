package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.io.StringReader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.orca.transport.OrcaTransportResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

final class AdminOrcaUserSupport {

    private static final Logger LOGGER = Logger.getLogger(AdminOrcaUserSupport.class.getName());
    private static final Pattern API_RESULT_PATTERN =
            Pattern.compile("<Api_Result\\b[^>]*>(.*?)</Api_Result>", Pattern.DOTALL);
    private static final Pattern API_MESSAGE_PATTERN =
            Pattern.compile("<Api_Result_Message\\b[^>]*>(.*?)</Api_Result_Message>", Pattern.DOTALL);
    private static final Pattern USER_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_]+$");

    private AdminOrcaUserSupport() {
    }

    static String buildListRequestXml() {
        return "<data><manageusersreq type=\"record\"><Request_Number type=\"string\">01</Request_Number></manageusersreq></data>";
    }

    static ManageUsersResult parseManageUsersResult(OrcaTransportResult response) {
        int status = response != null ? response.getStatus() : 0;
        String body = response != null ? response.getBody() : null;
        return new ManageUsersResult(
                status,
                extractFirst(API_RESULT_PATTERN, body),
                extractFirst(API_MESSAGE_PATTERN, body),
                parseUsers(body));
    }

    static void ensureManageUsersSuccess(AbstractResource resource, HttpServletRequest request, ManageUsersResult result) {
        if (result == null) {
            throw resource.restError(request, Response.Status.BAD_GATEWAY,
                    "orca_empty_response", "ORCA から応答を取得できませんでした。");
        }
        if (result.httpStatus() < 200 || result.httpStatus() >= 300) {
            throw resource.restError(request, Response.Status.BAD_GATEWAY,
                    "orca_http_error", "ORCA manageusersv2 が HTTP " + result.httpStatus() + " を返しました。",
                    Map.of("orcaHttpStatus", result.httpStatus()), null);
        }
        if (!OrcaApiProxySupport.isApiResultSuccess(result.apiResult())) {
            String message = result.apiResultMessage() != null ? result.apiResultMessage() : "ORCA manageusersv2 でエラーが発生しました。";
            Response.Status status = looksConflict(message) ? Response.Status.CONFLICT : Response.Status.BAD_REQUEST;
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("apiResult", result.apiResult());
            details.put("apiResultMessage", message);
            details.put("validationError", Boolean.TRUE);
            throw resource.restError(request, status, "orca_api_error", message, details, null);
        }
    }

    static String requiredOrcaUserId(AbstractResource resource,
                                     HttpServletRequest request,
                                     Map<String, Object> payload,
                                     String... keys) {
        String userId = requiredToken(resource, request, payload, keys);
        if (!USER_ID_PATTERN.matcher(userId).matches()) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "invalid_user_id",
                    "ORCA User_Id は半角英数字とアンダースコアのみ使用できます。");
        }
        return userId;
    }

    static String requiredToken(AbstractResource resource,
                                HttpServletRequest request,
                                Map<String, Object> payload,
                                String... keys) {
        String value = optionalToken(payload, keys);
        if (value == null) {
            String name = (keys != null && keys.length > 0) ? keys[0] : "field";
            throw resource.restError(request, Response.Status.BAD_REQUEST,
                    "required_field_missing", name + " は必須です。");
        }
        return value;
    }

    static String optionalToken(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (key == null) {
                continue;
            }
            String token = normalizeToken(asString(payload.get(key)));
            if (token != null) {
                return token;
            }
        }
        return null;
    }

    static boolean hasAnyKey(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) {
            return false;
        }
        for (String key : keys) {
            if (key != null && payload.containsKey(key)) {
                return true;
            }
        }
        return false;
    }

    static boolean optionalBoolean(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) {
            return false;
        }
        for (String key : keys) {
            if (key == null || !payload.containsKey(key)) {
                continue;
            }
            Object value = payload.get(key);
            if (value instanceof Boolean bool) {
                return bool;
            }
            if (value instanceof Number number) {
                return number.intValue() != 0;
            }
            if (value instanceof String text) {
                String normalized = text.trim().toLowerCase(Locale.ROOT);
                if (normalized.isEmpty()) {
                    continue;
                }
                if ("1".equals(normalized) || "true".equals(normalized) || "yes".equals(normalized) || "on".equals(normalized)) {
                    return Boolean.TRUE;
                }
                if ("0".equals(normalized) || "false".equals(normalized) || "no".equals(normalized) || "off".equals(normalized)) {
                    return Boolean.FALSE;
                }
            }
        }
        return false;
    }

    static String normalizeToken(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String extractLoginId(String compositeUserId) {
        String value = normalizeToken(compositeUserId);
        if (value == null) {
            return null;
        }
        int index = value.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        return index >= 0 && index + 1 < value.length() ? value.substring(index + 1) : value;
    }

    static OrcaUserSnapshot findUser(List<OrcaUserSnapshot> users, String userId) {
        String normalized = normalizeToken(userId);
        if (normalized == null || users == null) {
            return null;
        }
        for (OrcaUserSnapshot user : users) {
            if (user != null && normalized.equals(normalizeToken(user.userId()))) {
                return user;
            }
        }
        return null;
    }

    static Map<String, Object> toUserPayload(OrcaUserSnapshot user, Map<String, Object> link) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("userId", user != null ? user.userId() : null);
        map.put("fullName", user != null ? user.fullName() : null);
        map.put("fullNameKana", user != null ? user.fullNameKana() : null);
        map.put("staffClass", user != null ? user.staffClass() : null);
        map.put("staffNumber", user != null ? user.staffNumber() : null);
        map.put("isAdmin", user != null && user.isAdmin());
        map.put("linked", link != null && Boolean.TRUE.equals(link.get("linked")));
        if (link != null) {
            map.put("ehrUserId", link.get("ehrUserId"));
            map.put("ehrLoginId", link.get("ehrLoginId"));
            map.put("ehrDisplayName", link.get("ehrDisplayName"));
        }
        return map;
    }

    static Map<String, Object> baseEnvelope(String runId,
                                            HttpServletRequest request,
                                            String apiResult,
                                            String apiResultMessage,
                                            boolean success) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("success", success);
        body.put("apiResult", apiResult);
        body.put("apiResultMessage", apiResultMessage);
        body.put("path", request != null ? request.getRequestURI() : "/api/admin/orca/users");
        String traceId = request != null ? request.getHeader("X-Request-Id") : null;
        if (traceId != null && !traceId.isBlank()) {
            body.put("traceId", traceId);
        }
        return body;
    }

    static Map<String, Object> toSyncStatusPayload(SyncState state) {
        SyncState normalized = state != null ? state : SyncState.idle();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("running", normalized.running());
        map.put("lastSyncedAt", normalized.lastSyncedAt());
        map.put("syncedCount", normalized.syncedCount());
        map.put("recentErrorSummary", normalized.recentErrorSummary());
        return map;
    }

    static String summarizeError(Throwable throwable) {
        if (throwable == null) {
            return "unknown error";
        }
        String message = throwable.getMessage();
        if (message == null || message.isBlank()) {
            return throwable.getClass().getSimpleName();
        }
        return message.length() > 200 ? message.substring(0, 200) : message;
    }

    static String buildCreateRequestXml(String userId,
                                        String password,
                                        String staffClass,
                                        String fullName,
                                        String fullNameKana,
                                        Boolean isAdmin) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data><manageusersreq type=\"record\"><Request_Number type=\"string\">02</Request_Number><User_Information type=\"record\">");
        xmlElement(builder, "User_Id", userId);
        xmlElement(builder, "User_Password", password);
        xmlElement(builder, "Group_Number", staffClass);
        xmlElement(builder, "Full_Name", fullName);
        xmlElement(builder, "Kana_Name", fullNameKana);
        xmlElement(builder, "Administrator_Privilege", Boolean.TRUE.equals(isAdmin) ? "1" : "0");
        builder.append("</User_Information></manageusersreq></data>");
        return builder.toString();
    }

    static String buildUpdateRequestXml(String currentUserId,
                                        String newPassword,
                                        String newFullName,
                                        String newFullNameKana) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data><manageusersreq type=\"record\"><Request_Number type=\"string\">03</Request_Number><User_Information type=\"record\">");
        xmlElement(builder, "User_Id", currentUserId);
        xmlElement(builder, "New_User_Password", newPassword);
        xmlElement(builder, "New_Full_Name", newFullName);
        xmlElement(builder, "New_Kana_Name", newFullNameKana);
        builder.append("</User_Information></manageusersreq></data>");
        return builder.toString();
    }

    static String buildDeleteRequestXml(String userId) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data><manageusersreq type=\"record\"><Request_Number type=\"string\">04</Request_Number><User_Information type=\"record\">");
        xmlElement(builder, "User_Id", userId);
        builder.append("</User_Information></manageusersreq></data>");
        return builder.toString();
    }

    private static List<OrcaUserSnapshot> parseUsers(String xml) {
        if (xml == null || xml.isBlank()) {
            return List.of();
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document document = builder.parse(new InputSource(new StringReader(xml)));
            List<OrcaUserSnapshot> parsed = new ArrayList<>();
            collectUsers(document.getElementsByTagName("User_Information_child"), parsed);
            if (parsed.isEmpty()) {
                collectUsers(document.getElementsByTagName("User_Information"), parsed);
            }
            return parsed;
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to parse manageusersv2 response", ex);
            return List.of();
        }
    }

    private static void collectUsers(NodeList nodes, List<OrcaUserSnapshot> parsed) {
        for (int i = 0; i < nodes.getLength(); i++) {
            if (nodes.item(i) instanceof Element element) {
                OrcaUserSnapshot user = parseUserElement(element);
                if (user != null) {
                    parsed.add(user);
                }
            }
        }
    }

    private static OrcaUserSnapshot parseUserElement(Element element) {
        if (element == null) {
            return null;
        }
        String userId = textOf(element, "User_Id");
        if (userId == null) {
            return null;
        }
        return new OrcaUserSnapshot(
                normalizeToken(userId),
                normalizeToken(textOf(element, "Full_Name")),
                normalizeToken(textOf(element, "Kana_Name")),
                normalizeToken(textOf(element, "Group_Number")),
                normalizeToken(textOf(element, "User_Number")),
                "1".equals(normalizeToken(textOf(element, "Administrator_Privilege"))));
    }

    private static String textOf(Element parent, String tagName) {
        NodeList list = parent.getElementsByTagName(tagName);
        return list == null || list.getLength() == 0 || list.item(0) == null
                ? null
                : normalizeToken(list.item(0).getTextContent());
    }

    private static boolean looksConflict(String message) {
        if (message == null) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("already")
                || normalized.contains("duplicate")
                || message.contains("既")
                || message.contains("重複");
    }

    private static String asString(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String text) {
            return text;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String token = normalizeToken(value);
            if (token != null) {
                return token;
            }
        }
        return null;
    }

    private static String extractFirst(Pattern pattern, String text) {
        if (pattern == null || text == null) {
            return null;
        }
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String group = matcher.group(1);
        return group == null ? null : normalizeToken(group);
    }

    private static void xmlElement(StringBuilder builder, String name, String value) {
        if (builder == null || name == null || value == null) {
            return;
        }
        builder.append('<').append(name).append(" type=\"string\">");
        builder.append(escapeXml(value));
        builder.append("</").append(name).append('>');
    }

    private static String escapeXml(String value) {
        StringBuilder builder = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> builder.append("&amp;");
                case '<' -> builder.append("&lt;");
                case '>' -> builder.append("&gt;");
                case '"' -> builder.append("&quot;");
                case '\'' -> builder.append("&apos;");
                default -> builder.append(c);
            }
        }
        return builder.toString();
    }

    record OrcaUserSnapshot(
            String userId,
            String fullName,
            String fullNameKana,
            String staffClass,
            String staffNumber,
            boolean isAdmin
    ) {
    }

    record ManageUsersResult(
            int httpStatus,
            String apiResult,
            String apiResultMessage,
            List<OrcaUserSnapshot> users
    ) {
    }

    record SyncState(
            boolean running,
            String lastSyncedAt,
            Integer syncedCount,
            String recentErrorSummary
    ) {
        static SyncState idle() {
            return new SyncState(false, null, null, null);
        }

        SyncState withRunning(boolean value) {
            return new SyncState(value, lastSyncedAt, syncedCount, recentErrorSummary);
        }

        static SyncState completed(int syncedCount) {
            return new SyncState(false, Instant.now().toString(), syncedCount, null);
        }
    }

    record OrcaUserCreateRequest(
            String userId,
            String password,
            String staffClass,
            String fullName,
            String fullNameKana,
            boolean isAdmin
    ) {
    }

    record OrcaUserUpdateRequest(
            String currentUserId,
            String password,
            String fullName,
            String fullNameKana
    ) {
    }
}
