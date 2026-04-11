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
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.stream.Collectors;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.rest.dto.orca.MedicalGetRequest;
import open.dolphin.rest.dto.orca.MedicalGetResponse;
import open.dolphin.rest.dto.orca.MedicalGetResponse.MedicalRecordEntry;
import open.dolphin.rest.dto.orca.MedicalGetResponse.PatientSummary;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;

/**
 * Local-only chart medical record wrapper.
 */
@Path("/local/charts")
public class OrcaMedicalResource extends AbstractOrcaRestResource {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            .withLocale(Locale.JAPAN)
            .withZone(ZoneId.systemDefault());
    private static final String ROUTE_NAMESPACE = "local";
    private static final String AUDIT_ACTION = "LOCAL_CHART_MEDICAL_RECORDS_READ";

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @POST
    @Path("/medical-records")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public MedicalGetResponse postMedicalRecords(@Context HttpServletRequest request, MedicalGetRequest payload) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);

        if (payload == null || payload.getPatientId() == null || payload.getPatientId().isBlank()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("routeNamespace", ROUTE_NAMESPACE);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "patientId");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                    "invalid_request", "Patient_ID is required");
            recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "patientId", "Patient_ID is required");
        }

        Date fromDate = parseDate(payload.getFromDate(), ModelUtils.AD1800);
        Date toDate = parseDate(payload.getToDate(), new Date());
        if (fromDate.after(toDate)) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("patientId", payload.getPatientId());
            audit.put("routeNamespace", ROUTE_NAMESPACE);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "fromDate");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                    "invalid_request", "fromDate must be before toDate");
            recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "fromDate", "fromDate must be before toDate");
        }

        PatientModel patient = patientServiceBean.getPatientById(facilityId, payload.getPatientId());
        if (patient == null) {
            Map<String, Object> audit = buildNotFoundAudit(facilityId, payload.getPatientId());
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(),
                    "patient_not_found", "Patient not found");
            recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found",
                    "Patient not found", audit, null);
        }

        KarteBean karte = karteServiceBean.getKarte(facilityId, payload.getPatientId(), fromDate);
        if (karte == null) {
            Map<String, Object> audit = buildKarteNotFoundAudit(facilityId, payload.getPatientId());
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(),
                    "karte_not_found", "Karte not found");
            recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found", audit, null);
        }
        List<DocInfoModel> docInfos = karteServiceBean.getDocumentList(karte.getId(), fromDate, true);

        List<MedicalRecordEntry> entries = docInfos.stream()
                .filter(doc -> doc.getConfirmDate() == null || !doc.getConfirmDate().before(fromDate))
                .filter(doc -> doc.getConfirmDate() == null || !doc.getConfirmDate().after(toDate))
                .map(this::toRecordEntry)
                .collect(Collectors.toList());

        MedicalGetResponse response = MedicalGetResponse.success(runId);
        response.setRouteNamespace(ROUTE_NAMESPACE);
        response.setPatient(toPatientSummary(patient));
        response.setRecords(entries);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", payload.getPatientId());
        audit.put("runId", runId);
        audit.put("recordsReturned", entries.size());
        audit.put("routeNamespace", ROUTE_NAMESPACE);
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    private PatientSummary toPatientSummary(PatientModel patient) {
        PatientSummary summary = new PatientSummary();
        summary.setPatientId(patient.getPatientId());
        summary.setWholeName(patient.getFullName());
        summary.setWholeNameKana(patient.getKanaName());
        summary.setBirthDate(patient.getBirthday() != null ? patient.getBirthday().toString() : null);
        summary.setSex(patient.getGender());
        return summary;
    }

    private MedicalRecordEntry toRecordEntry(DocInfoModel doc) {
        MedicalRecordEntry entry = new MedicalRecordEntry();
        if (doc.getConfirmDate() != null) {
            entry.setPerformDate(formatDate(doc.getConfirmDate()));
        }
        entry.setDepartmentCode(doc.getDepartment());
        if (doc.getDepartmentDesc() != null) {
            String[] parts = doc.getDepartmentDesc().split(",");
            if (parts.length > 0) {
                entry.setDepartmentName(parts[0]);
            }
        }
        entry.setSequentialNumber(doc.getVersionNumber());
        entry.setInsuranceCombinationNumber(doc.getHealthInsuranceGUID());
        entry.setDocumentId(doc.getDocId());
        entry.setDocumentStatus(doc.getStatus());
        if (doc.getConfirmDate() != null) {
            entry.setLastUpdated(formatDate(doc.getConfirmDate()));
        }
        return entry;
    }

    private Map<String, Object> buildNotFoundAudit(String facilityId, String patientId) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("apiResult", "10");
        audit.put("apiResultMessage", "該当データなし");
        audit.put("routeNamespace", ROUTE_NAMESPACE);
        return audit;
    }

    private Map<String, Object> buildKarteNotFoundAudit(String facilityId, String patientId) {
        Map<String, Object> audit = buildNotFoundAudit(facilityId, patientId);
        audit.put("precondition", "karte");
        audit.put("preconditionStatus", "missing");
        return audit;
    }

    private String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return DATE_FORMAT.format(date.toInstant());
    }

    private Date parseDate(String input, Date defaultValue) {
        if (input == null || input.isBlank()) {
            return defaultValue;
        }
        Date parsed = ModelUtils.getDateAsObject(input);
        return parsed != null ? parsed : defaultValue;
    }
}
