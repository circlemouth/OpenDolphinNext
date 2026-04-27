package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.encounter.CanonicalEncounterKeys;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.encounter.ProjectionPatientSummaryRepository;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.rest.OrcaApiProxySupport;
import open.dolphin.rest.ReceptionRealtimeSseSupport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.rest.dto.orca.AcceptanceInventoryRequest;
import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.framework.SessionOperation;

/**
 * REST wrapper for acceptmodv2 (reception mutations).
 */
@Path("/orca/official/visits")
@SessionOperation
public class OrcaVisitResource extends AbstractOrcaWrapperResource {

    private static final Logger LOGGER = Logger.getLogger(OrcaVisitResource.class.getName());
    private static final String OPERATION_VISIT_MUTATION = "visit_mutation";
    private static final String OPERATION_VISIT_LIST = "visit_list";
    private static final String OPERATION_ACCEPTANCE_INVENTORY = "acceptance_inventory";
    private static final ZoneId TOKYO_ZONE = ZoneId.of("Asia/Tokyo");
    private static final DateTimeFormatter ORCA_TIME_FORMAT = DateTimeFormatter.ofPattern("HHmm").withZone(TOKYO_ZONE);

    private OrcaLiveGateway wrapperService;
    private ReceptionRealtimeSseSupport receptionRealtimeSseSupport;
    private ServerConfigurationResolver configurationResolver;
    @Inject
    EncounterProjectionRepository encounterProjectionRepository;
    @Inject
    ProjectionPatientSummaryRepository projectionPatientSummaryRepository;
    @Inject
    KarteServiceBean karteServiceBean;

    public OrcaVisitResource() {
    }

    @Inject
    public OrcaVisitResource(OrcaLiveGateway wrapperService) {
        this.wrapperService = wrapperService;
    }

    @Inject
    void setReceptionRealtimeSseSupport(ReceptionRealtimeSseSupport receptionRealtimeSseSupport) {
        this.receptionRealtimeSseSupport = receptionRealtimeSseSupport;
    }

