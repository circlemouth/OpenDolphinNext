package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

final class EtensuDaoSupport {
    private static final Pattern TENSU_VERSION_PATTERN = Pattern.compile("\\d{6}");

    private EtensuDaoSupport() {
    }

    static boolean isRelated(Integer flag) {
        return flag != null && flag > 0;
    }

    static String selectColumn(String column) {
        return column != null ? column : "null";
    }

    static Integer parseVersionKey(String version) {
        if (version == null || version.isBlank()) {
            return null;
        }
        String trimmed = version.trim();
        if (!TENSU_VERSION_PATTERN.matcher(trimmed).matches()) {
            return null;
        }
        return Integer.parseInt(trimmed);
    }

    static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    static int bindParams(PreparedStatement ps, List<Object> params, int startIndex) throws SQLException {
        int index = startIndex;
        for (Object param : params) {
            if (param == null) {
                ps.setObject(index++, null);
            } else if (param instanceof Integer) {
                ps.setInt(index++, (Integer) param);
            } else if (param instanceof Long) {
                ps.setLong(index++, (Long) param);
            } else if (param instanceof Double) {
                ps.setDouble(index++, (Double) param);
            } else {
                ps.setString(index++, param.toString());
            }
        }
        return index;
    }

    static String buildInClause(int size) {
        if (size <= 0) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < size; i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append('?');
        }
        return builder.toString();
    }

    static boolean tableExists(Connection connection, String table) throws SQLException {
        if (connection == null || table == null || table.isBlank()) {
            return false;
        }
        String normalizedTable = table.toLowerCase(Locale.ROOT);
        try (PreparedStatement ps = connection.prepareStatement("SELECT to_regclass(?)")) {
            ps.setString(1, normalizedTable);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString(1) != null;
                }
            }
        }
        return false;
    }

    static Integer getInteger(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    static Double getDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    static String memberKey(String groupCode, String srycd) {
        return (groupCode == null ? "" : groupCode) + "|" + (srycd == null ? "" : srycd);
    }
}
