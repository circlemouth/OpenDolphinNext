package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.ProgressCourse;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.rest.dto.outpatient.MedicalOutpatientResponse;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PVTServiceBean;

/**
 * ローカル集約した外来情報を返す API。ORCA の medicalmodv2 送信 API ではない。
 */
@Path("/orca/local-medical")
public class OrcaLocalMedicalOutpatientResource extends AbstractOrcaRestResource {

    private static final String DATA_SOURCE = "server";
    private static final String AUDIT_ACTION = "ORCA_LOCAL_MEDICAL_OUTPATIENT_GET";
    private static final String DEFAULT_RESOURCE = "/api/orca/local-medical/outpatient";

    @Inject
    private PVTServiceBean pvtServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @POST
    @Path("/outpatient")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public MedicalOutpatientResponse postOutpatientMedical(@Context HttpServletRequest request, Map<String, Object> payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);

        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String requestId = resolveRequestId(request, traceId);
        LocalDate targetDate = resolveTargetDate(payload);

        List<PatientVisitModel> visits = fetchVisits(facilityId, targetDate);
        List<MedicalOutpatientResponse.MedicalOutpatientEntry> outpatientEntries = new ArrayList<>();
        for (PatientVisitModel visit : visits) {
            MedicalOutpatientResponse.MedicalOutpatientEntry entry = buildMedicalEntry(facilityId, visit, targetDate);
            if (entry != null) {
                outpatientEntries.add(entry);
            }
        }

        MedicalOutpatientResponse response = new MedicalOutpatientResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setRequestId(requestId);
        response.setDataSource(DATA_SOURCE);
        response.setDataSourceTransition(DATA_SOURCE);
        response.setCacheHit(false);
        response.setMissingMaster(false);
        response.setFallbackUsed(false);
        response.setFetchedAt(Instant.now().toString());
        response.setOutpatientList(outpatientEntries);
        response.setRecordsReturned(outpatientEntries.size());
        response.setOutcome(outpatientEntries.isEmpty() ? "MISSING" : "SUCCESS");

        String resourcePath = resolveResourcePath(request);
        Map<String, Object> details = buildAuditDetails(facilityId, outpatientEntries, response, resourcePath);
        OutpatientFlagResponse.AuditEvent auditEvent = new OutpatientFlagResponse.AuditEvent();
        auditEvent.setAction(AUDIT_ACTION);
        auditEvent.setResource(resourcePath);
        auditEvent.setOutcome(response.getOutcome());
        auditEvent.setDetails(details);
        auditEvent.setTraceId(traceId);
        auditEvent.setRequestId(requestId);
        response.setAuditEvent(auditEvent);

        Map<String, Object> auditPayload = new LinkedHashMap<>(details);
        auditPayload.put("recordsReturned", response.getRecordsReturned());
        recordAudit(request, AUDIT_ACTION, auditPayload, AuditEventEnvelope.Outcome.SUCCESS);

