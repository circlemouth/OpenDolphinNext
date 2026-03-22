package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/operations")
public class OperationsReadinessResource extends AbstractResource {

    @Inject
    OperationsReadinessEvaluator readinessEvaluator;

    @GET
    @Path("/readiness")
    @Produces(MediaType.APPLICATION_JSON)
    public Response readiness() {
        OperationsReadinessEvaluator.ReadinessSnapshot snapshot = readinessEvaluator.evaluate();
        return Response.status(snapshot.httpStatus())
                .entity(snapshot.body())
                .build();
    }
}
