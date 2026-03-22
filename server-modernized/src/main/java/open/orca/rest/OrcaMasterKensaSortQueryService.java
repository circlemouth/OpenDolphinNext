package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

class OrcaMasterKensaSortQueryService {
    private final OrcaMasterQuerySupport querySupport;
    private final OrcaMasterPagingSupport pagingSupport;

    OrcaMasterKensaSortQueryService(OrcaMasterQuerySupport querySupport, OrcaMasterPagingSupport pagingSupport) {
        this.querySupport = querySupport;
        this.pagingSupport = pagingSupport;
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.KensaSortRecord> searchKensaSort(Connection connection,
            OrcaMasterDao.KensaSortCriteria criteria, String sortTableName, String sortCodeColumn, String sortColumn,
            String sortVersionColumn, String tensuTableName, String tensuCodeColumn, String tensuNameColumn,
            String tensuKanaColumn, String tensuCategoryColumn, String tensuStartDateColumn, String tensuEndDateColumn,
            String tensuVersionColumn) throws SQLException {
        OrcaMasterQuerySupport.Query query = querySupport.buildKensaSortJoinQuery(criteria, sortTableName, sortCodeColumn,
                sortColumn, tensuTableName, tensuCodeColumn, tensuNameColumn, tensuKanaColumn, tensuStartDateColumn,
                tensuEndDateColumn);
        List<OrcaMasterDao.KensaSortRecord> records = fetchKensaSortRecordsFromTensu(connection, query, sortCodeColumn,
                sortColumn, sortVersionColumn, tensuNameColumn, tensuKanaColumn, tensuCategoryColumn,
                tensuStartDateColumn, tensuEndDateColumn, tensuVersionColumn);
        return new OrcaMasterDao.ListSearchResult<>(records, records.size(), resolveVersion(records, null));
    }

    private List<OrcaMasterDao.KensaSortRecord> fetchKensaSortRecordsFromTensu(Connection connection,
            OrcaMasterQuerySupport.Query query, String sortCodeColumn, String sortColumn, String sortVersionColumn,
            String tensuNameColumn, String tensuKanaColumn, String tensuCategoryColumn, String tensuStartDateColumn,
            String tensuEndDateColumn, String tensuVersionColumn) throws SQLException {
        final String sortAlias = "k";
        final String tensuAlias = "t";
        String versionSelect = resolveVersionSelect(sortAlias, sortVersionColumn, tensuAlias, tensuVersionColumn);

        StringBuilder order = new StringBuilder(sortAlias).append('.').append(sortCodeColumn);
        if (tensuStartDateColumn != null) {
            order.append(", ").append(tensuAlias).append('.').append(tensuStartDateColumn).append(" DESC");
        }
        if (tensuEndDateColumn != null) {
            order.append(", ").append(tensuAlias).append('.').append(tensuEndDateColumn).append(" DESC");
        }

        String sql = "SELECT DISTINCT ON (" + sortAlias + "." + sortCodeColumn + ") "
                + selectColumn(sortAlias + "." + sortCodeColumn) + " AS code, "
                + selectColumn(tensuAlias + "." + tensuNameColumn) + " AS name, "
                + selectColumn(tensuAlias + "." + tensuKanaColumn) + " AS kana, "
                + selectColumn(sortAlias + "." + sortColumn) + " AS kensaSort, "
                + selectColumn(tensuAlias + "." + tensuCategoryColumn) + " AS classification, "
                + selectColumn(tensuAlias + "." + tensuStartDateColumn) + " AS startDate, "
                + selectColumn(tensuAlias + "." + tensuEndDateColumn) + " AS endDate, "
                + versionSelect + " AS version "
                + query.whereClause
                + " ORDER BY " + order;
        List<OrcaMasterDao.KensaSortRecord> records = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            pagingSupport.bindParams(statement, query.params, 1);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    OrcaMasterDao.KensaSortRecord record = new OrcaMasterDao.KensaSortRecord();
                    record.kensaCode = rs.getString("code");
                    record.kensaName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.kensaSort = rs.getString("kensaSort");
                    record.classification = rs.getString("classification");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private String resolveVersionSelect(String sortAlias, String sortVersionColumn, String tensuAlias,
            String tensuVersionColumn) {
        String sortVersion = sortVersionColumn != null ? sortAlias + "." + sortVersionColumn : null;
        String tensuVersion = tensuVersionColumn != null ? tensuAlias + "." + tensuVersionColumn : null;
        if (sortVersion != null && tensuVersion != null) {
            return "COALESCE(" + sortVersion + ", " + tensuVersion + ")";
        }
        if (sortVersion != null) {
            return sortVersion;
        }
        if (tensuVersion != null) {
            return tensuVersion;
        }
        return "null";
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
