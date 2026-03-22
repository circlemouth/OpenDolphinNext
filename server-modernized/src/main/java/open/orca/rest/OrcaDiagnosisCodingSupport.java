package open.orca.rest;

import open.dolphin.infomodel.RegisteredDiagnosisModel;

final class OrcaDiagnosisCodingSupport {

    private OrcaDiagnosisCodingSupport() {
    }

    static void storeSuspectedDiagnosis(RegisteredDiagnosisModel model, String value) {
        if ("1".equals(value) || "3".equals(value)) {
            model.setCategory("suspectedDiagnosis");
            model.setCategoryDesc("疑い病名");
            model.setCategoryCodeSys("MML0015");
        }
    }

    static void storeMainDiagnosis(RegisteredDiagnosisModel model, String value) {
        if ("1".equals(value)) {
            model.setCategory("mainDiagnosis");
            model.setCategoryDesc("主病名");
            model.setCategoryCodeSys("MML0012");
        }
    }

    static void storeOutcome(RegisteredDiagnosisModel model, String value) {
        if ("1".equals(value)) {
            model.setOutcome("fullyRecovered");
            model.setOutcomeDesc("全治");
            model.setOutcomeCodeSys("MML0016");
        } else if ("2".equals(value)) {
            model.setOutcome("died");
            model.setOutcomeDesc("死亡");
            model.setOutcomeCodeSys("MML0016");
        } else if ("3".equals(value)) {
            model.setOutcome("pause");
            model.setOutcomeDesc("中止");
            model.setOutcomeCodeSys("MML0016");
        } else if ("8".equals(value)) {
            model.setOutcome("transfer");
            model.setOutcomeDesc("転医");
            model.setOutcomeCodeSys("MML0016");
        }
    }
}
