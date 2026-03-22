package open.orca.rest;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;

final class OrcaMasterPagingSupport {
    private static final int MAX_PAGE_SIZE = 2000;

    String applyPaging(String sql) {
        return sql + " LIMIT ? OFFSET ?";
    }

    void applyPagingParams(PreparedStatement ps, int index, int page, int size) throws SQLException {
        int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        int safePage = Math.max(1, page);
        int offset = (safePage - 1) * safeSize;
        ps.setInt(index++, safeSize);
        ps.setInt(index, offset);
    }

    int bindParams(PreparedStatement ps, List<Object> params, int startIndex) throws SQLException {
        int index = startIndex;
        for (Object param : params) {
            if (param == null) {
                ps.setObject(index++, null);
            } else if (param instanceof Integer integer) {
                ps.setInt(index++, integer);
            } else if (param instanceof Double doubleValue) {
                ps.setDouble(index++, doubleValue);
            } else {
                ps.setString(index++, param.toString());
            }
        }
        return index;
    }
}
