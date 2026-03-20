package open.dolphin.audit;

import java.io.Serializable;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * セッション層から Audit/JMS へ橋渡しするためのシリアライズ可能なイベントラッパー。
 */
public final class AuditEventEnvelope implements Serializable {

    private static final long serialVersionUID = 1L;

    public enum Outcome {
        SUCCESS,
        FAILURE,
        MISSING,
        BLOCKED
    }

    private final String action;
    private final String resource;
    private final String requestId;
    private final String traceId;
    private final String runId;
    private final String screen;
    private final String uiAction;
    private final String actorId;
    private final String actorDisplayName;
    private final String actorRole;
    private final String facilityId;
    private final String ipAddress;
    private final String userAgent;
    private final String patientId;
    private final Map<String, Object> details;
    private final Outcome outcome;
    private final String errorCode;
    private final String errorMessage;
    private final Instant occurredAt;
    private final String component;
    private final String operation;

    private AuditEventEnvelope(Builder builder) {
        this.action = Objects.requireNonNull(builder.action, "action must not be null");
        this.resource = Objects.requireNonNull(builder.resource, "resource must not be null");
        this.requestId = builder.requestId;
        this.traceId = builder.traceId;
        this.runId = builder.runId;
        this.screen = builder.screen;
        this.uiAction = builder.uiAction;
        this.actorId = builder.actorId;
        this.actorDisplayName = builder.actorDisplayName;
        this.actorRole = builder.actorRole;
        this.facilityId = builder.facilityId;
        this.ipAddress = builder.ipAddress;
        this.userAgent = builder.userAgent;
        this.patientId = builder.patientId;
        this.details = Collections.unmodifiableMap(new HashMap<>(builder.details));
        this.outcome = builder.outcome;
        this.errorCode = builder.errorCode;
        this.errorMessage = builder.errorMessage;
        this.occurredAt = builder.occurredAt == null ? Instant.now() : builder.occurredAt;
        this.component = builder.component;
        this.operation = builder.operation;
    }

    public String getAction() {
        return action;
    }

    public String getResource() {
        return resource;
    }

    public String getRequestId() {
        return requestId;
    }

    public String getTraceId() {
        return traceId;
    }

    public String getRunId() {
        return runId;
    }

    public String getScreen() {
        return screen;
    }

    public String getUiAction() {
        return uiAction;
    }

    public String getActorId() {
        return actorId;
    }

    public String getActorDisplayName() {
        return actorDisplayName;
    }

    public String getActorRole() {
        return actorRole;
    }

    public String getFacilityId() {
        return facilityId;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getPatientId() {
        return patientId;
    }

    public Map<String, Object> getDetails() {
        return details;
    }

    public Outcome getOutcome() {
        return outcome;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getComponent() {
        return component;
    }

    public String getOperation() {
        return operation;
    }

    public static Builder builder(String action, String resource) {
        return new Builder(action, resource);
    }

    public static final class Builder {

        private final String action;
        private final String resource;
        private String requestId;
        private String traceId;
        private String runId;
        private String screen;
        private String uiAction;
        private String actorId;
        private String actorDisplayName;
        private String actorRole;
        private String facilityId;
        private String ipAddress;
        private String userAgent;
        private String patientId;
        private Map<String, Object> details = new HashMap<>();
        private Outcome outcome = Outcome.SUCCESS;
        private String errorCode;
        private String errorMessage;
        private Instant occurredAt;
        private String component;
        private String operation;

        private Builder(String action, String resource) {
            this.action = action;
            this.resource = resource;
        }

        public Builder requestId(String requestId) {
            this.requestId = requestId;
            return this;
        }

        public Builder traceId(String traceId) {
            this.traceId = traceId;
            return this;
        }

        public Builder runId(String runId) {
            this.runId = runId;
            return this;
        }

        public Builder screen(String screen) {
            this.screen = screen;
            return this;
        }

        public Builder uiAction(String uiAction) {
            this.uiAction = uiAction;
            return this;
        }

        public Builder actorId(String actorId) {
            this.actorId = actorId;
            return this;
        }

        public Builder actorDisplayName(String actorDisplayName) {
            this.actorDisplayName = actorDisplayName;
            return this;
        }

        public Builder actorRole(String actorRole) {
            this.actorRole = actorRole;
            return this;
        }

        public Builder facilityId(String facilityId) {
            this.facilityId = facilityId;
            return this;
        }

        public Builder ipAddress(String ipAddress) {
            this.ipAddress = ipAddress;
            return this;
        }

        public Builder userAgent(String userAgent) {
            this.userAgent = userAgent;
            return this;
        }

        public Builder patientId(String patientId) {
            this.patientId = patientId;
            return this;
        }

        public Builder details(Map<String, Object> details) {
            this.details = details == null ? new HashMap<>() : new HashMap<>(details);
            return this;
        }

        public Builder detail(String key, Object value) {
            if (key != null && !key.isBlank()) {
                this.details.put(key, value);
            }
            return this;
        }

        public Builder outcome(Outcome outcome) {
            this.outcome = outcome == null ? Outcome.SUCCESS : outcome;
            return this;
        }

        public Builder failure(Throwable error) {
            this.outcome = Outcome.FAILURE;
            if (error != null) {
                this.errorCode = error.getClass().getSimpleName();
                this.errorMessage = error.getMessage();
            }
            return this;
        }

        public Builder error(String errorCode, String errorMessage) {
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
            return this;
        }

        public Builder occurredAt(Instant occurredAt) {
            this.occurredAt = occurredAt;
            return this;
        }

        public Builder component(String component) {
            this.component = component;
            return this;
        }

        public Builder operation(String operation) {
            this.operation = operation;
            return this;
        }

        public AuditEventEnvelope build() {
            return new AuditEventEnvelope(this);
        }
    }
}
