package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.orca.read.OrcaLiveDiseaseMasterReadService;
import open.dolphin.rest.masterupdate.MasterUpdateStore;
import open.orca.rest.LocalOrcaMasterCacheRepository;
import open.orca.rest.OrcaMasterCacheState;

@Path("/orca/official/disease-master")
public class OrcaLiveDiseaseMasterResource extends AbstractOrcaRestResource {

    @Inject
    private LocalOrcaMasterCacheRepository localMasterCacheRepository;

    @Inject
    private MasterUpdateStore masterUpdateStore;

    @GET
    @Path("/name/{param}/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDiseaseMasterByName(
            @Context HttpServletRequest request,
            @PathParam("param") String param) {
        requireRemoteUser(request);
        requireFacilityId(request);
        String[] params = param != null ? param.split(",") : new String[0];
        String term = params.length > 0 ? params[0].trim() : "";
        String referenceDate = params.length > 1 && !params[1].isBlank() ? params[1].trim() : "99999999";
        boolean partial = params.length > 2 && Boolean.parseBoolean(params[2]);
        OrcaMasterCacheState state = loadDiseaseCandidateState();
        if (state.isUnavailable()) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(buildUnavailableResponse(state))
                    .build();
        }
        List<Map<String, Object>> list;
        try {
            list = new OrcaLiveDiseaseMasterReadService(localMasterCacheRepository)
                    .queryEntries(term, referenceDate, partial);
        } catch (LocalOrcaMasterCacheRepository.LocalMasterUnavailableException ex) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(buildUnavailableResponse(ex.getCacheState()))
                    .build();
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("layer", "candidate");
        response.put("readOnly", Boolean.TRUE);
        response.put("candidateOnly", Boolean.TRUE);
        response.put("sourceSystem", state.toMeta().getSourceSystem());
        response.put("sourceKind", state.toMeta().getSourceKind());
        response.put("masterVersion", firstNonBlank(state.masterVersion(), resolveDiseaseMasterVersion()));
        response.put("cacheStatus", state.cacheStatus());
        response.put("stale", state.toMeta().getStale());
        response.put("meta", state.toMeta());
        response.put("list", list);
        return Response.ok(response).build();
    }

    private Map<String, Object> buildUnavailableResponse(OrcaMasterCacheState state) {
        OrcaMasterCacheState resolved = state != null ? state : OrcaMasterCacheState.unavailable("disease-candidate");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("layer", "candidate");
        response.put("readOnly", Boolean.TRUE);
        response.put("candidateOnly", Boolean.TRUE);
        response.put("unavailable", Boolean.TRUE);
        response.put("cacheStatus", resolved.cacheStatus());
        response.put("unavailableReason", resolved.toMeta().getUnavailableReason());
        response.put("meta", resolved.toMeta());
        return response;
    }

    private OrcaMasterCacheState loadDiseaseCandidateState() {
        if (localMasterCacheRepository == null) {
            return OrcaMasterCacheState.unavailable("disease-candidate");
        }
        return localMasterCacheRepository.loadState("disease-candidate");
    }

    private String resolveDiseaseMasterVersion() {
        if (masterUpdateStore == null) {
            return null;
        }
        try {
            MasterUpdateStore.Snapshot snapshot = masterUpdateStore.getSnapshot();
            MasterUpdateStore.DatasetState state = MasterUpdateStore.findDataset(snapshot, "disease_master");
            if (state == null) {
                state = MasterUpdateStore.findDataset(snapshot, "orca_master_core");
            }
            if (state == null) {
                return null;
            }
            MasterUpdateStore.DatasetVersion version = state.currentVersion();
            if (version != null && version.summary != null && !version.summary.isBlank()) {
                return version.summary;
            }
            return state.currentVersionId;
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
