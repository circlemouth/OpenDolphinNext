package open.dolphin.security.auth;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.rest.AuthSessionSupport;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class AuthSessionRegistryFilter implements ContainerRequestFilter {

    @Inject
    private AuthSessionRegistryService authSessionRegistryService;

    @Context
    private HttpServletRequest request;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        HttpSession session = request != null ? request.getSession(false) : null;
        String actorId = AuthSessionSupport.resolveActorId(session);
        if (session == null || actorId == null || authSessionRegistryService == null) {
            return;
        }
        AuthSessionRegistryService.SessionValidationResult validation = authSessionRegistryService.validateCurrentSession(session);
        if (validation.valid()) {
            return;
        }
        AuthSessionSupport.clearSession(session);
        invalidateSilently(session);
        requestContext.abortWith(buildSessionRevokedResponse());
    }

    private Response buildSessionRevokedResponse() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "session_revoked");
        body.put("code", "session_revoked");
        body.put("message", "セッションは無効化されました。再ログインしてください。");
        body.put("status", Response.Status.UNAUTHORIZED.getStatusCode());
        return Response.status(Response.Status.UNAUTHORIZED)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(body)
                .header("Cache-Control", "private, no-store, max-age=0, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .build();
    }

    private void invalidateSilently(HttpSession session) {
        if (session == null) {
            return;
        }
        try {
            session.invalidate();
        } catch (IllegalStateException ignored) {
            // already invalidated
        }
    }
}
