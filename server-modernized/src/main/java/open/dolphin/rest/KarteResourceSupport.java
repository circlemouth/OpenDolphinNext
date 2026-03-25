package open.dolphin.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.converter.KarteBeanConverter;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.ObservationModel;
import open.dolphin.infomodel.PatientFreeDocumentModel;
import open.dolphin.infomodel.PatientMemoModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.rest.dto.KarteRevisionDocumentResponse;
import open.dolphin.rest.dto.LegacyKarteListResponse;
import open.dolphin.rest.support.KarteRevisionResponseMapper;
import open.dolphin.rest.support.LegacyJsonSupport;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.UserServiceBean;

final class KarteResourceSupport {

    private static final Logger LOGGER = Logger.getLogger(KarteResourceSupport.class.getName());

    private final AbstractResource resource;
    private final KarteServiceBean karteServiceBean;
    private final UserServiceBean userServiceBean;
    private final ObjectMapper objectMapper;
    private final HttpServletRequest fallbackRequest;

    KarteResourceSupport(AbstractResource resource,
                         KarteServiceBean karteServiceBean,
                         UserServiceBean userServiceBean,
                         ObjectMapper objectMapper,
                         HttpServletRequest fallbackRequest) {
        this.resource = resource;
        this.karteServiceBean = karteServiceBean;
        this.userServiceBean = userServiceBean;
        this.objectMapper = objectMapper;
        this.fallbackRequest = fallbackRequest;
    }

    String firstNonEmpty(String[] params, int index, String fallback) {
        String candidate = (params != null && params.length > index) ? params[index] : null;
        if (candidate != null && !candidate.isBlank()) {
            return candidate;
        }
        return (fallback != null && !fallback.isBlank()) ? fallback : null;
    }

    Long parseLongSafely(String[] params, int index) {
        String candidate = (params != null && params.length > index) ? params[index] : null;
        if (candidate == null || candidate.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(candidate);
        } catch (NumberFormatException e) {
            LOGGER.log(Level.WARNING, "Failed to parse long: " + candidate, e);
            return null;
        }
    }

    boolean parseBooleanOrDefault(String value, boolean defaultValue) {
        return value == null || value.isBlank() ? defaultValue : Boolean.parseBoolean(value);
    }

