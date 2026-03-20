package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OrcaMasterSchemaValidatorTest {

    @Test
    void validateOrThrow_acceptsSupportedSchema() {
        OrcaMasterSchemaValidator validator = new OrcaMasterSchemaValidator(fakeConnection(schema()));

        assertDoesNotThrow(validator::validateOrThrow);
    }

    @Test
    void validateOrThrow_rejectsMissingColumn() {
        Map<String, List<String>> schema = schema();
        schema.get("TBL_TENSU_MASTER").remove("upymd");
        OrcaMasterSchemaValidator validator = new OrcaMasterSchemaValidator(fakeConnection(schema));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("missing column TBL_TENSU_MASTER.upymd"));
    }

    @Test
    void validateOrThrow_rejectsMissingTable() {
        Map<String, List<String>> schema = schema();
        schema.remove("TBL_KENSASORT");
        OrcaMasterSchemaValidator validator = new OrcaMasterSchemaValidator(fakeConnection(schema));

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("missing table TBL_KENSASORT"));
    }

    @Test
    void validateOrThrow_wrapsConnectionFailure() {
        OrcaMasterSchemaValidator validator = new OrcaMasterSchemaValidator(new ORCAConnection(null) {
            @Override
            public Connection getConnection() throws SQLException {
                throw new SQLException("boom");
            }
        });

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        assertTrue(ex.getMessage().contains("boom"));
    }

    private static ORCAConnection fakeConnection(Map<String, List<String>> schema) {
        return new ORCAConnection(null) {
            @Override
            public Connection getConnection() {
                return connectionProxy(schema);
            }
        };
    }

    private static Connection connectionProxy(Map<String, List<String>> schema) {
        DatabaseMetaData metaData = metadataProxy(schema);
        return (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[] {Connection.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getMetaData" -> metaData;
                    case "close" -> null;
                    case "isClosed" -> false;
                    case "unwrap" -> null;
                    case "isWrapperFor" -> false;
                    default -> defaultValue(method.getReturnType());
                });
    }

    private static DatabaseMetaData metadataProxy(Map<String, List<String>> schema) {
        return (DatabaseMetaData) Proxy.newProxyInstance(
                DatabaseMetaData.class.getClassLoader(),
                new Class<?>[] {DatabaseMetaData.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getTables" -> tablesResultSet(schema);
                    case "getColumns" -> columnsResultSet(schema, (String) args[2]);
                    case "unwrap" -> null;
                    case "isWrapperFor" -> false;
                    default -> defaultValue(method.getReturnType());
                });
    }

    private static ResultSet tablesResultSet(Map<String, List<String>> schema) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (String table : schema.keySet()) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("TABLE_NAME", table);
            rows.add(row);
        }
        return resultSetProxy(rows);
    }

    private static ResultSet columnsResultSet(Map<String, List<String>> schema, String table) {
        List<Map<String, String>> rows = new ArrayList<>();
        List<String> columns = schema.getOrDefault(table, List.of());
        for (String column : columns) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("COLUMN_NAME", column);
            rows.add(row);
        }
        return resultSetProxy(rows);
    }

    private static ResultSet resultSetProxy(List<Map<String, String>> rows) {
        class Cursor {
            int index = -1;
        }
        Cursor cursor = new Cursor();
        return (ResultSet) Proxy.newProxyInstance(
                ResultSet.class.getClassLoader(),
                new Class<?>[] {ResultSet.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "next" -> {
                        cursor.index++;
                        yield cursor.index < rows.size();
                    }
                    case "getString" -> {
                        if (cursor.index < 0 || cursor.index >= rows.size()) {
                            throw new SQLException("Cursor out of bounds");
                        }
                        yield rows.get(cursor.index).get((String) args[0]);
                    }
                    case "close" -> null;
                    case "unwrap" -> null;
                    case "isWrapperFor" -> false;
                    default -> defaultValue(method.getReturnType());
                });
    }

    private static Object defaultValue(Class<?> returnType) {
        if (returnType == boolean.class) {
            return false;
        }
        if (returnType == int.class) {
            return 0;
        }
        if (returnType == long.class) {
            return 0L;
        }
        if (returnType == double.class) {
            return 0d;
        }
        if (returnType == float.class) {
            return 0f;
        }
        return null;
    }

    private static Map<String, List<String>> schema() {
        Map<String, List<String>> schema = new LinkedHashMap<>();
        schema.put("TBL_GENERIC_CLASS", new ArrayList<>(List.of(
                "class_code", "class_name", "kana_name", "category_code",
                "parent_class_code", "start_date", "end_date", "upymd")));
        schema.put("TBL_TENSU_MASTER", new ArrayList<>(List.of(
                "srycd", "name", "kananame", "srysyukbn",
                "taniname", "ten", "yakkakjncd", "yukostymd", "yukoedymd", "upymd")));
        schema.put("TBL_YOUHOU", new ArrayList<>(List.of(
                "youhoucode", "youhouname", "kana", "start_date", "end_date", "upymd")));
        schema.put("TBL_MATERIAL_H_M", new ArrayList<>(List.of(
                "material_code", "material_name", "kana_name", "category",
                "material_category", "unit", "price", "maker", "start_date", "end_date", "upymd")));
        schema.put("TBL_KENSASORT", new ArrayList<>(List.of(
                "kensa_code", "kensa_name", "kana_name", "kensa_sort",
                "classification", "start_date", "end_date", "upymd")));
        return schema;
    }
}
