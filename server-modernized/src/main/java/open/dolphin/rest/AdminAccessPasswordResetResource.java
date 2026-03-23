package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/**
 * Password reset endpoint split from AdminAccessResource.
 * Remains intentionally unregistered from the public JAX-RS application until truthful session revoke exists.
 * Do not re-expose this route until password reset revokes all active sessions and tokens.
 */
@Path("/admin/access/users/{userPk}/password-reset")
public class AdminAccessPasswordResetResource extends AdminAccessResource {

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response resetPasswordEndpoint(@jakarta.ws.rs.core.Context HttpServletRequest request,
                                          @PathParam("userPk") long userPk,
                                          Map<String, Object> payload) {
        return super.resetPassword(request, userPk, payload);
    }
}
