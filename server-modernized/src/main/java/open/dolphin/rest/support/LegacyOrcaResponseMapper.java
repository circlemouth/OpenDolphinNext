package open.dolphin.rest.support;

import java.util.List;
import java.util.stream.Collectors;
import open.dolphin.infomodel.CodeNamePack;
import open.dolphin.infomodel.DiagnosisCategoryModel;
import open.dolphin.infomodel.DiagnosisOutcomeModel;
import open.dolphin.infomodel.DiseaseEntry;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.TensuMaster;
import open.dolphin.infomodel.UserModel;

public final class LegacyOrcaResponseMapper {

    private LegacyOrcaResponseMapper() {
    }

    public static TensuListResponse toTensuListResponse(List<TensuMaster> items) {
        return new TensuListResponse(mapList(items, LegacyOrcaResponseMapper::toTensuMasterResponse));
    }

    public static DiseaseListResponse toDiseaseListResponse(List<DiseaseEntry> items) {
        return new DiseaseListResponse(mapList(items, LegacyOrcaResponseMapper::toDiseaseEntryResponse));
    }

    public static CodeNamePackResponse toCodeNamePackResponse(CodeNamePack model) {
        if (model == null) {
            return null;
        }
        return new CodeNamePackResponse(model.getCode(), model.getName());
    }

    public static RegisteredDiagnosisListResponse toRegisteredDiagnosisListResponse(List<RegisteredDiagnosisModel> items) {
        return new RegisteredDiagnosisListResponse(
                mapList(items, LegacyOrcaResponseMapper::toRegisteredDiagnosisResponse));
    }

    private static TensuMasterResponse toTensuMasterResponse(TensuMaster model) {
        return new TensuMasterResponse(
                model.getHospnum(),
                model.getSrycd(),
                model.getYukoedymd(),
                model.getYukoedymd(),
                model.getName(),
                model.getKananame(),
                model.getTaniname(),
                model.getTensikibetu(),
                model.getTen(),
                model.getYkzkbn(),
                model.getYakkakjncd(),
                model.getNyugaitekkbn(),
                model.getRoutekkbn(),
                model.getSrysyukbn(),
                model.getHospsrykbn());
    }

    private static DiseaseEntryResponse toDiseaseEntryResponse(DiseaseEntry model) {
        return new DiseaseEntryResponse(
                model.getCode(),
                model.getName(),
                model.getKana(),
                model.getStartDate(),
                model.getEndDate(),
                model.getDisUseDate(),
                model.getIcdTen());
    }

    private static RegisteredDiagnosisResponse toRegisteredDiagnosisResponse(RegisteredDiagnosisModel model) {
        return new RegisteredDiagnosisResponse(
                model.getId(),
                model.getConfirmed(),
                model.getStarted(),
                model.getEnded(),
                model.getRecorded(),
                model.getLinkId(),
                model.getLinkRelation(),
                model.getStatus() != null ? model.getStatus() : IInfoModel.STATUS_FINAL,
                toUserIdReference(model.getUserModel()),
                toKarteIdReference(model.getKarteBean()),
                model.getDiagnosis(),
                model.getDiagnosisCode(),
                model.getDiagnosisCodeSystem(),
                model.getFirstEncounterDate(),
                model.getRelatedHealthInsurance(),
                toDiagnosisCategoryResponse(model.getDiagnosisCategoryModel()),
                toDiagnosisOutcomeResponse(model.getDiagnosisOutcomeModel()),
                model.getDepartment(),
                model.getDepartmentDesc());
    }

    private static UserIdReference toUserIdReference(UserModel source) {
        return source != null ? new UserIdReference(source.getId()) : null;
    }

    private static KarteIdReference toKarteIdReference(KarteBean source) {
        return source != null ? new KarteIdReference(source.getId()) : null;
    }

    private static DiagnosisCategoryResponse toDiagnosisCategoryResponse(DiagnosisCategoryModel source) {
        if (source == null) {
            return null;
        }
        return new DiagnosisCategoryResponse(
                source.getDiagnosisCategory(),
                source.getDiagnosisCategoryDesc(),
                source.getDiagnosisCategoryCodeSys());
    }

    private static DiagnosisOutcomeResponse toDiagnosisOutcomeResponse(DiagnosisOutcomeModel source) {
        if (source == null) {
            return null;
        }
        return new DiagnosisOutcomeResponse(
                source.getOutcome(),
                source.getOutcomeDesc(),
                source.getOutcomeCodeSys());
    }

    private static <T, R> List<R> mapList(List<T> items, java.util.function.Function<T, R> mapper) {
        if (items == null || items.isEmpty()) {
            return null;
        }
        return items.stream().map(mapper).collect(Collectors.toList());
    }

    public record TensuListResponse(List<TensuMasterResponse> list) {
    }

    public record TensuMasterResponse(
            Integer hospnum,
            String srycd,
            String yukostymd,
            String yukoedymd,
            String name,
            String kananame,
            String taniname,
            String tensikibetu,
            String ten,
            String ykzkbn,
            String yakkakjncd,
            String nyugaitekkbn,
            String routekkbn,
            String srysyukbn,
            String hospsrykbn) {
    }

    public record DiseaseListResponse(List<DiseaseEntryResponse> list) {
    }

    public record DiseaseEntryResponse(
            String code,
            String name,
            String kana,
            String startDate,
            String endDate,
            String disUseDate,
            String icdTen) {
    }

    public record CodeNamePackResponse(String code, String name) {
    }

    public record RegisteredDiagnosisListResponse(List<RegisteredDiagnosisResponse> list) {
    }

    public record RegisteredDiagnosisResponse(
            long id,
            java.util.Date confirmed,
            java.util.Date started,
            java.util.Date ended,
            java.util.Date recorded,
            long linkId,
            String linkRelation,
            String status,
            UserIdReference userModel,
            KarteIdReference karteBean,
            String diagnosis,
            String diagnosisCode,
            String diagnosisCodeSystem,
            String firstEncounterDate,
            String relatedHealthInsurance,
            DiagnosisCategoryResponse diagnosisCategoryModel,
            DiagnosisOutcomeResponse diagnosisOutcomeModel,
            String department,
            String departmentDesc) {
    }

    public record UserIdReference(long id) {
    }

    public record KarteIdReference(long id) {
    }

    public record DiagnosisCategoryResponse(
            String diagnosisCategory,
            String diagnosisCategoryDesc,
            String diagnosisCategoryCodeSys) {
    }

    public record DiagnosisOutcomeResponse(
            String outcome,
            String outcomeDesc,
            String outcomeCodeSys) {
    }
}
