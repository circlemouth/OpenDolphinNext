package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class OrcaMasterDrugQueryService {
    private final OrcaMasterQuerySupport querySupport;
    private final OrcaMasterPagingSupport pagingSupport;

    OrcaMasterDrugQueryService(OrcaMasterQuerySupport querySupport, OrcaMasterPagingSupport pagingSupport) {
        this.querySupport = querySupport;
        this.pagingSupport = pagingSupport;
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> searchDrug(Connection connection,
            OrcaMasterDao.DrugCriteria criteria, String tableName, String codeColumn, String nameColumn,
            String kanaColumn, String categoryColumn, String unitColumn, String priceColumn, String noteColumn,
            String startDateColumn, String endDateColumn, String versionColumn) throws SQLException {
        OrcaMasterQuerySupport.Query query = querySupport.buildDrugQuery(criteria, tableName, codeColumn, nameColumn,
                kanaColumn, startDateColumn, endDateColumn, criteria.getSearchMethod());
        Integer totalCount = maybeFetchTotalCount(connection, tableName, query, criteria.isIncludeTotalCount());
        if (Integer.valueOf(0).equals(totalCount)) {
            return new OrcaMasterDao.ListSearchResult<>(Collections.emptyList(), totalCount, null);
        }
        List<OrcaMasterDao.DrugRecord> records = fetchDrugRecords(connection, query, criteria.getPage(), criteria.getSize(),
                codeColumn, nameColumn, kanaColumn, categoryColumn, unitColumn, priceColumn, noteColumn,
                startDateColumn, endDateColumn, versionColumn);
        return new OrcaMasterDao.ListSearchResult<>(records, totalCount, resolveVersion(records, null));
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchComment(Connection connection,
            OrcaMasterDao.CommentCriteria criteria, String tableName, String codeColumn, String nameColumn,
            String kanaColumn, String categoryColumn, String unitColumn, String startDateColumn, String endDateColumn,
            String versionColumn, boolean bodypartOnly) throws SQLException {
        OrcaMasterQuerySupport.Query query = bodypartOnly
                ? querySupport.buildBodypartQuery(criteria, tableName, codeColumn, nameColumn, kanaColumn,
                startDateColumn, endDateColumn)
                : querySupport.buildCommentQuery(criteria, tableName, codeColumn, nameColumn, kanaColumn,
                startDateColumn, endDateColumn);
        Integer totalCount = maybeFetchTotalCount(connection, tableName, query, criteria.isIncludeTotalCount());
        if (Integer.valueOf(0).equals(totalCount)) {
            return new OrcaMasterDao.ListSearchResult<>(Collections.emptyList(), totalCount, null);
        }
        List<OrcaMasterDao.CommentRecord> records = fetchCommentRecords(connection, query, criteria.getPage(),
                criteria.getSize(), codeColumn, nameColumn, kanaColumn, categoryColumn, unitColumn, startDateColumn,
                endDateColumn, versionColumn);
        return new OrcaMasterDao.ListSearchResult<>(records, totalCount, resolveVersion(records, null));
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.MaterialRecord> searchMaterial(Connection connection,
            OrcaMasterDao.MaterialCriteria criteria, String tableName, String codeColumn, String nameColumn,
            String kanaColumn, String categoryColumn, String unitColumn, String priceColumn, String makerColumn,
            String startDateColumn, String endDateColumn, String versionColumn) throws SQLException {
        OrcaMasterQuerySupport.Query query = querySupport.buildMaterialQuery(criteria, tableName, codeColumn, nameColumn,
                kanaColumn, startDateColumn, endDateColumn);
        List<OrcaMasterDao.MaterialRecord> records = fetchMaterialRecordsFromTensu(connection, query, codeColumn,
                nameColumn, kanaColumn, categoryColumn, unitColumn, priceColumn, makerColumn, startDateColumn,
                endDateColumn, versionColumn);
        return new OrcaMasterDao.ListSearchResult<>(records, records.size(), resolveVersion(records, null));
    }

    private Integer maybeFetchTotalCount(Connection connection, String tableName, OrcaMasterQuerySupport.Query query,
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

    private List<OrcaMasterDao.DrugRecord> fetchDrugRecords(Connection connection, OrcaMasterQuerySupport.Query query,
            int page, int size, String codeColumn, String nameColumn, String kanaColumn, String categoryColumn,
            String unitColumn, String priceColumn, String noteColumn, String startDateColumn, String endDateColumn,
            String versionColumn) throws SQLException {
        String sql = "SELECT "
                + selectColumn(codeColumn) + " AS code, "
                + selectColumn(nameColumn) + " AS name, "
                + selectColumn(kanaColumn) + " AS kana, "
                + selectColumn(categoryColumn) + " AS category, "
                + selectColumn(unitColumn) + " AS unit, "
                + selectColumn(priceColumn) + " AS price, "
                + selectColumn(noteColumn) + " AS note, "
                + selectColumn(startDateColumn) + " AS startDate, "
                + selectColumn(endDateColumn) + " AS endDate, "
                + selectColumn(versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + codeColumn + ", " + startDateColumn + " DESC";
        sql = pagingSupport.applyPaging(sql);
        List<OrcaMasterDao.DrugRecord> records = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int index = pagingSupport.bindParams(statement, query.params, 1);
            pagingSupport.applyPagingParams(statement, index, page, size);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    OrcaMasterDao.DrugRecord record = new OrcaMasterDao.DrugRecord();
                    record.srycd = rs.getString("code");
                    record.drugName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.category = rs.getString("category");
                    record.unit = rs.getString("unit");
                    record.price = getDouble(rs, "price");
                    record.note = rs.getString("note");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<OrcaMasterDao.CommentRecord> fetchCommentRecords(Connection connection, OrcaMasterQuerySupport.Query query,
            int page, int size, String codeColumn, String nameColumn, String kanaColumn, String categoryColumn,
            String unitColumn, String startDateColumn, String endDateColumn, String versionColumn) throws SQLException {
        String sql = "SELECT "
                + selectColumn(codeColumn) + " AS code, "
                + selectColumn(nameColumn) + " AS name, "
                + selectColumn(kanaColumn) + " AS kana, "
                + selectColumn(categoryColumn) + " AS category, "
                + selectColumn(unitColumn) + " AS unit, "
                + selectColumn(startDateColumn) + " AS startDate, "
                + selectColumn(endDateColumn) + " AS endDate, "
                + selectColumn(versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + codeColumn + ", " + startDateColumn + " DESC";
        sql = pagingSupport.applyPaging(sql);
        List<OrcaMasterDao.CommentRecord> records = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int index = pagingSupport.bindParams(statement, query.params, 1);
            pagingSupport.applyPagingParams(statement, index, page, size);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    OrcaMasterDao.CommentRecord record = new OrcaMasterDao.CommentRecord();
                    record.tensuCode = rs.getString("code");
                    record.name = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.category = rs.getString("category");
                    record.unit = rs.getString("unit");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<OrcaMasterDao.MaterialRecord> fetchMaterialRecordsFromTensu(Connection connection,
            OrcaMasterQuerySupport.Query query, String codeColumn, String nameColumn, String kanaColumn,
            String categoryColumn, String unitColumn, String priceColumn, String makerColumn, String startDateColumn,
            String endDateColumn, String versionColumn) throws SQLException {
        String sql = "SELECT "
                + selectColumn(codeColumn) + " AS code, "
                + selectColumn(nameColumn) + " AS name, "
                + selectColumn(kanaColumn) + " AS kana, "
                + selectColumn(categoryColumn) + " AS category, "
                + selectColumn(unitColumn) + " AS unit, "
                + selectColumn(priceColumn) + " AS price, "
                + selectColumn(makerColumn) + " AS maker, "
                + selectColumn(startDateColumn) + " AS startDate, "
                + selectColumn(endDateColumn) + " AS endDate, "
                + selectColumn(versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + codeColumn + ", " + startDateColumn + " DESC";
        List<OrcaMasterDao.MaterialRecord> records = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            pagingSupport.bindParams(statement, query.params, 1);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    OrcaMasterDao.MaterialRecord record = new OrcaMasterDao.MaterialRecord();
                    record.materialCode = rs.getString("code");
                    record.materialName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.category = rs.getString("category");
                    record.materialCategory = rs.getString("category");
                    record.unit = rs.getString("unit");
                    record.price = getDouble(rs, "price");
                    record.maker = rs.getString("maker");
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

    private static Double getDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }
}