    @Inject
    void setConfigurationResolver(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    @POST
    @Path("/mutation")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public VisitMutationResponse mutateVisit(@Context HttpServletRequest request,
            VisitMutationRequest body) {
        if (request == null || request.getRemoteUser() == null || request.getRemoteUser().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            markFailureDetails(details, Response.Status.UNAUTHORIZED.getStatusCode(),
                    "remote_user_missing", "Authenticated user is required");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.UNAUTHORIZED, "remote_user_missing",
                    "Authenticated user is required");
        }
        if (body == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.mutation.invalid", "Request payload is required");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.mutation.invalid",
                    "Request payload is required");
        }
        if (body.getRequestNumber() == null || body.getRequestNumber().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_MUTATION);
            details.put("patientId", body.getPatientId());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.mutation.invalid", "requestNumber is required");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.mutation.invalid",
                    "requestNumber is required");
        }
        validateVisitMutationRequest(request, body);
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_VISIT_MUTATION);
        details.put("requestNumber", body.getRequestNumber());
        details.put("patientId", body.getPatientId());
        details.put("acceptanceDate", body.getAcceptanceDate());
        details.put("acceptanceTime", body.getAcceptanceTime());
        applyExplicitAcceptmodWorkarounds(body, details);
        try {
            VisitMutationResponse response = wrapperService.mutateVisit(facilityId, body);
            enrichVisitMutationKeys(facilityId, response);
            persistEncounterProjectionIfNeeded(request, facilityId, body, response, details);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            if (response.getAcceptanceId() != null && !response.getAcceptanceId().isBlank()) {
                details.put("acceptanceId", response.getAcceptanceId());
            }
            publishReceptionRealtimeUpdateIfNeeded(request, facilityId, body, response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.visit.mutation.error", ex.getMessage());
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/list")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public VisitPatientListResponse visitList(@Context HttpServletRequest request,
            VisitPatientListRequest body) {
        if (body == null || (body.getVisitDate() == null && body.getFromDate() == null && body.getToDate() == null)) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_LIST);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.invalid", "visitDate or fromDate/toDate is required");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.invalid",
                    "visitDate or fromDate/toDate is required");
        }
        if (body.getFromDate() != null && body.getToDate() != null
                && body.getToDate().isAfter(body.getFromDate().plusDays(OrcaLiveGateway.MAX_VISIT_RANGE_DAYS - 1))) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_LIST);
            putAuditDetail(details, "visitDate", body.getVisitDate());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.range.tooWide",
                    "visitDate range too wide; up to " + OrcaLiveGateway.MAX_VISIT_RANGE_DAYS + " days are allowed");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.range.tooWide",
                    "visitDate range too wide; up to " + OrcaLiveGateway.MAX_VISIT_RANGE_DAYS + " days are allowed");
        }
        if (body.getRequestNumber() == null || body.getRequestNumber().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_VISIT_LIST);
            putAuditDetail(details, "visitDate", body.getVisitDate());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.visit.invalid", "requestNumber is required");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.invalid",
                    "requestNumber is required");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_VISIT_LIST);
        putAuditDetail(details, "visitDate", body.getVisitDate());
        try {
            VisitPatientListResponse response = wrapperService.getVisitList(facilityId, body);
            enrichVisitKeys(facilityId, response);
            persistEncounterProjectionsFromVisitListIfNeeded(request, facilityId, body, response);
            mergeRuntimeProjectedVisits(facilityId, body, response);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.visit.error", ex.getMessage());
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/acceptance-list")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public AcceptanceInventoryResponse acceptanceInventory(@Context HttpServletRequest request,
            AcceptanceInventoryRequest body) {
        if (request == null || request.getRemoteUser() == null || request.getRemoteUser().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_ACCEPTANCE_INVENTORY);
            markFailureDetails(details, Response.Status.UNAUTHORIZED.getStatusCode(),
                    "remote_user_missing", "Authenticated user is required");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.UNAUTHORIZED, "remote_user_missing",
                    "Authenticated user is required");
        }
        if (body == null || body.getAcceptanceDate() == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_ACCEPTANCE_INVENTORY);
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.acceptance.inventory.invalid", "acceptanceDate is required");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.acceptance.inventory.invalid",
                    "acceptanceDate is required");
        }
        String classCode = normalizeAcceptanceInventoryClass(body.getClassCode());
        if (classCode == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", OPERATION_ACCEPTANCE_INVENTORY);
            putAuditDetail(details, "acceptanceDate", body.getAcceptanceDate());
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.acceptance.inventory.invalid", "classCode must be one of 01, 02, or 03");
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.acceptance.inventory.invalid",
                    "classCode must be one of 01, 02, or 03");
        }
        body.setClassCode(classCode);
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_ACCEPTANCE_INVENTORY);
        putAuditDetail(details, "acceptanceDate", body.getAcceptanceDate());
        details.put("classCode", classCode);
        try {
            AcceptanceInventoryResponse response = wrapperService.getAcceptanceInventory(facilityId, body);
            applyResponseAuditDetails(response, details);
            applyResponseMetadata(response, details);
            details.put("targetReadyRowCount", response.getTargetReadyRowCount());
            details.put("targetReady", response.isTargetReady());
            details.put("rawSensitiveFieldsExcluded", response.isRawSensitiveFieldsExcluded());
            details.put("clientProvidedIdentifiersTrusted", response.isClientProvidedIdentifiersTrusted());
            markSuccessDetails(details);
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.acceptance.inventory.error", ex.getMessage());
            recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    private boolean isQueryRequest(String requestNumber) {
        if (requestNumber == null || requestNumber.isBlank()) {
            return false;
        }
        String normalized = requestNumber.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("class=")) {
            normalized = normalized.substring("class=".length());
        } else if (normalized.startsWith("?class=")) {
            normalized = normalized.substring("?class=".length());
        } else if (normalized.startsWith("request_number=")) {
            normalized = normalized.substring("request_number=".length());
        }
        if (normalized.matches("\\d+")) {
            if (normalized.length() == 1) {
                normalized = "0" + normalized;
            }
            return "00".equals(normalized);
        }
        return switch (normalized) {
            case "query", "read", "get", "list", "inquiry" -> true;
            default -> false;
        };
    }

    void setWrapperService(OrcaLiveGateway wrapperService) {
        this.wrapperService = wrapperService;
    }

    void setReceptionRealtimeSseSupportForTest(ReceptionRealtimeSseSupport receptionRealtimeSseSupport) {
        this.receptionRealtimeSseSupport = receptionRealtimeSseSupport;
    }

    void setConfigurationResolverForTest(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    private void publishReceptionRealtimeUpdateIfNeeded(HttpServletRequest request,
            String facilityId,
            VisitMutationRequest body,
            VisitMutationResponse response,
            Map<String, Object> details) {
        if (receptionRealtimeSseSupport == null || body == null || response == null) {
            return;
        }
        if (isPushReceptionLive()) {
            return;
        }
        String normalizedRequestNumber = normalizeRequestNumber(body.getRequestNumber());
        if ("00".equals(normalizedRequestNumber)) {
            return;
        }
        if (!hasCanonicalAcceptance(response)) {
            return;
        }
        if (facilityId == null || facilityId.isBlank()) {
            return;
        }
        String patientId = resolvePatientId(body, response);
        String date = normalizeEventDate(response.getAcceptanceDate());
        if (date == null || date.isBlank()) {
            date = normalizeEventDate(body.getAcceptanceDate());
        }
        try {
            receptionRealtimeSseSupport.publishReceptionUpdate(
                    facilityId,
                    date,
                    patientId,
                    normalizedRequestNumber,
                    response.getRunId());
        } catch (RuntimeException ex) {
            LOGGER.log(Level.FINE, "Failed to publish reception realtime update", ex);
        }
    }

    private void persistEncounterProjectionIfNeeded(HttpServletRequest request,
            String facilityId,
            VisitMutationRequest body,
            VisitMutationResponse response,
            Map<String, Object> details) {
        if (response == null || encounterProjectionRepository == null || body == null) {
            return;
        }
        if (!"01".equals(normalizeRequestNumber(body.getRequestNumber()))) {
            return;
        }
        if (!hasCanonicalAcceptance(response)) {
            return;
        }
        String patientId = resolvePatientId(body, response);
        if (patientId == null || patientId.isBlank()) {
            return;
        }
        Instant acceptanceDatetime = resolveAcceptanceInstant(response.getAcceptanceDate(), response.getAcceptanceTime(),
                body.getAcceptanceDate(), body.getAcceptanceTime());
        if (acceptanceDatetime == null) {
            return;
        }
        Long karteId = resolveKarteId(facilityId, patientId);
        String encounterKey = response.getEncounterKey();
        if (encounterKey == null || encounterKey.isBlank()) {
            encounterKey = CanonicalEncounterKeys.optionalEncounterKey(facilityId, response.getAcceptanceId());
        }
        if (encounterKey == null || encounterKey.isBlank()) {
            return;
        }
        String ownerUserId = request != null ? request.getRemoteUser() : null;
        encounterProjectionRepository.upsertCheckedIn(new EncounterProjectionRepository.EncounterUpsertCommand(
                encounterKey,
                facilityId,
                patientId,
                karteId,
                response.getScheduleKey(),
                response.getAcceptanceId(),
                acceptanceDatetime,
                "checked_in",
                null,
                null,
                null,
                ownerUserId,
                null,
                "{}",
                null,
                1L,
                Instant.now()));
        if (details != null) {
            details.put("encounterProjectionPersisted", true);
            details.put("encounterKey", encounterKey);
            if (karteId != null) {
                details.put("karteId", karteId);
            }
        }
    }

    private void persistEncounterProjectionsFromVisitListIfNeeded(HttpServletRequest request,
            String facilityId,
            VisitPatientListRequest body,
            VisitPatientListResponse response) {
        if (response == null || encounterProjectionRepository == null || body == null) {
            return;
        }
        if (!"01".equals(normalizeRequestNumber(body.getRequestNumber()))) {
            return;
        }
        String ownerUserId = request != null ? request.getRemoteUser() : null;
        Instant projectedAt = Instant.now();
        String fallbackVisitDate = body.getVisitDate() != null ? body.getVisitDate().toString() : null;
        for (VisitPatientListResponse.VisitEntry visit : response.getVisits()) {
            if (visit == null) {
                continue;
            }
            String encounterKey = normalize(visit.getEncounterKey());
            String acceptanceId = normalize(visit.getVoucherNumber());
            String patientId = visit.getPatient() != null ? normalize(visit.getPatient().getPatientId()) : null;
            Instant acceptanceDatetime = resolveAcceptanceInstant(
                    visit.getUpdateDate(),
                    visit.getUpdateTime(),
                    fallbackVisitDate,
                    null);
            if (encounterKey == null
                    || acceptanceId == null
                    || patientId == null
                    || acceptanceDatetime == null
                    || encounterProjectionRepository.findByEncounterKey(encounterKey) != null) {
                continue;
            }
            encounterProjectionRepository.upsertCheckedIn(new EncounterProjectionRepository.EncounterUpsertCommand(
                    encounterKey,
                    facilityId,
                    patientId,
                    resolveKarteId(facilityId, patientId),
                    normalize(visit.getScheduleKey()),
                    acceptanceId,
                    acceptanceDatetime,
                    "checked_in",
                    null,
                    null,
                    null,
                    ownerUserId,
                    null,
                    "{}",
                    projectedAt,
                    1L,
                    projectedAt));
        }
    }

    private String resolvePatientId(VisitMutationRequest body, VisitMutationResponse response) {
        if (body.getPatientId() != null && !body.getPatientId().isBlank()) {
            return body.getPatientId().trim();
        }
        if (response.getPatient() != null
                && response.getPatient().getPatientId() != null
                && !response.getPatient().getPatientId().isBlank()) {
            return response.getPatient().getPatientId().trim();
        }
        return null;
    }

    private boolean hasCanonicalAcceptance(VisitMutationResponse response) {
        if (response == null) {
            return false;
        }
        String acceptanceId = response.getAcceptanceId();
        if (acceptanceId == null || acceptanceId.isBlank()) {
            return false;
        }
        String encounterKey = response.getEncounterKey();
        return encounterKey != null && !encounterKey.isBlank();
    }

    private Long resolveKarteId(String facilityId, String patientId) {
        if (karteServiceBean == null || facilityId == null || facilityId.isBlank() || patientId == null || patientId.isBlank()) {
            return null;
        }
        try {
            var karte = karteServiceBean.getKarte(facilityId, patientId, null);
            if (karte == null || karte.getId() <= 0) {
                return null;
            }
            return karte.getId();
        } catch (RuntimeException ex) {
            LOGGER.log(Level.FINE, "Failed to resolve karte for encounter projection", ex);
            return null;
        }
    }

    private Instant resolveAcceptanceInstant(String responseDate, String responseTime, String requestDate, String requestTime) {
        String date = normalizeEventDate(responseDate);
        if (date == null) {
            date = normalizeEventDate(requestDate);
        }
        LocalTime time = parseAcceptanceTime(responseTime);
        if (time == null) {
            time = parseAcceptanceTime(requestTime);
        }
        if (date == null || time == null) {
            return null;
        }
        try {
            return LocalDateTime.of(LocalDate.parse(date), time).atZone(TOKYO_ZONE).toInstant();
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private LocalTime parseAcceptanceTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        try {
            if (trimmed.matches("\\d{2}:\\d{2}:\\d{2}")) {
                return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("HH:mm:ss"));
            }
            if (trimmed.matches("\\d{2}:\\d{2}")) {
                return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("HH:mm"));
            }
            if (trimmed.matches("\\d{6}")) {
                return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("HHmmss"));
            }
            if (trimmed.matches("\\d{4}")) {
                return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("HHmm"));
            }
        } catch (DateTimeParseException ex) {
            return null;
        }
        return null;
    }

    private String normalizeRequestNumber(String requestNumber) {
        if (requestNumber == null || requestNumber.isBlank()) {
            return requestNumber;
        }
        String normalized = requestNumber.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("class=")) {
            normalized = normalized.substring("class=".length());
        } else if (normalized.startsWith("?class=")) {
            normalized = normalized.substring("?class=".length());
        } else if (normalized.startsWith("request_number=")) {
            normalized = normalized.substring("request_number=".length());
        }
        if (normalized.matches("\\d+")) {
            if (normalized.length() == 1) {
                normalized = "0" + normalized;
            }
            return normalized;
        }
        return switch (normalized) {
            case "create", "register", "add" -> "01";
            case "delete", "cancel", "remove" -> "02";
            case "update", "modify" -> "03";
            case "claim", "claim-send", "claim-send-info", "send-claim" -> "04";
            case "query", "read", "get", "list", "inquiry" -> "00";
            default -> normalized;
        };
    }

    private String normalizeAcceptanceInventoryClass(String value) {
        String normalized = value == null || value.isBlank() ? "01" : value.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("class=")) {
            normalized = normalized.substring("class=".length());
        } else if (normalized.startsWith("?class=")) {
            normalized = normalized.substring("?class=".length());
        }
        if (normalized.matches("\\d")) {
            normalized = "0" + normalized;
        }
        return switch (normalized) {
            case "01", "02", "03" -> normalized;
            case "active", "accounting-wait" -> "01";
            case "completed", "accounting-completed" -> "02";
            case "all" -> "03";
            default -> null;
        };
    }

    private void validateVisitMutationRequest(HttpServletRequest request, VisitMutationRequest body) {
        String normalizedRequestNumber = normalizeRequestNumber(body.getRequestNumber());
        if (body.getPatientId() == null || body.getPatientId().isBlank()) {
            rejectVisitMutationRequest(request, body, "patientId is required");
        }
        boolean hasAcceptanceId = body.getAcceptanceId() != null && !body.getAcceptanceId().isBlank();
        boolean hasAcceptanceDate = body.getAcceptanceDate() != null && !body.getAcceptanceDate().isBlank();
        boolean hasAcceptanceTime = body.getAcceptanceTime() != null && !body.getAcceptanceTime().isBlank();
        boolean hasDepartmentCode = body.getDepartmentCode() != null && !body.getDepartmentCode().isBlank();
        boolean hasPhysicianCode = body.getPhysicianCode() != null && !body.getPhysicianCode().isBlank();
        switch (normalizedRequestNumber) {
            case "00" -> {
                // Query requests may use acceptanceId, acceptanceDate, or patientId-only lookup.
            }
            case "01" -> {
                if (!hasAcceptanceDate || !hasAcceptanceTime) {
                    rejectVisitMutationRequest(request, body, "acceptanceDate and acceptanceTime are required");
                }
            }
            case "02" -> {
                if (!hasAcceptanceId && (!hasAcceptanceDate || !hasAcceptanceTime)) {
                    rejectVisitMutationRequest(request, body,
                            "acceptanceId or acceptanceDate and acceptanceTime are required");
                }
            }
            case "03" -> {
                if (!hasAcceptanceDate || !hasAcceptanceTime || !hasDepartmentCode || !hasPhysicianCode) {
                    rejectVisitMutationRequest(request, body,
                            "acceptanceDate, acceptanceTime, departmentCode and physicianCode are required");
                }
            }
            case "04" -> {
                if (body.getClaimSendInfo() == null || body.getClaimSendInfo().isBlank()) {
                    rejectVisitMutationRequest(request, body, "claimSendInfo is required");
                }
                if (!hasAcceptanceId && (!hasAcceptanceDate || !hasAcceptanceTime || !hasDepartmentCode)) {
                    rejectVisitMutationRequest(request, body,
                            "acceptanceId or acceptanceDate, acceptanceTime and departmentCode are required");
                }
            }
            default -> {
            }
        }
    }

    private boolean isPushReceptionLive() {
        ServerConfigurationResolver resolver = configurationResolver != null ? configurationResolver : new ServerConfigurationResolver();
        var settings = resolver.orcaPush();
        return settings.enabled() && !settings.shadowMode() && settings.receptionEnabled();
    }

    private void applyExplicitAcceptmodWorkarounds(VisitMutationRequest body, Map<String, Object> details) {
        if (body == null) {
            return;
        }
        String acceptancePush = body.getAcceptancePush();
        if (acceptancePush == null || acceptancePush.isBlank()) {
            return;
        }
        ServerConfigurationResolver resolver = configurationResolver != null ? configurationResolver : new ServerConfigurationResolver();
        if (!resolver.orcaAcceptmodSuppressAcceptancePush()) {
            return;
        }
        details.put("acceptancePushOriginal", acceptancePush);
        details.put("acceptancePushSuppressed", true);
        body.setAcceptancePush(null);
    }

    private void rejectVisitMutationRequest(HttpServletRequest request, VisitMutationRequest body, String message) {
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", OPERATION_VISIT_MUTATION);
        if (body != null) {
            details.put("patientId", body.getPatientId());
            details.put("requestNumber", body.getRequestNumber());
        }
        markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                "orca.visit.mutation.invalid", message);
        recordAudit(request, AUDIT_APPOINTMENT_OUTPATIENT_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
        throw restError(request, Response.Status.BAD_REQUEST, "orca.visit.mutation.invalid", message);
    }

    private String normalizeEventDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return trimmed;
        }
        if (trimmed.matches("\\d{8}")) {
            return trimmed.substring(0, 4) + "-" + trimmed.substring(4, 6) + "-" + trimmed.substring(6, 8);
        }
        try {
            return LocalDate.parse(trimmed).toString();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private void enrichVisitKeys(String facilityId, VisitPatientListResponse response) {
        if (response == null) {
            return;
        }
        response.getVisits().forEach(visit -> {
            visit.setScheduleKey(CanonicalEncounterKeys.optionalScheduleKey(facilityId, visit.getSequentialNumber()));
            visit.setEncounterKey(CanonicalEncounterKeys.optionalEncounterKey(facilityId, visit.getVoucherNumber()));
        });
    }

    private void enrichVisitMutationKeys(String facilityId, VisitMutationResponse response) {
        if (response == null) {
            return;
        }
        response.setScheduleKey(CanonicalEncounterKeys.optionalScheduleKey(facilityId, response.getVisitNumber()));
        response.setEncounterKey(CanonicalEncounterKeys.optionalEncounterKey(facilityId, response.getAcceptanceId()));
    }

    private void mergeRuntimeProjectedVisits(String facilityId,
            VisitPatientListRequest body,
            VisitPatientListResponse response) {
        if (response == null || encounterProjectionRepository == null || body == null) {
            return;
        }
        LocalDate fromDate = body.getVisitDate() != null ? body.getVisitDate() : body.getFromDate();
        LocalDate toDate = body.getVisitDate() != null ? body.getVisitDate() : body.getToDate();
        if (fromDate == null || toDate == null) {
            return;
        }
        List<EncounterProjectionRepository.EncounterRow> projectedRows =
                encounterProjectionRepository.findByFacilityAndAcceptanceRange(
                        facilityId,
                        fromDate.atStartOfDay(TOKYO_ZONE).toInstant(),
                        toDate.plusDays(1).atStartOfDay(TOKYO_ZONE).toInstant());
        if (projectedRows.isEmpty()) {
            return;
        }

        HashSet<String> seenEncounterKeys = new HashSet<>();
        HashSet<String> seenAcceptanceIds = new HashSet<>();
        HashSet<String> seenScheduleKeys = new HashSet<>();
        for (VisitPatientListResponse.VisitEntry visit : response.getVisits()) {
            collectKey(seenEncounterKeys, visit.getEncounterKey());
            collectKey(seenAcceptanceIds, visit.getVoucherNumber());
            collectKey(seenScheduleKeys, visit.getScheduleKey());
        }

        boolean merged = false;
        for (EncounterProjectionRepository.EncounterRow row : projectedRows) {
            if ("cancelled".equalsIgnoreCase(normalize(row.businessState()))) {
                continue;
            }
            boolean alreadyPresent =
                    containsKey(seenEncounterKeys, row.encounterKey())
                            || containsKey(seenAcceptanceIds, row.orcaAcceptanceId())
                            || containsKey(seenScheduleKeys, row.scheduleKey());
            if (alreadyPresent) {
                continue;
            }
            VisitPatientListResponse.VisitEntry visit = new VisitPatientListResponse.VisitEntry();
            visit.setScheduleKey(row.scheduleKey());
            visit.setEncounterKey(row.encounterKey());
            visit.setUpdateDate(fromDate.toString());
            visit.setUpdateTime(ORCA_TIME_FORMAT.format(row.acceptanceDatetime()));
            visit.setPatient(projectionPatientSummaryRepository != null
                    ? projectionPatientSummaryRepository.findByFacilityAndPatientId(facilityId, row.patientId())
                    : null);
            response.getVisits().add(visit);
            collectKey(seenEncounterKeys, row.encounterKey());
            collectKey(seenAcceptanceIds, row.orcaAcceptanceId());
            collectKey(seenScheduleKeys, row.scheduleKey());
            merged = true;
        }
        if (merged) {
            response.setRecordsReturned(response.getVisits().size());
            response.setFallbackUsed(true);
        }
    }

    private void collectKey(HashSet<String> sink, String value) {
        String normalized = normalize(value);
        if (normalized != null) {
            sink.add(normalized);
        }
    }

    private boolean containsKey(HashSet<String> keys, String value) {
        String normalized = normalize(value);
        return normalized != null && keys.contains(normalized);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
