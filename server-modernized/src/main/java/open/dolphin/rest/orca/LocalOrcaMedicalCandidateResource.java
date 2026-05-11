package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.OrcaMedicalCandidateResponse;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import open.dolphin.security.audit.AuthoritativeAuditRepository;

@Path("/local/orca/medical-candidates")
@Produces(MediaType.APPLICATION_JSON)
public class LocalOrcaMedicalCandidateResource extends AbstractOrcaRestResource {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final String AUDIT_PREPARE = "LOCAL_ORCA_MEDICAL_CANDIDATE_PREPARE";

    @Inject
    OrcaMedicalCandidateRepository candidateRepository;

    @Inject
    AuthoritativeAuditRepository authoritativeAuditRepository;

    @POST
    @Path("/from-chart/{chartRevisionId}")
    @Transactional
    public OrcaMedicalCandidateResponse prepareFromChart(
            @Context HttpServletRequest request,
            @PathParam("chartRevisionId") String chartRevisionId) {
        String runId = resolveRunId(request);
        String actor = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        requireAuditWritePathAvailable(request);
        String normalizedChartRevisionId = trimToNull(chartRevisionId);
        if (normalizedChartRevisionId == null) {
            throw validationError(request, "chartRevisionId", "chartRevisionId is required");
        }

        OrcaMedicalCandidateRepository.PrescriptionRevisionRecord source =
                candidateRepository.findPrescriptionByChartRevision(facilityId, normalizedChartRevisionId);
        if (source == null) {
            throw restError(request, Response.Status.NOT_FOUND,
                    "prescription_source_not_found",
                    "Prescription source for chart revision was not found");
        }
        if (!isCandidateSourceStatus(source.status())) {
            throw restError(request, Response.Status.CONFLICT,
                    "prescription_source_not_sendable",
                    "Prescription source is not finalized for ORCA medical candidate preparation");
        }

        PrescriptionOrder order = decodeOrder(request, source.summaryJson());
        validateSummaryAuthority(request, source, order);
        OrcaMedicalCandidateResponse response = buildCandidate(runId, normalizedChartRevisionId, source, order);
        long candidateId = candidateRepository.saveCandidate(
                facilityId,
                normalizedChartRevisionId,
                source,
                response,
                actor,
                Instant.now());
        response.setCandidateId(candidateId);
        recordSuccess(request, facilityId, normalizedChartRevisionId, response, runId);
        return response;
    }

    private void validateSummaryAuthority(HttpServletRequest request,
            OrcaMedicalCandidateRepository.PrescriptionRevisionRecord source,
            PrescriptionOrder order) {
        String summaryPatientId = order != null ? trimToNull(order.getPatientId()) : null;
        String summaryEncounterId = order != null ? trimToNull(order.getEncounterId()) : null;
        if (!equalsTrimmed(source.patientId(), summaryPatientId)
                || !equalsTrimmed(source.encounterId(), summaryEncounterId)) {
            throw restError(request, Response.Status.CONFLICT,
                    "prescription_source_context_mismatch",
                    "Prescription source context does not match the authoritative order row");
        }
    }

