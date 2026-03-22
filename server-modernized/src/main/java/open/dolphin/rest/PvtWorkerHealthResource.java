package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import open.dolphin.mbean.PvtService;

@Path("/health/worker/pvt")
public class PvtWorkerHealthResource extends AbstractResource {

    @Inject
    private PvtService pvtService;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response health() {
        if (pvtService == null) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Map.of(
                            "status", "DOWN",
                            "reasonCodes", java.util.List.of(PvtService.REASON_CODE_PVT_WORKER_UNAVAILABLE)))
                    .build();
        }
        Map<String, Object> body = pvtService.workerHealthBody();
        Object statusValue = body.get("status");
        String status = statusValue instanceof String ? (String) statusValue : "DOWN";
        Response.Status responseStatus = ("UP".equals(status) || "DISABLED".equals(status))
                ? Response.Status.OK
                : Response.Status.SERVICE_UNAVAILABLE;
        return Response.status(responseStatus).entity(body).build();
    }
}
