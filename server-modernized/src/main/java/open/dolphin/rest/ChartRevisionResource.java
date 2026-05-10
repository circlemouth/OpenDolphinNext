package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.session.ChartRevisionFinalizeService;

@Path("/charts")
@Produces(MediaType.APPLICATION_JSON)
public class ChartRevisionResource extends AbstractOrcaRestResource {

    @Inject
    private ChartRevisionFinalizeService finalizeService;

    @POST
    @Path("/{chartId}/revisions/{revisionId}/finalize")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public ChartRevisionFinalizeResponse finalizeRevision(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId,
            @PathParam("revisionId") long revisionId,
            ChartRevisionFinalizeRequest payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return finalizeService.finalizeRevision(chartId, revisionId, facilityId, payload);
    }
}
