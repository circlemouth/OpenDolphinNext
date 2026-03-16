package open.dolphin.rest;

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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.rest.orca.AbstractOrcaRestResource;

/**
 * Web client endpoint for /api/orca/patientmodv2/outpatient.
 *
 * <p>Updates are reflected to ORCA (patientmodv2 class=02) and then re-imported (ORCA -> local)
 * so the local patient table stays consistent with ORCA.</p>
 */
@Path("/orca/patientmodv2/outpatient")
public class PatientModV2OutpatientResource extends AbstractResource {

    private static final String DATA_SOURCE_SERVER = "server";
    private static final String DATA_SOURCE_MOCK = "mock";
    private static final String AUDIT_ACTION = "ORCA_PATIENT_MUTATION";
    private static final String ORCA_PATIENTMOD_CLASS = "02";
    private static final int ORCA_UPDATE_MAX_RETRY = 1;
    private static final Set<String> EDITABLE_KEYS = Set.of("name", "kana", "birthDate", "sex", "phone", "zip", "address");

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private OrcaWrapperService orcaWrapperService;

    @Inject
    private OrcaPatientSyncService orcaPatientSyncService;

    void setPatientServiceBean(PatientServiceBean patientServiceBean) {
        this.patientServiceBean = patientServiceBean;
    }

    void setOrcaTransport(OrcaTransport orcaTransport) {
        this.orcaTransport = orcaTransport;
    }

    void setOrcaWrapperService(OrcaWrapperService orcaWrapperService) {
        this.orcaWrapperService = orcaWrapperService;
    }

    void setOrcaPatientSyncService(OrcaPatientSyncService orcaPatientSyncService) {
        this.orcaPatientSyncService = orcaPatientSyncService;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response mutatePatient(@Context HttpServletRequest request, Map<String, Object> payload) {
        return handleMutation(request, payload, DATA_SOURCE_SERVER, false);
    }

    public Response mutatePatientMock(@Context HttpServletRequest request, Map<String, Object> payload) {
        return handleMutation(request, payload, DATA_SOURCE_MOCK, true);
    }

    private Response handleMutation(HttpServletRequest request,
            Map<String, Object> payload,
            String dataSource,
            boolean fallbackUsed) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String traceId = resolveTraceId(request);
        String requestId = resolveRequestId(request, traceId);

        String facilityId = resolveFacilityId(request);
        if (facilityId == null || facilityId.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing",
                    "Facility is required");
        }