    private OrcaMedicalCandidateResponse buildCandidate(String runId,
            String chartRevisionId,
            OrcaMedicalCandidateRepository.PrescriptionRevisionRecord source,
            PrescriptionOrder order) {
        OrcaMedicalCandidateResponse response = new OrcaMedicalCandidateResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setNonAuthoritative(true);
        response.setPatientId(source.patientId());
        response.setEncounterId(source.encounterId());
        response.setChartRevisionId(chartRevisionId);
        response.setPrescriptionId(source.prescriptionOrderId());
        response.setPrescriptionRevisionId(source.prescriptionRevisionId());
        response.setPrescriptionContentHash(trimToNull(source.contentHash()));

        List<ChartSupportMedicalModV2Request.MedicalInformation> information = new ArrayList<>();
        List<OrcaMedicalCandidateResponse.Issue> issues = new ArrayList<>();
        if (response.getPrescriptionContentHash() == null) {
            issues.add(issue("prescription_content_hash_missing",
                    "prescription content hash is required", null, null));
        }
        List<PrescriptionRp> rps = order != null && order.getRps() != null ? order.getRps() : List.of();
        for (int rpIndex = 0; rpIndex < rps.size(); rpIndex++) {
            PrescriptionRp rp = rps.get(rpIndex);
            if (rp == null) {
                continue;
            }
            ChartSupportMedicalModV2Request.MedicalInformation entry = new ChartSupportMedicalModV2Request.MedicalInformation();
            entry.setEntity("medOrder");
            entry.setRpSequence(rpIndex + 1);
            entry.setMedicalClass(trimToNull(rp.getMedicalClass()));
            entry.setMedicalClassName(trimToNull(rp.getBundleName()));
            entry.setMedicalClassNumber(firstNonBlank(rp.getMedicalClassNumber(), "1"));
            entry.setUsageCode(trimToNull(rp.getUsageCode()));
            entry.setUsageName(trimToNull(rp.getUsageName()));
            if (entry.getMedicalClass() == null) {
                issues.add(issue("medical_class_unresolved", "medical class is required", rpIndex + 1, null));
            }
            if (entry.getUsageCode() == null) {
                issues.add(issue("usage_code_unresolved", "usage code is required", rpIndex + 1, null));
            }

            List<ChartSupportMedicalModV2Request.Medication> medications = new ArrayList<>();
            List<PrescriptionDrug> drugs = rp.getDrugs() != null ? rp.getDrugs() : List.of();
            for (int drugIndex = 0; drugIndex < drugs.size(); drugIndex++) {
                PrescriptionDrug drug = drugs.get(drugIndex);
                if (drug == null) {
                    continue;
                }
                ChartSupportMedicalModV2Request.Medication medication = new ChartSupportMedicalModV2Request.Medication();
                medication.setItemSequence(drugIndex + 1);
                medication.setCode(trimToNull(drug.getCode()));
                medication.setName(trimToNull(drug.getName()));
                medication.setNumber(trimToNull(drug.getQuantity()));
                medication.setGenericFlg(Boolean.TRUE.equals(drug.getGeneralNamePrescription()) ? "1" : null);
                medications.add(medication);
                if (medication.getCode() == null) {
                    issues.add(issue("drug_code_unresolved", "drug code is required", rpIndex + 1, drugIndex + 1));
                }
            }
            if (medications.isEmpty()) {
                issues.add(issue("medication_empty", "at least one medication is required", rpIndex + 1, null));
            }
            entry.setMedications(medications);
            information.add(entry);
        }
        if (information.isEmpty()) {
            issues.add(issue("medical_information_empty", "medical candidate has no prescription rows", null, null));
        }
        response.setMedicalInformation(information);
        response.setIssues(issues);
        response.setSendable(issues.isEmpty());
        response.setCandidateStatus(issues.isEmpty() ? "READY_TO_SEND" : "NEEDS_REVIEW");
        return response;
    }

    private OrcaMedicalCandidateResponse.Issue issue(String code, String message, Integer rpSequence, Integer itemSequence) {
        OrcaMedicalCandidateResponse.Issue issue = new OrcaMedicalCandidateResponse.Issue();
        issue.setCode(code);
        issue.setMessage(message);
        issue.setRpSequence(rpSequence);
        issue.setItemSequence(itemSequence);
        return issue;
    }

    private PrescriptionOrder decodeOrder(HttpServletRequest request, String json) {
        try {
            return OBJECT_MAPPER.readValue(json != null && !json.isBlank() ? json : "{}", PrescriptionOrder.class);
        } catch (JsonProcessingException ex) {
            throw restError(request, Response.Status.INTERNAL_SERVER_ERROR,
                    "prescription_source_decode_error",
                    "Prescription source could not be decoded");
        }
    }

    private void requireAuditWritePathAvailable(HttpServletRequest request) {
        if (authoritativeAuditRepository != null && authoritativeAuditRepository.isWritePathAvailable()) {
            return;
        }
        throw restError(request, Response.Status.SERVICE_UNAVAILABLE,
                "audit_log_write_unavailable",
                "Audit log write path is unavailable");
    }

    private void recordSuccess(HttpServletRequest request,
            String facilityId,
            String chartRevisionId,
            OrcaMedicalCandidateResponse response,
            String runId) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("chartRevisionId", chartRevisionId);
        audit.put("candidateId", response.getCandidateId());
        audit.put("candidateStatus", response.getCandidateStatus());
        audit.put("sendable", response.isSendable());
        audit.put("issueCount", response.getIssues() != null ? response.getIssues().size() : 0);
        audit.put("nonAuthoritative", Boolean.TRUE);
        audit.put("runId", runId);
        markSuccessDetails(audit);
        recordAudit(request, AUDIT_PREPARE, audit, AuditEventEnvelope.Outcome.SUCCESS);
    }

    private boolean isCandidateSourceStatus(String status) {
        return "FINAL".equals(status) || "CHANGED".equals(status) || "REISSUED".equals(status);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstNonBlank(String first, String fallback) {
        String normalized = trimToNull(first);
        return normalized != null ? normalized : fallback;
    }

    private boolean equalsTrimmed(String expected, String actual) {
        String normalizedExpected = trimToNull(expected);
        String normalizedActual = trimToNull(actual);
        return normalizedExpected != null && normalizedExpected.equals(normalizedActual);
    }
}
