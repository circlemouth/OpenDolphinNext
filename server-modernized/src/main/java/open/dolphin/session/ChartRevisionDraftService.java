package open.dolphin.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.chart.ChartRevisionDraftResponse;

@ApplicationScoped
@Transactional
public class ChartRevisionDraftService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final int MAX_TITLE_LENGTH = 255;

    @PersistenceContext(unitName = "opendolphinPU")
    private EntityManager em;

    public ChartRevisionDraftResponse createDraft(String facilityId, long actorUserId, String payloadJson) {
        JsonNode payload = readPayload(payloadJson);
        long karteId = positiveLong(payload.at("/karteBean/id"), "karteId");
        String title = normalizeTitle(firstText(payload.at("/docInfoModel/title"), payload.at("/title")));
        Long legacyDocumentId = optionalPositiveLong(payload.at("/id"));
        KarteScope scope = resolveKarteScope(karteId, facilityId);

        ChartDocumentModel document = new ChartDocumentModel();
        document.setDocumentKey(newDocumentKey(facilityId, karteId, title));
        document.setFacilityId(facilityId);
        document.setKarteId(karteId);
        document.setPatientId(scope.patientPk());
        document.setLegacyDocumentId(legacyDocumentId);
        document.setCreatedByUserId(actorUserId);
        em.persist(document);
        em.flush();

        ChartRevisionModel revision = new ChartRevisionModel();
        revision.setChartDocumentId(document.getId());
        revision.setRevisionNumber(1);
        revision.setStatus(ChartRevisionStatus.DRAFT);
        revision.setSourceDocumentId(legacyDocumentId);
        revision.setTitle(title);
        revision.setEnteredByUserId(actorUserId);
        revision.setFinalizeContextJson("{}");
        revision.setSnapshotManifestJson("{}");
        em.persist(revision);
        em.flush();

        document.setCurrentRevisionId(revision.getId());
        em.flush();

        ChartRevisionDraftResponse response = new ChartRevisionDraftResponse();
        response.setChartId(document.getId());
        response.setRevisionId(revision.getId());
        response.setRevisionNumber(revision.getRevisionNumber());
        response.setStatus(revision.getStatus().name());
        response.setDocumentKey(document.getDocumentKey());
        response.setDocPk(document.getId());
        return response;
    }

    private JsonNode readPayload(String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) {
            throw badRequest("payload", "payload is required");
        }
        try {
            return OBJECT_MAPPER.readTree(payloadJson);
        } catch (JsonProcessingException ex) {
            throw badRequest("payload", "payload must be valid JSON");
        }
    }

    private KarteScope resolveKarteScope(long karteId, String facilityId) {
        try {
            Object[] row = em.createQuery("""
                            select k.patient.id, k.patient.facilityId
                              from KarteBean k
                             where k.id = :karteId
                            """, Object[].class)
                    .setParameter("karteId", karteId)
                    .getSingleResult();
            Long patientPk = (Long) row[0];
            String targetFacility = (String) row[1];
            if (facilityId == null || facilityId.isBlank() || targetFacility == null
                    || !facilityId.equals(targetFacility)) {
                throw AbstractResource.restError(null, Response.Status.NOT_FOUND, "karte_not_found",
                        "Karte was not found", Map.of("karteId", karteId), null);
            }
            return new KarteScope(patientPk);
        } catch (NoResultException ex) {
            throw AbstractResource.restError(null, Response.Status.NOT_FOUND, "karte_not_found",
                    "Karte was not found", Map.of("karteId", karteId), null);
        }
    }

    private static long positiveLong(JsonNode node, String field) {
        Long value = optionalPositiveLong(node);
        if (value == null) {
            throw badRequest(field, field + " is required");
        }
        return value;
    }

    private static Long optionalPositiveLong(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.canConvertToLong() && node.asLong() > 0L) {
            return node.asLong();
        }
        if (node.isTextual()) {
            try {
                long parsed = Long.parseLong(node.asText().trim());
                return parsed > 0L ? parsed : null;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static String firstText(JsonNode first, JsonNode second) {
        String value = textOrNull(first);
        return value != null ? value : textOrNull(second);
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String value = node.asText(null);
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String normalizeTitle(String title) {
        String normalized = title == null || title.isBlank() ? "無題の診療録下書き" : title.trim();
        if (normalized.length() <= MAX_TITLE_LENGTH) {
            return normalized;
        }
        return normalized.substring(0, MAX_TITLE_LENGTH);
    }

    private static String newDocumentKey(String facilityId, long karteId, String title) {
        return sha256(facilityId + ":" + karteId + ":" + title + ":" + UUID.randomUUID());
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private static jakarta.ws.rs.WebApplicationException badRequest(String field, String message) {
        return AbstractResource.restError(null, Response.Status.BAD_REQUEST, "chart_revision_draft_invalid_request",
                message, Map.of("field", field), null);
    }

    private record KarteScope(Long patientPk) {
    }
}
