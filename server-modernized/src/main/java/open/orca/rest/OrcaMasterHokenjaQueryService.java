package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class OrcaMasterHokenjaQueryService {
    private final OrcaMasterQuerySupport querySupport;
    private final OrcaMasterPagingSupport pagingSupport;

    OrcaMasterHokenjaQueryService(OrcaMasterQuerySupport querySupport, OrcaMasterPagingSupport pagingSupport) {
        this.querySupport = querySupport;
        this.pagingSupport = pagingSupport;
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.HokenjaRecord> searchHokenja(
            Connection connection,
            OrcaMasterDao.HokenjaCriteria criteria,
            OrcaMasterDaoTableMeta.HokenjaTableMeta meta) throws SQLException {
        OrcaMasterQuerySupport.Query query = buildQuery(criteria, meta);
        Integer totalCount = maybeFetchTotalCount(connection, query, criteria.isIncludeTotalCount());
        if (Integer.valueOf(0).equals(totalCount)) {
            return new OrcaMasterDao.ListSearchResult<>(List.of(), totalCount, null);
        }
        List<OrcaMasterDao.HokenjaRecord> records = fetchRecords(connection, query, criteria.getPage(), criteria.getSize(), meta);
        String version = records.stream()
                .map(OrcaMasterDao.HokenjaRecord::getVersion)
                .filter(value -> value != null && !value.isBlank())
                .max(String::compareTo)
                .orElse(null);
        return new OrcaMasterDao.ListSearchResult<>(records, totalCount, version);
    }

    private OrcaMasterQuerySupport.Query buildQuery(OrcaMasterDao.HokenjaCriteria criteria,
            OrcaMasterDaoTableMeta.HokenjaTableMeta meta) {
        StringBuilder where = new StringBuilder(" FROM ").append(meta.tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (criteria.getPref() != null && !criteria.getPref().isBlank()) {
            where.append(" AND CAST(").append(meta.insurerNumberColumn).append(" AS VARCHAR) LIKE ?");
            params.add(criteria.getPref().trim() + "%");
        }
        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, criteria.getKeyword(), null,
                meta.insurerNumberColumn, meta.nameColumn, meta.kana1Column, meta.addressColumn, meta.addressLineColumn);
        return new OrcaMasterQuerySupport.Query(where.toString(), params);
    }

    private Integer maybeFetchTotalCount(Connection connection, OrcaMasterQuerySupport.Query query,
            boolean includeTotalCount) throws SQLException {
        if (!includeTotalCount) {
            return null;
        }
        try (PreparedStatement statement = connection.prepareStatement("SELECT count(*)" + query.whereClause)) {
            pagingSupport.bindParams(statement, query.params, 1);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    private List<OrcaMasterDao.HokenjaRecord> fetchRecords(Connection connection, OrcaMasterQuerySupport.Query query,
            int page, int size, OrcaMasterDaoTableMeta.HokenjaTableMeta meta) throws SQLException {
        String sql = "SELECT "
                + meta.insurerNumberColumn + " AS payerCode, "
                + meta.nameColumn + " AS payerName, "
                + selectColumn(meta.hknnumColumn) + " AS payerType, "
                + selectColumn(meta.ratioColumn) + " AS payerRatio, "
                + selectColumn(meta.zipColumn) + " AS zip, "
                + selectColumn(meta.addressColumn) + " AS address, "
                + selectColumn(meta.addressLineColumn) + " AS addressLine, "
                + selectColumn(meta.phoneColumn) + " AS phone, "
                + selectColumn(meta.createdDateColumn) + " AS validFrom, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.insurerNumberColumn;
        sql = pagingSupport.applyPaging(sql);
        List<OrcaMasterDao.HokenjaRecord> records = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int index = pagingSupport.bindParams(statement, query.params, 1);
            pagingSupport.applyPagingParams(statement, index, page, size);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    OrcaMasterDao.HokenjaRecord record = new OrcaMasterDao.HokenjaRecord();
                    record.payerCode = rs.getString("payerCode");
                    record.payerName = rs.getString("payerName");
                    record.payerType = rs.getString("payerType");
                    short ratio = rs.getShort("payerRatio");
                    record.payerRatio = rs.wasNull() ? null : ratio / 100d;
                    record.prefCode = derivePrefCode(record.payerCode);
                    record.cityCode = deriveCityCode(record.prefCode);
                    record.zip = rs.getString("zip");
                    record.addressLine = joinNonBlank(rs.getString("address"), rs.getString("addressLine"));
                    record.phone = rs.getString("phone");
                    record.validFrom = rs.getString("validFrom");
                    record.validTo = OrcaMasterService.DEFAULT_VALID_TO;
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private static String derivePrefCode(String payerCode) {
        return payerCode != null && payerCode.length() >= 2 ? payerCode.substring(0, 2) : null;
    }

    private static String deriveCityCode(String prefCode) {
        return prefCode != null && !prefCode.isBlank() ? prefCode + "000" : null;
    }

    private static String selectColumn(String column) {
        return column != null ? column : "null";
    }

    private static String joinNonBlank(String left, String right) {
        String first = left != null && !left.isBlank() ? left.trim() : null;
        String second = right != null && !right.isBlank() ? right.trim() : null;
        if (first == null) {
            return second;
        }
        if (second == null) {
            return first;
        }
        return first + second;
    }
}
