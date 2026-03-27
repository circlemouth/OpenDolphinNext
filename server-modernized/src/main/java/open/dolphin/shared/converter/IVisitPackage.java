package open.dolphin.shared.converter;

import java.util.ArrayList;
import java.util.List;
import open.dolphin.converter.AllergyModelConverter;
import open.dolphin.converter.IInfoModelConverter;
import open.dolphin.converter.ModelCopySupport;
import open.dolphin.converter.PatientMemoModelConverter;
import open.dolphin.infomodel.AllergyModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.VisitPackage;

public abstract class IVisitPackage<TPatientVisitModel, TPatientModel, TDocument, TRegisteredDiagnosis extends IRegisteredDiagnosis>
        implements IInfoModelConverter {

    private VisitPackage model;

    protected abstract TPatientVisitModel createPatientVisitModel(PatientVisitModel model);

    protected abstract TPatientModel createPatientModel(PatientModel model);

    protected abstract TDocument createDocumentModel(DocumentModel model);

    protected abstract TRegisteredDiagnosis createRegisteredDiagnosis();

    public long getKartePk() {
        return model.getKartePk();
    }

    public String getNumber() {
        return model.getNumber();
    }

    public TPatientVisitModel getPatientVisitModel() {
        if (model.getPatientVisitModel() != null) {
            return createPatientVisitModel(model.getPatientVisitModel());
        }
        return null;
    }

    public TPatientModel getPatientModel() {
        if (model.getPatientModel() != null) {
            return createPatientModel(model.getPatientModel());
        }

        return null;
    }

    public TDocument getDocumentModel() {
        if (model.getDocumenModel() != null) {
            return createDocumentModel(model.getDocumenModel());
        }
        return null;
    }

    public List<AllergyModelConverter> getAllergies() {
        if (model.getAllergies() != null && model.getAllergies().size() > 0) {
            List<AllergyModelConverter> conv = new ArrayList();
            for (AllergyModel m : model.getAllergies()) {
                AllergyModelConverter ac = new AllergyModelConverter();
                ac.setModel(m);
                conv.add(ac);
            }
            return conv;
        }
        return null;
    }

    public PatientMemoModelConverter getPatientMemo() {
        if (model.getPatientMemoModel() != null) {
            PatientMemoModelConverter conv = new PatientMemoModelConverter();
            conv.setModel(model.getPatientMemoModel());
            return conv;
        }
        return null;
    }

    public List<TRegisteredDiagnosis> getDisease() {
        if (model.getDisease() != null && model.getDisease().size() > 0) {
            List<TRegisteredDiagnosis> ret = new ArrayList();
            for (RegisteredDiagnosisModel rd : model.getDisease()) {
                TRegisteredDiagnosis conv = createRegisteredDiagnosis();
                conv.fromModel(rd);
                ret.add(conv);
            }
            return ret;
        }
        return null;
    }

    @Override
    public void setModel(IInfoModel m) {
        this.model = ModelCopySupport.copy((VisitPackage) m, VisitPackage::new);
    }
}
