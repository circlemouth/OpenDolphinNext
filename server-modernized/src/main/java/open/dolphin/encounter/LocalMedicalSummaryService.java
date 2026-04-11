package open.dolphin.encounter;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.ProgressCourse;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.rest.dto.localsummary.LocalMedicalSummaryResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;

@ApplicationScoped
public class LocalMedicalSummaryService {

    private static final String LOCAL_SUMMARY_PATH = "/api/local/encounters/{encounterKey}/medical-summary";

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    public LocalMedicalSummaryResponse buildSummary(EncounterProjectionRepository.EncounterRow row) {
        requireRow(row);
        requireEncounterTarget(row);
        LocalMedicalSummaryResponse response = new LocalMedicalSummaryResponse();
        response.setSourcePath(LOCAL_SUMMARY_PATH);
        response.setPayload(new LocalMedicalSummaryResponse.Payload());

        PatientModel patient = loadPatient(row);
        if (patient == null) {
            response.setOutcome("MISSING");
            response.setRecordsReturned(0);
            response.getPayload().setOutpatientList(List.of());
            return response;
        }
        validatePatientScope(row, patient);

        LocalDate encounterDate = row.acceptanceDatetime().atZone(ZoneId.systemDefault()).toLocalDate();
        Date fromDate = Date.from(encounterDate.minusDays(30).atStartOfDay(ZoneId.systemDefault()).toInstant());

        List<RegisteredDiagnosisModel> diagnoses = safeDiagnoses(row);
        List<DocInfoProjection> documents = safeDocuments(row, fromDate);
        if (diagnoses.isEmpty() && documents.isEmpty()) {
            response.setOutcome("MISSING");
            response.setRecordsReturned(0);
            response.getPayload().setOutpatientList(List.of());
            return response;
        }

        LocalMedicalSummaryResponse.MedicalSummaryItem item = new LocalMedicalSummaryResponse.MedicalSummaryItem();
        item.setEncounterKey(row.encounterKey());
        item.setScheduleKey(row.scheduleKey());
        item.setDepartment(null);
        item.setPhysician(null);

        LocalMedicalSummaryResponse.PatientSummary summary = new LocalMedicalSummaryResponse.PatientSummary();
        summary.setPatientId(row.patientId());
        String wholeName = resolvePatientName(patient);
        if (wholeName == null) {
            throw conflict("AUTHORITATIVE_SUMMARY_NOT_DETERMINISTIC", "Patient name is not deterministic", row);
        }
        summary.setWholeName(wholeName);
        item.setPatient(summary);

        Map<String, LocalMedicalSummaryResponse.MedicalSection> sections = new LinkedHashMap<>();
        SectionBuild diagnosisSection = buildDiagnosisSection(diagnoses, encounterDate);
        SectionBuild prescriptionSection = buildBundleSection(documents, encounterDate, IInfoModel.ENTITY_MED_ORDER, "prescription");
        SectionBuild labSection = buildBundleSection(documents, encounterDate, IInfoModel.ENTITY_LABO_TEST, "lab");
        SectionBuild procedureSection = buildProcedureSection(documents, encounterDate);
        SectionBuild memoSection = buildMemoSection(documents, encounterDate);
        sections.put("diagnosis", diagnosisSection.section());
        sections.put("prescription", prescriptionSection.section());
        sections.put("lab", labSection.section());
        sections.put("procedure", procedureSection.section());
        sections.put("memo", memoSection.section());
        boolean hasSectionData = sections.values().stream()
                .anyMatch(section -> section.getRecordsReturned() != null && section.getRecordsReturned() > 0);
        if (!hasSectionData) {
            response.setOutcome("MISSING");
            response.setRecordsReturned(0);
            response.getPayload().setOutpatientList(List.of());
            return response;
        }
        item.setSections(sections);

        int totalRecordsReturned = sections.values().stream()
                .map(LocalMedicalSummaryResponse.MedicalSection::getRecordsReturned)
                .filter(value -> value != null)
                .mapToInt(Integer::intValue)
                .sum();
        item.setRecordsReturned(totalRecordsReturned);
        item.setOutcome(resolveItemOutcome(sections));

        response.getPayload().setOutpatientList(List.of(item));
        response.setRecordsReturned(1);
        response.setOutcome("SUCCESS".equals(item.getOutcome()) ? "SUCCESS" : "PARTIAL");
        return response;
    }

    private PatientModel loadPatient(EncounterProjectionRepository.EncounterRow row) {
        if (patientServiceBean == null) {
            throw unavailable("LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE", "Patient service is unavailable", Map.of(
                    "encounterKey", row.encounterKey(),
                    "patientId", row.patientId()));
        }
        try {
            return patientServiceBean.getPatientById(row.facilityId(), row.patientId());
        } catch (RuntimeException ex) {
            throw unavailable("LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE", "Failed to resolve patient read model", Map.of(
                    "encounterKey", row.encounterKey(),
                    "patientId", row.patientId()));
        }
    }

