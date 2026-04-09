package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import open.dolphin.rest.dto.orca.PrescriptionClaimComment;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionOrderDoImportRequest;
import open.dolphin.rest.dto.orca.PrescriptionOrderDoImportResponse;
import open.dolphin.rest.dto.orca.PrescriptionOrderFetchResponse;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import open.dolphin.rest.dto.orca.PrescriptionOrderSaveResponse;
import open.dolphin.session.PatientServiceBean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/orca/prescription-orders")
@Produces(MediaType.APPLICATION_JSON)
public class OrcaPrescriptionOrderResource extends AbstractOrcaRestResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaPrescriptionOrderResource.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private PrescriptionOrderRepository prescriptionOrderRepository;

    @GET
    public PrescriptionOrderFetchResponse getLatestOrder(
            @Context HttpServletRequest request,
            @QueryParam("patientId") String patientId,
            @QueryParam("encounterId") String encounterId,
            @QueryParam("encounterDate") String encounterDate) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        if (!hasText(patientId)) {
            recordValidationFailure(request, facilityId, null, runId, "patientId", "patientId is required",
                    "ORCA_PRESCRIPTION_ORDER_FETCH");
            throw validationError(request, "patientId", "patientId is required");
        }

        String normalizedPatientId = patientId.trim();
        ensurePatientExists(request, facilityId, normalizedPatientId, runId, "ORCA_PRESCRIPTION_ORDER_FETCH");
        LocalDate resolvedEncounterDate = parseOptionalDate(request, "encounterDate", encounterDate,
                facilityId, normalizedPatientId, runId, "ORCA_PRESCRIPTION_ORDER_FETCH");
        String resolvedEncounterId = trimToNull(encounterId);

        Optional<PrescriptionOrderRepository.StoredPrescriptionOrder> stored =
                prescriptionOrderRepository.findLatest(facilityId, normalizedPatientId, resolvedEncounterId, resolvedEncounterDate);

        PrescriptionOrderFetchResponse response = new PrescriptionOrderFetchResponse();
        response.setRunId(runId);
        response.setPatientId(normalizedPatientId);
        response.setEncounterId(resolvedEncounterId);
        response.setEncounterDate(resolvedEncounterDate != null ? resolvedEncounterDate.toString() : null);

        if (stored.isEmpty()) {
            response.setApiResult("01");
            response.setApiResultMessage("処方オーダーは未登録です");
            response.setFound(false);
            response.setOrder(null);
        } else {
            PrescriptionOrder order = decodeOrderOrThrow(request, stored.get(), facilityId, normalizedPatientId,
                    runId, "ORCA_PRESCRIPTION_ORDER_FETCH");
            response.setApiResult("00");
            response.setApiResultMessage("処理終了");
            response.setFound(true);
            response.setOrder(order);
            if (!hasText(response.getEncounterId())) {
                response.setEncounterId(trimToNull(order.getEncounterId()));
            }
            if (!hasText(response.getEncounterDate())) {
                response.setEncounterDate(normalizeDateText(order.getEncounterDate()));
            }
        }

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", normalizedPatientId);
        audit.put("encounterId", resolvedEncounterId);
        audit.put("encounterDate", response.getEncounterDate());
        audit.put("found", response.isFound());
        audit.put("runId", runId);
        recordAudit(request, "ORCA_PRESCRIPTION_ORDER_FETCH", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public PrescriptionOrderSaveResponse saveOrder(
            @Context HttpServletRequest request,
            PrescriptionOrder payload) {

        String runId = resolveRunId(request);
        String remoteUser = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);

        if (payload == null) {
            recordValidationFailure(request, facilityId, null, runId, "payload", "payload is required",
                    "ORCA_PRESCRIPTION_ORDER_SAVE");
            throw validationError(request, "payload", "payload is required");
        }
        if (!hasText(payload.getPatientId())) {
            recordValidationFailure(request, facilityId, null, runId, "patientId", "patientId is required",
                    "ORCA_PRESCRIPTION_ORDER_SAVE");
            throw validationError(request, "patientId", "patientId is required");
        }

        String patientId = payload.getPatientId().trim();
        ensurePatientExists(request, facilityId, patientId, runId, "ORCA_PRESCRIPTION_ORDER_SAVE");
        LocalDate encounterDate = parseOptionalDate(request, "encounterDate", payload.getEncounterDate(),
                facilityId, patientId, runId, "ORCA_PRESCRIPTION_ORDER_SAVE");
        LocalDate performDate = parseOptionalDate(request, "performDate", payload.getPerformDate(),
                facilityId, patientId, runId, "ORCA_PRESCRIPTION_ORDER_SAVE");

        PrescriptionOrder normalized = copyOrder(payload);
        normalized.setPatientId(patientId);
        normalized.setEncounterId(trimToNull(normalized.getEncounterId()));
        normalized.setEncounterDate(encounterDate != null ? encounterDate.toString() : null);
        normalized.setPerformDate(performDate != null ? performDate.toString() : null);
        validateClaimCommentCodes(request, normalized, facilityId, patientId, runId, "ORCA_PRESCRIPTION_ORDER_SAVE");

        String json = writeJsonOrThrow(request, normalized, facilityId, patientId, runId, "ORCA_PRESCRIPTION_ORDER_SAVE");
        Instant now = Instant.now();
        long orderId = prescriptionOrderRepository.save(
                facilityId,
                patientId,
                normalized.getEncounterId(),
                encounterDate,
                performDate,
                json,
                now,
                remoteUser);

        PrescriptionOrderSaveResponse response = new PrescriptionOrderSaveResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setOrderId(orderId);
        response.setPatientId(patientId);
        response.setEncounterId(normalized.getEncounterId());
        response.setEncounterDate(normalized.getEncounterDate());
        response.setOrder(normalized);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("encounterId", normalized.getEncounterId());
        audit.put("encounterDate", normalized.getEncounterDate());
        audit.put("orderId", orderId);
        audit.put("runId", runId);
        recordAudit(request, "ORCA_PRESCRIPTION_ORDER_SAVE", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    @POST
    @Path("/do-import")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public PrescriptionOrderDoImportResponse doImport(
            @Context HttpServletRequest request,
            PrescriptionOrderDoImportRequest payload) {

        String runId = resolveRunId(request);
        String remoteUser = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        DoImportContext context = validateDoImportRequest(request, payload, runId, facilityId);
        PrescriptionOrder baseOrder = loadBaseOrder(request, context, facilityId, runId);
        DoImportResult result = mergeDoImportOrder(request, payload, context, baseOrder, facilityId, remoteUser, runId);
        long orderId = saveDoImportOrder(facilityId, context.patientId(), remoteUser, result);
        PrescriptionOrderDoImportResponse response = buildDoImportResponse(runId, orderId, context.patientId(), result);
        recordDoImportSuccess(request, facilityId, context.patientId(), runId, orderId, response);
        return response;
    }

    private DoImportContext validateDoImportRequest(
            HttpServletRequest request,
            PrescriptionOrderDoImportRequest payload,
            String runId,
            String facilityId) {
        if (payload == null) {
            recordValidationFailure(request, facilityId, null, runId, "payload", "payload is required",
                    "ORCA_PRESCRIPTION_DO_IMPORT");
            throw validationError(request, "payload", "payload is required");
        }
        if (!hasText(payload.getPatientId())) {
            recordValidationFailure(request, facilityId, null, runId, "patientId", "patientId is required",
                    "ORCA_PRESCRIPTION_DO_IMPORT");
            throw validationError(request, "patientId", "patientId is required");
        }
        if (payload.getDoOrder() == null) {
            recordValidationFailure(request, facilityId, payload.getPatientId(), runId, "doOrder", "doOrder is required",
                    "ORCA_PRESCRIPTION_DO_IMPORT");
            throw validationError(request, "doOrder", "doOrder is required");
        }
        String patientId = payload.getPatientId().trim();
        ensurePatientExists(request, facilityId, patientId, runId, "ORCA_PRESCRIPTION_DO_IMPORT");
        LocalDate targetEncounterDate = parseOptionalDate(request, "encounterDate", payload.getEncounterDate(),
                facilityId, patientId, runId, "ORCA_PRESCRIPTION_DO_IMPORT");
        String targetEncounterId = trimToNull(payload.getEncounterId());
        validateClaimCommentCodes(request, payload.getDoOrder(), facilityId, patientId, runId, "ORCA_PRESCRIPTION_DO_IMPORT");
        return new DoImportContext(patientId, targetEncounterId, targetEncounterDate);
    }

    private PrescriptionOrder loadBaseOrder(
            HttpServletRequest request,
            DoImportContext context,
            String facilityId,
            String runId) {
        Optional<PrescriptionOrderRepository.StoredPrescriptionOrder> stored =
                prescriptionOrderRepository.findLatest(
                        facilityId, context.patientId(), context.targetEncounterId(), context.targetEncounterDate());
        return stored
                .map(row -> decodeOrderOrThrow(
                        request, row, facilityId, context.patientId(), runId, "ORCA_PRESCRIPTION_DO_IMPORT"))
                .orElseGet(PrescriptionOrder::new);
    }

    private DoImportResult mergeDoImportOrder(
            HttpServletRequest request,
            PrescriptionOrderDoImportRequest payload,
            DoImportContext context,
            PrescriptionOrder baseOrder,
            String facilityId,
            String remoteUser,
            String runId) {
        Instant now = Instant.now();
        List<String> warnings = new ArrayList<>();
        PrescriptionOrder merged = OrcaPrescriptionOrderImportSupport.applyDoImport(
                baseOrder,
                payload.getDoOrder(),
                context.patientId(),
                context.targetEncounterId(),
                context.targetEncounterDate(),
                remoteUser,
                runId,
                now,
                warnings,
                OBJECT_MAPPER);

        LocalDate mergedEncounterDate = parseOptionalDate(request, "encounterDate", merged.getEncounterDate(),
                facilityId, context.patientId(), runId, "ORCA_PRESCRIPTION_DO_IMPORT");
        LocalDate performDate = parseOptionalDate(request, "performDate", merged.getPerformDate(),
                facilityId, context.patientId(), runId, "ORCA_PRESCRIPTION_DO_IMPORT");

        merged.setEncounterDate(mergedEncounterDate != null ? mergedEncounterDate.toString() : null);
        merged.setPerformDate(performDate != null ? performDate.toString() : null);
        validateClaimCommentCodes(request, merged, facilityId, context.patientId(), runId, "ORCA_PRESCRIPTION_DO_IMPORT");
        String json = writeJsonOrThrow(
                request, merged, facilityId, context.patientId(), runId, "ORCA_PRESCRIPTION_DO_IMPORT");
        return new DoImportResult(merged, mergedEncounterDate, performDate, now, warnings, json);
    }

    private long saveDoImportOrder(
            String facilityId,
            String patientId,
            String remoteUser,
            DoImportResult result) {
        return prescriptionOrderRepository.save(
                facilityId,
                patientId,
                result.merged().getEncounterId(),
                result.mergedEncounterDate(),
                result.performDate(),
                result.json(),
                result.now(),
                remoteUser);
    }

    private PrescriptionOrderDoImportResponse buildDoImportResponse(
            String runId,
            long orderId,
            String patientId,
            DoImportResult result) {
        PrescriptionOrderDoImportResponse response = new PrescriptionOrderDoImportResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setOrderId(orderId);
        response.setPatientId(patientId);
        response.setEncounterId(result.merged().getEncounterId());
        response.setEncounterDate(result.merged().getEncounterDate());
        response.setOrder(result.merged());
        response.setWarnings(result.warnings());
        return response;
    }

    private void recordDoImportSuccess(
            HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            long orderId,
            PrescriptionOrderDoImportResponse response) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("encounterId", response.getEncounterId());
        audit.put("encounterDate", response.getEncounterDate());
        audit.put("orderId", orderId);
        audit.put("warnings", response.getWarnings().size());
        audit.put("runId", runId);
        recordAudit(request, "ORCA_PRESCRIPTION_DO_IMPORT", audit, AuditEventEnvelope.Outcome.SUCCESS);
    }

    private PrescriptionOrder decodeOrderOrThrow(HttpServletRequest request,
            PrescriptionOrderRepository.StoredPrescriptionOrder stored,
            String facilityId,
            String patientId,
            String runId,
            String action) {
        try {
            return OBJECT_MAPPER.readValue(stored.payloadJson(), PrescriptionOrder.class);
        } catch (JsonProcessingException ex) {
            Map<String, Object> details = new HashMap<>();
            details.put("facilityId", facilityId);
            details.put("patientId", patientId);
            details.put("runId", runId);
            details.put("orderId", stored.id());
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "prescription_order_decode_error", "Failed to decode prescription order payload");
            recordAudit(request, action, details, AuditEventEnvelope.Outcome.FAILURE);
            LOGGER.warn("Failed to decode prescription order payload (patientId={}, orderId={})",
                    patientId, stored.id(), ex);
            throw restError(request,
                    Response.Status.INTERNAL_SERVER_ERROR,
                    "prescription_order_decode_error",
                    "Failed to decode prescription order payload",
                    details,
                    ex);
        }
    }

    private String writeJsonOrThrow(HttpServletRequest request,
            PrescriptionOrder order,
            String facilityId,
            String patientId,
            String runId,
            String action) {
        try {
            return OBJECT_MAPPER.writeValueAsString(order);
        } catch (JsonProcessingException ex) {
            Map<String, Object> details = new HashMap<>();
            details.put("facilityId", facilityId);
            details.put("patientId", patientId);
            details.put("runId", runId);
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "prescription_order_encode_error", "Failed to encode prescription order payload");
            recordAudit(request, action, details, AuditEventEnvelope.Outcome.FAILURE);
            LOGGER.warn("Failed to encode prescription order payload (patientId={})", patientId, ex);
            throw restError(request,
                    Response.Status.INTERNAL_SERVER_ERROR,
                    "prescription_order_encode_error",
                    "Failed to encode prescription order payload",
                    details,
                    ex);
        }
    }

    private void ensurePatientExists(HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            String action) {
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient != null) {
            return;
        }
        Map<String, Object> details = new HashMap<>();
        details.put("facilityId", facilityId);
        details.put("patientId", patientId);
        details.put("runId", runId);
        markFailureDetails(details, Response.Status.NOT_FOUND.getStatusCode(), "patient_not_found", "Patient not found");
        recordAudit(request, action, details, AuditEventEnvelope.Outcome.FAILURE);
        throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found", details, null);
    }

    private void recordValidationFailure(HttpServletRequest request,
            String facilityId,
            String patientId,
            String runId,
            String field,
            String message,
            String action) {
        Map<String, Object> details = new HashMap<>();
        details.put("facilityId", facilityId);
        details.put("patientId", patientId);
        details.put("runId", runId);
        details.put("field", field);
        details.put("validationError", Boolean.TRUE);
        markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", message);
        recordAudit(request, action, details, AuditEventEnvelope.Outcome.FAILURE);
    }

    private LocalDate parseOptionalDate(HttpServletRequest request,
            String field,
            String value,
            String facilityId,
            String patientId,
            String runId,
            String action) {
        if (!hasText(value)) {
            return null;
        }
        try {
            return parseFlexibleDateStrict(value);
        } catch (DateTimeParseException ex) {
            recordValidationFailure(request, facilityId, patientId, runId, field,
                    field + " must be yyyy-MM-dd or yyyyMMdd", action);
            throw validationError(request, field, field + " must be yyyy-MM-dd or yyyyMMdd");
        }
    }

    private LocalDate parseFlexibleDate(String value) {
        return OrcaPrescriptionOrderImportSupport.parseFlexibleDate(value);
    }

    private LocalDate parseFlexibleDateStrict(String value) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.matches("\\d{8}")) {
            return LocalDate.parse(normalized, java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        }
        return LocalDate.parse(normalized);
    }

    private String normalizeDateText(String value) {
        return OrcaPrescriptionOrderImportSupport.normalizeDateText(value);
    }

    private PrescriptionOrder copyOrder(PrescriptionOrder source) {
        if (source == null) {
            return null;
        }
        return OBJECT_MAPPER.convertValue(source, PrescriptionOrder.class);
    }

    private void validateClaimCommentCodes(
            HttpServletRequest request,
            PrescriptionOrder order,
            String facilityId,
            String patientId,
            String runId,
            String action) {
        if (order == null) {
            return;
        }
        List<PrescriptionRp> rps = safeList(order.getRps());
        for (int rpIndex = 0; rpIndex < rps.size(); rpIndex++) {
            PrescriptionRp rp = rps.get(rpIndex);
            if (rp == null) {
                continue;
            }
            List<PrescriptionClaimComment> rpClaimComments = safeList(rp.getClaimComments());
            for (int commentIndex = 0; commentIndex < rpClaimComments.size(); commentIndex++) {
                PrescriptionClaimComment claimComment = rpClaimComments.get(commentIndex);
                if (claimComment == null) {
                    continue;
                }
                String text = trimToNull(claimComment.getText());
                String code = trimToNull(claimComment.getCode());
                if (text != null && code == null) {
                    String field = "rps[" + rpIndex + "].claimComments[" + commentIndex + "].code";
                    String message = "claim comment code is required when text is present";
                    recordValidationFailure(request, facilityId, patientId, runId, field, message, action);
                    throw validationError(request, field, message);
                }
                if (OrcaCommentCarrierRules.isUnknownStructuredPrescriptionClaimCommentFamily(code)) {
                    String field = "rps[" + rpIndex + "].claimComments[" + commentIndex + "].code";
                    String message = "structured claim comment family is unsupported";
                    recordValidationFailure(request, facilityId, patientId, runId, field, message, action);
                    throw validationError(request, field, message);
                }
                if (OrcaCommentCarrierRules.requiresStructuredPrescriptionClaimCommentNote(code)
                        && !hasText(claimComment.getNote())) {
                    String field = "rps[" + rpIndex + "].claimComments[" + commentIndex + "].note";
                    String message = "structured claim comment note is required for this code";
                    recordValidationFailure(request, facilityId, patientId, runId, field, message, action);
                    throw validationError(request, field, message);
                }
            }
            List<PrescriptionDrug> drugs = safeList(rp.getDrugs());
            for (int drugIndex = 0; drugIndex < drugs.size(); drugIndex++) {
                PrescriptionDrug drug = drugs.get(drugIndex);
                if (drug == null) {
                    continue;
                }
                List<PrescriptionClaimComment> claimComments = safeList(drug.getClaimComments());
                for (int commentIndex = 0; commentIndex < claimComments.size(); commentIndex++) {
                    PrescriptionClaimComment claimComment = claimComments.get(commentIndex);
                    if (claimComment == null) {
                        continue;
                    }
                    String text = trimToNull(claimComment.getText());
                    String code = trimToNull(claimComment.getCode());
                    if (text != null && code == null) {
                        String field = "rps[" + rpIndex + "].drugs[" + drugIndex + "].claimComments[" + commentIndex + "].code";
                        String message = "claim comment code is required when text is present";
                        recordValidationFailure(request, facilityId, patientId, runId, field, message, action);
                        throw validationError(request, field, message);
                    }
                    if (OrcaCommentCarrierRules.isUnknownStructuredPrescriptionClaimCommentFamily(code)) {
                        String field = "rps[" + rpIndex + "].drugs[" + drugIndex + "].claimComments[" + commentIndex + "].code";
                        String message = "structured claim comment family is unsupported";
                        recordValidationFailure(request, facilityId, patientId, runId, field, message, action);
                        throw validationError(request, field, message);
                    }
                    if (OrcaCommentCarrierRules.requiresStructuredPrescriptionClaimCommentNote(code)
                            && !hasText(claimComment.getNote())) {
                        String field = "rps[" + rpIndex + "].drugs[" + drugIndex + "].claimComments[" + commentIndex + "].note";
                        String message = "structured claim comment note is required for this code";
                        recordValidationFailure(request, facilityId, patientId, runId, field, message, action);
                        throw validationError(request, field, message);
                    }
                }
            }
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String trimToNull(String value) {
        return OrcaPrescriptionOrderImportSupport.trimToNull(value);
    }

    private String trimToEmpty(String value) {
        return OrcaPrescriptionOrderImportSupport.trimToEmpty(value);
    }

    private <T> List<T> safeList(List<T> source) {
        if (source == null || source.isEmpty()) {
            return new ArrayList<>();
        }
        List<T> copied = new ArrayList<>(source.size());
        for (T item : source) {
            if (Objects.nonNull(item)) {
                copied.add(item);
            }
        }
        return copied;
    }

    private record DoImportContext(String patientId, String targetEncounterId, LocalDate targetEncounterDate) {}

    private record DoImportResult(
            PrescriptionOrder merged,
            LocalDate mergedEncounterDate,
            LocalDate performDate,
            Instant now,
            List<String> warnings,
            String json) {}
}
