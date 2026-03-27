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
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;

@Path("/local-summary/diagnoses")
public class LocalDiagnosisResource extends AbstractResource {

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

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
        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, fromDate);
        if (karte == null) {
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }
        List<RegisteredDiagnosisModel> diagnoses = karteServiceBean.getDiagnosis(karte.getId(), fromDate, activeOnly);
        List<Map<String, Object>> items = new ArrayList<>();
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
            items.add(item);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("patientId", patientId);
        response.put("karteId", karte.getId());
        response.put("runId", resolveTraceId(request));
        response.put("diseases", items);
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
            Long diagnosisId = requireLong(operation, "diagnosisId");
            if ("create".equals(op)) {
                adds.add(toDiagnosis(operation, karte, user, null));
                continue;
            }
            ensureDiagnosisFacilityAccess(diagnosisId, facilityId, request);
            if ("update".equals(op)) {
                updates.add(toDiagnosis(operation, karte, user, diagnosisId));
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

    private RegisteredDiagnosisModel toDiagnosis(Map<String, Object> operation, KarteBean karte, UserModel user, Long diagnosisId) {
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
        model.setOutcome(optionalText(operation, "outcome"));
        model.setOutcomeDesc(optionalText(operation, "outcome"));
        model.setOutcomeCodeSys("LOCAL");
        Date started = parseDate(requireText(operation, "startDate"));
        model.setStarted(started);
        model.setConfirmed(started);
        model.setRecorded(new Date());
        String endDate = optionalText(operation, "endDate");
        if (endDate != null) {
            model.setEnded(parseDate(endDate));
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
}
