package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

final class OrcaMasterGenericPriceQueryService {

    OrcaMasterDao.LookupResult<OrcaMasterDao.GenericPriceRecord> findGenericPrice(
            Connection connection,
            OrcaMasterDao.GenericPriceCriteria criteria,
            OrcaMasterDaoTableMeta.GenericPriceTableMeta meta) throws SQLException {
        Set<String> columns = loadColumns(connection, meta.tableName);
        String codeColumn = firstAvailable(columns, meta.lookupCodeCandidates);
        if (codeColumn == null) {
            throw new SQLException("Generic price lookup column is not available in " + meta.tableName);
        }
        String startDateColumn = firstAvailable(columns, meta.startDateCandidates);
        String endDateColumn = firstAvailable(columns, meta.endDateCandidates);
        String nameColumn = firstAvailable(columns, meta.nameCandidates);
        String unitColumn = firstAvailable(columns, meta.unitCandidates);
        String versionColumn = firstAvailable(columns, meta.versionCandidates);

        StringBuilder sql = new StringBuilder("SELECT ")
                .append(codeColumn).append(" AS code, ")
                .append(selectColumn(nameColumn)).append(" AS name, ")
                .append(selectColumn(unitColumn)).append(" AS unit, ")
                .append(meta.priceColumn).append(" AS price, ")
                .append(selectColumn(startDateColumn)).append(" AS startDate, ")
                .append(selectColumn(endDateColumn)).append(" AS endDate, ")
                .append(selectColumn(versionColumn)).append(" AS version ")
                .append("FROM ").append(meta.tableName)
                .append(" WHERE ").append(codeColumn).append(" = ?");
        boolean useEffective = criteria.getEffective() != null && !criteria.getEffective().isBlank()
                && startDateColumn != null && endDateColumn != null;
        if (useEffective) {
            sql.append(" AND ").append(startDateColumn).append(" <= ? AND ").append(endDateColumn).append(" >= ?");
        }
        sql.append(" ORDER BY ")
                .append(startDateColumn != null ? startDateColumn : codeColumn)
                .append(" DESC");

        try (PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            statement.setString(1, criteria.getSrycd());
            if (useEffective) {
                statement.setString(2, criteria.getEffective());
                statement.setString(3, criteria.getEffective());
            }
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return new OrcaMasterDao.LookupResult<>(null, null, false);
                }
                OrcaMasterDao.GenericPriceRecord record = new OrcaMasterDao.GenericPriceRecord();
                record.srycd = rs.getString("code");
                record.drugName = rs.getString("name");
                record.unit = rs.getString("unit");
                double price = rs.getDouble("price");
                record.price = rs.wasNull() ? null : price;
                record.startDate = rs.getString("startDate");
                record.endDate = rs.getString("endDate");
                record.version = rs.getString("version");
                return new OrcaMasterDao.LookupResult<>(record, record.version, true);
            }
        }
    }

    private static Set<String> loadColumns(Connection connection, String tableName) throws SQLException {
        Set<String> columns = new LinkedHashSet<>();
        try (ResultSet rs = connection.getMetaData().getColumns(null, null, tableName, "%")) {
            while (rs.next()) {
                String column = rs.getString("COLUMN_NAME");
                if (column != null && !column.isBlank()) {
                    columns.add(column.trim().toUpperCase(Locale.ROOT));
                }
            }
        }
        return columns;
    }

    private static String firstAvailable(Set<String> actualColumns, java.util.List<String> candidates) {
        if (actualColumns == null || candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate != null && actualColumns.contains(candidate.toUpperCase(Locale.ROOT))) {
                return candidate;
            }
        }
        return null;
    }

    private static String selectColumn(String column) {
        return column != null ? column : "null";
    }
}
