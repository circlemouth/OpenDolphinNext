package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.orca.service.DiseaseProjectionService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;

@Path("/local/diagnoses")
public class LocalDiagnosisResource extends AbstractResource {

    private static final List<String> ALLOWED_OUTCOMES = List.of("継続", "治癒", "中止", "再発", "死亡", "転院", "不明");

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private DiseaseProjectionService diseaseProjectionService;

    @GET
    @Path("/{patientId}")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> getDiagnoses(
            @Context HttpServletRequest request,
            @PathParam("patientId") String patientId,
            @QueryParam("from") String from,
            @QueryParam("to") String to,
            @QueryParam("activeOnly") @DefaultValue("false") boolean activeOnly) {
        String facilityId = requireActorFacility(request);
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }
        Date fromDate = ModelUtils.getDateAsObject(from != null ? from : ModelUtils.getDateAsString(ModelUtils.AD1800));
        Date toDate = ModelUtils.getDateAsObject(to != null ? to : ModelUtils.getDateAsString(new Date()));
        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, fromDate);
        if (karte == null) {
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }
        List<RegisteredDiagnosisModel> diagnoses = karteServiceBean.getDiagnosis(karte.getId(), fromDate, activeOnly);
        List<Map<String, Object>> pendingLocalItems = new ArrayList<>();
        for (RegisteredDiagnosisModel diagnosis : diagnoses) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("diagnosisId", diagnosis.getId());
            item.put("karteId", karte.getId());
            item.put("patientId", patientId);
            item.put("diagnosisName", diagnosis.getDiagnosis());
            item.put("diagnosisCode", diagnosis.getDiagnosisCode());
            item.put("departmentCode", diagnosis.getDepartment());
            item.put("startDate", diagnosis.getStarted() != null ? ModelUtils.getDateAsString(diagnosis.getStarted()) : null);
            item.put("endDate", diagnosis.getEnded() != null ? ModelUtils.getDateAsString(diagnosis.getEnded()) : null);
            item.put("outcome", diagnosis.getOutcome());
            item.put("category", diagnosis.getCategory());
            item.put("suspectedFlag", diagnosis.getCategoryDesc());
            item.put("layer", "insurance-local");
            item.put("syncState", "none");
            item.put("readOnly", Boolean.FALSE);
            item.put("candidateOnly", Boolean.FALSE);
            pendingLocalItems.add(item);
        }
        DiseaseImportResponse mirrorResponse = fetchOrcaMirror(request, facilityId, patientId, fromDate, toDate);
        List<DiseaseImportResponse.DiseaseEntry> mirrorEntries =
                mirrorResponse.getDiseases() != null ? mirrorResponse.getDiseases() : List.of();
        projectionService().applyMirrorDiffState(pendingLocalItems, mirrorEntries);
        List<Map<String, Object>> mirrorItems = new ArrayList<>();
        for (DiseaseImportResponse.DiseaseEntry entry : mirrorEntries) {
            mirrorItems.add(toMirrorItem(entry));
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("patientId", patientId);
        response.put("karteId", karte.getId());
        response.put("runId", resolveTraceId(request));
        response.put("sourceOfTruth", "orca");
        response.put("orcaMirrorStatus", mirrorResponse.getOrcaMirrorStatus());
        response.put("diseases", mirrorItems);
        response.put("pendingLocalDiseases", pendingLocalItems);
        return response;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> mutateDiagnoses(@Context HttpServletRequest request, Map<String, Object> payload) {
        String remoteUser = requireRemoteUser(request);
        String facilityId = requireActorFacility(request);
        String patientId = requireText(payload, "patientId");
        Long karteId = requireLong(payload, "karteId");
        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, ModelUtils.AD1800);
        if (karte == null || karte.getId() != karteId) {
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }
        UserModel user = userServiceBean.getUser(remoteUser);
        List<Map<String, Object>> operations = requireOperations(payload.get("operations"));

        List<RegisteredDiagnosisModel> adds = new ArrayList<>();
        List<RegisteredDiagnosisModel> updates = new ArrayList<>();
        List<Long> removes = new ArrayList<>();
        for (Map<String, Object> operation : operations) {
            String op = requireText(operation, "operation").toLowerCase(Locale.ROOT);
            validateInsuranceLocalOperation(operation, request);
            Long diagnosisId = requireLong(operation, "diagnosisId");
            if ("create".equals(op)) {
                adds.add(toDiagnosis(operation, karte, user, null, request));
                continue;
            }
            ensureDiagnosisFacilityAccess(diagnosisId, facilityId, request);
            if ("update".equals(op)) {
                updates.add(toDiagnosis(operation, karte, user, diagnosisId, request));
            } else if ("delete".equals(op)) {
                removes.add(diagnosisId);
            } else {
                throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "operation is invalid");
            }
        }

        List<Long> createdIds = adds.isEmpty() ? List.of() : karteServiceBean.addDiagnosis(adds);
        if (!updates.isEmpty()) {
            karteServiceBean.updateDiagnosis(updates);
        }
        if (!removes.isEmpty()) {
            karteServiceBean.removeDiagnosis(removes);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("runId", resolveTraceId(request));
        response.put("createdDiagnosisIds", createdIds);
        response.put("updatedDiagnosisIds", updates.stream().map(RegisteredDiagnosisModel::getId).toList());
        response.put("removedDiagnosisIds", removes);
        return response;
    }

    private RegisteredDiagnosisModel toDiagnosis(
            Map<String, Object> operation,
            KarteBean karte,
            UserModel user,
            Long diagnosisId,
            HttpServletRequest request) {
        RegisteredDiagnosisModel model = new RegisteredDiagnosisModel();
        if (diagnosisId != null) {
            model.setId(diagnosisId);
        }
        model.setKarteBean(karte);
        model.setUserModel(user);
        model.setDiagnosis(requireText(operation, "diagnosisName"));
        model.setDiagnosisCode(optionalText(operation, "diagnosisCode"));
        model.setDepartment(optionalText(operation, "departmentCode"));
        model.setCategory(optionalText(operation, "category"));
        model.setCategoryDesc(optionalText(operation, "suspectedFlag"));
        model.setCategoryCodeSys("LOCAL");
        String outcome = optionalText(operation, "outcome");
        validateOutcome(outcome, request);
        model.setOutcome(outcome);
        model.setOutcomeDesc(outcome);
        model.setOutcomeCodeSys("LOCAL");
        LocalDate startedDate = parseDiagnosisDate(requireText(operation, "startDate"), "startDate", request);
        Date started = toDate(startedDate);
        model.setStarted(started);
        model.setConfirmed(started);
        model.setRecorded(new Date());
        String endDate = optionalText(operation, "endDate");
        if (endDate != null) {
            LocalDate endedDate = parseDiagnosisDate(endDate, "endDate", request);
            if (endedDate.isBefore(startedDate)) {
                throw restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                        "endDate must be the same as or after startDate");
            }
            model.setEnded(toDate(endedDate));
        }
        model.setStatus(IInfoModel.STATUS_FINAL);
        return model;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> requireOperations(Object value) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            throw new IllegalArgumentException("operations is required");
        }
        List<Map<String, Object>> operations = new ArrayList<>();
        for (Object entry : list) {
            if (entry instanceof Map<?, ?> map) {
                operations.add((Map<String, Object>) map);
            }
        }
        if (operations.isEmpty()) {
            throw new IllegalArgumentException("operations is required");
        }
        return operations;
    }

    private String requireText(Map<String, Object> payload, String key) {
        String value = optionalText(payload, key);
        if (value == null) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", key + " is required");
        }
        return value;
    }

    private static String optionalText(Map<String, Object> payload, String key) {
        Object value = payload != null ? payload.get(key) : null;
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private Long requireLong(Map<String, Object> payload, String key) {
        Object value = payload != null ? payload.get(key) : null;
        if (value == null) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", key + " is required");
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.valueOf(String.valueOf(value));
    }

    private void ensureDiagnosisFacilityAccess(Long diagnosisId, String actorFacility, HttpServletRequest request) {
        String targetFacility = diagnosisId != null ? karteServiceBean.findFacilityIdByDiagnosisId(diagnosisId) : null;
        if (targetFacility == null || actorFacility == null || !actorFacility.equals(targetFacility.trim())) {
            throw restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied");
        }
    }

    private void validateInsuranceLocalOperation(Map<String, Object> operation, HttpServletRequest request) {
        String layer = optionalText(operation, "layer");
        if (layer != null && !"insurance-local".equalsIgnoreCase(layer)) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "only insurance-local authoring is allowed");
        }
        Object candidateOnly = operation != null ? operation.get("candidateOnly") : null;
        if (Boolean.TRUE.equals(candidateOnly) || "true".equalsIgnoreCase(String.valueOf(candidateOnly))) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "candidate disease cannot be authored directly");
        }
    }

    private LocalDate parseDiagnosisDate(String value, String key, HttpServletRequest request) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                    key + " must be a valid yyyy-MM-dd date");
        }
    }

    private void validateOutcome(String outcome, HttpServletRequest request) {
        if (outcome == null || ALLOWED_OUTCOMES.contains(outcome)) {
            return;
        }
        throw restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                "outcome must be one of: " + String.join(", ", ALLOWED_OUTCOMES));
    }

    private static Date toDate(LocalDate value) {
        return Date.from(value.atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    private DiseaseImportResponse fetchOrcaMirror(
            HttpServletRequest request,
            String facilityId,
            String patientId,
            Date fromDate,
            Date toDate) {
        DiseaseImportResponse unavailable = new DiseaseImportResponse();
        unavailable.setRunId(resolveTraceId(request));
        unavailable.setPatientId(patientId);
        unavailable.setOrcaMirrorStatus("unavailable");
        unavailable.setDiseases(List.of());
        if (orcaTransport == null) {
            return unavailable;
        }
        try {
            LocalDate baseDate = toDateOnly(toDate);
            String requestXml = projectionService().buildDiseaseGetRequestXml(patientId, baseDate);
            OrcaTransportResult result = orcaTransport.invoke(
                    facilityId,
                    OrcaEndpoint.DISEASE_GET,
                    OrcaTransportRequest.post(requestXml).withQuery(DiseaseProjectionService.DISEASE_GET_QUERY));
            return projectionService().buildMirrorResponseFromOrca(result, resolveTraceId(request), patientId, fromDate, toDate);
        } catch (RuntimeException ex) {
            return unavailable;
        }
    }

    private DiseaseProjectionService projectionService() {
        if (diseaseProjectionService == null) {
            diseaseProjectionService = new DiseaseProjectionService();
        }
        return diseaseProjectionService;
    }

    private static LocalDate toDateOnly(Date date) {
        Date safeDate = date != null ? date : new Date();
        return safeDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private static Map<String, Object> toMirrorItem(DiseaseImportResponse.DiseaseEntry entry) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("diagnosisId", entry.getDiagnosisId());
        item.put("diagnosisName", entry.getDiagnosisName());
        item.put("diagnosisCode", entry.getDiagnosisCode());
        item.put("departmentCode", entry.getDepartmentCode());
        item.put("insuranceCombinationNumber", entry.getInsuranceCombinationNumber());
        item.put("startDate", entry.getStartDate());
        item.put("endDate", entry.getEndDate());
        item.put("outcome", entry.getOutcome());
        item.put("category", entry.getCategory());
        item.put("suspectedFlag", entry.getSuspectedFlag());
        item.put("layer", "orca-mirror");
        item.put("syncState", entry.getSyncState());
        item.put("readOnly", Boolean.TRUE);
        item.put("candidateOnly", Boolean.FALSE);
        item.put("note", entry.getNote());
        return item;
    }
}
