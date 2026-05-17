package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.ProgressCourse;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.SubjectiveEntryRequest;
import open.dolphin.rest.dto.orca.SubjectiveEntryResponse;
import open.dolphin.security.HashUtil;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;

/**
 * Handles local-only subjective POST requests.
 */
@Path("/local/charts")
public class LocalChartSubjectiveResource extends AbstractOrcaRestResource {

    private static final Logger LOGGER = Logger.getLogger(LocalChartSubjectiveResource.class.getName());
    private static final int MAX_BODY_LENGTH = 1000;
    private static final String ROUTE_NAMESPACE = "local";
    private static final String AUDIT_ACTION = "LOCAL_CHART_SUBJECTIVES_MUTATION";
    private static final String REASON_DOCUMENT_INTEGRITY_UNAVAILABLE = "document_integrity_unavailable";
    private static final String REASON_CONFIGURATION_REQUIRED = "configuration_required";
    private static final String REASON_RETRYABLE_SERVER_ERROR = "retryable_server_error";

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @POST
    @Path("/subjectives")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public SubjectiveEntryResponse postSubjective(@Context HttpServletRequest request,
            SubjectiveEntryRequest payload) {

        String runId = resolveRunId(request);
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String patientId = requirePatientId(request, payload, facilityId, runId);
        String soapCategory = requireSoapCategory(request, payload, facilityId, patientId, runId);
        String displaySection = requireDisplaySection(request, payload, facilityId, patientId, runId, soapCategory);
        rejectEntryUpdateAttempt(request, payload, facilityId, patientId, runId, soapCategory, displaySection);
        String body = requireBody(request, payload, facilityId, patientId, runId);
        PatientModel patient = requirePatient(request, facilityId, patientId, runId);
        UserModel user = requireUser(request, facilityId, patientId, runId);
        Date performDate = requirePerformDate(request, payload.getPerformDate(), new Date(), facilityId, patientId, runId);
        KarteBean karte = requireKarte(request, facilityId, patientId, runId, patient);

        DocumentModel document = buildSubjectiveDocument(karte, user, payload, performDate, body, soapCategory);
        long documentId = persistSubjectiveDocument(request, document, facilityId, patientId, runId, soapCategory,
                displaySection);
        String recordedAt = Instant.now().toString();

        SubjectiveEntryResponse response = new SubjectiveEntryResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setRouteNamespace(ROUTE_NAMESPACE);
        response.setRecordedAt(recordedAt);
        response.setMessageDetail("院内ローカル SOAP 記載を登録しました。");
        response.setEntry(buildReadbackEntry(documentId, patientId, performDate, soapCategory, displaySection, body,
                recordedAt, user, payload.getBaseRevisionId()));

        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        audit.put("patientId", patientId);
        audit.put("runId", runId);
        audit.put("soapCategory", soapCategory);
        audit.put("displaySection", displaySection);
        audit.put("documentId", documentId);
        markSuccessDetails(audit);
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.SUCCESS);
        return response;
    }

    private long persistSubjectiveDocument(HttpServletRequest request, DocumentModel document, String facilityId,
            String patientId, String runId, String soapCategory, String displaySection) {
        try {
            return karteServiceBean.addDocument(document);
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            String reasonCode = classifySubjectivePersistenceFailure(ex);
            LOGGER.log(Level.WARNING,
                    "Local SOAP persistence failed reasonCode={0} runId={1}",
                    new Object[]{reasonCode, runId});
            failSubjectivePersistence(request, facilityId, patientId, runId, soapCategory, displaySection, reasonCode);
            return -1L;
        }
    }

    private String requirePatientId(HttpServletRequest request, SubjectiveEntryRequest payload, String facilityId, String runId) {
        if (payload == null || payload.getPatientId() == null || payload.getPatientId().isBlank()) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, null, runId);
            failSubjectiveRequest(request, audit, "patientId", "patientId is required");
        }
        return payload.getPatientId().trim();
    }

    private String requireSoapCategory(HttpServletRequest request, SubjectiveEntryRequest payload, String facilityId,
            String patientId, String runId) {
        String soapCategory = normalizeSoapCategory(payload.getSoapCategory());
        if (soapCategory == null) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveRequest(request, audit, "soapCategory", "soapCategory is required");
        }
        if (!isValidSoapCategory(soapCategory)) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveRequest(request, audit, "soapCategory", "soapCategory must be S/O/A/P");
        }
        return soapCategory;
    }

    private String requireDisplaySection(HttpServletRequest request, SubjectiveEntryRequest payload, String facilityId,
            String patientId, String runId, String soapCategory) {
        if (payload.getDisplaySection() != null && !payload.getDisplaySection().isBlank()
                && normalizeDisplaySection(payload.getDisplaySection()) == null) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            audit.put("soapCategory", soapCategory);
            failSubjectiveRequest(request, audit, "displaySection", "displaySection must be free/subjective/objective/assessment/plan");
        }
        String displaySection = normalizeDisplaySection(payload.getDisplaySection());
        if (displaySection == null) {
            return defaultDisplaySection(soapCategory);
        }
        String mappedCategory = categoryForDisplaySection(displaySection);
        if (mappedCategory == null || !mappedCategory.equals(soapCategory)) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            audit.put("soapCategory", soapCategory);
            failSubjectiveRequest(request, audit, "displaySection", "displaySection must match soapCategory");
        }
        return displaySection;
    }

    private String requireBody(HttpServletRequest request, SubjectiveEntryRequest payload, String facilityId,
            String patientId, String runId) {
        String body = payload.getBody();
        if (body == null || body.isBlank()) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveRequest(request, audit, "body", "body is required");
        }
        if (body.length() > MAX_BODY_LENGTH) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveRequest(request, audit, "body", "body must be <= 1000 characters");
        }
        return body;
    }

    private Date requirePerformDate(HttpServletRequest request, String input, Date defaultValue, String facilityId,
            String patientId, String runId) {
        if (input == null || input.isBlank()) {
            return defaultValue;
        }
        try {
            LocalDate parsed = LocalDate.parse(input.trim());
            return Date.from(parsed.atStartOfDay(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeParseException ex) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveRequest(request, audit, "performDate", "performDate must be yyyy-MM-dd");
            return defaultValue;
        }
    }

    private PatientModel requirePatient(HttpServletRequest request, String facilityId, String patientId, String runId) {
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveNotFound(request, audit, "patient_not_found", Response.Status.NOT_FOUND, "Patient not found");
        }
        return patient;
    }

    private UserModel requireUser(HttpServletRequest request, String facilityId, String patientId, String runId) {
        String remoteUser = request.getRemoteUser();
        return Optional.ofNullable(userServiceBean.getUser(remoteUser)).orElseGet(() -> {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveNotFound(request, audit, "user_not_found", Response.Status.UNAUTHORIZED, "User not found");
            return null;
        });
    }

    private KarteBean requireKarte(HttpServletRequest request, String facilityId, String patientId, String runId,
            PatientModel patient) {
        KarteBean karte = patientServiceBean.ensureKarteByPatientPk(patient.getId());
        if (karte == null) {
            Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
            failSubjectiveNotFound(request, audit, "karte_not_found", Response.Status.NOT_FOUND, "Karte not found");
        }
        return karte;
    }

    private Map<String, Object> buildSubjectiveAudit(String facilityId, String patientId, String runId) {
        Map<String, Object> audit = new HashMap<>();
        audit.put("facilityId", facilityId);
        if (patientId != null) {
            audit.put("patientId", patientId);
        }
        audit.put("runId", runId);
        audit.put("routeNamespace", ROUTE_NAMESPACE);
        return audit;
    }

    private void failSubjectiveRequest(HttpServletRequest request, Map<String, Object> audit, String field, String message) {
        audit.put("validationError", Boolean.TRUE);
        audit.put("field", field);
        markFailureDetails(audit, Response.Status.BAD_REQUEST.getStatusCode(), "invalid_request", message);
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
        throw validationError(request, field, message);
    }

    private void failSubjectiveNotFound(HttpServletRequest request, Map<String, Object> audit, String errorCode,
            Response.Status status, String message) {
        markFailureDetails(audit, status.getStatusCode(), errorCode, message);
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
        throw restError(request, status, errorCode, message);
    }

    private void rejectEntryUpdateAttempt(HttpServletRequest request, SubjectiveEntryRequest payload,
            String facilityId, String patientId, String runId, String soapCategory, String displaySection) {
        if (!hasText(payload.getEntryId()) && !hasText(payload.getExpectedEntryHash())) {
            return;
        }
        Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
        audit.put("soapCategory", soapCategory);
        audit.put("displaySection", displaySection);
        audit.put("entryUpdateAttempt", Boolean.TRUE);
        markFailureDetails(audit, Response.Status.CONFLICT.getStatusCode(),
                "subjective_entry_append_only",
                "SOAP/F entries are append-only; existing entry update requires a dedicated conflict-aware endpoint.");
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);
        throw restError(request, Response.Status.CONFLICT,
                "subjective_entry_append_only",
                "SOAP/F entries are append-only. Save this note as a new card.");
    }

    private void failSubjectivePersistence(HttpServletRequest request, String facilityId, String patientId,
            String runId, String soapCategory, String displaySection, String reasonCode) {
        Response.Status status = Response.Status.SERVICE_UNAVAILABLE;
        String message = switch (reasonCode) {
            case REASON_CONFIGURATION_REQUIRED -> "文書整合性設定が未完了のため SOAP を保存できません。";
            case REASON_DOCUMENT_INTEGRITY_UNAVAILABLE -> "文書整合性の検証準備ができないため SOAP を保存できません。";
            default -> "SOAP 保存処理を完了できませんでした。時間をおいて再試行してください。";
        };

        Map<String, Object> audit = buildSubjectiveAudit(facilityId, patientId, runId);
        audit.put("soapCategory", soapCategory);
        audit.put("displaySection", displaySection);
        audit.put("reasonCode", reasonCode);
        markFailureDetails(audit, status.getStatusCode(), reasonCode, message);
        recordAudit(request, AUDIT_ACTION, audit, AuditEventEnvelope.Outcome.FAILURE);

        Map<String, Object> details = new HashMap<>();
        details.put("classification", reasonCode);
        details.put("reasonCode", reasonCode);
        details.put("retryable", Boolean.valueOf(REASON_RETRYABLE_SERVER_ERROR.equals(reasonCode)));
        details.put("apiResult", "90");
        details.put("apiResultMessage", message);
        details.put("messageDetail", "SOAPのみ未保存です。病名・オーダーなど他領域の保存状態とは分けて確認してください。");
        throw restError(request, status, reasonCode, message, details, null);
    }

    private String classifySubjectivePersistenceFailure(RuntimeException failure) {
        if (failure instanceof IllegalStateException && hasDocumentIntegritySignal(failure)) {
            String message = failure.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("document.integrity") || normalized.contains("keyring")) {
                    return REASON_CONFIGURATION_REQUIRED;
                }
            }
            return REASON_DOCUMENT_INTEGRITY_UNAVAILABLE;
        }
        return REASON_RETRYABLE_SERVER_ERROR;
    }

    private boolean hasDocumentIntegritySignal(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String message = current.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("document.integrity")
                        || normalized.contains("document integrity")
                        || normalized.contains("keyring")) {
                    return true;
                }
            }
            String className = current.getClass().getName().toLowerCase(Locale.ROOT);
            if (className.contains("documentintegrity")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private DocumentModel buildSubjectiveDocument(KarteBean karte, UserModel user, SubjectiveEntryRequest payload,
            Date performDate, String body, String soapCategory) {
        Date now = new Date();
        DocumentModel document = new DocumentModel();
        document.setKarteBean(karte);
        document.setUserModel(user);
        document.setStarted(performDate);
        document.setConfirmed(performDate);
        document.setRecorded(now);
        document.setStatus(IInfoModel.STATUS_FINAL);

        String docId = UUID.randomUUID().toString().replace("-", "");
        document.getDocInfoModel().setDocId(docId);
        document.getDocInfoModel().setDocType(IInfoModel.DOCTYPE_KARTE);
        document.getDocInfoModel().setTitle("主訴");
        document.getDocInfoModel().setPurpose(IInfoModel.PURPOSE_RECORD);
        document.getDocInfoModel().setVersionNumber("1.0");

        ProgressCourse progress = new ProgressCourse();
        progress.setFreeText(body);

        ModuleModel module = new ModuleModel();
        module.setModel(progress);
        module.setConfirmed(performDate);
        module.setStarted(performDate);
        module.setRecorded(now);
        module.setStatus(IInfoModel.STATUS_FINAL);
        module.setUserModel(user);
        module.setKarteBean(karte);
        module.getModuleInfoBean().setStampName(IInfoModel.MODULE_PROGRESS_COURSE);
        module.getModuleInfoBean().setStampRole(resolveStampRole(soapCategory));
        module.getModuleInfoBean().setEntity(IInfoModel.MODULE_PROGRESS_COURSE);
        module.getModuleInfoBean().setStampNumber(0);
        module.setBeanJson(ModelUtils.encodeModule(module));
        module.setDocumentModel(document);
        document.addModule(module);

        return document;
    }

    private SubjectiveEntryResponse.Entry buildReadbackEntry(long documentId, String patientId, Date performDate,
            String soapCategory, String displaySection, String body, String recordedAt, UserModel user,
            String baseRevisionId) {
        SubjectiveEntryResponse.Entry entry = new SubjectiveEntryResponse.Entry();
        entry.setDocumentId(documentId);
        entry.setEntryId("local-subjective-" + documentId + "-" + displaySection);
        entry.setPatientId(patientId);
        entry.setPerformDate(ModelUtils.getDateAsString(performDate));
        entry.setSoapCategory(soapCategory);
        entry.setDisplaySection(displaySection);
        entry.setBody(body);
        entry.setRecordedAt(recordedAt);
        entry.setAuthorUserId(user.getUserId());
        entry.setAuthorName(user.getCommonName());
        entry.setBaseChartRevisionId(trimToNull(baseRevisionId));
        entry.setContentHash(contentHash(patientId, performDate, soapCategory, displaySection, body, baseRevisionId));
        return entry;
    }

    private String normalizeSoapCategory(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isValidSoapCategory(String value) {
        return "S".equals(value) || "O".equals(value) || "A".equals(value) || "P".equals(value);
    }

    private String normalizeDisplaySection(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "free", "subjective", "objective", "assessment", "plan" -> normalized;
            default -> null;
        };
    }

    private String defaultDisplaySection(String soapCategory) {
        return switch (soapCategory) {
            case "S" -> "subjective";
            case "O" -> "objective";
            case "A" -> "assessment";
            case "P" -> "plan";
            default -> "subjective";
        };
    }

    private String categoryForDisplaySection(String displaySection) {
        return switch (displaySection) {
            case "free", "subjective" -> "S";
            case "objective" -> "O";
            case "assessment" -> "A";
            case "plan" -> "P";
            default -> null;
        };
    }

    private String resolveStampRole(String soapCategory) {
        if ("P".equals(soapCategory)) {
            return IInfoModel.ROLE_P_SPEC;
        }
        return IInfoModel.ROLE_SOA_SPEC;
    }

    private String contentHash(String patientId, Date performDate, String soapCategory, String displaySection,
            String body, String baseRevisionId) {
        return HashUtil.sha256(String.join("\u001f",
                trimToEmpty(patientId),
                ModelUtils.getDateAsString(performDate),
                trimToEmpty(soapCategory),
                trimToEmpty(displaySection),
                trimToEmpty(body),
                trimToEmpty(baseRevisionId)));
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private String trimToEmpty(String value) {
        return hasText(value) ? value.trim() : "";
    }

}