    Date parseFlexibleDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        Date parsed = resource.parseDate(value);
        if (parsed != null) {
            return parsed;
        }
        try {
            LocalDate localDate = LocalDate.parse(value);
            return Date.from(localDate.atStartOfDay().toInstant(ZoneOffset.UTC));
        } catch (DateTimeParseException e) {
            LOGGER.log(Level.WARNING, "Failed to parse date: " + value, e);
            return null;
        }
    }

    Date parseDateAtStart(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            LocalDate localDate = LocalDate.parse(value.trim());
            return Date.from(localDate.atStartOfDay(ZoneOffset.UTC).toInstant());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    Date parseDateExclusiveEnd(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            LocalDate next = LocalDate.parse(value.trim()).plusDays(1);
            return Date.from(next.atStartOfDay(ZoneOffset.UTC).toInstant());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    KarteBeanConverter toConverter(HttpServletRequest request, KarteBean bean, String context) {
        if (bean == null) {
            Map<String, Object> extras = new HashMap<>();
            extras.put("context", context);
            throw AbstractResource.restError(request, Response.Status.INTERNAL_SERVER_ERROR, "karte_lookup_failed",
                    "Karte result is empty", extras, null);
        }
        KarteBeanConverter conv = new KarteBeanConverter();
        conv.setModel(bean);
        return conv;
    }

    LegacyKarteListResponse.DocumentListResponse toLegacyDocumentListResponse(List<DocumentModel> documents) {
        if (documents == null || documents.isEmpty()) {
            return LegacyKarteListResponse.DocumentListResponse.ofMapped(List.of());
        }
        List<KarteRevisionDocumentResponse> mapped = new ArrayList<>(documents.size());
        for (DocumentModel document : documents) {
            mapped.add(KarteRevisionResponseMapper.map(document));
        }
        return LegacyKarteListResponse.DocumentListResponse.ofMapped(mapped);
    }

    LegacyKarteListResponse.ModuleListResponse toLegacyModuleListResponse(List<ModuleModel> modules) {
        return LegacyKarteListResponse.ModuleListResponse.ofMapped(
                KarteRevisionResponseMapper.mapModuleResponses(modules));
    }

    LegacyKarteListResponse.ModuleListListResponse toLegacyModuleListListResponse(List<List<ModuleModel>> groupedModules) {
        if (groupedModules == null || groupedModules.isEmpty()) {
            return LegacyKarteListResponse.ModuleListListResponse.ofMapped(List.of());
        }
        List<List<KarteRevisionDocumentResponse.ModuleResponse>> mapped = new ArrayList<>(groupedModules.size());
        for (List<ModuleModel> modules : groupedModules) {
            mapped.add(KarteRevisionResponseMapper.mapModuleResponses(modules));
        }
        return LegacyKarteListResponse.ModuleListListResponse.ofMapped(mapped);
    }

    LegacyKarteListResponse.PatientFreeDocumentResponse toLegacyPatientFreeDocumentResponse(PatientFreeDocumentModel model) {
        if (model == null) {
            return null;
        }
        return LegacyKarteListResponse.PatientFreeDocumentResponse.of(
                model.getId(),
                model.getFacilityPatId(),
                model.getConfirmed(),
                model.getComment());
    }

    String requireActorFacilityId(HttpServletRequest request) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        String facility = resource.getRemoteFacility(remoteUser);
        if (facility == null || facility.isBlank()) {
            Map<String, Object> extras = new HashMap<>();
            extras.put("remoteUser", remoteUser);
            throw AbstractResource.restError(request, Response.Status.UNAUTHORIZED, "facility_missing",
                    "Facility identifier is not available", extras, null);
        }
        return facility.trim();
    }

    String normalizeTargetUserId(String actorId, String requestedUserId) {
        if (requestedUserId == null || requestedUserId.isBlank()) {
            return null;
        }
        String trimmed = requestedUserId.trim();
        if (trimmed.contains(IInfoModel.COMPOSITE_KEY_MAKER)) {
            return trimmed;
        }
        String facilityId = resource.getRemoteFacility(actorId);
        if (facilityId == null || facilityId.isBlank()) {
            return null;
        }
        return facilityId + IInfoModel.COMPOSITE_KEY_MAKER + trimmed;
    }

    void ensureUserPropertyAccess(HttpServletRequest request, String actorId, String targetUserId) {
        boolean admin = userServiceBean != null && userServiceBean.isAdmin(actorId);
        if (!admin && !actorId.equals(targetUserId)) {
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied");
        }
        String actorFacility = resource.getRemoteFacility(actorId);
        String targetFacility = resource.getRemoteFacility(targetUserId);
        if (admin && (actorFacility == null || !actorFacility.equals(targetFacility))) {
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied");
        }
    }

    void ensurePatientFacilityAccess(long patientPk, HttpServletRequest request) {
        if (patientPk > 0) {
            HttpServletRequest effectiveRequest = resolveRequest(request);
            ensureFacilityMatch(requireActorFacilityId(effectiveRequest),
                    karteServiceBean.findFacilityIdByPatientPk(patientPk), "patientPk", patientPk, effectiveRequest);
        }
    }

    void ensureKarteFacilityAccess(long karteId, HttpServletRequest request) {
        if (karteId > 0) {
            HttpServletRequest effectiveRequest = resolveRequest(request);
            ensureFacilityMatch(requireActorFacilityId(effectiveRequest),
                    karteServiceBean.findFacilityIdByKarteId(karteId), "karteId", karteId, effectiveRequest);
        }
    }

    void ensureDocumentFacilityAccess(long docId, HttpServletRequest request) {
        if (docId > 0) {
            HttpServletRequest effectiveRequest = resolveRequest(request);
            ensureFacilityMatch(requireActorFacilityId(effectiveRequest),
                    karteServiceBean.findFacilityIdByDocId(docId), "docId", docId, effectiveRequest);
        }
    }

    void ensureAttachmentFacilityAccess(long attachmentId, HttpServletRequest request) {
        if (attachmentId > 0) {
            HttpServletRequest effectiveRequest = resolveRequest(request);
            ensureFacilityMatch(requireActorFacilityId(effectiveRequest),
                    karteServiceBean.findFacilityIdByAttachmentId(attachmentId), "attachmentId", attachmentId, effectiveRequest);
        }
    }

    void ensureSchemaFacilityAccess(long schemaId, HttpServletRequest request) {
        if (schemaId > 0) {
            HttpServletRequest effectiveRequest = resolveRequest(request);
            ensureFacilityMatch(requireActorFacilityId(effectiveRequest),
                    karteServiceBean.findFacilityIdBySchemaId(schemaId), "schemaId", schemaId, effectiveRequest);
        }
    }

    void ensureDiagnosisFacilityAccess(List<RegisteredDiagnosisModel> diagnoses, HttpServletRequest request) {
        Set<Long> karteIds = new LinkedHashSet<>();
        if (diagnoses != null) {
            for (RegisteredDiagnosisModel diagnosis : diagnoses) {
                if (diagnosis != null && diagnosis.getKarteBean() != null && diagnosis.getKarteBean().getId() > 0) {
                    karteIds.add(diagnosis.getKarteBean().getId());
                }
            }
        }
        for (Long karteId : karteIds) {
            ensureKarteFacilityAccess(karteId, request);
        }
    }

    void ensureDiagnosisIdFacilityAccess(long diagnosisId, HttpServletRequest request) {
        if (diagnosisId > 0) {
            HttpServletRequest effectiveRequest = resolveRequest(request);
            ensureFacilityMatch(requireActorFacilityId(effectiveRequest),
                    karteServiceBean.findFacilityIdByDiagnosisId(diagnosisId), "diagnosisId", diagnosisId, effectiveRequest);
        }
    }

    void ensureObservationFacilityAccess(List<ObservationModel> observations, HttpServletRequest request) {
        Set<Long> karteIds = new LinkedHashSet<>();
        if (observations != null) {
            for (ObservationModel observation : observations) {
                if (observation != null && observation.getKarteBean() != null && observation.getKarteBean().getId() > 0) {
                    karteIds.add(observation.getKarteBean().getId());
                }
            }
        }
        for (Long karteId : karteIds) {
            ensureKarteFacilityAccess(karteId, request);
        }
    }

    void ensureObservationFacilityAccess(long observationId, HttpServletRequest request) {
        if (observationId > 0) {
            HttpServletRequest effectiveRequest = resolveRequest(request);
            ensureFacilityMatch(requireActorFacilityId(effectiveRequest),
                    karteServiceBean.findFacilityIdByObservationId(observationId), "observationId", observationId, effectiveRequest);
        }
    }

    void ensurePatientMemoFacilityAccess(PatientMemoModel memo, HttpServletRequest request) {
        if (memo != null && memo.getKarteBean() != null && memo.getKarteBean().getId() > 0) {
            ensureKarteFacilityAccess(memo.getKarteBean().getId(), request);
        }
    }

    <T> T readJson(String json, Class<T> type) throws IOException {
        return LegacyJsonSupport.readBody(json, type, objectMapper);
    }

    private HttpServletRequest resolveRequest(HttpServletRequest explicit) {
        return explicit != null ? explicit : fallbackRequest;
    }

    private void ensureFacilityMatch(String actorFacility,
                                     String targetFacility,
                                     String idName,
                                     long idValue,
                                     HttpServletRequest request) {
        if (actorFacility == null || actorFacility.isBlank()
                || targetFacility == null || targetFacility.isBlank()
                || !actorFacility.equals(targetFacility.trim())) {
            Map<String, Object> details = new HashMap<>();
            details.put("actorFacilityId", actorFacility);
            details.put("targetFacilityId", targetFacility);
            details.put(idName, idValue);
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied",
                    details, null);
        }
    }
}
