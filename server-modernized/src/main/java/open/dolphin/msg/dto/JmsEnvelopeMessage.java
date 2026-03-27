package open.dolphin.msg.dto;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;

/**
 * JMS テキストメッセージの明示 DTO。
 */
public class JmsEnvelopeMessage {

    public static final String TYPE_AUDIT_EVENT = "AUDIT_EVENT";
    public static final String TYPE_PVT_XML = "PVT_XML";

    private String type;
    private String pvtXml;
    private AuditMessage audit;

    public static JmsEnvelopeMessage forAudit(AuditEventEnvelope envelope) {
        JmsEnvelopeMessage message = new JmsEnvelopeMessage();
        message.setType(TYPE_AUDIT_EVENT);
        message.setAudit(AuditMessage.fromEnvelope(envelope));
        return message;
    }

    public static JmsEnvelopeMessage forPvt(String pvtXml) {
        JmsEnvelopeMessage message = new JmsEnvelopeMessage();
        message.setType(TYPE_PVT_XML);
        message.setPvtXml(pvtXml);
        return message;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getPvtXml() {
        return pvtXml;
    }

    public void setPvtXml(String pvtXml) {
        this.pvtXml = pvtXml;
    }

    public AuditMessage getAudit() {
        return audit;
    }

    public void setAudit(AuditMessage audit) {
        this.audit = audit;
    }

    public static record AuditMessage(
            String action,
            String resource,
            String requestId,
            String traceId,
            String runId,
            String actorId,
            String facilityId,
            String patientId,
            String operation,
            String outcome,
            String errorCode,
            String errorMessage,
            Map<String, Object> details
    ) {
        public AuditMessage {
            details = details == null ? null : Collections.unmodifiableMap(new LinkedHashMap<>(details));
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

        public String getActorId() {
            return actorId;
        }

        public String getFacilityId() {
            return facilityId;
        }

        public String getPatientId() {
            return patientId;
        }

        public String getOperation() {
            return operation;
        }

        public String getOutcome() {
            return outcome;
        }

        public String getErrorCode() {
            return errorCode;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public Map<String, Object> getDetails() {
            return details;
        }

        public static AuditMessage fromEnvelope(AuditEventEnvelope envelope) {
            return new AuditMessage(
                    envelope.getAction(),
                    envelope.getResource(),
                    envelope.getRequestId(),
                    envelope.getTraceId(),
                    envelope.getRunId(),
                    envelope.getActorId(),
                    envelope.getFacilityId(),
                    envelope.getPatientId(),
                    envelope.getOperation(),
                    envelope.getOutcome() != null ? envelope.getOutcome().name() : null,
                    envelope.getErrorCode(),
                    envelope.getErrorMessage(),
                    envelope.getDetails());
        }
    }
}
