package open.dolphin.orca.read;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.orca.rest.ORCAConnection;

public class OrcaLiveDiseaseMasterReadService {

    private static final String QUERY_EXACT =
            "select byomeicd, byomei, haisiymd from tbl_byomei where byomei = ? and haisiymd >= ?";
    private static final String QUERY_PREFIX =
            "select byomeicd, byomei, haisiymd from tbl_byomei where byomei like ? and haisiymd >= ?";

    private final ORCAConnection orcaConnection;

    public OrcaLiveDiseaseMasterReadService(ORCAConnection orcaConnection) {
        this.orcaConnection = orcaConnection;
    }

    public List<Map<String, Object>> queryEntries(String term, String referenceDate, boolean partial) {
        List<Map<String, Object>> entries = new ArrayList<>();
        String sql = partial ? QUERY_PREFIX : QUERY_EXACT;
        String effectiveTerm = partial ? term + "%" : term;
        try (Connection connection = orcaConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, effectiveTerm);
            statement.setString(2, referenceDate);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("code", resultSet.getString(1));
                    entry.put("name", resultSet.getString(2));
                    entry.put("disUseDate", resultSet.getString(3));
                    entries.add(entry);
                }
            }
        } catch (SQLException ignored) {
            return List.of();
        }
        return entries;
    }
}
