package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.orca.read.OrcaLiveDiseaseMasterReadService;
import open.orca.rest.ORCAConnection;

@Path("/orca/official/disease-master")
public class OrcaLiveDiseaseMasterResource extends AbstractOrcaRestResource {

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
        List<Map<String, Object>> list = new OrcaLiveDiseaseMasterReadService(orcaConnection)
                .queryEntries(term, referenceDate, partial);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("list", list);
        return response;
    }
}
