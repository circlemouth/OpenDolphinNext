package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import open.dolphin.orca.read.OrcaLiveDiseaseMasterReadService;
import open.orca.rest.ORCAConnection;
import org.junit.jupiter.api.Test;

class OrcaLiveDiseaseMasterReadServiceTest {

    @Test
    void queryEntries_returnsMappedDiseaseRows() throws Exception {
        ORCAConnection orcaConnection = mock(ORCAConnection.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(orcaConnection.getConnection()).thenReturn(connection);
        when(connection.prepareStatement("select byomeicd, byomei, haisiymd from tbl_byomei where byomei = ? and haisiymd >= ?"))
                .thenReturn(statement);
        when(statement.executeQuery()).thenReturn(resultSet);
        when(resultSet.next()).thenReturn(true, false);
        when(resultSet.getString(1)).thenReturn("D001");
        when(resultSet.getString(2)).thenReturn("感冒");
        when(resultSet.getString(3)).thenReturn("99999999");

        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(orcaConnection);
        List<Map<String, Object>> rows = service.queryEntries("感冒", "20260401", false);

        assertEquals(1, rows.size());
        assertEquals("D001", rows.get(0).get("code"));
        assertEquals("感冒", rows.get(0).get("name"));
        assertEquals("99999999", rows.get(0).get("disUseDate"));
        assertEquals("candidate", rows.get(0).get("layer"));
        assertEquals(true, rows.get(0).get("readOnly"));
        assertEquals(true, rows.get(0).get("candidateOnly"));
    }

    @Test
    void queryEntries_returnsEmptyListWhenBackendFails() throws Exception {
        ORCAConnection orcaConnection = mock(ORCAConnection.class);
        when(orcaConnection.getConnection()).thenThrow(new java.sql.SQLException("down"));

        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(orcaConnection);

        assertTrue(service.queryEntries("感冒", "20260401", false).isEmpty());
    }
}
