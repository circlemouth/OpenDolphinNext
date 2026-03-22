package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

class OrcaMasterYouhouQueryService {
    private final OrcaMasterQuerySupport querySupport;
    private final OrcaMasterPagingSupport pagingSupport;

    OrcaMasterYouhouQueryService(OrcaMasterQuerySupport querySupport, OrcaMasterPagingSupport pagingSupport) {
        this.querySupport = querySupport;
        this.pagingSupport = pagingSupport;
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.YouhouRecord> searchYouhou(Connection connection,
            OrcaMasterDao.YouhouCriteria criteria, String tableName, String codeColumn, String nameColumn,
            String kanaColumn, String startDateColumn, String endDateColumn, String versionColumn) throws SQLException {
        OrcaMasterQuerySupport.Query query = querySupport.buildKeywordEffectiveQuery(criteria.getKeyword(),
                criteria.getEffective(), tableName, codeColumn, nameColumn, kanaColumn, startDateColumn, endDateColumn);
        List<OrcaMasterDao.YouhouRecord> records =
                fetchYouhouRecords(connection, query, codeColumn, nameColumn, kanaColumn, startDateColumn, endDateColumn,
                        versionColumn);
        return new OrcaMasterDao.ListSearchResult<>(records, records.size(), resolveVersion(records, null));
    }

    private List<OrcaMasterDao.YouhouRecord> fetchYouhouRecords(Connection connection, OrcaMasterQuerySupport.Query query,
            String codeColumn, String nameColumn, String kanaColumn, String startDateColumn, String endDateColumn,
            String versionColumn) throws SQLException {
        String sql = "SELECT "
                + selectColumn(codeColumn) + " AS code, "
                + selectColumn(nameColumn) + " AS name, "
                + selectColumn(kanaColumn) + " AS kana, "
                + selectColumn(startDateColumn) + " AS startDate, "
                + selectColumn(endDateColumn) + " AS endDate, "
                + selectColumn(versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + codeColumn;
        List<OrcaMasterDao.YouhouRecord> records = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            pagingSupport.bindParams(statement, query.params, 1);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    OrcaMasterDao.YouhouRecord record = new OrcaMasterDao.YouhouRecord();
                    record.youhouCode = rs.getString("code");
                    record.youhouName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
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
