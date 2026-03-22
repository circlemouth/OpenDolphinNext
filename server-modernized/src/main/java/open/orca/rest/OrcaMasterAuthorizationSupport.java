package open.orca.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import open.dolphin.security.audit.SessionAuditDispatcher;

class OrcaMasterAuthorizationSupport {
    private final OrcaMasterErrorResponseSupport errorResponseSupport;

    OrcaMasterAuthorizationSupport(SessionAuditDispatcher sessionAuditDispatcher) {
        this.errorResponseSupport = new OrcaMasterErrorResponseSupport(sessionAuditDispatcher);
    }

    Response requireAuthorized(HttpServletRequest request) {
        if (OrcaMasterAuthSupport.isAuthorized(request)) {
            return null;
        }
        return errorResponseSupport.unauthorized(request);
    }
}
