package open.dolphin.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.concurrent.ManagedExecutorService;
import jakarta.inject.Inject;
import jakarta.jms.JMSException;
import jakarta.jms.Message;
import jakarta.jms.TextMessage;
import java.io.BufferedReader;
import java.io.StringReader;
import java.util.Collection;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.mbean.PVTBuilder;
import open.dolphin.msg.dto.JmsEnvelopeMessage;
import open.dolphin.msg.gateway.MessagingHeaders;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * JMS envelope handling logic extracted from MDB entrypoint.
 *
 * Stage 1 (sync): envelope validation and message classification.
 * Stage 2 (sync): PVT XML domain conversion + addPvt persistence.
 * Stage 3 (deferred): audit-envelope drain logging on managed executor.
 */
@ApplicationScoped
public class SessionMessageHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(SessionMessageHandler.class);
    private static final String TRACE_ID_PROPERTY = MessagingHeaders.TRACE_ID;
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    @Inject
    private PVTServiceBean pvtServiceBean;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    private Executor deferredExecutor = Runnable::run;

    @Resource(lookup = "java:jboss/ee/concurrency/executor/default")
    void setDeferredExecutor(ManagedExecutorService executorService) {
        if (executorService != null) {
            this.deferredExecutor = executorService;
        }
    }

    public void onMessage(Message message) {
        String traceId = readTraceId(message);
        try {
            // Stage 1: normalize envelope from JMS message.
            JmsEnvelopeMessage envelope = readEnvelope(message, traceId);
            if (envelope == null) {
                return;
            }
            handleEnvelope(envelope, traceId);
        } catch (Exception ex) {
            LOGGER.warn("MessageSender rejected JMS message [traceId={}]", traceId, ex);
        }
    }

    private JmsEnvelopeMessage readEnvelope(Message message, String traceId) throws Exception {
        if (!(message instanceof TextMessage textMessage)) {
            LOGGER.warn("Unsupported JMS message type received: {}", message.getClass().getName());
            return null;
        }
        String body = textMessage.getText();
        if (body == null || body.isBlank()) {
            LOGGER.warn("Empty JMS TextMessage body was rejected [traceId={}]", traceId);
            return null;
        }
        return JSON.readValue(body, JmsEnvelopeMessage.class);
    }

    private void handleEnvelope(JmsEnvelopeMessage envelope, String traceId) throws Exception {
        if (envelope == null || envelope.getType() == null || envelope.getType().isBlank()) {
            LOGGER.warn("JMS envelope without type was rejected [traceId={}]", traceId);
            return;
        }
        String type = envelope.getType().trim();
        if (JmsEnvelopeMessage.TYPE_PVT_XML.equals(type)) {
            // Stage 2 (sync): keep visit import in current transaction scope.
            handlePvt(envelope.getPvtXml(), traceId);
            return;
        }
        if (JmsEnvelopeMessage.TYPE_AUDIT_EVENT.equals(type)) {
            // Stage 3 (deferred): do not block JMS consumer with audit drain logging.
            dispatchAuditEvent(envelope.getAudit(), traceId);
            return;
        }
        LOGGER.warn("Unsupported JMS envelope type was rejected [traceId={}, type={}]", traceId, type);
    }

    private void dispatchAuditEvent(JmsEnvelopeMessage.AuditMessage envelope, String traceId) {
        try {
            deferredExecutor.execute(() -> handleAuditEvent(envelope, traceId));
        } catch (RejectedExecutionException ex) {
            LOGGER.warn("Deferred audit execution rejected, fallback to inline execution [traceId={}]", traceId, ex);
            handleAuditEvent(envelope, traceId);
        }
    }

    private void handleAuditEvent(JmsEnvelopeMessage.AuditMessage envelope, String traceId) {
        if (envelope == null) {
            LOGGER.warn("Audit envelope payload was empty [traceId={}]", traceId);
            return;
        }
        LOGGER.info("Audit envelope drained from JMS queue [traceId={}, action={}, resource={}, outcome={}]",
                traceId,
                envelope.getAction(),
                envelope.getResource(),
                envelope.getOutcome());
    }

    private void handlePvt(String pvtXml, String traceId) throws Exception {
        if (pvtXml == null || pvtXml.isBlank()) {
            LOGGER.warn("PVT XML payload was empty [traceId={}]", traceId);
            return;
        }
        String facilityId = configuredFacilityId();
        if (facilityId == null || facilityId.isBlank()) {
            LOGGER.warn("Facility ID unavailable; skipping PVT import [traceId={}]", traceId);
            return;
        }
        LOGGER.info("Processing PVT JMS message [traceId={}]", traceId);
        PatientVisitModel model = parsePvt(pvtXml, facilityId);
        if (model == null) {
            LOGGER.debug("Parsed PVT model is null; skipping addPvt [traceId={}]", traceId);
            return;
        }
        pvtServiceBean.addPvt(model);
    }

    private PatientVisitModel parsePvt(String pvtXml, String facilityId) throws Exception {
        BufferedReader reader = new BufferedReader(new StringReader(pvtXml));
        PVTBuilder builder = new PVTBuilder();
        builder.parse(reader);
        PatientVisitModel model = builder.getProduct();
        if (model == null) {
            return null;
        }

        model.setFacilityId(facilityId);
        if (model.getPatientModel() != null) {
            model.getPatientModel().setFacilityId(facilityId);
            Collection<HealthInsuranceModel> insurances = model.getPatientModel().getHealthInsurances();
            if (insurances != null) {
                for (HealthInsuranceModel insurance : insurances) {
                    insurance.setPatient(model.getPatientModel());
                }
            }
        }
        return model;
    }

    private String configuredFacilityId() {
        if (configurationResolver != null) {
            String configured = configurationResolver.orcaRuntime().facilityId();
            if (configured != null && !configured.isBlank()) {
                return configured;
            }
        }
        return null;
    }

    private String readTraceId(Message message) {
        try {
            if (message.propertyExists(TRACE_ID_PROPERTY)) {
                return message.getStringProperty(TRACE_ID_PROPERTY);
            }
        } catch (JMSException ex) {
            LOGGER.debug("Failed to read traceId from JMS message", ex);
        }
        return null;
    }
}
