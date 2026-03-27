package open.dolphin.session.framework;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.LoggerFactory;
import org.jboss.logmanager.MDC;
import org.slf4j.Logger;

/**
 * Maintains the trace context for session layer invocations on a per-thread
 * basis so that other infrastructure components can access correlation
 * information.
 */
@ApplicationScoped
public class SessionTraceManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(SessionTraceManager.class);
    private static final String MDC_TRACE_ID_KEY = "traceId";

    private final ThreadLocal<SessionTraceContext> current = new ThreadLocal<>();
    private final ThreadLocal<String> previousJbossMdcTraceId = new ThreadLocal<>();
    private final ThreadLocal<String> previousSlf4jMdcTraceId = new ThreadLocal<>();

    public SessionTraceContext start(String operationName, Map<String, String> attributes) {
        return start(operationName, attributes, null);
    }

    public SessionTraceContext start(String operationName, Map<String, String> attributes, String preferredTraceId) {
        String traceId = determineTraceId(preferredTraceId);
        SessionTraceContext context = new SessionTraceContext(traceId, Instant.now(), operationName, attributes);
        current.set(context);
        syncMdc(traceId);
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("Session trace started: {} op={}", context.getTraceId(), context.getOperation());
        }
        return context;
    }

    public SessionTraceContext current() {
        return current.get();
    }

    public void setActorRole(String actorRole) {
        SessionTraceContext context = current();
        if (context == null) {
            return;
        }
        SessionTraceContext updated = context.withActorRole(actorRole);
        current.set(updated);
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("Session trace actor role set: {} traceId={}", actorRole, updated.getTraceId());
        }
    }

    public void putAttribute(String key, String value) {
        if (key == null || key.isBlank()) {
            return;
        }
        SessionTraceContext context = current();
        if (context == null) {
            return;
        }
        SessionTraceContext updated = context.withAttribute(key, value);
        current.set(updated);
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("Session trace attribute set: {}={} traceId={}", key, value, updated.getTraceId());
        }
    }

    public String getAttribute(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        SessionTraceContext context = current();
        if (context == null) {
            return null;
        }
        return context.getAttribute(key);
    }

    public void clear() {
        current.remove();
        restoreMdc();
    }

    private String generateTraceId() {
        long random = ThreadLocalRandom.current().nextLong();
        return UUID.randomUUID().toString() + '-' + Long.toUnsignedString(random, 16);
    }

    private String determineTraceId(String preferredTraceId) {
        if (preferredTraceId != null && !preferredTraceId.isBlank()) {
            return preferredTraceId;
        }
        String fromJboss = MDC.get(MDC_TRACE_ID_KEY);
        if (fromJboss != null && !fromJboss.isBlank()) {
            return fromJboss;
        }
        String fromSlf4j = org.slf4j.MDC.get(MDC_TRACE_ID_KEY);
        if (fromSlf4j != null && !fromSlf4j.isBlank()) {
            return fromSlf4j;
        }
        return generateTraceId();
    }

    private void syncMdc(String traceId) {
        Object jbossCurrent = MDC.get(MDC_TRACE_ID_KEY);
        previousJbossMdcTraceId.set(jbossCurrent == null ? null : jbossCurrent.toString());
        previousSlf4jMdcTraceId.set(org.slf4j.MDC.get(MDC_TRACE_ID_KEY));
        MDC.put(MDC_TRACE_ID_KEY, traceId);
        org.slf4j.MDC.put(MDC_TRACE_ID_KEY, traceId);
    }

    private void restoreMdc() {
        try {
            String previousJboss = previousJbossMdcTraceId.get();
            if (previousJboss == null) {
                MDC.remove(MDC_TRACE_ID_KEY);
            } else {
                MDC.put(MDC_TRACE_ID_KEY, previousJboss);
            }
        } finally {
            previousJbossMdcTraceId.remove();
        }

        try {
            String previousSlf4j = previousSlf4jMdcTraceId.get();
            if (previousSlf4j == null) {
                org.slf4j.MDC.remove(MDC_TRACE_ID_KEY);
            } else {
                org.slf4j.MDC.put(MDC_TRACE_ID_KEY, previousSlf4j);
            }
        } finally {
            previousSlf4jMdcTraceId.remove();
        }
    }
}
