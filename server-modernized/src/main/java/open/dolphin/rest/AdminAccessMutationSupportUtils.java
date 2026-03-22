package open.dolphin.rest;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import open.dolphin.infomodel.IInfoModel;

final class AdminAccessMutationSupportUtils {

    private AdminAccessMutationSupportUtils() {
    }

    static boolean containsRole(List<String> roles, String targetRole) {
        String target = normalizeRoleKey(targetRole);
        if (target == null) {
            return false;
        }
        for (String role : roles) {
            if (target.equals(normalizeRoleKey(role))) {
                return true;
            }
        }
        return false;
    }

    static boolean hasPrivilegedRoles(List<String> roles) {
        for (String role : roles) {
            String normalized = normalizeRoleKey(role);
            if (normalized == null) {
                continue;
            }
            if (!"user".equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    static boolean containsAdminRole(List<String> roles) {
        for (String role : roles) {
            String normalized = normalizeRoleKey(role);
            if (normalized == null) {
                continue;
            }
            if (normalized.equals("admin")
                    || normalized.equals("system_admin")
                    || normalized.equals("system-admin")
                    || normalized.equals("system-administrator")
                    || normalized.equals("system_administrator")) {
                return true;
            }
        }
        return false;
    }

    static String normalizeRoleKey(String role) {
        if (role == null) {
            return null;
        }
        String normalized = role.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    static List<String> normalizeRoles(Object value) {
        if (!(value instanceof List<?> list)) {
            return new ArrayList<>();
        }
        List<String> roles = new ArrayList<>();
        for (Object entry : list) {
            String token = normalizeRoleToken(entry);
            if (token != null) {
                roles.add(token);
            }
        }
        return roles;
    }

    static String normalizeRoleToken(Object value) {
        if (!(value instanceof String text)) {
            return null;
        }
        String trimmed = text.trim();
        if (trimmed.isEmpty() || trimmed.length() > 64) {
            return null;
        }
        return trimmed;
    }

    static String extractLoginId(String userId) {
        if (userId == null) {
            return null;
        }
        int idx = userId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx < 0) {
            return userId;
        }
        return idx + 1 < userId.length() ? userId.substring(idx + 1) : "";
    }

    static String asString(Object value) {
        return value instanceof String text ? text : null;
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String trimToEmpty(String value) {
        if (value == null) {
            return "";
        }
        return value.trim();
    }

    static String trimToNullableToken(String value) {
        if (value == null) {
            return null;
        }
        return value.trim();
    }

    static String toIsoTimestamp(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value instanceof Instant instant) {
            return instant.toString();
        }
        return String.valueOf(value);
    }
}
