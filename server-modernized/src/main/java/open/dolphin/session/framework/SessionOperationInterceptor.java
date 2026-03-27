package open.dolphin.session.framework;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import jakarta.ws.rs.WebApplicationException;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.infomodel.IInfoModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.jboss.logmanager.MDC;

@SessionOperation
@Interceptor
@Priority(Interceptor.Priority.APPLICATION)
public class SessionOperationInterceptor {

    private static final Logger LOGGER = LoggerFactory.getLogger(SessionOperationInterceptor.class);

    @Inject
    SessionTraceManager traceManager;

    @AroundInvoke
    public Object aroundInvoke(InvocationContext ctx) throws Exception {
        SessionTraceContext existing = traceManager.current();
        boolean newContext = existing == null;
        SessionTraceContext context = existing;

        if (newContext) {
            Map<String, String> attributes = new HashMap<>();
            attributes.put(SessionTraceAttributes.COMPONENT, ctx.getTarget().getClass().getSimpleName());
            String traceId = currentHttpTraceId();
            enrichHttpAttributes(attributes, traceId);
            context = traceManager.start(operationName(ctx), attributes, traceId);
        }

        try {
            return ctx.proceed();
        } catch (WebApplicationException webEx) {
            throw webEx;
        } catch (Exception ex) {
            SessionServiceException wrapped = wrapException(ex, context);
            logException(wrapped);
            throw wrapped;
        } finally {
            if (newContext) {
                traceManager.clear();
            }
        }
    }

    private SessionServiceException wrapException(Exception ex, SessionTraceContext context) {
        if (ex instanceof SessionServiceException serviceException) {
            return serviceException;
        }
        String message = String.format("Session layer failure in %s", context != null ? context.getOperation() : "unknown operation");
        return new SessionServiceException(message, ex, context);
    }

    private void logException(SessionServiceException exception) {
        if (LOGGER.isErrorEnabled()) {
            LOGGER.error("Session operation failed [traceId={}, operation={}]",
                    exception.getTraceId(), exception.getOperation(), exception);
        }
    }

    private String operationName(InvocationContext ctx) {
        return ctx.getTarget().getClass().getName() + '#' + ctx.getMethod().getName();
    }

    private String currentHttpTraceId() {
        String fromJboss = MDC.get("traceId");
        if (fromJboss != null && !fromJboss.isBlank()) {
            return fromJboss;
        }
        String fromSlf4j = org.slf4j.MDC.get("traceId");
        if (fromSlf4j != null && !fromSlf4j.isBlank()) {
            return fromSlf4j;
        }
        return null;
    }

    private void enrichHttpAttributes(Map<String, String> attributes, String traceId) {
        String actorId = currentActorId();
        if (actorId != null) {
            attributes.put(SessionTraceAttributes.ACTOR_ID, actorId);
            String facilityId = extractFacilityId(actorId);
            if (facilityId != null) {
                attributes.put(SessionTraceAttributes.FACILITY_ID, facilityId);
            }
        }
        if (traceId != null && !traceId.isBlank()) {
            attributes.put(SessionTraceAttributes.REQUEST_ID, traceId);
        }
    }

    private String currentActorId() {
        String fromJboss = MDC.get(SessionTraceAttributes.ACTOR_ID_MDC_KEY);
        if (fromJboss != null && !fromJboss.isBlank()) {
            return fromJboss;
        }
        String fromSlf4j = org.slf4j.MDC.get(SessionTraceAttributes.ACTOR_ID_MDC_KEY);
        if (fromSlf4j != null && !fromSlf4j.isBlank()) {
            return fromSlf4j;
        }
        return null;
    }

    private String extractFacilityId(String actorId) {
        if (actorId == null) {
            return null;
        }
        int idx = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx <= 0) {
            return null;
        }
        return actorId.substring(0, idx);
    }
}
