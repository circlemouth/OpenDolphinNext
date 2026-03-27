package open.dolphin.security.integrity;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.AbstractResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.framework.SessionTraceAttributes;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Provides document sealing and verification based on canonical content hashing.
 */
@ApplicationScoped
@Named("documentIntegrityService")
public class DocumentIntegrityService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentIntegrityService.class);

    private static final String SEAL_VERSION = "v1";
    private static final String HASH_ALGORITHM = "SHA-256";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String SEAL_ALGORITHM = "HMAC-SHA256";

    private static final String EVENT_SEALED = "KARTE_DOCUMENT_SEALED";
    private static final String EVENT_OK = "KARTE_DOCUMENT_INTEGRITY_OK";
    private static final String EVENT_FAIL = "KARTE_DOCUMENT_INTEGRITY_FAIL";
    private static final String EVENT_MISSING = "KARTE_DOCUMENT_INTEGRITY_MISSING";

    @PersistenceContext
    private EntityManager em;

    @Inject
    private DocumentIntegrityConfig config;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private SessionTraceManager sessionTraceManager;

    public void sealDocument(DocumentModel document) {
        if (document == null) {
            return;
        }
        DocumentIntegrityConfig.Settings settings = config.resolveSettings();
        DocumentIntegrityConfig.KeyMaterial activeKey = settings.getActiveKey();
        if (activeKey == null) {
            throw new IllegalStateException("document integrity active key is not configured");
        }
        long documentId = document.getId();
        if (documentId <= 0) {
            LOGGER.debug("Skip seal because document id is not assigned [id={}]", documentId);
            return;
        }

        byte[] canonicalBytes = canonicalBytes(document);
        String currentHash = sha256Hex(canonicalBytes);
        String seal = hmacSha256Hex(activeKey.hmacKey(), currentHash);

        DocumentIntegrityEntity entity = em.find(DocumentIntegrityEntity.class, documentId);
        Instant now = Instant.now();
        boolean isNew = entity == null;
        if (entity == null) {
            entity = new DocumentIntegrityEntity();
            entity.setDocumentId(documentId);
            entity.setCreatedAt(now);
        }

        entity.setSealVersion(SEAL_VERSION);
        entity.setHashAlg(HASH_ALGORITHM);
        entity.setContentHash(currentHash);
        entity.setSealAlg(SEAL_ALGORITHM);
        entity.setSeal(seal);
        entity.setKeyId(activeKey.keyId());
        entity.setSealedAt(now);
        entity.setSealedBy(resolveSealedBy(document));
        if (isNew) {
            em.persist(entity);
        }

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("documentId", documentId);
        details.put("currentHash", currentHash);
        details.put("keyId", activeKey.keyId());
        recordAudit(EVENT_SEALED, "SUCCESS", document, details);
    }

    public void verifyDocumentOnRead(DocumentModel document) {
        if (document == null) {
            return;
        }
        DocumentIntegrityConfig.Settings settings = config.resolveSettings();
        long documentId = document.getId();
        if (documentId <= 0) {
            return;
        }

        String currentHash = sha256Hex(canonicalBytes(document));

        DocumentIntegrityEntity stored = em.find(DocumentIntegrityEntity.class, documentId);
        if (stored == null) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("documentId", documentId);
            details.put("currentHash", currentHash);
            details.put("reasonCode", "integrity_record_missing");
            recordAudit(EVENT_MISSING, "MISSING", document, details);
            throw conflictMissing(details);
        }

        List<String> reasons = new ArrayList<>();
        if (!equalsIgnoreCase(stored.getSealVersion(), SEAL_VERSION)) {
            reasons.add("seal_version_mismatch");
        }
        if (!equalsIgnoreCase(stored.getHashAlg(), HASH_ALGORITHM)) {
            reasons.add("hash_alg_mismatch");
        }
        if (!equalsIgnoreCase(stored.getSealAlg(), SEAL_ALGORITHM)) {
            reasons.add("seal_alg_mismatch");
        }
        if (!equalsIgnoreCase(stored.getContentHash(), currentHash)) {
            reasons.add("content_hash_mismatch");
        }
        DocumentIntegrityConfig.KeyMaterial storedKey = settings.getKey(stored.getKeyId());
        if (storedKey == null) {
            reasons.add("key_not_found");
        } else {
            String expectedSeal = hmacSha256Hex(storedKey.hmacKey(), currentHash);
            if (!equalsIgnoreCase(stored.getSeal(), expectedSeal)) {
                reasons.add("seal_mismatch");
            }
        }

        if (!reasons.isEmpty()) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("documentId", documentId);
            details.put("currentHash", currentHash);
            details.put("storedHash", nullSafe(stored.getContentHash()));
            details.put("reasonCode", reasons.get(0));
            details.put("reasonCodes", List.copyOf(reasons));
            recordAudit(EVENT_FAIL, "FAILURE", document, details);
            throw conflictMismatch(details);
        }

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("documentId", documentId);
        details.put("currentHash", currentHash);
        details.put("storedHash", nullSafe(stored.getContentHash()));
        recordAudit(EVENT_OK, "SUCCESS", document, details);
    }

    private byte[] canonicalBytes(DocumentModel document) {
        StringBuilder builder = new StringBuilder(4096);

        DocInfoModel docInfo = document.getDocInfoModel();
        KarteBean karte = document.getKarteBean();
        UserModel creator = document.getUserModel();

        appendField(builder, "seal.version", SEAL_VERSION);
        appendField(builder, "document.id", Long.toString(document.getId()));
        appendField(builder, "document.docId", docInfo != null ? docInfo.getDocId() : null);
        appendField(builder, "document.karteId", karte != null ? Long.toString(karte.getId()) : null);
        appendField(builder, "document.docType", docInfo != null ? docInfo.getDocType() : null);
        appendField(builder, "document.started", formatInstant(document.getStarted()));
        appendField(builder, "document.confirmed", formatInstant(document.getConfirmed()));
        appendField(builder, "document.creatorUserId", creator != null ? creator.getUserId() : null);

        for (ModuleModel module : sortedModules(document.getModules())) {
            ModuleInfoBean info = module.getModuleInfoBean();
            appendField(builder, "module.entity", info != null ? info.getEntity() : null);
            appendField(builder, "module.payloadHash", hashModulePayload(module));
        }

        for (SchemaModel schemaModel : sortedSchemas(document.getSchema())) {
            ExtRefModel extRef = schemaModel.getExtRefModel();
            appendField(builder, "schema.href", extRef != null ? extRef.getHref() : null);
            appendField(builder, "schema.digest", nullSafe(schemaModel.getDigest()));
        }

        for (AttachmentModel attachment : sortedAttachments(document.getAttachment())) {
            appendField(builder, "attachment.fileName", attachment.getFileName());
            appendField(builder, "attachment.contentType", attachment.getContentType());
            appendField(builder, "attachment.contentSize", Long.toString(attachment.getContentSize()));
            appendField(builder, "attachment.uri", attachment.getUri());
            appendField(builder, "attachment.digest", resolveAttachmentDigest(attachment));
        }

        return builder.toString().getBytes(StandardCharsets.UTF_8);
    }

    private List<ModuleModel> sortedModules(List<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return List.of();
        }
        return modules.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingLong(ModuleModel::getId))
                .toList();
    }

    private List<SchemaModel> sortedSchemas(List<SchemaModel> schemas) {
        if (schemas == null || schemas.isEmpty()) {
            return List.of();
        }
        return schemas.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingLong(SchemaModel::getId))
                .toList();
    }

    private List<AttachmentModel> sortedAttachments(List<AttachmentModel> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return List.of();
        }
        return attachments.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingLong(AttachmentModel::getId))
                .toList();
    }

    private String hashModulePayload(ModuleModel module) {
        if (module == null) {
            return sha256Hex((byte[]) null);
        }
        String beanJson = module.getBeanJson();
        return sha256Hex(CanonicalJson.canonicalBytes(beanJson));
    }

    private String resolveAttachmentDigest(AttachmentModel attachment) {
        if (attachment == null) {
            return sha256Hex((byte[]) null);
        }
        String digest = attachment.getDigest();
        if (digest != null && !digest.isBlank()) {
            return digest.trim().toLowerCase(Locale.ROOT);
        }
        return "";
    }

    private String formatInstant(Date date) {
        if (date == null) {
            return "";
        }
        return date.toInstant().toString();
    }

    private void appendField(StringBuilder builder, String key, String value) {
        builder.append(key)
                .append('=')
                .append(nullSafe(value))
                .append('\n');
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private String sha256Hex(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            byte[] source = value == null ? new byte[0] : value;
            return HexFormat.of().formatHex(digest.digest(source));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Missing hash algorithm: " + HASH_ALGORITHM, ex);
        }
    }

    private String hmacSha256Hex(byte[] key, String value) {
        if (key == null) {
            throw new IllegalStateException("HMAC key is not configured");
        }
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(key, HMAC_ALGORITHM));
            byte[] signature = mac.doFinal(nullSafe(value).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(signature);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to calculate HMAC-SHA256", ex);
        }
    }

    private boolean equalsIgnoreCase(String left, String right) {
        if (left == null || right == null) {
            return left == null && right == null;
        }
        return left.equalsIgnoreCase(right);
    }

    private String resolveSealedBy(DocumentModel document) {
        SessionTraceContext context = sessionTraceManager != null ? sessionTraceManager.current() : null;
        String actorId = resolveActorId(context, document);
        if (actorId != null && !actorId.isBlank()) {
            return actorId;
        }
        return "system";
    }

    private void recordAudit(String action, String outcome, DocumentModel document, Map<String, Object> details) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        try {
            SessionTraceContext context = sessionTraceManager != null ? sessionTraceManager.current() : null;
            String actorId = resolveActorId(context, document);
            String traceId = resolveTraceId(context);

            Map<String, Object> mergedDetails = new HashMap<>();
            if (details != null) {
                mergedDetails.putAll(details);
            }
            if (traceId != null) {
                mergedDetails.put("traceId", traceId);
            }
            String facilityId = extractFacilityIdFromActor(actorId);
            if (facilityId != null) {
                mergedDetails.put("facilityId", facilityId);
            }

            AuditEventPayload payload = new AuditEventPayload();
            payload.setAction(action);
            payload.setResource("DocumentModel");
            payload.setActorId(actorId);
            payload.setActorDisplayName(resolveActorDisplayName(actorId));
            payload.setActorRole(context != null ? context.getActorRole() : null);
            payload.setTraceId(traceId);
            payload.setRequestId(resolveRequestId(context, traceId));
            payload.setPatientId(resolvePatientId(document, context));
            payload.setOutcome(outcome);
            payload.setDetails(mergedDetails);
            sessionAuditDispatcher.record(payload);
        } catch (RuntimeException ex) {
            LOGGER.debug("Failed to record document integrity audit action={}", action, ex);
        }
    }

    private String resolveActorId(SessionTraceContext context, DocumentModel document) {
        if (context != null) {
            String actorId = context.getAttribute(SessionTraceAttributes.ACTOR_ID);
            if (actorId != null && !actorId.isBlank()) {
                return actorId;
            }
            actorId = context.getAttribute(SessionTraceAttributes.ACTOR_ID_MDC_KEY);
            if (actorId != null && !actorId.isBlank()) {
                return actorId;
            }
        }
        if (document != null && document.getUserModel() != null
                && document.getUserModel().getUserId() != null
                && !document.getUserModel().getUserId().isBlank()) {
            return document.getUserModel().getUserId();
        }
        return "system";
    }

    private String resolveActorDisplayName(String actorId) {
        if (actorId == null) {
            return "system";
        }
        int index = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (index >= 0 && index + 1 < actorId.length()) {
            return actorId.substring(index + 1);
        }
        return actorId;
    }

    private String extractFacilityIdFromActor(String actorId) {
        if (actorId == null) {
            return null;
        }
        int index = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (index <= 0) {
            return null;
        }
        return actorId.substring(0, index);
    }

    private String resolvePatientId(DocumentModel document, SessionTraceContext context) {
        if (document != null) {
            KarteBean karte = document.getKarteBean();
            if (karte != null) {
                PatientModel patient = karte.getPatientModel();
                if (patient != null && patient.getPatientId() != null && !patient.getPatientId().isBlank()) {
                    return patient.getPatientId();
                }
            }
        }
        if (context != null) {
            String patientId = context.getAttribute(SessionTraceAttributes.PATIENT_ID);
            if (patientId != null && !patientId.isBlank()) {
                return patientId;
            }
        }
        return "N/A";
    }

    private String resolveTraceId(SessionTraceContext context) {
        if (context != null && context.getTraceId() != null && !context.getTraceId().isBlank()) {
            return context.getTraceId();
        }
        return UUID.randomUUID().toString();
    }

    private String resolveRequestId(SessionTraceContext context, String traceId) {
        if (context != null) {
            String requestId = context.getAttribute(SessionTraceAttributes.REQUEST_ID);
            if (requestId != null && !requestId.isBlank()) {
                return requestId;
            }
        }
        return traceId;
    }

    private WebApplicationException conflictMissing(Map<String, Object> details) {
        return AbstractResource.restError(
                null,
                Response.Status.CONFLICT,
                "document_integrity_missing",
                "Document integrity seal is missing.",
                details,
                null
        );
    }

    private WebApplicationException conflictMismatch(Map<String, Object> details) {
        return AbstractResource.restError(
                null,
                Response.Status.CONFLICT,
                "document_integrity_conflict",
                "Document integrity verification failed.",
                details,
                null
        );
    }
}
