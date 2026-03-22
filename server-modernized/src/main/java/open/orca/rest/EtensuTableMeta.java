package open.orca.rest;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;

final class EtensuTableMeta {
    final String fromClause;
    final String srycdColumn;
    final String kubunColumn;
    final String nameColumn;
    final String tankaColumn;
    final String unitColumn;
    final String categoryColumn;
    final String startDateColumn;
    final String endDateColumn;
    final String tensuVersionColumn;
    final String hTani1Column;
    final String hGroup1Column;
    final String hTani2Column;
    final String hGroup2Column;
    final String hTani3Column;
    final String hGroup3Column;
    final String rDayColumn;
    final String rMonthColumn;
    final String rSameColumn;
    final String rWeekColumn;
    final String nGroupColumn;
    final String cKaisuColumn;
    final String chgYmdColumn;
    final boolean hasName;
    final boolean hasTensuVersion;

    private EtensuTableMeta(String fromClause, String srycdColumn,
            String kubunColumn, String nameColumn, String tankaColumn, String unitColumn,
            String categoryColumn, String startDateColumn, String endDateColumn, String tensuVersionColumn,
            String hTani1Column, String hGroup1Column, String hTani2Column, String hGroup2Column,
            String hTani3Column, String hGroup3Column, String rDayColumn, String rMonthColumn,
            String rSameColumn, String rWeekColumn, String nGroupColumn, String cKaisuColumn,
            String chgYmdColumn, boolean hasName, boolean hasTensuVersion) {
        this.fromClause = fromClause;
        this.srycdColumn = srycdColumn;
        this.kubunColumn = kubunColumn;
        this.nameColumn = nameColumn;
        this.tankaColumn = tankaColumn;
        this.unitColumn = unitColumn;
        this.categoryColumn = categoryColumn;
        this.startDateColumn = startDateColumn;
        this.endDateColumn = endDateColumn;
        this.tensuVersionColumn = tensuVersionColumn;
        this.hTani1Column = hTani1Column;
        this.hGroup1Column = hGroup1Column;
        this.hTani2Column = hTani2Column;
        this.hGroup2Column = hGroup2Column;
        this.hTani3Column = hTani3Column;
        this.hGroup3Column = hGroup3Column;
        this.rDayColumn = rDayColumn;
        this.rMonthColumn = rMonthColumn;
        this.rSameColumn = rSameColumn;
        this.rWeekColumn = rWeekColumn;
        this.nGroupColumn = nGroupColumn;
        this.cKaisuColumn = cKaisuColumn;
        this.chgYmdColumn = chgYmdColumn;
        this.hasName = hasName;
        this.hasTensuVersion = hasTensuVersion;
    }

    static EtensuTableMeta load(Connection connection) throws SQLException {
        DatabaseMetaData meta = connection.getMetaData();
        EtensuColumns etensu = readEtensuColumns(meta);
        TensuColumns tensu = readTensuColumns(meta);
        return buildMeta(etensu, tensu);
    }

