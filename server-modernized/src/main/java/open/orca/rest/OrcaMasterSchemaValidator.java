package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Startup validation for the supported ORCA master schema contract.
 */
@ApplicationScoped
public class OrcaMasterSchemaValidator {

    private final ORCAConnection orcaConnection;

    public OrcaMasterSchemaValidator() {
        this(null);
    }

    @Inject
    OrcaMasterSchemaValidator(ORCAConnection orcaConnection) {
        this.orcaConnection = orcaConnection;
    }

    public void validateOrThrow() {
        if (orcaConnection == null) {
            throw new IllegalStateException("ORCA master schema validation failed: ORCAConnection is not configured");
        }
        try (Connection connection = orcaConnection.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            Map<String, String> tables = loadTables(metaData);
            List<String> errors = new ArrayList<>();
            for (SchemaTable table : supportedTables()) {
                String actualTable = tables.get(normalize(table.name));
                if (actualTable == null) {
                    errors.add("missing table " + table.name);
                    continue;
                }
                Set<String> columns = loadColumns(metaData, actualTable);
                for (String column : table.requiredColumns) {
                    if (!columns.contains(normalize(column))) {
                        errors.add("missing column " + table.name + "." + column);
                    }
                }
                for (List<String> alternatives : table.requiredAlternatives) {
                    boolean matched = alternatives.stream().anyMatch(column -> columns.contains(normalize(column)));
                    if (!matched) {
                        errors.add("missing required alternative column " + table.name + "."
                                + String.join("|", alternatives));
                    }
                }
            }
            if (!errors.isEmpty()) {
                throw new IllegalStateException("ORCA master schema validation failed: " + String.join(" | ", errors));
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("ORCA master schema validation failed: " + ex.getMessage(), ex);
        }
    }

    private static Map<String, String> loadTables(DatabaseMetaData metaData) throws SQLException {
        Map<String, String> tables = new LinkedHashMap<>();
        try (ResultSet rs = metaData.getTables(null, null, "%", new String[] {"TABLE", "VIEW"})) {
            while (rs.next()) {
                String table = rs.getString("TABLE_NAME");
                if (table != null && !table.isBlank()) {
                    tables.put(normalize(table), table);
                }
            }
        }
        return tables;
    }

    private static Set<String> loadColumns(DatabaseMetaData metaData, String table) throws SQLException {
        Set<String> columns = new LinkedHashSet<>();
        try (ResultSet rs = metaData.getColumns(null, null, table, "%")) {
            while (rs.next()) {
                String column = rs.getString("COLUMN_NAME");
                if (column != null && !column.isBlank()) {
                    columns.add(normalize(column));
                }
            }
        }
        return columns;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static List<SchemaTable> supportedTables() {
        return List.of(
                new SchemaTable("TBL_GENERIC_CLASS", List.of(
                        "class_code", "class_name", "kana_name", "category_code",
                        "parent_class_code", "start_date", "end_date", "upymd"), List.of()),
                new SchemaTable("TBL_GENERIC_PRICE", List.of(
                        "price", "upymd"), List.of(
                        List.of("srycd", "yakkakjncd"),
                        List.of("start_date", "yukostymd"),
                        List.of("end_date", "yukoedymd"))),
                new SchemaTable("TBL_TENSU_MASTER", List.of(
                        "srycd", "name", "kananame", "srysyukbn",
                        "taniname", "ten", "yakkakjncd", "yukostymd", "yukoedymd", "upymd"), List.of()),
                new SchemaTable("TBL_HKNJAINF_MASTER", List.of(
                        "hknjanum", "hknjaname", "post", "adrs", "banti", "tel", "upymd"), List.of()),
                new SchemaTable("TBL_ADRS", List.of(
                        "post", "prefname", "cityname", "townname", "prefkana", "citykana", "townkana", "editadrs_name"),
                        List.of()),
                new SchemaTable("TBL_YOUHOU", List.of(
                        "youhoucode", "youhouname", "kana", "start_date", "end_date", "upymd"), List.of()),
                new SchemaTable("TBL_MATERIAL_H_M", List.of(
                        "material_code", "material_name", "kana_name", "category",
                        "material_category", "unit", "price", "maker", "start_date", "end_date", "upymd"), List.of()),
                new SchemaTable("TBL_KENSASORT", List.of(
                        "kensa_code", "kensa_name", "kana_name", "kensa_sort",
                        "classification", "start_date", "end_date", "upymd"), List.of())
        );
    }

    private record SchemaTable(String name, List<String> requiredColumns, List<List<String>> requiredAlternatives) {
    }
}
