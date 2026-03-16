package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import open.dolphin.rest.dto.outpatient.MedicalOutpatientResponse;

@Path("/orca/medical")
public class OrcaMedicalOutpatientResource extends AbstractOrcaRestResource {

    @Inject
    private OrcaMedicalModV2Resource delegate;

    @POST
    @Path("/outpatient")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public MedicalOutpatientResponse postOutpatientMedical(
            @Context HttpServletRequest request,
            Map<String, Object> payload) {
        if (delegate == null) {
            throw restError(request, jakarta.ws.rs.core.Response.Status.SERVICE_UNAVAILABLE,
                    "medical_outpatient_delegate_missing", "medical outpatient delegate is unavailable");
        }
        return delegate.postOutpatientMedical(request, payload);
    }
}