    private static EtensuColumns readEtensuColumns(DatabaseMetaData meta) throws SQLException {
        String etensuTable = resolveTable(meta, "TBL_ETENSU_1", "tbl_etensu_1");
        if (etensuTable == null) {
            etensuTable = "TBL_ETENSU_1";
        }
        return new EtensuColumns(
                etensuTable,
                columnOrNull(meta, etensuTable, "SRYCD"),
                columnOrNull(meta, etensuTable, "KUBUN"),
                columnOrNull(meta, etensuTable, "NAME"),
                columnOrNull(meta, etensuTable, "TANKA"),
                columnOrNull(meta, etensuTable, "TANI"),
                columnOrNull(meta, etensuTable, "CATEGORY"),
                firstNonNull(columnOrNull(meta, etensuTable, "YMD_START"), columnOrNull(meta, etensuTable, "YUKOSTYMD")),
                firstNonNull(columnOrNull(meta, etensuTable, "YMD_END"), columnOrNull(meta, etensuTable, "YUKOEDYMD")),
                columnOrNull(meta, etensuTable, "TENSU_VERSION"),
                columnOrNull(meta, etensuTable, "H_TANI1"),
                columnOrNull(meta, etensuTable, "H_GROUP1"),
                columnOrNull(meta, etensuTable, "H_TANI2"),
                columnOrNull(meta, etensuTable, "H_GROUP2"),
                columnOrNull(meta, etensuTable, "H_TANI3"),
                columnOrNull(meta, etensuTable, "H_GROUP3"),
                columnOrNull(meta, etensuTable, "R_DAY"),
                columnOrNull(meta, etensuTable, "R_MONTH"),
                columnOrNull(meta, etensuTable, "R_SAME"),
                columnOrNull(meta, etensuTable, "R_WEEK"),
                columnOrNull(meta, etensuTable, "N_GROUP"),
                columnOrNull(meta, etensuTable, "C_KAISU"),
                columnOrNull(meta, etensuTable, "CHGYMD"));
    }

    private static TensuColumns readTensuColumns(DatabaseMetaData meta) throws SQLException {
        String tensuTable = resolveTable(meta, "TBL_TENSU_MASTER", "tbl_tensu_master");
        if (tensuTable == null) {
            return new TensuColumns(null, null, null, null, null, null, null, null, null, null);
        }
        return new TensuColumns(
                tensuTable,
                columnOrNull(meta, tensuTable, "SRYCD"),
                columnOrNull(meta, tensuTable, "NAME"),
                columnOrNull(meta, tensuTable, "SRYKBN"),
                columnOrNull(meta, tensuTable, "SRYSYUKBN"),
                columnOrNull(meta, tensuTable, "TEN", "TANKA"),
                columnOrNull(meta, tensuTable, "TANINAME", "TANI"),
                columnOrNull(meta, tensuTable, "YUKOSTYMD"),
                columnOrNull(meta, tensuTable, "YUKOEDYMD"),
                columnOrNull(meta, tensuTable, "CHGYMD"));
    }

