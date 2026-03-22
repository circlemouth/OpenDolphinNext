package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import open.dolphin.rest.dto.OperationsHealthResponse;

@Path("/health")
public class OperationsHealthResource extends AbstractResource {

    @Inject
    OperationsReadinessEvaluator readinessEvaluator;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response health() {
        OperationsHealthResponse body = new OperationsHealthResponse();
        body.setStatus("UP");
        body.setService("server-modernized");
        return Response.ok(body).build();
    }

    @GET
    @Path("/readiness")
    @Produces(MediaType.APPLICATION_JSON)
    public Response readiness() {
        OperationsReadinessEvaluator.ReadinessSnapshot snapshot = readinessEvaluator.evaluate();
        return Response.status(snapshot.httpStatus())
                .entity(Map.of("status", snapshot.status()))
                .build();
    }
}