    private List<RegisteredDiagnosisModel> safeDiagnoses(EncounterProjectionRepository.EncounterRow row) {
        if (karteServiceBean == null) {
            throw unavailable("LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE", "Read model is unavailable", Map.of(
                    "encounterKey", row.encounterKey(),
                    "karteId", row.karteId(),
                    "component", "diagnosis"));
        }
        try {
            List<RegisteredDiagnosisModel> diagnoses = karteServiceBean.getDiagnosis(row.karteId(), null, false);
            return diagnoses != null ? diagnoses : List.of();
        } catch (RuntimeException ex) {
            throw unavailable("LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE", "Read model is unavailable", Map.of(
                    "encounterKey", row.encounterKey(),
                    "karteId", row.karteId(),
                    "component", "diagnosis"));
        }
    }

    private List<DocInfoProjection> safeDocuments(EncounterProjectionRepository.EncounterRow row, Date fromDate) {
        if (karteServiceBean == null) {
            throw unavailable("LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE", "Read model is unavailable", Map.of(
                    "encounterKey", row.encounterKey(),
                    "karteId", row.karteId(),
                    "component", "document"));
        }
        try {
            List<open.dolphin.infomodel.DocInfoModel> docInfos = karteServiceBean.getDocumentList(row.karteId(), fromDate, true);
            if (docInfos == null || docInfos.isEmpty()) {
                return List.of();
            }
            List<Long> ids = docInfos.stream()
                    .map(open.dolphin.infomodel.DocInfoModel::getDocPk)
                    .filter(id -> id != null && id > 0)
                    .toList();
            if (ids.isEmpty()) {
                return List.of();
            }
            List<DocumentModel> documents = karteServiceBean.getDocumentsWithModules(ids);
            if (documents == null || documents.isEmpty()) {
                return List.of();
            }
            return documents.stream()
                    .filter(document -> document != null && document.getStarted() != null)
                    .map(document -> new DocInfoProjection(document, document.getStarted().toInstant()))
                    .toList();
        } catch (RuntimeException ex) {
            throw unavailable("LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE", "Read model is unavailable", Map.of(
                    "encounterKey", row.encounterKey(),
                    "karteId", row.karteId(),
                    "component", "document"));
        }
    }

    private void validatePatientScope(EncounterProjectionRepository.EncounterRow row, PatientModel patient) {
        if (row.karteId() == null || row.karteId() <= 0 || row.patientId() == null || row.patientId().isBlank()) {
            throw conflict("AUTHORITATIVE_SUMMARY_NOT_DETERMINISTIC", "Encounter summary target is not deterministic", row);
        }
        if (patient == null) {
            return;
        }
        String resolvedFacility = patient.getFacilityId();
        String resolvedPatientId = patient.getPatientId();
        if (resolvedFacility != null && !resolvedFacility.isBlank() && !row.facilityId().equals(resolvedFacility.trim())) {
            throw conflict("ENCOUNTER_SUMMARY_LINK_MISMATCH", "Encounter summary link does not match patient scope", row);
        }
        if (resolvedPatientId != null && !resolvedPatientId.isBlank() && !row.patientId().equals(resolvedPatientId.trim())) {
            throw conflict("ENCOUNTER_SUMMARY_LINK_MISMATCH", "Encounter summary link does not match patient scope", row);
        }
    }

