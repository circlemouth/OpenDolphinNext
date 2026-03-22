package open.dolphin.rest.orca;

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
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseEntry;
import open.dolphin.rest.dto.orca.DiseaseMutationRequest;
import open.dolphin.rest.dto.orca.DiseaseMutationResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.orca.rest.ORCAConnection;

/**
 * Disease import/mutation wrappers (`/orca/disease`).
 */
@Path("/orca/disease")
public class OrcaDiseaseResource extends AbstractOrcaRestResource {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            .withLocale(Locale.JAPAN)
            .withZone(ZoneId.systemDefault());
    private static final String ORCA_MASTER_DEFAULT_END_DATE = "99999999";
    private static final Pattern ORCA_BASE_DISEASE_CODE_PATTERN = Pattern.compile("^\\d{7}$");
    private static final String QUERY_DISEASE_MASTER_EXACT
            = "select byomeicd, byomei, haisiymd from tbl_byomei where byomei = ? and haisiymd >= ?";
    private static final String QUERY_DISEASE_MASTER_PREFIX
            = "select byomeicd, byomei, haisiymd from tbl_byomei where byomei like ? and haisiymd >= ?";

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private ORCAConnection orcaConnection;

    @GET
    @Path("/import/{patientId}")
    @Produces(MediaType.APPLICATION_JSON)
    public DiseaseImportResponse getDiseases(
            @Context HttpServletRequest request,
            @PathParam("patientId") String patientId,
            @QueryParam("from") String from,
            @QueryParam("to") String to,
            @QueryParam("activeOnly") @DefaultValue("false") boolean activeOnly) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);

        if (patientId == null || patientId.isBlank()) {
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "patientId");
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                    "invalid_request", "patientId is required");
            recordAudit(request, "ORCA_DISEASE_IMPORT", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "patientId", "patientId is required");
        }
        Date fromDate = parseDate(from, ModelUtils.AD1800);
        Date toDate = parseDate(to, new Date());

        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            Map<String, Object> audit = buildNotFoundAudit(facilityId, patientId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(),
                    "patient_not_found", "Patient not found");
            recordAudit(request, "ORCA_DISEASE_IMPORT", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found",
                    "Patient not found", audit, null);
        }
        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, fromDate);
        if (karte == null) {
            Map<String, Object> audit = buildKarteNotFoundAudit(facilityId, patientId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(),
                    "karte_not_found", "Karte not found");
            recordAudit(request, "ORCA_DISEASE_IMPORT", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found", audit, null);
        }
        boolean orcaDatasourceAvailable = isOrcaDatasourceAvailable();
        List<RegisteredDiagnosisModel> diagnoses = karteServiceBean.getDiagnosis(karte.getId(), fromDate, activeOnly);

        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBaseDate(formatDate(fromDate));
        diagnoses.stream()
                .filter(model -> model.getStarted() == null || !model.getStarted().after(toDate))
                .map(this::toEntry)
                .forEach(response::addDisease);
        if (!orcaDatasourceAvailable) {
            response.addWarning("ORCA datasource unavailable; returning local disease list");
        }

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("diseaseCount", diagnoses.size());
        recordAudit(request, "ORCA_DISEASE_IMPORT", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public DiseaseMutationResponse postDisease(@Context HttpServletRequest request, DiseaseMutationRequest payload) {
        return mutateDisease(request, payload);
    }

    @POST
    @Path("/v3")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public DiseaseMutationResponse postDiseaseV3(@Context HttpServletRequest request, DiseaseMutationRequest payload) {
        return mutateDisease(request, payload);
    }

    private DiseaseMutationResponse mutateDisease(HttpServletRequest request, DiseaseMutationRequest payload) {
        String runId = resolveRunId(request);
        String remoteUser = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String patientId = requireDiseasePatientId(request, payload, facilityId, runId);
        requireDiseasePatient(request, facilityId, patientId);
        List<DiseaseMutationRequest.MutationEntry> operations = requireDiseaseOperations(request, payload, facilityId, patientId, runId);
        KarteBean karte = requireDiseaseKarte(request, facilityId, patientId);
        UserModel user = userServiceBean.getUser(remoteUser);

        List<RegisteredDiagnosisModel> adds = new ArrayList<>();
        List<RegisteredDiagnosisModel> updates = new ArrayList<>();
        List<Long> removes = new ArrayList<>();

        for (DiseaseMutationRequest.MutationEntry entry : operations) {
            applyDiseaseMutationEntry(request, facilityId, patientId, runId, entry, karte, user, adds, updates, removes);
        }

        List<Long> createdIds = adds.isEmpty() ? List.of() : karteServiceBean.addDiagnosis(adds);
        if (!updates.isEmpty()) {
            karteServiceBean.updateDiagnosis(updates);
        }
        if (!removes.isEmpty()) {
            karteServiceBean.removeDiagnosis(removes);
        }

        DiseaseMutationResponse response = new DiseaseMutationResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setCreatedDiagnosisIds(createdIds);
        response.setUpdatedDiagnosisIds(updates.stream().map(RegisteredDiagnosisModel::getId).toList());
        response.setRemovedDiagnosisIds(removes);

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", payload.getPatientId());
        audit.put("runId", runId);
        audit.put("created", createdIds.size());
        audit.put("updated", updates.size());
        audit.put("removed", removes.size());
        recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    private String requireDiseasePatientId(HttpServletRequest request, DiseaseMutationRequest payload, String facilityId,
            String runId) {
        if (payload == null || payload.getPatientId() == null || payload.getPatientId().isBlank()) {
            Map<String, Object> audit = buildDiseaseMutationAudit(facilityId, null, runId);
            failDiseaseMutationRequest(request, audit, "patientId", "patientId is required");
        }
        return payload.getPatientId().trim();
    }

    private PatientModel requireDiseasePatient(HttpServletRequest request, String facilityId, String patientId) {
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            Map<String, Object> audit = buildNotFoundAudit(facilityId, patientId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(),
                    "patient_not_found", "Patient not found");
            recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found", audit, null);
        }
        return patient;
    }

    private List<DiseaseMutationRequest.MutationEntry> requireDiseaseOperations(HttpServletRequest request,
            DiseaseMutationRequest payload, String facilityId, String patientId, String runId) {
        if (payload.getOperations() == null || payload.getOperations().isEmpty()) {
            Map<String, Object> audit = buildDiseaseMutationAudit(facilityId, patientId, runId);
            failDiseaseMutationRequest(request, audit, "operations", "operations is required");
        }
        return payload.getOperations();
    }

    private KarteBean requireDiseaseKarte(HttpServletRequest request, String facilityId, String patientId) {
        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, ModelUtils.AD1800);
        if (karte == null) {
            Map<String, Object> audit = buildKarteNotFoundAudit(facilityId, patientId);
            markFailureDetails(audit, Response.Status.NOT_FOUND.getStatusCode(),
                    "karte_not_found", "Karte not found");
            recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found", audit, null);
        }
        return karte;
    }

    private void applyDiseaseMutationEntry(HttpServletRequest request, String facilityId, String patientId, String runId,
            DiseaseMutationRequest.MutationEntry entry, KarteBean karte, UserModel user, List<RegisteredDiagnosisModel> adds,
            List<RegisteredDiagnosisModel> updates, List<Long> removes) {
        if (entry == null || entry.getOperation() == null) {
            return;
        }
        String operation = entry.getOperation().toLowerCase(Locale.ROOT);
        if (!isSupportedOperation(operation)) {
            Map<String, Object> audit = buildDiseaseMutationAudit(facilityId, patientId, runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "operation");
            audit.put("operation", entry.getOperation());
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                    "invalid_request", "operation is invalid");
            recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "operation", "operation is invalid");
        }
        if (("create".equals(operation) || "update".equals(operation))
                && (entry.getDiagnosisName() == null || entry.getDiagnosisName().isBlank())) {
            Map<String, Object> audit = buildDiseaseMutationAudit(facilityId, patientId, runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", "diagnosisName");
            audit.put("operation", entry.getOperation());
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                    "invalid_request", "diagnosisName is required");
            recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, "diagnosisName", "diagnosisName is required");
        }

        Date startDate = null;
        Date endDate = null;
        if ("create".equals(operation) || "update".equals(operation)) {
            startDate = requireMutationDate(request, facilityId, patientId, runId,
                    entry.getOperation(), "startDate", entry.getStartDate(), true);
            endDate = requireMutationDate(request, facilityId, patientId, runId,
                    entry.getOperation(), "endDate", entry.getEndDate(), false);
        }

        RegisteredDiagnosisModel diagnosis = buildDiagnosis(
                entry,
                karte,
                user,
                startDate,
                endDate,
                resolveDiagnosisCodeIfNeeded(entry.getDiagnosisCode(), entry.getDiagnosisName(), entry.getStartDate())
        );
        switch (operation) {
            case "create" -> adds.add(diagnosis);
            case "update" -> updates.add(diagnosis);
            case "delete" -> {
                if (entry.getDiagnosisId() != null) {
                    removes.add(entry.getDiagnosisId());
                }
            }
            default -> {
            }
        }
    }

    private Map<String, Object> buildDiseaseMutationAudit(String facilityId, String patientId, String runId) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        if (patientId != null) {
            audit.put("patientId", patientId);
        }
        audit.put("runId", runId);
        return audit;
    }

    private void failDiseaseMutationRequest(HttpServletRequest request, Map<String, Object> audit, String field,
            String message) {
        audit.put("validationError", Boolean.TRUE);
        audit.put("field", field);
        markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                "invalid_request", message);
        recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, field, message);
    }

    private RegisteredDiagnosisModel buildDiagnosis(DiseaseMutationRequest.MutationEntry entry,
            KarteBean karte, UserModel user, Date startDate, Date endDate, String diagnosisCode) {

        RegisteredDiagnosisModel model = new RegisteredDiagnosisModel();
        if (entry.getDiagnosisId() != null) {
            model.setId(entry.getDiagnosisId());
        }
        model.setKarteBean(karte);
        model.setUserModel(user);
        model.setDiagnosis(entry.getDiagnosisName());
        model.setDiagnosisCode(diagnosisCode);
        model.setCategory(entry.getCategory());
        String categoryDesc = entry.getSuspectedFlag();
        if (categoryDesc == null || categoryDesc.isBlank()) {
            categoryDesc = entry.getCategory();
        }
        model.setCategoryDesc(categoryDesc);
        model.setCategoryCodeSys("ORCA");
        if (entry.getOutcome() != null && !entry.getOutcome().isBlank()) {
            model.setOutcome(entry.getOutcome());
            model.setOutcomeDesc(entry.getOutcome());
            model.setOutcomeCodeSys("ORCA");
        }
        model.setFirstEncounterDate(formatDate(startDate));
        model.setDepartment(entry.getDepartmentCode());
        model.setStatus(IInfoModel.STATUS_FINAL);
        Date now = new Date();
        model.setRecorded(now);
        model.setConfirmed(startDate);
        model.setStarted(startDate);
        if (endDate != null) {
            model.setEnded(endDate);
        }
        return model;
    }

    private String resolveDiagnosisCodeIfNeeded(String requestedCode, String diagnosisName, String startDate) {
        String normalizedRequestedCode = normalizeDiseaseTerm(requestedCode);
        if (normalizedRequestedCode != null && !normalizedRequestedCode.isBlank()) {
            return normalizedRequestedCode;
        }
        String normalizedName = normalizeDiseaseTerm(diagnosisName);
        if (normalizedName == null || normalizedName.isBlank()) {
            return null;
        }

        String referenceDate = normalizeMasterReferenceDate(startDate);
        Map<String, List<MasterDiseaseEntry>> cache = new HashMap<>();

        String exactAnyCode = pickSingleCode(lookupCodesByType(normalizedName, referenceDate, cache, MasterCodeType.ANY));
        if (exactAnyCode != null) {
            return exactAnyCode;
        }

        return resolveCompositeDiagnosisCode(normalizedName, referenceDate, cache);
    }

    private String resolveCompositeDiagnosisCode(String diagnosisName, String referenceDate,
            Map<String, List<MasterDiseaseEntry>> cache) {
        int length = diagnosisName.length();
        if (length < 2) {
            return null;
        }
        Set<String> candidates = new LinkedHashSet<>();

        for (int split = 1; split < length; split++) {
            String prefix = diagnosisName.substring(0, split);
            String base = diagnosisName.substring(split);
            String prefixCode = pickSingleCode(lookupCodesByType(prefix, referenceDate, cache, MasterCodeType.MODIFIER));
            String baseCode = pickSingleCode(lookupCodesByType(base, referenceDate, cache, MasterCodeType.BASE));
            if (prefixCode != null && baseCode != null) {
                candidates.add(composeDiseaseCode(prefixCode, baseCode, null));
            }
        }

        for (int split = length - 1; split > 0; split--) {
            String base = diagnosisName.substring(0, split);
            String suffix = diagnosisName.substring(split);
            String baseCode = pickSingleCode(lookupCodesByType(base, referenceDate, cache, MasterCodeType.BASE));
            String suffixCode = pickSingleCode(lookupCodesByType(suffix, referenceDate, cache, MasterCodeType.MODIFIER));
            if (baseCode != null && suffixCode != null) {
                candidates.add(composeDiseaseCode(null, baseCode, suffixCode));
            }
        }

        for (int left = 1; left < length - 1; left++) {
            for (int right = left + 1; right < length; right++) {
                String prefix = diagnosisName.substring(0, left);
                String base = diagnosisName.substring(left, right);
                String suffix = diagnosisName.substring(right);
                String prefixCode = pickSingleCode(lookupCodesByType(prefix, referenceDate, cache, MasterCodeType.MODIFIER));
                String baseCode = pickSingleCode(lookupCodesByType(base, referenceDate, cache, MasterCodeType.BASE));
                String suffixCode = pickSingleCode(lookupCodesByType(suffix, referenceDate, cache, MasterCodeType.MODIFIER));
                if (prefixCode != null && baseCode != null && suffixCode != null) {
                    candidates.add(composeDiseaseCode(prefixCode, baseCode, suffixCode));
                }
            }
        }

        return pickSingleCode(candidates);
    }

    private Set<String> lookupCodesByType(String term, String referenceDate,
            Map<String, List<MasterDiseaseEntry>> cache, MasterCodeType codeType) {
        String normalizedTerm = normalizeDiseaseTerm(term);
        if (normalizedTerm == null || normalizedTerm.isBlank()) {
            return Set.of();
        }

        List<MasterDiseaseEntry> entries = cache.computeIfAbsent(
                normalizedTerm,
                key -> queryDiseaseMasterEntries(key, referenceDate)
        );
        if (entries.isEmpty()) {
            return Set.of();
        }

        String termKey = normalizeDiseaseNameKey(normalizedTerm);
        List<MasterDiseaseEntry> sameNameEntries = entries.stream()
                .filter(entry -> termKey.equals(normalizeDiseaseNameKey(entry.name())))
                .toList();
        List<MasterDiseaseEntry> targetEntries = sameNameEntries.isEmpty() ? entries : sameNameEntries;

        Set<String> codes = new LinkedHashSet<>();
        for (MasterDiseaseEntry entry : targetEntries) {
            String code = normalizeDiseaseTerm(entry.code());
            if (code == null || code.isBlank()) {
                continue;
            }
            boolean isBaseCode = ORCA_BASE_DISEASE_CODE_PATTERN.matcher(code).matches();
            if (codeType == MasterCodeType.BASE && !isBaseCode) {
                continue;
            }
            if (codeType == MasterCodeType.MODIFIER && isBaseCode) {
                continue;
            }
            codes.add(code);
        }
        return codes;
    }

    private List<MasterDiseaseEntry> queryDiseaseMasterEntries(String term, String referenceDate) {
        if (term == null || term.isBlank()) {
            return List.of();
        }
        try (Connection connection = resolveOrcaConnection().getConnection()) {
            List<MasterDiseaseEntry> exact = executeDiseaseMasterQuery(connection, QUERY_DISEASE_MASTER_EXACT, term, referenceDate);
            if (!exact.isEmpty()) {
                return exact;
            }
            return executeDiseaseMasterQuery(connection, QUERY_DISEASE_MASTER_PREFIX, term + "%", referenceDate);
        } catch (SQLException ex) {
            return List.of();
        }
    }

    private List<MasterDiseaseEntry> executeDiseaseMasterQuery(Connection connection, String sql, String term, String referenceDate)
            throws SQLException {
        List<MasterDiseaseEntry> entries = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, term);
            statement.setString(2, referenceDate);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    entries.add(new MasterDiseaseEntry(
                            resultSet.getString(1),
                            resultSet.getString(2),
                            resultSet.getString(3)
                    ));
                }
            }
        }
        return entries;
    }

    private String normalizeMasterReferenceDate(String startDate) {
        if (startDate != null) {
            String normalized = startDate.replace("-", "").trim();
            if (normalized.matches("\\d{8}")) {
                return normalized;
            }
        }
        return ORCA_MASTER_DEFAULT_END_DATE;
    }

    private String composeDiseaseCode(String prefixCode, String baseCode, String suffixCode) {
        List<String> parts = new ArrayList<>(3);
        if (prefixCode != null && !prefixCode.isBlank()) {
            parts.add(prefixCode);
        }
        parts.add(baseCode);
        if (suffixCode != null && !suffixCode.isBlank()) {
            parts.add(suffixCode);
        }
        return String.join(".", parts);
    }

    private String pickSingleCode(Set<String> codes) {
        if (codes == null || codes.size() != 1) {
            return null;
        }
        return codes.iterator().next();
    }

    private String normalizeDiseaseTerm(String term) {
        if (term == null) {
            return null;
        }
        return term.trim();
    }

    private String normalizeDiseaseNameKey(String name) {
        String normalized = normalizeDiseaseTerm(name);
        if (normalized == null) {
            return "";
        }
        return normalized.replace(" ", "").replace("　", "");
    }

    private enum MasterCodeType {
        ANY,
        BASE,
        MODIFIER
    }

    private record MasterDiseaseEntry(String code, String name, String disUseDate) {
    }

    private DiseaseEntry toEntry(RegisteredDiagnosisModel model) {
        DiseaseEntry entry = new DiseaseEntry();
        entry.setDiagnosisId(model.getId());
        entry.setDiagnosisName(model.getDiagnosis());
        entry.setDiagnosisCode(model.getDiagnosisCode());
        entry.setDepartmentCode(model.getDepartment());
        entry.setInsuranceCombinationNumber(model.getRelatedHealthInsurance());
        entry.setStartDate(model.getStartDate());
        entry.setEndDate(model.getEnded() != null ? formatDate(model.getEnded()) : null);
        entry.setOutcome(model.getDiagnosisOutcomeModel() != null ? model.getDiagnosisOutcomeModel().getOutcome() : null);
        entry.setCategory(model.getCategory());
        entry.setSuspectedFlag(model.getCategoryDesc());
        return entry;
    }

    private Map<String, Object> buildNotFoundAudit(String facilityId, String patientId) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("apiResult", "10");
        audit.put("apiResultMessage", "該当データなし");
        return audit;
    }

    private DiseaseImportResponse buildUnavailableResponse(String runId, String patientId, Date baseDate,
            String errorCode, String errorMessage) {
        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setApiResult("E90");
        response.setApiResultMessage("ORCA未接続");
        response.setErrorCode(errorCode);
        response.setErrorMessage(errorMessage);
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBaseDate(formatDate(baseDate));
        response.setDiseases(new ArrayList<>());
        response.addWarning("ORCA datasource unavailable; returning empty list");
        return response;
    }

    private void recordUnavailableAudit(HttpServletRequest request, String facilityId, String patientId,
            String runId, String reason) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("status", "orca_unavailable");
        audit.put("reason", reason);
        recordAudit(request, "ORCA_DISEASE_IMPORT", audit, AuditEventEnvelope.Outcome.FAILURE);
    }

    private boolean isOrcaDatasourceAvailable() {
        try (Connection connection = resolveOrcaConnection().getConnection()) {
            return true;
        } catch (SQLException ex) {
            return false;
        }
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

    private Date requireMutationDate(HttpServletRequest request, String facilityId, String patientId, String runId,
            String operation, String field, String input, boolean required) {
        if (input == null || input.isBlank()) {
            if (!required) {
                return null;
            }
            Map<String, Object> audit = new HashMap<>();
            audit.put("facilityId", facilityId);
            audit.put("patientId", patientId);
            audit.put("runId", runId);
            audit.put("validationError", Boolean.TRUE);
            audit.put("field", field);
            audit.put("operation", operation);
            markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                    "invalid_request", field + " is required");
            recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
            throw validationError(request, field, field + " is required");
        }

        Date parsed = parseStrictIsoDate(input);
        if (parsed != null) {
            return parsed;
        }

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("validationError", Boolean.TRUE);
        audit.put("field", field);
        audit.put("operation", operation);
        markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(),
                "invalid_request", field + " must be yyyy-MM-dd");
        recordAudit(request, "ORCA_DISEASE_MUTATION", audit, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, field, field + " must be yyyy-MM-dd");
    }

    private Date parseStrictIsoDate(String input) {
        if (input == null) {
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(input.trim());
            return Date.from(date.atStartOfDay(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private boolean isSupportedOperation(String operation) {
        return "create".equals(operation) || "update".equals(operation) || "delete".equals(operation);
    }

    private ORCAConnection resolveOrcaConnection() {
        return orcaConnection != null ? orcaConnection : ORCAConnection.current();
    }
}
