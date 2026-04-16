package open.dolphin.orca.service;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseEntry;

@ApplicationScoped
public class DiseaseProjectionService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            .withLocale(Locale.JAPAN)
            .withZone(ZoneId.systemDefault());

    public DiseaseImportResponse buildImportResponse(
            List<RegisteredDiagnosisModel> diagnoses,
            String runId,
            String patientId,
            Date fromDate,
            Date toDate) {
        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBaseDate(formatDate(fromDate));
        List<RegisteredDiagnosisModel> safeDiagnoses = diagnoses != null ? diagnoses : List.of();
        safeDiagnoses.stream()
                .filter(model -> model.getStarted() == null || toDate == null || !model.getStarted().after(toDate))
                .map(this::toEntry)
                .forEach(response::addDisease);
        if (response.getDiseases() == null) {
            response.setDiseases(new ArrayList<>());
        }
        return response;
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
        entry.setLayer("orca-mirror");
        entry.setSyncState("manual-resolution");
        entry.setReadOnly(Boolean.TRUE);
        entry.setCandidateOnly(Boolean.FALSE);
        entry.setNote("保険病名の確認が必要です");
        return entry;
    }

    private String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return DATE_FORMAT.format(date.toInstant());
    }
}