    private SectionBuild buildDiagnosisSection(List<RegisteredDiagnosisModel> diagnoses, LocalDate encounterDate) {
        LocalMedicalSummaryResponse.MedicalSection section = new LocalMedicalSummaryResponse.MedicalSection();
        List<LocalMedicalSummaryResponse.MedicalSectionItem> items = new ArrayList<>();
        for (RegisteredDiagnosisModel diagnosis : diagnoses) {
            if (!isDiagnosisEffectiveOn(diagnosis, encounterDate)) {
                continue;
            }
            LocalMedicalSummaryResponse.MedicalSectionItem item = new LocalMedicalSummaryResponse.MedicalSectionItem();
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
        section.setItems(items);
        section.setRecordsReturned(items.size());
        section.setOutcome(items.isEmpty() ? "MISSING" : "SUCCESS");
        return new SectionBuild(section, items.isEmpty() ? 0 : 1, 0);
    }

    private SectionBuild buildBundleSection(List<DocInfoProjection> documents, LocalDate encounterDate, String targetEntity,
            String mode) {
        LocalMedicalSummaryResponse.MedicalSection section = new LocalMedicalSummaryResponse.MedicalSection();
        List<LocalMedicalSummaryResponse.MedicalSectionItem> items = new ArrayList<>();
        int skipped = 0;
        for (DocInfoProjection document : documents) {
            if (document.document().getModules() == null) {
                continue;
            }
            if (!isWithinRange(document.started(), encounterDate)) {
                continue;
            }
            for (ModuleModel module : document.document().getModules()) {
                Object decoded = decodeModule(module);
                if (!(decoded instanceof BundleDolphin bundle)) {
                    continue;
                }
                String entity = module.getModuleInfoBean() != null ? module.getModuleInfoBean().getEntity() : null;
                if (entity == null || !entity.equals(targetEntity)) {
                    continue;
                }
                try {
                    for (ClaimItem claimItem : safeClaimItems(bundle)) {
                        LocalMedicalSummaryResponse.MedicalSectionItem item = new LocalMedicalSummaryResponse.MedicalSectionItem();
                        item.setName(claimItem.getName());
                        if ("prescription".equals(mode)) {
                            item.setDose(formatDose(claimItem));
                            item.setFrequency(bundle.getAdmin());
                        } else if ("lab".equals(mode)) {
                            item.setValue(claimItem.getNumber());
                            item.setUnit(claimItem.getUnit());
                        }
                        items.add(item);
                    }
                } catch (RuntimeException ex) {
                    skipped++;
                }
            }
        }
        section.setItems(items);
        section.setRecordsReturned(items.size());
        if (items.isEmpty()) {
            section.setOutcome(skipped > 0 ? "ERROR" : "MISSING");
            if (skipped > 0) {
                section.setMessage("Some bundle rows could not be decoded.");
            }
        } else if (skipped > 0) {
            section.setOutcome("PARTIAL");
            section.setMessage("Some bundle rows could not be decoded.");
        } else {
            section.setOutcome("SUCCESS");
        }
        return new SectionBuild(section, items.size(), skipped);
    }

    private SectionBuild buildProcedureSection(List<DocInfoProjection> documents, LocalDate encounterDate) {
        LocalMedicalSummaryResponse.MedicalSection section = new LocalMedicalSummaryResponse.MedicalSection();
        List<LocalMedicalSummaryResponse.MedicalSectionItem> items = new ArrayList<>();
        for (DocInfoProjection document : documents) {
            if (!isWithinRange(document.started(), encounterDate)) {
                continue;
            }
            if (document.document().getModules() == null) {
                continue;
            }
            for (ModuleModel module : document.document().getModules()) {
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
                    for (ClaimItem claimItem : safeClaimItems(bundle)) {
                        LocalMedicalSummaryResponse.MedicalSectionItem item = new LocalMedicalSummaryResponse.MedicalSectionItem();
                        item.setName(claimItem.getName());
                        item.setResult(claimItem.getNumber());
                        item.setUnit(claimItem.getUnit());
                        items.add(item);
                    }
                }
            }
        }
        section.setItems(items);
        section.setRecordsReturned(items.size());
        section.setOutcome(items.isEmpty() ? "MISSING" : "SUCCESS");
        return new SectionBuild(section, items.isEmpty() ? 0 : 1, 0);
    }

    private SectionBuild buildMemoSection(List<DocInfoProjection> documents, LocalDate encounterDate) {
        LocalMedicalSummaryResponse.MedicalSection section = new LocalMedicalSummaryResponse.MedicalSection();
        List<LocalMedicalSummaryResponse.MedicalSectionItem> items = new ArrayList<>();
        for (DocInfoProjection document : documents) {
            if (!isWithinRange(document.started(), encounterDate)) {
                continue;
            }
            if (document.document().getModules() == null) {
                continue;
            }
            for (ModuleModel module : document.document().getModules()) {
                Object decoded = decodeModule(module);
                if (!(decoded instanceof ProgressCourse progress)) {
                    continue;
                }
                String entity = module.getModuleInfoBean() != null ? module.getModuleInfoBean().getEntity() : null;
                if (!IInfoModel.ENTITY_TEXT.equals(entity)) {
                    continue;
                }
                LocalMedicalSummaryResponse.MedicalSectionItem item = new LocalMedicalSummaryResponse.MedicalSectionItem();
                item.setText(progress.getFreeText());
                items.add(item);
            }
        }
        section.setItems(items);
        section.setRecordsReturned(items.size());
        section.setOutcome(items.isEmpty() ? "MISSING" : "SUCCESS");
        return new SectionBuild(section, items.isEmpty() ? 0 : 1, 0);
    }

    private static List<ClaimItem> safeClaimItems(BundleDolphin bundle) {
        ClaimItem[] items = bundle != null ? bundle.getClaimItem() : null;
        if (items == null || items.length == 0) {
            return List.of();
        }
        List<ClaimItem> result = new ArrayList<>();
        for (ClaimItem item : items) {
            if (item != null) {
                result.add(item);
            }
        }
        return result;
    }

