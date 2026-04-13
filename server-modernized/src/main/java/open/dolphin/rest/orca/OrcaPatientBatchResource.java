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
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.rest.dto.orca.FormerNameHistoryRequest;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import open.dolphin.session.framework.SessionOperation;

/**
 * REST wrapper for patient synchronization endpoints.
 */
@Path("/orca/official")
@SessionOperation
public class OrcaPatientBatchResource extends AbstractOrcaWrapperResource {

    private OrcaLiveGateway wrapperService;

    public OrcaPatientBatchResource() {
    }

    @Inject
    public OrcaPatientBatchResource(OrcaLiveGateway wrapperService) {
        this.wrapperService = wrapperService;
    }

    @POST
    @Path("/patients/id-list")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientIdListResponse patientIdList(@Context HttpServletRequest request,
            PatientIdListRequest body) {
        if (body == null || body.getStartDate() == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientIdList");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.id.invalid", "startDate is required");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.id.invalid",
                    "startDate is required");
        }
        if (body.getEndDate() != null && body.getEndDate().isBefore(body.getStartDate())) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientIdList");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.id.invalid", "endDate must be on or after startDate");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.id.invalid",
                    "endDate must be on or after startDate");
        }
        java.time.LocalDate resolvedEndDate = body.getEndDate() != null ? body.getEndDate() : body.getStartDate();
        if (body.getEndDate() == null) {
            body.setEndDate(resolvedEndDate);
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "patientIdList");
        putAuditDetail(details, "startDate", body.getStartDate());
        putAuditDetail(details, "endDate", resolvedEndDate);
        details.put("includeTestPatient", body.isIncludeTestPatient());
        if (body.getClassCode() != null && !body.getClassCode().isBlank()) {
            details.put("classCode", body.getClassCode());
        }
        try {
            PatientIdListResponse response = wrapperService.getPatientIdList(facilityId, body);
            applyResponseAuditDetails(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.patient.id.error", ex.getMessage());
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/patients/batch")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientBatchResponse patientBatch(@Context HttpServletRequest request,
            PatientBatchRequest body) {
        if (body == null || body.getPatientIds().isEmpty()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientBatch");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.batch.invalid", "patientIds must contain at least one entry");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.batch.invalid",
                    "patientIds must contain at least one entry");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "patientBatch");
        details.put("patientIdCount", body.getPatientIds().size());
        try {
            PatientBatchResponse response = wrapperService.getPatientBatch(facilityId, body);
            applyResponseAuditDetails(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.patient.batch.error", ex.getMessage());
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/patients/name-search")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientSearchResponse patientSearch(@Context HttpServletRequest request,
            PatientNameSearchRequest body) {
        if (body == null || body.getName() == null || body.getName().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientNameSearch");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.search.invalid", "name is required");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.search.invalid",
                    "name is required");
        }
        if (body.getBirthEndDate() != null && body.getBirthStartDate() == null) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientNameSearch");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.search.invalid", "birthStartDate is required when birthEndDate is provided");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.search.invalid",
                    "birthStartDate is required when birthEndDate is provided");
        }
        if (body.getBirthStartDate() != null && body.getBirthEndDate() != null
                && body.getBirthEndDate().isBefore(body.getBirthStartDate())) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "patientNameSearch");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.search.invalid", "birthEndDate must be after birthStartDate");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.search.invalid",
                    "birthEndDate must be after birthStartDate");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "patientNameSearch");
        details.put("namePresent", true);
        details.put("nameLength", body.getName().trim().length());
        if (body.getKana() != null && !body.getKana().isBlank()) {
            details.put("kanaPresent", true);
        }
        if (body.getBirthStartDate() != null) {
            putAuditDetail(details, "birthStartDate", body.getBirthStartDate());
        }
        if (body.getBirthEndDate() != null) {
            putAuditDetail(details, "birthEndDate", body.getBirthEndDate());
        }
        if (body.getSex() != null && !body.getSex().isBlank()) {
            details.put("sex", body.getSex());
        }
        if (body.getInOut() != null && !body.getInOut().isBlank()) {
            details.put("inOut", body.getInOut());
        }
        try {
            PatientSearchResponse response = wrapperService.searchPatients(facilityId, body);
            applyResponseAuditDetails(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.patient.search.error", ex.getMessage());
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/insurance/combinations")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public InsuranceCombinationResponse insuranceCombinations(@Context HttpServletRequest request,
            InsuranceCombinationRequest body) {
        if (body == null || body.getPatientId() == null || body.getPatientId().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "insuranceCombinations");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.insurance.invalid", "patientId is required");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.insurance.invalid",
                    "patientId is required");
        }
        java.time.LocalDate rangeStartDate = parseIsoDate(body.getRangeStart());
        java.time.LocalDate rangeEndDate = parseIsoDate(body.getRangeEnd());
        if (rangeStartDate != null && rangeEndDate != null && rangeEndDate.isBefore(rangeStartDate)) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "insuranceCombinations");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.insurance.invalid", "rangeEnd must be on or after rangeStart");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.insurance.invalid",
                    "rangeEnd must be on or after rangeStart");
        }
        String resolvedBaseDate = body.getBaseDate();
        if (resolvedBaseDate == null || resolvedBaseDate.isBlank()) {
            resolvedBaseDate = (body.getRangeStart() != null && !body.getRangeStart().isBlank())
                    ? body.getRangeStart()
                    : java.time.LocalDate.now().toString();
            body.setBaseDate(resolvedBaseDate);
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "insuranceCombinations");
        details.put("patientId", body.getPatientId());
        details.put("baseDate", resolvedBaseDate);
        if (body.getRangeStart() != null && !body.getRangeStart().isBlank()) {
            details.put("rangeStart", body.getRangeStart());
        }
        if (body.getRangeEnd() != null && !body.getRangeEnd().isBlank()) {
            details.put("rangeEnd", body.getRangeEnd());
        }
        try {
            InsuranceCombinationResponse response = wrapperService.getInsuranceCombinations(facilityId, body);
            applyResponseAuditDetails(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.patient.insurance.error", ex.getMessage());
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    @POST
    @Path("/patients/former-names")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public FormerNameHistoryResponse formerNames(@Context HttpServletRequest request,
            FormerNameHistoryRequest body) {
        if (body == null || body.getPatientId() == null || body.getPatientId().isBlank()) {
            Map<String, Object> details = newAuditDetails(request);
            details.put("operation", "formerNames");
            markFailureDetails(details, Response.Status.BAD_REQUEST.getStatusCode(),
                    "orca.patient.former-name.invalid", "patientId is required");
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.BAD_REQUEST, "orca.patient.former-name.invalid",
                    "patientId is required");
        }
        String facilityId = requireFacilityId(request);
        Map<String, Object> details = newAuditDetails(request);
        details.put("operation", "formerNames");
        details.put("patientId", body.getPatientId());
        try {
            FormerNameHistoryResponse response = wrapperService.getFormerNames(facilityId, body);
            applyResponseAuditDetails(response, details);
            markSuccessDetails(details);
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.SUCCESS);
            return response;
        } catch (RuntimeException ex) {
            markFailureDetails(details, Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                    "orca.patient.former-name.error", ex.getMessage());
            recordAudit(request, AUDIT_SYNC_PATIENTS_ACTION, details, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }
    }

    void setWrapperService(OrcaLiveGateway wrapperService) {
        this.wrapperService = wrapperService;
    }

    private java.time.LocalDate parseIsoDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(value);
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
