package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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
        when(connection.prepareStatement(
                "select byomeicd, byomei, byomeikana, icd10_1, haisiymd from tbl_byomei "
                        + "where (byomei = ? or byomeikana = ?) "
                        + "and (haisiymd is null or haisiymd = '' or haisiymd = '00000000' or haisiymd >= ?) "
                        + "order by byomei limit ?"))
                .thenReturn(statement);
        when(statement.executeQuery()).thenReturn(resultSet);
        when(resultSet.next()).thenReturn(true, false);
        when(resultSet.getString(1)).thenReturn("D001");
        when(resultSet.getString(2)).thenReturn("感冒");
        when(resultSet.getString(3)).thenReturn("カンボウ");
        when(resultSet.getString(4)).thenReturn("J00");
        when(resultSet.getString(5)).thenReturn("99999999");

        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(orcaConnection);
        List<Map<String, Object>> rows = service.queryEntries("感冒", "2026-04-01", false);

        assertEquals(1, rows.size());
        assertEquals("D001", rows.get(0).get("code"));
        assertEquals("感冒", rows.get(0).get("name"));
        assertEquals("カンボウ", rows.get(0).get("kana"));
        assertEquals("J00", rows.get(0).get("icdTen"));
        assertEquals("99999999", rows.get(0).get("disUseDate"));
        assertEquals("candidate", rows.get(0).get("layer"));
        assertEquals(true, rows.get(0).get("readOnly"));
        assertEquals(true, rows.get(0).get("candidateOnly"));
        verify(statement).setString(1, "感冒");
        verify(statement).setString(2, "感冒");
        verify(statement).setString(3, "20260401");
    }

    @Test
    void queryEntries_returnsEmptyListWhenBackendFails() throws Exception {
        ORCAConnection orcaConnection = mock(ORCAConnection.class);
        when(orcaConnection.getConnection()).thenThrow(new java.sql.SQLException("down"));

        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(orcaConnection);

        assertTrue(service.queryEntries("感冒", "20260401", false).isEmpty());
    }

    @Test
    void queryEntries_returnsBootstrapCandidatesWhenMasterDatasourceIsUnavailable() throws Exception {
        ORCAConnection orcaConnection = mock(ORCAConnection.class);
        when(orcaConnection.getConnection()).thenThrow(new java.sql.SQLException("connection attempt failed", "08001"));

        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(orcaConnection);
        List<Map<String, Object>> rows = service.queryEntries("高血圧", "2026-05-09", true);

        assertEquals(2, rows.size());
        assertEquals("高血圧症", rows.get(0).get("name"));
        assertEquals("高血圧性心疾患", rows.get(1).get("name"));
    }

    @Test
    void queryEntries_returnsBootstrapCandidatesWhenLocalMasterTableIsMissing() throws Exception {
        ORCAConnection orcaConnection = mock(ORCAConnection.class);
        Connection connection = mock(Connection.class);
        when(orcaConnection.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(org.mockito.ArgumentMatchers.anyString()))
                .thenThrow(new java.sql.SQLException("relation tbl_byomei does not exist", "42P01"));

        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(orcaConnection);
        List<Map<String, Object>> rows = service.queryEntries("高血圧", "2026-05-09", true);

        assertEquals(2, rows.size());
        assertEquals("8839001", rows.get(0).get("code"));
        assertEquals("高血圧症", rows.get(0).get("name"));
        assertEquals("I10", rows.get(0).get("icdTen"));
        assertEquals("8839222", rows.get(1).get("code"));
        assertEquals("高血圧性心疾患", rows.get(1).get("name"));
    }
}