    private static boolean isWithinRange(Instant started, LocalDate encounterDate) {
        if (started == null || encounterDate == null) {
            return false;
        }
        Instant from = encounterDate.minusDays(30).atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant to = encounterDate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        return !started.isBefore(from) && started.isBefore(to);
    }

    private static boolean isDiagnosisEffectiveOn(RegisteredDiagnosisModel diagnosis, LocalDate targetDate) {
        if (diagnosis == null || targetDate == null) {
            return false;
        }
        LocalDate started = parseIsoDate(diagnosis.getStartDate());
        if (started != null && started.isAfter(targetDate)) {
            return false;
        }
        LocalDate ended = diagnosis.getEnded() != null
                ? diagnosis.getEnded().toInstant().atZone(ZoneId.systemDefault()).toLocalDate()
                : null;
        return ended == null || !ended.isBefore(targetDate);
    }

    private static LocalDate parseIsoDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception ex) {
            return null;
        }
    }

    private static Object decodeModule(ModuleModel module) {
        if (module == null) {
            return null;
        }
        try {
            return ModelUtils.decodeModule(module);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String formatDose(ClaimItem item) {
        if (item == null || item.getNumber() == null) {
            return null;
        }
        if (item.getUnit() != null && !item.getUnit().isBlank()) {
            return item.getNumber() + item.getUnit();
        }
        return item.getNumber();
    }

    private static String resolvePatientName(PatientModel patient) {
        if (patient == null) {
            return null;
        }
        String fullName = patient.getFullName();
        if (fullName != null && !fullName.isBlank()) {
            return fullName.trim();
        }
        String familyName = patient.getFamilyName();
        String givenName = patient.getGivenName();
        String fallback = ((familyName != null ? familyName.trim() : "")
                + " "
                + (givenName != null ? givenName.trim() : "")).trim();
        return fallback.isBlank() ? null : fallback;
    }

    private static void requireRow(EncounterProjectionRepository.EncounterRow row) {
        if (row == null) {
            throw new IllegalArgumentException("encounter row is required");
        }
    }

    private static void requireEncounterTarget(EncounterProjectionRepository.EncounterRow row) {
        if (row.encounterKey() == null || row.encounterKey().isBlank()
                || row.facilityId() == null || row.facilityId().isBlank()
                || row.patientId() == null || row.patientId().isBlank()
                || row.karteId() == null || row.karteId() <= 0
                || row.acceptanceDatetime() == null) {
            throw conflict("AUTHORITATIVE_SUMMARY_NOT_DETERMINISTIC", "Encounter summary target is not deterministic", row);
        }
    }

    private static LocalMedicalSummaryFailure unavailable(String code, String message, Map<String, Object> details) {
        return new LocalMedicalSummaryFailure(503, code, message, details);
    }

    private static LocalMedicalSummaryFailure conflict(String trigger, String message, EncounterProjectionRepository.EncounterRow row) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("trigger", trigger);
        details.put("encounterKey", row.encounterKey());
        details.put("facilityId", row.facilityId());
        details.put("patientId", row.patientId());
        details.put("karteId", row.karteId());
        return new LocalMedicalSummaryFailure(409, "LOCAL_SUMMARY_PROJECTION_CONFLICT", message, details);
    }

    private record DocInfoProjection(DocumentModel document, Instant started) {
    }

    private record SectionBuild(LocalMedicalSummaryResponse.MedicalSection section, int recordsReturned, int skipped) {
    }

    public static final class LocalMedicalSummaryFailure extends RuntimeException {
        private final int httpStatus;
        private final String code;
        private final String detailsMessage;
        private final Map<String, Object> details;

        LocalMedicalSummaryFailure(int httpStatus, String code, String message, Map<String, Object> details) {
            super(message);
            this.httpStatus = httpStatus;
            this.code = code;
            this.detailsMessage = message;
            this.details = details == null
                    ? Collections.emptyMap()
                    : Collections.unmodifiableMap(new LinkedHashMap<>(details));
        }

        public int httpStatus() {
            return httpStatus;
        }

        public String code() {
            return code;
        }

        public String detailsMessage() {
            return detailsMessage;
        }

        public Map<String, Object> details() {
            return Map.copyOf(details);
        }
    }

    private String resolveItemOutcome(Map<String, LocalMedicalSummaryResponse.MedicalSection> sections) {
        boolean allSuccess = true;
        boolean anyData = false;
        for (LocalMedicalSummaryResponse.MedicalSection section : sections.values()) {
            String outcome = section.getOutcome();
            if ("SUCCESS".equals(outcome)) {
                anyData = true;
                continue;
            }
            if (section.getRecordsReturned() != null && section.getRecordsReturned() > 0) {
                anyData = true;
            }
            allSuccess = false;
        }
        if (allSuccess) {
            return "SUCCESS";
        }
        return anyData ? "PARTIAL" : "MISSING";
    }
}
