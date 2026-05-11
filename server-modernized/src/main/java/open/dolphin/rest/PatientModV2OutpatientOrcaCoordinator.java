package open.dolphin.rest;

import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.service.OrcaPatientCacheStore;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.session.PatientServiceBean;

record PatientModV2OutpatientOrcaCoordinator(
        PatientServiceBean patientServiceBean,
        OrcaTransport orcaTransport,
        OrcaLiveGateway orcaWrapperService,
        OrcaPatientSyncService orcaPatientSyncService,
        OrcaPatientCacheStore patientCacheStore) {

    private static final String ORCA_PATIENTMOD_CREATE_CLASS = "01";
    private static final String ORCA_PATIENTMOD_CLASS = "02";
    private static final int ORCA_UPDATE_MAX_RETRY = 1;

    PatientModV2OutpatientSupport.OrcaMutationResult createOrcaAndSyncLocal(
            String facilityId,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            Map<String, Object> details) {
        ensurePatientService();

        String requestedPatientId = patch.patientId != null && !patch.patientId.isBlank() ? patch.patientId : "*";
        if (!"*".equals(requestedPatientId)) {
            PatientModel existing = patientServiceBean().getPatientById(facilityId, requestedPatientId);
            if (existing != null) {
                if (!PatientModV2OutpatientSupport.matchesLocalPatient(existing, patch)) {
                    throw AbstractResource.restError(null, Response.Status.CONFLICT, "patient_exists",
                            "患者が既に存在します。患者IDと内容を確認してください。");
                }
                ensureOrcaSyncDependencies();
                PatientModV2OutpatientSupport.OrcaMutationResult result = new PatientModV2OutpatientSupport.OrcaMutationResult();
                result.apiResult = "00";
                result.apiResultMessage = "既存患者のためORCA正本を再取得しました";
                result.patient = importFromOrcaAndFetchLocal(facilityId, requestedPatientId, runId, details);
                result.idempotent = true;
                result.idempotentReason = "existing_patient";
                result.orcaMutationPrepared = false;
                result.orcaMutationSent = false;
                applyCanonicalResult(result, details);
                return result;
            }
        }

        ensureOrcaSyncDependencies();
        PatientModV2OutpatientSupport.OrcaApiResult created = postPatientMod(
                facilityId,
                PatientModV2OutpatientSupport.buildPatientModPayload(
                        "1",
                        requestedPatientId,
                        requireText(patch.name, "name"),
                        requireText(patch.kana, "kana"),
                        requireText(patch.birthDate, "birthDate"),
                        requireSex(patch.sex),
                        patch.zip,
                        patch.address,
                        patch.phone,
                        null),
                ORCA_PATIENTMOD_CREATE_CLASS);
        if (!created.success) {
            throw AbstractResource.restError(null, Response.Status.BAD_GATEWAY, "orca_patient_create_failed",
                    created.apiResultMessage != null ? created.apiResultMessage : "ORCA patient create failed");
        }

        String resolvedPatientId = created.patientId != null && !created.patientId.isBlank()
                ? created.patientId
                : requestedPatientId;
        if (resolvedPatientId == null || resolvedPatientId.isBlank() || "*".equals(resolvedPatientId)) {
            throw new OrcaGatewayException("ORCA create response did not include a patientId");
        }

        details.put("requestedPatientId", requestedPatientId);
        details.put("resolvedPatientId", resolvedPatientId);
        PatientModel synced = importFromOrcaAndFetchLocal(facilityId, resolvedPatientId, runId, details);
        PatientModV2OutpatientSupport.OrcaMutationResult result = new PatientModV2OutpatientSupport.OrcaMutationResult();
        result.apiResult = created.apiResult;
        result.apiResultMessage = created.apiResultMessage != null ? created.apiResultMessage : "ORCA登録完了";
        result.patient = synced;
        result.orcaMutationPrepared = true;
        result.orcaMutationSent = true;
        applyCanonicalResult(result, details);
        return result;
    }

    PatientModV2OutpatientSupport.OrcaMutationResult updateOrcaAndSyncLocal(
            String facilityId,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            Map<String, Object> details) {
        ensureAllDependencies();
        PatientModV2OutpatientSupport.OrcaPatientBaseline baseline = fetchOrcaPatientBaseline(facilityId, patch.patientId);
        Set<String> changeSet = PatientModV2OutpatientSupport.resolveChangeSet(patch, baseline);
        details.put("editableKeys", List.copyOf(PatientModV2OutpatientSupport.EDITABLE_KEYS));
        details.put("appliedKeys", List.copyOf(changeSet));

        if (changeSet.isEmpty()) {
            PatientModel synced = importFromOrcaAndFetchLocal(facilityId, patch.patientId, runId, details);
            PatientModV2OutpatientSupport.OrcaMutationResult result = new PatientModV2OutpatientSupport.OrcaMutationResult();
            result.apiResult = "00";
            result.apiResultMessage = "変更なし（ORCAから再取り込み）";
            result.patient = synced;
            result.orcaMutationPrepared = false;
            result.orcaMutationSent = false;
            applyCanonicalResult(result, details);
            return result;
        }

        PatientModV2OutpatientSupport.OrcaDesired desired = PatientModV2OutpatientSupport.buildDesired(patch, baseline, changeSet);
        PatientModV2OutpatientSupport.OrcaApiResult last = null;
        boolean updated = false;
        PatientModV2OutpatientSupport.OrcaPatientBaseline currentBaseline = baseline;
        for (int attempt = 0; attempt <= ORCA_UPDATE_MAX_RETRY; attempt++) {
            if (attempt > 0) {
                details.put("orcaRetryAttempt", attempt);
                currentBaseline = fetchOrcaPatientBaseline(facilityId, patch.patientId);
            }
            PatientModV2OutpatientSupport.OrcaUpdateExecution execution = executeOrcaUpdate(facilityId, currentBaseline, desired, changeSet);
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
            throw AbstractResource.restError(null, Response.Status.BAD_GATEWAY, "orca_patient_update_failed",
                    last != null && last.apiResultMessage != null ? last.apiResultMessage : "ORCA patient update failed",
                    errorDetails, null);
        }

        PatientModel synced = importFromOrcaAndFetchLocal(facilityId, patch.patientId, runId, details);
        PatientModV2OutpatientSupport.OrcaMutationResult result = new PatientModV2OutpatientSupport.OrcaMutationResult();
        result.apiResult = last != null && last.apiResult != null ? last.apiResult : "00";
        result.apiResultMessage = last != null && last.apiResultMessage != null ? last.apiResultMessage : "ORCA更新完了";
        result.patient = synced;
        result.orcaMutationPrepared = true;
        result.orcaMutationSent = true;
        applyCanonicalResult(result, details);
        return result;
    }

    PatientModel importFromOrcaAndFetchLocal(String facilityId, String patientId, String runId, Map<String, Object> details) {
        ensureAllDependencies();
        OrcaPatientCacheStore.PatientCacheCommand canonical = canonicalRefetchPatientGetV2(facilityId, patientId, details);
        if (!"ORCA_PATIENT_FOUND".equals(canonical.businessStatus()) || !"CURRENT".equals(canonical.cacheStatus())) {
            throw AbstractResource.restError(null, Response.Status.BAD_GATEWAY, "orca_patient_canonical_refetch_failed",
                    "ORCA patient canonical re-fetch did not confirm current patient state",
                    Map.of("businessStatus", canonical.businessStatus(), "cacheStatus", canonical.cacheStatus()), null);
        }
        PatientImportRequest request = new PatientImportRequest();
        request.getPatientIds().add(patientId);
        request.setIncludeInsurance(false);
        PatientImportResponse response = orcaPatientSyncService().importPatients(facilityId, request, runId);
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
            throw AbstractResource.restError(null, Response.Status.NOT_FOUND, "orca_patient_not_found",
                    "ORCA patient not found (import returned 0 records)");
        }
        if (response.getErrors() != null && !response.getErrors().isEmpty()) {
            throw AbstractResource.restError(null, Response.Status.BAD_GATEWAY, "orca_patient_import_failed",
                    "ORCA patient import failed", Map.of("errors", response.getErrors()), null);
        }

        PatientModel model = patientServiceBean().getPatientById(facilityId, patientId);
        if (model == null) {
            throw new IllegalStateException("Local patient record not found after import. patientId=" + patientId);
        }
        details.put("localSynced", Boolean.TRUE);
        return model;
    }

    private OrcaPatientCacheStore.PatientCacheCommand canonicalRefetchPatientGetV2(
            String facilityId,
            String patientId,
            Map<String, Object> details) {
        if (orcaTransport() == null) {
            throw new IllegalStateException("OrcaTransport is not available");
        }
        String query = "id=" + patientId + "&format=json";
        OrcaTransportResult result = orcaTransport().invoke(
                facilityId,
                OrcaEndpoint.PATIENT_GET,
                OrcaTransportRequest.get(query));
        OrcaPatientCacheStore.PatientCacheCommand command = OrcaPatientCacheStore.fromOrcaResponse(
                facilityId,
                patientId,
                details != null ? stringDetail(details, "requestId") : null,
                details != null ? stringDetail(details, "traceId") : null,
                java.time.Instant.now(),
                result != null ? result.getBody() : null);
        if (patientCacheStore() != null) {
            patientCacheStore().save(command);
        }
        if (details != null) {
            details.put("canonicalRefetched", Boolean.TRUE);
            details.put("canonicalSourceApi", "patientgetv2");
            details.put("canonicalCacheStatus", command.cacheStatus());
            details.put("canonicalBusinessStatus", command.businessStatus());
            details.put("canonicalRawResponseStored", Boolean.FALSE);
        }
        return command;
    }

    private static void applyCanonicalResult(PatientModV2OutpatientSupport.OrcaMutationResult result,
            Map<String, Object> details) {
        if (result == null || details == null) {
            return;
        }
        result.canonicalRefetched = Boolean.TRUE.equals(details.get("canonicalRefetched"));
        result.localSynced = Boolean.TRUE.equals(details.get("localSynced"));
        result.canonicalSourceApi = stringDetail(details, "canonicalSourceApi");
        result.canonicalCacheStatus = stringDetail(details, "canonicalCacheStatus");
        result.canonicalBusinessStatus = stringDetail(details, "canonicalBusinessStatus");
    }

    private static String stringDetail(Map<String, Object> details, String key) {
        if (details == null || key == null) {
            return null;
        }
        Object value = details.get(key);
        return value != null ? String.valueOf(value) : null;
    }

    private PatientModV2OutpatientSupport.OrcaUpdateExecution executeOrcaUpdate(
            String facilityId,
            PatientModV2OutpatientSupport.OrcaPatientBaseline baseline,
            PatientModV2OutpatientSupport.OrcaDesired desired,
            Set<String> changeSet) {
        boolean changedNameOrKana = changeSet.contains("name") || changeSet.contains("kana");
        boolean changedBirthDateOrSex = changeSet.contains("birthDate") || changeSet.contains("sex");
        boolean changedAddress = changeSet.contains("phone") || changeSet.contains("zip") || changeSet.contains("address");

        boolean sendKey1 = changedNameOrKana || (changedAddress && !changedBirthDateOrSex);
        boolean sendKey2 = changedBirthDateOrSex;

        PatientModV2OutpatientSupport.OrcaApiResult last = null;
        String matchName = baseline.wholeName;
        String matchKana = baseline.wholeNameKana;

        if (sendKey1) {
            last = postPatientMod(facilityId, PatientModV2OutpatientSupport.buildPatientModPayload("1",
                    baseline.patientId,
                    desired.wholeName,
                    desired.wholeNameKana,
                    baseline.birthDate,
                    baseline.sex,
                    desired.zipCode,
                    desired.address,
                    desired.phone1,
                    baseline.phone2), ORCA_PATIENTMOD_CLASS);
            if (!last.success) {
                return new PatientModV2OutpatientSupport.OrcaUpdateExecution(false, last);
            }
            matchName = desired.wholeName;
            matchKana = desired.wholeNameKana;
        }

        if (sendKey2) {
            last = postPatientMod(facilityId, PatientModV2OutpatientSupport.buildPatientModPayload("2",
                    baseline.patientId,
                    matchName,
                    matchKana,
                    desired.birthDate,
                    desired.sex,
                    desired.zipCode,
                    desired.address,
                    desired.phone1,
                    baseline.phone2), ORCA_PATIENTMOD_CLASS);
            if (!last.success) {
                return new PatientModV2OutpatientSupport.OrcaUpdateExecution(false, last);
            }
        }

        if (last == null) {
            last = new PatientModV2OutpatientSupport.OrcaApiResult();
            last.apiResult = "00";
            last.apiResultMessage = "No-op";
            last.httpStatus = 200;
            last.success = true;
        }
        return new PatientModV2OutpatientSupport.OrcaUpdateExecution(true, last);
    }

    private PatientModV2OutpatientSupport.OrcaPatientBaseline fetchOrcaPatientBaseline(String facilityId, String patientId) {
        if (orcaWrapperService() == null) {
            throw new IllegalStateException("OrcaLiveGateway is not available");
        }
        PatientBatchRequest req = new PatientBatchRequest();
        req.getPatientIds().add(patientId);
        req.setIncludeInsurance(false);
        PatientBatchResponse res = orcaWrapperService().getPatientBatch(facilityId, req);
        if (res == null) {
            throw new OrcaGatewayException("ORCA patientlst2v2 response is empty");
        }
        if (!OrcaApiProxySupport.isApiResultSuccess(res.getApiResult())) {
            throw new OrcaGatewayException("ORCA patientlst2v2 failed: " + res.getApiResult() + " " + res.getApiResultMessage());
        }
        if (res.getPatients() == null || res.getPatients().isEmpty()) {
            throw AbstractResource.restError(null, Response.Status.NOT_FOUND, "orca_patient_not_found",
                    "ORCA patient not found (patientlst2v2 returned 0 records)");
        }
        PatientDetail detail = res.getPatients().get(0);
        PatientSummary summary = detail != null ? detail.getSummary() : null;
        if (summary == null || summary.getPatientId() == null || summary.getPatientId().isBlank()) {
            throw new OrcaGatewayException("ORCA patient summary is missing Patient_ID");
        }

        PatientModV2OutpatientSupport.OrcaPatientBaseline baseline = new PatientModV2OutpatientSupport.OrcaPatientBaseline();
        baseline.patientId = summary.getPatientId().trim();
        baseline.wholeName = PatientModV2OutpatientSupport.safeTrim(summary.getWholeName());
        baseline.wholeNameKana = PatientModV2OutpatientSupport.safeTrim(summary.getWholeNameKana());
        baseline.birthDate = PatientModV2OutpatientSupport.safeTrim(summary.getBirthDate());
        baseline.sex = PatientModV2OutpatientSupport.normalizeOrcaSexCode(summary.getSex());
        baseline.zipCode = PatientModV2OutpatientSupport.safeTrim(detail != null ? detail.getZipCode() : null);
        baseline.address = PatientModV2OutpatientSupport.safeTrim(detail != null ? detail.getAddress() : null);
        baseline.phone1 = PatientModV2OutpatientSupport.safeTrim(detail != null ? detail.getPhoneNumber1() : null);
        baseline.phone2 = PatientModV2OutpatientSupport.safeTrim(detail != null ? detail.getPhoneNumber2() : null);

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

    private PatientModV2OutpatientSupport.OrcaApiResult postPatientMod(String facilityId,
            String payloadWithoutMeta,
            String classCode) {
        if (orcaTransport() == null) {
            throw new IllegalStateException("OrcaTransport is not available");
        }
        String payload = OrcaApiProxySupport.applyQueryMeta(payloadWithoutMeta, OrcaEndpoint.PATIENT_MOD, classCode);
        OrcaTransportResult result = orcaTransport().invoke(facilityId, OrcaEndpoint.PATIENT_MOD, OrcaTransportRequest.post(payload));
        PatientModV2OutpatientSupport.OrcaApiResult parsed = new PatientModV2OutpatientSupport.OrcaApiResult();
        parsed.httpStatus = result != null ? result.getStatus() : 0;
        String body = result != null ? result.getBody() : null;
        parsed.apiResult = PatientModV2OutpatientSupport.extractTagValue(body, "Api_Result");
        parsed.apiResultMessage = PatientModV2OutpatientSupport.extractTagValue(body, "Api_Result_Message");
        parsed.patientId = PatientModV2OutpatientSupport.extractTagValue(body, "Patient_ID");
        parsed.success = OrcaApiProxySupport.isApiResultSuccess(parsed.apiResult);
        if (parsed.apiResultMessage == null || parsed.apiResultMessage.isBlank()) {
            parsed.apiResultMessage = parsed.success ? "OK" : "ORCA error";
        }
        return parsed;
    }

    private void ensurePatientService() {
        if (patientServiceBean() == null) {
            throw new IllegalStateException("PatientServiceBean is not available");
        }
    }

    private void ensureOrcaSyncDependencies() {
        if (orcaPatientSyncService() == null) {
            throw new IllegalStateException("OrcaPatientSyncService is not available");
        }
    }

    private void ensureAllDependencies() {
        ensurePatientService();
        ensureOrcaSyncDependencies();
    }

    private String requireText(String value, String label) {
        String trimmed = PatientModV2OutpatientSupport.safeTrim(value);
        if (trimmed == null || trimmed.isBlank()) {
            throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request", label + " is required");
        }
        return trimmed;
    }

    private String requireSex(String value) {
        String normalized = PatientModV2OutpatientSupport.normalizeOrcaSexCode(value);
        if (!"1".equals(normalized) && !"2".equals(normalized)) {
            throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request",
                    "sex must be M/F (or ORCA 1/2)");
        }
        return normalized;
    }
}
