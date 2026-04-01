package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

final class OrcaMasterAddressQueryService {

    OrcaMasterDao.LookupResult<OrcaMasterDao.AddressRecord> findAddress(
            Connection connection,
            OrcaMasterDao.AddressCriteria criteria,
            OrcaMasterDaoTableMeta.AddressTableMeta meta) throws SQLException {
        Set<String> columns = loadColumns(connection, meta.tableName);
        String zipColumn = firstAvailable(columns, meta.zipCandidates);
        if (zipColumn == null) {
            throw new SQLException("Address zip lookup column is not available in " + meta.tableName);
        }
        String prefCodeColumn = firstAvailable(columns, meta.prefCodeCandidates);
        String cityCodeColumn = firstAvailable(columns, meta.cityCodeCandidates);
        String cityColumn = firstAvailable(columns, meta.cityCandidates);
        String townColumn = firstAvailable(columns, meta.townCandidates);
        String kanaColumn = firstAvailable(columns, meta.kanaCandidates);
        String romanColumn = firstAvailable(columns, meta.romanCandidates);
        String fullAddressColumn = firstAvailable(columns, meta.fullAddressCandidates);
        String versionColumn = firstAvailable(columns, meta.versionCandidates);
        String orderColumn = firstAvailable(columns, meta.orderCandidates);

        String sql = "SELECT "
                + zipColumn + " AS zip, "
                + selectColumn(prefCodeColumn) + " AS prefCode, "
                + selectColumn(cityCodeColumn) + " AS cityCode, "
                + selectColumn(cityColumn) + " AS city, "
                + selectColumn(townColumn) + " AS town, "
                + selectColumn(kanaColumn) + " AS kana, "
                + selectColumn(romanColumn) + " AS roman, "
                + selectColumn(fullAddressColumn) + " AS fullAddress, "
                + selectColumn(versionColumn) + " AS version "
                + "FROM " + meta.tableName
                + " WHERE " + zipColumn + " = ?"
                + " ORDER BY " + (orderColumn != null ? orderColumn : zipColumn);

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, criteria.getZip());
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return new OrcaMasterDao.LookupResult<>(null, null, false);
                }
                OrcaMasterDao.AddressRecord record = new OrcaMasterDao.AddressRecord();
                record.zip = rs.getString("zip");
                record.prefCode = rs.getString("prefCode");
                record.cityCode = rs.getString("cityCode");
                record.city = rs.getString("city");
                record.town = rs.getString("town");
                record.kana = rs.getString("kana");
                record.roman = rs.getString("roman");
                record.fullAddress = rs.getString("fullAddress");
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
