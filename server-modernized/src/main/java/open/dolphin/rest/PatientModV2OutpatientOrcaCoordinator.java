package open.dolphin.rest;

import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.service.OrcaLiveGateway;
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
        OrcaPatientSyncService orcaPatientSyncService) {

    private static final String ORCA_PATIENTMOD_CLASS = "02";
    private static final int ORCA_UPDATE_MAX_RETRY = 1;

    PatientModV2OutpatientSupport.OrcaMutationResult updateOrcaAndSyncLocal(
            String facilityId,
            PatientModV2OutpatientSupport.PatientPatch patch,
            String runId,
            Map<String, Object> details) {
        ensureDependencies();
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
        return result;
    }

    PatientModel importFromOrcaAndFetchLocal(String facilityId, String patientId, String runId, Map<String, Object> details) {
        ensureDependencies();
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
        return model;
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
                    baseline.phone2));
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
                    baseline.phone2));
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

    private PatientModV2OutpatientSupport.OrcaApiResult postPatientMod(String facilityId, String payloadWithoutMeta) {
        if (orcaTransport() == null) {
            throw new IllegalStateException("OrcaTransport is not available");
        }
        String payload = OrcaApiProxySupport.applyQueryMeta(payloadWithoutMeta, OrcaEndpoint.PATIENT_MOD, ORCA_PATIENTMOD_CLASS);
        OrcaTransportResult result = orcaTransport().invoke(facilityId, OrcaEndpoint.PATIENT_MOD, OrcaTransportRequest.post(payload));
        PatientModV2OutpatientSupport.OrcaApiResult parsed = new PatientModV2OutpatientSupport.OrcaApiResult();
        parsed.httpStatus = result != null ? result.getStatus() : 0;
        String body = result != null ? result.getBody() : null;
        parsed.apiResult = PatientModV2OutpatientSupport.extractTagValue(body, "Api_Result");
        parsed.apiResultMessage = PatientModV2OutpatientSupport.extractTagValue(body, "Api_Result_Message");
        parsed.success = OrcaApiProxySupport.isApiResultSuccess(parsed.apiResult);
        if (parsed.apiResultMessage == null || parsed.apiResultMessage.isBlank()) {
            parsed.apiResultMessage = parsed.success ? "OK" : "ORCA error";
        }
        return parsed;
    }

    private void ensureDependencies() {
        if (patientServiceBean() == null) {
            throw new IllegalStateException("PatientServiceBean is not available");
        }
        if (orcaPatientSyncService() == null) {
            throw new IllegalStateException("OrcaPatientSyncService is not available");
        }
    }
}
