package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

class OrcaMasterKensaSortQueryService {
    private static final KensaSortQueryShape KENSA_SORT_QUERY_SHAPE = KensaSortQueryShape.SUPPORTED_CONTRACT;
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
        KensaSortQueryShape queryShape = KENSA_SORT_QUERY_SHAPE.validate(sortTableName, sortCodeColumn, sortColumn,
                sortVersionColumn, tensuTableName, tensuCodeColumn, tensuNameColumn, tensuKanaColumn,
                tensuCategoryColumn, tensuStartDateColumn, tensuEndDateColumn, tensuVersionColumn);
        OrcaMasterQuerySupport.Query query = querySupport.buildKensaSortJoinQuery(criteria, queryShape.sortTableName,
                queryShape.sortCodeColumn, queryShape.sortColumn, queryShape.tensuTableName, queryShape.tensuCodeColumn,
                queryShape.tensuNameColumn, queryShape.tensuKanaColumn, queryShape.tensuStartDateColumn,
                queryShape.tensuEndDateColumn);
        List<OrcaMasterDao.KensaSortRecord> records = fetchKensaSortRecordsFromTensu(connection, query, queryShape);
        return new OrcaMasterDao.ListSearchResult<>(records, records.size(), resolveVersion(records, null));
    }

    private List<OrcaMasterDao.KensaSortRecord> fetchKensaSortRecordsFromTensu(Connection connection,
            OrcaMasterQuerySupport.Query query, KensaSortQueryShape queryShape) throws SQLException {
        String sql = queryShape.selectClause + query.whereClause + queryShape.orderClause;
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

    private enum KensaSortQueryShape {
        SUPPORTED_CONTRACT(
                "TBL_KENSASORT",
                "kensa_code",
                "kensa_sort",
                "upymd",
                "TBL_TENSU_MASTER",
                "srycd",
                "name",
                "kana_name",
                "classification",
                "start_date",
                "end_date",
                "upymd",
                "SELECT DISTINCT ON (k.kensa_code) k.kensa_code AS code, "
                        + "t.name AS name, "
                        + "t.kana_name AS kana, "
                        + "k.kensa_sort AS kensaSort, "
                        + "t.classification AS classification, "
                        + "t.start_date AS startDate, "
                        + "t.end_date AS endDate, "
                        + "COALESCE(k.upymd, t.upymd) AS version ",
                " ORDER BY k.kensa_code, t.start_date DESC, t.end_date DESC");

        private final String sortTableName;
        private final String sortCodeColumn;
        private final String sortColumn;
        private final String sortVersionColumn;
        private final String tensuTableName;
        private final String tensuCodeColumn;
        private final String tensuNameColumn;
        private final String tensuKanaColumn;
        private final String tensuCategoryColumn;
        private final String tensuStartDateColumn;
        private final String tensuEndDateColumn;
        private final String tensuVersionColumn;
        private final String selectClause;
        private final String orderClause;

        KensaSortQueryShape(String sortTableName, String sortCodeColumn, String sortColumn, String sortVersionColumn,
                String tensuTableName, String tensuCodeColumn, String tensuNameColumn, String tensuKanaColumn,
                String tensuCategoryColumn, String tensuStartDateColumn, String tensuEndDateColumn,
                String tensuVersionColumn, String selectClause, String orderClause) {
            this.sortTableName = sortTableName;
            this.sortCodeColumn = sortCodeColumn;
            this.sortColumn = sortColumn;
            this.sortVersionColumn = sortVersionColumn;
            this.tensuTableName = tensuTableName;
            this.tensuCodeColumn = tensuCodeColumn;
            this.tensuNameColumn = tensuNameColumn;
            this.tensuKanaColumn = tensuKanaColumn;
            this.tensuCategoryColumn = tensuCategoryColumn;
            this.tensuStartDateColumn = tensuStartDateColumn;
            this.tensuEndDateColumn = tensuEndDateColumn;
            this.tensuVersionColumn = tensuVersionColumn;
            this.selectClause = selectClause;
            this.orderClause = orderClause;
        }

        KensaSortQueryShape validate(String sortTableName, String sortCodeColumn, String sortColumn,
                String sortVersionColumn, String tensuTableName, String tensuCodeColumn, String tensuNameColumn,
                String tensuKanaColumn, String tensuCategoryColumn, String tensuStartDateColumn,
                String tensuEndDateColumn, String tensuVersionColumn) throws SQLException {
            if (this.sortTableName.equals(sortTableName) && this.sortCodeColumn.equals(sortCodeColumn)
                    && this.sortColumn.equals(sortColumn) && this.sortVersionColumn.equals(sortVersionColumn)
                    && this.tensuTableName.equals(tensuTableName) && this.tensuCodeColumn.equals(tensuCodeColumn)
                    && this.tensuNameColumn.equals(tensuNameColumn) && this.tensuKanaColumn.equals(tensuKanaColumn)
                    && this.tensuCategoryColumn.equals(tensuCategoryColumn)
                    && this.tensuStartDateColumn.equals(tensuStartDateColumn)
                    && this.tensuEndDateColumn.equals(tensuEndDateColumn)
                    && this.tensuVersionColumn.equals(tensuVersionColumn)) {
                return this;
            }
            throw new SQLException("Unsupported Kensa sort master schema");
        }
    }
}