        String operation = getNonBlankText(payload, "operation");
        if (operation == null || operation.isBlank()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                    "operation is required");
        }

        PatientPatch patch = toPatientPatch(payload);
        if (patch.patientId == null || patch.patientId.isBlank()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                    "patientId is required");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("runId", runId);
        response.put("traceId", traceId);
        response.put("requestId", requestId);
        response.put("dataSource", dataSource);
        response.put("dataSourceTransition", dataSource);
        response.put("cacheHit", Boolean.FALSE);
        response.put("missingMaster", Boolean.FALSE);
        response.put("fallbackUsed", fallbackUsed);
        response.put("fetchedAt", Instant.now().toString());
        response.put("facilityId", facilityId);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("resource", request != null ? request.getRequestURI() : "/api/orca/patientmodv2/outpatient");
        details.put("operation", operation);
        details.put("patientId", patch.patientId);
        details.put("runId", runId);
        details.put("dataSource", dataSource);
        details.put("dataSourceTransition", dataSource);
        details.put("cacheHit", Boolean.FALSE);
        details.put("missingMaster", Boolean.FALSE);
        details.put("fallbackUsed", fallbackUsed);
        details.put("fetchedAt", response.get("fetchedAt"));
        details.put("facilityId", facilityId);
        if (patch.changedKeys != null && !patch.changedKeys.isEmpty()) {
            details.put("changedKeys", List.copyOf(patch.changedKeys));
        }

        boolean success = false;
        Response.Status status = Response.Status.OK;
        String apiResult = "00";
        String apiResultMessage = "OK";
        PatientModel syncedPatient = null;

        try {
            switch (operation.toLowerCase(Locale.ROOT)) {
                case "create" -> {
                    // Idempotency: if the local patient already exists and the provided payload matches,
                    // return success without calling ORCA.
                    if (patientServiceBean == null) {
                        throw new IllegalStateException("PatientServiceBean is not available");
                    }
                    PatientModel existing = patientServiceBean.getPatientById(facilityId, patch.patientId);
                    if (existing != null) {
                        if (matchesLocalPatient(existing, patch)) {
                            response.put("idempotent", Boolean.TRUE);
                            response.put("idempotentReason", "existing_patient");
                            details.put("idempotent", Boolean.TRUE);
                            details.put("idempotentReason", "existing_patient");
                            syncedPatient = existing;
                            apiResultMessage = "既存患者のためスキップしました";
                            success = true;
                        } else {
                            details.put("idempotent", Boolean.FALSE);
                            details.put("idempotentReason", "existing_patient_conflict");
                            details.put("localPatientDbId", existing.getId());
                            details.put("localPatientSnapshot", toPatientRecord(existing));
                            throw restError(request, Response.Status.CONFLICT, "patient_exists",
                                    "患者が既に存在します。患者IDと内容を確認してください。");
                        }
                    } else {
                        // Treat "create" as "import from ORCA" (ORCA is authoritative for new patient registration).
                        syncedPatient = importFromOrcaAndFetchLocal(facilityId, patch.patientId, runId, details);
                        apiResultMessage = "ORCAから取り込みました";
                        success = true;
                    }
                }
                case "update" -> {
                    OrcaMutationResult result = updateOrcaAndSyncLocal(facilityId, patch, runId, details);
                    syncedPatient = result.patient;
                    apiResult = result.apiResult;
                    apiResultMessage = result.apiResultMessage;
                    success = true;
                }
                case "delete" -> {
                    apiResult = "79";
                    apiResultMessage = "患者削除は電子カルテ側から実行できません（ORCA側で操作してください）";
                    status = Response.Status.FORBIDDEN;
                    success = false;
                }
                default -> {
                    apiResult = "99";
                    apiResultMessage = "Unsupported operation: " + operation;
                    throw restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                            "Unsupported operation: " + operation);
                }
            }
        } catch (RuntimeException ex) {
            details.put("errorMessage", ex.getMessage());
            dispatchAuditEvent(request, details, AUDIT_ACTION, AuditEventEnvelope.Outcome.FAILURE);
            throw ex;
        }

        response.put("apiResult", apiResult);
        response.put("apiResultMessage", apiResultMessage);
        response.put("operation", operation);
        response.put("status", status.getStatusCode());
        if (syncedPatient != null) {
            response.put("patientDbId", syncedPatient.getId());
            response.put("patient", toPatientRecord(syncedPatient));
        } else {
            response.put("patient", patch.toResponse());
        }

        String outcome = success ? "SUCCESS" : "FAILURE";
        Map<String, Object> auditEvent = new LinkedHashMap<>();
        auditEvent.put("action", AUDIT_ACTION);
        auditEvent.put("resource", details.get("resource"));
        auditEvent.put("outcome", outcome);
        auditEvent.put("details", details);
        auditEvent.put("traceId", traceId);
        auditEvent.put("requestId", requestId);
        response.put("auditEvent", auditEvent);

        dispatchAuditEvent(request, details, AUDIT_ACTION,
                success ? AuditEventEnvelope.Outcome.SUCCESS : AuditEventEnvelope.Outcome.FAILURE);

        Response.ResponseBuilder builder = Response.status(status).entity(response);
        applyObservabilityHeaders(builder, runId, traceId, requestId, dataSource, fallbackUsed);
        return builder.build();
    }

    private OrcaMutationResult updateOrcaAndSyncLocal(String facilityId, PatientPatch patch, String runId, Map<String, Object> details) {
        ensureDependencies();
        OrcaPatientBaseline baseline = fetchOrcaPatientBaseline(patch.patientId);
        Set<String> changeSet = resolveChangeSet(patch, baseline);
        details.put("editableKeys", List.copyOf(EDITABLE_KEYS));
        details.put("appliedKeys", List.copyOf(changeSet));

        if (changeSet.isEmpty()) {
            // No ORCA mutation requested. Still refresh local record so the UI can recover from drift.
            PatientModel synced = importFromOrcaAndFetchLocal(facilityId, patch.patientId, runId, details);
            OrcaMutationResult result = new OrcaMutationResult();
            result.apiResult = "00";
            result.apiResultMessage = "変更なし（ORCAから再取り込み）";
            result.patient = synced;
            return result;
        }

        OrcaDesired desired = buildDesired(patch, baseline, changeSet);

        OrcaApiResult last = null;
        boolean updated = false;
        OrcaPatientBaseline currentBaseline = baseline;
        for (int attempt = 0; attempt <= ORCA_UPDATE_MAX_RETRY; attempt++) {
            if (attempt > 0) {
                details.put("orcaRetryAttempt", attempt);
                currentBaseline = fetchOrcaPatientBaseline(patch.patientId);
            }
            OrcaUpdateExecution execution = executeOrcaUpdate(currentBaseline, desired, changeSet);
            last = execution.last;
            if (execution.success) {
                updated = true;
                break;
            }
        }

        if (!updated) {
            Map<String, Object> errorDetails = new LinkedHashMap<>();
            errorDetails.put("patientId", patch.patientId);
            if (last != null) {
                errorDetails.put("orcaApiResult", last.apiResult);
                errorDetails.put("orcaApiResultMessage", last.apiResultMessage);
                errorDetails.put("orcaHttpStatus", last.httpStatus);
            }
            throw restError(null, Response.Status.BAD_GATEWAY, "orca_patient_update_failed",
                    last != null && last.apiResultMessage != null ? last.apiResultMessage : "ORCA patient update failed",
                    errorDetails, null);
        }

        PatientModel synced = importFromOrcaAndFetchLocal(facilityId, patch.patientId, runId, details);
        OrcaMutationResult result = new OrcaMutationResult();
        result.apiResult = last != null && last.apiResult != null ? last.apiResult : "00";
        result.apiResultMessage = last != null && last.apiResultMessage != null ? last.apiResultMessage : "ORCA更新完了";
        result.patient = synced;
        return result;
    }

    private OrcaUpdateExecution executeOrcaUpdate(OrcaPatientBaseline baseline, OrcaDesired desired, Set<String> changeSet) {
        boolean changedNameOrKana = changeSet.contains("name") || changeSet.contains("kana");
        boolean changedBirthDateOrSex = changeSet.contains("birthDate") || changeSet.contains("sex");
        boolean changedAddress = changeSet.contains("phone") || changeSet.contains("zip") || changeSet.contains("address");

        boolean sendKey1 = changedNameOrKana || (changedAddress && !changedBirthDateOrSex);
        boolean sendKey2 = changedBirthDateOrSex;

        OrcaApiResult last = null;
        String matchName = baseline.wholeName;
        String matchKana = baseline.wholeNameKana;

        if (sendKey1) {
            String payload = buildPatientModPayload("1",
                    baseline.patientId,
                    desired.wholeName,
                    desired.wholeNameKana,
                    baseline.birthDate,
                    baseline.sex,
                    desired.zipCode,
                    desired.address,
                    desired.phone1,
                    baseline.phone2);
            last = postPatientMod(payload);
            if (!last.success) {
                return new OrcaUpdateExecution(false, last);
            }
            matchName = desired.wholeName;
            matchKana = desired.wholeNameKana;
        }

        if (sendKey2) {
            String payload = buildPatientModPayload("2",
                    baseline.patientId,
                    matchName,
                    matchKana,
                    desired.birthDate,
                    desired.sex,
                    desired.zipCode,
                    desired.address,
                    desired.phone1,
                    baseline.phone2);
            last = postPatientMod(payload);
            if (!last.success) {
                return new OrcaUpdateExecution(false, last);
            }
        }

        if (last == null) {
            last = new OrcaApiResult();
            last.apiResult = "00";
            last.apiResultMessage = "No-op";
            last.httpStatus = 200;
            last.success = true;
        }
        return new OrcaUpdateExecution(true, last);
    }

    private OrcaPatientBaseline fetchOrcaPatientBaseline(String patientId) {
        if (orcaWrapperService == null) {
            throw new IllegalStateException("OrcaWrapperService is not available");
        }
        PatientBatchRequest req = new PatientBatchRequest();
        req.getPatientIds().add(patientId);
        req.setIncludeInsurance(false);
        PatientBatchResponse res = orcaWrapperService.getPatientBatch(req);
        if (res == null) {
            throw new OrcaGatewayException("ORCA patientlst2v2 response is empty");
        }
        if (!OrcaApiProxySupport.isApiResultSuccess(res.getApiResult())) {
            throw new OrcaGatewayException("ORCA patientlst2v2 failed: " + res.getApiResult() + " " + res.getApiResultMessage());
        }
        if (res.getPatients() == null || res.getPatients().isEmpty()) {
            throw restError(null, Response.Status.NOT_FOUND, "orca_patient_not_found",
                    "ORCA patient not found (patientlst2v2 returned 0 records)");
        }
        PatientDetail detail = res.getPatients().get(0);
        PatientSummary summary = detail != null ? detail.getSummary() : null;
        if (summary == null || summary.getPatientId() == null || summary.getPatientId().isBlank()) {
            throw new OrcaGatewayException("ORCA patient summary is missing Patient_ID");
        }
        OrcaPatientBaseline baseline = new OrcaPatientBaseline();
        baseline.patientId = summary.getPatientId().trim();
        baseline.wholeName = safeTrim(summary.getWholeName());
        baseline.wholeNameKana = safeTrim(summary.getWholeNameKana());
        baseline.birthDate = safeTrim(summary.getBirthDate());
        baseline.sex = normalizeOrcaSexCode(summary.getSex());
        baseline.zipCode = safeTrim(detail != null ? detail.getZipCode() : null);
        baseline.address = safeTrim(detail != null ? detail.getAddress() : null);
        baseline.phone1 = safeTrim(detail != null ? detail.getPhoneNumber1() : null);
        baseline.phone2 = safeTrim(detail != null ? detail.getPhoneNumber2() : null);

        if (baseline.wholeName == null || baseline.wholeName.isBlank()) {
            throw new OrcaGatewayException("ORCA patient WholeName is missing for patientId=" + baseline.patientId);
        }
        if (baseline.wholeNameKana == null || baseline.wholeNameKana.isBlank()) {
            throw new OrcaGatewayException("ORCA patient WholeName_inKana is missing for patientId=" + baseline.patientId);
        }
        if (baseline.birthDate == null || baseline.birthDate.isBlank()) {
            throw new OrcaGatewayException("ORCA patient BirthDate is missing for patientId=" + baseline.patientId);
        }
        if (baseline.sex == null || baseline.sex.isBlank()) {
            throw new OrcaGatewayException("ORCA patient Sex is missing for patientId=" + baseline.patientId);
        }

        return baseline;
    }

    private OrcaDesired buildDesired(PatientPatch patch, OrcaPatientBaseline baseline, Set<String> changeSet) {
        OrcaDesired desired = new OrcaDesired();

        desired.wholeName = changeSet.contains("name") ? safeTrimKeepEmpty(patch.name) : baseline.wholeName;
        desired.wholeNameKana = changeSet.contains("kana") ? safeTrimKeepEmpty(patch.kana) : baseline.wholeNameKana;
        desired.birthDate = changeSet.contains("birthDate") ? safeTrimKeepEmpty(patch.birthDate) : baseline.birthDate;
        desired.sex = changeSet.contains("sex")
                ? requireOrcaSexCode(patch.sex, "sex")
                : baseline.sex;

        if (changeSet.contains("name") && (desired.wholeName == null || desired.wholeName.isBlank())) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "name is required when changed");
        }
        if (changeSet.contains("kana") && (desired.wholeNameKana == null || desired.wholeNameKana.isBlank())) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "kana is required when changed");
        }
        if (changeSet.contains("birthDate")) {
            if (desired.birthDate == null || desired.birthDate.isBlank()) {
                throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "birthDate is required when changed");
            }
            try {
                LocalDate.parse(desired.birthDate);
            } catch (Exception ex) {
                throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "birthDate must be yyyy-MM-dd");
            }
        }

        // Optional fields: keep baseline unless explicitly changed.
        desired.phone1 = resolveOptionalValue(changeSet, "phone", patch.phone, baseline.phone1);
        desired.zipCode = normalizeZipForOrca(resolveOptionalValue(changeSet, "zip", patch.zip, baseline.zipCode));
        desired.address = resolveOptionalValue(changeSet, "address", patch.address, baseline.address);

        return desired;
    }

    private OrcaApiResult postPatientMod(String payloadWithoutMeta) {
        if (orcaTransport == null) {
            throw new IllegalStateException("OrcaTransport is not available");
        }
        String payload = OrcaApiProxySupport.applyQueryMeta(payloadWithoutMeta, OrcaEndpoint.PATIENT_MOD, ORCA_PATIENTMOD_CLASS);
        OrcaTransportResult result = orcaTransport.invokeDetailed(OrcaEndpoint.PATIENT_MOD, OrcaTransportRequest.post(payload));
        OrcaApiResult parsed = new OrcaApiResult();
        parsed.httpStatus = result != null ? result.getStatus() : 0;
        parsed.url = result != null ? result.getUrl() : null;
        String body = result != null ? result.getBody() : null;
        parsed.apiResult = extractTagValue(body, "Api_Result");
        parsed.apiResultMessage = extractTagValue(body, "Api_Result_Message");
        parsed.success = OrcaApiProxySupport.isApiResultSuccess(parsed.apiResult);
        if (parsed.apiResultMessage == null || parsed.apiResultMessage.isBlank()) {
            parsed.apiResultMessage = parsed.success ? "OK" : "ORCA error";
        }
        return parsed;
    }

    private String buildPatientModPayload(String modKey,
            String patientId,
            String wholeName,
            String wholeNameKana,
            String birthDate,
            String sex,
            String zipCode,
            String address,
            String phone1,
            String phone2) {
        if (patientId == null || patientId.isBlank()) {
            throw new IllegalArgumentException("patientId is required");
        }
        if (wholeName == null || wholeName.isBlank()) {
            throw new IllegalArgumentException("wholeName is required");
        }
        if (wholeNameKana == null || wholeNameKana.isBlank()) {
            throw new IllegalArgumentException("wholeNameKana is required");
        }
        if (birthDate == null || birthDate.isBlank()) {
            throw new IllegalArgumentException("birthDate is required");
        }
        if (sex == null || sex.isBlank()) {
            throw new IllegalArgumentException("sex is required");
        }

        String normalizedZip = zipCode;
        if (normalizedZip != null) {
            normalizedZip = normalizeZipForOrca(normalizedZip);
        }

        // Include optional tags only when they have baseline values or explicit edits.
        String zipTag = normalizedZip != null && !normalizedZip.isBlank() ? normalizedZip : (normalizedZip != null ? "" : null);
        String addressTag = address != null && !address.isBlank() ? address : (address != null ? "" : null);
        String phone1Tag = phone1 != null && !phone1.isBlank() ? phone1 : (phone1 != null ? "" : null);
        String phone2Tag = phone2 != null && !phone2.isBlank() ? phone2 : (phone2 != null ? "" : null);

        StringBuilder builder = new StringBuilder();
        builder.append("<data><patientmodreq>");
        appendTag(builder, "Mod_Key", modKey);
        appendTag(builder, "Patient_ID", patientId);
        appendTag(builder, "WholeName", wholeName);
        appendTag(builder, "WholeName_inKana", wholeNameKana);
        appendTag(builder, "BirthDate", birthDate);
        appendTag(builder, "Sex", sex);

        boolean includeHome = zipTag != null || addressTag != null || phone1Tag != null || phone2Tag != null;
        if (includeHome) {
            builder.append("<Home_Address_Information>");
            appendTag(builder, "Address_ZipCode", zipTag);
            appendTag(builder, "WholeAddress1", addressTag);
            appendTag(builder, "PhoneNumber1", phone1Tag);
            appendTag(builder, "PhoneNumber2", phone2Tag);
            builder.append("</Home_Address_Information>");
        }

        builder.append("</patientmodreq></data>");
        return builder.toString();
    }

    private PatientModel importFromOrcaAndFetchLocal(String facilityId, String patientId, String runId, Map<String, Object> details) {
        ensureDependencies();
        PatientImportRequest request = new PatientImportRequest();
        request.getPatientIds().add(patientId);
        request.setIncludeInsurance(false);
        PatientImportResponse response = orcaPatientSyncService.importPatients(facilityId, request, runId);
        if (response != null) {
            details.put("importApiResult", response.getApiResult());
            details.put("importApiResultMessage", response.getApiResultMessage());
            details.put("importFetchedCount", response.getFetchedCount());
            details.put("importCreatedCount", response.getCreatedCount());
            details.put("importUpdatedCount", response.getUpdatedCount());
            details.put("importSkippedCount", response.getSkippedCount());
            if (response.getErrors() != null && !response.getErrors().isEmpty()) {
                details.put("importErrors", response.getErrors());
            }
        }

        if (response == null) {
            throw new OrcaGatewayException("ORCA import returned null");
        }
        if (response.getFetchedCount() <= 0) {
            throw restError(null, Response.Status.NOT_FOUND, "orca_patient_not_found",
                    "ORCA patient not found (import returned 0 records)");
        }
        if (response.getErrors() != null && !response.getErrors().isEmpty()) {
            throw restError(null, Response.Status.BAD_GATEWAY, "orca_patient_import_failed",
                    "ORCA patient import failed", Map.of("errors", response.getErrors()), null);
        }

        PatientModel model = patientServiceBean != null ? patientServiceBean.getPatientById(facilityId, patientId) : null;
        if (model == null) {
            throw new IllegalStateException("Local patient record not found after import. patientId=" + patientId);
        }
        return model;
    }

    private Set<String> resolveChangeSet(PatientPatch patch, OrcaPatientBaseline baseline) {
        Set<String> clientKeys = patch.changedKeys != null ? patch.changedKeys : Set.of();
        if (!clientKeys.isEmpty()) {
            LinkedHashSet<String> filtered = new LinkedHashSet<>();
            for (String key : clientKeys) {
                if (key == null) {
                    continue;
                }
                String normalized = key.trim();
                if (normalized.isEmpty()) {
                    continue;
                }
                if (EDITABLE_KEYS.contains(normalized)) {
                    filtered.add(normalized);
                }
            }
            return filtered;
        }

        // Backward-compatible fallback: avoid "clearing" when the client doesn't send changedKeys.
        LinkedHashSet<String> resolved = new LinkedHashSet<>();
        String baselineSexLocal = toLocalSex(baseline.sex);
        maybeAddChanged(resolved, "name", patch.name, baseline.wholeName, false);
        maybeAddChanged(resolved, "kana", patch.kana, baseline.wholeNameKana, false);
        maybeAddChanged(resolved, "birthDate", patch.birthDate, baseline.birthDate, false);
        maybeAddChanged(resolved, "sex", patch.sex, baselineSexLocal, false);
        maybeAddChanged(resolved, "phone", patch.phone, baseline.phone1, false);
        maybeAddChanged(resolved, "zip", patch.zip, baseline.zipCode, false);
        maybeAddChanged(resolved, "address", patch.address, baseline.address, false);
        return resolved;
    }

    private void maybeAddChanged(Set<String> target, String key, String current, String baseline, boolean allowBlank) {
        if (target == null || key == null) {
            return;
        }
        String next = safeTrimKeepEmpty(current);
        if (!allowBlank && (next == null || next.isBlank())) {
            return;
        }
        String prev = safeTrimKeepEmpty(baseline);
        if (next == null) {
            return;
        }
        if (!next.equals(prev != null ? prev : "")) {
            target.add(key);
        }
    }

    private void ensureDependencies() {
        if (patientServiceBean == null) {
            throw new IllegalStateException("PatientServiceBean is not available");
        }
        if (orcaPatientSyncService == null) {
            throw new IllegalStateException("OrcaPatientSyncService is not available");
        }
    }

    private boolean matchesLocalPatient(PatientModel existing, PatientPatch patch) {
        if (existing == null || patch == null) {
            return false;
        }
        if (!equalsIfProvided(patch.name, existing.getFullName())) return false;
        if (!equalsIfProvided(patch.kana, existing.getKanaName())) return false;
        if (!equalsIfProvided(patch.birthDate, ModelUtils.formatDate(existing.getBirthday()))) return false;
        if (!equalsIfProvided(patch.sex, existing.getGender())) return false;

        String existingPhone = firstNonBlank(existing.getTelephone(), existing.getMobilePhone());
        if (!equalsIfProvided(patch.phone, existingPhone)) return false;

        SimpleAddressModel address = existing.getAddress();
        String existingZip = address != null ? address.getZipCode() : null;
        String existingAddress = address != null ? address.getAddress() : null;
        if (!equalsIfProvided(patch.zip, existingZip)) return false;
        if (!equalsIfProvided(patch.address, existingAddress)) return false;

        return true;
    }

    private boolean equalsIfProvided(String provided, String baseline) {
        String next = safeTrim(provided);
        if (next == null) {
            return true;
        }
        String prev = safeTrimKeepEmpty(baseline);
        if (prev == null) {
            prev = "";
        }
        return next.equals(prev);
    }

    private Map<String, Object> toPatientRecord(PatientModel model) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("patientId", model.getPatientId());
        record.put("name", model.getFullName());
        record.put("kana", model.getKanaName());
        record.put("birthDate", ModelUtils.formatDate(model.getBirthday()));
        record.put("sex", model.getGender());
        String phone = firstNonBlank(model.getTelephone(), model.getMobilePhone());
        record.put("phone", phone);
        SimpleAddressModel address = model.getAddress();
        if (address != null) {
            record.put("zip", address.getZipCode());
            record.put("address", address.getAddress());
        } else {
            record.put("zip", null);
            record.put("address", null);
        }
        record.put("insurance", null);
        record.put("memo", model.getMemo());
        return record;
    }

    private String resolveRequestId(HttpServletRequest request, String traceId) {
        if (request != null) {
            String header = request.getHeader("X-Request-Id");
            if (header != null && !header.isBlank()) {
                return header.trim();
            }
        }
        return traceId;
    }

    private String resolveFacilityId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String remoteUser = request.getRemoteUser();
        String facilityId = getRemoteFacility(remoteUser);
        if (facilityId != null && !facilityId.isBlank()) {
            return facilityId;
        }
        String header = request.getHeader("X-Facility-Id");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return null;
    }

    private PatientPatch toPatientPatch(Map<String, Object> payload) {
        PatientPatch patch = new PatientPatch();
        patch.patientId = requireNumericId(getText(payload, "patientId", "Patient_ID"), "patientId");
        patch.name = getText(payload, "name", "wholeName", "Patient_Name");
        patch.kana = getText(payload, "kana", "wholeNameKana", "Patient_Kana");
        patch.birthDate = getText(payload, "birthDate", "Patient_BirthDate");
        patch.sex = getText(payload, "sex", "Patient_Sex");
        patch.phone = getText(payload, "phone", "telephone", "tel", "PhoneNumber");
        patch.zip = getText(payload, "zip", "zipCode", "postal");
        patch.address = getText(payload, "address", "addressLine");
        patch.changedKeys = extractChangedKeys(payload);
        return patch;
    }

    private Set<String> extractChangedKeys(Map<String, Object> payload) {
        if (payload == null) {
            return Set.of();
        }
        Object audit = payload.get("auditEvent");
        if (!(audit instanceof Map<?, ?> auditMap)) {
            return Set.of();
        }
        Object raw = auditMap.get("changedKeys");
        if (raw == null) {
            return Set.of();
        }
        LinkedHashSet<String> keys = new LinkedHashSet<>();
        if (raw instanceof String text) {
            for (String part : text.split(",")) {
                String normalized = part != null ? part.trim() : "";
                if (!normalized.isEmpty()) {
                    keys.add(normalized);
                }
            }
            return keys;
        }
        if (raw instanceof List<?> list) {
            for (Object entry : list) {
                if (entry instanceof String text) {
                    String normalized = text.trim();
                    if (!normalized.isEmpty()) {
                        keys.add(normalized);
                    }
                }
            }
            return keys;
        }
        return Set.of();
    }

    private String requireNumericId(String value, String label) {
        String trimmed = safeTrim(value);
        if (trimmed == null || trimmed.isBlank()) {
            return null;
        }
        if (!trimmed.matches("\\d+")) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", label + " must be numeric");
        }
        return trimmed;
    }

    private String getText(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            Object value = payload.get(key);
            if (value instanceof String text) {
                return text;
            }
        }
        return null;
    }

    private String getNonBlankText(Map<String, Object> payload, String key) {
        String value = getText(payload, key);
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void dispatchAuditEvent(HttpServletRequest request, Map<String, Object> details, String action, AuditEventEnvelope.Outcome outcome) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(request != null ? request.getRequestURI() : "/api/orca/patientmodv2/outpatient");
        payload.setDetails(details);
        payload.setTraceId(resolveTraceId(request));
        payload.setRequestId(request != null ? request.getHeader("X-Request-Id") : null);
        if (request != null) {
            payload.setActorId(request.getRemoteUser());
            payload.setIpAddress(request.getRemoteAddr());
            payload.setUserAgent(request.getHeader("User-Agent"));
        }
        sessionAuditDispatcher.record(payload, outcome, null, null);
    }

    private void applyObservabilityHeaders(Response.ResponseBuilder builder, String runId, String traceId,
            String requestId, String dataSourceTransition, boolean fallbackUsed) {
        if (builder == null) {
            return;
        }
        if (runId != null && !runId.isBlank()) {
            builder.header("x-run-id", runId);
        }
        if (traceId != null && !traceId.isBlank()) {
            builder.header("x-trace-id", traceId);
        }
        if (requestId != null && !requestId.isBlank()) {
            builder.header("x-request-id", requestId);
        }
        if (dataSourceTransition != null && !dataSourceTransition.isBlank()) {
            builder.header("x-data-source-transition", dataSourceTransition);
            builder.header("x-datasource-transition", dataSourceTransition);
        }
        builder.header("x-cache-hit", "false");
        builder.header("x-missing-master", "false");
        builder.header("x-fallback-used", String.valueOf(fallbackUsed));
    }

    private static String safeTrim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String safeTrimKeepEmpty(String value) {
        if (value == null) {
            return null;
        }
        return value.trim();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String toLocalSex(String orcaSex) {
        String normalized = normalizeOrcaSexCode(orcaSex);
        if ("1".equals(normalized)) {
            return "M";
        }
        if ("2".equals(normalized)) {
            return "F";
        }
        return "";
    }

    private static String requireOrcaSexCode(String value, String label) {
        String normalized = normalizeOrcaSexCode(value);
        if (!"1".equals(normalized) && !"2".equals(normalized)) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request",
                    label + " must be M/F (or ORCA 1/2)");
        }
        return normalized;
    }

    private static String normalizeOrcaSexCode(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if ("1".equals(trimmed) || "2".equals(trimmed)) {
            return trimmed;
        }
        String normalized = trimmed.toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "M", "MALE" -> "1";
            case "F", "FEMALE" -> "2";
            default -> null;
        };
    }

    private static String resolveOptionalValue(Set<String> changeSet, String key, String current, String baseline) {
        if (changeSet != null && changeSet.contains(key)) {
            return safeTrimKeepEmpty(current);
        }
        return safeTrimKeepEmpty(baseline);
    }

    private static String normalizeZipForOrca(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        String digits = trimmed.replaceAll("[^0-9]", "");
        return digits.length() == 7 ? digits : digits.isEmpty() ? trimmed : digits;
    }

    private static void appendTag(StringBuilder builder, String tag, String value) {
        if (builder == null || tag == null || value == null) {
            return;
        }
        builder.append('<').append(tag).append('>').append(escapeXml(value)).append("</").append(tag).append('>');
    }

    private static String escapeXml(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&apos;");
                default -> out.append(ch);
            }
        }
        return out.toString();
    }

    private static String extractTagValue(String payload, String tag) {
        if (payload == null || tag == null) {
            return null;
        }
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
                "<" + tag + "\\b[^>]*>(.*?)</" + tag + ">", java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher matcher = pattern.matcher(payload);
        if (matcher.find()) {
            String value = matcher.group(1);
            return value != null ? value.trim() : null;
        }
        return null;
    }

    private static final class PatientPatch {
        private String patientId;
        private String name;
        private String kana;
        private String birthDate;
        private String sex;
        private String phone;
        private String zip;
        private String address;
        private Set<String> changedKeys = Set.of();

        private Map<String, Object> toResponse() {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("patientId", patientId);
            response.put("name", name);
            response.put("kana", kana);
            response.put("birthDate", birthDate);
            response.put("sex", sex);
            response.put("phone", phone);
            response.put("zip", zip);
            response.put("address", address);
            return response;
        }
    }

    private static final class OrcaPatientBaseline {
        private String patientId;
        private String wholeName;
        private String wholeNameKana;
        private String birthDate;
        private String sex;
        private String zipCode;
        private String address;
        private String phone1;
        private String phone2;
    }

    private static final class OrcaDesired {
        private String wholeName;
        private String wholeNameKana;
        private String birthDate;
        private String sex;
        private String phone1;
        private String zipCode;
        private String address;
    }

    private static final class OrcaApiResult {
        private boolean success;
        private int httpStatus;
        private String url;
        private String apiResult;
        private String apiResultMessage;
    }

    private static final class OrcaUpdateExecution {
        private final boolean success;
        private final OrcaApiResult last;

        private OrcaUpdateExecution(boolean success, OrcaApiResult last) {
            this.success = success;
            this.last = last;
        }
    }

    private static final class OrcaMutationResult {
        private String apiResult;
        private String apiResultMessage;
        private PatientModel patient;
    }
}
