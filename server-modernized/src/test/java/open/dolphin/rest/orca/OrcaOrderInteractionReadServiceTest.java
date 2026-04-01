package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;
import open.dolphin.orca.read.OrcaOrderInteractionReadService;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;
import open.orca.rest.ORCAConnection;
import org.junit.jupiter.api.Test;

class OrcaOrderInteractionReadServiceTest {

    @Test
    void loadInteractionPairs_dedupesAndSortsPairs() throws Exception {
        ORCAConnection orcaConnection = mock(ORCAConnection.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(orcaConnection.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(org.mockito.ArgumentMatchers.anyString())).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(resultSet);
        when(resultSet.next()).thenReturn(true, true, false);
        when(resultSet.getString(1)).thenReturn("222", "111");
        when(resultSet.getString(2)).thenReturn("111", "222");
        when(resultSet.getString(3)).thenReturn("IX01", "IX01");
        when(resultSet.getString(4)).thenReturn("併用禁忌", "併用禁忌");

        OrcaOrderInteractionReadService service = new OrcaOrderInteractionReadService(orcaConnection);
        List<OrcaOrderInteractionCheckResponse.Pair> pairs = service.loadInteractionPairs(
                List.of("111", "222"),
                List.of("111", "222"));

        assertEquals(1, pairs.size());
        assertEquals("111", pairs.get(0).getCode1());
        assertEquals("222", pairs.get(0).getCode2());
        assertEquals("IX01", pairs.get(0).getInteractionCode());
    }

    @Test
    void sanitizeCodes_removesBlanksAndDuplicates() {
        OrcaOrderInteractionReadService service = new OrcaOrderInteractionReadService(mock(ORCAConnection.class));

        List<String> sanitized = service.sanitizeCodes(List.of("111", " ", "111", "222"));

        assertEquals(List.of("111", "222"), sanitized);
    }

    @Test
    void loadInteractionPairs_returnsEmptyWhenNoCodes() throws Exception {
        OrcaOrderInteractionReadService service = new OrcaOrderInteractionReadService(mock(ORCAConnection.class));

        assertTrue(service.loadInteractionPairs(List.of(), List.of()).isEmpty());
    }
}
