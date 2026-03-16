package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/**
 * Mock/fallback endpoint split from PatientModV2OutpatientResource.
 */
@Path("/orca/patientmodv2/outpatient/mock")
public class PatientModV2OutpatientMockResource extends PatientModV2OutpatientResource {

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response mutatePatientMockEndpoint(@Context HttpServletRequest request, Map<String, Object> payload) {
        return super.mutatePatientMock(request, payload);
    }
}
