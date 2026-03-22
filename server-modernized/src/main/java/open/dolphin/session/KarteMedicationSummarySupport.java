package open.dolphin.session;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ObservationModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.rest.dto.DiagnosisSummaryResponse;
import open.dolphin.rest.dto.KarteRevisionDocumentResponse;
import open.dolphin.rest.dto.RoutineMedicationResponse;
import open.dolphin.rest.dto.RpHistoryDrugResponse;
import open.dolphin.rest.dto.RpHistoryEntryResponse;
import open.dolphin.rest.dto.SafetySummaryResponse;
import open.dolphin.rest.support.KarteRevisionResponseMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class KarteMedicationSummarySupport {

    private static final Logger LOGGER = LoggerFactory.getLogger(KarteMedicationSummarySupport.class);
    private static final DateTimeFormatter ISO_INSTANT_FORMATTER = DateTimeFormatter.ISO_INSTANT;
    private static final DateTimeFormatter ISO_DATE_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);

    List<RoutineMedicationResponse> toRoutineMedicationResponses(List<DocumentModel> documents) {
        if (documents == null || documents.isEmpty()) {
            return Collections.emptyList();
        }
        List<DocumentModel> sorted = new ArrayList<>(documents);
        sorted.sort(Comparator.comparing(DocumentModel::getStarted, Comparator.nullsLast(Comparator.naturalOrder())).reversed());

        List<RoutineMedicationResponse> responses = new ArrayList<>();
        for (DocumentModel document : sorted) {
            List<ModuleModel> medModules = filterMedModules(document != null ? document.getModules() : null);
            if (medModules.isEmpty()) {
                continue;
            }
            responses.add(new RoutineMedicationResponse(
                    document.getId(),
                    determineRoutineName(document, medModules),
                    determineRoutineMemo(medModules),
                    document.getDocInfoModel() != null ? document.getDocInfoModel().getDocType() : null,
                    formatIso(document.getConfirmed() != null ? document.getConfirmed() : document.getRecorded()),
                    convertModules(medModules)
            ));
        }
        return responses;
    }

    List<RpHistoryEntryResponse> toRpHistoryEntries(List<DocumentModel> documents, boolean lastOnly) {
        if (documents == null || documents.isEmpty()) {
            return Collections.emptyList();
        }
        List<DocumentModel> sorted = new ArrayList<>(documents);
        sorted.sort(Comparator.comparing(DocumentModel::getStarted, Comparator.nullsLast(Comparator.naturalOrder())).reversed());

        Map<String, RpHistoryEntryResponse> grouped = new LinkedHashMap<>();
        for (DocumentModel document : sorted) {
            List<ModuleModel> medModules = filterMedModules(document != null ? document.getModules() : null);
            if (medModules.isEmpty()) {
                continue;
            }
            List<RpHistoryDrugResponse> drugs = toRpHistoryDrugs(medModules);
            if (drugs.isEmpty()) {
                continue;
            }
            String issuedDate = formatDateOnly(firstNonNull(
                    document.getConfirmed(),
                    document.getStarted(),
                    document.getRecorded()));
            if (lastOnly && issuedDate != null && grouped.containsKey(issuedDate)) {
                continue;
            }
            RpHistoryEntryResponse entry = new RpHistoryEntryResponse(
                    issuedDate,
                    document.getDocInfoModel() != null ? document.getDocInfoModel().getTitle() : null,
                    drugs
            );
            grouped.put(issuedDate != null ? issuedDate : UUID.randomUUID().toString(), entry);
        }

        return new ArrayList<>(grouped.values());
    }

    SafetySummaryResponse toSafetySummary(
            List<ObservationModel> observations,
            List<RegisteredDiagnosisModel> diagnoses,
            List<RoutineMedicationResponse> routineMeds) {
        List<SafetySummaryResponse.AllergySummaryResponse> allergies = new ArrayList<>();
        if (observations != null) {
            for (ObservationModel observation : observations) {
                SafetySummaryResponse.AllergySummaryResponse allergy = new SafetySummaryResponse.AllergySummaryResponse();
                allergy.setObservationId(observation.getId());
                allergy.setFactor(observation.getPhenomenon());
                allergy.setSeverity(observation.getCategoryValue());
                allergy.setIdentifiedDate(observation.confirmDateAsString());
                allergy.setMemo(observation.getMemo());
                allergies.add(allergy);
            }
        }

        List<DiagnosisSummaryResponse> diagnosisSummaries = new ArrayList<>();
        if (diagnoses != null) {
            for (RegisteredDiagnosisModel diagnosis : diagnoses) {
                DiagnosisSummaryResponse summary = new DiagnosisSummaryResponse();
                summary.setId(diagnosis.getId());
                summary.setDiagnosis(diagnosis.getDiagnosis());
                summary.setDiagnosisCode(diagnosis.getDiagnosisCode());
                summary.setStartDate(diagnosis.getStartDate());
                summary.setOutcome(diagnosis.getOutcome());
                summary.setOutcomeDesc(diagnosis.getOutcomeDesc());
                diagnosisSummaries.add(summary);
            }
        }

        return new SafetySummaryResponse(
                allergies,
                diagnosisSummaries,
                routineMeds != null ? routineMeds : Collections.emptyList());
    }

    private List<ModuleModel> filterMedModules(List<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return Collections.emptyList();
        }
        List<ModuleModel> filtered = new ArrayList<>();
        for (ModuleModel module : modules) {
            if (module != null
                    && module.getModuleInfoBean() != null
                    && IInfoModel.ENTITY_MED_ORDER.equals(module.getModuleInfoBean().getEntity())) {
                filtered.add(module);
            }
        }
        return filtered;
    }

    private String determineRoutineName(DocumentModel document, List<ModuleModel> modules) {
        String title = document.getDocInfoModel() != null ? document.getDocInfoModel().getTitle() : null;
        if (hasText(title)) {
            return title.trim();
        }
        for (ModuleModel module : modules) {
            ModuleInfoBean info = module.getModuleInfoBean();
            if (info != null && hasText(info.getStampName())) {
                return info.getStampName().trim();
            }
        }
        return "Document #" + document.getId();
    }

    private String determineRoutineMemo(List<ModuleModel> modules) {
        for (ModuleModel module : modules) {
            ModuleInfoBean info = module.getModuleInfoBean();
            if (info != null && hasText(info.getStampMemo())) {
                return info.getStampMemo().trim();
            }
        }
        return null;
    }

    private List<KarteRevisionDocumentResponse.ModuleResponse> convertModules(List<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return Collections.emptyList();
        }
        List<KarteRevisionDocumentResponse.ModuleResponse> responses =
                KarteRevisionResponseMapper.mapModuleResponses(modules);
        return responses != null ? responses : Collections.emptyList();
    }

    private String formatIso(Date date) {
        if (date == null) {
            return null;
        }
        Instant instant = date.toInstant();
        return ISO_INSTANT_FORMATTER.format(instant);
    }

    private String formatDateOnly(Date date) {
        if (date == null) {
            return null;
        }
        return ISO_DATE_FORMATTER.format(date.toInstant());
    }

    private Date firstNonNull(Date... candidates) {
        if (candidates == null) {
            return null;
        }
        for (Date candidate : candidates) {
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private List<RpHistoryDrugResponse> toRpHistoryDrugs(List<ModuleModel> modules) {
        List<RpHistoryDrugResponse> responses = new ArrayList<>();
        for (ModuleModel module : modules) {
            BundleDolphin bundle = decodeBundle(module);
            if (bundle == null || bundle.getClaimItem() == null) {
                continue;
            }
            for (ClaimItem item : bundle.getClaimItem()) {
                responses.add(new RpHistoryDrugResponse(
                        item != null ? item.getCode() : null,
                        item != null ? item.getClassCode() : null,
                        item != null ? item.getName() : null,
                        buildAmount(item),
                        item != null ? item.getDose() : null,
                        bundle.getAdmin(),
                        bundle.getBundleNumber(),
                        firstNonBlank(item != null ? item.getMemo() : null, bundle.getMemo(), bundle.getAdminMemo())
                ));
            }
        }
        return responses;
    }

    private BundleDolphin decodeBundle(ModuleModel module) {
        try {
            Object decoded = ModelUtils.decodeModule(module);
            if (decoded instanceof BundleDolphin) {
                return (BundleDolphin) decoded;
            }
        } catch (Exception ex) {
            LOGGER.debug("Failed to decode module {}", module != null ? module.getId() : null, ex);
        }
        return null;
    }

    private String buildAmount(ClaimItem item) {
        if (item == null || !hasText(item.getNumber())) {
            return null;
        }
        StringBuilder sb = new StringBuilder(item.getNumber().trim());
        if (hasText(item.getUnit())) {
            sb.append(item.getUnit().trim());
        }
        return sb.toString();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