        return response;
    }

    private Map<String, Object> buildAuditDetails(String facilityId,
            List<MedicalOutpatientResponse.MedicalOutpatientEntry> entries,
            MedicalOutpatientResponse response,
            String resourcePath) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("facilityId", facilityId);
        details.put("runId", response.getRunId());
        details.put("dataSource", response.getDataSource());
        details.put("dataSourceTransition", response.getDataSourceTransition());
        details.put("cacheHit", response.isCacheHit());
        details.put("missingMaster", response.isMissingMaster());
        details.put("fallbackUsed", response.isFallbackUsed());
        details.put("fetchedAt", response.getFetchedAt());
        details.put("recordsReturned", response.getRecordsReturned());
        details.put("outcome", response.getOutcome());
        details.put("resource", resourcePath);
        details.put("telemetryFunnelStage", "charts_orchestration");
        if (entries != null && !entries.isEmpty()) {
            details.put("patientsReturned", entries.size());
        }
        return details;
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

    private String resolveResourcePath(HttpServletRequest request) {
        if (request == null) {
            return DEFAULT_RESOURCE;
        }
        String requestUri = request.getRequestURI();
        if (requestUri == null || requestUri.isBlank()) {
            return DEFAULT_RESOURCE;
        }
        return requestUri;
    }

    private List<PatientVisitModel> fetchVisits(String facilityId, LocalDate targetDate) {
        if (pvtServiceBean == null || facilityId == null || facilityId.isBlank()) {
            return List.of();
        }
        return pvtServiceBean.getPvt(facilityId, targetDate.toString(), 0, PVTServiceBean.DEFAULT_PVT_PAGE_SIZE, null,
                null);
    }

    private LocalDate resolveTargetDate(Map<String, Object> payload) {
        if (payload == null) {
            return LocalDate.now();
        }
        Object value = payload.get("date");
        if (value == null) {
            value = payload.get("appointmentDate");
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return LocalDate.parse(text);
            } catch (Exception ignored) {
            }
        }
        return LocalDate.now();
    }

    private MedicalOutpatientResponse.MedicalOutpatientEntry buildMedicalEntry(String facilityId, PatientVisitModel visit,
            LocalDate targetDate) {
        if (visit == null || visit.getPatientModel() == null) {
            return null;
        }
        PatientModel patient = visit.getPatientModel();
        String patientId = patient.getPatientId();
        KarteBean karte = karteServiceBean != null ? karteServiceBean.getKarte(facilityId, patientId, null) : null;
        if (karte == null) {
            return null;
        }

        MedicalOutpatientResponse.MedicalOutpatientEntry entry = new MedicalOutpatientResponse.MedicalOutpatientEntry();
        entry.setVoucherNumber(visit.getId() > 0 ? String.valueOf(visit.getId()) : null);
        entry.setAppointmentId(visit.getAppointment());
        entry.setDepartment(resolveDepartment(visit));
        entry.setPhysician(resolvePhysician(visit));

        MedicalOutpatientResponse.PatientSummary summary = new MedicalOutpatientResponse.PatientSummary();
        summary.setPatientId(patientId);
        summary.setWholeName(patient.getFullName());
        summary.setWholeNameKana(patient.getKanaName());
        summary.setBirthDate(patient.getBirthday() != null ? patient.getBirthday().toString() : null);
        summary.setSex(patient.getGender());
        entry.setPatient(summary);

        Map<String, MedicalOutpatientResponse.MedicalSection> sections = new LinkedHashMap<>();
        sections.put("diagnosis", buildDiagnosisSection(karte, targetDate));
        sections.put("prescription", buildBundleSection(karte, IInfoModel.ENTITY_MED_ORDER, "prescription", targetDate));
        sections.put("lab", buildBundleSection(karte, IInfoModel.ENTITY_LABO_TEST, "lab", targetDate));
        sections.put("procedure", buildProcedureSection(karte, targetDate));
        sections.put("memo", buildMemoSection(karte, targetDate));
        entry.setSections(sections);

        int totalRecords = sections.values().stream()
                .map(MedicalOutpatientResponse.MedicalSection::getRecordsReturned)
                .filter(value -> value != null)
                .mapToInt(Integer::intValue)
                .sum();
        entry.setRecordsReturned(totalRecords > 0 ? totalRecords : null);
        entry.setOutcome(totalRecords > 0 ? "SUCCESS" : "MISSING");
        return entry;
    }

    private String resolveDepartment(PatientVisitModel visit) {
        if (visit.getDeptName() != null && !visit.getDeptName().isBlank()) {
            return visit.getDeptName();
        }
        if (visit.getDepartment() != null && !visit.getDepartment().isBlank()) {
            return visit.getDepartment();
        }
        return visit.getDeptCode();
    }

    private String resolvePhysician(PatientVisitModel visit) {
        if (visit.getDoctorName() != null && !visit.getDoctorName().isBlank()) {
            return visit.getDoctorName();
        }
        return visit.getDoctorId();
    }

    private MedicalOutpatientResponse.MedicalSection buildDiagnosisSection(KarteBean karte, LocalDate targetDate) {
        MedicalOutpatientResponse.MedicalSection section = new MedicalOutpatientResponse.MedicalSection();
        if (karteServiceBean == null) {
            section.setOutcome("MISSING");
            section.setItems(List.of());
            section.setRecordsReturned(0);
            return section;
        }
        List<RegisteredDiagnosisModel> diagnoses = karteServiceBean.getDiagnosis(karte.getId(), null, false);
        List<MedicalOutpatientResponse.MedicalSectionItem> items = new ArrayList<>();
        if (diagnoses != null) {
            for (RegisteredDiagnosisModel diagnosis : diagnoses) {
                if (!isDiagnosisEffectiveOn(diagnosis, targetDate)) {
                    continue;
                }
                MedicalOutpatientResponse.MedicalSectionItem item = new MedicalOutpatientResponse.MedicalSectionItem();
                item.setName(diagnosis.getDiagnosis());
                item.setCode(diagnosis.getDiagnosisCode());
                item.setDate(diagnosis.getStartDate());
                String status = diagnosis.getOutcomeDesc();
                if (status == null || status.isBlank()) {
                    status = diagnosis.getOutcome();
                }
                item.setStatus(status);
                items.add(item);
            }
        }
        section.setItems(items);
        section.setRecordsReturned(items.size());
        section.setOutcome(items.isEmpty() ? "MISSING" : "SUCCESS");
        return section;
    }

    private MedicalOutpatientResponse.MedicalSection buildBundleSection(KarteBean karte, String targetEntity, String mode,
            LocalDate targetDate) {
        MedicalOutpatientResponse.MedicalSection section = new MedicalOutpatientResponse.MedicalSection();
        List<MedicalOutpatientResponse.MedicalSectionItem> items = new ArrayList<>();
        List<BundleDolphin> bundles = resolveBundles(karte, targetEntity, targetDate);
        for (BundleDolphin bundle : bundles) {
            ClaimItem[] claimItems = bundle.getClaimItem();
            if (claimItems == null) {
                continue;
            }
            for (ClaimItem item : claimItems) {
                MedicalOutpatientResponse.MedicalSectionItem entry = new MedicalOutpatientResponse.MedicalSectionItem();
                entry.setName(item.getName());
                if ("prescription".equals(mode)) {
                    entry.setDose(formatDose(item));
                    entry.setFrequency(bundle.getAdmin());
                } else if ("lab".equals(mode)) {
                    entry.setValue(item.getNumber());
                    entry.setUnit(item.getUnit());
                }
                items.add(entry);
            }
        }
        section.setItems(items);
        section.setRecordsReturned(items.size());
        section.setOutcome(items.isEmpty() ? "MISSING" : "SUCCESS");
        return section;
    }

    private MedicalOutpatientResponse.MedicalSection buildProcedureSection(KarteBean karte, LocalDate targetDate) {
        MedicalOutpatientResponse.MedicalSection section = new MedicalOutpatientResponse.MedicalSection();
        List<MedicalOutpatientResponse.MedicalSectionItem> items = new ArrayList<>();
        List<BundleDolphin> bundles = resolveProcedureBundles(karte, targetDate);
        for (BundleDolphin bundle : bundles) {
            ClaimItem[] claimItems = bundle.getClaimItem();
            if (claimItems == null) {
                continue;
            }
            for (ClaimItem item : claimItems) {
                MedicalOutpatientResponse.MedicalSectionItem entry = new MedicalOutpatientResponse.MedicalSectionItem();
                entry.setName(item.getName());
                entry.setResult(item.getNumber());
                entry.setUnit(item.getUnit());
                items.add(entry);
            }
        }
        section.setItems(items);
        section.setRecordsReturned(items.size());
        section.setOutcome(items.isEmpty() ? "MISSING" : "SUCCESS");
        return section;
    }

    private MedicalOutpatientResponse.MedicalSection buildMemoSection(KarteBean karte, LocalDate targetDate) {
        MedicalOutpatientResponse.MedicalSection section = new MedicalOutpatientResponse.MedicalSection();
        List<MedicalOutpatientResponse.MedicalSectionItem> items = new ArrayList<>();
        List<DocumentModel> documents = resolveDocuments(karte, targetDate);
        for (DocumentModel document : documents) {
            if (document.getModules() == null) {
                continue;
            }
            for (ModuleModel module : document.getModules()) {
                Object decoded = decodeModule(module);
                if (decoded instanceof ProgressCourse progress) {
                    String text = progress.getFreeText();
                    if (text != null && !text.isBlank()) {
                        MedicalOutpatientResponse.MedicalSectionItem entry = new MedicalOutpatientResponse.MedicalSectionItem();
                        entry.setText(text);
                        items.add(entry);
                    }
                }
            }
        }
        section.setItems(items);
        section.setRecordsReturned(items.size());
        section.setOutcome(items.isEmpty() ? "MISSING" : "SUCCESS");
        return section;
    }

    private List<BundleDolphin> resolveBundles(KarteBean karte, String targetEntity, LocalDate targetDate) {
        if (karteServiceBean == null) {
            return List.of();
        }
        List<BundleDolphin> bundles = new ArrayList<>();
        for (DocumentModel document : resolveDocuments(karte, targetDate)) {
            if (document.getModules() == null) {
                continue;
            }
            for (ModuleModel module : document.getModules()) {
                Object decoded = decodeModule(module);
                if (decoded instanceof BundleDolphin bundle) {
                    String entity = module.getModuleInfoBean() != null ? module.getModuleInfoBean().getEntity() : null;
                    if (entity == null || !entity.equals(targetEntity)) {
                        continue;
                    }
                    bundles.add(bundle);
                }
            }
        }
        return bundles;
    }

    private List<BundleDolphin> resolveProcedureBundles(KarteBean karte, LocalDate targetDate) {
        if (karteServiceBean == null) {
            return List.of();
        }
        List<BundleDolphin> bundles = new ArrayList<>();
        for (DocumentModel document : resolveDocuments(karte, targetDate)) {
            if (document.getModules() == null) {
                continue;
            }
            for (ModuleModel module : document.getModules()) {
                Object decoded = decodeModule(module);
                if (!(decoded instanceof BundleDolphin bundle)) {
                    continue;
                }
                String entity = module.getModuleInfoBean() != null ? module.getModuleInfoBean().getEntity() : null;
                if (entity == null) {
                    continue;
                }
                if (entity.equals(IInfoModel.ENTITY_GENERAL_ORDER)
                        || entity.equals(IInfoModel.ENTITY_OTHER_ORDER)
                        || entity.equals(IInfoModel.ENTITY_TREATMENT)
                        || entity.equals(IInfoModel.ENTITY_SURGERY_ORDER)
                        || entity.equals(IInfoModel.ENTITY_RADIOLOGY_ORDER)
                        || entity.equals(IInfoModel.ENTITY_PHYSIOLOGY_ORDER)
                        || entity.equals(IInfoModel.ENTITY_BACTERIA_ORDER)
                        || entity.equals(IInfoModel.ENTITY_INJECTION_ORDER)
                        || entity.equals(IInfoModel.ENTITY_BASE_CHARGE_ORDER)
                        || entity.equals(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER)) {
                    bundles.add(bundle);
                }
            }
        }
        return bundles;
    }

    private List<DocumentModel> resolveDocuments(KarteBean karte, LocalDate targetDate) {
        if (karteServiceBean == null) {
            return List.of();
        }
        Instant since = targetDate.minusDays(30).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        Instant until = targetDate.plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
        List<open.dolphin.infomodel.DocInfoModel> docInfos =
                karteServiceBean.getDocumentList(karte.getId(), java.util.Date.from(since), true);
        if (docInfos == null || docInfos.isEmpty()) {
            return List.of();
        }
        List<Long> ids = docInfos.stream()
                .map(open.dolphin.infomodel.DocInfoModel::getDocPk)
                .filter(id -> id != null && id > 0)
                .collect(java.util.stream.Collectors.toList());
        if (ids.isEmpty()) {
            return List.of();
        }
        List<DocumentModel> documents = karteServiceBean.getDocumentsWithModules(ids);
        if (documents == null || documents.isEmpty()) {
            return List.of();
        }
        return documents.stream()
                .filter(document -> isDocumentWithinRange(document, since, until))
                .toList();
    }

    private boolean isDiagnosisEffectiveOn(RegisteredDiagnosisModel diagnosis, LocalDate targetDate) {
        if (diagnosis == null || targetDate == null) {
            return false;
        }
        LocalDate started = parseIsoDate(diagnosis.getStartDate());
        if (started != null && started.isAfter(targetDate)) {
            return false;
        }
        LocalDate ended = diagnosis.getEnded() != null
                ? diagnosis.getEnded().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                : null;
        return ended == null || !ended.isBefore(targetDate);
    }

    private LocalDate parseIsoDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception ex) {
            return null;
        }
    }

    private boolean isDocumentWithinRange(DocumentModel document, Instant fromInclusive, Instant toExclusive) {
        if (document == null || document.getStarted() == null) {
            return false;
        }
        Instant started = document.getStarted().toInstant();
        return !started.isBefore(fromInclusive) && started.isBefore(toExclusive);
    }

    private Object decodeModule(ModuleModel module) {
        if (module == null) {
            return null;
        }
        try {
            return ModelUtils.decodeModule(module);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String formatDose(ClaimItem item) {
        if (item == null || item.getNumber() == null) {
            return null;
        }
        if (item.getUnit() != null && !item.getUnit().isBlank()) {
            return item.getNumber() + item.getUnit();
        }
        return item.getNumber();
    }
}
