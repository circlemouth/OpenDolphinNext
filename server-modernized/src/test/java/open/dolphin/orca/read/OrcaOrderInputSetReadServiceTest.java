package open.dolphin.orca.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.orca.rest.ORCAConnection;
import org.junit.jupiter.api.Test;

class OrcaOrderInputSetReadServiceTest {

    @Test
    void loadInputSetDetailSplitsMainMaterialAndCommentRows() throws Exception {
        OrcaOrderInputSetReadService service = new OrcaOrderInputSetReadService(buildConnection());

        OrcaOrderInputSetDetailResponse.Bundle bundle = service.loadInputSetDetail(
                "S60001",
                "20260309",
                "bacteria-set",
                "002",
                "Claim007",
                classCode -> new OrcaOrderInputSetReadService.ClassMetadata("testOrder", "Test"));

        assertNotNull(bundle);
        assertEquals("600", bundle.getClassCode());
        assertEquals("testOrder", bundle.getEntity());
        assertEquals(1, bundle.getItems().size());
        assertEquals(1, bundle.getMaterialItems().size());
        assertEquals(1, bundle.getCommentItems().size());
        assertEquals("160000010", bundle.getItems().get(0).getCode());
        assertEquals("main", bundle.getItems().get(0).getRowRole());
        assertEquals("700000031", bundle.getMaterialItems().get(0).getCode());
        assertEquals("material", bundle.getMaterialItems().get(0).getRowRole());
        assertEquals("0085001", bundle.getCommentItems().get(0).getCode());
        assertEquals("comment", bundle.getCommentItems().get(0).getRowRole());
    }

    private static ORCAConnection buildConnection() {
        Connection connection = (Connection) Proxy.newProxyInstance(
                OrcaOrderInputSetReadServiceTest.class.getClassLoader(),
                new Class[]{Connection.class},
                (proxy, method, args) -> {
                    if ("prepareStatement".equals(method.getName())) {
                        String sql = String.valueOf(args[0]);
                        return buildPreparedStatement(sql);
                    }
                    return defaultValue(method.getReturnType());
                });
        return new ORCAConnection() {
            @Override
            public Connection getConnection() {
                return connection;
            }
        };
    }

    private static PreparedStatement buildPreparedStatement(String sql) {
        java.util.Map<Integer, String> params = new java.util.HashMap<>();
        return (PreparedStatement) Proxy.newProxyInstance(
                OrcaOrderInputSetReadServiceTest.class.getClassLoader(),
                new Class[]{PreparedStatement.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "setString" -> {
                            params.put((Integer) args[0], (String) args[1]);
                            return null;
                        }
                        case "executeQuery" -> {
                            return buildResultSet(sql, params);
                        }
                        default -> {
                            return defaultValue(method.getReturnType());
                        }
                    }
                });
    }

    private static ResultSet buildResultSet(String sql, Map<Integer, String> params) {
        List<Map<String, String>> rows;
        if (sql.contains("FROM tbl_inputset")) {
            rows = List.of(
                    Map.of("inputcd", ".600", "suryo1", "", "kaisu", "6"),
                    Map.of("inputcd", "160000010", "suryo1", "1.0", "kaisu", "6"),
                    Map.of("inputcd", "700000031", "suryo1", "1.0", "kaisu", "6"),
                    Map.of("inputcd", "0085001", "suryo1", "", "kaisu", "6"));
        } else if (sql.contains("FROM tbl_tensu")) {
            String code = params.get(1);
            rows = switch (code) {
                case "160000010" -> List.of(Map.of("name", "LAB_MAIN", "taniname", "count"));
                case "700000031" -> List.of(Map.of("name", "MATERIAL", "taniname", "set"));
                case "0085001" -> List.of(Map.of("name", "COMMENT", "taniname", ""));
                default -> List.of();
            };
        } else {
            rows = List.of();
        }

        final int[] index = {-1};
        return (ResultSet) Proxy.newProxyInstance(
                OrcaOrderInputSetReadServiceTest.class.getClassLoader(),
                new Class[]{ResultSet.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "next" -> {
                            index[0] += 1;
                            return index[0] < rows.size();
                        }
                        case "getString" -> {
                            if (index[0] < 0 || index[0] >= rows.size()) {
                                return null;
                            }
                            Map<String, String> row = rows.get(index[0]);
                            Object key = args[0];
                            if (key instanceof Integer column) {
                                return switch (column.intValue()) {
                                    case 1 -> row.get("inputcd") != null ? row.get("inputcd") : row.get("name");
                                    case 2 -> row.get("suryo1") != null ? row.get("suryo1") : row.get("taniname");
                                    case 3 -> row.get("kaisu");
                                    default -> null;
                                };
                            }
                            return row.get(String.valueOf(key));
                        }
                        default -> {
                            return defaultValue(method.getReturnType());
                        }
                    }
                });
    }

    private static Object defaultValue(Class<?> returnType) {
        if (returnType == null || !returnType.isPrimitive()) {
            return null;
        }
        if (boolean.class.equals(returnType)) {
            return false;
        }
        if (byte.class.equals(returnType)) {
            return (byte) 0;
        }
        if (short.class.equals(returnType)) {
            return (short) 0;
        }
        if (int.class.equals(returnType)) {
            return 0;
        }
        if (long.class.equals(returnType)) {
            return 0L;
        }
        if (float.class.equals(returnType)) {
            return 0f;
        }
        if (double.class.equals(returnType)) {
            return 0d;
        }
        if (char.class.equals(returnType)) {
            return '\0';
        }
        return null;
    }
}