    private static EtensuTableMeta buildMeta(EtensuColumns etensu, TensuColumns tensu) {
        String resolvedSrycd = EtensuDaoSupport.firstNonBlank(etensu.srycd(), "SRYCD");
        String resolvedStartDate = EtensuDaoSupport.firstNonBlank(etensu.startDate(), "YUKOSTYMD");
        String resolvedEndDate = EtensuDaoSupport.firstNonBlank(etensu.endDate(), "YUKOEDYMD");
        String fromClause = buildFromClause(etensu.table(), tensu, resolvedSrycd);
        return new EtensuTableMeta(
                fromClause,
                qualify("e", resolvedSrycd),
                coalesceExpr(qualify("e", etensu.kubun()), qualify("tm", tensu.kubun())),
                coalesceExpr(qualify("e", etensu.name()), qualify("tm", tensu.name())),
                coalesceExpr(qualify("e", etensu.tanka()), qualify("tm", tensu.tanka())),
                coalesceExpr(qualify("e", etensu.unit()), qualify("tm", tensu.unit())),
                coalesceExpr(qualify("e", etensu.category()), qualify("tm", tensu.category())),
                coalesceExpr(qualify("e", resolvedStartDate), qualify("tm", tensu.startDate())),
                coalesceExpr(qualify("e", resolvedEndDate), qualify("tm", tensu.endDate())),
                qualify("e", etensu.tensuVersion()),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.hTani1(), "H_TANI1")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.hGroup1(), "H_GROUP1")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.hTani2(), "H_TANI2")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.hGroup2(), "H_GROUP2")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.hTani3(), "H_TANI3")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.hGroup3(), "H_GROUP3")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.rDay(), "R_DAY")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.rMonth(), "R_MONTH")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.rSame(), "R_SAME")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.rWeek(), "R_WEEK")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.nGroup(), "N_GROUP")),
                qualify("e", EtensuDaoSupport.firstNonBlank(etensu.cKaisu(), "C_KAISU")),
                coalesceExpr(qualify("e", etensu.chgYmd()), qualify("tm", tensu.chgYmd())),
                coalesceExpr(qualify("e", etensu.name()), qualify("tm", tensu.name())) != null,
                etensu.tensuVersion() != null);
    }

    private static String buildFromClause(String etensuTable, TensuColumns tensu, String resolvedSrycd) {
        String fromClause = " FROM " + etensuTable + " e";
        if (tensu.table() != null && tensu.srycd() != null && tensu.startDate() != null) {
            String tensuSortEnd = EtensuDaoSupport.firstNonBlank(tensu.endDate(), tensu.startDate());
            fromClause = fromClause
                    + " LEFT JOIN (SELECT DISTINCT ON (tm2." + tensu.srycd() + ") tm2.* FROM " + tensu.table()
                    + " tm2 ORDER BY tm2." + tensu.srycd() + ", tm2." + tensu.startDate() + " DESC, tm2."
                    + tensuSortEnd + " DESC) tm ON tm." + tensu.srycd() + " = e." + resolvedSrycd;
        }
        return fromClause;
    }

    String categoryColumn() {
        return categoryColumn != null ? categoryColumn : kubunColumn;
    }

    private static String columnOrNull(DatabaseMetaData meta, String table, String... candidates)
            throws SQLException {
        if (table == null || candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            String resolved = findColumn(meta, table, candidate);
            if (resolved != null) {
                return resolved;
            }
            resolved = findColumn(meta, table.toLowerCase(Locale.ROOT), candidate.toLowerCase(Locale.ROOT));
            if (resolved != null) {
                return resolved;
            }
        }
        return null;
    }

    private static String resolveTable(DatabaseMetaData meta, String... candidates) throws SQLException {
        if (candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            String resolved = findTable(meta, candidate);
            if (resolved != null) {
                return resolved;
            }
            resolved = findTable(meta, candidate.toLowerCase(Locale.ROOT));
            if (resolved != null) {
                return resolved;
            }
        }
        return null;
    }

    private static String findTable(DatabaseMetaData meta, String table) throws SQLException {
        try (ResultSet rs = meta.getTables(null, null, table, new String[] {"TABLE", "VIEW"})) {
            if (rs.next()) {
                return rs.getString("TABLE_NAME");
            }
        }
        return null;
    }

    private static String findColumn(DatabaseMetaData meta, String table, String column) throws SQLException {
        try (ResultSet rs = meta.getColumns(null, null, table, column)) {
            if (rs.next()) {
                return rs.getString("COLUMN_NAME");
            }
        }
        return null;
    }

    private static String qualify(String alias, String column) {
        if (column == null || column.isBlank()) {
            return null;
        }
        return alias + "." + column;
    }

    private static String coalesceExpr(String primary, String secondary) {
        if (primary != null && secondary != null) {
            return "COALESCE(" + primary + ", " + secondary + ")";
        }
        return primary != null ? primary : secondary;
    }

    private static String firstNonNull(String first, String second) {
        return first != null ? first : second;
    }

    private record EtensuColumns(
            String table,
            String srycd,
            String kubun,
            String name,
            String tanka,
            String unit,
            String category,
            String startDate,
            String endDate,
            String tensuVersion,
            String hTani1,
            String hGroup1,
            String hTani2,
            String hGroup2,
            String hTani3,
            String hGroup3,
            String rDay,
            String rMonth,
            String rSame,
            String rWeek,
            String nGroup,
            String cKaisu,
            String chgYmd
    ) {
    }

    private record TensuColumns(
            String table,
            String srycd,
            String name,
            String kubun,
            String category,
            String tanka,
            String unit,
            String startDate,
            String endDate,
            String chgYmd
    ) {
    }
}
