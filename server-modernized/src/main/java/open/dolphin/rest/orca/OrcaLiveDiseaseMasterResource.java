package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.orca.rest.ORCAConnection;

@Path("/orca-live/disease-master")
public class OrcaLiveDiseaseMasterResource extends AbstractOrcaRestResource {

    private static final String QUERY_EXACT =
            "select byomeicd, byomei, haisiymd from tbl_byomei where byomei = ? and haisiymd >= ?";
    private static final String QUERY_PREFIX =
            "select byomeicd, byomei, haisiymd from tbl_byomei where byomei like ? and haisiymd >= ?";

    @Inject
    private ORCAConnection orcaConnection;

    @GET
    @Path("/name/{param}/")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> getDiseaseMasterByName(
            @Context HttpServletRequest request,
            @PathParam("param") String param) {
        requireRemoteUser(request);
        requireFacilityId(request);
        String[] params = param != null ? param.split(",") : new String[0];
        String term = params.length > 0 ? params[0].trim() : "";
        String referenceDate = params.length > 1 && !params[1].isBlank() ? params[1].trim() : "99999999";
        boolean partial = params.length > 2 && Boolean.parseBoolean(params[2]);
        List<Map<String, Object>> list = queryEntries(term, referenceDate, partial);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("list", list);
        return response;
    }

    private List<Map<String, Object>> queryEntries(String term, String referenceDate, boolean partial) {
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
