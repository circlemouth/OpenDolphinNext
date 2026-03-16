package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;

/**
 * Idempotent logout endpoint for server-side session invalidation.
 */
@Path("/logout")
public class LogoutResource extends AbstractResource {

    private static final String CACHE_CONTROL_VALUE = "private, no-store, max-age=0, must-revalidate";

    @POST
    public Response logout(@Context HttpServletRequest request) {
        if (request != null) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                try {
                    AuthSessionSupport.clearSession(session);
                    session.invalidate();
                } catch (IllegalStateException ignored) {
                    // already invalidated by concurrent logout
                }
            }
        }
        return Response.noContent()
                .header("Cache-Control", CACHE_CONTROL_VALUE)
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .header("Clear-Site-Data", "\"storage\"")
                .cookie(expiredSessionCookie(request))
                .build();
    }

    private static NewCookie expiredSessionCookie(HttpServletRequest request) {
        String path = "/";
        boolean secure = false;
        if (request != null) {
            secure = RequestSecuritySupport.isSecureRequest(request);
            String contextPath = request.getContextPath();
            if (contextPath != null && !contextPath.isBlank()) {
                path = contextPath;
            }
        }
        return new NewCookie.Builder("JSESSIONID")
                .value("")
                .path(path)
                .maxAge(0)
                .httpOnly(true)
                .secure(secure)
                .build();
    }
}
