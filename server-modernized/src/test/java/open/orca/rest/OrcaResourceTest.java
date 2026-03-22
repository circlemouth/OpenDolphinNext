package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.KarteRevisionDocumentResponse;
import open.dolphin.rest.dto.LegacyKarteListResponse;
import open.dolphin.rest.support.LegacyOrcaResponseMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrcaResourceTest {

    private OrcaResource resource;
    private FakeDatabase database;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaResource();
        database = new FakeDatabase();
        injectField(resource, "orcaConnection", new FakeOrcaConnection(database.createConnection()));
        injectField(resource, "hospNum", 1);
        injectField(resource, "rpOut", true);
        injectField(resource, "DEBUG", false);
    }

    @Test
    void getStampUsesQueryDateAndMapsBundleResponse() {
        database.whenSqlContains("from tbl_inputset where hospnum=? and setcd=? order by setseq",
                params -> List.<Object[]>of(
                        row(".210", 0f, 2, "20240101", "20251231"),
                        row("616130532", 2f, 2, "20240101", "20251231"),
                        row("0010001", 0f, 2, "20240101", "20251231")));
        database.whenSqlContains("from tbl_tensu where hospnum=? and srycd=?",
                params -> {
                    String code = String.valueOf(params.get(2));
                    if ("616130532".equals(code)) {
                        return List.<Object[]>of(row("220", "アムロジピン", "錠", "1"));
                    }
                    if ("0010001".equals(code)) {
                        return List.<Object[]>of(row("220", "1日1回", "", ""));
                    }
                    return List.<Object[]>of();
                });

        LegacyKarteListResponse.ModuleListResponse response = resource.getStamp("P01001,降圧セット,2024-01-01", "2025-03-21");

        assertNotNull(response);
        assertNotNull(response.getList());
        assertEquals(1, response.getList().size());
        KarteRevisionDocumentResponse.ModuleResponse module = response.getList().get(0);
        assertEquals("降圧セット", module.getModuleInfoBean().getStampName());
        assertEquals("medOrder", module.getModuleInfoBean().getEntity());
        assertTrue(module.getBeanJson().contains("アムロジピン"));
        assertTrue(module.getBeanJson().contains("1日1回"));
        database.assertExecutedParameter("20250321");
    }

    @Test
    void getOrcaDiseaseMapsDiagnosisRows() {
        database.whenSqlContains("select ptid, ptnum from tbl_ptnum where hospnum=? and ptnum=?",
                params -> List.<Object[]>of(row("99", "00001")));
        database.whenSqlContains("from tbl_ptbyomei where hospnum=? and ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=?",
                params -> List.<Object[]>of(row("20240301", "D001", "1", "1", "3", "20240315", "感冒", "01")));

        LegacyOrcaResponseMapper.RegisteredDiagnosisListResponse response =
                resource.getOrcaDisease("00001", "2024-03-01", "2024-03-31", "false", "true");

        assertNotNull(response);
        assertNotNull(response.list());
        assertEquals(1, response.list().size());
        LegacyOrcaResponseMapper.RegisteredDiagnosisResponse diagnosis = response.list().get(0);
        assertEquals("感冒", diagnosis.diagnosis());
        assertEquals("D001", diagnosis.diagnosisCode());
        assertEquals("mainDiagnosis", diagnosis.diagnosisCategoryModel().diagnosisCategory());
        assertEquals("pause", diagnosis.diagnosisOutcomeModel().outcome());
        assertEquals("01", diagnosis.department());
        assertEquals("ORCA", diagnosis.status());
    }

    @Test
    void getOrcaDiseaseRoutesActiveOnlyToActiveQuery() {
        database.whenSqlContains("select ptid, ptnum from tbl_ptnum where hospnum=? and ptnum=?",
                params -> List.<Object[]>of(row("99", "00001")));
        database.whenSqlContains("from tbl_ptbyomei where hospnum=? and ptid=? and dltflg!=? order by sryymd desc",
                params -> List.<Object[]>of(row("20240201", "D002", "0", "0", "1", "20240210", "胃炎", "02")));

        LegacyOrcaResponseMapper.RegisteredDiagnosisListResponse response =
                resource.getOrcaDisease("00001", null, null, "true", "false");

        assertNotNull(response);
        assertEquals(1, response.list().size());
        assertEquals("胃炎", response.list().get(0).diagnosis());
        assertEquals("fullyRecovered", response.list().get(0).diagnosisOutcomeModel().outcome());
    }

    private static Object[] row(Object... values) {
        return values;
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class FakeOrcaConnection extends ORCAConnection {
        private final Connection connection;

        private FakeOrcaConnection(Connection connection) {
            this.connection = connection;
        }

        @Override
        public Connection getConnection() {
            return connection;
        }
    }

    private static final class FakeDatabase {
        private final Map<String, SqlHandler> handlers = new LinkedHashMap<>();
        private final List<Map<Integer, Object>> executed = new ArrayList<>();

        void whenSqlContains(String key, SqlHandler handler) {
            handlers.put(key, handler);
        }

        void assertExecutedParameter(String expectedValue) {
            assertTrue(executed.stream().flatMap(m -> m.values().stream()).map(String::valueOf).anyMatch(expectedValue::equals));
        }

        Connection createConnection() {
            InvocationHandler handler = (proxy, method, args) -> switch (method.getName()) {
                case "prepareStatement" -> createPreparedStatement(String.valueOf(args[0]));
                case "close" -> null;
                default -> defaultValue(method.getReturnType());
            };
            return (Connection) Proxy.newProxyInstance(getClass().getClassLoader(), new Class[]{Connection.class}, handler);
        }

        private PreparedStatement createPreparedStatement(String sql) {
            Map<Integer, Object> params = new HashMap<>();
            InvocationHandler handler = (proxy, method, args) -> {
                switch (method.getName()) {
                    case "setInt", "setString", "setFloat" -> {
                        params.put((Integer) args[0], args[1]);
                        return null;
                    }
                    case "executeQuery" -> {
                        executed.add(new LinkedHashMap<>(params));
                        for (Map.Entry<String, SqlHandler> entry : handlers.entrySet()) {
                            if (sql.contains(entry.getKey())) {
                                return createResultSet(entry.getValue().rows(params));
                            }
                        }
                        throw new SQLException("No handler for SQL: " + sql);
                    }
                    case "close" -> {
                        return null;
                    }
                    case "toString" -> {
                        return sql + " " + params;
                    }
                    default -> {
                        return defaultValue(method.getReturnType());
                    }
                }
            };
            return (PreparedStatement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class[]{PreparedStatement.class}, handler);
        }

        private ResultSet createResultSet(List<Object[]> rows) {
            InvocationHandler handler = new InvocationHandler() {
                private int index = -1;

                @Override
                public Object invoke(Object proxy, java.lang.reflect.Method method, Object[] args) {
                    return switch (method.getName()) {
                        case "next" -> ++index < rows.size();
                        case "getString" -> stringValue(rows.get(index)[((Integer) args[0]) - 1]);
                        case "getInt" -> intValue(rows.get(index)[((Integer) args[0]) - 1]);
                        case "getFloat" -> floatValue(rows.get(index)[((Integer) args[0]) - 1]);
                        case "close" -> null;
                        default -> defaultValue(method.getReturnType());
                    };
                }
            };
            return (ResultSet) Proxy.newProxyInstance(getClass().getClassLoader(), new Class[]{ResultSet.class}, handler);
        }

        private static String stringValue(Object value) {
            return value != null ? String.valueOf(value) : null;
        }

        private static int intValue(Object value) {
            return value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
        }

        private static float floatValue(Object value) {
            return value instanceof Number number ? number.floatValue() : Float.parseFloat(String.valueOf(value));
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
            if (returnType == float.class) {
                return 0f;
            }
            return null;
        }
    }

    @FunctionalInterface
    private interface SqlHandler {
        List<Object[]> rows(Map<Integer, Object> params) throws Exception;
    }
}
