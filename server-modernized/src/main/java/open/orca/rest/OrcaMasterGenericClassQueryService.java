package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class OrcaMasterGenericClassQueryService {
    private final OrcaMasterQuerySupport querySupport;
    private final OrcaMasterPagingSupport pagingSupport;

    OrcaMasterGenericClassQueryService(OrcaMasterQuerySupport querySupport, OrcaMasterPagingSupport pagingSupport) {
        this.querySupport = querySupport;
        this.pagingSupport = pagingSupport;
    }

    OrcaMasterDao.GenericClassSearchResult searchGenericClass(Connection connection,
            OrcaMasterDao.GenericClassCriteria criteria, String tableName, String codeColumn, String nameColumn,
            String kanaColumn, String categoryColumn, String parentColumn, String startDateColumn, String endDateColumn,
            String versionColumn) throws SQLException {
        OrcaMasterQuerySupport.Query query = querySupport.buildGenericClassQuery(criteria, tableName, codeColumn,
                nameColumn, kanaColumn, startDateColumn, endDateColumn);
        Integer totalCount = maybeFetchTotalCount(connection, query, criteria.isIncludeTotalCount());
        if (Integer.valueOf(0).equals(totalCount)) {
            return new OrcaMasterDao.GenericClassSearchResult(Collections.emptyList(), totalCount, null);
        }
        List<OrcaMasterDao.GenericClassRecord> records = fetchGenericClassRecords(connection, query, criteria.getPage(),
                criteria.getSize(), codeColumn, nameColumn, kanaColumn, categoryColumn, parentColumn, startDateColumn,
                endDateColumn, versionColumn);
        String version = resolveVersion(records, null);
        return new OrcaMasterDao.GenericClassSearchResult(records, totalCount, version);
    }

    private Integer maybeFetchTotalCount(Connection connection, OrcaMasterQuerySupport.Query query,
            boolean includeTotalCount) throws SQLException {
        if (!includeTotalCount) {
            return null;
        }
        String sql = "SELECT count(*)" + query.whereClause;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            pagingSupport.bindParams(statement, query.params, 1);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    private List<OrcaMasterDao.GenericClassRecord> fetchGenericClassRecords(Connection connection,
            OrcaMasterQuerySupport.Query query, int page, int size, String codeColumn, String nameColumn,
            String kanaColumn, String categoryColumn, String parentColumn, String startDateColumn, String endDateColumn,
            String versionColumn) throws SQLException {
        String sql = "SELECT "
                + selectColumn(codeColumn) + " AS code, "
                + selectColumn(nameColumn) + " AS name, "
                + selectColumn(kanaColumn) + " AS kana, "
                + selectColumn(categoryColumn) + " AS category, "
                + selectColumn(parentColumn) + " AS parent, "
                + selectColumn(startDateColumn) + " AS startDate, "
                + selectColumn(endDateColumn) + " AS endDate, "
                + selectColumn(versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + codeColumn;
        sql = pagingSupport.applyPaging(sql);
        List<OrcaMasterDao.GenericClassRecord> records = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int index = pagingSupport.bindParams(statement, query.params, 1);
            pagingSupport.applyPagingParams(statement, index, page, size);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    OrcaMasterDao.GenericClassRecord record = new OrcaMasterDao.GenericClassRecord();
                    record.classCode = rs.getString("code");
                    record.className = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.categoryCode = rs.getString("category");
                    record.parentClassCode = rs.getString("parent");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private static String resolveVersion(List<? extends OrcaMasterDao.VersionedRecord> records, String fallback) {
        String version = fallback;
        for (OrcaMasterDao.VersionedRecord record : records) {
            if (record == null || record.version() == null || record.version().isBlank()) {
                continue;
            }
            if (version == null || version.compareTo(record.version()) < 0) {
                version = record.version();
            }
        }
        return version;
    }

    private static String selectColumn(String column) {
        return column != null ? column : "null";
    }
}
