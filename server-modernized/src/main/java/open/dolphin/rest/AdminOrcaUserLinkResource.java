package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/**
 * EHR-ORCA user link endpoint split from AdminOrcaUserResource.
 */
@Path("/admin")
public final class AdminOrcaUserLinkResource extends AbstractResource {

    @jakarta.inject.Inject
    private AdminOrcaUserResource delegate;

    @PUT
    @Path("/users/{ehrUserId}/orca-link")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response linkEhrUserToOrcaEndpoint(@Context HttpServletRequest request,
                                              @PathParam("ehrUserId") String ehrUserId,
                                              Map<String, Object> payload) {
        return delegate.linkEhrUserToOrca(request, ehrUserId, payload);
    }

    @DELETE
    @Path("/users/{ehrUserId}/orca-link")
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response unlinkEhrUserFromOrcaEndpoint(@Context HttpServletRequest request,
                                                  @PathParam("ehrUserId") String ehrUserId) {
        return delegate.unlinkEhrUserFromOrca(request, ehrUserId);
    }
}
